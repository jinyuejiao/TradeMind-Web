/**
 * 智能经营 — AI经营分析 / 生成促销方案
 * 缓存命中直接展示；regenerate=true 时重新拉快照并调用大模型。
 */
(function (global) {
    'use strict';

    var OP_BIZ = 'BIZ_ANALYSIS';
    var OP_PROMO = 'MARKETING_GEN';
    var POLL_MS = 2000;
    var POLL_MAX = 90;

    var state = {
        promoGoals: [],
        promoProductIds: [],
        bizRequestId: null,
        promoRequestId: null,
        pollTimer: null
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
        console.log('[BizAI]', msg);
    }

    function openModal(el) {
        if (!el) return;
        if (typeof global.TM_openUnifiedModal === 'function') global.TM_openUnifiedModal(el);
        else {
            el.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(el) {
        if (!el) return;
        if (typeof global.TM_closeUnifiedModal === 'function') global.TM_closeUnifiedModal(el);
        else {
            el.classList.add('hidden');
            document.body.style.overflow = '';
        }
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
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
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
                        onDone(data.report || parseAiResult(data.aiResult));
                        return;
                    }
                    if (data.status === 'FAILED') {
                        throw new Error((data.aiResult && String(data.aiResult).slice(0, 200)) || '生成失败');
                    }
                    if (n >= POLL_MAX) {
                        throw new Error('生成超时，请稍后重试');
                    }
                    state.pollTimer = setTimeout(tick, POLL_MS);
                })
                .catch(function (err) {
                    onFail(err);
                });
        }
        tick();
    }

    function parseAiResult(aiResult) {
        if (!aiResult) return null;
        try {
            var wrapped = typeof aiResult === 'string' ? JSON.parse(aiResult) : aiResult;
            if (wrapped && wrapped.details && wrapped.details.report) return wrapped.details.report;
            if (wrapped && wrapped.result) {
                if (typeof wrapped.result === 'string') {
                    try { return JSON.parse(wrapped.result); } catch (e) { return { meta: { summary: wrapped.result } }; }
                }
                return wrapped.result;
            }
            return wrapped;
        } catch (e) {
            return { meta: { summary: String(aiResult) } };
        }
    }

    function severityClass(sev) {
        var s = String(sev || 'medium').toLowerCase();
        if (s === 'high') return { badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', card: 'border-rose-100 bg-rose-50/80' };
        if (s === 'low') return { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', card: 'border-slate-100 bg-white/80' };
        return { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', card: 'border-amber-100 bg-amber-50/60' };
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatMoney(n) {
        var v = Number(n);
        if (!isFinite(v)) return '—';
        if (typeof global.TM_formatCNY === 'function') return global.TM_formatCNY(v);
        return '¥' + v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    }

    function showBizLoading(show, text) {
        var loading = document.getElementById('biz-ai-loading');
        var body = document.getElementById('biz-ai-report-body');
        if (loading) {
            loading.classList.toggle('hidden', !show);
            var t = loading.querySelector('[data-biz-ai-loading-text]');
            if (t && text) t.textContent = text;
        }
        if (body) body.classList.toggle('hidden', !!show);
    }

    function renderBizReport(report) {
        var body = document.getElementById('biz-ai-report-body');
        if (!body) return;
        report = report || {};
        var meta = report.meta || {};
        var anomalies = Array.isArray(report.anomalies) ? report.anomalies : [];
        var profitTips = Array.isArray(report.profit_tips) ? report.profit_tips : [];
        var effTips = Array.isArray(report.efficiency_tips) ? report.efficiency_tips : [];
        var outlook = report.outlook || {};
        var kpis = Array.isArray(report.kpi_highlights) ? report.kpi_highlights : [];

        var titleEl = document.getElementById('biz-ai-report-title');
        var subEl = document.getElementById('biz-ai-report-sub');
        if (titleEl) titleEl.textContent = meta.title || '商户经营全项诊断与增长建议';
        if (subEl) {
            subEl.textContent = '生成时间: ' + (meta.generated_at || '—')
                + ' | 窗口: 近 ' + (meta.period_days || 90) + ' 天'
                + (meta.summary ? ' · ' + meta.summary : '');
        }

        var html = '';
        if (kpis.length) {
            html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">';
            kpis.forEach(function (k) {
                var tone = k.tone === 'risk' ? 'text-rose-600' : (k.tone === 'positive' ? 'text-brand-600' : 'text-slate-800');
                html += '<div class="bg-white/70 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 shadow-sm">'
                    + '<p class="text-[10px] text-slate-400">' + esc(k.label) + '</p>'
                    + '<p class="text-lg font-mono font-bold ' + tone + '">' + esc(k.value) + '</p></div>';
            });
            html += '</div>';
        }

        html += '<section class="mb-10"><div class="flex items-center gap-2 mb-4">'
            + '<span class="w-1.5 h-6 bg-teal-500 rounded-full"></span>'
            + '<h3 class="text-lg font-bold text-slate-800">异常预警</h3></div>';
        if (!anomalies.length) {
            html += '<p class="text-sm text-slate-400">暂无显著异常，经营面相对平稳。</p>';
        } else {
            html += '<div class="space-y-3">';
            anomalies.forEach(function (a) {
                var sc = severityClass(a.severity);
                html += '<div class="relative overflow-hidden rounded-[1.25rem] border ' + sc.card
                    + ' backdrop-blur-md p-4 md:p-5 shadow-sm">'
                    + '<div class="absolute left-0 top-0 bottom-0 w-1 ' + sc.bar + '"></div>'
                    + '<div class="flex items-start gap-3 pl-2">'
                    + '<div class="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">'
                    + '<i class="ph ph-warning-circle text-xl"></i></div>'
                    + '<div class="min-w-0 flex-1">'
                    + '<div class="flex flex-wrap items-center gap-2 mb-1">'
                    + '<p class="text-sm font-bold text-slate-900">' + esc(a.title) + '</p>'
                    + '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ' + sc.badge + '">'
                    + esc(a.severity || 'medium') + '</span></div>'
                    + '<p class="text-xs text-slate-600 leading-relaxed">' + esc(a.detail) + '</p>'
                    + (a.action ? '<p class="text-xs font-bold text-teal-700 mt-2">建议：' + esc(a.action) + '</p>' : '')
                    + '</div></div></div>';
            });
            html += '</div>';
        }
        html += '</section>';

        function tipSection(title, tips, icon) {
            var s = '<section class="mb-10"><div class="flex items-center gap-2 mb-4">'
                + '<span class="w-1.5 h-6 bg-teal-500 rounded-full"></span>'
                + '<h3 class="text-lg font-bold text-slate-800">' + esc(title) + '</h3></div>';
            if (!tips.length) {
                s += '<p class="text-sm text-slate-400">暂无该项建议。</p></section>';
                return s;
            }
            s += '<div class="space-y-3">';
            tips.forEach(function (t) {
                s += '<div class="p-4 rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-sm shadow-sm">'
                    + '<div class="flex items-start gap-3"><i class="ph ' + icon + ' text-teal-600 text-xl mt-0.5"></i>'
                    + '<div><p class="text-sm font-bold text-slate-800 mb-1">' + esc(t.title) + '</p>'
                    + '<p class="text-xs text-slate-500 leading-relaxed">' + esc(t.detail) + '</p>'
                    + (t.action ? '<p class="text-xs font-bold text-teal-700 mt-2">' + esc(t.action) + '</p>' : '')
                    + '</div></div></div>';
            });
            s += '</div></section>';
            return s;
        }

        html += tipSection('利润优化', profitTips, 'ph-trend-up');
        html += tipSection('效率与回款', effTips, 'ph-clock-countdown');

        html += '<section class="mb-4"><div class="flex items-center gap-2 mb-4">'
            + '<span class="w-1.5 h-6 bg-teal-500 rounded-full"></span>'
            + '<h3 class="text-lg font-bold text-slate-800">展望与规划</h3></div>'
            + '<div class="p-5 rounded-2xl bg-gradient-to-br from-teal-900 to-slate-900 text-white shadow-lg relative overflow-hidden">'
            + '<div class="absolute -right-4 -top-4 opacity-10"><i class="ph ph-rocket-launch text-6xl"></i></div>'
            + '<p class="text-xs font-bold text-teal-300 mb-2 uppercase tracking-wider">AI 规划建议</p>'
            + '<p class="text-sm font-medium leading-relaxed mb-3">' + esc(outlook.headline || meta.summary || '—') + '</p>';
        var sugg = Array.isArray(outlook.suggestions) ? outlook.suggestions : [];
        if (sugg.length) {
            html += '<ul class="text-xs text-teal-50/90 space-y-1 list-disc pl-4">';
            sugg.forEach(function (x) { html += '<li>' + esc(x) + '</li>'; });
            html += '</ul>';
        }
        html += '</div></section>';

        body.innerHTML = html;
        showBizLoading(false);
    }

    function openAIAnalysis(opts) {
        opts = opts || {};
        var modal = document.getElementById('ai-modal');
        openModal(modal);
        showBizLoading(true, '正在加载经营分析…');
        var regenerate = !!opts.regenerate;

        var run = regenerate
            ? Promise.resolve(fetchJson('/api/v1/ai/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opType: OP_BIZ, regenerate: true })
            }))
            : fetchJson('/api/v1/ai/reports/latest?opType=' + OP_BIZ, { method: 'GET' })
                .then(function (latest) {
                    if (latest && latest.exists && latest.status === 'SUCCESS' && latest.report) {
                        return latest;
                    }
                    if (latest && latest.exists && latest.status === 'EXTRACTING' && latest.requestId) {
                        return latest;
                    }
                    return fetchJson('/api/v1/ai/reports/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ opType: OP_BIZ, regenerate: false })
                    });
                });

        run.then(function (data) {
            if (!data || data.success === false) {
                throw new Error((data && data.message) || '请求失败');
            }
            if (data.status === 'SUCCESS' && data.report) {
                renderBizReport(data.report);
                return;
            }
            if (data.requestId) {
                state.bizRequestId = data.requestId;
                showBizLoading(true, 'AI 正在分析经营数据，请稍候…');
                pollUntilDone(data.requestId, function (report) {
                    renderBizReport(report);
                }, function (err) {
                    showBizLoading(false);
                    var body = document.getElementById('biz-ai-report-body');
                    if (body) {
                        body.classList.remove('hidden');
                        body.innerHTML = '<p class="text-sm text-rose-600 text-center py-10">'
                            + esc(err.message || '生成失败') + '</p>';
                    }
                    toast(err.message || '生成失败', 'error');
                });
                return;
            }
            throw new Error('未返回有效结果');
        }).catch(function (err) {
            showBizLoading(false);
            toast(err.message || '加载失败', 'error');
            var body = document.getElementById('biz-ai-report-body');
            if (body) {
                body.classList.remove('hidden');
                body.innerHTML = '<p class="text-sm text-rose-600 text-center py-10">'
                    + esc(err.message || '加载失败') + '</p>';
            }
        });
    }

    function regenerateAIAnalysis() {
        var msg = '将重新拉取最新商户数据并生成报告，可能消耗 AI 额度。确认？';
        if (global.TM_UI && typeof global.TM_UI.confirm === 'function') {
            Promise.resolve(global.TM_UI.confirm({ message: msg, title: '重新生成' })).then(function (ok) {
                if (ok) openAIAnalysis({ regenerate: true });
            });
            return;
        }
        if (window.confirm(msg)) {
            openAIAnalysis({ regenerate: true });
        }
    }

    function closeAIAnalysis() {
        stopPoll();
        closeModal(document.getElementById('ai-modal'));
    }

    /* ---------- 促销方案 ---------- */

    var GOAL_DEFS = [
        { code: 'CLEAR_STOCK', label: '清库存', desc: '优先处理积压与慢周转' },
        { code: 'NEW_PRODUCT', label: '新品推广', desc: '用组合/赠品带动新品' },
        { code: 'CASH_IN', label: '回笼资金', desc: '侧重大客户与折扣节奏' },
        { code: 'FESTIVAL', label: '节日大促', desc: '结合季节与临近节日' }
    ];

    function openPromoGoalModal() {
        var modal = document.getElementById('promo-goal-modal');
        var list = document.getElementById('promo-goal-list');
        if (list) {
            list.innerHTML = GOAL_DEFS.map(function (g) {
                var on = state.promoGoals.indexOf(g.code) >= 0;
                return '<label class="flex items-start gap-3 p-3 rounded-2xl border '
                    + (on ? 'border-teal-300 bg-teal-50/80' : 'border-slate-100 hover:border-teal-200')
                    + ' cursor-pointer backdrop-blur-sm">'
                    + '<input type="checkbox" class="mt-1 w-4 h-4 accent-teal-600" data-goal="' + g.code + '" '
                    + (on ? 'checked' : '') + ' onchange="window.TM_BizAI.togglePromoGoal(this)">'
                    + '<div><p class="text-sm font-bold text-slate-800">' + esc(g.label) + '</p>'
                    + '<p class="text-[11px] text-slate-400 mt-0.5">' + esc(g.desc) + '</p></div></label>';
            }).join('');
        }
        openModal(modal);
    }

    function togglePromoGoal(el) {
        var code = el.getAttribute('data-goal');
        var idx = state.promoGoals.indexOf(code);
        if (el.checked && idx < 0) state.promoGoals.push(code);
        else if (!el.checked && idx >= 0) state.promoGoals.splice(idx, 1);
        openPromoGoalModal();
    }

    function closePromoGoalModal() {
        closeModal(document.getElementById('promo-goal-modal'));
    }

    function confirmPromoGoalsAndPickProducts() {
        if (!state.promoGoals.length) {
            toast('请至少选择一个促销目标', 'warning');
            return;
        }
        closePromoGoalModal();
        if (typeof global.openPromoProductPickerModal === 'function') {
            global.openPromoProductPickerModal();
        } else {
            toast('选品组件未加载', 'error');
        }
    }

    function showPromoLoading(show, text) {
        var loading = document.getElementById('promo-ai-loading');
        var body = document.getElementById('promo-ai-report-body');
        if (loading) {
            loading.classList.toggle('hidden', !show);
            var t = loading.querySelector('[data-promo-ai-loading-text]');
            if (t && text) t.textContent = text;
        }
        if (body) body.classList.toggle('hidden', !!show);
    }

    function renderPromoReport(report) {
        var body = document.getElementById('promo-ai-report-body');
        if (!body) return;
        report = report || {};
        var meta = report.meta || {};
        var diagnosis = report.diagnosis || {};
        var plans = Array.isArray(report.plans) ? report.plans : [];

        var namesEl = document.getElementById('promo-plan-target-names');
        if (namesEl) {
            var names = Array.isArray(meta.product_names) ? meta.product_names.join('、') : '';
            namesEl.textContent = names
                ? ('目标：' + (meta.goals || state.promoGoals).join('/') + ' · ' + names)
                : (meta.summary || 'AI 促销方案');
        }

        var risk = String(diagnosis.risk_level || 'medium').toLowerCase();
        var riskCls = risk === 'high' ? 'bg-rose-50 border-rose-100 text-rose-700'
            : (risk === 'low' ? 'bg-teal-50 border-teal-100 text-teal-800' : 'bg-amber-50 border-amber-100 text-amber-800');

        var html = '<section class="mb-8">'
            + '<h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">'
            + '<span class="w-1.5 h-6 bg-teal-500 rounded-full"></span> 风险诊断</h3>'
            + '<div class="p-5 rounded-[1.5rem] border backdrop-blur-md text-sm leading-relaxed font-medium '
            + riskCls + '">' + esc(diagnosis.text || meta.summary || '—') + '</div></section>';

        html += '<section><h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">'
            + '<span class="w-1.5 h-6 bg-teal-500 rounded-full"></span> 推荐方案（任选其一执行）</h3>'
            + '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

        if (!plans.length) {
            html += '<p class="text-sm text-slate-400 col-span-full">暂无方案，请重新生成。</p>';
        }

        plans.slice(0, 3).forEach(function (plan, idx) {
            var effect = plan.expected_effect || {};
            var scripts = Array.isArray(plan.wechat_scripts) ? plan.wechat_scripts : [];
            var rules = Array.isArray(plan.pricing_rules) ? plan.pricing_rules : [];
            html += '<div class="flex flex-col p-5 border border-slate-200 rounded-[1.5rem] bg-white/85 backdrop-blur-sm shadow-sm hover:border-teal-300 transition-colors">'
                + '<p class="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">方案 ' + (idx + 1) + '</p>'
                + '<p class="text-sm font-black text-slate-900 mb-2">' + esc(plan.name || ('方案' + (idx + 1))) + '</p>'
                + '<p class="text-[11px] text-slate-500 mb-3 leading-relaxed">'
                + esc((rules[0] && (rules[0].tactic + (rules[0].note ? ' — ' + rules[0].note : ''))) || plan.theme || '')
                + '</p>';
            if (scripts[0]) {
                html += '<div class="text-[11px] bg-slate-50 rounded-xl p-3 text-slate-600 italic mb-3 flex-1">'
                    + esc(scripts[0].text) + '</div>';
            }
            html += '<div class="text-[10px] text-slate-400 space-y-1 mb-4">'
                + '<p>预计回笼 ' + formatMoney(effect.cash_back_estimate) + '</p>'
                + '<p>释放仓位约 ' + esc(effect.warehouse_release_pct != null ? effect.warehouse_release_pct + '%' : '—')
                + ' · 毛利底线 ' + esc(effect.gross_margin_floor_pct != null ? effect.gross_margin_floor_pct + '%' : '—') + '</p></div>'
                + '<button type="button" class="mt-auto w-full py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold"'
                + ' onclick="window.TM_BizAI.selectPromoPlan(' + idx + ')">选用此方案</button></div>';
        });
        html += '</div></section>';
        body.innerHTML = html;
        showPromoLoading(false);
        body._tmPromoReport = report;
    }

    function selectPromoPlan(idx) {
        var body = document.getElementById('promo-ai-report-body');
        var report = body && body._tmPromoReport;
        var plan = report && Array.isArray(report.plans) ? report.plans[idx] : null;
        if (!plan) {
            toast('方案无效', 'warning');
            return;
        }
        toast('已记录选用「' + (plan.name || ('方案' + (idx + 1))) + '」。一键改价/公告将在后续版本开放。', 'success');
        closeClearanceModal();
    }

    function openClearanceModalWithGenerate(productIds, regenerate) {
        var ids = Array.isArray(productIds) ? productIds : (global._promoSelectedProductIds || []);
        state.promoProductIds = ids.map(Number).filter(function (n) { return n > 0; });
        var modal = document.getElementById('clearance-modal');
        openModal(modal);
        showPromoLoading(true, 'AI 正在生成促销方案…');

        var qsGoals = state.promoGoals.join(',');
        var qsProducts = state.promoProductIds.join(',');
        var latestUrl = '/api/v1/ai/reports/latest?opType=' + OP_PROMO
            + '&goals=' + encodeURIComponent(qsGoals)
            + '&productIds=' + encodeURIComponent(qsProducts);

        var run = regenerate
            ? Promise.resolve(null)
            : fetchJson(latestUrl, { method: 'GET' });

        run.then(function (latest) {
            if (latest && latest.exists && latest.status === 'SUCCESS' && latest.report && !regenerate) {
                return latest;
            }
            if (latest && latest.exists && latest.status === 'EXTRACTING' && latest.requestId && !regenerate) {
                return latest;
            }
            return fetchJson('/api/v1/ai/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    opType: OP_PROMO,
                    regenerate: !!regenerate,
                    goals: state.promoGoals,
                    productIds: state.promoProductIds
                })
            });
        }).then(function (data) {
            if (!data || data.success === false) {
                throw new Error((data && data.message) || '生成失败');
            }
            if (data.status === 'SUCCESS' && data.report) {
                renderPromoReport(data.report);
                return;
            }
            if (data.requestId) {
                state.promoRequestId = data.requestId;
                showPromoLoading(true, 'AI 正在精算促销方案，请稍候…');
                pollUntilDone(data.requestId, function (report) {
                    renderPromoReport(report);
                }, function (err) {
                    showPromoLoading(false);
                    var body = document.getElementById('promo-ai-report-body');
                    if (body) {
                        body.classList.remove('hidden');
                        body.innerHTML = '<p class="text-sm text-rose-600 text-center py-10">'
                            + esc(err.message || '生成失败') + '</p>';
                    }
                    toast(err.message || '生成失败', 'error');
                });
                return;
            }
            throw new Error('未返回有效结果');
        }).catch(function (err) {
            showPromoLoading(false);
            toast(err.message || '加载失败', 'error');
        });
    }

    function regeneratePromoPlan() {
        openClearanceModalWithGenerate(state.promoProductIds, true);
    }

    function closeClearanceModal() {
        stopPoll();
        closeModal(document.getElementById('clearance-modal'));
    }

    function startPromoFlow() {
        state.promoGoals = [];
        // 嵌入 iframe 时优先走父壳的选品与弹窗（目标→选品→方案均在主壳）
        try {
            if (global.parent && global.parent !== global && global.parent.TM_BizAI
                && typeof global.parent.TM_BizAI.openPromoGoalModal === 'function'
                && global.parent.document.getElementById('promo-goal-modal')) {
                if (typeof global.parent.TM_BizAI.setPromoGoals === 'function') {
                    global.parent.TM_BizAI.setPromoGoals([]);
                }
                global.parent.TM_BizAI.openPromoGoalModal();
                return;
            }
        } catch (e) { /* ignore */ }
        openPromoGoalModal();
    }

    var api = {
        openAIAnalysis: openAIAnalysis,
        closeAIAnalysis: closeAIAnalysis,
        regenerateAIAnalysis: regenerateAIAnalysis,
        openPromoGoalModal: openPromoGoalModal,
        closePromoGoalModal: closePromoGoalModal,
        togglePromoGoal: togglePromoGoal,
        confirmPromoGoalsAndPickProducts: confirmPromoGoalsAndPickProducts,
        openClearanceModalWithGenerate: openClearanceModalWithGenerate,
        regeneratePromoPlan: regeneratePromoPlan,
        closeClearanceModal: closeClearanceModal,
        selectPromoPlan: selectPromoPlan,
        startPromoFlow: startPromoFlow,
        getPromoGoals: function () { return state.promoGoals.slice(); },
        setPromoGoals: function (g) { state.promoGoals = Array.isArray(g) ? g.slice() : []; }
    };

    global.TM_BizAI = api;
    global.openAIAnalysis = openAIAnalysis;
    global.closeAIAnalysis = closeAIAnalysis;
    global.openPromoGoalModal = openPromoGoalModal;
    global.closePromoGoalModal = closePromoGoalModal;
    global.closeClearanceModal = closeClearanceModal;
})(window);
