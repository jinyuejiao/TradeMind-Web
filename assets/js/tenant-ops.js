/**
 * 租户虚拟/实体仓与账户模式：下拉选项与首仓/首账户迁移。
 */
(function () {
    'use strict';

    var profileCache = null;
    var profilePromise = null;

    function fetchOpsProfile(force) {
        if (!force && profileCache) {
            return Promise.resolve(profileCache);
        }
        if (!force && profilePromise) {
            return profilePromise;
        }
        if (!window.wrappedFetch) {
            return Promise.resolve(null);
        }
        profilePromise = window.wrappedFetch('/api/v1/rd/tenant/ops-profile', { method: 'GET' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                profileCache = (res && res.data) ? res.data : null;
                profilePromise = null;
                return profileCache;
            })
            .catch(function () {
                profilePromise = null;
                return null;
            });
        return profilePromise;
    }

    function isVirtualInventory(p) {
        p = p || profileCache;
        return !p || p.inventoryMode === 'VIRTUAL';
    }

    function isVirtualFinance(p) {
        p = p || profileCache;
        if (!p) return true;
        if (p.accountCount != null && Number(p.accountCount) === 0) return true;
        return p.financeMode === 'VIRTUAL';
    }

    function hasSelectableAccounts(selectEl) {
        if (!selectEl || !selectEl.options) return false;
        for (var i = 0; i < selectEl.options.length; i++) {
            var v = String(selectEl.options[i].value || '').trim();
            if (v && !isNaN(parseInt(v, 10))) return true;
        }
        return false;
    }

    function buildWarehouseOptionsHtml(warehouses, profile, selectedId) {
        var list = warehouses || [];
        if (list.length > 0) {
            var html = '';
            var pick = selectedId != null && selectedId !== '' ? String(selectedId) : null;
            list.forEach(function (w, idx) {
                var id = w.warehouseId != null ? w.warehouseId : w.id;
                var name = w.name || ('仓库#' + id);
                var sel = (pick && String(id) === pick) || (!pick && idx === 0);
                html += '<option value="' + id + '"' + (sel ? ' selected' : '') + '>' + name + '</option>';
            });
            return html;
        }
        if (isVirtualInventory(profile)) {
            return '<option value="">默认仓库</option>';
        }
        return '<option value="">暂无仓库</option>';
    }

    function warehouseLabelFromSelect(selectEl, warehouses, profile) {
        if (selectEl && selectEl.value && selectEl.selectedIndex >= 0) {
            var txt = String(selectEl.options[selectEl.selectedIndex].textContent || '').trim();
            if (txt) return txt;
        }
        var list = warehouses || [];
        if (list.length > 0) {
            var w = list[0];
            var id = w.warehouseId != null ? w.warehouseId : w.id;
            return w.name || ('仓库#' + id);
        }
        return isVirtualInventory(profile) ? '默认仓库' : '暂无仓库';
    }

    function buildAccountOptionsHtml(accounts, profile, selectedId) {
        var list = accounts || [];
        if (list.length > 0) {
            var html = '';
            list.forEach(function (a, idx) {
                var id = a.accountId;
                var name = a.accountName || ('账户#' + id);
                var sel = (selectedId != null && String(selectedId) === String(id)) || (selectedId == null && idx === 0);
                html += '<option value="' + id + '"' + (sel ? ' selected' : '') + '>' + name + '</option>';
            });
            return html;
        }
        if (isVirtualFinance(profile)) {
            return '<option value="">默认账户</option>';
        }
        return '<option value="">暂无账户</option>';
    }

    function confirmMigration(title, message) {
        if (window.TM_confirm) {
            return window.TM_confirm({ title: title, message: message, confirmText: '确认迁移', cancelText: '暂不' });
        }
        return Promise.resolve(window.confirm(message));
    }

    function runWarehouseMigration(warehouseId) {
        return window.wrappedFetch('/api/v1/rd/tenant/warehouse-migration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ warehouseId: warehouseId })
        }).then(function (r) { return r.json(); });
    }

    function runAccountMigration(accountId) {
        return window.wrappedFetch('/api/v1/rd/tenant/account-migration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: accountId })
        }).then(function (r) { return r.json(); });
    }

    function maybePromptWarehouseMigration(saveResponse) {
        if (!saveResponse || !saveResponse.needsWarehouseMigration) return Promise.resolve();
        var whId = saveResponse.migrationWarehouseId;
        var name = (saveResponse.data && saveResponse.data.name) ? saveResponse.data.name : '新仓库';
        return confirmMigration(
            '归入仓库',
            '是否将以往订单出库与进货入库记录归入【' + name + '】，并将当前总库存装入该仓库？'
        ).then(function (ok) {
            if (!ok || !whId) return;
            return runWarehouseMigration(whId).then(function (res) {
                if (res && res.success) {
                    profileCache = null;
                    if (window.showToast) window.showToast('历史单据与库存已归入新仓库');
                } else if (window.showToast) {
                    window.showToast((res && res.message) || '迁移失败');
                }
            });
        });
    }

    function maybePromptAccountMigration(saveResponse, accountId) {
        var needs = saveResponse && saveResponse.needsAccountMigration;
        var accId = accountId || (saveResponse && saveResponse.migrationAccountId);
        if (!needs && !accId) return Promise.resolve();
        return confirmMigration(
            '归入账户',
            '是否将以往未关联账户的订单、进货单及流水（仅 account_id 为空的历史记录）关联到该账户？已指定其他账户的流水不会变更。'
        ).then(function (ok) {
            if (!ok || !accId) return;
            return runAccountMigration(accId).then(function (res) {
                if (res && res.success) {
                    profileCache = null;
                    var stats = (res.data && typeof res.data === 'object') ? res.data : {};
                    var ledgerN = stats.ledgerRowsUpdated != null ? stats.ledgerRowsUpdated : 0;
                    var msg = '历史单据已关联账户' + (ledgerN ? '（' + ledgerN + ' 条未归属流水）' : '');
                    if (window.showToast) window.showToast(msg);
                    var refresh = typeof window.loadBizAccounts === 'function'
                        ? window.loadBizAccounts()
                        : Promise.resolve();
                    refresh.then(function () {
                        if (typeof window.openBizAccountLedgerModal === 'function') {
                            window.openBizAccountLedgerModal(accId);
                        } else if (typeof window.loadBizAccountLedger === 'function') {
                            window.bizLedgerAccountId = accId;
                            window.loadBizAccountLedger();
                        }
                    });
                } else if (window.showToast) {
                    window.showToast((res && res.message) || '迁移失败');
                }
            });
        });
    }

    window.TM_TenantOps = {
        fetchOpsProfile: fetchOpsProfile,
        invalidateProfile: function () { profileCache = null; },
        isVirtualInventory: isVirtualInventory,
        isVirtualFinance: isVirtualFinance,
        hasSelectableAccounts: hasSelectableAccounts,
        buildWarehouseOptionsHtml: buildWarehouseOptionsHtml,
        warehouseLabelFromSelect: warehouseLabelFromSelect,
        buildAccountOptionsHtml: buildAccountOptionsHtml,
        maybePromptWarehouseMigration: maybePromptWarehouseMigration,
        maybePromptAccountMigration: maybePromptAccountMigration
    };
})();
