/**
 * TradeMind — 商户问题与建议提交
 */
(function () {
    'use strict';

    var MAX_CONTENT = 300;
    var MAX_IMAGES = 10;
    var MAX_FILE_BYTES = 5 * 1024 * 1024;
    var modalEl = null;
    var submitting = false;
    var images = [];

    function notify(msg, type) {
        if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, type || 'info');
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
            return;
        }
        alert(msg);
    }

    function isMobileSource() {
        if (window.TM_Responsive && typeof window.TM_Responsive.isMobileView === 'function') {
            return window.TM_Responsive.isMobileView();
        }
        return window.matchMedia('(max-width: 767px)').matches;
    }

    function ensureModal() {
        if (modalEl) {
            return modalEl;
        }
        var html = ''
            + '<div id="tm-feedback-modal" class="fixed inset-0 z-[120] items-center justify-center p-4 md:p-8 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tm-feedback-title">'
            + '  <div class="tm-feedback-sheet bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200 rounded-2xl md:rounded-3xl">'
            + '    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">'
            + '      <h2 id="tm-feedback-title" class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="ph ph-chat-circle-dots text-brand-600 text-xl"></i>问题与建议</h2>'
            + '      <button type="button" id="tm-feedback-close" class="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center" aria-label="关闭"><i class="ph ph-x text-lg"></i></button>'
            + '    </div>'
            + '    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">'
            + '      <div>'
            + '        <label class="text-xs font-bold text-slate-500 mb-2 block">描述问题或建议</label>'
            + '        <textarea id="tm-feedback-content" rows="5" maxlength="' + MAX_CONTENT + '" placeholder="请简要描述您遇到的问题或改进建议…" class="w-full text-sm text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"></textarea>'
            + '        <p class="text-right text-[10px] text-slate-400 mt-1"><span id="tm-feedback-count">0</span>/' + MAX_CONTENT + '</p>'
            + '      </div>'
            + '      <div>'
            + '        <label class="text-xs font-bold text-slate-500 mb-2 block">截图（选填，最多 ' + MAX_IMAGES + ' 张）</label>'
            + '        <div id="tm-feedback-grid" class="grid grid-cols-3 gap-2"></div>'
            + '        <input type="file" id="tm-feedback-file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" />'
            + '      </div>'
            + '    </div>'
            + '    <div class="shrink-0 px-5 py-4 border-t border-slate-100 pb-safe">'
            + '      <button type="button" id="tm-feedback-submit" class="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition disabled:opacity-50 disabled:pointer-events-none">提交</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('tm-feedback-modal');

        document.getElementById('tm-feedback-close').addEventListener('click', close);
        modalEl.addEventListener('click', function (e) {
            if (e.target === modalEl) {
                close();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl.classList.contains('tm-feedback-open')) {
                close();
            }
        });

        var ta = document.getElementById('tm-feedback-content');
        ta.addEventListener('input', updateCount);
        document.getElementById('tm-feedback-submit').addEventListener('click', submit);
        document.getElementById('tm-feedback-file').addEventListener('change', onFilesSelected);

        return modalEl;
    }

    function updateCount() {
        var ta = document.getElementById('tm-feedback-content');
        var el = document.getElementById('tm-feedback-count');
        if (ta && el) {
            el.textContent = String((ta.value || '').length);
        }
    }

    function renderGrid() {
        var grid = document.getElementById('tm-feedback-grid');
        if (!grid) {
            return;
        }
        var parts = [];
        images.forEach(function (item, idx) {
            parts.push(
                '<div class="tm-feedback-thumb">'
                + '<img src="' + item.preview + '" alt="截图' + (idx + 1) + '" />'
                + '<button type="button" data-idx="' + idx + '" class="tm-feedback-rm absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="删除"><i class="ph ph-x text-xs"></i></button>'
                + '</div>'
            );
        });
        if (images.length < MAX_IMAGES) {
            parts.push(
                '<button type="button" id="tm-feedback-add" class="tm-feedback-add-cell">'
                + '<i class="ph ph-plus text-2xl mb-1"></i><span class="text-[10px] font-bold">添加图片</span>'
                + '</button>'
            );
        }
        grid.innerHTML = parts.join('');
        grid.querySelectorAll('.tm-feedback-rm').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-idx'), 10);
                if (images[i] && images[i].preview) {
                    try { URL.revokeObjectURL(images[i].preview); } catch (e1) { /* ignore */ }
                }
                images.splice(i, 1);
                renderGrid();
            });
        });
        var addBtn = document.getElementById('tm-feedback-add');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                document.getElementById('tm-feedback-file').click();
            });
        }
    }

    function compressToJpegBlob(file) {
        return new Promise(function (resolve, reject) {
            if (!file.type || file.type.indexOf('image/') !== 0) {
                reject(new Error('不支持的图片格式'));
                return;
            }
            if (file.size <= MAX_FILE_BYTES && file.type === 'image/jpeg') {
                resolve(file);
                return;
            }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                var maxSide = 1920;
                var w = img.width;
                var h = img.height;
                if (w > maxSide || h > maxSide) {
                    if (w >= h) {
                        h = Math.round(h * maxSide / w);
                        w = maxSide;
                    } else {
                        w = Math.round(w * maxSide / h);
                        h = maxSide;
                    }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(function (blob) {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('图片压缩失败'));
                    }
                }, 'image/jpeg', 0.8);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('图片读取失败'));
            };
            img.src = url;
        });
    }

    function onFilesSelected(e) {
        var files = e.target.files;
        if (!files || !files.length) {
            return;
        }
        var remain = MAX_IMAGES - images.length;
        if (remain <= 0) {
            notify('最多上传 ' + MAX_IMAGES + ' 张图片', 'warning');
            e.target.value = '';
            return;
        }
        var list = Array.prototype.slice.call(files, 0, remain);
        var chain = Promise.resolve();
        list.forEach(function (file) {
            chain = chain.then(function () {
                return compressToJpegBlob(file).then(function (blob) {
                    images.push({
                        blob: blob,
                        preview: URL.createObjectURL(blob)
                    });
                });
            });
        });
        chain.then(function () {
            renderGrid();
            e.target.value = '';
        }).catch(function (err) {
            notify(err.message || '图片处理失败', 'error');
            e.target.value = '';
        });
    }

    async function parseApi(res) {
        var data = null;
        try {
            data = await res.json();
        } catch (eJson) {
            data = null;
        }
        if (res.status === 401) {
            throw new Error((data && data.message) || '登录已过期，请重新登录');
        }
        if (!res.ok) {
            throw new Error((data && data.message) || ('请求失败 (' + res.status + ')'));
        }
        if (data && data.success === false) {
            throw new Error(data.message || '操作失败');
        }
        return data;
    }

    function open() {
        ensureModal();
        images.forEach(function (it) {
            if (it.preview) {
                try { URL.revokeObjectURL(it.preview); } catch (e2) { /* ignore */ }
            }
        });
        images = [];
        document.getElementById('tm-feedback-content').value = '';
        updateCount();
        renderGrid();
        modalEl.classList.add('tm-feedback-open');
        document.body.classList.add('overflow-hidden');
    }

    function hideModal() {
        if (!modalEl) {
            return;
        }
        modalEl.classList.remove('tm-feedback-open');
        document.body.classList.remove('overflow-hidden');
    }

    function close() {
        if (!modalEl) {
            return;
        }
        if (submitting) {
            return;
        }
        hideModal();
    }

    async function submit() {
        if (submitting) {
            return;
        }
        var content = (document.getElementById('tm-feedback-content').value || '').trim();
        if (!content && images.length === 0) {
            notify('请填写描述或至少上传一张图片', 'warning');
            return;
        }
        if (content.length > MAX_CONTENT) {
            notify('描述不能超过 ' + MAX_CONTENT + ' 字', 'warning');
            return;
        }

        var btn = document.getElementById('tm-feedback-submit');
        submitting = true;
        btn.disabled = true;
        btn.textContent = '提交中…';

        try {
            var draftRes = await window.wrappedFetch('/api/v1/tenant/feedback/draft', {
                method: 'POST',
                body: JSON.stringify({
                    source: isMobileSource() ? 'MOBILE' : 'WEB',
                    clientMeta: {
                        tab: (location.hash || '').replace(/^#/, '') || 'dashboard',
                        ua: navigator.userAgent ? navigator.userAgent.slice(0, 200) : ''
                    }
                })
            });
            var draft = await parseApi(draftRes);
            if (!draft || draft.success === false || !draft.data) {
                throw new Error((draft && draft.message) || '创建反馈单失败');
            }
            var feedbackId = draft.data.feedbackId;
            var imageUrls = [];
            for (var i = 0; i < images.length; i++) {
                btn.textContent = '上传图片 ' + (i + 1) + '/' + images.length + '…';
                if (!window.TMOssUpload) {
                    throw new Error('OSS 上传模块未加载');
                }
                var url = await window.TMOssUpload.uploadFeedbackImage(feedbackId, images[i].blob, i);
                imageUrls.push(url);
            }

            btn.textContent = '保存中…';
            var submitRes = await window.wrappedFetch('/api/v1/tenant/feedback/' + encodeURIComponent(feedbackId) + '/submit', {
                method: 'POST',
                body: JSON.stringify({
                    content: content,
                    imageUrls: imageUrls,
                    source: isMobileSource() ? 'MOBILE' : 'WEB'
                })
            });
            var submitted = await parseApi(submitRes);
            if (!submitted || submitted.success === false) {
                throw new Error((submitted && submitted.message) || '提交失败');
            }

            notify('已提交，我们会尽快处理，感谢反馈！', 'success');
            hideModal();
            images.forEach(function (it) {
                if (it.preview) {
                    try { URL.revokeObjectURL(it.preview); } catch (e3) { /* ignore */ }
                }
            });
            images = [];
            document.getElementById('tm-feedback-content').value = '';
            updateCount();
            renderGrid();
        } catch (err) {
            notify(err.message || '提交失败，请稍后重试', 'error');
        } finally {
            submitting = false;
            btn.disabled = false;
            btn.textContent = '提交';
        }
    }

    window.TM_MerchantFeedback = {
        open: open,
        close: close
    };
})();
