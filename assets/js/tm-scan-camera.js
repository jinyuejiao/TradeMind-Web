/**
 * TM_ScanCamera — 相机条码扫描（html5-qrcode），解码后走轻量 /scan/decode
 */
(function (global) {
    'use strict';

    var overlayEl = null;
    var html5QrCode = null;
    var cameraRunning = false;
    var state = null;

    function notify(msg, type) {
        if (global.TM_UI && global.TM_UI.showNotification) global.TM_UI.showNotification(msg, type || 'info');
    }

    function loadHtml5Qrcode() {
        if (global.Html5Qrcode) return Promise.resolve(global.Html5Qrcode);
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.onload = function () { resolve(global.Html5Qrcode); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function ensureOverlay() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.id = 'tm-scan-camera-overlay';
        overlayEl.className = 'hidden fixed inset-0 z-[9998] bg-black/50 flex items-end md:items-center justify-center p-4';
        overlayEl.innerHTML =
            '<div class="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">' +
            '<header class="px-4 py-3 border-b flex justify-between items-center">' +
            '<span class="font-bold text-slate-800">相机扫码</span>' +
            '<button type="button" id="tm-scan-camera-close" class="p-2 hover:bg-slate-100 rounded-full"><i class="ph ph-x"></i></button></header>' +
            '<div id="tm-scan-camera-host" class="bg-black min-h-[240px]"></div>' +
            '<p class="text-[10px] text-slate-400 px-4 py-2 text-center">对准条码/二维码，识别后自动关闭</p></div>';
        document.body.appendChild(overlayEl);
        overlayEl.querySelector('#tm-scan-camera-close').addEventListener('click', close);
    }

    function stopCamera() {
        if (!html5QrCode || !cameraRunning) return Promise.resolve();
        return html5QrCode.stop().then(function () {
            cameraRunning = false;
        }).catch(function () {
            cameraRunning = false;
        });
    }

    async function onDecoded(text) {
        if (!text || !state) return;
        await stopCamera();
        close();
        var code = String(text).trim();
        if (!code) return;
        var decodeResult = null;
        if (global.TM_PrintApi && global.TM_PrintApi.scanDecode) {
            try {
                var res = await global.TM_PrintApi.scanDecode({
                    decodedText: code,
                    context: state.context || 'GENERAL'
                });
                if (res.success) decodeResult = res.data;
            } catch (e) { /* ignore */ }
        }
        if (typeof state.onScan === 'function') {
            state.onScan(code, decodeResult);
        }
    }

    async function open(opts) {
        opts = opts || {};
        state = {
            context: opts.context || 'GENERAL',
            onScan: opts.onScan
        };
        ensureOverlay();
        overlayEl.classList.remove('hidden');
        var host = document.getElementById('tm-scan-camera-host');
        if (!host) return;
        host.innerHTML = '<div id="tm-scan-camera-reader" class="w-full"></div>';
        try {
            var Html5Qrcode = await loadHtml5Qrcode();
            html5QrCode = new Html5Qrcode('tm-scan-camera-reader');
            cameraRunning = true;
            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                function (decodedText) {
                    onDecoded(decodedText);
                },
                function () { /* ignore frame errors */ }
            );
        } catch (e) {
            notify('无法启动相机：' + (e.message || '请检查权限'), 'error');
            close();
        }
    }

    function close() {
        stopCamera().finally(function () {
            if (overlayEl) overlayEl.classList.add('hidden');
            var host = document.getElementById('tm-scan-camera-host');
            if (host) host.innerHTML = '';
            state = null;
        });
    }

    global.TM_ScanCamera = { open: open, close: close };
})(window);
