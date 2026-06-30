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

    function roleAllowsQuickOrder(role) {
        var r = (role || 'ADMIN').toUpperCase();
        return r === 'ADMIN' || r === 'SALES';
    }

    function roleAllowsShortageDispatch(role) {
        var r = (role || '').toUpperCase();
        return r === 'ADMIN' || r === 'WAREHOUSE' || r === 'SALES';
    }

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
            this.quickOrderColumns = COLUMN_PRESETS[this.industryVertical] || COLUMN_PRESETS.GENERAL;

            if (window.wrappedFetch) {
                try {
                    var opsResp = await window.wrappedFetch('/api/v1/rd/tenant/ops-profile', { method: 'GET' });
                    var opsJson = await window.handleApiResponse(opsResp);
                    var ops = opsJson && opsJson.data ? opsJson.data : opsJson;
                    if (ops) {
                        if (ops.industryVertical) this.industryVertical = ops.industryVertical;
                        if (ops.productCapabilities) this.capabilities = ops.productCapabilities;
                        if (ops.uiProfile) this.uiProfile = ops.uiProfile;
                        if (ops.industryVertical && COLUMN_PRESETS[ops.industryVertical]) {
                            this.quickOrderColumns = COLUMN_PRESETS[ops.industryVertical];
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
            if (window.TM_IndustryUI) {
                window.TM_IndustryUI.apply(document.body, this);
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

        defaultFulfillmentWarehouseId: function () {
            var ui = this.uiProfile || {};
            return ui.defaultFulfillmentWarehouseId || ui.defaultStoreWarehouseId || null;
        }
    };

    window.TM_loadWorkbenchProfile = function () {
        return window.TM_WorkbenchProfile.load();
    };
})();
