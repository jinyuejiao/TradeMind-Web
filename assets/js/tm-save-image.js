/**
 * 海报/图片保存：手机端优先唤起系统分享以存入相册；微信内提供长按存图预览。
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

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            if (!canvas || typeof canvas.toBlob !== 'function') {
                try {
                    var dataUrl = canvas.toDataURL(type || 'image/png');
                    var blob = dataUrlToBlob(dataUrl);
                    resolve(blob);
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
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            try { document.body.removeChild(link); } catch (e) { /* ignore */ }
        }, 200);
    }

    function revokeLater(url) {
        if (!url || String(url).indexOf('blob:') !== 0) return;
        setTimeout(function () {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 60000);
    }

    /**
     * 全屏预览：引导长按保存到相册（微信 / 分享失败时）
     */
    function showLongPressPreview(objectUrl, filename) {
        var existing = document.getElementById('tm-save-image-preview');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'tm-save-image-preview';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:rgba(15,23,42,0.92)',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'padding:16px', 'box-sizing:border-box'
        ].join(';');

        var tip = document.createElement('p');
        tip.textContent = isWeChat() || isIOS()
            ? '长按下方图片，选择「保存到相册」'
            : '长按或点按下方图片保存到相册';
        tip.style.cssText = 'color:#F8FAFC;font-size:14px;font-weight:700;margin:0 0 12px;text-align:center';

        var img = document.createElement('img');
        img.src = objectUrl;
        img.alt = filename || 'poster';
        img.style.cssText = [
            'max-width:100%', 'max-height:70vh', 'object-fit:contain',
            'border-radius:16px', 'background:#fff',
            'webkit-touch-callout:default', 'user-select:none'
        ].join(';');
        img.setAttribute('draggable', 'false');

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = [
            'margin-top:16px', 'min-height:44px', 'padding:0 28px',
            'border:0', 'border-radius:999px',
            'background:#14B8A6', 'color:#fff',
            'font-size:14px', 'font-weight:800', 'cursor:pointer'
        ].join(';');

        function close() {
            overlay.remove();
            revokeLater(objectUrl);
        }
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        overlay.appendChild(tip);
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
        return { mode: 'preview', message: tip.textContent };
    }

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {string} [filename]
     * @returns {Promise<{mode:string, message:string}>}
     */
    async function saveCanvasToAlbum(canvas, filename) {
        var name = (filename || ('TradeMind-' + Date.now() + '.png')).replace(/[\\/:*?"<>|]+/g, '-');
        var blob = await canvasToBlob(canvas, 'image/png');
        var file = null;
        try {
            file = new File([blob], name, { type: 'image/png' });
        } catch (e) {
            file = null;
        }

        var objectUrl = URL.createObjectURL(blob);

        // 1) 手机：系统分享面板（iOS/Android 可选「存储到照片/相册」）
        if (isMobile() && file && global.navigator && typeof global.navigator.share === 'function') {
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
                try {
                    await global.navigator.share(shareData);
                    revokeLater(objectUrl);
                    return { mode: 'share', message: '请在系统分享中选择「存储图像」或「保存到相册」' };
                } catch (err) {
                    if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                        revokeLater(objectUrl);
                        return { mode: 'cancelled', message: '已取消保存' };
                    }
                    // 继续降级
                }
            }
        }

        // 2) 微信 / 分享不可用：全屏图，长按存相册
        if (isMobile() && (isWeChat() || !(global.navigator && global.navigator.share))) {
            return showLongPressPreview(objectUrl, name);
        }

        // 3) 桌面或其它：传统下载
        try {
            triggerAnchorDownload(objectUrl, name);
            revokeLater(objectUrl);
            return { mode: 'download', message: '海报已下载' };
        } catch (e) {
            triggerAnchorDownload(canvas.toDataURL('image/png'), name);
            revokeLater(objectUrl);
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
        var canvas = await global.html2canvas(element, {
            backgroundColor: null,
            useCORS: true,
            scale: options.scale != null ? options.scale : 3,
            borderRadius: 40
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
        downloadPosterCapture: downloadPosterCapture
    };
    global.TM_saveCanvasToAlbum = saveCanvasToAlbum;
})(window);
