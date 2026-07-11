/**
 * TM_ScanRouter — 全局 HID 扫枪输入解析（不经过 ai_operation_records）
 */
(function (global) {
    'use strict';

    var buffer = '';
    var lastKeyAt = 0;
    var context = null;
    var minLen = 3;
    var suffixKeys = ['Enter'];
    var enabled = true;

    function dispatch(code, decodeResult) {
        if (!context || typeof context.onScan !== 'function') return;
        try {
            context.onScan(code, decodeResult);
        } catch (e) {
            console.warn('[TM_ScanRouter]', e);
        }
    }

    async function resolve(code) {
        if (!global.TM_PrintApi || !global.TM_PrintApi.scanDecode) {
            dispatch(code, null);
            return;
        }
        try {
            var res = await global.TM_PrintApi.scanDecode({
                rawText: code,
                context: context ? context.name : 'GENERAL'
            });
            dispatch(code, res.success ? res.data : null);
        } catch (e) {
            dispatch(code, null);
        }
    }

    function onKeyDown(e) {
        if (!enabled || !context) return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'hidden' && !e.target.readOnly)) {
            return;
        }
        var now = Date.now();
        if (now - lastKeyAt > 80) buffer = '';
        lastKeyAt = now;

        if (e.key === 'Enter') {
            var code = buffer.trim();
            buffer = '';
            if (code.length >= minLen) {
                e.preventDefault();
                resolve(code);
            }
            return;
        }
        if (e.key.length === 1) {
            buffer += e.key;
        }
    }

    if (!global.__tmScanRouterBound) {
        global.__tmScanRouterBound = true;
        document.addEventListener('keydown', onKeyDown, true);
    }

    global.TM_ScanRouter = {
        setContext: function (ctx) {
            context = ctx;
            if (ctx && ctx.minLength) minLen = ctx.minLength;
        },
        clearContext: function () {
            context = null;
            buffer = '';
        },
        setEnabled: function (on) {
            enabled = !!on;
        }
    };
})(window);
