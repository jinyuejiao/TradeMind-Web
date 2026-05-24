/**
 * TradeMind — 新手导览服务端同步
 */
(function () {
    'use strict';

    var syncTimer = null;
    var SYNC_DELAY_MS = 800;

    function getApiBase() {
        return window.TM_API_BASE || '';
    }

    function parseUserInfo() {
        try {
            var raw = localStorage.getItem('user_info') || localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function getSubjectContext() {
        var u = parseUserInfo();
        var tenantId = u.tenantId != null ? String(u.tenantId) : (u.tenant_id != null ? String(u.tenant_id) : '');
        var userId = u.userId != null ? String(u.userId) : (u.user_id != null ? String(u.user_id) : '');
        var subId = null;
        var subType = 'PRIMARY';
        try {
            subId = sessionStorage.getItem('tm_auth_subuser_id');
        } catch (e) { /* ignore */ }
        if (subId) {
            return {
                tenantId: tenantId,
                subjectType: 'SUBUSER',
                subjectId: String(subId),
                actorUserId: userId
            };
        }
        return {
            tenantId: tenantId,
            subjectType: 'PRIMARY',
            subjectId: userId,
            actorUserId: userId
        };
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

    function getRoleType() {
        if (window.TmOnboarding && typeof window.TmOnboarding.getRoleCode === 'function') {
            return window.TmOnboarding.getRoleCode();
        }
        if (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role) {
            return window.TM_UI_CONTEXT.role;
        }
        var u = parseUserInfo();
        return u.roleType || u.role_type || 'ADMIN';
    }

    function buildQuery(params) {
        var parts = [];
        Object.keys(params).forEach(function (k) {
            if (params[k] == null || params[k] === '') return;
            parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
        });
        return parts.length ? '?' + parts.join('&') : '';
    }

    function fetchState(markFirstLogin) {
        var subject = getSubjectContext();
        var reg = window.TM_ONBOARDING_REGISTRY;
        var roleCode = reg && reg.resolveRoleCode ? reg.resolveRoleCode() : getRoleType();
        var q = buildQuery({
            industry: getIndustry(),
            roleType: roleCode,
            subjectType: subject.subjectType,
            subjectId: subject.subjectId,
            markFirstLogin: markFirstLogin === false ? 'false' : 'true'
        });
        var url = getApiBase() + '/api/v1/tenant/onboarding/state' + q;
        if (typeof window.wrappedFetch !== 'function') {
            return Promise.resolve(null);
        }
        return window.wrappedFetch(url, { method: 'GET' })
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .catch(function () {
                return null;
            });
    }

    function putState(snapshot) {
        var subject = getSubjectContext();
        var reg = window.TM_ONBOARDING_REGISTRY;
        var roleCode = reg && reg.resolveRoleCode ? reg.resolveRoleCode() : getRoleType();
        var body = {
            industry: getIndustry(),
            roleType: roleCode,
            subjectType: subject.subjectType,
            subjectId: subject.subjectId,
            snapshot: snapshot
        };
        var url = getApiBase() + '/api/v1/tenant/onboarding/state';
        if (typeof window.wrappedFetch !== 'function') {
            return Promise.resolve(null);
        }
        return window.wrappedFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body)
        }).catch(function () {
            return null;
        });
    }

    function schedulePut(snapshot) {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
            syncTimer = null;
            putState(snapshot);
        }, SYNC_DELAY_MS);
    }

    function readLoginBootstrap() {
        try {
            var raw = sessionStorage.getItem('tm_onboarding_bootstrap');
            if (!raw) return null;
            sessionStorage.removeItem('tm_onboarding_bootstrap');
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function stashLoginBootstrap(onboarding) {
        if (!onboarding) return;
        try {
            sessionStorage.setItem('tm_onboarding_bootstrap', JSON.stringify(onboarding));
        } catch (e) { /* ignore */ }
    }

    window.TM_ONBOARDING_SYNC = {
        getSubjectContext: getSubjectContext,
        fetchState: fetchState,
        putState: putState,
        schedulePut: schedulePut,
        readLoginBootstrap: readLoginBootstrap,
        stashLoginBootstrap: stashLoginBootstrap
    };
})();
