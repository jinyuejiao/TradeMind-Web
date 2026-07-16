/**
 * CRM — 客户级 AI 营销建议
 * 缓存命中直接展示；regenerate 时重拉客户快照并调模型。
 */
(function (global) {
    'use strict';

    var OP = 'CRM_MARKETING';
    var POLL_MS = 2000;
    var POLL_MAX = 90;
    var pollTimer = null;
    var state = {
        customerId: null,
        customerName: '',
        requestId: null
    };

    function toast(msg, type) {
        if (global.TM_UI && typeof global.TM_UI.showNotification === 'function') {
            global.TM_UI.showNotification(msg, type || 'info');
            return;
        }
        if (typeof global.showToast === 'function') {
            global.showToast(msg);
            return;
        }
        console.log('[CrmAI]', msg);
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fetchJson(url, opts) {
        opts = opts || {};
        return global.wrappedFetch(url, opts).then(function (resp) {
            if (typeof global.handleApiResponse === 'function') {
                return global.handleApiResponse(resp);
            }
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        });
    }

    function stopPoll() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    function resolveCustomer(opts) {
        opts = opts || {};
        if (opts.customerId != null || opts.customerName) {
            return {
                id: opts.customerId,
                custId: opts.customerId,
                name: opts.customerName || ''
            };
        }
        if (typeof global.getCrmCurrentCustomer === 'function') {
            try {
                var fromHook = global.getCrmCurrentCustomer();
                if (fromHook) return fromHook;
            } catch (e) { /* ignore */ }
        }
        if (global.CrmApp && global.CrmApp.state && global.CrmApp.state.currentCustomer) {
            return global.CrmApp.state.currentCustomer;
        }
        if (global.__crmPageState && global.__crmPageState.currentCustomer) {
            return global.__crmPageState.currentCustomer;
        }
        return null;
    }

    function getCustomerIdName(opts) {
        var c = resolveCustomer(opts);
        if (!c) return { id: null, name: '' };
        var id = c.custId != null ? c.custId : (c.customerId != null ? c.customerId : c.id);
        var name = c.name || c.customerName || '';
        var num = id != null && id !== '' ? Number(id) : null;
        return { id: (num != null && !isNaN(num)) ? num : null, name: name };
    }

    function showLoading(show, text) {
        var loading = document.getElementById('crm-ai-loading');
        var body = document.getElementById('crm-ai-report-body');
        if (loading) {
            loading.classList.toggle('hidden', !show);
            var t = loading.querySelector('[data-crm-ai-loading-text]');
            if (t && text) t.textContent = text;
        }
        if (body) body.classList.toggle('hidden', !!show);
    }

    function severityClass(sev) {
        var s = String(sev || 'medium').toLowerCase();
        if (s === 'high') return 'bg-rose-50 border-rose-100 text-rose-800';
        if (s === 'low') return 'bg-teal-50 border-teal-100 text-teal-800';
        return 'bg-amber-50 border-amber-100 text-amber-800';
    }

    function localizeScript(text, customerName) {
        if (!text) return '';
        var honor = 'XX总';
        if (customerName) {
            var n = String(customerName).trim();
            if (n) {
                if (/[\u4e00-\u9fff]/.test(n)) {
                    honor = n.charAt(0) + '总';
                } else {
                    honor = n.split(/\s+/)[0] + '总';
                }
            }
        }
        return String(text)
            .replace(/XX总/g, honor)
            .replace(/\{\{honorific\}\}/g, honor);
    }

    function isSalesViewer() {
        try {
            var role = (localStorage.getItem('roleType') || localStorage.getItem('role') || '').toUpperCase();
            return role === 'SALES' || role === 'OPERATOR' || role === 'READONLY';
        } catch (e) {
            return false;
        }
    }

    function renderReport(report, localName) {
        var body = document.getElementById('crm-ai-report-body');
        if (!body) return;
        report = report || {};
        var meta = report.meta || {};
        var diagnosis = report.diagnosis || {};
        var strategy = report.strategy || {};
        var actions = Array.isArray(strategy.actions) ? strategy.actions.slice() : [];
        var scripts = Array.isArray(report.scripts) ? report.scripts : [];
        var doNot = Array.isArray(report.do_not) ? report.do_not : [];
        var displayName = localName || state.customerName || meta.customer_ref || '客户';

        if (isSalesViewer()) {
            actions = actions.filter(function (a) {
                var t = String(a.type || '').toLowerCase();
                return t !== 'adjust_credit';
            });
        }

        actions.sort(function (a, b) {
            return (Number(a.priority) || 99) - (Number(b.priority) || 99);
        });

        var sub = document.getElementById('crm-ai-modal-sub');
        if (sub) {
            sub.textContent = (meta.cust_status ? meta.cust_status + ' · ' : '')
                + (meta.primary_intent || '')
                + (meta.generated_at ? ' · ' + meta.generated_at : '');
        }
        var titleName = document.getElementById('crm-ai-modal-customer');
        if (titleName) titleName.textContent = displayName;

        var html = '';
        html += '<section class="rounded-2xl border ' + severityClass(diagnosis.risk_level)
            + ' p-4 md:p-5 backdrop-blur-sm">'
            + '<p class="text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">现状诊断</p>'
            + '<p class="text-sm leading-relaxed font-medium">' + esc(diagnosis.status_text || meta.summary || '—') + '</p>';
        var signals = Array.isArray(diagnosis.signals) ? diagnosis.signals : [];
        if (signals.length) {
            html += '<ul class="mt-3 text-xs space-y-1 list-disc pl-4 opacity-90">';
            signals.forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
            html += '</ul>';
        }
        html += '</section>';

        html += '<section class="mt-5">'
            + '<div class="flex items-center gap-2 mb-3">'
            + '<span class="w-1.5 h-5 bg-teal-500 rounded-full"></span>'
            + '<h4 class="text-sm font-bold text-slate-800">' + esc(strategy.title || '核心建议') + '</h4></div>';
        if (!actions.length) {
            html += '<p class="text-xs text-slate-400">暂无具体动作建议。</p>';
        } else {
            html += '<div class="space-y-3">';
            actions.forEach(function (a, idx) {
                html += '<div class="p-4 rounded-2xl border border-slate-100 bg-white/90 shadow-sm">'
                    + '<div class="flex items-start gap-3">'
                    + '<div class="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center text-xs font-black shrink-0">'
                    + (a.priority || (idx + 1)) + '</div>'
                    + '<div class="min-w-0"><p class="text-sm font-bold text-slate-900">' + esc(a.title) + '</p>'
                    + '<p class="text-[11px] text-slate-500 mt-1 leading-relaxed">' + esc(a.detail) + '</p>'
                    + '<p class="text-[10px] text-teal-600 font-bold mt-2 uppercase">' + esc(a.type || '') + '</p>'
                    + '</div></div></div>';
            });
            html += '</div>';
        }
        html += '</section>';

        html += '<section class="mt-5">'
            + '<div class="flex items-center justify-between gap-2 mb-3">'
            + '<div class="flex items-center gap-2">'
            + '<span class="w-1.5 h-5 bg-teal-500 rounded-full"></span>'
            + '<h4 class="text-sm font-bold text-slate-800">即用话术</h4></div></div>';
        if (!scripts.length) {
            html += '<p class="text-xs text-slate-400">暂无话术。</p>';
        } else {
            scripts.forEach(function (sc, i) {
                var txt = localizeScript(sc.text, displayName);
                html += '<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-3">'
                    + '<div class="flex items-center justify-between mb-2">'
                    + '<p class="text-[10px] font-black text-slate-400 uppercase">' + esc(sc.channel || 'wechat') + '</p>'
                    + '<button type="button" class="text-[10px] font-bold text-teal-700 hover:underline" data-crm-copy="' + i + '">复制</button></div>'
                    + '<p class="text-xs text-slate-700 leading-relaxed" id="crm-ai-script-' + i + '">' + esc(txt) + '</p></div>';
            });
        }
        html += '</section>';

        if (doNot.length) {
            html += '<section class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">'
                + '<p class="text-[10px] font-black text-slate-400 uppercase mb-1">注意</p><ul class="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">';
            doNot.forEach(function (d) { html += '<li>' + esc(d) + '</li>'; });
            html += '</ul></section>';
        }

        body.innerHTML = html;
        showLoading(false);

        body.querySelectorAll('[data-crm-copy]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = btn.getAttribute('data-crm-copy');
                var el = document.getElementById('crm-ai-script-' + i);
                var t = el ? el.textContent : '';
                if (!t) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(t).then(function () { toast('话术已复制', 'success'); });
                } else {
                    toast('请手动复制', 'info');
                }
            });
        });
    }

    function pollUntilDone(requestId, onDone, onFail) {
        stopPoll();
        var n = 0;
        function tick() {
            n += 1;
            fetchJson('/api/v1/ai/status/' + encodeURIComponent(requestId), { method: 'GET' })
                .then(function (data) {
                    if (!data || data.success === false) {
                        throw new Error((data && data.message) || '查询状态失败');
                    }
                    if (data.status === 'SUCCESS') {
                        onDone(data.report);
                        return;
                    }
                    if (data.status === 'FAILED') {
                        throw new Error((data.aiResult && String(data.aiResult).slice(0, 200)) || '生成失败');
                    }
                    if (n >= POLL_MAX) throw new Error('生成超时，请稍后重试');
                    pollTimer = setTimeout(tick, POLL_MS);
                })
                .catch(onFail);
        }
        tick();
    }

    function syncModalHeader(name, subText) {
        var titleName = document.getElementById('crm-ai-modal-customer');
        if (titleName) titleName.textContent = name || '客户';
        var sub = document.getElementById('crm-ai-modal-sub');
        if (sub) sub.textContent = subText != null ? subText : 'Customer Marketing';
    }

    function openCrmAiModal(opts) {
        opts = opts || {};
        var cust = getCustomerIdName(opts);
        if (!cust.id) {
            toast('请先选择客户', 'warning');
            return;
        }
        state.customerId = cust.id;
        state.customerName = cust.name || ('客户#' + cust.id);

        var modal = document.getElementById('crm-ai-modal');
        if (!modal) return;
        // 等待态立刻刷新标题，避免残留上一客户名称与旧 meta
        syncModalHeader(state.customerName, '分析中…');
        var body = document.getElementById('crm-ai-report-body');
        if (body) {
            body.innerHTML = '<p class="text-sm text-slate-400 text-center py-16">正在为「'
                + esc(state.customerName) + '」生成营销建议…</p>';
        }

        if (typeof global.TM_openUnifiedModal === 'function') global.TM_openUnifiedModal(modal);
        else {
            modal.classList.remove('hidden');
            if (typeof global.TM_notifyEmbedModal === 'function') global.TM_notifyEmbedModal(true);
        }

        showLoading(true, 'AI 正在分析「' + state.customerName + '」，请稍候…');
        var regenerate = !!opts.regenerate;

        var run = regenerate
            ? Promise.resolve(null)
            : fetchJson('/api/v1/ai/reports/latest?opType=' + OP + '&customerId=' + encodeURIComponent(cust.id), { method: 'GET' });

        run.then(function (latest) {
            if (latest && latest.exists && latest.status === 'SUCCESS' && latest.report && !regenerate) {
                if (latest.localCustomerName) state.customerName = latest.localCustomerName;
                syncModalHeader(state.customerName);
                renderReport(latest.report, state.customerName);
                return null;
            }
            if (latest && latest.exists && latest.status === 'EXTRACTING' && latest.requestId && !regenerate) {
                return latest;
            }
            return fetchJson('/api/v1/ai/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    opType: OP,
                    regenerate: !!regenerate,
                    customerId: cust.id
                })
            });
        }).then(function (data) {
            if (data == null) return;
            if (!data || data.success === false) {
                throw new Error((data && data.message) || '请求失败');
            }
            if (data.localCustomerName) state.customerName = data.localCustomerName;
            syncModalHeader(state.customerName, '分析中…');
            if (data.status === 'SUCCESS' && data.report) {
                renderReport(data.report, state.customerName);
                return;
            }
            if (data.requestId) {
                state.requestId = data.requestId;
                showLoading(true, 'AI 正在分析「' + state.customerName + '」，请稍候…');
                pollUntilDone(data.requestId, function (report) {
                    renderReport(report, state.customerName);
                }, function (err) {
                    showLoading(false);
                    var bodyEl = document.getElementById('crm-ai-report-body');
                    if (bodyEl) {
                        bodyEl.classList.remove('hidden');
                        bodyEl.innerHTML = '<p class="text-sm text-rose-600 text-center py-10">'
                            + esc(err.message || '生成失败') + '</p>';
                    }
                    toast(err.message || '生成失败', 'error');
                });
                return;
            }
            throw new Error('未返回有效结果');
        }).catch(function (err) {
            showLoading(false);
            toast(err.message || '加载失败', 'error');
            var bodyEl = document.getElementById('crm-ai-report-body');
            if (bodyEl) {
                bodyEl.classList.remove('hidden');
                bodyEl.innerHTML = '<p class="text-sm text-rose-600 text-center py-10">'
                    + esc(err.message || '加载失败') + '</p>';
            }
        });
    }

    function closeCrmAiModal() {
        stopPoll();
        var modal = document.getElementById('crm-ai-modal');
        if (typeof global.TM_closeUnifiedModal === 'function') global.TM_closeUnifiedModal(modal);
        else if (modal) {
            modal.classList.add('hidden');
            if (typeof global.TM_notifyEmbedModal === 'function') global.TM_notifyEmbedModal(false);
        }
    }

    function regenerateCrmAi() {
        var msg = '将重新拉取该客户最新订单/欠款/库存匹配数据并生成建议，可能消耗 AI 额度。确认？';
        function go() {
            openCrmAiModal({
                regenerate: true,
                customerId: state.customerId,
                customerName: state.customerName
            });
        }
        if (global.TM_UI && typeof global.TM_UI.confirm === 'function') {
            Promise.resolve(global.TM_UI.confirm({ message: msg, title: '重新生成' })).then(function (ok) {
                if (ok) go();
            });
            return;
        }
        if (window.confirm(msg)) go();
    }

    /** 将旧版假数据弹窗 DOM 升级为诊断/策略/话术结构 */
    function ensureUi() {
        var modal = document.getElementById('crm-ai-modal');
        if (!modal) return false;
        var legacy = document.getElementById('crm-ai-suggestion-btn')
            || document.getElementById('crm-ai-suggestion-text')
            || document.getElementById('crm-ai-script-btn');
        if (!legacy && document.getElementById('crm-ai-report-body')) return true;

        var panel = modal.querySelector('.modal-content-box') || modal.children[1];
        if (!panel) return false;
        panel.innerHTML =
            '<div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">'
            + '<div class="flex items-center gap-3 min-w-0">'
            + '<div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">'
            + '<i class="ph ph-lightbulb-filament text-xl"></i></div>'
            + '<div class="min-w-0">'
            + '<h3 class="text-sm font-black text-slate-800 truncate">AI 营销建议 · <span id="crm-ai-modal-customer">客户</span></h3>'
            + '<p id="crm-ai-modal-sub" class="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5 truncate">Customer Marketing</p>'
            + '</div></div>'
            + '<div class="flex items-center gap-1 shrink-0">'
            + '<button type="button" onclick="regenerateCrmAiSuggestion()" title="重新生成" class="p-2 hover:bg-teal-50 rounded-full transition-colors text-teal-600">'
            + '<i class="ph ph-arrows-clockwise text-lg"></i></button>'
            + '<button onclick="closeCrmAiModal()" class="p-2 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-x text-xl text-slate-400"></i></button>'
            + '</div></div>'
            + '<div class="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar relative">'
            + '<div id="crm-ai-loading" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 px-6">'
            + '<span class="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></span>'
            + '<p data-crm-ai-loading-text class="mt-4 text-sm text-slate-600 font-medium text-center">正在加载营销建议…</p></div>'
            + '<div id="crm-ai-report-body" class="space-y-1">'
            + '<p class="text-sm text-slate-400 text-center py-16">打开后将自动加载该客户的最新建议。</p></div></div>'
            + '<div class="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">'
            + '<button type="button" onclick="regenerateCrmAiSuggestion()" class="flex-1 py-3 rounded-2xl border border-teal-200 text-xs font-bold text-teal-700 hover:bg-teal-50 transition">重新生成</button>'
            + '<button onclick="closeCrmAiModal()" class="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition">完成</button>'
            + '</div>';
        console.info('[CrmAI] 已升级旧版营销建议弹窗 UI');
        return true;
    }

    function openFromLegacyButton() {
        ensureUi();
        openCrmAiModal({ regenerate: false });
    }

    global.TM_CrmAI = {
        open: openCrmAiModal,
        close: closeCrmAiModal,
        regenerate: regenerateCrmAi,
        ensureUi: ensureUi
    };
    global.openCrmAiModal = openCrmAiModal;
    global.closeCrmAiModal = closeCrmAiModal;
    global.regenerateCrmAiSuggestion = regenerateCrmAi;
    // 兼容旧弹窗按钮（generateCrmMarketingSuggestion / Script）
    global.generateCrmMarketingSuggestion = openFromLegacyButton;
    global.generateCrmMarketingScript = openFromLegacyButton;

    function bootEnsure() {
        try { ensureUi(); } catch (e) { console.warn('[CrmAI] ensureUi 失败', e); }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootEnsure);
    } else {
        bootEnsure();
    }
})(window);
