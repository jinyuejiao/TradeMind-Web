/**
 * TM_PrintPreview — 打印预览弹窗 + PNG/PDF 导出
 */
(function (global) {
    'use strict';

    var state = {
        docType: null,
        docId: null,
        doc: null,
        busy: false
    };

    function notify(msg, type) {
        if (global.TM_UI && global.TM_UI.showNotification) global.TM_UI.showNotification(msg, type || 'info');
        else if (typeof global.showToast === 'function') global.showToast(msg);
    }

    function ensurePrintStyles() {
        if (document.getElementById('tm-print-css')) return;
        var existing = document.querySelector('link[href*="tm-print.css"]');
        if (existing) {
            existing.id = existing.id || 'tm-print-css';
            return;
        }
        var link = document.createElement('link');
        link.id = 'tm-print-css';
        link.rel = 'stylesheet';
        link.href = '/assets/css/tm-print.css?v=20260716print1';
        document.head.appendChild(link);
    }

    function ensureModal() {
        ensurePrintStyles();
        var existing = document.getElementById('tm-print-preview-modal');
        if (existing) {
            // 旧实例可能挂在业务弹窗内部 → 抬到 body，避免被遮挡/尺寸错乱
            if (existing.parentNode !== document.body) {
                document.body.appendChild(existing);
            }
            return;
        }
        var html = '<div id="tm-print-preview-modal" class="tm-print-preview-modal fixed inset-0 hidden" style="z-index:520" aria-modal="true" role="dialog">' +
            '<div class="tm-print-preview-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-sm" data-action="close"></div>' +
            '<div class="tm-print-preview-panel relative mx-auto flex flex-col bg-white shadow-2xl overflow-hidden">' +
            '<div class="tm-print-preview-header shrink-0 flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100">' +
            '<div class="min-w-0"><p class="text-[10px] font-black text-teal-600 uppercase tracking-widest">打印预览</p>' +
            '<h3 id="tm-print-preview-title" class="text-base font-black text-slate-800 truncate mt-0.5">单据预览</h3>' +
            '<p id="tm-print-preview-subtitle" class="text-[11px] text-slate-400 truncate mt-0.5"></p></div>' +
            '<button type="button" class="tm-print-preview-close w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0" data-action="close" aria-label="关闭">' +
            '<i class="ph ph-x text-lg"></i></button></div>' +
            '<div class="tm-print-preview-body flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-slate-50">' +
            '<div id="tm-print-preview-loading" class="hidden text-center text-slate-400 text-sm py-16"><i class="ph ph-circle-notch animate-spin text-2xl"></i><p class="mt-2">加载单据…</p></div>' +
            '<div id="tm-print-preview-box" class="tm-print-preview-box mx-auto max-w-[420px]"></div></div>' +
            '<div class="tm-print-preview-footer shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-4">' +
            '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">' +
            '<button type="button" class="tm-btn-secondary py-3 text-xs font-bold min-h-[44px]" data-action="close">取消</button>' +
            '<button type="button" class="tm-btn-secondary py-3 text-xs font-bold min-h-[44px]" data-action="png"><i class="ph ph-image"></i> 导出图片</button>' +
            '<button type="button" class="tm-btn-secondary py-3 text-xs font-bold min-h-[44px]" data-action="pdf"><i class="ph ph-file-pdf"></i> 导出 PDF</button>' +
            '<button type="button" class="tm-btn-primary py-3 text-xs font-black min-h-[44px]" data-action="print"><i class="ph ph-printer"></i> 确认打印</button>' +
            '</div></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);

        var modal = document.getElementById('tm-print-preview-modal');
        modal.addEventListener('click', function (ev) {
            var action = ev.target.closest('[data-action]');
            if (!action) return;
            var act = action.getAttribute('data-action');
            if (act === 'close') close();
            else if (act === 'png') exportPng();
            else if (act === 'pdf') exportPdf();
            else if (act === 'print') confirmPrint();
        });
    }

    function setBusy(on) {
        state.busy = !!on;
        document.querySelectorAll('#tm-print-preview-modal [data-action="png"], #tm-print-preview-modal [data-action="pdf"], #tm-print-preview-modal [data-action="print"]')
            .forEach(function (btn) { btn.disabled = on; });
    }

    function setLoading(on) {
        var loading = document.getElementById('tm-print-preview-loading');
        var box = document.getElementById('tm-print-preview-box');
        if (loading) loading.classList.toggle('hidden', !on);
        if (box) box.classList.toggle('hidden', on);
    }

    function captureEl() {
        return document.querySelector('#tm-print-preview-box .tm-print-receipt');
    }

    function fileBaseName() {
        var meta = state.doc && state.doc.meta ? state.doc.meta : {};
        var typeLabel = global.TM_Print && global.TM_Print.DOC_TYPE_LABEL
            ? (global.TM_Print.DOC_TYPE_LABEL[meta.docType] || meta.docType || '单据')
            : '单据';
        var no = meta.docNo || state.docId || 'doc';
        return 'TradeMind-' + typeLabel + '-' + String(no).replace(/[^\w\u4e00-\u9fa5-]+/g, '');
    }

    async function renderPreview(doc) {
        if (!global.TM_Print || typeof global.TM_Print.renderReceiptBody !== 'function') {
            throw new Error('打印渲染模块未就绪');
        }
        var box = document.getElementById('tm-print-preview-box');
        if (!box) return;
        box.innerHTML = global.TM_Print.renderReceiptBody(doc, { printTime: new Date().toLocaleString('zh-CN', { hour12: false }) });
        var meta = doc.meta || {};
        var titleEl = document.getElementById('tm-print-preview-title');
        var subEl = document.getElementById('tm-print-preview-subtitle');
        var typeLabel = global.TM_Print.DOC_TYPE_LABEL[meta.docType] || meta.docType || '单据';
        if (titleEl) titleEl.textContent = typeLabel + '预览';
        if (subEl) subEl.textContent = (meta.docNo ? ('单号 ' + meta.docNo) : '') +
            (doc.counterparty && doc.counterparty.name ? (' · ' + doc.counterparty.name) : '');
    }

    function openModal() {
        ensurePrintStyles();
        var modal = document.getElementById('tm-print-preview-modal');
        if (!modal) return;
        // 始终挂到 body 末尾，避免落在订单详情等 stacking context 内被盖住
        document.body.appendChild(modal);
        modal.style.setProperty('z-index', '520', 'important');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tm-print-preview-open');
        document.body.style.overflow = 'hidden';
        if (typeof global.TM_pushShellOverlay === 'function' && !modal.dataset.tmShellPushed) {
            global.TM_pushShellOverlay();
            modal.dataset.tmShellPushed = '1';
        }
    }

    function close() {
        var modal = document.getElementById('tm-print-preview-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            if (modal.dataset.tmShellPushed === '1' && typeof global.TM_popShellOverlay === 'function') {
                global.TM_popShellOverlay();
                delete modal.dataset.tmShellPushed;
            }
        }
        document.body.classList.remove('tm-print-preview-open');
        if (!(global.__TM_shellOverlayDepth > 0)) {
            document.body.style.overflow = '';
        }
        state.docType = null;
        state.docId = null;
        state.doc = null;
    }

    async function ensureJsPdf() {
        if (global.jspdf && global.jspdf.jsPDF) return true;
        if (global.__tmJsPdfLoading) {
            try { await global.__tmJsPdfLoading; } catch (e) { /* ignore */ }
            return !!(global.jspdf && global.jspdf.jsPDF);
        }
        global.__tmJsPdfLoading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
            s.async = true;
            s.onload = function () { resolve(true); };
            s.onerror = function () { reject(new Error('jspdf load failed')); };
            document.head.appendChild(s);
        });
        try {
            await global.__tmJsPdfLoading;
        } catch (e) {
            global.__tmJsPdfLoading = null;
            return false;
        }
        return !!(global.jspdf && global.jspdf.jsPDF);
    }

    async function exportPng() {
        var el = captureEl();
        if (!el || state.busy) return;
        if (typeof global.html2canvas !== 'function') {
            notify('图片导出组件未加载，请刷新页面后重试', 'error');
            return;
        }
        setBusy(true);
        try {
            var canvas = await global.html2canvas(el, {
                backgroundColor: '#ffffff',
                useCORS: true,
                scale: Math.min(3, global.devicePixelRatio ? global.devicePixelRatio * 2 : 2),
                logging: false
            });
            var name = fileBaseName() + '.png';
            // 原生 App 桥
            if (global.TM_Native && global.TM_Native.export && typeof global.TM_Native.export.saveFile === 'function') {
                var dataUrl = canvas.toDataURL('image/png');
                var blob = await (await fetch(dataUrl)).blob();
                await global.TM_Native.export.saveFile(blob, name, 'image/png');
                notify('已打开系统分享，请选择保存到相册', 'success');
                return;
            }
            // 手机 Web：长按预览 / 分享
            if (global.TM_saveImage && typeof global.TM_saveImage.saveCanvasToAlbum === 'function') {
                await global.TM_saveImage.saveCanvasToAlbum(canvas, name);
                return;
            }
            var link = document.createElement('a');
            link.download = name;
            link.href = canvas.toDataURL('image/png');
            link.click();
            notify('图片已导出', 'success');
        } catch (e) {
            notify(e.message || '导出图片失败', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function exportPdf() {
        var el = captureEl();
        if (!el || state.busy) return;
        if (typeof global.html2canvas !== 'function') {
            notify('导出组件未加载，请刷新页面后重试', 'error');
            return;
        }
        var okPdf = await ensureJsPdf();
        if (!okPdf) {
            notify('PDF 组件未加载，请检查网络后刷新重试', 'error');
            return;
        }
        setBusy(true);
        try {
            var canvas = await global.html2canvas(el, {
                backgroundColor: '#ffffff',
                useCORS: true,
                scale: Math.min(2.5, global.devicePixelRatio ? global.devicePixelRatio * 1.5 : 2),
                logging: false
            });
            var imgData = canvas.toDataURL('image/png');
            var pdfWidth = 80;
            var pdfHeight = Math.max(40, (canvas.height * pdfWidth) / canvas.width);
            var pdf = new global.jspdf.jsPDF({
                orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            var pdfName = fileBaseName() + '.pdf';
            if (global.TM_Native && global.TM_Native.export && typeof global.TM_Native.export.saveFile === 'function') {
                var pdfBlob = pdf.output('blob');
                await global.TM_Native.export.saveFile(pdfBlob, pdfName, 'application/pdf');
                notify('已打开系统分享，请选择保存位置', 'success');
                return;
            }
            // 手机优先分享 PDF
            var isMobile = false;
            try {
                isMobile = global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
            } catch (e2) { /* ignore */ }
            if (isMobile && global.navigator && global.navigator.share && global.navigator.canShare) {
                try {
                    var shareBlob = pdf.output('blob');
                    var file = new File([shareBlob], pdfName, { type: 'application/pdf' });
                    if (global.navigator.canShare({ files: [file] })) {
                        await global.navigator.share({ files: [file], title: pdfName });
                        notify('请在分享面板中选择保存', 'success');
                        return;
                    }
                } catch (shareErr) { /* fall through */ }
            }
            pdf.save(pdfName);
            notify('PDF 已导出', 'success');
        } catch (e) {
            notify(e.message || '导出 PDF 失败', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function confirmPrint() {
        if (!state.docType || !state.docId || state.busy) return;
        setBusy(true);
        try {
            await global.TM_Print.print({
                docType: state.docType,
                docId: state.docId,
                skipPreview: true,
                channel: state.channel
            });
            close();
        } finally {
            setBusy(false);
        }
    }

    global.TM_PrintPreview = {
        open: async function (opts) {
            opts = opts || {};
            if (!global.TM_PrintApi || !global.TM_PrintApi.getDocument) {
                notify('打印模块未加载，请刷新页面后重试', 'error');
                return { success: false };
            }
            var docType = global.TM_Print && global.TM_Print.normalizeDocType
                ? global.TM_Print.normalizeDocType(opts.docType)
                : opts.docType;
            var docId = String(opts.docId || '');
            if (!docType || !docId) {
                notify('缺少打印单据信息', 'error');
                return { success: false };
            }

            ensureModal();
            openModal();
            setLoading(true);
            state.docType = docType;
            state.docId = docId;
            state.channel = opts.channel;

            try {
                var docRes = await global.TM_PrintApi.getDocument(docType, docId);
                if (!docRes.success || !docRes.data) throw new Error(docRes.message || '加载打印数据失败');
                state.doc = docRes.data;
                await renderPreview(state.doc);
                setLoading(false);
                return { success: true, data: state.doc };
            } catch (e) {
                close();
                notify(e.message || '加载预览失败', 'error');
                return { success: false, message: e.message };
            }
        },
        close: close
    };
})(window);
