/**
 * TM_Print — 行业感知打印（PC 浏览器 / 移动云打印）
 */
(function (global) {
    'use strict';

    var settingsCache = null;
    var settingsLoadedAt = 0;
    var SETTINGS_TTL = 60000;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function isMobile() {
        return global.matchMedia && global.matchMedia('(max-width: 767px)').matches;
    }

    function notify(msg, type) {
        if (global.TM_UI && global.TM_UI.showNotification) global.TM_UI.showNotification(msg, type || 'info');
        else if (global.showToast) global.showToast(msg);
    }

    async function getDefaultDeviceId() {
        if (!global.TM_PrintApi || !global.TM_PrintApi.getSettings) return null;
        if (settingsCache && Date.now() - settingsLoadedAt < SETTINGS_TTL) {
            return settingsCache.defaultPrinterId || null;
        }
        try {
            var res = await global.TM_PrintApi.getSettings();
            if (res.success && res.data) {
                settingsCache = res.data;
                settingsLoadedAt = Date.now();
                return res.data.defaultPrinterId || null;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function renderHtml(doc, opts) {
        opts = opts || {};
        var merchant = doc.merchant || {};
        var counter = doc.counterparty || {};
        var lines = doc.lines || [];
        var summary = doc.summary || {};
        var meta = doc.meta || {};
        var cols = doc.templateColumns || ['productName', 'quantity', 'unitPrice', 'subtotal'];
        var colLabel = {
            productName: '品名', specDisplay: '规格', quantity: '数量', unit: '单位',
            unitPrice: '单价', subtotal: '小计'
        };
        var triplicate = opts.triplicate ? ' tm-print-triplicate' : '';
        var thead = cols.map(function (c) { return '<th>' + esc(colLabel[c] || c) + '</th>'; }).join('');
        var tbody = lines.map(function (line) {
            var cells = cols.map(function (c) {
                var v = line[c];
                if (c === 'unitPrice' || c === 'subtotal') v = v != null ? ('¥' + Number(v).toFixed(2)) : '—';
                return '<td>' + esc(v) + '</td>';
            }).join('');
            var extra = '';
            if (line.serialNos && line.serialNos.length) {
                extra += '<tr><td colspan="' + cols.length + '" class="extra">SN：' + esc(line.serialNos.join(', ')) + '</td></tr>';
            }
            if (line.batchNo || line.expiryDate) {
                extra += '<tr><td colspan="' + cols.length + '" class="extra">批次 ' + esc(line.batchNo || '') +
                    ' 效期 ' + esc(line.expiryDate || '') + '</td></tr>';
            }
            return '<tr>' + cells + '</tr>' + extra;
        }).join('');

        var docTypeLabel = {
            SALES_ORDER: '销售单', DELIVERY_NOTE: '送货单', SALES_RECEIPT: '结账单',
            PURCHASE_ORDER: '进货单', INBOUND_NOTE: '入库单'
        };
        var title = docTypeLabel[meta.docType] || meta.docType || '打印';

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(meta.docNo || title) + '</title>' +
            '<link rel="stylesheet" href="/assets/css/tm-print.css">' +
            '<style>' +
            'body{font-family:SimSun,serif;font-size:12px;padding:12px;color:#111}' +
            'h1{text-align:center;font-size:16px;margin:0 0 8px}' +
            'table{width:100%;border-collapse:collapse;margin:12px 0}' +
            'th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}' +
            'th{background:#f5f5f5}.extra{font-size:10px;color:#555}' +
            '.sum{text-align:right;font-weight:bold;margin-top:8px}' +
            '.doc-type{text-align:center;font-size:11px;color:#666;margin-bottom:4px}' +
            '@media print{.no-print{display:none}}' +
            '</style></head><body class="' + triplicate.trim() + '">' +
            '<p class="doc-type">' + esc(title) + '</p>' +
            '<h1>' + esc(merchant.name || '') + '</h1>' +
            '<p>单号：' + esc(meta.docNo) + ' &nbsp; 对方：' + esc(counter.name) + '</p>' +
            '<table><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table>' +
            '<p class="sum">合计：¥' + Number(summary.totalAmount || 0).toFixed(2) + '</p>' +
            (merchant.footerText ? ('<p style="text-align:center;margin-top:16px">' + esc(merchant.footerText) + '</p>') : '') +
            '</body></html>';
    }

    function browserPrint(html) {
        var frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(frame);
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(function () {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } catch (e) {
                notify('浏览器打印失败', 'error');
            }
            setTimeout(function () { frame.remove(); }, 1000);
        }, 300);
    }

    global.TM_Print = {
        invalidateSettingsCache: function () {
            settingsCache = null;
        },

        print: async function (opts) {
            opts = opts || {};
            var docType = opts.docType;
            var docId = String(opts.docId || '');
            if (!docType || !docId) {
                notify('缺少打印单据信息', 'error');
                return { success: false };
            }
            try {
                var useCloud = isMobile() || opts.channel === 'CLOUD';
                var deviceId = opts.deviceId;
                if (useCloud && !deviceId) {
                    deviceId = await getDefaultDeviceId();
                }
                if (useCloud) {
                    var jobRes = await global.TM_PrintApi.createJob({
                        docType: docType,
                        docId: docId,
                        deviceId: deviceId,
                        channel: 'CLOUD'
                    });
                    if (!jobRes.success) throw new Error(jobRes.message || (jobRes.data && jobRes.data.message) || '云打印失败');
                    var jobData = jobRes.data || jobRes;
                    if (jobData.status === 'FAILED') throw new Error(jobData.message || '云打印失败');
                    notify('已提交云打印', 'success');
                    return jobData;
                }
                var docRes = await global.TM_PrintApi.getDocument(docType, docId);
                if (!docRes.success || !docRes.data) throw new Error(docRes.message || '加载打印数据失败');
                var triplicate = !isMobile() && (docType === 'SALES_ORDER' || docType === 'DELIVERY_NOTE' || docType === 'PURCHASE_ORDER');
                var html = renderHtml(docRes.data, { triplicate: triplicate });
                browserPrint(html);
                if (opts.audit !== false) {
                    await global.TM_PrintApi.createJob({
                        docType: docType, docId: docId, channel: 'BROWSER'
                    }).catch(function () { /* ignore audit fail */ });
                }
                return { success: true, channel: 'BROWSER' };
            } catch (e) {
                notify(e.message || '打印失败', 'error');
                return { success: false, message: e.message };
            }
        },

        preview: async function (opts) {
            var docRes = await global.TM_PrintApi.getDocument(opts.docType, String(opts.docId));
            if (!docRes.success) throw new Error(docRes.message || '加载失败');
            var w = window.open('', '_blank');
            if (w) {
                w.document.write(renderHtml(docRes.data, { triplicate: true }));
                w.document.close();
            }
            return docRes.data;
        },

        previewTestDocument: function (doc) {
            var html = renderHtml(doc || {
                merchant: { name: 'TradeMind 测试' },
                counterparty: { name: '—' },
                lines: [{ productName: '测试打印页', quantity: 1, unitPrice: 0, subtotal: 0 }],
                summary: { totalAmount: 0 },
                meta: { docNo: 'TEST', docType: 'TEST' }
            });
            browserPrint(html);
        }
    };
})(window);
