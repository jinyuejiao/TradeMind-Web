/**
 * TradeMind — AI 设备调用兼容层（HarmonyOS / iOS / 折叠屏）
 * 标准 HTML5 MediaDevices + Canvas 压缩，无平台专用分支。
 */
(function () {
    'use strict';

    var REV = '20260603jpeg';
    var IMAGE_MAX_BYTES = 2 * 1024 * 1024;
    var IMAGE_QUALITY = 0.8;
    var ORDER_IMAGE_MAX_SIDE = 1920;
    var ORDER_IMAGE_FAST_SKIP_BYTES = 600 * 1024;
    var DEVICE_WAIT_TEXT = '正在等待设备响应...';

    function checkMediaSupport(kind) {
        kind = kind || 'audio';
        var result = {
            supported: false,
            reason: '',
            secureContext: true,
            kind: kind
        };

        if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            result.secureContext = false;
            result.reason = 'HTTPS_REQUIRED';
            return result;
        }

        var md = navigator.mediaDevices;
        if (!md || typeof md.getUserMedia !== 'function') {
            result.reason = 'NO_MEDIADEVICES';
            return result;
        }

        if ((kind === 'audio' || kind === 'both') && typeof MediaRecorder === 'undefined') {
            result.reason = 'NO_MEDIARECORDER';
            return result;
        }

        result.supported = true;
        return result;
    }

    function isPermissionDeniedError(err) {
        if (!err) return false;
        var name = String(err.name || '');
        return name === 'NotAllowedError' ||
            name === 'PermissionDeniedError' ||
            name === 'SecurityError';
    }

    function isWeChatInApp() {
        return /MicroMessenger/i.test(navigator.userAgent || '');
    }

    function showPermissionAlert(deviceType) {
        var msg = deviceType === 'camera'
            ? '请在系统设置中允许浏览器访问摄像头，以使用 AI 拍照功能'
            : '请在系统设置中允许浏览器访问麦克风，以使用 AI 录音功能';

        if (window.TmConfirm && typeof window.TmConfirm.openError === 'function') {
            window.TmConfirm.openError(msg, {
                title: '权限未开启',
                confirmLabel: '我知道了'
            });
            return;
        }
        if (window.TM_UI && typeof window.TM_UI.openError === 'function') {
            window.TM_UI.openError(msg, {
                title: '权限未开启',
                confirmLabel: '我知道了'
            });
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
            return;
        }
        console.warn('[TM_AIService]', msg);
    }

    function resolveWaitElement(opts) {
        opts = opts || {};
        if (opts.el) return opts.el;
        if (opts.id) return document.getElementById(opts.id);
        return null;
    }

    function showDeviceWaiting(opts) {
        opts = opts || {};
        var el = resolveWaitElement(opts);
        if (el) {
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
            var textEl = el.querySelector('[data-tm-device-wait-text]');
            if (textEl) {
                textEl.textContent = opts.text || DEVICE_WAIT_TEXT;
            }
        }
        if (typeof opts.onShow === 'function') {
            opts.onShow();
        }
    }

    function hideDeviceWaiting(opts) {
        opts = opts || {};
        var el = resolveWaitElement(opts);
        if (el) {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
        }
        if (typeof opts.onHide === 'function') {
            opts.onHide();
        }
    }

    function stopMediaStream(stream) {
        if (!stream || typeof stream.getTracks !== 'function') {
            return;
        }
        stream.getTracks().forEach(function (track) {
            try {
                track.stop();
            } catch (e) { /* ignore */ }
        });
    }

    function notifyUnsupported(kind) {
        if (isWeChatInApp()) {
            var wechatMsg = kind === 'video'
                ? '当前微信内浏览器可能不支持摄像头，请使用系统浏览器打开本页'
                : '当前微信内浏览器可能不支持录音，请使用系统浏览器打开本页';
            if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
                window.TM_UI.showNotification(wechatMsg, 'error');
            } else if (typeof window.showToast === 'function') {
                window.showToast(wechatMsg);
            }
            return;
        }
        var msg = kind === 'video'
            ? '当前浏览器不支持摄像头，请使用 Chrome / Safari 最新版'
            : '当前浏览器不支持录音，请使用 Chrome / Safari 最新版';
        if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, 'error');
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg);
        }
    }

    async function requestUserMedia(constraints, waitOpts) {
        constraints = constraints || { audio: true };
        var kind = constraints.video ? (constraints.audio ? 'both' : 'video') : 'audio';
        var support = checkMediaSupport(kind);
        if (!support.supported) {
            if (support.reason === 'HTTPS_REQUIRED') {
                var secureMsg = kind === 'video'
                    ? '浏览器安全策略限制：摄像头功能仅在 HTTPS 或 localhost 下可用'
                    : '浏览器安全策略限制：录音功能仅在 HTTPS 或 localhost 下可用';
                if (typeof window.showToast === 'function') {
                    window.showToast(secureMsg);
                }
                throw new Error(support.reason);
            }
            notifyUnsupported(kind === 'both' ? 'audio' : kind);
            throw new Error(support.reason || 'UNSUPPORTED');
        }

        showDeviceWaiting(waitOpts);
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            if (isPermissionDeniedError(err)) {
                showPermissionAlert(constraints.video ? 'camera' : 'microphone');
            }
            throw err;
        } finally {
            hideDeviceWaiting(waitOpts);
        }
    }

    function loadImageFromBlob(blob) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('图片加载失败'));
            };
            img.src = url;
        });
    }

    function canvasToBlob(canvas, quality) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (result) {
                resolve(result);
            }, 'image/jpeg', quality);
        });
    }

    async function compressImageIfNeeded(input, opts) {
        opts = opts || {};
        var maxBytes = opts.maxBytes || IMAGE_MAX_BYTES;
        var quality = opts.quality != null ? opts.quality : IMAGE_QUALITY;
        var blob = input instanceof Blob ? input : null;

        if (!blob) {
            return input;
        }
        var mime = (blob.type || '').toLowerCase();
        var isHeic = mime.indexOf('heic') >= 0 || mime.indexOf('heif') >= 0;
        var forceJpeg = isHeic || !mime || mime === 'application/octet-stream';

        var img;
        try {
            img = await loadImageFromBlob(blob);
        } catch (loadErr) {
            if (forceJpeg) {
                console.warn('[TM_AIService] HEIC/未知格式解码失败，原样上传', loadErr);
            } else {
                console.warn('[TM_AIService] 图片解码失败，原样上传', loadErr);
            }
            return blob;
        }

        if (forceJpeg || blob.size > maxBytes) {
            /* fall through to canvas JPEG */
        } else if (blob.size <= maxBytes) {
            return blob;
        }
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
            return blob;
        }

        var scale = Math.sqrt(maxBytes / blob.size);
        scale = Math.min(1, Math.max(0.25, scale));

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var compressed = blob;
        var attempts = 0;

        while (attempts < 6) {
            var nw = Math.max(1, Math.round(w * scale));
            var nh = Math.max(1, Math.round(h * scale));
            canvas.width = nw;
            canvas.height = nh;
            ctx.drawImage(img, 0, 0, nw, nh);
            var next = await canvasToBlob(canvas, quality);
            if (!next) {
                console.warn('[TM_AIService] canvas.toBlob 不可用，原样上传');
                return blob;
            }
            compressed = next;
            if (compressed.size <= maxBytes) {
                break;
            }
            scale *= 0.85;
            attempts++;
        }

        console.log('[TM_AIService] 图片压缩', blob.size, '->', compressed.size, 'rev=', REV);
        return compressed;
    }

    /**
     * 订单识图上传：与问题反馈 compressToJpegBlob 对齐，长边 1920 + JPEG，避免 iOS 原图 > Nginx 1m。
     */
    function compressForOrderUpload(input) {
        return new Promise(function (resolve, reject) {
            var blob = input instanceof Blob ? input : null;
            if (!blob) {
                reject(new Error('无效的图片数据'));
                return;
            }
            var mime = (blob.type || '').toLowerCase();
            if (mime === 'image/jpeg' && blob.size > 0 && blob.size <= ORDER_IMAGE_FAST_SKIP_BYTES) {
                resolve(blob);
                return;
            }
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                if (!w || !h) {
                    reject(new Error('图片尺寸无效'));
                    return;
                }
                var maxSide = ORDER_IMAGE_MAX_SIDE;
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
                canvas.toBlob(function (out) {
                    if (!out) {
                        reject(new Error('图片压缩失败'));
                        return;
                    }
                    console.log('[TM_AIService] 订单识图 JPEG', blob.size, '->', out.size, 'rev=', REV);
                    resolve(out);
                }, 'image/jpeg', IMAGE_QUALITY);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('图片读取失败，请换一张或重新拍摄'));
            };
            img.src = url;
        });
    }

    window.TM_AIService = {
        REV: REV,
        DEVICE_WAIT_TEXT: DEVICE_WAIT_TEXT,
        IMAGE_MAX_BYTES: IMAGE_MAX_BYTES,
        IMAGE_QUALITY: IMAGE_QUALITY,
        checkMediaSupport: checkMediaSupport,
        isPermissionDeniedError: isPermissionDeniedError,
        showPermissionAlert: showPermissionAlert,
        showDeviceWaiting: showDeviceWaiting,
        hideDeviceWaiting: hideDeviceWaiting,
        requestUserMedia: requestUserMedia,
        stopMediaStream: stopMediaStream,
        compressImageIfNeeded: compressImageIfNeeded,
        compressForOrderUpload: compressForOrderUpload
    };
})();
