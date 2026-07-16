/**
 * 海报/图片保存：
 * - 微信 / 多数手机浏览器无法用 JS 直接写入系统相册
 * - 可靠路径：全屏预览 + 长按图片 →「保存到相册 / 存储图像」
 * - 可选：Web Share 分享面板（需用户再点「存储到照片」）
 * - 桌面：传统下载
 */
(function (global) {
    'use strict';

    function isMobile() {
        try {
            if (global.matchMedia && global.matchMedia('(max-width: 768px)').matches) return true;
        } catch (e) { /* ignore */ }
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
            global.navigator.userAgent || ''
        );
    }

    function isWeChat() {
        return /MicroMessenger/i.test(global.navigator.userAgent || '');
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(global.navigator.userAgent || '')
            || (global.navigator.platform === 'MacIntel' && global.navigator.maxTouchPoints > 1);
    }

    function isAndroid() {
        return /Android/i.test(global.navigator.userAgent || '');
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            if (!canvas || typeof canvas.toBlob !== 'function') {
                try {
                    var dataUrl = canvas.toDataURL(type || 'image/png');
                    resolve(dataUrlToBlob(dataUrl));
                } catch (err) {
                    reject(err);
                }
                return;
            }
            canvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error('toBlob failed'));
            }, type || 'image/png', quality);
        });
    }

    function dataUrlToBlob(dataUrl) {
        var parts = String(dataUrl).split(',');
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
        var bin = atob(parts[1] || '');
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    function triggerAnchorDownload(href, filename) {
        var link = document.createElement('a');
        link.download = filename || 'image.png';
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            try { document.body.removeChild(link); } catch (e) { /* ignore */ }
        }, 200);
    }

    function revokeLater(url, delayMs) {
        if (!url || String(url).indexOf('blob:') !== 0) return;
        setTimeout(function () {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, delayMs != null ? delayMs : 120000);
    }

    function albumTipText() {
        if (isWeChat()) {
            return '请长按下方图片，选择「保存到手机」或「存储图像」';
        }
        if (isIOS()) {
            return '请长按下方图片，选择「存储图像」保存到相册';
        }
        if (isAndroid()) {
            return '请长按下方图片，选择「下载图片」或「保存到相册」';
        }
        return '请长按下方图片，选择保存到相册';
    }

    /**
     * 全屏预览：引导长按保存到相册（手机端主路径）
     */
    function showLongPressPreview(objectUrl, filename, options) {
        options = options || {};
        var existing = document.getElementById('tm-save-image-preview');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'tm-save-image-preview';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:rgba(15,23,42,0.94)',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'padding:16px', 'box-sizing:border-box',
            'overflow:auto', '-webkit-overflow-scrolling:touch'
        ].join(';');

        var tip = document.createElement('p');
        tip.textContent = albumTipText();
        tip.style.cssText = [
            'color:#F8FAFC', 'font-size:15px', 'font-weight:800',
            'margin:0 0 8px', 'text-align:center', 'line-height:1.5',
            'max-width:20rem'
        ].join(';');

        var sub = document.createElement('p');
        sub.textContent = '网页无法直接写入系统相册，需长按图片确认保存';
        sub.style.cssText = 'color:#94A3B8;font-size:12px;margin:0 0 14px;text-align:center;max-width:20rem;line-height:1.4';

        var imgWrap = document.createElement('div');
        imgWrap.style.cssText = [
            'max-width:100%', 'max-height:62vh', 'overflow:auto',
            'border-radius:16px', 'background:#fff',
            'box-shadow:0 12px 40px rgba(0,0,0,0.35)',
            'padding:8px', 'box-sizing:border-box'
        ].join(';');

        var img = document.createElement('img');
        img.src = objectUrl;
        img.alt = filename || 'poster';
        // 必须允许 iOS/微信长按菜单；勿用 user-select:none 阻断存图
        img.style.cssText = [
            'display:block', 'max-width:100%', 'max-height:58vh',
            'width:auto', 'height:auto', 'margin:0 auto',
            'object-fit:contain',
            '-webkit-touch-callout:default',
            '-webkit-user-select:auto',
            'user-select:auto',
            'pointer-events:auto'
        ].join(';');
        img.setAttribute('draggable', 'false');

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px;width:100%;max-width:22rem';

        function makeBtn(label, primary) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.style.cssText = [
                'flex:1 1 7rem', 'min-height:44px', 'padding:0 16px',
                'border:0', 'border-radius:999px',
                primary
                    ? 'background:#14B8A6;color:#fff'
                    : 'background:rgba(255,255,255,0.12);color:#F8FAFC',
                'font-size:14px', 'font-weight:800', 'cursor:pointer'
            ].join(';');
            return btn;
        }

        var shareBtn = makeBtn('系统分享', false);
        var dlBtn = makeBtn('下载文件', false);
        var closeBtn = makeBtn('完成', true);

        function close() {
            overlay.remove();
            revokeLater(objectUrl, 3000);
        }

        shareBtn.addEventListener('click', function () {
            tryShareFile(objectUrl, filename).catch(function () { /* ignore */ });
        });

        dlBtn.addEventListener('click', function () {
            try {
                triggerAnchorDownload(objectUrl, filename);
            } catch (e) { /* ignore */ }
        });

        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // 微信内通常不需要分享/下载按钮，避免干扰长按
        if (!isWeChat() && global.navigator && typeof global.navigator.share === 'function') {
            actions.appendChild(shareBtn);
        }
        if (!isWeChat()) {
            actions.appendChild(dlBtn);
        }
        actions.appendChild(closeBtn);

        imgWrap.appendChild(img);
        overlay.appendChild(tip);
        overlay.appendChild(sub);
        overlay.appendChild(imgWrap);
        overlay.appendChild(actions);
        document.body.appendChild(overlay);
        return {
            mode: 'preview',
            message: albumTipText()
        };
    }

    async function tryShareFile(objectUrlOrBlob, filename) {
        var name = filename || ('TradeMind-' + Date.now() + '.png');
        var blob = objectUrlOrBlob;
        if (typeof objectUrlOrBlob === 'string') {
            var resp = await fetch(objectUrlOrBlob);
            blob = await resp.blob();
        }
        var file;
        try {
            file = new File([blob], name, { type: blob.type || 'image/png' });
        } catch (e) {
            throw e;
        }
        var shareData = { files: [file], title: '推荐海报', text: name };
        if (typeof global.navigator.canShare === 'function' && !global.navigator.canShare(shareData)) {
            throw new Error('canShare false');
        }
        await global.navigator.share(shareData);
        return { mode: 'share', message: '请在系统分享中选择「存储图像」或「保存到相册」' };
    }

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {string} [filename]
     * @returns {Promise<{mode:string, message:string}>}
     */
    async function saveCanvasToAlbum(canvas, filename) {
        var name = (filename || ('TradeMind-' + Date.now() + '.png')).replace(/[\\/:*?"<>|]+/g, '-');
        if (!/\.(png|jpe?g|webp)$/i.test(name)) {
            name += '.png';
        }
        var blob = await canvasToBlob(canvas, 'image/png');
        if (!blob || blob.size < 64) {
            throw new Error('海报生成失败，请重试');
        }
        var objectUrl = URL.createObjectURL(blob);

        // 微信：只能长按存图，不要走 share / download
        if (isMobile() && isWeChat()) {
            return showLongPressPreview(objectUrl, name);
        }

        // 手机：优先弹长按预览（真正进相册的可靠方式）
        // 同时尝试 Web Share；失败/取消不阻断预览
        if (isMobile()) {
            var file = null;
            try {
                file = new File([blob], name, { type: 'image/png' });
            } catch (e) {
                file = null;
            }

            var shareTried = false;
            if (file && global.navigator && typeof global.navigator.share === 'function') {
                var shareData = { files: [file], title: '推荐海报', text: name };
                var canShareFiles = true;
                try {
                    if (typeof global.navigator.canShare === 'function') {
                        canShareFiles = !!global.navigator.canShare(shareData);
                    }
                } catch (e) {
                    canShareFiles = false;
                }
                if (canShareFiles) {
                    shareTried = true;
                    try {
                        await global.navigator.share(shareData);
                        // 分享面板已打开；仍展示长按预览作为兜底（用户可能没点「存相册」）
                        showLongPressPreview(objectUrl, name);
                        return {
                            mode: 'share+preview',
                            message: '若未存入相册，请长按预览图选择「保存到相册」'
                        };
                    } catch (err) {
                        if (err && err.name === 'AbortError') {
                            // 用户取消分享 → 仍给长按预览
                            return showLongPressPreview(objectUrl, name);
                        }
                        // 分享失败 → 长按预览
                    }
                }
            }

            return showLongPressPreview(objectUrl, name, { shareTried: shareTried });
        }

        // 桌面：传统下载
        try {
            triggerAnchorDownload(objectUrl, name);
            revokeLater(objectUrl, 60000);
            return { mode: 'download', message: '海报已下载' };
        } catch (e) {
            triggerAnchorDownload(canvas.toDataURL('image/png'), name);
            revokeLater(objectUrl, 60000);
            return { mode: 'download', message: '海报已下载' };
        }
    }

    /**
     * 截取 #poster-capture-area 并保存
     */
    async function downloadPosterCapture(options) {
        options = options || {};
        var element = document.getElementById(options.captureId || 'poster-capture-area');
        if (!element) throw new Error('海报元素未找到');
        if (typeof global.html2canvas !== 'function') throw new Error('海报组件未加载，请刷新页面');

        // 确保二维码等跨域图已加载，避免空白海报
        var imgs = element.querySelectorAll('img');
        await Promise.all(Array.prototype.map.call(imgs, function (img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function (resolve) {
                var done = function () { resolve(); };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                setTimeout(done, 2500);
            });
        }));

        var canvas = await global.html2canvas(element, {
            backgroundColor: null,
            useCORS: true,
            allowTaint: false,
            scale: options.scale != null ? options.scale : 3,
            logging: false
        });
        var refCode = '';
        var codeEl = document.getElementById('poster-ref-code');
        if (codeEl && codeEl.textContent) refCode = String(codeEl.textContent).replace(/\s+/g, '');
        var filename = options.filename || ('TradeMind-Invite-' + (refCode || 'REF') + '.png');
        return saveCanvasToAlbum(canvas, filename);
    }

    global.TM_saveImage = {
        isMobile: isMobile,
        isWeChat: isWeChat,
        saveCanvasToAlbum: saveCanvasToAlbum,
        downloadPosterCapture: downloadPosterCapture,
        showLongPressPreview: showLongPressPreview
    };
    global.TM_saveCanvasToAlbum = saveCanvasToAlbum;
})(window);
