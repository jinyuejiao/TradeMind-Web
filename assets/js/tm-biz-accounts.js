/**
 * 商户收款账户：供极速开单、订单弹窗等共用
 */
(function () {
    'use strict';

    window.bizAccountsList = window.bizAccountsList || [];
    window.bizAccountById = window.bizAccountById || {};

    window.loadBizAccounts = async function loadBizAccounts() {
        if (!window.wrappedFetch) return [];
        try {
            var response = await window.wrappedFetch('/api/v1/im/accounts', { method: 'GET' });
            var result = await response.json().catch(function () { return {}; });
            var list = (result && result.success && Array.isArray(result.data)) ? result.data : [];
            window.bizAccountsList = list;
            window.bizAccountById = {};
            list.forEach(function (a) {
                if (a.accountId == null && a.account_id == null) return;
                var id = a.accountId != null ? a.accountId : a.account_id;
                window.bizAccountById[String(id)] = a;
            });
            return list;
        } catch (err) {
            console.warn('[TM] 加载收款账户列表失败:', err);
            window.bizAccountsList = [];
            window.bizAccountById = {};
            return [];
        }
    };

    window.TM_resolveDefaultReceiveAccountId = function () {
        var ui = window.TM_WorkbenchProfile && window.TM_WorkbenchProfile.uiProfile;
        var defAcc = ui && (ui.defaultAccountId || ui.default_account_id);
        if (defAcc) return defAcc;
        var list = window.bizAccountsList || [];
        var hit = list.find(function (a) {
            return a.isDefaultReceive === true || a.isDefaultReceive === 1 || a.isDefaultReceive === 't';
        });
        if (hit) return hit.accountId != null ? hit.accountId : hit.account_id;
        if (list.length) return list[0].accountId != null ? list[0].accountId : list[0].account_id;
        return null;
    };
})();
