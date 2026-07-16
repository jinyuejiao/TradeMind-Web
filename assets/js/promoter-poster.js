/**
 * 推广员门户 — 专属推荐海报（复用 modules/fragments/poster-modal.html）
 * 保存：手机端走系统分享/长按存相册（tm-save-image.js）
 */
(function (global) {
    'use strict';

    var FRAGMENT_URL = './modules/fragments/poster-modal.html';
    var _htmlCache = null;

    function notify(msg) {
        if (typeof global.ppToast === 'function') {
            global.ppToast(msg);
            return;
        }
        alert(msg);
    }

    function buildLandingUrl(referralCode, merchantType) {
        var base = global.location.origin + '/register.html';
        var p = new URLSearchParams();
        if (referralCode) p.set('ref', String(referralCode).trim());
        if (merchantType) p.set('merchantType', String(merchantType).trim().toUpperCase());
        var q = p.toString();
        return q ? base + '?' + q : base;
    }

    function qrHostLabel() {
        try {
            return global.location.host || 'trademind.com.cn';
        } catch (e) {
            return 'trademind.com.cn';
        }
    }

    async function mountPosterModal() {
        var existing = document.getElementById('poster-modal');
        if (existing && existing.querySelector('.poster-card-inner')) return;
        if (existing) existing.remove();
        if (!_htmlCache) {
            var res = await fetch(FRAGMENT_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('海报模板加载失败');
            _htmlCache = await res.text();
        }
        document.body.insertAdjacentHTML('beforeend', _htmlCache);
        var modal = document.getElementById('poster-modal');
        if (modal && !modal.dataset.ppBound) {
            modal.dataset.ppBound = '1';
            var backdrop = modal.querySelector('.absolute.inset-0');
            if (backdrop) {
                backdrop.addEventListener('click', closePoster);
            }
            var closeBtn = modal.querySelector('button[onclick*="closePoster"]');
            if (closeBtn) {
                closeBtn.removeAttribute('onclick');
                closeBtn.addEventListener('click', closePoster);
            }
            var saveBtn = modal.querySelector('.poster-modal-action-footer button');
            if (saveBtn) {
                saveBtn.removeAttribute('onclick');
                saveBtn.addEventListener('click', downloadPoster);
            }
        }
    }

    function applyReferralData(referralCode, merchantType, benefitHint) {
        var code = String(referralCode || '').trim();
        if (!code) return false;
        var mt = merchantType || 'WHOLESALE';
        var landing = buildLandingUrl(code, mt);
        global._ppCachedReferralCode = code;
        global._ppPosterLandingUrl = landing;

        var codeEl = document.getElementById('poster-ref-code');
        if (codeEl) codeEl.textContent = code;

        var qr = document.getElementById('poster-qr');
        if (qr) {
            qr.crossOrigin = 'anonymous';
            qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(landing);
        }
        var hint = document.getElementById('poster-qr-url-hint');
        if (hint) hint.textContent = qrHostLabel();

        var benefitEl = document.getElementById('poster-ref-benefit-text');
        if (benefitEl) {
            benefitEl.textContent = benefitHint || '好友注册时在「推荐码」栏填写本码，额外赠送 30 天试用期。';
        }
        return true;
    }

    async function showPoster(referralCode, merchantType, benefitHint) {
        try {
            var code = referralCode || global._ppCachedReferralCode || '';
            if (!code) {
                notify('无法获取推荐码，请先登录');
                return;
            }
            await mountPosterModal();
            applyReferralData(code, merchantType || 'WHOLESALE', benefitHint);
            var modal = document.getElementById('poster-modal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (err) {
            console.error('showPoster:', err);
            notify('打开海报失败，请稍后重试');
        }
    }

    function closePoster() {
        var modal = document.getElementById('poster-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    async function downloadPoster(ev) {
        var saveBtn = (ev && ev.currentTarget)
            || document.querySelector('#poster-modal .poster-modal-action-footer button');
        var originalHtml = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="ph ph-circle-notch"></i> 生成中…';
            saveBtn.disabled = true;
        }
        try {
            var result;
            if (global.TM_saveImage && typeof global.TM_saveImage.downloadPosterCapture === 'function') {
                result = await global.TM_saveImage.downloadPosterCapture({ scale: 3 });
            } else {
                var element = document.getElementById('poster-capture-area');
                if (!element) throw new Error('海报元素未找到');
                if (typeof global.html2canvas !== 'function') throw new Error('海报组件未加载，请刷新页面');
                var canvas = await global.html2canvas(element, {
                    backgroundColor: null,
                    useCORS: true,
                    scale: 3,
                    borderRadius: 40
                });
                var refCode = (document.getElementById('poster-ref-code') && document.getElementById('poster-ref-code').textContent || 'REF').replace(/\s+/g, '');
                var filename = 'TradeMind-Invite-' + refCode + '.png';
                if (typeof global.TM_saveCanvasToAlbum === 'function') {
                    result = await global.TM_saveCanvasToAlbum(canvas, filename);
                } else {
                    var link = document.createElement('a');
                    link.download = filename;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    result = { mode: 'download', message: '海报已保存' };
                }
            }
            if (result && result.mode !== 'cancelled' && result.message) {
                notify(result.message);
            }
        } catch (err) {
            console.error('downloadPoster:', err);
            notify((err && err.message) || '海报保存失败，请重试');
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }
        }
    }

    global.showPoster = showPoster;
    global.closePoster = closePoster;
    global.downloadPoster = downloadPoster;
    global.ppApplyPosterReferral = applyReferralData;
})(window);
