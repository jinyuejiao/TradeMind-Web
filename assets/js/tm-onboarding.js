/**
 * TradeMind — 批发商版首次用户导览（角色感知 · PC/手机统一）
 * 依赖：ui-permissions.js、tm-onboarding-registry.js
 */
(function () {
    'use strict';

    var REG = function () { return window.TM_ONBOARDING_REGISTRY; };
    var LEGACY_STORAGE_KEY = 'tm_onboarding_wholesale_v1';
    var MERCHANT_LABEL = '批发商户';

    var VOICE_EXAMPLES = [
        '华强北李总批发矿泉水 200 箱，总价 8600 元',
        '义乌王姐批发洗衣液 50 件，总价 3750 元',
        '杭州张老板批发大米 10 吨，总价 42000 元'
    ];

    var state = null;
    var roleCode = 'ADMIN';
    var mandatoryProfile = null;
    var blockingAllowedTabs = [];
    var root = null;
    var spotlight = null;
    var popover = null;
    var backdrop = null;
    var active = false;
    var blocking = false;
    var currentTourStep = null;
    var mandatoryStepIndex = 0;
    var voiceExampleIndex = 0;
    var checklistOpen = false;
    var roleUiReady = false;
    var onboardingBootstrapped = false;
    var welcomeScheduled = false;
    var voiceModalObserver = null;
    var completingVoice = false;
    var voiceStepRestartLock = false;
    var voicePhase = 'idle';
    var voiceOverlaySyncLock = false;
    var voiceLastCloseReason = null;
    var voiceActiveStep = null;
    var isFirstLogin = false;
    var serverHydrated = false;

    function $(id) {
        return document.getElementById(id);
    }

    function registry() {
        return REG();
    }

    function getIndustry() {
        try {
            return String(
                (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.industry) ||
                localStorage.getItem('tm_tenant_merchant_type') ||
                'WHOLESALE'
            ).toUpperCase();
        } catch (e) {
            return 'WHOLESALE';
        }
    }

    function refreshRoleContext() {
        var r = registry();
        if (!r) return;
        roleCode = r.resolveRoleCode();
        mandatoryProfile = r.getMandatoryProfile(roleCode);
        blockingAllowedTabs = r.getBlockingAllowedTabs(mandatoryProfile);
    }

    function storageKey() {
        return registry().getStorageKey(getIndustry(), roleCode);
    }

    function getMerchantDisplayLabel() {
        try {
            var type = getIndustry();
            var map = { WHOLESALE: '批发商户', FOREIGN: '外贸商户', ECOM: '电商商户', FACTORY: '工贸一体商户' };
            if (map[type]) return map[type];
            var name = localStorage.getItem('tm_tenant_merchant_display_name');
            return name ? name : MERCHANT_LABEL;
        } catch (e) {
            return MERCHANT_LABEL;
        }
    }

    function defaultState() {
        return {
            version: 3,
            schemaVersion: '2026.05',
            profileId: mandatoryProfile ? mandatoryProfile.id : null,
            welcomed: false,
            mandatoryDone: false,
            celebrated: false,
            dismissed: false,
            checklist: {},
            lastChecklistId: null,
            mandatoryStepIndex: 0,
            updatedAt: new Date().toISOString()
        };
    }

    function parseStoredState(raw) {
        var o = JSON.parse(raw);
        var base = defaultState();
        base.welcomed = !!o.welcomed;
        base.mandatoryDone = !!(o.mandatoryDone || o.voiceDone);
        base.celebrated = !!o.celebrated;
        base.dismissed = !!o.dismissed;
        base.checklist = o.checklist && typeof o.checklist === 'object' ? o.checklist : {};
        base.lastChecklistId = o.lastChecklistId || null;
        base.mandatoryStepIndex = typeof o.mandatoryStepIndex === 'number' ? o.mandatoryStepIndex : 0;
        base.profileId = o.profileId || (mandatoryProfile && mandatoryProfile.id);
        base.updatedAt = o.updatedAt || base.updatedAt;
        return base;
    }

    function loadStateLocalOnly() {
        refreshRoleContext();
        var key = storageKey();
        try {
            var raw = localStorage.getItem(key);
            if (!raw) {
                var legacyKey = registry().getLegacyStorageKey(getIndustry(), roleCode);
                raw = localStorage.getItem(legacyKey);
            }
            if (!raw) {
                var migrated = registry().migrateLegacyState(roleCode);
                if (migrated) {
                    var base = defaultState();
                    base.welcomed = migrated.welcomed;
                    base.mandatoryDone = migrated.mandatoryDone;
                    base.celebrated = migrated.celebrated;
                    base.dismissed = migrated.dismissed;
                    base.checklist = migrated.checklist;
                    base.lastChecklistId = migrated.lastChecklistId;
                    return base;
                }
                return defaultState();
            }
            return parseStoredState(raw);
        } catch (e) {
            return defaultState();
        }
    }

    function loadState() {
        if (!state) {
            state = loadStateLocalOnly();
        }
        return state;
    }

    function mergeSnapshot(local, remote) {
        var a = local || defaultState();
        var b = remote && typeof remote === 'object' ? remote : {};
        var out = defaultState();
        out.mandatoryDone = !!(a.mandatoryDone || b.mandatoryDone);
        out.welcomed = out.mandatoryDone || !!(a.welcomed || b.welcomed);
        out.celebrated = !!(a.celebrated || b.celebrated);
        out.dismissed = !!(a.dismissed && b.dismissed);
        out.checklist = {};
        var keys = {};
        Object.keys(a.checklist || {}).forEach(function (k) { keys[k] = true; });
        Object.keys(b.checklist || {}).forEach(function (k) { keys[k] = true; });
        Object.keys(keys).forEach(function (k) {
            out.checklist[k] = !!(a.checklist[k] || b.checklist[k]);
        });
        out.lastChecklistId = b.lastChecklistId || a.lastChecklistId || null;
        out.mandatoryStepIndex = Math.max(
            typeof a.mandatoryStepIndex === 'number' ? a.mandatoryStepIndex : 0,
            typeof b.mandatoryStepIndex === 'number' ? b.mandatoryStepIndex : 0
        );
        out.profileId = b.profileId || a.profileId || (mandatoryProfile && mandatoryProfile.id);
        var ta = Date.parse(a.updatedAt || 0) || 0;
        var tb = Date.parse(b.updatedAt || 0) || 0;
        var newer = tb >= ta ? b : a;
        if (newer.lastChecklistId) out.lastChecklistId = newer.lastChecklistId;
        out.updatedAt = new Date().toISOString();
        return out;
    }

    function hydrateFromServer() {
        var sync = window.TM_ONBOARDING_SYNC;
        var bootstrap = sync && sync.readLoginBootstrap ? sync.readLoginBootstrap() : null;
        if (bootstrap && typeof bootstrap.isFirstLogin === 'boolean') {
            isFirstLogin = bootstrap.isFirstLogin;
        }
        var local = loadStateLocalOnly();
        if (bootstrap && bootstrap.mandatoryDone) {
            local = mergeSnapshot(local, {
                mandatoryDone: true,
                welcomed: true,
                celebrated: !!bootstrap.celebrated
            });
            isFirstLogin = false;
        }
        if (!sync || typeof sync.fetchState !== 'function') {
            state = local;
            serverHydrated = true;
            return Promise.resolve();
        }
        var markFirstLogin = !local.mandatoryDone;
        return sync.fetchState(markFirstLogin).then(function (resp) {
            if (resp && typeof resp.isFirstLogin === 'boolean') {
                isFirstLogin = resp.isFirstLogin;
            }
            if (resp && resp.snapshot) {
                state = mergeSnapshot(local, resp.snapshot);
            } else {
                state = local;
            }
            try {
                localStorage.setItem(storageKey(), JSON.stringify(state));
            } catch (e) { /* ignore */ }
            serverHydrated = true;
        }).catch(function () {
            state = local;
            serverHydrated = true;
        });
    }

    function saveState() {
        if (!state) return;
        try {
            state.profileId = mandatoryProfile ? mandatoryProfile.id : state.profileId;
            state.updatedAt = new Date().toISOString();
            state.mandatoryStepIndex = mandatoryStepIndex;
            localStorage.setItem(storageKey(), JSON.stringify(state));
            if (window.TM_ONBOARDING_SYNC && typeof window.TM_ONBOARDING_SYNC.schedulePut === 'function') {
                window.TM_ONBOARDING_SYNC.schedulePut(state);
            }
        } catch (e) { /* ignore */ }
    }

    function shouldRun() {
        if (getIndustry() !== 'WHOLESALE') return false;
        if (!registry()) return false;
        if (state.dismissed && state.mandatoryDone) return false;
        return true;
    }

    function getFilteredChecklist() {
        return registry().getFilteredChecklist(roleCode);
    }

    function getMandatoryStepCount() {
        if (!mandatoryProfile || !mandatoryProfile.steps) return 0;
        return mandatoryProfile.steps.length;
    }

    function isBlockingActive() {
        return blocking && !state.mandatoryDone;
    }

    function isTabAllowedWhileBlocking(tabId) {
        if (!isBlockingActive()) return true;
        return blockingAllowedTabs.indexOf(tabId) !== -1;
    }

    function getBlockingMessage() {
        var label = registry().getRoleLabel(roleCode);
        if (mandatoryProfile && mandatoryProfile.steps) {
            var step = mandatoryProfile.steps[mandatoryStepIndex];
            if (step && step.type === 'voice') {
                return '请先完成「' + label + '」必学引导：语音录入第一笔单';
            }
        }
        return '请先完成「' + label + '」必学引导';
    }

    function syncBlockingFromTour() {
        blocking = isBlockingActive();
        updateBlockBanner();
    }

    function ensureRoot() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'tm-onboarding-root';
        root.innerHTML =
            '<div class="tm-onboarding-backdrop" data-onb-backdrop></div>' +
            '<div class="tm-onboarding-spotlight hidden" data-onb-spotlight></div>' +
            '<div class="tm-onboarding-popover hidden" data-onb-popover></div>';
        document.body.appendChild(root);
        root = $('tm-onboarding-root');
        backdrop = root.querySelector('[data-onb-backdrop]');
        spotlight = root.querySelector('[data-onb-spotlight]');
        popover = root.querySelector('[data-onb-popover]');
    }

    function setActive(on) {
        active = on;
        ensureRoot();
        root.classList.toggle('tm-onboarding--active', on);
        root.classList.toggle('tm-onboarding--mobile', registry().isMobileLayout());
        syncBlockingFromTour();
        if (!on) hideSpotlight();
    }

    function updateBlockBanner() {
        var id = 'tm-onboarding-block-banner';
        var el = $(id);
        if (!blocking) {
            if (el) el.remove();
            return;
        }
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'tm-onboarding-block-banner';
            document.body.appendChild(el);
        }
        el.textContent = getBlockingMessage();
    }

    function hideSpotlight() {
        if (spotlight) spotlight.classList.add('hidden');
        if (popover) {
            popover.classList.add('hidden');
            popover.classList.remove('tm-onboarding-popover--dock-bottom');
        }
    }

    function waitMs(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function isDashboardVoiceReady() {
        var impl = window.__TM_dashboardVoice;
        if (impl && typeof impl.isReady === 'function') {
            return impl.isReady();
        }
        if (!impl || typeof impl.openVoiceModal !== 'function') {
            return false;
        }
        var inIndexAppShell = !!document.getElementById('tm-app-tabbar');
        if (inIndexAppShell && !window.__TM_DASHBOARD_INLINE_LOADED) {
            return false;
        }
        return true;
    }

    function waitForDashboardVoiceReady(maxMs) {
        maxMs = maxMs || 12000;
        var start = Date.now();
        return new Promise(function (resolve) {
            function tick() {
                if (isDashboardVoiceReady()) return resolve(true);
                if (Date.now() - start > maxMs) return resolve(false);
                requestAnimationFrame(tick);
            }
            tick();
        });
    }

    function setVoicePhase(phase) {
        voicePhase = phase || 'idle';
    }

    function isVoiceModalPhase() {
        return voicePhase === 'modal_open' || voicePhase === 'recording';
    }

    function isVoiceTourActive() {
        return currentTourStep === 'voice' && state && !state.mandatoryDone;
    }

    function setVoiceOverlaySyncLock(on) {
        voiceOverlaySyncLock = !!on;
    }

    function waitForTarget(stepDef, maxMs) {
        maxMs = maxMs || 8000;
        var start = Date.now();
        return new Promise(function (resolve) {
            function tick() {
                var el = registry().queryFirstTarget(stepDef);
                if (el) return resolve(el);
                if (Date.now() - start > maxMs) return resolve(null);
                requestAnimationFrame(tick);
            }
            tick();
        });
    }

    function scrollTargetIntoView(el) {
        if (!el) return;
        var container = document.getElementById('content-area');
        try {
            el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        } catch (e) {
            el.scrollIntoView(true);
        }
        if (container && container.scrollHeight > container.clientHeight) {
            var rect = el.getBoundingClientRect();
            var cRect = container.getBoundingClientRect();
            if (rect.top < cRect.top + 80 || rect.bottom > cRect.bottom - 80) {
                container.scrollTop += rect.top - cRect.top - 100;
            }
        }
    }

    function getCurrentTabId() {
        var sections = document.querySelectorAll('.view-section');
        var i;
        for (i = 0; i < sections.length; i++) {
            if (!sections[i].classList.contains('hidden')) {
                var id = sections[i].id;
                if (id && id.indexOf('view-') === 0) {
                    return id.slice(5);
                }
            }
        }
        return '';
    }

    function ensureTab(tabId) {
        return new Promise(function (resolve) {
            if (!registry().isMenuVisibleForRole(roleCode, tabId)) {
                tabId = registry().getFirstVisibleMenuId(roleCode);
            }
            if (typeof window.switchTab !== 'function') return resolve();
            if (getCurrentTabId() === tabId) {
                setTimeout(resolve, tabId === 'dashboard' ? 150 : 300);
                return;
            }
            window.switchTab(tabId);
            var delay = tabId === 'dashboard' ? 400 : 700;
            setTimeout(resolve, delay);
        });
    }

    function positionSpotlight(el, padding) {
        padding = padding == null ? (registry().isMobileLayout() ? 12 : 8) : padding;
        if (!el || !spotlight || !popover) return;
        scrollTargetIntoView(el);
        var rect = el.getBoundingClientRect();
        var top = Math.max(8, rect.top - padding);
        var left = Math.max(8, rect.left - padding);
        var w = Math.min(window.innerWidth - 16, rect.width + padding * 2);
        var h = Math.min(window.innerHeight - 16, rect.height + padding * 2);
        spotlight.classList.remove('hidden');
        spotlight.style.top = top + 'px';
        spotlight.style.left = left + 'px';
        spotlight.style.width = w + 'px';
        spotlight.style.height = h + 'px';

        popover.classList.remove('hidden');
        var mobile = registry().isMobileLayout();
        popover.classList.toggle('tm-onboarding-popover--dock-bottom', mobile);

        if (mobile) {
            popover.style.top = '';
            popover.style.left = '';
            popover.style.right = '';
            popover.style.bottom = '';
            return;
        }

        var popRect = popover.getBoundingClientRect();
        var popW = popRect.width || 300;
        var popH = popRect.height || 160;
        var popTop = top + h + 12;
        if (popTop + popH > window.innerHeight - 12) {
            popTop = Math.max(12, top - popH - 12);
        }
        var popLeft = Math.max(12, Math.min(left, window.innerWidth - popW - 12));
        popover.style.top = popTop + 'px';
        popover.style.left = popLeft + 'px';
    }

    function showPopover(opts) {
        ensureRoot();
        setActive(true);
        var stepLabel = opts.stepLabel || '';
        popover.innerHTML =
            (stepLabel ? '<div class="tm-onboarding-popover__step">' + stepLabel + '</div>' : '') +
            '<h4 class="tm-onboarding-popover__title">' + opts.title + '</h4>' +
            '<p class="tm-onboarding-popover__body">' + opts.body + '</p>' +
            '<div class="tm-onboarding-popover__actions" data-onb-actions></div>';
        var actions = popover.querySelector('[data-onb-actions]');
        (opts.buttons || []).forEach(function (b) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tm-onboarding-btn ' + (b.primary ? 'tm-onboarding-btn--primary' : b.ghost ? 'tm-onboarding-btn--ghost' : 'tm-onboarding-btn--link');
            btn.textContent = b.label;
            btn.addEventListener('click', function () {
                if (typeof b.onClick === 'function') b.onClick();
            });
            actions.appendChild(btn);
        });
        if (opts.target) {
            requestAnimationFrame(function () {
                positionSpotlight(opts.target, opts.padding);
            });
        } else {
            hideSpotlight();
        }
    }

    function closeTourUi() {
        setActive(false);
        currentTourStep = null;
        syncBlockingFromTour();
    }

    function getWelcomeMandatoryText() {
        if (mandatoryProfile && mandatoryProfile.welcomeMandatory) {
            return mandatoryProfile.welcomeMandatory;
        }
        return '了解与您角色匹配的核心功能';
    }

    function getWelcomeButtonLabel() {
        var n = getMandatoryStepCount();
        if (roleCode === 'READONLY' || n === 0) return '开始功能导览';
        return '开始 ' + n + ' 步必学引导';
    }

    function showWelcome() {
        ensureRoot();
        if (root.querySelector('[data-onb-welcome]')) return;
        blocking = false;
        updateBlockBanner();
        setActive(true);
        var wrap = document.createElement('div');
        wrap.className = 'tm-onboarding-welcome';
        wrap.setAttribute('data-onb-welcome', '1');
        var modules = getFilteredChecklist();
        var moduleHint = modules.map(function (m) { return m.label; }).slice(0, 4).join('、');
        var roleLabel = registry().getRoleLabel(roleCode);
        wrap.innerHTML =
            '<div class="tm-onboarding-welcome__card">' +
            '<div class="tm-onboarding-welcome__head">' +
            '<div class="w-12 h-12 mx-auto rounded-xl bg-brand-500/20 flex items-center justify-center"><i class="ph-bold ph-brain text-2xl text-brand-400"></i></div>' +
            '<h2>欢迎使用 TradeMind</h2>' +
            '<p>' + getMerchantDisplayLabel() + ' · ' + roleLabel + '</p>' +
            '</div>' +
            '<div class="tm-onboarding-welcome__body">' +
            '<ul class="tm-onboarding-welcome__list">' +
            '<li><i class="ph ph-microphone-stage"></i><span><strong>必学</strong>：' + getWelcomeMandatoryText() + '</span></li>' +
            '<li><i class="ph ph-list-checks"></i><span>完成后可自选学习：' + (moduleHint || '各可见模块') + '</span></li>' +
            '</ul>' +
            '<button type="button" class="tm-onboarding-btn tm-onboarding-btn--primary w-full" data-onb-start>' + getWelcomeButtonLabel() + '</button>' +
            '</div></div>';
        root.appendChild(wrap);
        wrap.querySelector('[data-onb-start]').addEventListener('click', function () {
            wrap.remove();
            state.welcomed = true;
            saveState();
            startMandatoryPath();
        });
    }

    function showVoiceTips(show) {
        var tips = $('voice-onboarding-tips');
        if (!tips) return;
        tips.classList.toggle('hidden', !show);
        if (show) updateVoiceExample(0);
    }

    function updateVoiceExample(idx) {
        voiceExampleIndex = idx % VOICE_EXAMPLES.length;
        var ex = $('voice-tip-example-text');
        if (ex) ex.textContent = '示例：' + VOICE_EXAMPLES[voiceExampleIndex];
        document.querySelectorAll('#voice-onboarding-tips .voice-tip-dot').forEach(function (d, i) {
            d.classList.toggle('is-active', i === voiceExampleIndex);
        });
    }

    function bindVoiceTipsUi() {
        var tips = $('voice-onboarding-tips');
        if (!tips || tips.getAttribute('data-bound')) return;
        tips.setAttribute('data-bound', '1');
        var dotsWrap = tips.querySelector('.voice-tip-dots');
        if (dotsWrap) {
            dotsWrap.innerHTML = '';
            VOICE_EXAMPLES.forEach(function (_, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'voice-tip-dot' + (i === 0 ? ' is-active' : '');
                dot.setAttribute('aria-label', '示例 ' + (i + 1));
                dot.addEventListener('click', function () { updateVoiceExample(i); });
                dotsWrap.appendChild(dot);
            });
        }
    }

    function mandatoryStepLabel(index) {
        var total = getMandatoryStepCount();
        if (total <= 0) return '必学';
        return '必学 ' + (index + 1) + '/' + total;
    }

    function runMandatoryStepAt(index) {
        if (!mandatoryProfile || !mandatoryProfile.steps || index >= mandatoryProfile.steps.length) {
            completeMandatoryPath();
            return;
        }
        mandatoryStepIndex = index;
        if (state) {
            state.mandatoryStepIndex = index;
            saveState();
        }
        var step = mandatoryProfile.steps[index];
        currentTourStep = step.stepKey;

        if (step.type === 'voice') {
            startVoiceMandatoryStep(step);
            return;
        }

        ensureTab(step.menuId).then(function () {
            return waitForTarget(step, 8000);
        }).then(function (el) {
            var isLast = index >= mandatoryProfile.steps.length - 1;
            showPopover({
                stepLabel: mandatoryStepLabel(index),
                title: step.title,
                body: step.body,
                target: el,
                padding: registry().isMobileLayout() ? 10 : 6,
                buttons: [
                    {
                        label: isLast ? '完成必学' : '下一步',
                        primary: true,
                        onClick: function () {
                            if (isLast) {
                                completeMandatoryPath();
                            } else {
                                runMandatoryStepAt(index + 1);
                            }
                        }
                    }
                ]
            });
        });
    }

    function startMandatoryPath() {
        if (root) {
            root.querySelectorAll('[data-onb-welcome]').forEach(function (el) { el.remove(); });
        }
        var resume = state && typeof state.mandatoryStepIndex === 'number' ? state.mandatoryStepIndex : 0;
        if (!mandatoryProfile || getMandatoryStepCount() === 0 || roleCode === 'READONLY') {
            completeMandatoryPath();
            return;
        }
        if (resume >= getMandatoryStepCount()) resume = 0;
        mandatoryStepIndex = resume;
        runMandatoryStepAt(resume);
    }

    function startVoiceMandatoryStep(step) {
        if (voicePhase === 'modal_open' || voicePhase === 'recording') {
            var openModal = $('voice-modal');
            if (openModal && !openModal.classList.contains('hidden')) {
                setActive(false);
                ensureRoot();
                if (root) root.style.pointerEvents = 'none';
                watchVoiceModal();
                return;
            }
        }
        currentTourStep = 'voice';
        voiceActiveStep = step;
        blocking = true;
        syncBlockingFromTour();
        setVoicePhase('intro');
        ensureTab(step.menuId || 'dashboard').then(function () {
            return waitForDashboardVoiceReady(12000);
        }).then(function (ready) {
            if (!ready) {
                showPopover({
                    stepLabel: mandatoryStepLabel(mandatoryStepIndex),
                    title: step.title,
                    body: '工作台语音功能仍在加载，请稍候再试。',
                    target: null,
                    buttons: [{
                        label: '重试',
                        primary: true,
                        onClick: function () {
                            startVoiceMandatoryStep(step);
                        }
                    }]
                });
                return null;
            }
            return waitForTarget(step, 6000);
        }).then(function (voiceBtn) {
            if (!voiceBtn) return;
            showVoiceIntroPopover(step, voiceBtn);
        });
    }

    function showVoiceIntroPopover(step, voiceBtn) {
        setVoicePhase('intro');
        showPopover({
            stepLabel: mandatoryStepLabel(mandatoryStepIndex),
            title: step.title,
            body: step.body,
            target: voiceBtn,
            padding: 10,
            buttons: [{
                label: '打开语音录单',
                primary: true,
                onClick: function () {
                    openVoiceModalFromTour(step);
                }
            }]
        });
    }

    function restoreVoiceIntroPopover() {
        setVoicePhase('intro');
        if (root) {
            root.style.pointerEvents = '';
            if (backdrop) backdrop.style.opacity = '';
        }
        resetVoiceModalLayer();
        showVoiceTips(false);
        var step = voiceActiveStep;
        if (!step && mandatoryProfile && mandatoryProfile.steps) {
            step = mandatoryProfile.steps[mandatoryStepIndex];
        }
        if (!step) return;
        ensureTab(step.menuId || 'dashboard').then(function () {
            return waitForTarget(step, 6000);
        }).then(function (voiceBtn) {
            if (voiceBtn) {
                showVoiceIntroPopover(step, voiceBtn);
            } else {
                showVoiceIntroPopover(step, null);
            }
        });
    }

    function openVoiceModalFromTour(step) {
        voiceActiveStep = step || voiceActiveStep;
        hideSpotlight();
        if (popover) popover.classList.add('hidden');
        setActive(false);
        ensureRoot();
        if (root) root.style.pointerEvents = 'none';
        if (backdrop) backdrop.style.opacity = '0';
        bindVoiceTipsUi();
        showVoiceTips(true);
        var vm = $('voice-modal');
        if (vm) vm.style.zIndex = '210';
        if (typeof window.openVoiceModal === 'function') {
            window.openVoiceModal();
        }
        var openedModal = $('voice-modal');
        if (openedModal && !openedModal.classList.contains('hidden')) {
            setVoicePhase('modal_open');
            watchVoiceModal();
            return;
        }
        restoreVoiceIntroPopover();
        if (typeof window.showToast === 'function') {
            window.showToast('语音弹窗未能打开，请稍后重试');
        }
    }

    function restartVoiceMandatoryFromModalClose(step) {
        if (voiceOverlaySyncLock || voiceStepRestartLock || completingVoice || state.mandatoryDone) {
            return;
        }
        if (voiceLastCloseReason && voiceLastCloseReason !== 'user_cancel') {
            return;
        }
        voiceStepRestartLock = true;
        setTimeout(function () { voiceStepRestartLock = false; }, 900);
        disconnectVoiceModalObserver();
        setVoicePhase('intro');
        voiceLastCloseReason = null;
        restoreVoiceIntroPopover();
    }

    function disconnectVoiceModalObserver() {
        if (voiceModalObserver) {
            voiceModalObserver.disconnect();
            voiceModalObserver = null;
        }
    }

    function watchVoiceModal() {
        var modal = $('voice-modal');
        if (!modal) return;
        disconnectVoiceModalObserver();
        voiceModalObserver = new MutationObserver(function () {
            if (voiceOverlaySyncLock) return;
            if (!modal.isConnected) return;
            if (!modal.classList.contains('hidden')) return;
            if (completingVoice || state.mandatoryDone) {
                disconnectVoiceModalObserver();
                setVoicePhase('idle');
                if (state.mandatoryDone) onMandatoryComplete();
                return;
            }
            if (currentTourStep !== 'voice') return;
            if (voicePhase !== 'modal_open' && voicePhase !== 'recording') return;
            var reason = voiceLastCloseReason;
            voiceLastCloseReason = null;
            if (reason === 'success') {
                setVoicePhase('completing');
                return;
            }
            if (reason === 'error') {
                setVoicePhase('modal_open');
                return;
            }
            if (reason !== 'user_cancel') {
                return;
            }
            var step = voiceActiveStep;
            if (!step && mandatoryProfile && mandatoryProfile.steps) {
                step = mandatoryProfile.steps[mandatoryStepIndex];
            }
            restartVoiceMandatoryFromModalClose(step);
        });
        voiceModalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    function rebindVoiceModalObserver() {
        if (isVoiceModalPhase()) {
            watchVoiceModal();
        }
    }

    function notifyVoiceModalReplaced(wasOpen) {
        voiceOverlaySyncLock = true;
        if (wasOpen) {
            setVoicePhase('modal_open');
            bindVoiceTipsUi();
            showVoiceTips(true);
            var vm = $('voice-modal');
            if (vm) {
                vm.style.zIndex = '210';
                vm.classList.remove('hidden');
            }
            setActive(false);
            ensureRoot();
            if (root) root.style.pointerEvents = 'none';
            if (backdrop) backdrop.style.opacity = '0';
            rebindVoiceModalObserver();
        }
        setTimeout(function () {
            voiceOverlaySyncLock = false;
        }, wasOpen ? 150 : 0);
    }

    function notifyVoiceModalClosing(reason) {
        voiceLastCloseReason = reason || 'unknown';
    }

    function onVoiceRecordingStarted() {
        if (currentTourStep === 'voice') {
            setVoicePhase('recording');
        }
    }

    function onVoiceRecordingEnded() {
        if (currentTourStep === 'voice' && voicePhase === 'recording') {
            setVoicePhase('modal_open');
        }
    }

    function prepareVoiceComplete() {
        completingVoice = true;
        setVoicePhase('completing');
        disconnectVoiceModalObserver();
    }

    function resetVoiceModalLayer() {
        var vm = $('voice-modal');
        if (vm) vm.style.zIndex = '';
        if (root) {
            root.style.pointerEvents = '';
            if (backdrop) backdrop.style.opacity = '';
        }
    }

    function completeMandatoryPath() {
        if (state.mandatoryDone) return;
        state.mandatoryDone = true;
        blocking = false;
        setVoicePhase('idle');
        voiceActiveStep = null;
        voiceLastCloseReason = null;
        saveState();
        updateBlockBanner();
        showVoiceTips(false);
        resetVoiceModalLayer();
        disconnectVoiceModalObserver();
        if (!state.celebrated) {
            state.celebrated = true;
            saveState();
            showCelebration();
        } else {
            onMandatoryComplete();
        }
    }

    function onVoiceComplete() {
        completingVoice = false;
        setVoicePhase('idle');
        voiceActiveStep = null;
        voiceLastCloseReason = null;
        if (state.mandatoryDone) return;
        if (currentTourStep === 'voice') {
            var hasMore = mandatoryProfile && mandatoryProfile.steps &&
                mandatoryStepIndex < mandatoryProfile.steps.length - 1;
            if (hasMore) {
                state.mandatoryDone = false;
                blocking = false;
                showVoiceTips(false);
                resetVoiceModalLayer();
                closeTourUi();
                runMandatoryStepAt(mandatoryStepIndex + 1);
                return;
            }
        }
        completeMandatoryPath();
    }

    function showCelebration() {
        closeTourUi();
        var layer = document.createElement('div');
        layer.className = 'tm-onboarding-celebrate';
        layer.setAttribute('data-onb-celebrate', '1');
        var text = (mandatoryProfile && mandatoryProfile.celebrateText) || '您已完成必学引导';
        layer.innerHTML =
            '<div class="tm-onboarding-celebrate__card">' +
            '<div class="tm-onboarding-celebrate__icon"><i class="ph ph-sparkle"></i></div>' +
            '<h3 class="tm-onboarding-celebrate__title">太棒了！</h3>' +
            '<p class="tm-onboarding-celebrate__text">' + text + '。<br>现在可以正式开始您的日常经营。</p>' +
            '<button type="button" class="tm-onboarding-btn tm-onboarding-btn--primary w-full" data-onb-celebrate-ok>进入系统</button>' +
            '</div>';
        document.body.appendChild(layer);
        layer.querySelector('[data-onb-celebrate-ok]').addEventListener('click', function () {
            layer.remove();
            renderChecklistFab();
            showChecklistPanel(true);
        });
    }

    function onMandatoryComplete() {
        closeTourUi();
        renderChecklistFab();
    }

    function markChecklistDone(id) {
        state.checklist[id] = true;
        saveState();
        renderChecklistFab();
        if (checklistOpen) renderChecklistPanel(false);
    }

    function runOptionalStep(stepKey, checklistId) {
        var def = registry().getOptionalStep(stepKey);
        if (!def) return;
        if (!registry().isMenuVisibleForRole(roleCode, def.menuId)) {
            if (typeof window.showToast === 'function') {
                window.showToast('当前角色不可访问该模块');
            }
            return;
        }
        currentTourStep = stepKey;
        state.lastChecklistId = checklistId;
        saveState();

        function runWithTarget(el) {
            showPopover({
                stepLabel: def.stepLabel,
                title: def.title,
                body: def.body,
                target: el,
                padding: registry().isMobileLayout() ? 10 : 8,
                buttons: [
                    {
                        label: '完成',
                        primary: true,
                        onClick: function () {
                            markChecklistDone(checklistId);
                            closeTourUi();
                        }
                    },
                    { label: '跳过', ghost: true, onClick: closeTourUi }
                ]
            });
        }

        if (def.action) {
            setActive(true);
            if (typeof window.openMemberModal === 'function') window.openMemberModal();
            waitForTarget({ targets: { desktop: ['#member-btn-open-accounts'], mobile: ['#member-btn-open-accounts'] }, fallback: '#member-modal' }, 3000)
                .then(function (el) {
                    runWithTarget(el || $('member-btn-open-accounts') || $('member-modal'));
                });
            return;
        }

        ensureTab(def.menuId).then(function () {
            var mobileOpts = def.mobile || {};
            if (!(registry().isMobileLayout() && mobileOpts.skipDetailAutoOpen)) {
                if (stepKey === 'crm') {
                    var first = document.querySelector('#customer-list-container [onclick*="switchCustomerDetail"]');
                    if (first && !registry().isMobileLayout()) first.click();
                }
            }
            return waitForTarget(def, 6000);
        }).then(function (el) {
            runWithTarget(el || document.getElementById('view-' + def.menuId));
        });
    }

    function renderChecklistFab() {
        var oldFab = $('tm-onboarding-fab');
        var oldPanel = $('tm-onboarding-checklist-panel');
        if (oldFab) oldFab.remove();
        if (oldPanel) oldPanel.remove();
        if (!state.mandatoryDone) return;

        var items = getFilteredChecklist();
        var done = items.filter(function (it) { return state.checklist[it.id]; }).length;

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.id = 'tm-onboarding-fab';
        fab.className = 'tm-onboarding-checklist-fab';
        fab.innerHTML = '<i class="ph ph-compass"></i> 功能导览 ' + done + '/' + items.length;
        fab.addEventListener('click', function () {
            showChecklistPanel(!checklistOpen);
        });
        document.body.appendChild(fab);
        if (typeof window.TM_syncAppShellMetrics === 'function') {
            window.TM_syncAppShellMetrics();
        }
    }

    function renderChecklistPanel(open) {
        checklistOpen = open !== false;
        var panel = $('tm-onboarding-checklist-panel');
        if (!checklistOpen) {
            if (panel) panel.remove();
            return;
        }
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'tm-onboarding-checklist-panel';
            panel.className = 'tm-onboarding-checklist-panel';
            if (registry().isMobileLayout()) panel.classList.add('tm-onboarding-checklist-panel--mobile');
            document.body.appendChild(panel);
        }
        var items = getFilteredChecklist();
        var done = items.filter(function (it) { return state.checklist[it.id]; }).length;
        var html = '<h3>功能导览清单</h3><p class="tm-checklist-progress">已完成 ' + done + ' / ' + items.length + '（均可跳过）</p>';
        items.forEach(function (it) {
            var isDone = !!state.checklist[it.id];
            html +=
                '<div class="tm-onboarding-checklist-item' + (isDone ? ' is-done' : '') + '">' +
                '<i class="ph ' + (isDone ? 'ph-check-circle' : 'ph-circle') + ' tm-check-icon"></i>' +
                '<button type="button" data-check-id="' + it.id + '" data-step-key="' + it.stepKey + '">' + it.label + '</button>' +
                '</div>';
        });
        html += '<button type="button" class="tm-onboarding-btn tm-onboarding-btn--link w-full mt-2" data-onb-dismiss>不再提示导览</button>';
        panel.innerHTML = html;
        panel.querySelectorAll('[data-check-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                runOptionalStep(btn.getAttribute('data-step-key'), btn.getAttribute('data-check-id'));
            });
        });
        panel.querySelector('[data-onb-dismiss]').addEventListener('click', function () {
            state.dismissed = true;
            saveState();
            showChecklistPanel(false);
            var fab = $('tm-onboarding-fab');
            if (fab) fab.remove();
            if (typeof window.TM_syncAppShellMetrics === 'function') {
                window.TM_syncAppShellMetrics();
            }
        });
    }

    function showChecklistPanel(open) {
        renderChecklistPanel(open);
    }

    function tryStartOnboarding() {
        if (!roleUiReady || !serverHydrated) return;
        if (onboardingBootstrapped) return;
        state = loadState();
        refreshRoleContext();
        if (state.mandatoryDone) {
            onboardingBootstrapped = true;
            if (!state.dismissed) renderChecklistFab();
            return;
        }
        if (!shouldRun()) {
            onboardingBootstrapped = true;
            return;
        }
        if (isVoiceTourActive() || isVoiceModalPhase() || voicePhase === 'intro') {
            onboardingBootstrapped = true;
            return;
        }
        if (currentTourStep && !state.mandatoryDone) {
            onboardingBootstrapped = true;
            return;
        }
        onboardingBootstrapped = true;
        bindVoiceTipsUi();
        if (!state.mandatoryDone) {
            if (!state.welcomed && isFirstLogin) {
                if (!welcomeScheduled) {
                    welcomeScheduled = true;
                    setTimeout(showWelcome, 400);
                }
            } else if (!state.mandatoryDone) {
                setTimeout(startMandatoryPath, 400);
            }
        } else if (!state.dismissed) {
            renderChecklistFab();
        }
    }

    function guardNavigation(tabId, ev) {
        if (!isBlockingActive()) return true;
        if (isTabAllowedWhileBlocking(tabId)) return true;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (typeof window.showToast === 'function') {
            window.showToast(getBlockingMessage());
        }
        return false;
    }

    function patchSwitchTab() {
        var orig = window.switchTab;
        if (!orig || orig._tmOnboardingPatched) return;
        function wrapped(tabId) {
            if (!guardNavigation(tabId)) return;
            return orig.call(window, tabId);
        }
        wrapped._tmOnboardingPatched = true;
        window.switchTab = wrapped;
    }

    function patchNavClicks() {
        document.addEventListener('click', function (ev) {
            if (!isBlockingActive()) return;
            var nav = ev.target.closest('[data-tm-nav]');
            if (!nav) return;
            var menuId = nav.getAttribute('data-tm-nav');
            if (!menuId) return;
            if (!guardNavigation(menuId, ev)) return;
        }, true);
    }

    window.TmOnboarding = {
        isBlocking: function () { return isBlockingActive(); },
        getRoleCode: function () { return roleCode; },
        onVoiceComplete: onVoiceComplete,
        onMandatoryStepComplete: completeMandatoryPath,
        isVoiceModalPhase: isVoiceModalPhase,
        isVoiceTourActive: isVoiceTourActive,
        rebindVoiceModalObserver: rebindVoiceModalObserver,
        notifyVoiceModalReplaced: notifyVoiceModalReplaced,
        notifyVoiceModalClosing: notifyVoiceModalClosing,
        setVoiceOverlaySyncLock: setVoiceOverlaySyncLock,
        onVoiceRecordingStarted: onVoiceRecordingStarted,
        onVoiceRecordingEnded: onVoiceRecordingEnded,
        refreshForRole: function () {
            refreshRoleContext();
            onboardingBootstrapped = false;
            welcomeScheduled = false;
            serverHydrated = false;
            hydrateFromServer().then(function () {
                state = loadState();
                renderChecklistFab();
                tryStartOnboarding();
            });
        },
        restart: function () {
            refreshRoleContext();
            isFirstLogin = true;
            state = defaultState();
            saveState();
            blocking = false;
            mandatoryStepIndex = 0;
            completingVoice = false;
            voiceStepRestartLock = false;
            setVoicePhase('idle');
            voiceActiveStep = null;
            voiceLastCloseReason = null;
            voiceOverlaySyncLock = false;
            onboardingBootstrapped = false;
            welcomeScheduled = false;
            disconnectVoiceModalObserver();
            updateBlockBanner();
            var fab = $('tm-onboarding-fab');
            if (fab) fab.remove();
            if (root) {
                root.querySelectorAll('[data-onb-welcome]').forEach(function (el) { el.remove(); });
            }
            showChecklistPanel(false);
            showWelcome();
        },
        prepareVoiceComplete: prepareVoiceComplete,
        openChecklist: function () {
            if (!state || !state.mandatoryDone) {
                if (typeof window.showToast === 'function') window.showToast('请先完成必学步骤');
                return;
            }
            renderChecklistFab();
            showChecklistPanel(true);
        }
    };

    function markRoleUiReady() {
        if (roleUiReady) return;
        roleUiReady = true;
        tryStartOnboarding();
    }

    function bootstrap() {
        if (!registry()) {
            console.warn('[tm-onboarding] 缺少 TM_ONBOARDING_REGISTRY');
            return;
        }
        patchSwitchTab();
        patchNavClicks();
        document.addEventListener('tm-role-ui-ready', function () {
            if (serverHydrated) markRoleUiReady();
        });
        var hydrateDone = hydrateFromServer();
        var hydrateTimeout = waitMs(5000).then(function () {
            if (!serverHydrated) {
                if (!state) state = loadStateLocalOnly();
                serverHydrated = true;
            }
        });
        Promise.all([hydrateDone, hydrateTimeout]).then(function () {
            return waitMs(200);
        }).then(function () {
            if (!roleUiReady) {
                markRoleUiReady();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
