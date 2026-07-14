/**
 * 海报/图片保存工具：
 * - 手机端优先 Web Share（可「存储到相册」）
 * - PC 端优先 showSaveFilePicker（用户自选路径）
 * - 其余环境走 blob 下载；iOS 再提供长按保存预览
 */
(function (global) {
    'use strict';

    function isLikelyMobile() {
        try {
            if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
            return !!(navigator.maxTouchPoints > 1 && global.innerWidth < 900);
        } catch (e) {
            return false;
        }
    }

    function isIosLike() {
        try {
            var ua = navigator.userAgent || '';
            if (/iPhone|iPad|iPod/i.test(ua)) return true;
            // iPadOS 桌面 UA
            return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        } catch (e2) {
            return false;
        }
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            if (!canvas) {
                reject(new Error('canvas 为空'));
                return;
            }
            if (typeof canvas.toBlob === 'function') {
                canvas.toBlob(function (blob) {
                    if (blob) resolve(blob);
                    else reject(new Error('toBlob 失败'));
                }, type || 'image/png', quality);
                return;
            }
            try {
                var dataUrl = canvas.toDataURL(type || 'image/png');
                var parts = dataUrl.split(',');
                var mimeMatch = parts[0] && parts[0].match(/:(.*?);/);
                var mime = (mimeMatch && mimeMatch[1]) || 'image/png';
                var bin = atob(parts[1] || '');
                var len = bin.length;
                var bytes = new Uint8Array(len);
                for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
                resolve(new Blob([bytes], { type: mime }));
            } catch (err) {
                reject(err);
            }
        });
    }

    function triggerAnchorDownload(blob, fileName) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'image.png';
        a.rel = 'noopener';
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 2500);
    }

    async function saveWithFilePicker(blob, fileName) {
        if (typeof global.showSaveFilePicker !== 'function') return false;
        try {
            var handle = await global.showSaveFilePicker({
                suggestedName: fileName || 'image.png',
                types: [{
                    description: 'PNG 图片',
                    accept: { 'image/png': ['.png'] }
                }]
            });
            var writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') {
                var cancelErr = new Error('cancelled');
                cancelErr.code = 'CANCELLED';
                throw cancelErr;
            }
            return false;
        }
    }

    async function shareFile(blob, fileName) {
        if (!navigator.share || typeof navigator.canShare !== 'function') return false;
        var file = new File([blob], fileName || 'image.png', { type: blob.type || 'image/png' });
        var payload = { files: [file], title: '推荐海报' };
        try {
            if (!navigator.canShare(payload)) return false;
        } catch (eCan) {
            return false;
        }
        await navigator.share(payload);
        return true;
    }

    function showLongPressSaveFallback(blob) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(blob);
            var overlay = document.createElement('div');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:99999',
                'background:rgba(15,23,42,0.78)', 'backdrop-filter:blur(4px)',
                'display:flex', 'align-items:center', 'justify-content:center',
                'padding:1rem', 'box-sizing:border-box'
            ].join(';');

            var panel = document.createElement('div');
            panel.style.cssText = [
                'width:min(22rem,100%)', 'max-height:90vh', 'overflow:auto',
                'background:#fff', 'border-radius:1.25rem', 'padding:1rem',
                'box-shadow:0 20px 40px rgba(0,0,0,.25)', 'text-align:center'
            ].join(';');

            var tip = document.createElement('p');
            tip.textContent = '长按下方图片，选择「存储到相册」或「添加到照片」';
            tip.style.cssText = 'margin:0 0 0.75rem;font-size:12px;font-weight:700;color:#0f766e;line-height:1.5';

            var img = document.createElement('img');
            img.src = url;
            img.alt = '推荐海报';
            img.style.cssText = 'width:100%;height:auto;border-radius:0.85rem;display:block;-webkit-touch-callout:default;';

            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = [
                'margin-top:0.85rem', 'width:100%', 'min-height:44px', 'border:0',
                'border-radius:0.85rem', 'background:#0d9488', 'color:#fff',
                'font-size:13px', 'font-weight:800', 'cursor:pointer'
            ].join(';');

            function cleanup() {
                try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve('preview');
            }

            closeBtn.addEventListener('click', cleanup);
            overlay.addEventListener('click', function (ev) {
                if (ev.target === overlay) cleanup();
            });

            panel.appendChild(tip);
            panel.appendChild(img);
            panel.appendChild(closeBtn);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        });
    }

    /**
     * @returns {Promise<'saved'|'shared'|'download'|'preview'|'cancelled'>}
     */
    async function saveImageBlob(blob, options) {
        options = options || {};
        var fileName = options.fileName || ('TradeMind-' + Date.now() + '.png');

        if (!isLikelyMobile()) {
            try {
                if (await saveWithFilePicker(blob, fileName)) return 'saved';
            } catch (ePick) {
                if (ePick && ePick.code === 'CANCELLED') return 'cancelled';
            }
            triggerAnchorDownload(blob, fileName);
            return 'download';
        }

        try {
            if (await shareFile(blob, fileName)) return 'shared';
        } catch (eShare) {
            if (eShare && eShare.name === 'AbortError') return 'cancelled';
        }

        try {
            triggerAnchorDownload(blob, fileName);
        } catch (eDl) { /* ignore */ }

        if (isIosLike() || options.forcePreview) {
            await showLongPressSaveFallback(blob);
            return 'preview';
        }
        return 'download';
    }

    async function saveCanvasAsImage(canvas, options) {
        var blob = await canvasToBlob(canvas, 'image/png');
        return saveImageBlob(blob, options || {});
    }

    global.TM_canvasToBlob = canvasToBlob;
    global.TM_saveImageBlob = saveImageBlob;
    global.TM_saveCanvasAsImage = saveCanvasAsImage;
})(window);
