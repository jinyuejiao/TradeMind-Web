/**
 * TradeMind — 角色权限映射标准 (RoleSchema)
 * 矩阵：工作台 / 智能经营 / 产品中心 / 仓库 / CRM / 供应商 / 会员 / 敏感动作
 */
(function () {
    'use strict';

    var MENU = {
        DASHBOARD: 'dashboard',
        BIZ: 'biz',
        CRM: 'crm',
        SUPPLY: 'supply',
        SUPPLIER: 'supplier',
        MEMBER: 'member'
    };

    var ACTION = {
        PRODUCT_CREATE: 'product.create',
        PRODUCT_DELETE: 'product.delete',
        PRODUCT_EDIT: 'product.edit',
        PRODUCT_CATEGORY: 'product.category.manage',
        WAREHOUSE_MANAGE: 'warehouse.manage',
        PURCHASE_ORDER: 'purchase.order.create',
        CRM_CREATE: 'crm.create',
        CRM_DELETE: 'crm.delete',
        SENSITIVE_DELETE: 'sensitive.delete',
        SENSITIVE_SETTINGS: 'sensitive.settings',
        BIZ_VIEW: 'biz.view',
        SUPPLIER_SETTLE: 'supplier.settle',
        MEMBER_MANAGE: 'member.manage',
        PRINT_ORDER: 'print.order',
        MANAGE_PRINTER: 'printer.manage'
    };

    var FIELD = {
        PURCHASE_PRICE: 'purchase_price',
        SALES_PRICE: 'sales_price'
    };

    var ROLE_ALIAS = {
        BOSS: 'ADMIN',
        OPERATOR: 'SALES',
        USER: 'SALES',
        READONLY: 'SALES',
        '运营': 'SALES',
        '管理员': 'ADMIN',
        '财务': 'FINANCE',
        '仓库': 'WAREHOUSE',
        '仓库员': 'WAREHOUSE'
    };

    var ROLE_PERMISSIONS = {
        ADMIN: {
            label: '管理员',
            visible_menus: [
                MENU.DASHBOARD, MENU.BIZ, MENU.CRM, MENU.SUPPLY,
                MENU.SUPPLIER, MENU.MEMBER
            ],
            allowed_actions: ['*'],
            masked_fields: [],
            hidden_fields: [],
            denied_actions: {}
        },
        FINANCE: {
            label: '财务',
            visible_menus: [MENU.BIZ, MENU.CRM, MENU.SUPPLY, MENU.SUPPLIER, MENU.MEMBER],
            allowed_actions: [
                ACTION.BIZ_VIEW,
                ACTION.PRODUCT_EDIT,
                ACTION.WAREHOUSE_MANAGE,
                ACTION.PURCHASE_ORDER,
                ACTION.CRM_CREATE,
                ACTION.SUPPLIER_SETTLE,
                ACTION.PRINT_ORDER
            ],
            masked_fields: [],
            hidden_fields: [],
            denied_actions: {
                [ACTION.PRODUCT_CREATE]: 'hidden',
                [ACTION.PRODUCT_DELETE]: 'hidden',
                [ACTION.SENSITIVE_DELETE]: 'hidden',
                [ACTION.SENSITIVE_SETTINGS]: 'hidden',
                [ACTION.PRODUCT_EDIT]: 'disable',
                [ACTION.PRODUCT_CATEGORY]: 'disable',
                [ACTION.CRM_DELETE]: 'hidden',
                [ACTION.MEMBER_MANAGE]: 'hidden'
            }
        },
        SALES: {
            label: '业务员',
            visible_menus: [MENU.DASHBOARD, MENU.CRM, MENU.SUPPLY],
            allowed_actions: [
                ACTION.PRODUCT_CREATE,
                ACTION.PRODUCT_EDIT,
                ACTION.PRODUCT_CATEGORY,
                ACTION.WAREHOUSE_MANAGE,
                ACTION.PURCHASE_ORDER,
                ACTION.CRM_CREATE,
                ACTION.PRINT_ORDER
            ],
            masked_fields: [],
            hidden_fields: [FIELD.PURCHASE_PRICE],
            denied_actions: {
                [ACTION.PRODUCT_DELETE]: 'hidden',
                [ACTION.SENSITIVE_DELETE]: 'hidden',
                [ACTION.SENSITIVE_SETTINGS]: 'hidden',
                [ACTION.SUPPLIER_SETTLE]: 'hidden',
                [ACTION.MEMBER_MANAGE]: 'hidden'
            }
        },
        WAREHOUSE: {
            label: '仓库员',
            visible_menus: [MENU.SUPPLY, MENU.SUPPLIER],
            allowed_actions: [
                ACTION.PRODUCT_EDIT,
                ACTION.WAREHOUSE_MANAGE,
                ACTION.PURCHASE_ORDER,
                ACTION.PRINT_ORDER
            ],
            masked_fields: [],
            hidden_fields: [FIELD.SALES_PRICE],
            denied_actions: {
                [ACTION.PRODUCT_CREATE]: 'hidden',
                [ACTION.PRODUCT_DELETE]: 'hidden',
                [ACTION.SENSITIVE_DELETE]: 'hidden',
                [ACTION.SENSITIVE_SETTINGS]: 'hidden',
                [ACTION.CRM_CREATE]: 'hidden',
                [ACTION.MEMBER_MANAGE]: 'hidden'
            }
        }
    };

    function normalizeRole(role) {
        var key = String(role || 'ADMIN').trim();
        var upper = key.toUpperCase();
        if (ROLE_ALIAS[key]) return ROLE_ALIAS[key];
        if (ROLE_ALIAS[upper]) return ROLE_ALIAS[upper];
        if (ROLE_PERMISSIONS[upper]) return upper;
        return 'SALES';
    }

    function getRoleSchema(role) {
        return ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS.ADMIN;
    }

    function hasAction(role, action) {
        var schema = getRoleSchema(role);
        var act = String(action || '').trim();
        if (!act) return true;
        if (schema.denied_actions && schema.denied_actions[act]) return false;
        var allowed = schema.allowed_actions || [];
        if (allowed.indexOf('*') !== -1) return true;
        return allowed.indexOf(act) !== -1;
    }

    function getActionDenyMode(role, action) {
        var schema = getRoleSchema(role);
        var act = String(action || '').trim();
        if (!act) return null;
        if (schema.denied_actions && schema.denied_actions[act]) {
            return schema.denied_actions[act];
        }
        if (!hasAction(role, act)) return 'disable';
        return null;
    }

    function isMenuVisible(role, menuId) {
        var schema = getRoleSchema(role);
        var menus = schema.visible_menus || [];
        return menus.indexOf(String(menuId || '').trim()) !== -1;
    }

    window.TM_ROLE_PERMISSIONS = Object.freeze(ROLE_PERMISSIONS);
    window.TM_ROLE_SCHEMA = {
        MENU: Object.freeze(MENU),
        ACTION: Object.freeze(ACTION),
        FIELD: Object.freeze(FIELD),
        get: getRoleSchema,
        normalizeRole: normalizeRole,
        hasAction: hasAction,
        getActionDenyMode: getActionDenyMode,
        isMenuVisible: isMenuVisible
    };
})();
