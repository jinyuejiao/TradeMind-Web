/* ========================================================
 * TradeMind - 原生能力桥接层（Web / App 统一入口）
 * ========================================================
 * 业务只调用 window.TM_Native.*
 * App：依赖 assets/js/vendor/tm-capacitor.js → window.TMCapacitor
 * Web：浏览器能力降级
 * ======================================================== */
(function (global) {
    'use strict';

    function tc() {
        return global.TMCapacitor || null;
    }

    function detectNative() {
        try {
            var C = (tc() && tc().Capacitor) || global.Capacitor;
            return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
        } catch (e) {
            return false;
        }
    }

    function platform() {
        if (!detectNative()) return 'web';
        try {
            var C = (tc() && tc().Capacitor) || global.Capacitor;
            return (C.getPlatform && C.getPlatform()) || 'native';
        } catch (e) {
            return 'native';
        }
    }

    function unsupported(feature) {
        return Promise.reject(new Error('[TM_Native] 当前环境不支持: ' + feature));
    }

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () {
                var result = String(reader.result || '');
                var idx = result.indexOf(',');
                resolve(idx >= 0 ? result.slice(idx + 1) : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function webPathToBlob(webPath) {
        var resp = await fetch(webPath);
        return resp.blob();
    }

    // -------------------- Camera --------------------
    var camera = {
        /**
         * @param {{quality?:number, source?:'CAMERA'|'PHOTOS'}} options
         * @returns {Promise<{webPath:string, format:string, blob?:Blob, file?:File}>}
         */
        takePhoto: async function (options) {
            options = options || {};
            var pack = tc();
            if (detectNative() && pack && pack.Camera && pack.Camera.getPhoto) {
                var source = options.source === 'PHOTOS'
                    ? (pack.CameraSource && pack.CameraSource.Photos) || 'PHOTOS'
                    : (pack.CameraSource && pack.CameraSource.Camera) || 'CAMERA';
                var photo = await pack.Camera.getPhoto({
                    quality: options.quality || 85,
                    resultType: (pack.CameraResultType && pack.CameraResultType.Uri) || 'uri',
                    source: source,
                    correctOrientation: true
                });
                var webPath = photo.webPath || photo.path;
                var blob = null;
                var file = null;
                try {
                    blob = await webPathToBlob(webPath);
                    file = new File([blob], 'capture.' + (photo.format || 'jpeg'), {
                        type: blob.type || ('image/' + (photo.format || 'jpeg'))
                    });
                } catch (e) { /* keep path only */ }
                return {
                    webPath: webPath,
                    format: photo.format || 'jpeg',
                    blob: blob,
                    file: file,
                    raw: photo
                };
            }

            return new Promise(function (resolve, reject) {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                if (options.source !== 'PHOTOS') {
                    input.setAttribute('capture', 'environment');
                }
                input.onchange = function () {
                    var f = input.files && input.files[0];
                    if (!f) {
                        reject(new Error('未选择图片'));
                        return;
                    }
                    resolve({
                        webPath: URL.createObjectURL(f),
                        format: 'jpeg',
                        blob: f,
                        file: f
                    });
                };
                input.click();
            });
        },
        scan: async function () {
            if (global.TM_ScanRouter && typeof global.TM_ScanRouter.open === 'function') {
                return global.TM_ScanRouter.open();
            }
            if (global.TM_ScanCamera && typeof global.TM_ScanCamera.open === 'function') {
                return global.TM_ScanCamera.open();
            }
            return unsupported('scan');
        }
    };

    // -------------------- Push --------------------
    var push = {
        register: async function () {
            var pack = tc();
            if (!detectNative() || !pack || !pack.PushNotifications) {
                return { registered: false, reason: 'web' };
            }
            var PushNotifications = pack.PushNotifications;
            var perm = await PushNotifications.requestPermissions();
            if (perm.receive !== 'granted') {
                return { registered: false, reason: 'denied' };
            }
            await PushNotifications.register();
            return { registered: true };
        },
        onNotification: function (handler) {
            if (typeof handler !== 'function') return function () {};
            var pack = tc();
            if (!detectNative() || !pack || !pack.PushNotifications) return function () {};
            var PushNotifications = pack.PushNotifications;
            PushNotifications.addListener('registration', function (token) {
                handler({ type: 'registration', token: token });
            });
            PushNotifications.addListener('pushNotificationReceived', function (notification) {
                handler({ type: 'received', notification: notification });
            });
            PushNotifications.addListener('pushNotificationActionPerformed', function (action) {
                handler({ type: 'action', action: action });
            });
            return function () {};
        }
    };

    // -------------------- Files --------------------
    var files = {
        pick: async function (options) {
            options = options || {};
            return new Promise(function (resolve, reject) {
                var input = document.createElement('input');
                input.type = 'file';
                if (options.accept) input.accept = options.accept;
                if (options.multiple) input.multiple = true;
                input.onchange = function () {
                    var list = input.files ? Array.prototype.slice.call(input.files) : [];
                    if (!list.length) {
                        reject(new Error('未选择文件'));
                        return;
                    }
                    resolve(options.multiple ? list : list[0]);
                };
                input.click();
            });
        },
        download: async function (url, fileName) {
            var a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'download';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return { ok: true };
        }
    };

    // -------------------- Export --------------------
    var exportApi = {
        saveFile: async function (blobOrBase64, fileName, mimeType) {
            fileName = fileName || ('export-' + Date.now());
            var pack = tc();
            var blob = blobOrBase64;
            if (typeof blobOrBase64 === 'string') {
                var raw = blobOrBase64.replace(/^data:[^;]+;base64,/, '');
                var bin = atob(raw);
                var arr = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                blob = new Blob([arr], { type: mimeType || 'application/octet-stream' });
            }

            if (detectNative() && pack && pack.Filesystem && pack.Filesystem.writeFile) {
                var base64 = await blobToBase64(blob);
                var written = await pack.Filesystem.writeFile({
                    path: fileName,
                    data: base64,
                    directory: (pack.Directory && pack.Directory.Cache) || 'CACHE',
                    recursive: true
                });
                if (pack.Share && pack.Share.share && written && written.uri) {
                    await pack.Share.share({ title: fileName, url: written.uri });
                }
                return { ok: true, uri: written && written.uri, mode: 'native' };
            }

            var url = URL.createObjectURL(blob);
            await files.download(url, fileName);
            setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
            return { ok: true, mode: 'web-download' };
        }
    };

    // -------------------- Share --------------------
    var share = {
        system: async function (payload) {
            payload = payload || {};
            var pack = tc();
            if (detectNative() && pack && pack.Share && pack.Share.share) {
                return pack.Share.share({
                    title: payload.title || 'TradeMind',
                    text: payload.text || '',
                    url: payload.url || undefined,
                    dialogTitle: payload.dialogTitle || '分享'
                });
            }
            if (navigator.share) {
                return navigator.share({
                    title: payload.title || 'TradeMind',
                    text: payload.text || '',
                    url: payload.url
                });
            }
            if (payload.url && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(payload.url);
                return { ok: true, fallback: 'clipboard' };
            }
            return unsupported('share');
        },
        wechat: async function (payload) {
            console.info('[TM_Native.share.wechat] 微信 SDK 未接入，降级系统分享');
            return share.system(payload || {});
        }
    };

    // -------------------- Location --------------------
    var locationApi = {
        getCurrent: async function (options) {
            options = options || {};
            var pack = tc();
            if (detectNative() && pack && pack.Geolocation && pack.Geolocation.getCurrentPosition) {
                return pack.Geolocation.getCurrentPosition({
                    enableHighAccuracy: !!options.enableHighAccuracy,
                    timeout: options.timeout || 15000
                });
            }
            return new Promise(function (resolve, reject) {
                if (!navigator.geolocation) {
                    reject(new Error('定位不可用'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: !!options.enableHighAccuracy,
                    timeout: options.timeout || 15000,
                    maximumAge: options.maximumAge || 0
                });
            });
        }
    };

    // -------------------- App --------------------
    var app = {
        exit: async function () {
            var pack = tc();
            if (pack && pack.App && pack.App.exitApp) {
                return pack.App.exitApp();
            }
            return undefined;
        },
        onBackButton: function (handler) {
            if (typeof handler !== 'function') return function () {};
            var pack = tc();
            if (pack && pack.App && pack.App.addListener) {
                pack.App.addListener('backButton', handler);
            }
            return function () {};
        }
    };

    global.TM_Native = {
        isNative: detectNative,
        getPlatform: platform,
        camera: camera,
        push: push,
        files: files,
        export: exportApi,
        share: share,
        location: locationApi,
        app: app,
        capabilities: function () {
            return {
                native: detectNative(),
                platform: platform(),
                push: true,
                camera: true,
                files: true,
                export: true,
                wechatShare: detectNative(),
                location: true,
                capacitorBundle: !!tc()
            };
        }
    };

    try {
        if (detectNative()) {
            document.documentElement.setAttribute('data-tm-runtime', 'capacitor');
            document.documentElement.setAttribute('data-tm-platform', platform());
        } else {
            document.documentElement.setAttribute('data-tm-runtime', 'web');
        }
    } catch (e) { /* ignore */ }

    console.info('[TM_Native] ready, platform =', platform(), 'bundle =', !!tc());
})(typeof window !== 'undefined' ? window : this);
