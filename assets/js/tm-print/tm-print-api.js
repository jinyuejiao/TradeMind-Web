/**
 * TM_Print API — 对接 /api/v1/ai/peripheral/**
 */
(function (global) {
    'use strict';

    var BASE = '/api/v1/ai/peripheral';

    function fetchJson(method, path, body) {
        var fn = global.wrappedFetch || fetch;
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body != null) opts.body = JSON.stringify(body);
        return fn(BASE + path, opts).then(function (r) { return r.json(); });
    }

    global.TM_PrintApi = {
        listDevices: function (deviceType) {
            var qs = deviceType ? ('?deviceType=' + encodeURIComponent(deviceType)) : '';
            return fetchJson('GET', '/devices' + qs);
        },
        saveDevice: function (body, deviceId) {
            if (deviceId) return fetchJson('PUT', '/devices/' + deviceId, body);
            return fetchJson('POST', '/devices', body);
        },
        deleteDevice: function (deviceId) {
            return fetchJson('DELETE', '/devices/' + deviceId);
        },
        testDevice: function (deviceId) {
            return fetchJson('POST', '/devices/' + deviceId + '/test', {});
        },
        getDocument: function (docType, docId) {
            return fetchJson('GET', '/print/documents/' + encodeURIComponent(docType) + '/' + encodeURIComponent(docId));
        },
        createJob: function (body) {
            return fetchJson('POST', '/print/jobs', body);
        },
        getSettings: function () {
            return fetchJson('GET', '/print/settings');
        },
        saveSettings: function (body) {
            return fetchJson('PUT', '/print/settings', body);
        },
        scanDecode: function (body) {
            return fetchJson('POST', '/scan/decode', body);
        }
    };
})(window);
