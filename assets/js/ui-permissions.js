/**
 * TradeMind — 角色权限与菜单可见性（导览 / 壳层共用）
 */
(function () {
    'use strict';

    var ROLE_ALIAS = {
        BOSS: 'ADMIN',
        ADMIN: 'ADMIN',
        '管理员': 'ADMIN',
        SALES: 'SALES',
        OPERATOR: 'SALES',
        '运营': 'SALES',
        WAREHOUSE: 'WAREHOUSE',
        '仓库': 'WAREHOUSE',
        FINANCE: 'FINANCE',
        '财务': 'FINANCE',
        READONLY: 'READONLY',
        '只读': 'READONLY'
    };

    var MENU_BY_ROLE = {
        ADMIN: ['dashboard', 'biz', 'crm', 'supply', 'supplier', 'member'],
        SALES: ['dashboard', 'crm', 'supply', 'supplier'],
        WAREHOUSE: ['dashboard', 'supply', 'supplier'],
        FINANCE: ['dashboard', 'biz'],
        READONLY: ['dashboard', 'crm', 'supply', 'supplier', 'biz']
    };

    var ROLE_LABELS = {
        ADMIN: { label: '管理员' },
        SALES: { label: '运营' },
        WAREHOUSE: { label: '仓库' },
        FINANCE: { label: '财务' },
        READONLY: { label: '只读' }
    };

    function normalizeRole(role) {
        var key = String(role || 'ADMIN').trim();
        var upper = key.toUpperCase();
        if (ROLE_ALIAS[key]) return ROLE_ALIAS[key];
        if (ROLE_ALIAS[upper]) return ROLE_ALIAS[upper];
        return upper;
    }

    function isMenuVisible(roleCode, menuId) {
        var code = normalizeRole(roleCode);
        var menus = MENU_BY_ROLE[code] || MENU_BY_ROLE.ADMIN;
        return menus.indexOf(menuId) !== -1;
    }

    window.TM_ROLE_SCHEMA = {
        normalizeRole: normalizeRole,
        isMenuVisible: isMenuVisible
    };

    window.TM_ROLE_PERMISSIONS = ROLE_LABELS;
})();
