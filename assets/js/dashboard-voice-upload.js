/**
 * 语音文件上传：统一经服务端写入 OSS，避免浏览器 STS 直传 CORS。
 * 在 index-app 主壳尽早加载；并对旧版 dashboard 内联脚本的 OSS.put(voice-*) 做拦截。
 */
(function () {
    'use strict';

    var REV = '20260524';

    function tmVoiceBlobExtension(audioBlob) {
        var ext = 'webm';
        if (audioBlob && audioBlob.type) {
            if (audioBlob.type.indexOf('wav') !== -1) ext = 'wav';
            else if (audioBlob.type.indexOf('mpeg') !== -1 || audioBlob.type.indexOf('mp3') !== -1) ext = 'mp3';
            else if (audioBlob.type.indexOf('mp4') !== -1 || audioBlob.type.indexOf('aac') !== -1) ext = 'm4a';
        }
        return ext;
    }

    async function uploadVoiceBlobToStorage(audioBlob, signal) {
        if (!audioBlob || !audioBlob.size) {
            throw new Error('录音数据为空');
        }
        var ext = tmVoiceBlobExtension(audioBlob);
        console.log('[Voice] 经服务端上传 OSS, size=', audioBlob.size, 'ext=', ext, 'rev=', REV);
        var formData = new FormData();
        formData.append('file', audioBlob, 'voice-' + Date.now() + '.' + ext);
        var fetchFn = window.wrappedFetch || window.fetch;
        if (typeof fetchFn !== 'function') {
            throw new Error('网络请求不可用，请刷新页面');
        }
        var uploadResp = await fetchFn('/api/v1/ai/voice/upload', {
            method: 'POST',
            signal: signal,
            body: formData
        });
        var uploadData = null;
        if (typeof window.handleApiResponse === 'function') {
            uploadData = await window.handleApiResponse(uploadResp);
        } else {
            if (!uploadResp.ok) {
                throw new Error('语音上传失败，状态码: ' + uploadResp.status);
            }
            uploadData = await uploadResp.json();
            if (uploadData && uploadData.success === false) {
                throw new Error(uploadData.message || '语音上传失败');
            }
        }
        var urlFromServer = uploadData && uploadData.data && uploadData.data.url;
        if (!urlFromServer) {
            throw new Error('服务端未返回音频地址');
        }
        console.log('[Voice] 服务端上传完成:', urlFromServer);
        return urlFromServer;
    }

    window.__TM_DASHBOARD_VOICE_UPLOAD_REV = REV;
    window.__TM_uploadVoiceBlobToStorage = uploadVoiceBlobToStorage;

    function isVoiceObjectKey(name) {
        return typeof name === 'string' && /^voice-\d+\./i.test(name);
    }

    function wrapOssClient(client) {
        if (!client || client.__tmVoicePutPatched) {
            return client;
        }
        var nativePut = client.put.bind(client);
        client.put = async function (name, blob, options) {
            if (isVoiceObjectKey(name) && blob && typeof blob.size === 'number') {
                console.warn('[Voice] 已拦截浏览器 OSS 直传，改走服务端上传:', name);
                var url = await uploadVoiceBlobToStorage(blob, options && options.signal);
                return { url: url, name: name };
            }
            return nativePut(name, blob, options);
        };
        client.__tmVoicePutPatched = true;
        return client;
    }

    function wrapOssConstructor(NativeOSS) {
        if (!NativeOSS || NativeOSS.__tmVoiceCtorPatched) {
            return NativeOSS;
        }
        function PatchedOSS(opts) {
            return wrapOssClient(new NativeOSS(opts));
        }
        PatchedOSS.__tmVoiceCtorPatched = true;
        Object.keys(NativeOSS).forEach(function (key) {
            try {
                PatchedOSS[key] = NativeOSS[key];
            } catch (e) { /* ignore */ }
        });
        PatchedOSS.prototype = NativeOSS.prototype;
        return PatchedOSS;
    }

    function installOssInterceptor() {
        if (!window.OSS || window.OSS.__tmVoiceCtorPatched) {
            return;
        }
        window.OSS = wrapOssConstructor(window.OSS);
        console.log('[Voice] OSS 语音直传拦截已启用, rev=', REV);
    }

    var ossDescriptor = Object.getOwnPropertyDescriptor(window, 'OSS');
    if (!ossDescriptor || ossDescriptor.configurable) {
        var currentOss = window.OSS;
        Object.defineProperty(window, 'OSS', {
            configurable: true,
            enumerable: true,
            get: function () {
                return currentOss;
            },
            set: function (next) {
                currentOss = next ? wrapOssConstructor(next) : next;
            }
        });
        if (currentOss) {
            window.OSS = currentOss;
        }
    } else {
        installOssInterceptor();
    }

    var pollCount = 0;
    var pollTimer = setInterval(function () {
        pollCount++;
        installOssInterceptor();
        if (window.OSS && window.OSS.__tmVoiceCtorPatched) {
            clearInterval(pollTimer);
        }
        if (pollCount > 120) {
            clearInterval(pollTimer);
        }
    }, 500);
})();
