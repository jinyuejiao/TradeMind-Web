/**
 * TM_Print — 行业感知打印（预览 / PC 浏览器 / 移动云打印）
 */
(function (global) {
    'use strict';

    var settingsCache = null;
    var settingsLoadedAt = 0;
    var SETTINGS_TTL = 60000;

    var DOC_TYPE_LABEL = {
        SALES_ORDER: '销售单',
        DELIVERY_NOTE: '送货单',
        SALES_RECEIPT: '结账单',
        PURCHASE_ORDER: '进货单',
        INBOUND_NOTE: '入库单',
        PAYMENT_VOUCHER: '收款凭证',
        SKU_LABEL: 'SKU 标签'
    };

    var COL_LABEL = {
        productName: '商品',
        specDisplay: '规格',
        quantity: '数量',
        unit: '单位',
        unitPrice: '单价',
        subtotal: '金额'
    };

    var ORDER_STATUS_FALLBACK = {
        D010001: '待配货',
        D010002: '拣货中',
        D010003: '全部发货',
        D010004: '已签收',
        D010005: '退货',
        D010006: '部分发货'
    };

    var SALES_FIN_LABELS = {
        UNPAID: '未收款',
        PARTIAL_PAID: '部分收款',
        SETTLED: '已结清',
        BAD_DEBT: '坏账'
    };

    var PURCHASE_FIN_LABELS = {
        UNPAID: '未付款',
        PARTIAL_PAID: '部分付款',
        SETTLED: '已结清'
    };

    var PURCHASE_STATUS_LABELS = {
        DRAFT: '草稿',
        PENDING_REVIEW: '待审核',
        SUBMITTED: '已提交',
        APPROVED: '审核通过',
        PARTIAL_INBOUND: '部分入库',
        FULL_INBOUND: '全部入库',
        STOCKED: '全部入库',
        REJECTED: '已驳回',
        VOIDED: '作废',
        CANCELLED: '已取消'
    };

    function isPurchaseDocType(docType) {
        return docType === 'PURCHASE_ORDER' || docType === 'INBOUND_NOTE';
    }

    function normalizeCode(code) {
        return String(code || '').trim().toUpperCase();
    }

    function labelSalesLogistics(code) {
        if (!code) return '';
        if (global.TM_OrderDict && typeof global.TM_OrderDict.orderStatusLabel === 'function') {
            return global.TM_OrderDict.orderStatusLabel(code);
        }
        var k = normalizeCode(code);
        var map = global.TM_ORDER_STATUS_MAP || ORDER_STATUS_FALLBACK;
        return map[k] || ORDER_STATUS_FALLBACK[k] || String(code);
    }

    function labelPurchaseLogistics(code) {
        if (!code) return '';
        var k = normalizeCode(code);
        return PURCHASE_STATUS_LABELS[k] || String(code);
    }

    function labelFinance(code, isPurchase) {
        if (!code) return '';
        var k = normalizeCode(code);
        var map = isPurchase ? PURCHASE_FIN_LABELS : SALES_FIN_LABELS;
        return map[k] || String(code);
    }

    function fmtStatus(docType, meta) {
        if (!meta) return '';
        var purchaseDoc = isPurchaseDocType(docType);
        var logCode = meta.logisticsStatus || meta.order_status || meta.orderStatus
            || meta.purchaseStatus || meta.purchase_status;
        var finCode = meta.financeStatus || meta.fin_status || meta.finStatus;
        var parts = [];
        if (logCode) {
            parts.push(purchaseDoc ? labelPurchaseLogistics(logCode) : labelSalesLogistics(logCode));
        }
        if (finCode) {
            parts.push(labelFinance(finCode, purchaseDoc));
        }
        return parts.join(' · ');
    }

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

    function money(v) {
        if (v === '—' || v == null || v === '') return '—';
        var n = Number(v);
        if (isNaN(n)) return esc(String(v));
        return '¥' + n.toFixed(2);
    }

    function fmtDate(raw) {
        if (!raw) return '—';
        var s = String(raw).replace('T', ' ').trim();
        if (s.length >= 19) return s.slice(0, 19);
        if (s.length >= 10) return s.slice(0, 10);
        return s;
    }

    function counterpartyLabel(docType) {
        if (docType === 'PURCHASE_ORDER' || docType === 'INBOUND_NOTE') return '供应商';
        return '客户';
    }

    function resolveDocTypeLabel(docType) {
        return DOC_TYPE_LABEL[docType] || docType || '单据';
    }

    function normalizeDocType(docType) {
        if (docType === 'PAYMENT_VOUCHER') return 'SALES_RECEIPT';
        return docType;
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

    function totalQuantity(lines) {
        var sum = 0;
        (lines || []).forEach(function (line) {
            var q = Number(line.quantity);
            if (!isNaN(q)) sum += q;
        });
        return sum;
    }

    function renderReceiptBody(doc, opts) {
        opts = opts || {};
        var merchant = doc.merchant || {};
        var counter = doc.counterparty || {};
        var lines = doc.lines || [];
        var summary = doc.summary || {};
        var meta = doc.meta || {};
        var docType = meta.docType || doc.docType || '';
        var cols = doc.templateColumns || ['productName', 'quantity', 'unitPrice', 'subtotal'];
        var title = resolveDocTypeLabel(docType);
        var shopName = merchant.name || 'TradeMind 商户';
        var totalQty = totalQuantity(lines);
        var now = opts.printTime || new Date().toLocaleString('zh-CN', { hour12: false });

        var metaRows = [
            { k: '单号', v: meta.docNo || '—' },
            { k: counterpartyLabel(docType), v: counter.name || '—' },
            { k: '业务日期', v: fmtDate(meta.createdAt) }
        ];
        if (counter.phone) metaRows.push({ k: '联系电话', v: counter.phone });
        var statusText = fmtStatus(docType, meta);
        if (statusText) metaRows.push({ k: '状态', v: statusText });

        var metaHtml = metaRows.map(function (row) {
            return '<div class="tm-print-receipt-meta-row"><span class="k">' + esc(row.k) + '</span><span class="v">' + esc(row.v) + '</span></div>';
        }).join('');

        var thead = cols.map(function (c) {
            return '<th class="col-' + esc(c) + '">' + esc(COL_LABEL[c] || c) + '</th>';
        }).join('');

        var tbody = lines.map(function (line) {
            var nameCell = esc(line.productName || '—');
            if (line.specDisplay) {
                nameCell += '<span class="tm-print-receipt-spec">' + esc(line.specDisplay) + '</span>';
            }
            var cells = cols.map(function (c) {
                if (c === 'productName') return '<td class="col-product">' + nameCell + '</td>';
                var v = line[c];
                if (c === 'unitPrice' || c === 'subtotal') v = money(v);
                return '<td class="col-' + esc(c) + '">' + esc(v == null ? '' : v) + '</td>';
            }).join('');
            var extra = '';
            if (line.serialNos && line.serialNos.length) {
                extra += '<tr class="tm-print-receipt-extra"><td colspan="' + cols.length + '">SN：' + esc(line.serialNos.join(', ')) + '</td></tr>';
            }
            if (line.batchNo || line.expiryDate) {
                extra += '<tr class="tm-print-receipt-extra"><td colspan="' + cols.length + '">批次 ' + esc(line.batchNo || '') +
                    ' · 效期 ' + esc(line.expiryDate || '') + '</td></tr>';
            }
            return '<tr>' + cells + '</tr>' + extra;
        }).join('');

        var summaryRows = [
            { k: '合计数量', v: String(totalQty), bold: false },
            { k: '应收合计', v: money(summary.totalAmount), bold: true }
        ];
        if (summary.receivedAmount != null) {
            summaryRows.push({ k: '实收金额', v: money(summary.receivedAmount), bold: true });
        }
        if (summary.remainingAmount != null && summary.remainingAmount !== summary.totalAmount) {
            summaryRows.push({ k: '待收金额', v: money(summary.remainingAmount), bold: false });
        }
        if (summary.paidAmount != null) {
            summaryRows.push({ k: '已付金额', v: money(summary.paidAmount), bold: true });
        }

        var summaryHtml = summaryRows.map(function (row) {
            return '<div class="tm-print-receipt-sum-row' + (row.bold ? ' is-bold' : '') + '">' +
                '<span>' + esc(row.k) + '</span><span>' + row.v + '</span></div>';
        }).join('');

        return '<div class="tm-print-receipt" data-doc-type="' + esc(docType) + '">' +
            '<div class="tm-print-receipt-head">' +
            '<div class="tm-print-receipt-mark"><i class="ph ph-brain"></i></div>' +
            '<div class="tm-print-receipt-head-text">' +
            '<p class="tm-print-receipt-shop">' + esc(shopName) + '</p>' +
            '<h2 class="tm-print-receipt-title">' + esc(title) + '</h2>' +
            '</div></div>' +
            '<div class="tm-print-receipt-meta">' + metaHtml + '</div>' +
            '<div class="tm-print-receipt-divider"></div>' +
            '<table class="tm-print-receipt-table"><thead><tr>' + thead + '</tr></thead><tbody>' +
            (tbody || '<tr><td colspan="' + cols.length + '" class="empty">暂无明细</td></tr>') +
            '</tbody></table>' +
            '<div class="tm-print-receipt-divider"></div>' +
            '<div class="tm-print-receipt-summary">' + summaryHtml + '</div>' +
            (merchant.footerText ? ('<p class="tm-print-receipt-note">' + esc(merchant.footerText) + '</p>') : '') +
            '<div class="tm-print-receipt-foot">' +
            '<p>打印时间：' + esc(now) + '</p>' +
            '<p class="tm-print-receipt-brand">TradeMind 商贸智脑</p>' +
            '</div></div>';
    }

    function renderHtml(doc, opts) {
        opts = opts || {};
        var meta = doc.meta || {};
        var triplicate = opts.triplicate ? ' tm-print-triplicate' : '';
        var body = renderReceiptBody(doc, opts);
        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(meta.docNo || '打印') + '</title>' +
            '<link rel="stylesheet" href="/assets/css/tm-print.css">' +
            '<style>body{margin:0;padding:12px;background:#fff;color:#111;font-family:SimSun,serif}' +
            '@media print{.no-print{display:none}body{padding:0}}</style></head>' +
            '<body class="tm-print-page' + triplicate + '">' + body + '</body></html>';
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
        DOC_TYPE_LABEL: DOC_TYPE_LABEL,
        normalizeDocType: normalizeDocType,
        renderReceiptBody: renderReceiptBody,
        renderHtml: renderHtml,

        invalidateSettingsCache: function () {
            settingsCache = null;
        },

        openPreview: async function (opts) {
            opts = opts || {};
            if (global.TM_PrintPreview && typeof global.TM_PrintPreview.open === 'function') {
                return global.TM_PrintPreview.open(opts);
            }
            return global.TM_Print.print(Object.assign({}, opts, { skipPreview: true }));
        },

        print: async function (opts) {
            opts = opts || {};
            if (!opts.skipPreview && global.TM_PrintPreview && typeof global.TM_PrintPreview.open === 'function') {
                return global.TM_PrintPreview.open(opts);
            }

            var docType = normalizeDocType(opts.docType);
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
            return global.TM_Print.openPreview(opts);
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
