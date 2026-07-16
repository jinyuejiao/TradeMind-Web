/**
 * 工作台差异化配置：业态 + 行业垂直 + 能力开关 + UI 配置
 */
(function () {
    'use strict';

    var INDUSTRY_LABELS = {
        PENDING: '待选择',
        GENERAL: '通用',
        CLOTHING: '服装',
        FOOD: '食品',
        DIGITAL_3C: '3C数码'
    };

    var COLUMN_PRESETS = {
        PENDING: ['product', 'qty', 'price', 'amount'],
        GENERAL: ['product', 'qty', 'price', 'amount'],
        CLOTHING: ['product', 'spec', 'qty', 'price', 'amount'],
        FOOD: ['product', 'spec', 'expiry', 'qty', 'price', 'amount'],
        DIGITAL_3C: ['product', 'spec', 'serial', 'qty', 'price', 'amount']
    };

    function parseJwtPayload() {
        try {
            var token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return {};
            var parts = token.split('.');
            if (parts.length < 2) return {};
            var json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(json);
        } catch (e) {
            return {};
        }
    }

    async function refreshSubscriptionTokenIfNeeded() {
        if (!window.wrappedFetch) return null;
        try {
            var meResp = await window.wrappedFetch('/api/v1/tenant/subscription/me', { method: 'GET' });
            var meJson = await meResp.json().catch(function () { return {}; });
            if (meJson.newToken) {
                localStorage.setItem('token', meJson.newToken);
            }
            if (meJson.accessMode && window.TM_WorkbenchProfile) {
                window.TM_WorkbenchProfile.accessMode = meJson.accessMode;
            }
            window._tmMemberMe = meJson;
            if (window.TM_SubscriptionNotice && typeof window.TM_SubscriptionNotice.refresh === 'function') {
                window.TM_SubscriptionNotice.refresh({ showModal: false });
            }
            return meJson;
        } catch (e) {
            return null;
        }
    }

    function isWriteBlockedBySubscription(accessMode) {
        var mode = (accessMode || '').toUpperCase();
        return mode === 'READ_ONLY' || mode === 'BILLING_ONLY';
    }

    function roleAllowsQuickOrder(role) {
        var r = (role || 'ADMIN').toUpperCase();
        return r === 'ADMIN' || r === 'SALES';
    }

    function roleAllowsShortageDispatch(role) {
        var r = (role || '').toUpperCase();
        return r === 'ADMIN' || r === 'WAREHOUSE' || r === 'SALES';
    }

    window.TM_refreshSubscriptionToken = refreshSubscriptionTokenIfNeeded;

    window.TM_WorkbenchProfile = {
        merchantType: 'WHOLESALE',
        industryVertical: 'PENDING',
        roleType: 'ADMIN',
        capabilities: {},
        uiProfile: {},
        quickOrderColumns: COLUMN_PRESETS.GENERAL,

        load: async function () {
            var jwt = parseJwtPayload();
            this.merchantType = jwt.merchantType || 'WHOLESALE';
            this.industryVertical = jwt.industryVertical || 'PENDING';
            this.roleType = jwt.roleType || 'ADMIN';
            this.accessMode = jwt.accessMode || 'FULL';
            this.quickOrderColumns = COLUMN_PRESETS[this.industryVertical] || COLUMN_PRESETS.GENERAL;

            var meJson = await refreshSubscriptionTokenIfNeeded();
            if (meJson && meJson.accessMode) {
                this.accessMode = meJson.accessMode;
            } else {
                jwt = parseJwtPayload();
                if (jwt.accessMode) this.accessMode = jwt.accessMode;
            }

            if (window.wrappedFetch) {
                try {
                    var opsResp = await window.wrappedFetch('/api/v1/rd/tenant/ops-profile', { method: 'GET' });
                    var opsJson = await window.handleApiResponse(opsResp);
                    var ops = opsJson && opsJson.data ? opsJson.data : opsJson;
                    if (ops) {
                        if (ops.industryVertical) {
                            var opsIv = String(ops.industryVertical).toUpperCase();
                            var curIv = String(this.industryVertical || 'PENDING').toUpperCase();
                            // 勿用 PENDING 覆盖 JWT/已选定的具体行业（ops 查询失败时曾误伤服饰户）
                            if (opsIv !== 'PENDING' || curIv === 'PENDING' || !curIv) {
                                this.industryVertical = opsIv;
                            }
                        }
                        if (ops.productCapabilities) this.capabilities = ops.productCapabilities;
                        if (ops.uiProfile) this.uiProfile = ops.uiProfile;
                        if (this.industryVertical && COLUMN_PRESETS[this.industryVertical]) {
                            this.quickOrderColumns = COLUMN_PRESETS[this.industryVertical];
                        }
                    }
                    try {
                        var onbResp = await window.wrappedFetch('/api/v1/tenant/onboarding/status', { method: 'GET' });
                        var onbJson = await window.handleApiResponse(onbResp);
                        var onb = onbJson && onbJson.data ? onbJson.data : onbJson;
                        if (onb && onb.industryVertical && onb.industryVertical !== 'PENDING') {
                            this.industryVertical = onb.industryVertical;
                            if (COLUMN_PRESETS[onb.industryVertical]) {
                                this.quickOrderColumns = COLUMN_PRESETS[onb.industryVertical];
                            }
                        }
                    } catch (e2) { /* ignore */ }
                } catch (e) { /* ignore */ }
            }
            this.afterLoad();
            return this;
        },

        afterLoad: function () {
            try {
                var iv = String(this.industryVertical || '').toUpperCase();
                if (iv && iv !== 'PENDING') {
                    document.documentElement.setAttribute('data-industry-vertical', iv);
                    if (window.TM_UI_CONTEXT) window.TM_UI_CONTEXT.industryVertical = iv;
                }
            } catch (e) { /* ignore */ }
            if (window.TM_IndustryUI) {
                window.TM_IndustryUI.apply(document.body, this);
            }
            if (window.TM_SubscriptionNotice && typeof window.TM_SubscriptionNotice.refresh === 'function') {
                window.TM_SubscriptionNotice.refresh({ showModal: true });
            }
            if (window.TM_FirstLoginWizard && typeof window.TM_FirstLoginWizard.checkAndShow === 'function') {
                window.TM_FirstLoginWizard.checkAndShow();
            }
        },

        industryLabel: function () {
            return INDUSTRY_LABELS[this.industryVertical] || this.industryVertical;
        },

        showQuickOrder: function () {
            return roleAllowsQuickOrder(this.roleType);
        },

        showShortagePanel: function () {
            return roleAllowsShortageDispatch(this.roleType);
        },

        canCreateOrders: function () {
            return !isWriteBlockedBySubscription(this.accessMode);
        },

        canMutate: function () {
            return !isWriteBlockedBySubscription(this.accessMode);
        },

        defaultFulfillmentWarehouseId: function () {
            var ui = this.uiProfile || {};
            return ui.defaultFulfillmentWarehouseId || ui.defaultStoreWarehouseId || null;
        }
    };

    window.TM_loadWorkbenchProfile = function () {
        return window.TM_WorkbenchProfile.load();
    };

    function autoLoadIfAuthenticated() {
        try {
            var token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;
            var path = (window.location.pathname || '').toLowerCase();
            if (path.indexOf('login') >= 0 || path.indexOf('register') >= 0) return;
            window.TM_WorkbenchProfile.load();
        } catch (e) { /* ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoLoadIfAuthenticated);
    } else {
        autoLoadIfAuthenticated();
    }
})();
