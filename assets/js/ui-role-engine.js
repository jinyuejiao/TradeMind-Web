/**
 * TradeMind — 生产环境角色渲染引擎（物理隔离 + 路由同步）
 * 依赖：ui-permissions.js、TM_UI_CONTEXT.role
 */
(function () {
    'use strict';

    var schemaApi = window.TM_ROLE_SCHEMA;
    var perms = window.TM_ROLE_PERMISSIONS;

    if (!schemaApi || !perms) {
        console.warn('[ui-role-engine] 缺少 ui-permissions.js');
        return;
    }

    var TAB_TO_MENU = {
        dashboard: 'dashboard',
        biz: 'biz',
        crm: 'crm',
        supply: 'supply',
        supplier: 'supplier'
    };

    var TAB_FALLBACK_ORDER = ['dashboard', 'biz', 'crm', 'supply', 'supplier'];

    function normalizeRole(r) {
        return schemaApi.normalizeRole(r);
    }

    function currentRole() {
        return normalizeRole(window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role);
    }

    function getFirstVisibleTabForRole(role) {
        var r = normalizeRole(role);
        for (var i = 0; i < TAB_FALLBACK_ORDER.length; i++) {
            var tab = TAB_FALLBACK_ORDER[i];
            if (schemaApi.isMenuVisible(r, TAB_TO_MENU[tab])) return tab;
        }
        return 'dashboard';
    }

    /** 侧栏/底栏：无权限节点物理移除 */
    function applySidebarByRole() {
        var role = currentRole();
        document.querySelectorAll('[data-tm-nav]').forEach(function (el) {
            var menuId = el.getAttribute('data-tm-nav');
            if (!menuId) return;
            if (!schemaApi.isMenuVisible(role, menuId)) {
                el.remove();
            }
        });
    }

    function storeFieldOriginal(el) {
        if (!el.hasAttribute('data-tm-field-original')) {
            el.setAttribute('data-tm-field-original', el.textContent);
        }
    }

    function restoreFieldOriginal(el) {
        if (!el.hasAttribute('data-tm-field-original')) return;
        el.textContent = el.getAttribute('data-tm-field-original');
        el.removeAttribute('data-tm-field-original');
        el.classList.remove('tm-sensitive-masked');
    }

    function applyFieldRules(root, role) {
        var schema = schemaApi.get(role);
        var hidden = schema.hidden_fields || [];
        var masked = schema.masked_fields || [];

        (root || document).querySelectorAll('[data-field]').forEach(function (el) {
            var field = el.getAttribute('data-field');
            if (!field) return;

            if (hidden.indexOf(field) !== -1) {
                el.remove();
                return;
            }

            if (masked.indexOf(field) !== -1) {
                storeFieldOriginal(el);
                el.textContent = '***';
                el.classList.add('tm-sensitive-masked');
                el.setAttribute('title', '无权限查看');
            } else {
                restoreFieldOriginal(el);
            }
        });
    }

    var actionCaptureInstalled = false;

    function installActionCapture() {
        if (actionCaptureInstalled) return;
        actionCaptureInstalled = true;
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-action].tm-action-denied');
            if (el) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    function clearActionState(el) {
        el.classList.remove('tm-action-denied', 'tm-action-hidden', 'opacity-20', 'cursor-not-allowed');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('data-tm-action-blocked');
        if (el.tagName === 'BUTTON') el.disabled = false;
    }

    function applyActionRules(root, role) {
        installActionCapture();
        (root || document).querySelectorAll('[data-action]').forEach(function (el) {
            var action = el.getAttribute('data-action');
            clearActionState(el);
            var mode = schemaApi.getActionDenyMode(role, action);
            if (!mode) return;
            if (mode === 'hidden') {
                el.remove();
                return;
            }
            el.classList.add('tm-action-denied', 'opacity-20', 'cursor-not-allowed');
            el.setAttribute('aria-disabled', 'true');
            el.setAttribute('data-tm-action-blocked', '1');
            if (el.tagName === 'BUTTON') el.disabled = true;
        });
    }

    function applyRoleRules(root) {
        var role = currentRole();
        document.documentElement.setAttribute('data-user-role', role);
        applyActionRules(root, role);
        applyFieldRules(root, role);
        if (window.TM_RoleGate && typeof window.TM_RoleGate.apply === 'function') {
            window.TM_RoleGate.apply(root);
        }
    }

    function ensureActiveTabVisible() {
        if (window._tmSwitchingTab || window._tmEnsuringTab) return;
        if (typeof window.switchTab !== 'function') return;
        var role = currentRole();
        var hashTab = null;
        try {
            var m = (window.location.hash || '').match(/tab=([a-z]+)/i);
            if (m) hashTab = m[1];
        } catch (e) { /* ignore */ }
        var menuId = hashTab ? TAB_TO_MENU[hashTab] : null;
        if (menuId && !schemaApi.isMenuVisible(role, menuId)) {
            window._tmEnsuringTab = true;
            try {
                window.switchTab(getFirstVisibleTabForRole(role));
            } finally {
                window._tmEnsuringTab = false;
            }
        }
    }

    function applyRoleUI(options) {
        var skipTabSync = options && options.skipTabSync;
        document.documentElement.setAttribute('data-role-mask', currentRole());
        applySidebarByRole();
        applyRoleRules(document);
        if (!skipTabSync) ensureActiveTabVisible();
    }

    function canAccessTab(tabId) {
        var menuId = TAB_TO_MENU[tabId];
        if (!menuId) return false;
        return schemaApi.isMenuVisible(currentRole(), menuId);
    }

    window.applyRoleUI = applyRoleUI;
    window.TM_RoleEngine = {
        apply: applyRoleUI,
        canAccessTab: canAccessTab,
        getFirstVisibleTabForRole: getFirstVisibleTabForRole,
        currentRole: currentRole
    };

    document.addEventListener('tm-role-ui-ready', function () {
        if (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role) {
            applyRoleUI({ skipTabSync: true });
        }
    });
})();
