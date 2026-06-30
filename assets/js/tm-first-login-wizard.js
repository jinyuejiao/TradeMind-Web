/**
 * 首登行业配置向导（替代旧版新人导览）
 */
(function () {
    'use strict';

    var INDUSTRIES = [
        { code: 'GENERAL', icon: '📦', name: '通用批发', desc: '单 SKU、快速开单' },
        { code: 'CLOTHING', icon: '👟', name: '鞋服行业', desc: '颜色尺码、多规格' },
        { code: 'FOOD', icon: '🍱', name: '食品贸易', desc: '批次效期、临期预警' },
        { code: 'DIGITAL_3C', icon: '📱', name: '3C 数码', desc: '规格组合、序列号' }
    ];

    var selected = 'GENERAL';

    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) window.TM_UI.showNotification(msg, type || 'info');
        else if (window.showToast) window.showToast(msg);
    }

    function ensureRoot() {
        var root = document.getElementById('tm-first-login-wizard');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'tm-first-login-wizard';
        root.className = 'tm-first-login-wizard hidden';
        root.innerHTML =
            '<div class="tm-first-login-wizard__card" role="dialog" aria-modal="true" aria-labelledby="tm-flw-title">' +
            '<h2 id="tm-flw-title" class="tm-first-login-wizard__title">选择您的行业</h2>' +
            '<p class="tm-first-login-wizard__sub">我们将为您开启匹配的产品能力与开单界面，稍后可于设置中调整。</p>' +
            '<div class="tm-industry-card-grid" id="tm-flw-industry-grid"></div>' +
            '<button type="button" id="tm-flw-submit" class="mt-4 w-full py-3 rounded-xl bg-teal-500 text-white font-bold text-sm shadow-lg">进入 TradeMind</button>' +
            '</div>';
        document.body.appendChild(root);
        var grid = root.querySelector('#tm-flw-industry-grid');
        INDUSTRIES.forEach(function (ind) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tm-industry-card' + (ind.code === selected ? ' is-selected' : '');
            btn.dataset.code = ind.code;
            btn.innerHTML = '<div class="tm-industry-card__icon">' + ind.icon + '</div>' +
                '<div class="tm-industry-card__name">' + ind.name + '</div>' +
                '<div class="tm-industry-card__desc">' + ind.desc + '</div>';
            btn.addEventListener('click', function () {
                selected = ind.code;
                grid.querySelectorAll('.tm-industry-card').forEach(function (c) {
                    c.classList.toggle('is-selected', c.dataset.code === selected);
                });
            });
            grid.appendChild(btn);
        });
        root.querySelector('#tm-flw-submit').addEventListener('click', submitWizard);
        return root;
    }

    async function submitWizard() {
        try {
            var resp = await window.wrappedFetch('/api/v1/tenant/onboarding/complete', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ industryVertical: selected })
            });
            var data = await window.handleApiResponse(resp);
            if (!data) return;
            notify('行业配置已保存', 'success');
            document.getElementById('tm-first-login-wizard').classList.add('hidden');
            if (window.TM_loadWorkbenchProfile) await window.TM_loadWorkbenchProfile();
            if (window.TM_IndustryUI) window.TM_IndustryUI.apply(document.body, window.TM_WorkbenchProfile);
            if (window.TM_SkuCatalogCache) window.TM_SkuCatalogCache.load(null, true);
        } catch (e) {
            notify(e.message || '保存失败', 'error');
        }
    }

    window.TM_FirstLoginWizard = {
        checkAndShow: async function () {
            if (!window.wrappedFetch || !window.checkAuth || !window.checkAuth()) return;
            try {
                var resp = await window.wrappedFetch('/api/v1/tenant/onboarding/status', { method: 'GET' });
                var data = await window.handleApiResponse(resp);
                var st = data && data.data ? data.data : data;
                if (!st || !st.needsWizard) return;
                ensureRoot().classList.remove('hidden');
            } catch (e) {
                console.warn('[FirstLoginWizard]', e);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () { window.TM_FirstLoginWizard.checkAndShow(); }, 600);
    });
})();
