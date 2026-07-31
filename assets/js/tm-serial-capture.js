/**
 * TmSerialCapture — 序列号统一扫码录入（P3a 扫枪 + 粘贴；P3b 相机识码）
 * mode: 'inbound' | 'tracking'（运单号：扫到 1 次即完成并关闭）
 */
(function (global) {
    'use strict';

    var overlayEl = null;
    var scanInputEl = null;
    var listEl = null;
    var cameraHostEl = null;
    var titleEl = null;
    var progressEl = null;
    var state = null;
    var html5QrCode = null;
    var cameraRunning = false;
    var completing = false;

    function ensureOverlay() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.id = 'tm-serial-capture-overlay';
        overlayEl.className = 'tm-serial-capture-overlay hidden fixed inset-0 z-[9999] bg-black/40 flex items-end md:items-center justify-center p-4';
        overlayEl.innerHTML = [
            '<div class="tm-serial-capture-panel bg-white rounded-2xl w-full max-w-lg shadow-xl p-4 space-y-3">',
            '  <div class="flex items-center justify-between">',
            '    <h3 class="tm-serial-title font-bold text-slate-800">序列号录入</h3>',
            '    <button type="button" class="tm-serial-close text-slate-400 text-xl" aria-label="关闭">&times;</button>',
            '  </div>',
            '  <p class="tm-serial-progress text-sm text-brand-600 font-mono">已录 0 / 需 0</p>',
            '  <div id="tm-serial-camera-host" class="hidden rounded-lg overflow-hidden bg-black relative flex items-center justify-center" style="min-height:240px;height:240px;"></div>',
            '  <input type="text" id="tm-serial-scan-input" class="form-input font-mono w-full" autocomplete="off" placeholder="扫描枪聚焦此框，或手动输入后回车" />',
            '  <div class="flex gap-2 flex-wrap">',
            '    <button type="button" class="tm-serial-camera tm-btn-secondary text-sm flex-1 min-w-[7rem] py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600">相机扫码</button>',
            '    <button type="button" class="tm-serial-paste tm-btn-secondary text-sm flex-1 min-w-[7rem] py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600">批量粘贴</button>',
            '    <button type="button" class="tm-serial-complete tm-btn-primary text-sm flex-1 min-w-[7rem] py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">完成</button>',
            '  </div>',
            '  <ul id="tm-serial-list" class="max-h-40 overflow-y-auto text-sm font-mono space-y-1 border border-slate-100 rounded-lg p-2"></ul>',
            '</div>'
        ].join('');
        document.body.appendChild(overlayEl);
        scanInputEl = overlayEl.querySelector('#tm-serial-scan-input');
        listEl = overlayEl.querySelector('#tm-serial-list');
        cameraHostEl = overlayEl.querySelector('#tm-serial-camera-host');
        titleEl = overlayEl.querySelector('.tm-serial-title');
        progressEl = overlayEl.querySelector('.tm-serial-progress');
        overlayEl.querySelector('.tm-serial-close').addEventListener('click', close);
        overlayEl.querySelector('.tm-serial-paste').addEventListener('click', pasteBatch);
        overlayEl.querySelector('.tm-serial-complete').addEventListener('click', complete);
        overlayEl.querySelector('.tm-serial-camera').addEventListener('click', toggleCamera);
        scanInputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSerial(scanInputEl.value);
                scanInputEl.value = '';
            }
        });
    }

    function isTrackingMode() {
        return !!(state && state.mode === 'tracking');
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

    function stopCamera() {
        if (!html5QrCode || !cameraRunning) {
            if (cameraHostEl) cameraHostEl.classList.add('hidden');
            return Promise.resolve();
        }
        return html5QrCode.stop().then(function () {
            cameraRunning = false;
            if (cameraHostEl) {
                cameraHostEl.innerHTML = '';
                cameraHostEl.classList.add('hidden');
            }
        }).catch(function () {
            cameraRunning = false;
            if (cameraHostEl) {
                cameraHostEl.innerHTML = '';
                cameraHostEl.classList.add('hidden');
            }
        });
    }

    function toggleCamera() {
        if (cameraRunning) {
            stopCamera();
            return;
        }
        ensureOverlay();
        loadHtml5Qrcode().then(function (Html5Qrcode) {
            if (!cameraHostEl) return;
            cameraHostEl.classList.remove('hidden');
            cameraHostEl.innerHTML = '<div id="tm-serial-qr-reader" class="w-full h-full"></div>';
            html5QrCode = new Html5Qrcode('tm-serial-qr-reader');
            var box = isTrackingMode()
                ? { width: 260, height: 120 }
                : { width: 220, height: 220 };
            return html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: box, aspectRatio: 1.0 },
                function (decoded) {
                    addSerial(decoded);
                    if (navigator.vibrate) navigator.vibrate(30);
                },
                function () { /* ignore scan miss */ }
            );
        }).then(function () {
            cameraRunning = true;
        }).catch(function (err) {
            console.warn('[TmSerialCapture] camera failed', err);
            alert('无法启动相机，请使用扫枪或批量粘贴');
            stopCamera();
        });
    }

    function renderList() {
        if (!listEl || !state) return;
        if (isTrackingMode()) {
            listEl.classList.add('hidden');
            return;
        }
        listEl.classList.remove('hidden');
        listEl.innerHTML = state.serials.map(function (sn, i) {
            return '<li class="flex justify-between"><span>' + escapeHtml(sn) + '</span><button type="button" data-i="' + i + '" class="text-red-400 tm-serial-del">删</button></li>';
        }).join('');
        listEl.querySelectorAll('.tm-serial-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.serials.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
                renderList();
                updateProgress();
            });
        });
        updateProgress();
    }

    function updateProgress() {
        if (!progressEl || !state) return;
        if (isTrackingMode()) {
            progressEl.textContent = state.serials.length
                ? ('已识别：' + state.serials[0])
                : '对准运单条码，识别后自动填入';
            return;
        }
        progressEl.textContent = '已录 ' + state.serials.length + ' / 需 ' + (state.expectedQty || '—');
    }

    function addSerial(raw) {
        var sn = (raw || '').trim();
        if (!sn || !state || completing) return;
        if (isTrackingMode()) {
            state.serials = [sn];
            if (typeof state.onSerial === 'function') state.onSerial(sn);
            updateProgress();
            complete();
            return;
        }
        if (state.serials.indexOf(sn) >= 0) return;
        if (state.serials.length >= 500) {
            alert('单次最多录入 500 条序列号');
            return;
        }
        state.serials.push(sn);
        if (typeof state.onSerial === 'function') state.onSerial(sn);
        renderList();
    }

    function pasteBatch() {
        if (isTrackingMode()) {
            var one = prompt('粘贴运单号');
            if (one) addSerial(one);
            return;
        }
        var text = prompt('每行一个序列号，最多 500 条');
        if (!text) return;
        text.split(/[\r\n]+/).forEach(addSerial);
    }

    function complete() {
        if (completing) return;
        completing = true;
        var doneSerials = state ? state.serials.slice() : [];
        var onComplete = state && typeof state.onComplete === 'function' ? state.onComplete : null;
        stopCamera().finally(function () {
            if (onComplete) {
                try { onComplete(doneSerials); } catch (e) { /* ignore */ }
            }
            if (overlayEl) overlayEl.classList.add('hidden');
            state = null;
            completing = false;
        });
    }

    function close() {
        if (completing) return;
        stopCamera().finally(function () {
            if (overlayEl) overlayEl.classList.add('hidden');
            state = null;
            completing = false;
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function open(opts) {
        opts = opts || {};
        ensureOverlay();
        completing = false;
        stopCamera();
        state = {
            mode: opts.mode || 'inbound',
            skuId: opts.skuId,
            warehouseId: opts.warehouseId,
            expectedQty: opts.expectedQty || 0,
            serials: (opts.initialSerials || []).slice(),
            onSerial: opts.onSerial,
            onComplete: opts.onComplete
        };
        if (titleEl) {
            titleEl.textContent = isTrackingMode() ? '扫运单号' : '序列号录入';
        }
        var pasteBtn = overlayEl.querySelector('.tm-serial-paste');
        if (pasteBtn) {
            pasteBtn.textContent = isTrackingMode() ? '粘贴运单' : '批量粘贴';
        }
        if (scanInputEl) {
            scanInputEl.placeholder = isTrackingMode()
                ? '扫描枪聚焦此框，或手动输入运单号后回车'
                : '扫描枪聚焦此框，或手动输入后回车';
        }
        renderList();
        updateProgress();
        overlayEl.classList.remove('hidden');
        setTimeout(function () { scanInputEl && scanInputEl.focus(); }, 100);
    }

    global.TmSerialCapture = { open: open, close: close };
})(window);
