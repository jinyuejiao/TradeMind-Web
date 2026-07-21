/**
 * 获客极速经营诊断答卷
 * - 独立页 biz-diag.html：整页答卷
 * - 主壳 index-app：#biz-diag-survey-modal 弹窗答卷，提交后打开 AI 经营分析弹窗展示报告
 */
(function (global) {
    'use strict';

    var PROCESSES = [
        { key: 'face_order', label: '当面开单' },
        { key: 'post_bookkeeping', label: '事后补账/对账' },
        { key: 'stock_find', label: '找货理库存' },
        { key: 'collect_debt', label: '跟客催款' },
        { key: 'purchase_decide', label: '进货决策' }
    ];

    var MODE_OPTS = [
        { value: 'SYSTEM', label: '已用系统/工具' },
        { value: 'WECHAT_SHEET', label: '微信/表格' },
        { value: 'MANUAL', label: '黑本/口头/人脑' }
    ];

    var TIME_OPTS = PROCESSES.map(function (p) {
        return { value: p.key, label: p.label };
    });

    var PAIN_OPTS = [
        { value: 'CHAOS_ACCOUNT', label: '账目乱、对不上' },
        { value: 'STOCK_UNCLEAR', label: '库存心里没数' },
        { value: 'DEBT_HARD', label: '欠款难催' },
        { value: 'ORDER_SLOW', label: '开单慢、容易错' },
        { value: 'HANDOVER_MESS', label: '交接靠口头易丢' },
        { value: 'PURCHASE_GUESS', label: '进货全凭感觉' },
        { value: 'CUSTOMER_LOST', label: '老客沉默/流失' }
    ];

    var VOLUME_OPTS = [
        { value: 'LT10', label: '不到 10 单' },
        { value: '10_30', label: '10～30 单' },
        { value: '30_100', label: '30～100 单' },
        { value: 'GT100', label: '100 单以上' }
    ];

    var state = { fieldsReady: false, openedOnce: false };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function isModalMode() {
        return !!document.getElementById('biz-diag-survey-modal');
    }

    function openModal(el) {
        if (!el) return;
        if (el.parentNode !== document.body) document.body.appendChild(el);
        el.style.setProperty('z-index', '330', 'important');
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

    function renderChoiceGroup(container, name, options, multi, maxPick) {
        if (!container) return;
        var html = '';
        options.forEach(function (o) {
            html += '<label class="tm-chip">'
                + '<input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + esc(name)
                + '" value="' + esc(o.value) + '" class="sr-only"'
                + (multi && maxPick ? ' data-max="' + maxPick + '"' : '') + '>'
                + '<span>' + esc(o.label) + '</span></label>';
        });
        container.innerHTML = html;
        if (multi && maxPick) {
            container.addEventListener('change', function () {
                var checked = container.querySelectorAll('input:checked');
                if (checked.length > maxPick) {
                    var last = checked[checked.length - 1];
                    if (last) last.checked = false;
                }
            });
        }
    }

    function renderAutomation(container) {
        if (!container) return;
        var html = '';
        PROCESSES.forEach(function (p) {
            html += '<div><p class="text-xs font-bold text-slate-700 mb-2">' + esc(p.label) + '</p>'
                + '<div class="flex flex-wrap gap-2">';
            MODE_OPTS.forEach(function (m) {
                html += '<label class="tm-chip">'
                    + '<input type="radio" name="auto_' + esc(p.key) + '" value="' + esc(m.value) + '" class="sr-only">'
                    + '<span>' + esc(m.label) + '</span></label>';
            });
            html += '</div></div>';
        });
        container.innerHTML = html;
    }

    function ensureFields() {
        if (state.fieldsReady) return;
        if (!document.getElementById('automation-fields')) return;
        renderAutomation(document.getElementById('automation-fields'));
        renderChoiceGroup(document.getElementById('time-energy-fields'), 'time_energy', TIME_OPTS, true, 2);
        renderChoiceGroup(document.getElementById('pain-fields'), 'pain_points', PAIN_OPTS, true, 3);
        renderChoiceGroup(document.getElementById('volume-fields'), 'daily_volume', VOLUME_OPTS, false);
        state.fieldsReady = true;
    }

    function selectedValues(name) {
        return Array.prototype.map.call(
            document.querySelectorAll('input[name="' + name + '"]:checked'),
            function (el) { return el.value; }
        );
    }

    function selectedOne(name) {
        var el = document.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value : '';
    }

    function collectQuestionnaire() {
        var automation = {};
        PROCESSES.forEach(function (p) {
            automation[p.key] = selectedOne('auto_' + p.key) || 'MANUAL';
        });
        return {
            automation: automation,
            time_energy_top: selectedValues('time_energy'),
            pain_points: selectedValues('pain_points'),
            daily_order_band: selectedOne('daily_volume') || '10_30',
            notes: (document.getElementById('diag-notes') || {}).value || '',
            process_labels: PROCESSES.reduce(function (acc, p) {
                acc[p.key] = p.label;
                return acc;
            }, {})
        };
    }

    function validateSurvey(q) {
        var missingAuto = PROCESSES.some(function (p) {
            return !selectedOne('auto_' + p.key);
        });
        if (missingAuto) return '请为每个经营环节选择当前做法';
        if (!q.time_energy_top.length) return '请选择时间和精力主要消耗在哪些环节（最多 2 项）';
        if (!q.pain_points.length) return '请至少勾选一个主痛点';
        if (!q.daily_order_band) return '请选择大概日开单量';
        return '';
    }

    function notify(msg, type) {
        if (global.TM_UI && typeof global.TM_UI.showNotification === 'function') {
            global.TM_UI.showNotification(msg, type || 'warning');
            return;
        }
        alert(msg);
    }

    function clearAcqHash() {
        try {
            var hash = String(location.hash || '');
            if (hash.indexOf('acqSurvey') < 0) return;
            var next = hash
                .replace(/([?&])acqSurvey=1&?/, '$1')
                .replace(/&$/, '')
                .replace(/\?$/, '')
                .replace(/#$/, '');
            if (!next || next === '#') next = '#tab=dashboard';
            history.replaceState(null, '', location.pathname + location.search + next);
        } catch (e) { /* ignore */ }
    }

    function enterApp() {
        if (typeof global.tmMarkBizDiagAcqDone === 'function') global.tmMarkBizDiagAcqDone();
        clearAcqHash();
        if (isModalMode()) {
            closeModal(document.getElementById('biz-diag-survey-modal'));
            return;
        }
        var path = typeof getAppEntryPath === 'function'
            ? getAppEntryPath('dashboard')
            : 'index-app.html#tab=dashboard';
        global.location.href = path;
    }

    function openSurveyModal() {
        ensureFields();
        var modal = document.getElementById('biz-diag-survey-modal');
        if (!modal) return false;
        if (typeof global.tmClearAcqIntent === 'function') global.tmClearAcqIntent();
        clearAcqHash();
        openModal(modal);
        state.openedOnce = true;
        return true;
    }

    function closeSurveyModal() {
        closeModal(document.getElementById('biz-diag-survey-modal'));
    }

    function showStandaloneSurvey() {
        var s = document.getElementById('survey-panel');
        var r = document.getElementById('report-panel');
        if (s) s.classList.remove('hidden');
        if (r) r.classList.add('hidden');
    }

    function showStandaloneReport() {
        var s = document.getElementById('survey-panel');
        var r = document.getElementById('report-panel');
        if (s) s.classList.add('hidden');
        if (r) r.classList.remove('hidden');
    }

    function submitSurvey(e) {
        if (e && e.preventDefault) e.preventDefault();
        var q = collectQuestionnaire();
        var err = validateSurvey(q);
        if (err) {
            notify(err, 'warning');
            return;
        }
        if (!global.TM_BizAI || typeof global.TM_BizAI.generateFromQuestionnaire !== 'function') {
            notify('报告组件未加载', 'error');
            return;
        }

        if (isModalMode()) {
            closeSurveyModal();
            if (typeof global.TM_BizAI.openAIAnalysisShell === 'function') {
                global.TM_BizAI.openAIAnalysisShell();
            } else {
                var aiModal = document.getElementById('ai-modal');
                if (aiModal) openModal(aiModal);
            }
            global.TM_BizAI.generateFromQuestionnaire(q, {
                onDone: function () {
                    if (typeof global.tmMarkBizDiagAcqDone === 'function') global.tmMarkBizDiagAcqDone();
                }
            });
            return;
        }

        showStandaloneReport();
        global.TM_BizAI.generateFromQuestionnaire(q, {
            onDone: function () {
                if (typeof global.tmMarkBizDiagAcqDone === 'function') global.tmMarkBizDiagAcqDone();
            }
        });
    }

    function shouldAutoOpenSurvey() {
        try {
            var hash = String(location.hash || '');
            if (/[?&]acqSurvey=1(?:&|$)/.test(hash) || /(?:^|[&#])acqSurvey=1(?:&|$)/.test(hash)) {
                return true;
            }
            // 兼容 #tab=dashboard&acqSurvey=1
            if (hash.indexOf('acqSurvey=1') >= 0) return true;
        } catch (e) { /* ignore */ }
        try {
            if (typeof global.tmHasPendingBizDiagAcq === 'function' && global.tmHasPendingBizDiagAcq()) {
                return true;
            }
        } catch (e2) { /* ignore */ }
        return false;
    }

    function bootModalShell() {
        ensureFields();
        var form = document.getElementById('biz-diag-form');
        if (form && !form.getAttribute('data-biz-diag-bound')) {
            form.setAttribute('data-biz-diag-bound', '1');
            form.addEventListener('submit', submitSurvey);
        }
        var btn = document.getElementById('btn-submit-diag');
        if (btn && !btn.getAttribute('data-biz-diag-bound')) {
            btn.setAttribute('data-biz-diag-bound', '1');
            // onclick 已在 HTML；此处兜底
        }
        if (shouldAutoOpenSurvey()) {
            setTimeout(function () { openSurveyModal(); }, 400);
        }
    }

    function bootStandalonePage() {
        if (typeof global.checkAuth === 'function') {
            var token = '';
            try { token = localStorage.getItem('token') || ''; } catch (e) { /* ignore */ }
            if (!token) {
                try {
                    if (!sessionStorage.getItem('tm_acq_intent')) {
                        sessionStorage.setItem('tm_acq_intent', global.TM_ACQ_BIZ_DIAG || 'biz_diag');
                    }
                } catch (e2) { /* ignore */ }
                global.checkAuth();
                return;
            }
            global.checkAuth();
        }

        if (typeof global.tmClearAcqIntent === 'function') global.tmClearAcqIntent();
        ensureFields();

        var form = document.getElementById('biz-diag-form');
        if (form) form.addEventListener('submit', submitSurvey);
        var skip = document.getElementById('btn-skip-diag');
        if (skip) skip.addEventListener('click', enterApp);
        var enter = document.getElementById('btn-enter-app');
        if (enter) enter.addEventListener('click', enterApp);
        var back = document.getElementById('btn-back-survey');
        if (back) back.addEventListener('click', showStandaloneSurvey);
    }

    function boot() {
        if (isModalMode()) bootModalShell();
        else if (document.getElementById('biz-diag-form')) bootStandalonePage();
    }

    global.TM_BizDiag = {
        openSurveyModal: openSurveyModal,
        closeSurveyModal: closeSurveyModal,
        submitSurvey: submitSurvey,
        skipToApp: enterApp,
        collectQuestionnaire: collectQuestionnaire
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
