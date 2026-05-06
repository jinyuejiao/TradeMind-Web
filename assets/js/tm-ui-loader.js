/**
 * TradeMind — 商户类型感知 UI：片段注入 + 上下文（对齐 UI 工程 trademind-ui-merchant-framework）
 * 须在 main-app.js（初始化 TM_UI）之后、ui-main.js 之前加载。
 */
(function () {
    'use strict';

    var INDUSTRY_DIR = {
        WHOLESALE: 'wholesale',
        FOREIGN_TRADE: 'foreign',
        ECOM: 'ecom',
        FACTORY_TRADE: 'factory'
    };

    function industryDir(code) {
        return INDUSTRY_DIR[code] || INDUSTRY_DIR.WHOLESALE;
    }

    window.TM_UI_CONTEXT = window.TM_UI_CONTEXT || { industry: 'WHOLESALE', role: null };

    function tmJwtPayload(token) {
        try {
            var parts = String(token).split('.');
            if (parts.length < 2) return null;
            var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            var json = atob(b64);
            return JSON.parse(json);
        } catch (e) {
            console.warn('[TM_UI_Loader] JWT 解析失败:', e);
            return null;
        }
    }

    function applyMerchantDomAttrs(code) {
        var el = document.documentElement;
        el.setAttribute('data-merchant-type', code || 'WHOLESALE');
        window.TM_UI_CONTEXT.industry = code || 'WHOLESALE';
    }

    Object.assign(window.TM_UI, {
        toast: function (msg, type) {
            if (window.TM_UI.showNotification) {
                window.TM_UI.showNotification(msg, type || 'success');
            }
        },

        applyContextFromToken: function (token) {
            if (!token || token === 'mock-token') {
                applyMerchantDomAttrs('WHOLESALE');
                window.TM_UI_CONTEXT.role = 'ADMIN';
                return;
            }
            var payload = tmJwtPayload(token);
            if (!payload) return;
            var mt = payload.merchantType || 'WHOLESALE';
            var role = payload.roleType || null;
            applyMerchantDomAttrs(mt);
            window.TM_UI_CONTEXT.role = role;
        },

        /**
         * 按 TM_UI_CONTEXT.industry 注入 [data-tm-fragment-scope][data-tm-slot]
         */
        injectSlots: function (root) {
            if (!root || !root.querySelectorAll) return Promise.resolve();
            var slots = root.querySelectorAll('[data-tm-slot][data-tm-fragment-scope]');
            if (!slots.length) return Promise.resolve();

            var industry = window.TM_UI_CONTEXT.industry || 'WHOLESALE';
            var dir = industryDir(industry);
            var tasks = [];

            slots.forEach(function (slotEl) {
                var scope = slotEl.getAttribute('data-tm-fragment-scope');
                var name = slotEl.getAttribute('data-tm-slot');
                if (!scope || !name) return;

                var url = '/fragments/' + dir + '/' + scope + '/' + name + '.html';
                tasks.push(
                    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
                        .then(function (res) {
                            if (!res.ok) throw new Error(res.statusText);
                            return res.text();
                        })
                        .then(function (html) {
                            var tpl = document.createElement('template');
                            tpl.innerHTML = String(html).trim();
                            slotEl.innerHTML = '';
                            slotEl.appendChild(tpl.content.cloneNode(true));
                        })
                        .catch(function () {
                            slotEl.innerHTML = '';
                        })
                );
            });

            return Promise.all(tasks);
        },

        refreshAll: function () {
            var token = localStorage.getItem('token');
            window.TM_UI.applyContextFromToken(token);
            var d = document.getElementById('view-dashboard');
            var p = document.getElementById('view-supply');
            var chain = Promise.resolve();
            if (d) chain = chain.then(function () { return window.TM_UI.injectSlots(d); });
            if (p) chain = chain.then(function () { return window.TM_UI.injectSlots(p); });
            return chain.then(function () {
                window.TM_RoleGate && window.TM_RoleGate.apply(document.body);
            });
        }
    });

    window.TM_RoleGate = {
        apply: function (root) {
            root = root || document.body;
            var role = window.TM_UI_CONTEXT.role;
            root.querySelectorAll('[data-role]').forEach(function (el) {
                var need = (el.getAttribute('data-role') || '')
                    .split(/\s+/)
                    .map(function (s) {
                        return s.trim();
                    })
                    .filter(Boolean);
                if (!need.length) return;
                if (!role || need.indexOf(role) === -1) {
                    el.remove();
                }
            });
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var token = localStorage.getItem('token');
        if (token) {
            window.TM_UI.applyContextFromToken(token);
            window.TM_RoleGate.apply(document.body);
        }
    });

    console.log('[TM_UI_Loader] 商户类型 UI 加载器就绪');
})();
