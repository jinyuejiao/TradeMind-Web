/**
 * TradeMind — 开机导览配置中心（角色 × PC/手机 统一）
 * 依赖：ui-permissions.js (TM_ROLE_SCHEMA)
 */
(function () {
    'use strict';

    var SUBUSER_ROLE_MAP = {
        '管理员': 'ADMIN',
        '运营': 'SALES',
        '仓库': 'WAREHOUSE',
        '财务': 'FINANCE',
        '只读': 'READONLY'
    };

    var CHECKLIST = [
        { id: 'pendingAudit', label: '待确认单据核对', menuId: 'dashboard', stepKey: 'pending' },
        { id: 'inProgressTrack', label: '进行中单据跟单', menuId: 'dashboard', stepKey: 'inprogress' },
        { id: 'crmCustomer', label: '客户与往来时间轴', menuId: 'crm', stepKey: 'crm' },
        { id: 'productSupply', label: '产品/类别/仓库/进货建议', menuId: 'supply', stepKey: 'supply' },
        { id: 'supplierPo', label: '供应商与进货单', menuId: 'supplier', stepKey: 'supplierPo' },
        { id: 'bizLedger', label: '账户与往来流水', menuId: 'biz', stepKey: 'biz' },
        { id: 'memberAccounts', label: '子账号管理', menuId: 'member', stepKey: 'member', primaryOnly: true }
    ];

    var OPTIONAL_STEPS = {
        pending: {
            menuId: 'dashboard',
            title: '待确认单据',
            body: 'AI 草稿在左侧列表。点击进入核对，确认后才会进入履约。',
            stepLabel: '可选学习',
            targets: { desktop: ['#pending-list'], mobile: ['#pending-list'] }
        },
        inprogress: {
            menuId: 'dashboard',
            title: '进行中单据',
            body: '右侧跟踪拣货、发货、尾款等状态；也可手动添加订单。',
            stepLabel: '可选学习',
            targets: { desktop: ['#inprogress-list'], mobile: ['#inprogress-list'] }
        },
        crm: {
            menuId: 'crm',
            title: '客户 CRM',
            body: '维护客户档案；详情中的时间轴即该客户往来记录。',
            stepLabel: '可选学习',
            targets: { desktop: ['#crm-list-pane', '#customer-list-container'], mobile: ['#crm-list-pane', '#customer-list-container'] },
            mobile: { skipDetailAutoOpen: true }
        },
        supply: {
            menuId: 'supply',
            title: '产品中心',
            body: '管理 SKU、一级类别与仓库；缺货时可生成进货建议单。',
            stepLabel: '可选学习',
            targets: { desktop: ['#inventorySearch', '#view-supply'], mobile: ['#inventorySearch', '#view-supply'] }
        },
        supplierPo: {
            menuId: 'supplier',
            title: '供应商与进货单',
            body: '查看/管理进货单据，并维护供应商目录。',
            stepLabel: '可选学习',
            targets: { desktop: ['#btn-sup-list', '#purchase-orders-tbody'], mobile: ['#btn-sup-list', '#purchase-orders-tbody'] }
        },
        biz: {
            menuId: 'biz',
            title: '智能经营 · 账户流水',
            body: '管理收付款账户，点开账户可查看往来流水（与订单收款账户不同）。',
            stepLabel: '可选学习',
            targets: { desktop: ['#biz-account-list'], mobile: ['#biz-account-list'] }
        },
        member: {
            menuId: 'member',
            title: '账号管理',
            body: '主账号可在此管理子账号与订阅（侧栏头像进入）。',
            stepLabel: '可选学习',
            action: true
        }
    };

    /** @type {Record<string, { id: string, welcomeMandatory: string, welcomeOptional: string, celebrateText: string, steps: object[] }>} */
    var MANDATORY_PROFILES = {
        ADMIN: {
            id: 'admin_sales_voice',
            welcomeMandatory: '了解工作台，并用语音录入第一笔批发单',
            welcomeOptional: '完成后可自选学习各业务模块',
            celebrateText: '您已掌握语音开单',
            steps: [
                {
                    stepKey: 'dashboard-intro',
                    menuId: 'dashboard',
                    title: '工作台 · AI 订单提取',
                    body: '批发日常开单入口在这里：语音、拍照或粘贴聊天文字，系统会生成待确认草稿。',
                    targets: { desktop: ['#dashboard-ai-extract'], mobile: ['#dashboard-ai-extract'] },
                    fallback: '#view-dashboard section'
                },
                {
                    stepKey: 'voice',
                    menuId: 'dashboard',
                    type: 'voice',
                    blocking: true,
                    title: '用语音录入第一笔单',
                    body: '请点击「语音录入」，按提示说出批发单。格式示例将在弹窗中展示。',
                    targets: { desktop: ['#dashboard-ai-extract button[onclick*="openVoiceModal"]', 'button[onclick*="openVoiceModal"]'], mobile: ['#dashboard-ai-extract button[onclick*="openVoiceModal"]', 'button[onclick*="openVoiceModal"]'] }
                }
            ]
        },
        SALES: {
            id: 'sales_voice',
            welcomeMandatory: '了解工作台，并用语音录入第一笔批发单',
            welcomeOptional: '完成后可学习客户、产品等相关模块',
            celebrateText: '您已掌握语音开单',
            steps: [
                {
                    stepKey: 'dashboard-intro',
                    menuId: 'dashboard',
                    title: '工作台 · AI 订单提取',
                    body: '业务员日常开单入口：语音、拍照或文字提取，生成待确认草稿。',
                    targets: { desktop: ['#dashboard-ai-extract'], mobile: ['#dashboard-ai-extract'] },
                    fallback: '#view-dashboard section'
                },
                {
                    stepKey: 'voice',
                    menuId: 'dashboard',
                    type: 'voice',
                    blocking: true,
                    title: '用语音录入第一笔单',
                    body: '请点击「语音录入」完成第一笔演示单据。',
                    targets: { desktop: ['#dashboard-ai-extract button[onclick*="openVoiceModal"]', 'button[onclick*="openVoiceModal"]'], mobile: ['#dashboard-ai-extract button[onclick*="openVoiceModal"]', 'button[onclick*="openVoiceModal"]'] }
                }
            ]
        },
        FINANCE: {
            id: 'finance_biz',
            welcomeMandatory: '了解智能经营中的账户与往来流水查看方式',
            welcomeOptional: '完成后可学习产品、供应商、客户等模块',
            celebrateText: '您已了解财务视角的核心入口',
            steps: [
                {
                    stepKey: 'biz-intro',
                    menuId: 'biz',
                    title: '智能经营 · 财务视角',
                    body: '财务同学主要在此查看收付款账户与往来流水（订单收款账户在单据流程中关联）。',
                    targets: { desktop: ['#biz-account-list'], mobile: ['#biz-account-list'] },
                    fallback: '#view-biz'
                }
            ]
        },
        WAREHOUSE: {
            id: 'warehouse_supply',
            welcomeMandatory: '了解产品中心库存与供应商进货单入口',
            welcomeOptional: '完成后可继续学习进货与库存相关功能',
            celebrateText: '您已了解仓库日常操作入口',
            steps: [
                {
                    stepKey: 'supply-intro',
                    menuId: 'supply',
                    title: '产品中心 · 库存与进货',
                    body: '管理 SKU、仓库与库存；缺货时可在此生成进货建议。',
                    targets: { desktop: ['#inventorySearch', '#view-supply'], mobile: ['#inventorySearch', '#view-supply'] },
                    fallback: '#view-supply'
                },
                {
                    stepKey: 'supplier-intro',
                    menuId: 'supplier',
                    title: '供应商与进货单',
                    body: '进货单据与供应商目录在此维护，可与 OCR/语音录入联动。',
                    targets: { desktop: ['#btn-sup-list', '#purchase-orders-tbody'], mobile: ['#btn-sup-list', '#purchase-orders-tbody'] },
                    fallback: '#view-supplier'
                }
            ]
        },
        READONLY: {
            id: 'readonly_map',
            welcomeMandatory: '浏览与您权限匹配的功能地图（无阻塞操作）',
            welcomeOptional: '可按清单逐项了解只读可见模块',
            celebrateText: '您已了解只读权限下的功能范围',
            steps: []
        }
    };

    function normalizeRoleCode(role) {
        if (window.TM_ROLE_SCHEMA && window.TM_ROLE_SCHEMA.normalizeRole) {
            return window.TM_ROLE_SCHEMA.normalizeRole(role);
        }
        return String(role || 'ADMIN').trim().toUpperCase();
    }

    function resolveRoleCode() {
        try {
            var sub = sessionStorage.getItem('tm_auth_subuser_role');
            if (sub && SUBUSER_ROLE_MAP[sub]) {
                return SUBUSER_ROLE_MAP[sub];
            }
        } catch (e) { /* ignore */ }
        try {
            var userJson = localStorage.getItem('tm_user_info') || sessionStorage.getItem('tm_user_info');
            if (userJson) {
                var u = JSON.parse(userJson);
                if (u && u.roleType) return normalizeRoleCode(u.roleType);
            }
        } catch (e) { /* ignore */ }
        if (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role) {
            return normalizeRoleCode(window.TM_UI_CONTEXT.role);
        }
        return 'ADMIN';
    }

    function isPrimaryAccount() {
        if (typeof window.isPrimaryMerchantAdmin === 'function') {
            return window.isPrimaryMerchantAdmin();
        }
        try {
            return !sessionStorage.getItem('tm_auth_subuser_id') && !sessionStorage.getItem('tm_auth_subuser_role');
        } catch (e) {
            return true;
        }
    }

    function isMenuVisibleForRole(roleCode, menuId) {
        if (!window.TM_ROLE_SCHEMA || !window.TM_ROLE_SCHEMA.isMenuVisible) {
            return true;
        }
        return window.TM_ROLE_SCHEMA.isMenuVisible(roleCode, menuId);
    }

    function getRoleLabel(roleCode) {
        var perms = window.TM_ROLE_PERMISSIONS;
        if (perms && perms[roleCode] && perms[roleCode].label) {
            return perms[roleCode].label;
        }
        return roleCode;
    }

    function isMobileLayout() {
        if (window.TM_Responsive && typeof window.TM_Responsive.isMobileView === 'function') {
            return window.TM_Responsive.isMobileView();
        }
        return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    }

    function resolveTargetSelectors(stepDef) {
        var layout = isMobileLayout() ? 'mobile' : 'desktop';
        var bag = stepDef.targets || {};
        var list = bag[layout] || bag.desktop || [];
        if (typeof list === 'string') return [list];
        return list;
    }

    function queryFirstTarget(stepDef) {
        var selectors = resolveTargetSelectors(stepDef);
        var i;
        for (i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) return el;
        }
        if (stepDef.fallback) {
            return document.querySelector(stepDef.fallback);
        }
        if (stepDef.menuId) {
            return document.getElementById('view-' + stepDef.menuId);
        }
        return null;
    }

    function getFilteredChecklist(roleCode) {
        return CHECKLIST.filter(function (item) {
            if (item.primaryOnly && !isPrimaryAccount()) return false;
            return isMenuVisibleForRole(roleCode, item.menuId);
        });
    }

    function getMandatoryProfile(roleCode) {
        return MANDATORY_PROFILES[roleCode] || MANDATORY_PROFILES.ADMIN;
    }

    function getOptionalStep(stepKey) {
        return OPTIONAL_STEPS[stepKey] || null;
    }

    function getSubjectContext() {
        if (window.TM_ONBOARDING_SYNC && typeof window.TM_ONBOARDING_SYNC.getSubjectContext === 'function') {
            return window.TM_ONBOARDING_SYNC.getSubjectContext();
        }
        var tenantId = '';
        var subjectId = '';
        try {
            var raw = localStorage.getItem('user_info');
            if (raw) {
                var u = JSON.parse(raw);
                tenantId = u.tenantId != null ? String(u.tenantId) : (u.tenant_id != null ? String(u.tenant_id) : '');
                subjectId = u.userId != null ? String(u.userId) : (u.user_id != null ? String(u.user_id) : '');
            }
        } catch (e) { /* ignore */ }
        return { tenantId: tenantId, subjectType: 'PRIMARY', subjectId: subjectId };
    }

    function getStorageKey(industry, roleCode) {
        var ctx = getSubjectContext();
        var tenant = ctx.tenantId || 'unknown';
        var subject = ctx.subjectId || 'unknown';
        return 'tm_onboarding_v3_' + tenant + '_' + subject + '_' +
            String(industry || 'WHOLESALE').toUpperCase() + '_' + normalizeRoleCode(roleCode);
    }

    function getLegacyStorageKey(industry, roleCode) {
        return 'tm_onboarding_v2_' + String(industry || 'WHOLESALE').toUpperCase() + '_' + normalizeRoleCode(roleCode);
    }

    function getBlockingAllowedTabs(profile) {
        var tabs = [];
        if (!profile || !profile.steps) return tabs;
        profile.steps.forEach(function (s) {
            if (s.menuId && tabs.indexOf(s.menuId) === -1) tabs.push(s.menuId);
        });
        return tabs;
    }

    function getFirstVisibleMenuId(roleCode) {
        if (window.TM_RolePreview && typeof window.TM_RolePreview.getFirstVisibleTab === 'function') {
            return window.TM_RolePreview.getFirstVisibleTab();
        }
        var order = ['dashboard', 'biz', 'crm', 'supply', 'supplier', 'member'];
        var i;
        for (i = 0; i < order.length; i++) {
            if (isMenuVisibleForRole(roleCode, order[i])) return order[i];
        }
        return 'dashboard';
    }

    function migrateLegacyState(roleCode) {
        if (normalizeRoleCode(roleCode) !== 'ADMIN') return null;
        try {
            var raw = localStorage.getItem('tm_onboarding_wholesale_v1');
            if (!raw) return null;
            var o = JSON.parse(raw);
            return {
                welcomed: !!o.welcomed,
                mandatoryDone: !!o.voiceDone,
                celebrated: !!o.celebrated,
                dismissed: !!o.dismissed,
                checklist: o.checklist && typeof o.checklist === 'object' ? o.checklist : {},
                lastChecklistId: o.lastChecklistId || null
            };
        } catch (e) {
            return null;
        }
    }

    window.TM_ONBOARDING_REGISTRY = {
        SUBUSER_ROLE_MAP: SUBUSER_ROLE_MAP,
        CHECKLIST: CHECKLIST,
        resolveRoleCode: resolveRoleCode,
        isPrimaryAccount: isPrimaryAccount,
        isMenuVisibleForRole: isMenuVisibleForRole,
        getRoleLabel: getRoleLabel,
        isMobileLayout: isMobileLayout,
        resolveTargetSelectors: resolveTargetSelectors,
        queryFirstTarget: queryFirstTarget,
        getFilteredChecklist: getFilteredChecklist,
        getMandatoryProfile: getMandatoryProfile,
        getOptionalStep: getOptionalStep,
        getSubjectContext: getSubjectContext,
        getStorageKey: getStorageKey,
        getLegacyStorageKey: getLegacyStorageKey,
        getBlockingAllowedTabs: getBlockingAllowedTabs,
        getFirstVisibleMenuId: getFirstVisibleMenuId,
        migrateLegacyState: migrateLegacyState
    };
})();
