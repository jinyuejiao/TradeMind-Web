/**
 * TradeMind OpsService — 运维门户控制器
 *
 * === 后端 / Feign 路由契约（供网关与服务拆分对齐）===
 * GET  /api/ops/tenants/tree?industry=&sort=aiTokensMonth|subscriptionYear|revenueMonth|profitMonth — 租户树：订阅卡片、用户级 AI（合并原 summary / quota-ai）
 * POST /api/ops/tenants/{tenantId}/freeze                   — body: { frozen: boolean }
 * POST /api/ops/tenants/{tenantId}/trial-grant             — body: { months, activityType, remark }
 * PATCH /api/ops/tenants/{tenantId}/subscription-expiry   — body: { expiryDate: "ISO-date" }
 * GET  /api/ops/tenants/{tenantId}/resource-snapshot        — Feign 聚合：products, customers, suppliers
 * POST /api/ops/ai-usage/record                             — body: { tenantId, tokens, module, ts }
 * GET  /api/ops/ai-usage/rankings                           — query: period=day|week|month, drillTenantId?
 * GET  /api/ops/referrals/qualified?groupBy=referrerCode   — 有效订阅事件列表或分组：每组含 code、referrer、bank、events[]
 * GET  /api/ops/referrals/groups/{groupKey}/payee           — 推荐人收款信息（同组共用）
 * PATCH /api/ops/referrals/events/{eventId}/settlement      — body: { status: "PENDING"|"PAID" } 按单条有效订阅
 * POST /api/ops/referrals/groups/{groupKey}/settle-all-pending — 批量将组内待结标为已结（可选）
 * POST /api/ops/site-announcements                          — 或写入配置中心；前端演示用 localStorage
 * GET  /api/ops/audit-logs                                  — 敏感操作分页
 * GET/PUT /api/ops/catalog/subscription-plans             — 仅年付：priceOriginalYear、priceCurrentYear、discountLabel；discountPercentOff 由原价/现价自动推导
 */
(function () {
    'use strict';

    function gatewayBase() {
        if (typeof getApiUrl === 'function') {
            return getApiUrl('gateway');
        }
        return window.TM_API_BASE || '';
    }

    function opsUrl(path) {
        var base = gatewayBase().replace(/\/$/, '');
        return base + (path.startsWith('/') ? path : '/' + path);
    }

    function opsFetch(path, options) {
        if (typeof window.wrappedFetch !== 'function') {
            return Promise.reject(new Error('wrappedFetch 不可用'));
        }
        return window.wrappedFetch(opsUrl(path), options || {});
    }

    async function opsParseError(res) {
        var msg = res.statusText || '请求失败';
        try {
            var data = await res.json();
            if (data && data.message) msg = data.message;
            else if (data && data.error) msg = data.error;
        } catch (ignore) {
            if (res.status === 502 || res.status === 503 || res.status === 500) {
                msg = '运维服务不可用，请确认 OpsService(8085) 已启动且网关已路由 /api/v1/ops';
            }
        }
        return msg;
    }

    function rewardIdStr(r) {
        if (!r || r.id == null) return '';
        return String(r.id);
    }

    function refRewardPending(st) {
        return st === 'PAYABLE' || st === 'ACCRUED';
    }

    function refRewardStatusHtml(st) {
        if (st === 'PAID') return '<span class="text-emerald-600 font-bold">已结算</span>';
        if (st === 'REJECTED') return '<span class="text-rose-600 font-bold">已驳回</span>';
        return '<span class="text-amber-600 font-bold">待结算</span>';
    }

    function refFormatTime(v) {
        if (v == null || v === '') return '—';
        return String(v).replace('T', ' ').slice(0, 10);
    }

    function refMaskPhone(phone) {
        if (!phone) return '—';
        var p = String(phone);
        if (p.length >= 11) return p.slice(0, 3) + '****' + p.slice(-4);
        return p;
    }

    function refBuildPayeeBlock(r) {
        if (!r) return '（无数据）';
        var lines = [];
        if (r.real_name) lines.push('姓名：' + r.real_name);
        if (r.phone) lines.push('手机：' + r.phone);
        if (r.email) lines.push('邮箱：' + r.email);
        var type = r.payout_pay_type ? String(r.payout_pay_type) : '';
        if (type === 'bank' || r.payout_bank_name || (type === '' && r.payout_account_no)) {
            lines.push('收款方式：银行卡');
            if (r.payout_bank_name) lines.push('开户行：' + r.payout_bank_name);
            if (r.payout_account_name) lines.push('户名：' + r.payout_account_name);
            if (r.payout_account_no) lines.push('账号：' + r.payout_account_no);
        } else if (type === 'alipay') {
            lines.push('收款方式：支付宝');
            if (r.payout_account_name) lines.push('户名：' + r.payout_account_name);
            if (r.payout_account_no) lines.push('账号：' + r.payout_account_no);
        } else if (type === 'wechat') {
            lines.push('收款方式：微信');
            if (r.payout_account_name) lines.push('户名：' + r.payout_account_name);
            if (r.payout_account_no) lines.push('账号：' + r.payout_account_no);
        } else if (r.payout_account_no || r.payout_account_name) {
            if (r.payout_account_name) lines.push('户名：' + r.payout_account_name);
            if (r.payout_account_no) lines.push('账号：' + r.payout_account_no);
        }
        if (r.payout_verified === true || r.payout_verified === 't') {
            lines.push('（用户已核实收款信息）');
        }
        return lines.length ? lines.join('\n') : '（未登记提现收款信息，请电话联系推荐人）';
    }

    function refContactCell(r) {
        var phone = r && r.phone ? String(r.phone) : '';
        var parts = [];
        if (phone) {
            parts.push(
                '<a href="tel:' + escapeHtml(phone) + '" class="text-ops-700 font-bold hover:underline whitespace-nowrap" title="点击拨号">' +
                escapeHtml(refMaskPhone(phone)) + '</a>'
            );
        } else {
            parts.push('<span class="text-slate-400">无手机</span>');
        }
        if (r && r.email) {
            parts.push('<div class="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]" title="' + escapeHtml(String(r.email)) + '">' + escapeHtml(String(r.email)) + '</div>');
        }
        return parts.join('');
    }

    var AUDIT_KEY = 'tm_ops_audit_log_v1';
    var ANNOUNCE_KEY = 'tm_ops_site_announcement_v1';
    var TENANTS_KEY = 'tm_ops_demo_tenants_v1';
    var REFERRAL_KEY = 'tm_ops_demo_referrals_v1';
    var refExpandedGroupKeys = new Set();
    var selectedBankGroupKey = '';

    var ROUTES = {
        tenants: { file: './modules/ops/tenants-quota-tree.html', title: '租户看板' },
        publish: { file: './modules/ops/publish-center.html', title: '内容与定价' },
        promoters: { file: './modules/ops/promoters-hub.html', title: '推广运营' },
        feedback: { file: './modules/ops/merchant-feedback.html', title: '用户问题' },
        plans: { file: './modules/ops/publish-center.html', title: '内容与定价' },
        referral: { file: './modules/ops/promoters-hub.html', title: '推广运营' },
        announce: { file: './modules/ops/publish-center.html', title: '内容与定价' }
    };

    var industryLabel = { WHOLESALE: '批发', FOREIGN: '外贸', ECOM: '电商', FACTORY: '工贸一体' };
    var verticalLabel = { GENERAL: '通用', CLOTHING: '服装', FOOD: '食品', DIGITAL_3C: '3C数码', PENDING: '待选定' };
    var MERCHANT_UI_TO_API = { WHOLESALE: 'WHOLESALE', FOREIGN: 'FOREIGN_TRADE', ECOM: 'ECOM', FACTORY: 'FACTORY_TRADE' };
    var MERCHANT_API_TO_UI = { WHOLESALE: 'WHOLESALE', FOREIGN_TRADE: 'FOREIGN', ECOM: 'ECOM', FACTORY_TRADE: 'FACTORY' };
    var TIER_LABEL = { TRIAL: '试用', BASIC: '启航', PREMIUM: '优享', ENTERPRISE: '企业' };

    function toMerchantApiKey(uiKey) {
        if (!uiKey || uiKey === 'ALL') return uiKey;
        return MERCHANT_UI_TO_API[uiKey] || uiKey;
    }

    function toMerchantUiKey(apiKey) {
        if (!apiKey) return 'WHOLESALE';
        return MERCHANT_API_TO_UI[apiKey] || apiKey;
    }

    function opsNotify(msg, type) {
        if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, type || 'info');
            return;
        }
        alert(msg);
    }

    function normalizeOpsRoute(route) {
        if (route === 'referral' || route === 'promoters') return 'promoters';
        if (route === 'plans' || route === 'announce' || route === 'publish') return 'publish';
        if (route === 'quota-ai' || route === 'lifecycle' || route === 'tenants-lifecycle' || route === 'metering') return 'tenants';
        return route;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function loadAudit() {
        try {
            var raw = localStorage.getItem(AUDIT_KEY);
            var a = raw ? JSON.parse(raw) : [];
            return Array.isArray(a) ? a : [];
        } catch (e) {
            return [];
        }
    }

    function appendAudit(action, detail) {
        var list = loadAudit();
        list.unshift({
            ts: nowIso(),
            operator: 'ops@platform',
            action: action,
            detail: detail || ''
        });
        if (list.length > 200) list = list.slice(0, 200);
        try {
            localStorage.setItem(AUDIT_KEY, JSON.stringify(list));
        } catch (e) { /* ignore */ }
    }

    function loadTenants() {
        try {
            var raw = localStorage.getItem(TENANTS_KEY);
            if (raw) {
                var t = JSON.parse(raw);
                if (Array.isArray(t) && t.length) return t;
            }
        } catch (e) { /* ignore */ }
        return [
            { id: 't-wh-001', name: '华南灯具批发', industry: 'WHOLESALE', frozen: false, expiry: '2026-08-01', users: 42, roles: { admin: 2, ops: 5, other: 35 } },
            { id: 't-fr-002', name: '远航外贸', industry: 'FOREIGN', frozen: false, expiry: '2026-12-15', users: 28, roles: { admin: 1, ops: 3, other: 24 } },
            { id: 't-ec-003', name: '跨境小铺 A', industry: 'ECOM', frozen: true, expiry: '2026-03-01', users: 12, roles: { admin: 1, ops: 2, other: 9 } },
            { id: 't-fa-004', name: '精工制造工贸', industry: 'FACTORY', frozen: false, expiry: '2027-01-10', users: 86, roles: { admin: 3, ops: 12, other: 71 } },
            { id: 't-wh-005', name: '义乌百货联盟', industry: 'WHOLESALE', frozen: false, expiry: '2026-06-20', users: 19, roles: { admin: 1, ops: 1, other: 17 } }
        ];
    }

    function saveTenants(list) {
        try {
            localStorage.setItem(TENANTS_KEY, JSON.stringify(list));
        } catch (e) { /* ignore */ }
    }

    function defaultReferrals() {
        var jinBank = '开户行：招商银行深圳分行\n户名：Jin\n账号：6225 **** **** 9012';
        var liBank = '开户行：工商银行广州支行\n户名：Li Wei\n账号：3602 **** **** 4411';
        return [
            { id: 'ref-evt-001', code: 'GIGA-JIN-8821', referrer: 'Jin', refereeTenant: '跨境小铺 A', firstSubAt: '2026-04-02T10:00:00.000Z', settlement: 'PENDING', bank: jinBank },
            { id: 'ref-evt-002', code: 'GIGA-JIN-8821', referrer: 'Jin', refereeTenant: '精工制造工贸', firstSubAt: '2026-04-18T09:20:00.000Z', settlement: 'PENDING', bank: jinBank },
            { id: 'ref-evt-003', code: 'GIGA-JIN-8821', referrer: 'Jin', refereeTenant: '义乌百货联盟', firstSubAt: '2026-05-06T11:00:00.000Z', settlement: 'PAID', bank: jinBank },
            { id: 'ref-evt-004', code: 'TM-778201', referrer: 'Li Wei', refereeTenant: '华南灯具批发', firstSubAt: '2026-05-01T14:30:00.000Z', settlement: 'PAID', bank: liBank },
            { id: 'ref-evt-005', code: 'TM-778201', referrer: 'Li Wei', refereeTenant: '远航外贸', firstSubAt: '2026-05-09T16:45:00.000Z', settlement: 'PENDING', bank: liBank }
        ];
    }

    function referralGroupKeyFromEvent(e) {
        return String(e.code || '') + '\u0000' + String(e.referrer || '');
    }

    function groupReferralEvents(events) {
        var m = {};
        events.forEach(function (e) {
            var k = referralGroupKeyFromEvent(e);
            if (!m[k]) {
                m[k] = { key: k, code: e.code, referrer: e.referrer, bank: String(e.bank || ''), records: [] };
            }
            m[k].records.push(e);
            if (e.bank) m[k].bank = String(e.bank);
        });
        return Object.keys(m).map(function (k) {
            return m[k];
        }).sort(function (a, b) {
            return b.records.length - a.records.length || a.code.localeCompare(b.code);
        });
    }

    function encodeGroupKey(k) {
        return encodeURIComponent(k);
    }

    function decodeGroupKey(enc) {
        try {
            return decodeURIComponent(enc);
        } catch (err) {
            return '';
        }
    }

    function loadReferrals() {
        try {
            var raw = localStorage.getItem(REFERRAL_KEY);
            if (raw) {
                var r = JSON.parse(raw);
                if (Array.isArray(r) && r.length) return r;
            }
        } catch (e) { /* ignore */ }
        return defaultReferrals();
    }

    function saveReferrals(list) {
        try {
            localStorage.setItem(REFERRAL_KEY, JSON.stringify(list));
        } catch (e) { /* ignore */ }
    }

    var mockQuotaByTenant = [
        { name: '精工制造工贸', products: 8420, customers: 1205, suppliers: 318 },
        { name: '华南灯具批发', products: 2100, customers: 890, suppliers: 56 },
        { name: '远航外贸', products: 980, customers: 420, suppliers: 120 },
        { name: '跨境小铺 A', products: 5600, customers: 3100, suppliers: 12 },
        { name: '义乌百货联盟', products: 12000, customers: 450, suppliers: 88 }
    ];

    var mockAiRank = {
        day: [
            { tenant: '精工制造工贸', tokens: 420000, extract: 280000, chat: 140000 },
            { tenant: '跨境小铺 A', tokens: 310000, extract: 200000, chat: 110000 },
            { tenant: '华南灯具批发', tokens: 120000, extract: 90000, chat: 30000 }
        ],
        week: [
            { tenant: '精工制造工贸', tokens: 2100000, extract: 1400000, chat: 700000 },
            { tenant: '华南灯具批发', tokens: 980000, extract: 720000, chat: 260000 },
            { tenant: '远航外贸', tokens: 760000, extract: 500000, chat: 260000 }
        ],
        month: [
            { tenant: '精工制造工贸', tokens: 8900000, extract: 5200000, chat: 3700000 },
            { tenant: '跨境小铺 A', tokens: 6200000, extract: 4100000, chat: 2100000 },
            { tenant: '华南灯具批发', tokens: 4100000, extract: 3000000, chat: 1100000 },
            { tenant: '远航外贸', tokens: 2800000, extract: 1700000, chat: 1100000 },
            { tenant: '义乌百货联盟', tokens: 1500000, extract: 900000, chat: 600000 }
        ]
    };

    var PLAN_CATALOG_MERCHANT_KEYS = ['WHOLESALE', 'FOREIGN', 'ECOM', 'FACTORY'];
    var PLAN_CATALOG_STORAGE_KEY = 'tm_ops_subscription_catalog_v1';

    /** 订阅档位出厂默认（仅年付：原价 / 现价；减免比例存库时自动按二者计算） */
    var DEFAULT_PLAN_CATALOG = {
        WHOLESALE: [
            { id: 'plan-wh-1', name: '启航会员', priceOriginalYear: 1990, priceCurrentYear: 1990, discountLabel: '', promoNote: '', maxUsers: 5, maxProducts: 3000, maxSuppliers: 80, maxCustomers: 1200 },
            { id: 'plan-wh-2', name: '专业会员', priceOriginalYear: 3990, priceCurrentYear: 3990, discountLabel: '', promoNote: '', maxUsers: 15, maxProducts: 12000, maxSuppliers: 200, maxCustomers: 8000 },
            { id: 'plan-wh-3', name: '旗舰会员', priceOriginalYear: 8990, priceCurrentYear: 8990, discountLabel: '', promoNote: '', maxUsers: 50, maxProducts: 50000, maxSuppliers: 500, maxCustomers: 30000 }
        ],
        FOREIGN: [
            { id: 'plan-fr-1', name: '启航会员', priceOriginalYear: 2990, priceCurrentYear: 2990, discountLabel: '', promoNote: '', maxUsers: 5, maxProducts: 5000, maxSuppliers: 150, maxCustomers: 2500 },
            { id: 'plan-fr-2', name: '跨境专业版', priceOriginalYear: 5990, priceCurrentYear: 5990, discountLabel: '', promoNote: '', maxUsers: 20, maxProducts: 20000, maxSuppliers: 400, maxCustomers: 12000 },
            { id: 'plan-fr-3', name: '全球旗舰版', priceOriginalYear: 12990, priceCurrentYear: 12990, discountLabel: '', promoNote: '', maxUsers: 60, maxProducts: 80000, maxSuppliers: 800, maxCustomers: 50000 }
        ],
        ECOM: [
            { id: 'plan-ec-1', name: '启航会员', priceOriginalYear: 2490, priceCurrentYear: 2490, discountLabel: '', promoNote: '', maxUsers: 8, maxProducts: 50000, maxSuppliers: 40, maxCustomers: 15000 },
            { id: 'plan-ec-2', name: '店群专业版', priceOriginalYear: 4990, priceCurrentYear: 4990, discountLabel: '', promoNote: '', maxUsers: 25, maxProducts: 200000, maxSuppliers: 120, maxCustomers: 80000 },
            { id: 'plan-ec-3', name: '多平台旗舰版', priceOriginalYear: 9990, priceCurrentYear: 9990, discountLabel: '', promoNote: '', maxUsers: 80, maxProducts: 800000, maxSuppliers: 300, maxCustomers: 300000 }
        ],
        FACTORY: [
            { id: 'plan-fa-1', name: '启航会员', priceOriginalYear: 2590, priceCurrentYear: 2590, discountLabel: '', promoNote: '', maxUsers: 6, maxProducts: 8000, maxSuppliers: 300, maxCustomers: 1500 },
            { id: 'plan-fa-2', name: '产销协同版', priceOriginalYear: 5290, priceCurrentYear: 5290, discountLabel: '', promoNote: '', maxUsers: 18, maxProducts: 35000, maxSuppliers: 800, maxCustomers: 6000 },
            { id: 'plan-fa-3', name: '工贸旗舰版', priceOriginalYear: 10990, priceCurrentYear: 10990, discountLabel: '', promoNote: '', maxUsers: 55, maxProducts: 120000, maxSuppliers: 2000, maxCustomers: 25000 }
        ]
    };

    function cloneDefaultPlanCatalog() {
        var o = JSON.parse(JSON.stringify(DEFAULT_PLAN_CATALOG));
        PLAN_CATALOG_MERCHANT_KEYS.forEach(function (k) {
            o[k] = (o[k] || []).map(function (item) {
                return normalizePlan(item);
            });
        });
        return o;
    }

    /** 由原价、现价推导标价减免比例（百分比整数，现价≥原价时为 0） */
    function computeDiscountPercentFromYearPrices(originalYear, currentYear) {
        var o = Math.max(0, parseInt(originalYear, 10) || 0);
        var c = Math.max(0, parseInt(currentYear, 10) || 0);
        if (o <= 0 || c >= o) return 0;
        var off = Math.round((1 - c / o) * 100);
        return Math.min(99, Math.max(0, off));
    }

    /** 兼容旧字段：仅年付场景下等价于原价 */
    function effectivePlanPrice(listPrice, discountPercentOff) {
        var p = Number(listPrice) || 0;
        var off = Math.min(99, Math.max(0, parseInt(discountPercentOff, 10) || 0));
        return Math.max(0, Math.round(p * (100 - off) / 100));
    }

    function normalizePlan(raw, stableIdFallback) {
        var p = raw && typeof raw === 'object' ? raw : {};
        var rawId = p.id != null ? String(p.id).trim() : '';
        var fb = stableIdFallback != null ? String(stableIdFallback).trim() : '';
        var id = rawId || fb || ('plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));

        var origY = Math.max(0, parseInt(p.priceOriginalYear, 10) || 0);
        if (!origY) origY = Math.max(0, parseInt(p.priceYearly, 10) || 0);

        var curY = Math.max(0, parseInt(p.priceCurrentYear, 10) || 0);
        if (!curY && origY) {
            var legacyOff = Math.min(99, Math.max(0, parseInt(p.discountPercentOff, 10) || 0));
            curY = Math.round(origY * (100 - legacyOff) / 100);
        }
        if (!curY) curY = origY;

        if (curY > origY && origY > 0) curY = origY;

        var off = computeDiscountPercentFromYearPrices(origY, curY);

        return {
            id: id,
            name: String(p.name || '未命名套餐').trim() || '未命名套餐',
            tierCode: p.tierCode != null ? String(p.tierCode) : '',
            priceOriginalYear: origY,
            priceCurrentYear: curY,
            discountPercentOff: off,
            discountLabel: String(p.discountLabel != null ? p.discountLabel : '').trim(),
            promoNote: String(p.promoNote != null ? p.promoNote : '').trim(),
            maxUsers: Math.max(0, parseInt(p.maxUsers, 10) || 0),
            maxProducts: Math.max(0, parseInt(p.maxProducts, 10) || 0),
            maxSuppliers: Math.max(0, parseInt(p.maxSuppliers, 10) || 0),
            maxCustomers: Math.max(0, parseInt(p.maxCustomers, 10) || 0),
            priceYearly: origY,
            priceMonthly: 0,
            billingPeriodSuffix: String(p.billingPeriodSuffix != null ? p.billingPeriodSuffix : '/ 年')
        };
    }

    function loadSubscriptionCatalog() {
        var base = cloneDefaultPlanCatalog();
        try {
            var stored = localStorage.getItem(PLAN_CATALOG_STORAGE_KEY);
            if (!stored) return base;
            var o = JSON.parse(stored);
            if (!o || typeof o !== 'object') return base;
            PLAN_CATALOG_MERCHANT_KEYS.forEach(function (k) {
                if (Array.isArray(o[k]) && o[k].length) {
                    base[k] = o[k].map(function (item, idx) {
                        return normalizePlan(item, 'mig-' + k + '-' + idx);
                    });
                }
            });
            return base;
        } catch (e) {
            return base;
        }
    }

    function saveSubscriptionCatalog(catalog) {
        try {
            localStorage.setItem(PLAN_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
        } catch (e) { /* ignore */ }
    }

    var currentIndustry = 'ALL';
    var currentVertical = 'ALL';

    function el(id) {
        return document.getElementById(id);
    }

    function setActiveNav(route) {
        document.querySelectorAll('.tm-ops-nav-btn').forEach(function (btn) {
            var r = btn.getAttribute('data-ops-route');
            if (r === route) {
                btn.classList.add('tm-ops-nav-active');
            } else {
                btn.classList.remove('tm-ops-nav-active');
            }
        });
        if (typeof window.TM_syncOpsNavActive === 'function') {
            window.TM_syncOpsNavActive(route);
        } else {
            var titleEl = el('tm-ops-page-title');
            if (titleEl && ROUTES[route]) titleEl.textContent = ROUTES[route].title;
        }
    }

    function fetchHtml(url) {
        return fetch(url, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error(res.statusText);
            return res.text();
        });
    }

    function loadModule(route) {
        var cfg = ROUTES[route];
        if (!cfg) return Promise.resolve();
        var root = el('tm-ops-view-root');
        if (!root) return Promise.resolve();
        root.scrollTop = 0;
        var contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.scrollTop = 0;
        }
        setActiveNav(route);
        return fetchHtml(cfg.file + '?t=' + Date.now()).then(function (html) {
            root.innerHTML = html;
            if (route === 'tenants') initTenantsQuotaTreePage();
            else if (route === 'publish' || route === 'plans' || route === 'announce') initPublishCenterPage(route);
            else if (route === 'promoters' || route === 'referral') initPromotersHubPage(route);
            else if (route === 'feedback') initFeedbackPage();
        }).catch(function () {
            root.innerHTML = '<div class="tm-ops-glass rounded-tm-3xl p-8 text-center text-rose-600 text-sm">模块加载失败：' + cfg.file + '</div>';
        });
    }

    function formatTokens(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function initPlanCatalogPage() {
        if (typeof window.wrappedFetch === 'function') {
            initPlanCatalogPageLive();
            return;
        }
        var catalog = loadSubscriptionCatalog();
        var currentMerchant = 'WHOLESALE';

        function persist(detail) {
            saveSubscriptionCatalog(catalog);
            appendAudit('PLAN_CATALOG_UPDATE', (detail || '') + ' merchant=' + currentMerchant);
            var hint = el('ops-plan-save-hint');
            if (hint) {
                hint.textContent = '已保存 · ' + new Date().toLocaleString();
                hint.classList.remove('text-slate-400');
                hint.classList.add('text-emerald-600', 'font-bold');
            }
        }

        function renderTabs() {
            var root = el('ops-plan-merchant-tabs');
            if (!root) return;
            root.querySelectorAll('.ops-plan-tab').forEach(function (btn) {
                var m = btn.getAttribute('data-merchant');
                var on = m === currentMerchant;
                btn.className = on
                    ? 'ops-plan-tab px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md'
                    : 'ops-plan-tab px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
            });
            var lbl = el('ops-plan-merchant-label');
            if (lbl) lbl.textContent = industryLabel[currentMerchant] || currentMerchant;
        }

        function renderTable() {
            var tbody = el('ops-plan-table-body');
            if (!tbody) return;
            var rows = catalog[currentMerchant] || [];
            tbody.innerHTML = rows.map(function (p) {
                var orig = p.priceOriginalYear != null ? p.priceOriginalYear : p.priceYearly || 0;
                var cur = p.priceCurrentYear != null ? p.priceCurrentYear : orig;
                var off = computeDiscountPercentFromYearPrices(orig, cur);
                var zhe = orig > 0 ? (Math.round((cur / orig) * 1000) / 100).toFixed(1) : '—';
                var discCell = off > 0
                    ? ('<span class="font-black text-rose-600">约 −' + off + '%</span>' +
                        '<div class="text-[10px] text-slate-500 mt-0.5">约合 ' + zhe + ' 折</div>' +
                        (p.discountLabel ? '<div class="text-[10px] text-slate-500 mt-0.5 max-w-[160px] leading-snug">' + escapeHtml(p.discountLabel) + '</div>' : ''))
                    : ('<span class="text-slate-400">无</span>' +
                        (p.discountLabel ? '<div class="text-[10px] text-slate-500 mt-0.5 max-w-[160px] leading-snug">' + escapeHtml(p.discountLabel) + '</div>' : ''));
                return (
                    '<tr class="hover:bg-ops-50/50">' +
                    '<td class="px-4 py-3 font-semibold text-slate-800">' + escapeHtml(p.name) + '</td>' +
                    '<td class="px-4 py-3 font-mono text-slate-600">¥' + escapeHtml(String(orig)) + '<span class="text-slate-400 font-normal text-[10px]">/年</span></td>' +
                    '<td class="px-4 py-3 font-mono text-ops-800 font-bold">¥' + escapeHtml(String(cur)) + '<span class="text-slate-400 font-normal text-[10px]">/年</span></td>' +
                    '<td class="px-4 py-3">' + discCell + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono text-slate-800">' + escapeHtml(String(p.maxUsers)) + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono text-slate-700">' + escapeHtml(String(p.maxProducts)) + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono text-slate-700">' + escapeHtml(String(p.maxSuppliers)) + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono text-slate-700">' + escapeHtml(String(p.maxCustomers)) + '</td>' +
                    '<td class="px-4 py-3 text-right whitespace-nowrap">' +
                    '<button type="button" class="ops-plan-edit px-3 py-1.5 rounded-xl text-[10px] font-bold bg-ops-50 text-ops-700 border border-ops-200 hover:bg-ops-100" data-plan-id="' + escapeHtml(p.id) + '">编辑</button>' +
                    '</td></tr>'
                );
            }).join('');
        }

        function refresh() {
            renderTabs();
            renderTable();
        }

        function openPlanModal(planId) {
            var modal = el('ops-plan-modal');
            var delBtn = el('ops-plan-modal-delete');
            var title = el('ops-plan-modal-title');
            var idField = el('ops-plan-modal-plan-id');
            if (!modal || !idField) return;
            var list = catalog[currentMerchant] || [];
            var isNew = !planId;
            var p = isNew ? {} : list.find(function (x) {
                return x.id === planId;
            });
            if (!isNew && !p) return;
            idField.value = isNew ? '' : planId;
            if (title) title.textContent = isNew ? '新增档位' : '编辑套餐';
            if (delBtn) {
                delBtn.classList.toggle('hidden', isNew);
            }
            el('ops-plan-field-name').value = p && p.name ? p.name : '';
            var origOpen = p && (p.priceOriginalYear != null ? p.priceOriginalYear : p.priceYearly);
            var curOpen = p && (p.priceCurrentYear != null ? p.priceCurrentYear : origOpen);
            el('ops-plan-field-price-original-y').value = origOpen != null ? origOpen : 0;
            el('ops-plan-field-price-current-y').value = curOpen != null ? curOpen : 0;
            el('ops-plan-field-discount-label').value = p && p.discountLabel ? p.discountLabel : '';
            el('ops-plan-field-promo-note').value = p && p.promoNote ? p.promoNote : '';
            el('ops-plan-field-max-users').value = p && p.maxUsers != null ? p.maxUsers : 0;
            el('ops-plan-field-max-products').value = p && p.maxProducts != null ? p.maxProducts : 0;
            el('ops-plan-field-max-suppliers').value = p && p.maxSuppliers != null ? p.maxSuppliers : 0;
            el('ops-plan-field-max-customers').value = p && p.maxCustomers != null ? p.maxCustomers : 0;
            updateModalPreview();
            modal.classList.remove('hidden');
        }

        function closePlanModal() {
            var modal = el('ops-plan-modal');
            if (modal) modal.classList.add('hidden');
        }

        function readModalPlan() {
            return normalizePlan({
                id: el('ops-plan-modal-plan-id').value.trim(),
                name: el('ops-plan-field-name').value,
                priceOriginalYear: el('ops-plan-field-price-original-y').value,
                priceCurrentYear: el('ops-plan-field-price-current-y').value,
                discountLabel: el('ops-plan-field-discount-label').value,
                promoNote: el('ops-plan-field-promo-note').value,
                maxUsers: el('ops-plan-field-max-users').value,
                maxProducts: el('ops-plan-field-max-products').value,
                maxSuppliers: el('ops-plan-field-max-suppliers').value,
                maxCustomers: el('ops-plan-field-max-customers').value
            });
        }

        function updateModalPreview() {
            var pv = el('ops-plan-modal-discount-auto');
            if (!pv) return;
            var o = Math.max(0, parseInt(el('ops-plan-field-price-original-y').value, 10) || 0);
            var cRaw = Math.max(0, parseInt(el('ops-plan-field-price-current-y').value, 10) || 0);
            var c = o > 0 ? Math.min(o, cRaw) : cRaw;
            if (o <= 0) {
                pv.textContent = '请填写年付原价后，系统将自动根据原价与现价计算减免比例。';
                return;
            }
            if (cRaw > o) {
                pv.textContent = '现价高于原价时，保存后将按无溢价处理（现价=原价），减免 0%（10.0 折）。';
                return;
            }
            var off = computeDiscountPercentFromYearPrices(o, c);
            var zhe = (Math.round((c / o) * 1000) / 100).toFixed(1);
            pv.textContent = '基于年付原价 ¥' + o + ' 与现价 ¥' + c + '，系统自动减免约 ' + off + '%（约合 ' + zhe + ' 折）。保存时写入该比例。';
        }

        function saveFromModal() {
            var row = readModalPlan();
            var list = catalog[currentMerchant] || (catalog[currentMerchant] = []);
            var existingId = el('ops-plan-modal-plan-id').value.trim();
            if (!existingId) {
                list.push(row);
                persist('新增 id=' + row.id + ' ' + row.name);
            } else {
                var idx = list.findIndex(function (x) {
                    return x.id === existingId;
                });
                if (idx < 0) return;
                row.id = existingId;
                list[idx] = row;
                persist('更新 id=' + row.id + ' ' + row.name);
            }
            closePlanModal();
            refresh();
        }

        function deleteFromModal() {
            var existingId = el('ops-plan-modal-plan-id').value.trim();
            if (!existingId) return;
            if (!confirm('确定删除该档位？')) return;
            var list = catalog[currentMerchant] || [];
            catalog[currentMerchant] = list.filter(function (x) {
                return x.id !== existingId;
            });
            persist('删除 id=' + existingId);
            closePlanModal();
            refresh();
        }

        var tabRoot = el('ops-plan-merchant-tabs');
        if (tabRoot) {
            tabRoot.addEventListener('click', function (e) {
                var b = e.target.closest('[data-merchant]');
                if (!b) return;
                currentMerchant = b.getAttribute('data-merchant') || 'WHOLESALE';
                refresh();
            });
        }

        var tbody = el('ops-plan-table-body');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var ed = e.target.closest('.ops-plan-edit');
                if (!ed) return;
                openPlanModal(ed.getAttribute('data-plan-id'));
            });
        }

        var btnAdd = el('ops-plan-btn-add');
        if (btnAdd) btnAdd.addEventListener('click', function () {
            openPlanModal(null);
        });

        var btnReset = el('ops-plan-btn-reset-merchant');
        if (btnReset) {
            btnReset.addEventListener('click', function () {
                if (!confirm('将「' + (industryLabel[currentMerchant] || currentMerchant) + '」下所有档位恢复为系统默认（当前编辑会丢失），确定？')) return;
                catalog[currentMerchant] = (cloneDefaultPlanCatalog()[currentMerchant] || []).map(normalizePlan);
                persist('恢复默认');
                refresh();
            });
        }

        var modal = el('ops-plan-modal');
        var mclose = el('ops-plan-modal-close');
        if (mclose) mclose.addEventListener('click', closePlanModal);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closePlanModal();
            });
        }
        var msave = el('ops-plan-modal-save');
        if (msave) msave.addEventListener('click', saveFromModal);
        var mdel = el('ops-plan-modal-delete');
        if (mdel) mdel.addEventListener('click', deleteFromModal);

        ['ops-plan-field-price-original-y', 'ops-plan-field-price-current-y'].forEach(function (fid) {
            var node = el(fid);
            if (node) node.addEventListener('input', updateModalPreview);
        });

        refresh();
    }

    function initPlanCatalogPageLive() {
        var catalog = {};
        var currentMerchant = 'WHOLESALE';

        function apiPlansForUi() {
            return catalog[currentMerchant] || [];
        }

        async function loadCatalogFromApi() {
            var hint = el('ops-plan-save-hint');
            if (hint) hint.textContent = '加载中…';
            try {
                var res = await opsFetch('/api/v1/ops/catalog/subscription-plans?merchantType=' + encodeURIComponent(toMerchantApiKey(currentMerchant)), { method: 'GET' });
                var data = await res.json();
                if (!res.ok) throw new Error((data && data.message) || '加载失败');
                catalog[currentMerchant] = (Array.isArray(data) ? data : []).map(function (p) {
                    return normalizePlan({
                        id: p.planId || p.plan_id,
                        name: p.displayName || p.name,
                        tierCode: p.tierCode || p.tier_code,
                        priceOriginalYear: p.priceOriginalYear != null ? p.priceOriginalYear : p.originalPriceCny,
                        priceCurrentYear: p.priceCurrentYear != null ? p.priceCurrentYear : p.listPriceCny,
                        discountLabel: p.discountLabel,
                        promoNote: p.promoNote,
                        maxUsers: p.maxUsers,
                        maxProducts: p.maxProducts,
                        maxSuppliers: p.maxSuppliers,
                        maxCustomers: p.maxCustomers
                    }, p.planId);
                });
                if (hint) hint.textContent = '已同步数据库 · ' + new Date().toLocaleString();
            } catch (e) {
                if (hint) hint.textContent = '加载失败: ' + e.message;
                catalog[currentMerchant] = [];
            }
            refresh();
        }

        function renderTabs() {
            var root = el('ops-plan-merchant-tabs');
            if (!root) return;
            root.querySelectorAll('.ops-plan-tab').forEach(function (btn) {
                var m = btn.getAttribute('data-merchant');
                var on = m === currentMerchant;
                btn.className = on
                    ? 'ops-plan-tab px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md'
                    : 'ops-plan-tab px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
            });
            var lbl = el('ops-plan-merchant-label');
            if (lbl) lbl.textContent = industryLabel[currentMerchant] || currentMerchant;
        }

        function renderTable() {
            var tbody = el('ops-plan-table-body');
            if (!tbody) return;
            var rows = apiPlansForUi();
            tbody.innerHTML = rows.map(function (p) {
                var orig = p.priceOriginalYear != null ? p.priceOriginalYear : 0;
                var cur = p.priceCurrentYear != null ? p.priceCurrentYear : orig;
                var off = computeDiscountPercentFromYearPrices(orig, cur);
                var tier = TIER_LABEL[p.tierCode] || p.tierCode || '—';
                var discCell = off > 0 ? ('<span class="font-black text-rose-600">−' + off + '%</span>') : '<span class="text-slate-400">无</span>';
                return '<tr class="hover:bg-ops-50/50">' +
                    '<td class="px-4 py-3 font-mono text-[10px] text-slate-500">' + escapeHtml(tier) + '</td>' +
                    '<td class="px-4 py-3 font-semibold text-slate-800">' + escapeHtml(p.name) + '</td>' +
                    '<td class="px-4 py-3 font-mono">¥' + orig + '</td>' +
                    '<td class="px-4 py-3 font-mono text-ops-800 font-bold">¥' + cur + '</td>' +
                    '<td class="px-4 py-3">' + discCell + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono">' + p.maxUsers + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono">' + p.maxProducts + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono">' + p.maxSuppliers + '</td>' +
                    '<td class="px-4 py-3 text-right font-mono">' + p.maxCustomers + '</td>' +
                    '<td class="px-4 py-3 text-right"><button type="button" class="ops-plan-edit px-3 py-1.5 rounded-xl text-[10px] font-bold bg-ops-50 text-ops-700 border border-ops-200" data-plan-id="' + escapeHtml(p.id) + '">编辑</button></td></tr>';
            }).join('');
        }

        function refresh() {
            renderTabs();
            renderTable();
        }

        function openPlanModal(planId) {
            var modal = el('ops-plan-modal');
            var idField = el('ops-plan-modal-plan-id');
            if (!modal || !idField) return;
            var p = apiPlansForUi().find(function (x) { return x.id === planId; });
            if (!p) return;
            idField.value = planId;
            el('ops-plan-field-name').value = p.name || '';
            el('ops-plan-field-price-original-y').value = p.priceOriginalYear || 0;
            el('ops-plan-field-price-current-y').value = p.priceCurrentYear || 0;
            el('ops-plan-field-discount-label').value = p.discountLabel || '';
            el('ops-plan-field-max-users').value = p.maxUsers || 0;
            el('ops-plan-field-max-products').value = p.maxProducts || 0;
            el('ops-plan-field-max-suppliers').value = p.maxSuppliers || 0;
            el('ops-plan-field-max-customers').value = p.maxCustomers || 0;
            updateModalPreviewLive();
            modal.classList.remove('hidden');
        }

        function closePlanModal() {
            var modal = el('ops-plan-modal');
            if (modal) modal.classList.add('hidden');
        }

        function updateModalPreviewLive() {
            var pv = el('ops-plan-modal-discount-auto');
            if (!pv) return;
            var o = Math.max(0, parseInt(el('ops-plan-field-price-original-y').value, 10) || 0);
            var c = Math.max(0, parseInt(el('ops-plan-field-price-current-y').value, 10) || 0);
            if (o <= 0) { pv.textContent = '请填写年付原价'; return; }
            var off = computeDiscountPercentFromYearPrices(o, c);
            pv.textContent = '自动减免约 ' + off + '%';
        }

        async function saveFromModal() {
            var planId = el('ops-plan-modal-plan-id').value.trim();
            if (!planId) return;
            var body = {
                displayName: el('ops-plan-field-name').value,
                priceOriginalYear: el('ops-plan-field-price-original-y').value,
                priceCurrentYear: el('ops-plan-field-price-current-y').value,
                discountLabel: el('ops-plan-field-discount-label').value,
                maxUsers: el('ops-plan-field-max-users').value,
                maxProducts: el('ops-plan-field-max-products').value,
                maxSuppliers: el('ops-plan-field-max-suppliers').value,
                maxCustomers: el('ops-plan-field-max-customers').value
            };
            try {
                var res = await opsFetch('/api/v1/ops/catalog/subscription-plans/' + encodeURIComponent(planId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                var data = await res.json();
                if (!res.ok) throw new Error((data && data.message) || '保存失败');
                appendAudit('PLAN_CATALOG_UPDATE', planId);
                closePlanModal();
                await loadCatalogFromApi();
                opsNotify('套餐已保存', 'success');
            } catch (err) {
                opsNotify(err.message || String(err), 'error');
            }
        }

        var tabRoot = el('ops-plan-merchant-tabs');
        if (tabRoot) {
            tabRoot.addEventListener('click', function (e) {
                var b = e.target.closest('[data-merchant]');
                if (!b) return;
                currentMerchant = b.getAttribute('data-merchant') || 'WHOLESALE';
                loadCatalogFromApi();
            });
        }
        var tbody = el('ops-plan-table-body');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var ed = e.target.closest('.ops-plan-edit');
                if (ed) openPlanModal(ed.getAttribute('data-plan-id'));
            });
        }
        var mclose = el('ops-plan-modal-close');
        var modal = el('ops-plan-modal');
        var msave = el('ops-plan-modal-save');
        if (mclose) mclose.addEventListener('click', closePlanModal);
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closePlanModal(); });
        if (msave) msave.addEventListener('click', saveFromModal);
        ['ops-plan-field-price-original-y', 'ops-plan-field-price-current-y'].forEach(function (fid) {
            var node = el(fid);
            if (node) node.addEventListener('input', updateModalPreviewLive);
        });
        loadCatalogFromApi();
    }

    function switchPromoterHubTab(tab) {
        var tabs = document.querySelectorAll('#ops-promoter-hub-tabs .ops-promoter-hub-tab');
        tabs.forEach(function (btn) {
            var on = btn.getAttribute('data-promoter-tab') === tab;
            btn.className = on
                ? 'ops-promoter-hub-tab px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md'
                : 'ops-promoter-hub-tab px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
        });
        document.querySelectorAll('.ops-promoter-tab-panel').forEach(function (panel) {
            panel.classList.add('hidden');
        });
        var target = el('ops-promoter-tab-' + tab);
        if (target) target.classList.remove('hidden');
        if (tab === 'create') {
            loadPromoterList();
        }
    }

    function initPromotersHubPage(route) {
        var initialTab = route === 'referral' ? 'referral' : 'create';
        if (location.hash === '#referral') initialTab = 'referral';
        switchPromoterHubTab(initialTab);
        var tabRoot = el('ops-promoter-hub-tabs');
        if (tabRoot && tabRoot.dataset.bound !== '1') {
            tabRoot.dataset.bound = '1';
            tabRoot.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-promoter-tab]');
                if (!btn) return;
                switchPromoterHubTab(btn.getAttribute('data-promoter-tab'));
            });
        }
        initReferralPage();
        initPromotersPage();
    }

    function switchPublishHubTab(tab) {
        var tabs = document.querySelectorAll('#ops-publish-hub-tabs .ops-publish-hub-tab');
        tabs.forEach(function (btn) {
            var on = btn.getAttribute('data-publish-tab') === tab;
            btn.className = on
                ? 'ops-publish-hub-tab px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md'
                : 'ops-publish-hub-tab px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
        });
        document.querySelectorAll('.ops-publish-tab-panel').forEach(function (panel) {
            panel.classList.add('hidden');
        });
        var target = el('ops-publish-tab-' + tab);
        if (target) target.classList.remove('hidden');
        if (tab === 'audit') renderAudit();
    }

    function initPublishCenterPage(route) {
        var initialTab = 'plans';
        if (route === 'announce') initialTab = 'announce';
        if (location.hash === '#announce') initialTab = 'announce';
        switchPublishHubTab(initialTab);
        var tabRoot = el('ops-publish-hub-tabs');
        if (tabRoot && tabRoot.dataset.bound !== '1') {
            tabRoot.dataset.bound = '1';
            tabRoot.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-publish-tab]');
                if (!btn) return;
                switchPublishHubTab(btn.getAttribute('data-publish-tab'));
            });
        }
        initPlanCatalogPage();
        if (typeof window.wrappedFetch === 'function') {
            initAnnouncePageLive();
        } else {
            initAnnouncePage();
        }
        renderAudit();
    }

    function updateTenantStats(list, filter) {
        var rows = filter === 'ALL' ? list : list.filter(function (t) {
            return t.industry === filter;
        });
        var tenants = rows.length;
        var users = rows.reduce(function (s, t) {
            return s + (t.users || 0);
        }, 0);
        var admin = 0;
        var ops = 0;
        var other = 0;
        rows.forEach(function (t) {
            var r = t.roles || {};
            admin += r.admin || 0;
            ops += r.ops || 0;
            other += r.other || 0;
        });
        var st = el('ops-stat-tenants');
        var su = el('ops-stat-users');
        var sr = el('ops-stat-roles');
        if (st) st.textContent = String(tenants);
        if (su) su.textContent = String(users);
        if (sr) sr.textContent = admin + ' / ' + ops + ' / ' + other;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hashFromTenantId(id) {
        var s = String(id || '');
        var h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h;
    }

    function findQuotaByName(name) {
        var n = String(name || '');
        return mockQuotaByTenant.find(function (q) {
            return q.name === n;
        }) || { name: n, products: 0, customers: 0, suppliers: 0 };
    }

    function findAiMonthByName(name) {
        var n = String(name || '');
        var rows = mockAiRank.month || [];
        return rows.find(function (r) {
            return r.tenant === n;
        }) || { tenant: n, tokens: 0, extract: 0, chat: 0 };
    }

    function pickPlanForTenant(t, catalog) {
        var arr = catalog[t.industry] || catalog.WHOLESALE || [];
        if (!arr.length) return normalizePlan({});
        var ix = typeof t.planTier === 'number' ? t.planTier : (t.users > 60 ? 2 : t.users > 22 ? 1 : 0);
        ix = Math.max(0, Math.min(arr.length - 1, ix));
        return normalizePlan(arr[ix]);
    }

    function seedRevenueProfit(t) {
        var h = hashFromTenantId(t.id);
        return {
            revenueMonth: 320000 + (h % 900) * 1200,
            profitMonth: 28000 + (h % 120) * 420
        };
    }

    function buildSyntheticUsers(t, extractT, chatT) {
        var roles = t.roles || { admin: 1, ops: 1, other: 3 };
        var slots = [];
        var a;
        for (a = 0; a < (roles.admin || 0); a++) slots.push({ role: '管理员', label: '管理员' + (a + 1) });
        for (a = 0; a < (roles.ops || 0); a++) slots.push({ role: '运营', label: '运营' + (a + 1) });
        var rest = Math.min(6, Math.max(1, roles.other || 0));
        for (a = 0; a < rest; a++) slots.push({ role: '员工', label: '用户' + (a + 1) });
        if (!slots.length) slots.push({ role: '管理员', label: '主账号' });
        var n = Math.min(slots.length, 10);
        slots = slots.slice(0, n);
        var parts = slots.length;
        var baseE = extractT / parts;
        var baseC = chatT / parts;
        return slots.map(function (s, idx) {
            var w = 0.65 + ((hashFromTenantId(t.id + idx) % 70) / 100);
            var ex = Math.max(0, Math.round(baseE * w));
            var ch = Math.max(0, Math.round(baseC * w));
            return {
                id: t.id + '-u-' + idx,
                name: s.label,
                role: s.role,
                extractMonth: ex,
                chatMonth: ch,
                tokensMonth: ex + ch
            };
        });
    }

    function mergeTenantForTree(t, catalog) {
        var q = findQuotaByName(t.name);
        var ai = findAiMonthByName(t.name);
        var rp = seedRevenueProfit(t);
        var plan = pickPlanForTenant(t, catalog);
        var users = buildSyntheticUsers(t, ai.extract || 0, ai.chat || 0);
        return {
            raw: t,
            plan: plan,
            usage: { products: q.products, customers: q.customers, suppliers: q.suppliers, users: t.users || 0 },
            aiTokensMonth: ai.tokens || 0,
            extractMonth: ai.extract || 0,
            chatMonth: ai.chat || 0,
            subscriptionYear: plan.priceCurrentYear || 0,
            revenueMonth: rp.revenueMonth,
            profitMonth: rp.profitMonth,
            users: users
        };
    }

    function usageBar(cur, max, overClass) {
        max = Math.max(1, max || 1);
        var p = Math.min(150, Math.round((100 * cur) / max));
        var bar = p > 100 ? 'bg-rose-500' : p > 88 ? 'bg-amber-500' : 'bg-ops-500';
        return (
            '<div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">' +
            '<div class="h-1.5 rounded-full ' + (overClass || bar) + '" style="width:' + Math.min(100, p) + '%"></div></div>'
        );
    }

    function moneyToDisplayInt(v) {
        var n = Number(v);
        if (!isFinite(n)) return 0;
        return Math.round(n);
    }

    function billingPeriodSuffix(days) {
        var d = parseInt(days, 10) || 0;
        if (d >= 365) return '/ 年';
        if (d > 0) return '/ ' + d + ' 天';
        return '/ 年';
    }

    /** 使用 OpsService 返回的 subscription（subscription_plans + 实付）构建套餐卡片 */
    function buildPlanFromApiSubscription(sub, node, catalog) {
        if (!sub || typeof sub !== 'object' || !sub.quota) {
            var rawStub = {
                id: node.tenant_id,
                name: node.tenant_name,
                industry: node.merchant_type || 'WHOLESALE',
                users: Number(node.user_count) || 0
            };
            return pickPlanForTenant(rawStub, catalog);
        }
        var q = sub.quota || {};
        var orig = moneyToDisplayInt(sub.original_price_cny);
        var cur = moneyToDisplayInt(sub.price_paid);
        var list = moneyToDisplayInt(sub.list_price_cny);
        if (!orig && list) orig = list;
        if (orig < cur) orig = cur;
        return normalizePlan({
            id: sub.plan_id || ('api-' + (node.tenant_id || '')),
            name: sub.plan_name || node.subscription_type || '订阅套餐',
            priceOriginalYear: orig,
            priceCurrentYear: cur,
            discountLabel: sub.discount_label || '',
            promoNote: sub.promo_note || '',
            maxUsers: Number(q.max_users) || 0,
            maxProducts: Number(q.max_products) || 0,
            maxCustomers: Number(q.max_customers) || 0,
            maxSuppliers: Number(q.max_suppliers) || 0,
            billingPeriodSuffix: billingPeriodSuffix(sub.billing_period_days)
        });
    }

    function mapApiTreeNodeToMergedRow(node, catalog) {
        var frozen = node.tenant_status === 'LOCKED' || node.tenant_status === 'FROZEN' || node.tenant_status === 'TERMINATED';
        var raw = {
            id: node.tenant_id,
            name: node.tenant_name || node.tenant_id,
            industry: toMerchantUiKey(node.merchant_type || 'WHOLESALE'),
            industryVertical: node.industry_vertical || 'GENERAL',
            industryVerticalLabel: node.industry_vertical_label || verticalLabel[node.industry_vertical] || node.industry_vertical || '—',
            tenantStatus: node.tenant_status || 'ACTIVE',
            frozen: frozen,
            expiry: parseSubEnd(node.sub_end_time) === '—' ? '' : parseSubEnd(node.sub_end_time),
            users: Number(node.user_count) || 0,
            roles: node.roles || { admin: 0, ops: 0, other: 0 },
            subscriptionType: node.subscription_type || ''
        };
        var plan = buildPlanFromApiSubscription(node.subscription, node, catalog);
        var usage = {
            products: Number(node.product_cnt) || 0,
            customers: Number(node.customer_cnt) || 0,
            suppliers: Number(node.supplier_cnt) || 0,
            users: Number(node.user_count) || 0
        };
        var apiUsers = Array.isArray(node.users) ? node.users : [];
        var userRows = apiUsers.length
            ? apiUsers.map(function (u) {
                return {
                    id: String(u.user_id),
                    name: u.display_name || u.user_name || ('#' + u.user_id),
                    role: u.role_label || u.role_type || '用户',
                    extractMonth: Number(u.extract_month) || 0,
                    chatMonth: Number(u.chat_month) || 0,
                    tokensMonth: Number(u.tokens_month) || 0
                };
            })
            : [];
        return {
            raw: raw,
            plan: plan,
            usage: usage,
            aiTokensMonth: Number(node.ai_tokens_month) || 0,
            extractMonth: Number(node.ai_extract_month) || 0,
            chatMonth: Number(node.ai_chat_month) || 0,
            subscriptionYear: plan.priceCurrentYear || 0,
            revenueMonth: 0,
            profitMonth: 0,
            users: userRows
        };
    }

    function mergedRowsToStatsList(mergedRows) {
        return mergedRows.map(function (r) {
            return {
                industry: r.raw.industry,
                users: r.usage.users,
                roles: r.raw.roles || { admin: 0, ops: 0, other: 0 }
            };
        });
    }

    function renderTenantTreeMergedRows(mergedRows, expanded, opts) {
        opts = opts || {};
        var root = el("ops-tree-root");
        if (!root) return;
        if (!mergedRows.length) {
            root.innerHTML = "<p class=\"text-slate-500 text-sm text-center py-8\">暂无租户数据</p>";
            return;
        }
        var userAiTitle = opts.live ? "租户 → 用户 → 本月 AI" : "租户 → 用户 → 本月 AI（演示拆分）";
            root.innerHTML = mergedRows.map(function (row) {
                var t = row.raw;
                var p = row.plan;
                var open = expanded.has(t.id);
                var caret = open ? 'ph-caret-down' : 'ph-caret-right';
                var frozen = t.tenantStatus === 'TERMINATED'
                    ? '<span class="text-slate-500 font-bold text-[10px]">已注销</span>'
                    : (t.frozen
                        ? '<span class="text-rose-600 font-bold text-[10px]">已冻结</span>'
                        : '<span class="text-emerald-600 font-bold text-[10px]">正常</span>');
                var ind = industryLabel[t.industry] || t.industry;
                var vert = t.industryVerticalLabel || verticalLabel[t.industryVertical] || '';
                var vertBadge = vert ? '<span class="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">' + escapeHtml(vert) + '</span>' : '';
                var orig = p.priceOriginalYear || 0;
                var cur = p.priceCurrentYear || 0;
                var off = computeDiscountPercentFromYearPrices(orig, cur);
                var ribbon = p.discountLabel
                    ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[9px] font-black">' + escapeHtml(p.discountLabel) + '</span>'
                    : '';
                var promo = p.promoNote
                    ? '<p class="text-[9px] text-slate-500 mt-1 leading-snug">' + escapeHtml(p.promoNote) + '</p>'
                    : '';
                var zhe = orig > 0 ? (Math.round((cur / orig) * 1000) / 100).toFixed(1) : '—';
                var discLine = off > 0
                    ? '<p class="text-[9px] font-black text-ops-600">约减 ' + off + '% · 合 ' + zhe + ' 折</p>'
                    : '';
                var periodSuffix = p.billingPeriodSuffix || '/ 年';
                var showOrigLine = orig > 0 && orig > cur;

                var subHidden = open ? '' : 'hidden';
                var userBlock = row.users.map(function (u) {
                    return (
                        '<div class="border-b border-indigo-50/80 last:border-0 py-2 pl-2">' +
                        '<div class="flex flex-wrap items-center justify-between gap-2">' +
                        '<div><span class="text-xs font-bold text-slate-800">' + escapeHtml(u.name) + '</span>' +
                        '<span class="ml-2 text-[10px] font-bold text-slate-400">' + escapeHtml(u.role) + '</span></div>' +
                        '<span class="text-[10px] font-mono text-ops-700 font-bold">Σ ' + formatTokens(u.tokensMonth) + '</span></div>' +
                        '<div class="mt-1 pl-2 text-[10px] text-slate-500 font-mono">提取 ' + formatTokens(u.extractMonth) + ' · 对话 ' + formatTokens(u.chatMonth) + '</div></div>'
                    );
                }).join('');

                var metricsHtml = opts.live
                    ? '<span class="px-2 py-1 rounded-lg bg-ops-50 border border-ops-100">AI月 ' + formatTokens(row.aiTokensMonth) + '</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">产品 ' + row.usage.products + '</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">客户 ' + row.usage.customers + '</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">供应商 ' + row.usage.suppliers + '</span>'
                    : '<span class="px-2 py-1 rounded-lg bg-ops-50 border border-ops-100">AI月 ' + formatTokens(row.aiTokensMonth) + '</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">年付 ¥' + row.subscriptionYear + '</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">营收 ¥' + (row.revenueMonth / 10000).toFixed(1) + '万</span>' +
                      '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">利润 ¥' + (row.profitMonth / 10000).toFixed(1) + '万</span>';

                var actionHtml = opts.live
                    ? (t.tenantStatus === 'TERMINATED'
                        ? '<span class="text-[10px] text-slate-400 px-2 py-1.5">已注销</span>'
                        : '<button type="button" class="ops-act-edit px-2 py-1.5 rounded-xl text-[10px] font-bold bg-ops-600 text-white hover:bg-ops-700" data-id="' + escapeHtml(t.id) + '">权益/到期</button>' +
                          '<button type="button" class="ops-act-retype px-2 py-1.5 rounded-xl text-[10px] font-bold border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100" data-id="' + escapeHtml(t.id) + '">改类型</button>' +
                          '<button type="button" class="ops-act-terminate px-2 py-1.5 rounded-xl text-[10px] font-bold border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100" data-id="' + escapeHtml(t.id) + '">注销</button>')
                    : '<button type="button" class="ops-act-freeze px-2 py-1.5 rounded-xl text-[10px] font-bold border border-slate-200 hover:bg-slate-50" data-id="' + escapeHtml(t.id) + '">' + (t.frozen ? '解冻' : '冻结') + '</button>' +
                      '<button type="button" class="ops-act-edit px-2 py-1.5 rounded-xl text-[10px] font-bold bg-ops-600 text-white hover:bg-ops-700" data-id="' + escapeHtml(t.id) + '">权益/到期</button>';

                return (
                    '<div class="tm-ops-glass rounded-tm-3xl border border-indigo-100/80 overflow-hidden shadow-sm" data-tenant-id="' + escapeHtml(t.id) + '">' +
                    '<div class="flex flex-wrap items-start gap-2 p-4 bg-white/60">' +
                    '<button type="button" class="ops-tree-toggle shrink-0 w-9 h-9 rounded-xl border border-indigo-100 flex items-center justify-center text-ops-600 hover:bg-ops-50" data-tenant-id="' + escapeHtml(t.id) + '" title="展开/收起">' +
                    '<i class="ph ' + caret + ' text-lg"></i></button>' +
                    '<div class="flex-1 min-w-0">' +
                    '<div class="flex flex-wrap items-center gap-2">' +
                    '<span class="text-sm font-black text-slate-800">' + escapeHtml(t.name) + '</span>' +
                    '<span class="text-[10px] font-mono text-slate-400">' + escapeHtml(t.id) + '</span>' +
                    frozen +
                    '<span class="text-[10px] text-slate-500">' + escapeHtml(ind) + '</span>' + vertBadge + '</div>' +
                    '<p class="text-[10px] font-mono text-slate-500 mt-0.5">到期 ' + escapeHtml(t.expiry || '—') + '</p></div>' +
                    '<div class="flex flex-wrap gap-2 text-[10px] font-mono font-bold text-ops-800 w-full sm:w-auto sm:text-right sm:ml-auto">' + metricsHtml + '</div>' +
                    '<div class="flex flex-wrap gap-1 w-full sm:w-auto justify-end">' + actionHtml + '</div></div>' +
                    '<div class="ops-tree-body border-t border-indigo-100/80 bg-slate-50/40 p-4 ' + subHidden + '">' +
                    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' +
                    '<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">' +
                    '<p class="text-[10px] font-black text-ops-600 uppercase tracking-widest mb-2">配额与用量</p>' +
                    '<div class="space-y-2 text-[11px]">' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>用户数</span><span>' + row.usage.users + ' / ' + p.maxUsers + '</span></div>' + usageBar(row.usage.users, p.maxUsers) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>产品</span><span>' + row.usage.products + ' / ' + p.maxProducts + '</span></div>' + usageBar(row.usage.products, p.maxProducts) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>客户</span><span>' + row.usage.customers + ' / ' + p.maxCustomers + '</span></div>' + usageBar(row.usage.customers, p.maxCustomers) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>供应商</span><span>' + row.usage.suppliers + ' / ' + p.maxSuppliers + '</span></div>' + usageBar(row.usage.suppliers, p.maxSuppliers) + '</div></div></div>' +
                    '<div class="rounded-2xl border-2 border-ops-200 bg-gradient-to-br from-ops-50/90 to-white p-4 relative overflow-hidden">' +
                    '<p class="text-[10px] font-black text-ops-700 uppercase tracking-widest">' + escapeHtml(p.name) + '</p>' +
                    ribbon +
                    (showOrigLine
                        ? '<p class="text-[10px] text-slate-400 line-through mt-2">原价 ¥' + orig + periodSuffix + '</p>'
                        : '') +
                    '<div class="flex items-baseline gap-1 mt-1"><span class="text-3xl font-mono font-black text-ops-700">¥' + cur + '</span><span class="text-[10px] font-bold text-slate-400">' + escapeHtml(periodSuffix) + '</span></div>' +
                    discLine + promo + '</div></div>' +
                    '<div class="mt-4 rounded-2xl border border-indigo-100 bg-white/90 p-3">' +
                    '<p class="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">' + userAiTitle + '</p>' +
                    '<div class="pl-2 border-l-2 border-ops-200 space-y-0">' + (userBlock || '<p class="text-[10px] text-slate-400 py-2">暂无用户</p>') + '</div></div></div></div>'
                );
            }).join('');
    }

    function initTenantsQuotaTreePage() {
        if (typeof window.wrappedFetch === 'function') {
            initTenantsQuotaTreePageLive();
            return;
        }
        var list = loadTenants();
        var catalog = loadSubscriptionCatalog();
        var expanded = new Set();
        var sortKey = 'aiTokensMonth';
        currentIndustry = 'ALL';

        function mergedRows() {
            return list.map(function (t) {
                return mergeTenantForTree(t, catalog);
            });
        }

        function filteredSorted() {
            var rows = mergedRows().filter(function (row) {
                return currentIndustry === 'ALL' || row.raw.industry === currentIndustry;
            });
            rows.sort(function (a, b) {
                var va = a[sortKey];
                var vb = b[sortKey];
                if (vb !== va) return vb - va;
                return String(a.raw.name).localeCompare(String(b.raw.name));
            });
            return rows;
        }

        function renderTree() {
            var rows = filteredSorted();
            renderTenantTreeMergedRows(rows, expanded, { live: false });
            updateTenantStats(list, currentIndustry);
        }

        function renderTreeOld() {
            var root = el('ops-tree-root');
            if (!root) return;
            var rows = filteredSorted();
            root.innerHTML = rows.map(function (row) {
                var t = row.raw;
                var p = row.plan;
                var open = expanded.has(t.id);
                var caret = open ? 'ph-caret-down' : 'ph-caret-right';
                var frozen = t.frozen
                    ? '<span class="text-rose-600 font-bold text-[10px]">已冻结</span>'
                    : '<span class="text-emerald-600 font-bold text-[10px]">正常</span>';
                var ind = industryLabel[t.industry] || t.industry;
                var vert = t.industryVerticalLabel || verticalLabel[t.industryVertical] || '';
                var vertBadge = vert ? '<span class="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">' + escapeHtml(vert) + '</span>' : '';
                var orig = p.priceOriginalYear || 0;
                var cur = p.priceCurrentYear || 0;
                var off = computeDiscountPercentFromYearPrices(orig, cur);
                var ribbon = p.discountLabel
                    ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[9px] font-black">' + escapeHtml(p.discountLabel) + '</span>'
                    : '';
                var promo = p.promoNote
                    ? '<p class="text-[9px] text-slate-500 mt-1 leading-snug">' + escapeHtml(p.promoNote) + '</p>'
                    : '';
                var zhe = orig > 0 ? (Math.round((cur / orig) * 1000) / 100).toFixed(1) : '—';
                var discLine = off > 0
                    ? '<p class="text-[9px] font-black text-ops-600">约减 ' + off + '% · 合 ' + zhe + ' 折</p>'
                    : '';
                var periodSuffix = p.billingPeriodSuffix || '/ 年';
                var showOrigLine = orig > 0 && orig > cur;

                var subHidden = open ? '' : 'hidden';
                var userBlock = row.users.map(function (u) {
                    return (
                        '<div class="border-b border-indigo-50/80 last:border-0 py-2 pl-2">' +
                        '<div class="flex flex-wrap items-center justify-between gap-2">' +
                        '<div><span class="text-xs font-bold text-slate-800">' + escapeHtml(u.name) + '</span>' +
                        '<span class="ml-2 text-[10px] font-bold text-slate-400">' + escapeHtml(u.role) + '</span></div>' +
                        '<span class="text-[10px] font-mono text-ops-700 font-bold">Σ ' + formatTokens(u.tokensMonth) + '</span></div>' +
                        '<div class="mt-1 pl-2 text-[10px] text-slate-500 font-mono">提取 ' + formatTokens(u.extractMonth) + ' · 对话 ' + formatTokens(u.chatMonth) + '</div></div>'
                    );
                }).join('');

                return (
                    '<div class="tm-ops-glass rounded-tm-3xl border border-indigo-100/80 overflow-hidden shadow-sm" data-tenant-id="' + escapeHtml(t.id) + '">' +
                    '<div class="flex flex-wrap items-start gap-2 p-4 bg-white/60">' +
                    '<button type="button" class="ops-tree-toggle shrink-0 w-9 h-9 rounded-xl border border-indigo-100 flex items-center justify-center text-ops-600 hover:bg-ops-50" data-tenant-id="' + escapeHtml(t.id) + '" title="展开/收起">' +
                    '<i class="ph ' + caret + ' text-lg"></i></button>' +
                    '<div class="flex-1 min-w-0">' +
                    '<div class="flex flex-wrap items-center gap-2">' +
                    '<span class="text-sm font-black text-slate-800">' + escapeHtml(t.name) + '</span>' +
                    '<span class="text-[10px] font-mono text-slate-400">' + escapeHtml(t.id) + '</span>' +
                    frozen +
                    '<span class="text-[10px] text-slate-500">' + escapeHtml(ind) + '</span>' + vertBadge + '</div>' +
                    '<p class="text-[10px] font-mono text-slate-500 mt-0.5">到期 ' + escapeHtml(t.expiry || '—') + '</p></div>' +
                    '<div class="flex flex-wrap gap-2 text-[10px] font-mono font-bold text-ops-800 w-full sm:w-auto sm:text-right sm:ml-auto">' +
                    '<span class="px-2 py-1 rounded-lg bg-ops-50 border border-ops-100">AI月 ' + formatTokens(row.aiTokensMonth) + '</span>' +
                    '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">年付 ¥' + row.subscriptionYear + '</span>' +
                    '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">营收 ¥' + (row.revenueMonth / 10000).toFixed(1) + '万</span>' +
                    '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200">利润 ¥' + (row.profitMonth / 10000).toFixed(1) + '万</span></div>' +
                    '<div class="flex gap-1 w-full sm:w-auto justify-end">' +
                    '<button type="button" class="ops-act-freeze px-2 py-1.5 rounded-xl text-[10px] font-bold border border-slate-200 hover:bg-slate-50" data-id="' + escapeHtml(t.id) + '">' + (t.frozen ? '解冻' : '冻结') + '</button>' +
                    '<button type="button" class="ops-act-edit px-2 py-1.5 rounded-xl text-[10px] font-bold bg-ops-600 text-white hover:bg-ops-700" data-id="' + escapeHtml(t.id) + '">权益/到期</button></div></div>' +
                    '<div class="ops-tree-body border-t border-indigo-100/80 bg-slate-50/40 p-4 ' + subHidden + '">' +
                    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' +
                    '<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">' +
                    '<p class="text-[10px] font-black text-ops-600 uppercase tracking-widest mb-2">配额与用量</p>' +
                    '<div class="space-y-2 text-[11px]">' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>用户数</span><span>' + row.usage.users + ' / ' + p.maxUsers + '</span></div>' + usageBar(row.usage.users, p.maxUsers) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>产品</span><span>' + row.usage.products + ' / ' + p.maxProducts + '</span></div>' + usageBar(row.usage.products, p.maxProducts) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>客户</span><span>' + row.usage.customers + ' / ' + p.maxCustomers + '</span></div>' + usageBar(row.usage.customers, p.maxCustomers) + '</div>' +
                    '<div><div class="flex justify-between font-bold text-slate-600"><span>供应商</span><span>' + row.usage.suppliers + ' / ' + p.maxSuppliers + '</span></div>' + usageBar(row.usage.suppliers, p.maxSuppliers) + '</div></div></div>' +
                    '<div class="rounded-2xl border-2 border-ops-200 bg-gradient-to-br from-ops-50/90 to-white p-4 relative overflow-hidden">' +
                    '<p class="text-[10px] font-black text-ops-700 uppercase tracking-widest">' + escapeHtml(p.name) + '</p>' +
                    ribbon +
                    (showOrigLine
                        ? '<p class="text-[10px] text-slate-400 line-through mt-2">原价 ¥' + orig + periodSuffix + '</p>'
                        : '') +
                    '<div class="flex items-baseline gap-1 mt-1"><span class="text-3xl font-mono font-black text-ops-700">¥' + cur + '</span><span class="text-[10px] font-bold text-slate-400">' + escapeHtml(periodSuffix) + '</span></div>' +
                    discLine + promo + '</div></div>' +
                    '<div class="mt-4 rounded-2xl border border-indigo-100 bg-white/90 p-3">' +
                    '<p class="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1">租户 → 用户 → 本月 AI（演示拆分）</p>' +
                    '<div class="pl-2 border-l-2 border-ops-200 space-y-0">' + userBlock + '</div></div></div></div>'
                );
            }).join('');

            updateTenantStats(list, currentIndustry);
        }

        function wireTreeClicks() {
            var root = el('ops-tree-root');
            if (!root) return;
            root.onclick = function (e) {
                var tg = e.target.closest('.ops-tree-toggle');
                if (tg) {
                    var tid = tg.getAttribute('data-tenant-id');
                    if (!tid) return;
                    if (expanded.has(tid)) expanded.delete(tid);
                    else expanded.add(tid);
                    renderTree();
                    return;
                }
                var fr = e.target.closest('.ops-act-freeze');
                var ed = e.target.closest('.ops-act-edit');
                if (fr) {
                    var id = fr.getAttribute('data-id');
                    var tenant = list.find(function (x) {
                        return x.id === id;
                    });
                    if (!tenant) return;
                    tenant.frozen = !tenant.frozen;
                    saveTenants(list);
                    appendAudit(tenant.frozen ? 'FREEZE_TENANT' : 'UNFREEZE_TENANT', id + ' ' + tenant.name);
                    renderTree();
                    return;
                }
                if (ed) {
                    var tid2 = ed.getAttribute('data-id');
                    var tenant2 = list.find(function (x) {
                        return x.id === tid2;
                    });
                    if (!tenant2) return;
                    el('ops-modal-tenant-id').value = tenant2.id;
                    el('ops-modal-tenant-title').textContent = '运维：' + tenant2.name;
                    el('ops-modal-tenant-sub').textContent = '赠送试用将累加至到期日；或直接指定到期日（二者可只填一项）。';
                    el('ops-input-trial-months').value = '1';
                    el('ops-input-trial-note').value = '';
                    el('ops-input-expiry-date').value = tenant2.expiry || '';
                    el('ops-modal-tenant').classList.remove('hidden');
                }
            };
        }

        function closeModal() {
            var modal = el('ops-modal-tenant');
            if (modal) modal.classList.add('hidden');
        }
        var m = el('ops-modal-tenant');
        var mclose = el('ops-modal-tenant-close');
        if (m && mclose) {
            mclose.addEventListener('click', closeModal);
            m.addEventListener('click', function (e) {
                if (e.target === m) closeModal();
            });
        }
        var saveBtn = el('ops-btn-save-tenant-ops');
        if (saveBtn) {
            saveBtn.onclick = function () {
                var tid = el('ops-modal-tenant-id').value;
                var tenant = list.find(function (x) {
                    return x.id === tid;
                });
                if (!tenant) return;
                var months = parseInt(el('ops-input-trial-months').value, 10) || 0;
                var note = el('ops-input-trial-note').value.trim();
                var dateStr = el('ops-input-expiry-date').value;
                if (months > 0) {
                    var d = new Date(tenant.expiry || Date.now());
                    d.setMonth(d.getMonth() + months);
                    tenant.expiry = d.toISOString().slice(0, 10);
                    appendAudit('TRIAL_GRANT', tid + ' +' + months + '月 活动:' + (note || '-'));
                }
                if (dateStr) {
                    tenant.expiry = dateStr;
                    appendAudit('SUBSCRIPTION_EXPIRY_SET', tid + ' -> ' + dateStr + ' 备注:' + (note || '-'));
                }
                saveTenants(list);
                closeModal();
                renderTree();
            };
        }

        var filterRoot = el('ops-industry-filter');
        if (filterRoot) {
            filterRoot.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-industry]');
                if (!btn) return;
                currentIndustry = btn.getAttribute('data-industry') || 'ALL';
                filterRoot.querySelectorAll('.ops-filter-chip').forEach(function (b) {
                    var on = b.getAttribute('data-industry') === currentIndustry;
                    b.className = on
                        ? 'ops-filter-chip px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md'
                        : 'ops-filter-chip px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
                });
                renderTree();
            });
        }

        var sortSel = el('ops-tree-sort');
        if (sortSel) {
            sortSel.addEventListener('change', function () {
                sortKey = sortSel.value || 'aiTokensMonth';
                renderTree();
            });
            sortSel.value = sortKey;
        }

        wireTreeClicks();
        renderTree();
    }

    function initReferralPage() {
        if (typeof window.wrappedFetch === 'function') {
            initReferralPageLive();
            return;
        }
        var list = loadReferrals();

        function renderSummary(groups) {
            var box = el('ops-ref-summary-cards');
            if (!box) return;
            var totalEv = list.length;
            var pending = list.filter(function (x) {
                return x.settlement !== 'PAID';
            }).length;
            var paid = list.filter(function (x) {
                return x.settlement === 'PAID';
            }).length;
            var multi = groups.filter(function (g) {
                return g.records.length > 1;
            }).length;
            function card(label, val, sub) {
                return (
                    '<div class="tm-ops-glass rounded-2xl p-4 border border-indigo-100/80">' +
                    '<p class="text-[10px] font-bold text-slate-400 uppercase">' + escapeHtml(label) + '</p>' +
                    '<p class="mt-1 text-xl font-black text-ops-700 font-mono">' + escapeHtml(val) + '</p>' +
                    (sub ? '<p class="text-[10px] text-slate-500 mt-0.5">' + escapeHtml(sub) + '</p>' : '') +
                    '</div>'
                );
            }
            box.innerHTML =
                card('推荐分组', String(groups.length), '按 推荐码+推荐人 聚合') +
                card('有效订阅笔数', String(totalEv), '每条 = 一次首订') +
                card('待结算', String(pending), '需在明细中或批量处理') +
                card('多租户推荐组', String(multi), '单组 ≥2 笔有效订阅');
        }

        function render() {
            var tbody = el('ops-referral-body');
            if (!tbody) return;
            var groups = groupReferralEvents(list);
            renderSummary(groups);
            var rows = [];
            groups.forEach(function (g) {
                var enc = encodeGroupKey(g.key);
                var expanded = refExpandedGroupKeys.has(g.key);
                var pendingN = g.records.filter(function (r) {
                    return r.settlement !== 'PAID';
                }).length;
                var paidN = g.records.filter(function (r) {
                    return r.settlement === 'PAID';
                }).length;
                var caret = expanded ? 'ph-caret-down' : 'ph-caret-right';
                rows.push(
                    '<tr class="hover:bg-ops-50/40 bg-white/70">' +
                    '<td class="px-2 py-3 align-middle">' +
                    '<button type="button" class="ops-ref-toggle w-8 h-8 rounded-xl flex items-center justify-center text-ops-600 hover:bg-ops-50 border border-transparent hover:border-ops-200" data-group-key="' + escapeHtml(enc) + '" title="展开/收起">' +
                    '<i class="ph ' + caret + ' text-lg"></i></button></td>' +
                    '<td class="px-4 py-3 font-mono text-xs font-semibold text-slate-800">' + escapeHtml(g.code) + '</td>' +
                    '<td class="px-4 py-3 font-semibold">' + escapeHtml(g.referrer) + '</td>' +
                    '<td class="px-4 py-3"><span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-ops-100 text-ops-800 font-black font-mono">' + g.records.length + '</span></td>' +
                    '<td class="px-4 py-3 text-[11px]"><span class="text-amber-600 font-bold">待 ' + pendingN + '</span> · <span class="text-emerald-600 font-bold">已 ' + paidN + '</span></td>' +
                    '<td class="px-4 py-3 text-right whitespace-nowrap">' +
                    '<button type="button" class="ops-bank px-3 py-1.5 rounded-xl text-[10px] font-bold bg-ops-50 text-ops-700 border border-ops-200 hover:bg-ops-100" data-group-key="' + escapeHtml(enc) + '">收款信息</button>' +
                    '</td></tr>'
                );
                var detailHidden = expanded ? '' : 'hidden';
                var innerRows = g.records.slice().sort(function (a, b) {
                    return String(b.firstSubAt).localeCompare(String(a.firstSubAt));
                }).map(function (r) {
                    var st = r.settlement === 'PAID'
                        ? '<span class="text-emerald-600 font-bold">已结算</span>'
                        : '<span class="text-amber-600 font-bold">待结算</span>';
                    return (
                        '<tr class="border-b border-indigo-100/60 last:border-0">' +
                        '<td class="py-2 pr-3 font-medium text-slate-800">' + escapeHtml(r.refereeTenant) + '</td>' +
                        '<td class="py-2 px-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">' + escapeHtml(String(r.firstSubAt).slice(0, 10)) + '</td>' +
                        '<td class="py-2 px-2">' + st + '</td>' +
                        '<td class="py-2 pl-2 text-right whitespace-nowrap">' +
                        '<button type="button" class="ops-ref-mark-paid mr-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40" data-record-id="' + escapeHtml(r.id) + '"' + (r.settlement === 'PAID' ? ' disabled' : '') + '>标已结</button>' +
                        '<button type="button" class="ops-ref-mark-pending px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-40" data-record-id="' + escapeHtml(r.id) + '"' + (r.settlement !== 'PAID' ? ' disabled' : '') + '>改待结</button>' +
                        '</td></tr>'
                    );
                }).join('');
                rows.push(
                    '<tr class="ops-ref-expand-row ' + detailHidden + ' bg-slate-50/90">' +
                    '<td colspan="6" class="p-0">' +
                    '<div class="px-3 py-3 pl-4 md:pl-14 border-t border-indigo-100/80">' +
                    '<p class="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">组内有效订阅明细（逐笔结算）</p>' +
                    '<div class="overflow-x-auto rounded-2xl border border-indigo-100/60 bg-white/90">' +
                    '<table class="w-full text-left text-xs min-w-[520px]">' +
                    '<thead class="bg-ops-50/60 text-[10px] uppercase font-bold text-ops-800">' +
                    '<tr><th class="px-3 py-2">被推荐租户</th><th class="px-3 py-2">首订日</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th></tr></thead>' +
                    '<tbody>' + innerRows + '</tbody></table></div></div></td></tr>'
                );
            });
            tbody.innerHTML = rows.join('');
        }

        function closeBank() {
            var modal = el('ops-modal-bank');
            if (modal) modal.classList.add('hidden');
        }

        function openBankModal(groupKey) {
            selectedBankGroupKey = groupKey;
            var groups = groupReferralEvents(list);
            var g = groups.find(function (x) {
                return x.key === groupKey;
            });
            if (!g) return;
            el('ops-modal-bank-sub').textContent = g.referrer + ' · ' + g.code;
            el('ops-modal-bank-content').textContent = g.bank || '（未登记收款信息）';
            var cnt = el('ops-modal-bank-count');
            if (cnt) cnt.textContent = String(g.records.length);
            el('ops-modal-bank').classList.remove('hidden');
        }

        function settleRecord(recordId, status) {
            var r = list.find(function (x) {
                return x.id === recordId;
            });
            if (!r) return;
            r.settlement = status;
            saveReferrals(list);
            appendAudit('REFERRAL_EVENT_SETTLEMENT', recordId + ' ' + status);
            render();
        }

        function batchSettleGroupPending(groupKey) {
            var n = 0;
            list.forEach(function (e) {
                if (referralGroupKeyFromEvent(e) === groupKey && e.settlement !== 'PAID') {
                    e.settlement = 'PAID';
                    n++;
                }
            });
            if (n === 0) return;
            saveReferrals(list);
            appendAudit('REFERRAL_SETTLEMENT_BATCH', groupKey + ' n=' + n);
            closeBank();
            render();
        }

        render();

        var tbody = el('ops-referral-body');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var tgl = e.target.closest('.ops-ref-toggle');
                if (tgl) {
                    var k = decodeGroupKey(tgl.getAttribute('data-group-key') || '');
                    if (!k) return;
                    if (refExpandedGroupKeys.has(k)) refExpandedGroupKeys.delete(k);
                    else refExpandedGroupKeys.add(k);
                    render();
                    return;
                }
                var bank = e.target.closest('.ops-bank');
                if (bank) {
                    var gk = decodeGroupKey(bank.getAttribute('data-group-key') || '');
                    if (gk) openBankModal(gk);
                    return;
                }
                var mp = e.target.closest('.ops-ref-mark-paid');
                if (mp && !mp.disabled) {
                    settleRecord(mp.getAttribute('data-record-id'), 'PAID');
                    return;
                }
                var mpen = e.target.closest('.ops-ref-mark-pending');
                if (mpen && !mpen.disabled) {
                    settleRecord(mpen.getAttribute('data-record-id'), 'PENDING');
                }
            });
        }

        var bclose = el('ops-modal-bank-close');
        var bmodal = el('ops-modal-bank');
        var bbatch = el('ops-btn-bank-batch-paid');
        var bcloseOnly = el('ops-btn-bank-close-only');
        if (bclose) bclose.addEventListener('click', closeBank);
        if (bcloseOnly) bcloseOnly.addEventListener('click', closeBank);
        if (bmodal) {
            bmodal.addEventListener('click', function (e) {
                if (e.target === bmodal) closeBank();
            });
        }
        if (bbatch) {
            bbatch.addEventListener('click', function () {
                if (selectedBankGroupKey) batchSettleGroupPending(selectedBankGroupKey);
            });
        }
    }

    function renderAudit() {
        var box = el('ops-audit-log');
        if (!box) return;
        var logs = loadAudit();
        if (!logs.length) {
            box.innerHTML = '<p class="text-slate-400">暂无记录</p>';
            return;
        }
        box.innerHTML = logs.map(function (l) {
            return (
                '<div class="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">' +
                '<span class="text-[10px] font-mono text-slate-400">' + escapeHtml(l.ts.slice(0, 19).replace('T', ' ')) + '</span>' +
                '<span class="ml-2 text-[10px] font-black text-ops-700">' + escapeHtml(l.action) + '</span>' +
                '<p class="text-slate-600 mt-0.5">' + escapeHtml(l.detail) + '</p>' +
                '</div>'
            );
        }).join('');
    }

    function initAnnouncePage() {
        if (typeof window.wrappedFetch === 'function') {
            initAnnouncePageLive();
            return;
        }
        renderAudit();
        var pub = el('ops-btn-publish-ann');
        var clr = el('ops-btn-clear-ann');
        if (!pub || !clr) return;
        pub.addEventListener('click', function () {
            var html = el('ops-ann-html').value.trim();
            var vf = el('ops-ann-from').value;
            var vt = el('ops-ann-to').value;
            if (!html) {
                alert('请填写 HTML 内容');
                return;
            }
            var payload = {
                id: 'ann-' + Date.now(),
                html: html,
                validFrom: vf ? new Date(vf).toISOString() : new Date(0).toISOString(),
                validTo: vt ? new Date(vt).toISOString() : new Date('2099-12-31').toISOString()
            };
            try {
                localStorage.setItem(ANNOUNCE_KEY, JSON.stringify(payload));
            } catch (e) { /* ignore */ }
            appendAudit('SITE_ANNOUNCEMENT_PUBLISH', payload.id);
            renderAudit();
            alert('已发布。请打开租户 index.html 查看顶部公告条。');
        });
        clr.addEventListener('click', function () {
            try {
                localStorage.removeItem(ANNOUNCE_KEY);
            } catch (e) { /* ignore */ }
            appendAudit('SITE_ANNOUNCEMENT_CLEAR', '');
            renderAudit();
        });
    }

    function parseSubEnd(val) {
        if (val == null) return '—';
        var s = String(val);
        return s.length >= 10 ? s.slice(0, 10) : s;
    }

    function initTenantsQuotaTreePageLive() {
        var catalog = loadSubscriptionCatalog();
        var mergedRows = [];
        var expanded = new Set();
        var sortKey = 'aiTokensMonth';
        currentIndustry = 'ALL';
        currentVertical = 'ALL';

        function sortRows(rows) {
            rows.sort(function (a, b) {
                if (sortKey === 'aiTokensMonth') return (b.aiTokensMonth || 0) - (a.aiTokensMonth || 0);
                if (sortKey === 'sub_end') return String(b.raw.expiry || '').localeCompare(String(a.raw.expiry || ''));
                if (sortKey === 'activity') {
                    var sa = (a.usage.products || 0) + (a.usage.customers || 0) + (a.usage.suppliers || 0);
                    var sb = (b.usage.products || 0) + (b.usage.customers || 0) + (b.usage.suppliers || 0);
                    return sb - sa;
                }
                return (b[sortKey] || 0) - (a[sortKey] || 0);
            });
        }

        function refresh() {
            var rows = mergedRows.filter(function (r) {
                var okIndustry = currentIndustry === 'ALL' || r.raw.industry === currentIndustry;
                var okVertical = currentVertical === 'ALL' || r.raw.industryVertical === currentVertical;
                return okIndustry && okVertical;
            });
            sortRows(rows);
            renderTenantTreeMergedRows(rows, expanded, { live: true });
            updateTenantStats(mergedRowsToStatsList(mergedRows), currentIndustry);
        }

        async function loadData() {
            var root = el('ops-tree-root');
            if (root) root.innerHTML = '<p class="text-slate-500 text-sm py-8 text-center">加载租户数据…</p>';
            try {
                var q = 'industry=' + encodeURIComponent(toMerchantApiKey(currentIndustry)) +
                    '&vertical=' + encodeURIComponent(currentVertical) +
                    '&sort=' + encodeURIComponent(sortKey) + '&size=200';
                var res = await opsFetch('/api/v1/ops/tenants/tree?' + q, { method: 'GET' });
                var data = null;
                try { data = await res.json(); } catch (e) { data = null; }
                if (!res.ok) {
                    var errMsg = (data && data.message) || res.statusText;
                    if (!data && res.status >= 500) errMsg = '运维服务不可用，请确认 OpsService(8085) 已启动';
                    throw new Error(errMsg);
                }
                mergedRows = (Array.isArray(data) ? data : []).map(function (n) {
                    return mapApiTreeNodeToMergedRow(n, catalog);
                });
                refresh();
            } catch (e) {
                if (root) root.innerHTML = '<div class="tm-ops-glass rounded-tm-3xl p-8 text-center text-rose-600 text-sm">加载失败: ' + escapeHtml(e.message) + '</div>';
            }
        }

        var treeRoot = el('ops-tree-root');
        if (treeRoot) {
            treeRoot.addEventListener('click', function (e) {
                var tg = e.target.closest('.ops-tree-toggle');
                if (tg) {
                    var tid = tg.getAttribute('data-tenant-id');
                    if (expanded.has(tid)) expanded.delete(tid); else expanded.add(tid);
                    refresh();
                    return;
                }
                var ed = e.target.closest('.ops-act-edit');
                if (ed) {
                    var row = mergedRows.find(function (x) { return x.raw.id === ed.getAttribute('data-id'); });
                    if (!row) return;
                    el('ops-modal-tenant-id').value = row.raw.id;
                    el('ops-modal-tenant-title').textContent = '运维：' + (row.raw.name || row.raw.id);
                    el('ops-modal-tenant-sub').textContent = '延长天数将叠加至当前到期日；也可直接指定到期日。';
                    el('ops-input-trial-months').value = '1';
                    el('ops-input-trial-note').value = '';
                    el('ops-input-expiry-date').value = row.raw.expiry || '';
                    el('ops-modal-tenant').classList.remove('hidden');
                    return;
                }
                var rt = e.target.closest('.ops-act-retype');
                if (rt) {
                    var rowR = mergedRows.find(function (x) { return x.raw.id === rt.getAttribute('data-id'); });
                    if (!rowR) return;
                    el('ops-modal-retype-id').value = rowR.raw.id;
                    el('ops-modal-retype-title').textContent = '切换类型：' + (rowR.raw.name || rowR.raw.id);
                    el('ops-retype-merchant').value = '';
                    el('ops-retype-vertical').value = '';
                    el('ops-retype-reason').value = '';
                    el('ops-modal-retype').classList.remove('hidden');
                    return;
                }
                var term = e.target.closest('.ops-act-terminate');
                if (term) {
                    var rowT = mergedRows.find(function (x) { return x.raw.id === term.getAttribute('data-id'); });
                    if (!rowT) return;
                    var tid = rowT.raw.id;
                    var msg = '确定注销租户「' + (rowT.raw.name || tid) + '」？\n\n将清空全部账户、产品、订单、供应商、SKU、仓库、进货单据等业务数据，且不可恢复。';
                    if (!confirm(msg)) return;
                    var reason = prompt('请输入注销原因（审计记录）：', '运维注销') || '运维注销';
                    (async function () {
                        try {
                            var res = await opsFetch('/api/v1/ops/tenants/' + encodeURIComponent(tid) + '/terminate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason: reason })
                            });
                            var data = await res.json().catch(function () { return {}; });
                            if (!res.ok) throw new Error(data.message || '注销失败');
                            opsNotify(data.message || '已注销', 'success');
                            await loadData();
                        } catch (err) {
                            opsNotify(err.message || String(err), 'error');
                        }
                    })();
                }
            });
        }

        function closeRetypeModal() {
            var modal = el('ops-modal-retype');
            if (modal) modal.classList.add('hidden');
        }
        var retypeModal = el('ops-modal-retype');
        var retypeClose = el('ops-modal-retype-close');
        if (retypeModal && retypeClose) {
            retypeClose.addEventListener('click', closeRetypeModal);
            retypeModal.addEventListener('click', function (e) { if (e.target === retypeModal) closeRetypeModal(); });
        }
        var retypeSave = el('ops-btn-save-retype');
        if (retypeSave) {
            retypeSave.onclick = async function () {
                var tid = el('ops-modal-retype-id').value;
                var merchant = el('ops-retype-merchant').value;
                var vertical = el('ops-retype-vertical').value;
                var reason = (el('ops-retype-reason').value || '').trim();
                if (!merchant && !vertical) {
                    opsNotify('请至少选择一项要修改的业态或行业', 'warning');
                    return;
                }
                if (!confirm('切换后将清空该租户全部业务数据（账户保留）。确定继续？')) return;
                try {
                    var body = { reason: reason || '运维切换业态/行业' };
                    if (merchant) body.merchantType = toMerchantApiKey(merchant);
                    if (vertical) body.industryVertical = vertical;
                    var res = await opsFetch('/api/v1/ops/tenants/' + encodeURIComponent(tid) + '/retype', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    var data = await res.json().catch(function () { return {}; });
                    if (!res.ok) throw new Error(data.message || '切换失败');
                    closeRetypeModal();
                    opsNotify(data.message || '已切换', 'success');
                    await loadData();
                } catch (err) {
                    opsNotify(err.message || String(err), 'error');
                }
            };
        }

        function closeModal() { var modal = el('ops-modal-tenant'); if (modal) modal.classList.add('hidden'); }
        var m = el('ops-modal-tenant'), mclose = el('ops-modal-tenant-close');
        if (m && mclose) {
            mclose.addEventListener('click', closeModal);
            m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
        }
        var saveBtn = el('ops-btn-save-tenant-ops');
        if (saveBtn) {
            saveBtn.onclick = async function () {
                var tid = el('ops-modal-tenant-id').value;
                var months = parseInt(el('ops-input-trial-months').value, 10) || 0;
                var note = el('ops-input-trial-note').value.trim();
                var dateStr = el('ops-input-expiry-date').value;
                try {
                    if (months > 0) {
                        var r1 = await opsFetch('/api/v1/ops/tenant/extend-subscription', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId: tid, extendDays: months * 30, reason: note || ('赠送' + months + '个月') })
                        });
                        var j1 = await r1.json();
                        if (!r1.ok) throw new Error(j1.message || '延长失败');
                    }
                    if (dateStr) {
                        var row = mergedRows.find(function (x) { return x.raw.id === tid; });
                        var base = row && row.raw.expiry ? new Date(row.raw.expiry + 'T12:00:00') : new Date();
                        var diff = Math.ceil((new Date(dateStr + 'T23:59:59') - base) / 86400000);
                        if (diff > 0) {
                            var r2 = await opsFetch('/api/v1/ops/tenant/extend-subscription', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tenantId: tid, extendDays: diff, reason: note || ('到期日调至' + dateStr) })
                            });
                            var j2 = await r2.json();
                            if (!r2.ok) throw new Error(j2.message || '调整到期失败');
                        }
                    }
                    closeModal();
                    await loadData();
                    alert('已保存');
                } catch (err) { alert(err.message || String(err)); }
            };
        }
        var filterRoot = el('ops-industry-filter');
        if (filterRoot) {
            filterRoot.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-industry]');
                if (!btn) return;
                currentIndustry = btn.getAttribute('data-industry') || 'ALL';
                filterRoot.querySelectorAll('.ops-filter-chip').forEach(function (b) {
                    var on = b.getAttribute('data-industry') === currentIndustry;
                    b.className = on ? 'ops-filter-chip px-4 py-2 rounded-2xl text-xs font-bold border-2 border-ops-600 bg-ops-600 text-white shadow-md' : 'ops-filter-chip px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 bg-white/90 text-slate-600 hover:border-ops-300';
                });
                loadData();
            });
        }
        var verticalRoot = el('ops-vertical-filter');
        if (verticalRoot) {
            verticalRoot.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-vertical]');
                if (!btn) return;
                currentVertical = btn.getAttribute('data-vertical') || 'ALL';
                verticalRoot.querySelectorAll('.ops-vertical-chip').forEach(function (b) {
                    var on = b.getAttribute('data-vertical') === currentVertical;
                    b.className = on ? 'ops-vertical-chip px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 border-emerald-600 bg-emerald-600 text-white' : 'ops-vertical-chip px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 bg-white/90 text-slate-600';
                });
                loadData();
            });
        }
        var sortSel = el('ops-tree-sort');
        if (sortSel) {
            sortSel.addEventListener('change', function () { sortKey = sortSel.value || 'aiTokensMonth'; refresh(); });
            sortKey = sortSel.value || 'aiTokensMonth';
        }
        loadData();
    }

    function initReferralPageLive() {
        var list = [];

        function groupReferralEventsLive(events) {
            var m = {};
            events.forEach(function (e) {
                var k = (e.referral_code || '') + '\u0000' + (e.user_name || e.referrer_user_id);
                if (!m[k]) {
                    m[k] = {
                        key: k,
                        code: e.referral_code || '—',
                        referrer: e.user_name || ('#' + e.referrer_user_id),
                        payee: e,
                        records: []
                    };
                }
                m[k].records.push(e);
            });
            return Object.keys(m).map(function (k) { return m[k]; });
        }

        function renderSummary(groups) {
            var box = el('ops-ref-summary-cards');
            if (!box) return;
            var pending = list.filter(function (x) { return refRewardPending(x.status); }).length;
            var paid = list.filter(function (x) { return x.status === 'PAID'; }).length;
            function card(label, val, sub) {
                return '<div class="tm-ops-glass rounded-2xl p-4 border border-indigo-100/80">' +
                    '<p class="text-[10px] font-bold text-slate-400 uppercase">' + escapeHtml(label) + '</p>' +
                    '<p class="mt-1 text-xl font-black text-ops-700 font-mono">' + escapeHtml(val) + '</p>' +
                    (sub ? '<p class="text-[10px] text-slate-500 mt-0.5">' + escapeHtml(sub) + '</p>' : '') + '</div>';
            }
            box.innerHTML = card('推荐分组', String(groups.length), '按推荐码聚合') +
                card('奖励记录', String(list.length), '每条 = 一次有效首订') +
                card('待结算', String(pending), 'ACCRUED / PAYABLE') +
                card('已结算', String(paid), '');
        }

        function renderRewardActions(r) {
            var id = rewardIdStr(r);
            var pending = refRewardPending(r.status);
            var paid = r.status === 'PAID';
            return (
                '<button type="button" class="ops-ref-mark-paid mr-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' +
                (pending ? '' : ' hidden') + '" data-record-id="' + escapeHtml(id) + '">标记已打款</button>' +
                '<button type="button" class="ops-ref-mark-pending px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100' +
                (paid ? '' : ' hidden') + '" data-record-id="' + escapeHtml(id) + '">改待结</button>'
            );
        }

        function render() {
            var tbody = el('ops-referral-body');
            if (!tbody) return;
            var groups = groupReferralEventsLive(list);
            renderSummary(groups);
            var rows = [];
            groups.forEach(function (g) {
                var enc = encodeGroupKey(g.key);
                var expanded = refExpandedGroupKeys.has(g.key);
                var pendingN = g.records.filter(function (r) { return refRewardPending(r.status); }).length;
                var paidN = g.records.filter(function (r) { return r.status === 'PAID'; }).length;
                var caret = expanded ? 'ph-caret-down' : 'ph-caret-right';
                var payee = g.payee || g.records[0] || {};
                rows.push(
                    '<tr class="hover:bg-ops-50/40 bg-white/70">' +
                    '<td class="px-2 py-3 align-middle">' +
                    '<button type="button" class="ops-ref-toggle w-8 h-8 rounded-xl flex items-center justify-center text-ops-600 hover:bg-ops-50 border border-transparent hover:border-ops-200" data-group-key="' + escapeHtml(enc) + '" title="展开/收起">' +
                    '<i class="ph ' + caret + ' text-lg"></i></button></td>' +
                    '<td class="px-4 py-3 font-mono text-xs font-semibold text-slate-800">' + escapeHtml(g.code) + '</td>' +
                    '<td class="px-4 py-3 font-semibold">' + escapeHtml(g.referrer) +
                    (payee.real_name && payee.real_name !== g.referrer ? '<div class="text-[10px] text-slate-500 font-normal">' + escapeHtml(payee.real_name) + '</div>' : '') +
                    '</td>' +
                    '<td class="px-4 py-3 text-[11px]">' + refContactCell(payee) + '</td>' +
                    '<td class="px-4 py-3"><span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-ops-100 text-ops-800 font-black font-mono">' + g.records.length + '</span></td>' +
                    '<td class="px-4 py-3 text-[11px]"><span class="text-amber-600 font-bold">待 ' + pendingN + '</span> · <span class="text-emerald-600 font-bold">已 ' + paidN + '</span></td>' +
                    '<td class="px-4 py-3 text-right whitespace-nowrap">' +
                    '<button type="button" class="ops-bank px-3 py-1.5 rounded-xl text-[10px] font-bold bg-ops-50 text-ops-700 border border-ops-200 hover:bg-ops-100" data-group-key="' + escapeHtml(enc) + '">收款信息</button>' +
                    '</td></tr>'
                );
                var detailHidden = expanded ? '' : 'hidden';
                var innerRows = g.records.slice().sort(function (a, b) {
                    return String(b.qualified_at || b.create_time || '').localeCompare(String(a.qualified_at || a.create_time || ''));
                }).map(function (r) {
                    return (
                        '<tr class="border-b border-indigo-100/60 last:border-0">' +
                        '<td class="py-2 pr-3 font-medium text-slate-800">' + escapeHtml(r.referee_tenant_name || r.referee_tenant_id || '—') + '</td>' +
                        '<td class="py-2 px-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">' + escapeHtml(refFormatTime(r.qualified_at || r.create_time)) + '</td>' +
                        '<td class="py-2 px-2 font-mono text-slate-700">¥' + escapeHtml(String(r.reward_amount != null ? r.reward_amount : '—')) + '</td>' +
                        '<td class="py-2 px-2">' + refRewardStatusHtml(r.status) + '</td>' +
                        '<td class="py-2 pl-2 text-right whitespace-nowrap">' + renderRewardActions(r) + '</td></tr>'
                    );
                }).join('');
                rows.push(
                    '<tr class="ops-ref-expand-row ' + detailHidden + ' bg-slate-50/90">' +
                    '<td colspan="7" class="p-0">' +
                    '<div class="px-3 py-3 pl-4 md:pl-14 border-t border-indigo-100/80">' +
                    '<p class="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">组内有效推荐明细（逐笔结算）</p>' +
                    '<div class="overflow-x-auto rounded-2xl border border-indigo-100/60 bg-white/90">' +
                    '<table class="w-full text-left text-xs min-w-[640px]">' +
                    '<thead class="bg-ops-50/60 text-[10px] uppercase font-bold text-ops-800">' +
                    '<tr><th class="px-3 py-2">被推荐租户</th><th class="px-3 py-2">达标日</th><th class="px-3 py-2">奖励金额</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th></tr></thead>' +
                    '<tbody>' + innerRows + '</tbody></table></div></div></td></tr>'
                );
            });
            tbody.innerHTML = rows.join('');
        }

        function closeBank() {
            var modal = el('ops-modal-bank');
            if (modal) modal.classList.add('hidden');
        }

        function openBankModal(groupKey) {
            selectedBankGroupKey = groupKey;
            var groups = groupReferralEventsLive(list);
            var g = groups.find(function (x) { return x.key === groupKey; });
            if (!g) return;
            var payee = g.payee || g.records[0] || {};
            el('ops-modal-bank-sub').textContent = g.referrer + ' · ' + g.code;
            var contactBox = el('ops-modal-bank-contact');
            if (contactBox) {
                var phone = payee.phone ? String(payee.phone) : '';
                contactBox.innerHTML =
                    (phone ? '<p>电话：<a href="tel:' + escapeHtml(phone) + '" class="text-ops-700 font-bold hover:underline">' + escapeHtml(phone) + '</a></p>' : '<p class="text-slate-400">未登记手机号</p>') +
                    (payee.email ? '<p>邮箱：<span class="font-mono">' + escapeHtml(String(payee.email)) + '</span></p>' : '');
            }
            el('ops-modal-bank-content').textContent = refBuildPayeeBlock(payee);
            var cnt = el('ops-modal-bank-count');
            if (cnt) cnt.textContent = String(g.records.length);
            el('ops-modal-bank').classList.remove('hidden');
        }

        async function markPaid(recordId) {
            var r2 = await opsFetch('/api/v1/ops/referrals/rewards/' + recordId + '/mark-paid', { method: 'POST' });
            var j2 = await r2.json();
            if (!r2.ok) throw new Error((j2 && j2.message) || '标记失败');
            appendAudit('REFERRAL_MARK_PAID', recordId);
            return j2;
        }

        async function markPayable(recordId) {
            var r2 = await opsFetch('/api/v1/ops/referrals/rewards/' + recordId + '/mark-payable', { method: 'POST' });
            var j2 = await r2.json();
            if (!r2.ok) throw new Error((j2 && j2.message) || '回退失败');
            appendAudit('REFERRAL_MARK_PAYABLE', recordId);
            return j2;
        }

        async function batchSettleGroupPending(groupKey) {
            var pending = list.filter(function (r) {
                return ((r.referral_code || '') + '\u0000' + (r.user_name || r.referrer_user_id)) === groupKey && refRewardPending(r.status);
            });
            if (!pending.length) {
                alert('该组无待结算记录');
                return;
            }
            if (!confirm('确认将本组 ' + pending.length + ' 笔待结算全部标记为已打款？')) return;
            try {
                for (var i = 0; i < pending.length; i++) {
                    await markPaid(rewardIdStr(pending[i]));
                }
                closeBank();
                await loadRewards();
                alert('已批量标记 ' + pending.length + ' 笔');
            } catch (err) {
                alert(err.message || String(err));
                loadRewards();
            }
        }

        async function loadRewards() {
            var tbody = el('ops-referral-body');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">加载中…</td></tr>';
            try {
                var res = await opsFetch('/api/v1/ops/referrals/rewards?status=ALL', { method: 'GET' });
                var data = null;
                try { data = await res.json(); } catch (parseErr) { data = null; }
                if (!res.ok) {
                    var errMsg = (data && data.message) || res.statusText;
                    if (!data && res.status >= 500) errMsg = '运维服务不可用，请确认 OpsService(8085) 已启动且网关已路由 /api/v1/ops';
                    throw new Error(errMsg);
                }
                list = Array.isArray(data) ? data : [];
                if (!list.length) {
                    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">暂无推荐奖励记录</td></tr>';
                    var box = el('ops-ref-summary-cards');
                    if (box) box.innerHTML = '';
                    return;
                }
                render();
            } catch (e) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-rose-600 text-sm">' + escapeHtml(e.message) + '</td></tr>';
            }
        }

        var tbody = el('ops-referral-body');
        if (tbody) {
            tbody.addEventListener('click', async function (e) {
                var tgl = e.target.closest('.ops-ref-toggle');
                if (tgl) {
                    var k = decodeGroupKey(tgl.getAttribute('data-group-key') || '');
                    if (refExpandedGroupKeys.has(k)) refExpandedGroupKeys.delete(k);
                    else refExpandedGroupKeys.add(k);
                    render();
                    return;
                }
                var bank = e.target.closest('.ops-bank');
                if (bank) {
                    var gk = decodeGroupKey(bank.getAttribute('data-group-key') || '');
                    if (gk) openBankModal(gk);
                    return;
                }
                var mp = e.target.closest('.ops-ref-mark-paid');
                if (mp) {
                    var id = mp.getAttribute('data-record-id');
                    try {
                        var j = await markPaid(id);
                        alert(j.message && j.idempotent ? j.message : '已标记为已打款');
                        loadRewards();
                    } catch (err) {
                        alert(err.message || String(err));
                    }
                    return;
                }
                var mpen = e.target.closest('.ops-ref-mark-pending');
                if (mpen) {
                    var id2 = mpen.getAttribute('data-record-id');
                    if (!confirm('确认将该笔奖励回退为待结算？')) return;
                    try {
                        var j2 = await markPayable(id2);
                        alert(j2.message && j2.idempotent ? j2.message : '已改回待结算');
                        loadRewards();
                    } catch (err) {
                        alert(err.message || String(err));
                    }
                }
            });
        }

        var bclose = el('ops-modal-bank-close');
        var bmodal = el('ops-modal-bank');
        var bbatch = el('ops-btn-bank-batch-paid');
        var bcloseOnly = el('ops-btn-bank-close-only');
        if (bclose) bclose.addEventListener('click', closeBank);
        if (bcloseOnly) bcloseOnly.addEventListener('click', closeBank);
        if (bmodal) {
            bmodal.addEventListener('click', function (ev) {
                if (ev.target === bmodal) closeBank();
            });
        }
        if (bbatch) {
            bbatch.addEventListener('click', function () {
                if (selectedBankGroupKey) batchSettleGroupPending(selectedBankGroupKey);
            });
        }

        loadRewards();
    }

    var opsFbCurrentId = null;

    var FB_STATUS_LABEL = {
        OPEN: '待处理',
        IN_PROGRESS: '处理中',
        RESOLVED: '已解决',
        CLOSED: '已关闭'
    };

    var FB_STATUS_CLASS = {
        OPEN: 'bg-amber-100 text-amber-800',
        IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
        RESOLVED: 'bg-emerald-100 text-emerald-800',
        CLOSED: 'bg-slate-100 text-slate-600'
    };

    function fbFormatTime(v) {
        if (!v) return '—';
        var s = String(v);
        return s.replace('T', ' ').slice(0, 16);
    }

    function fbExtractImageUrls(row) {
        if (!row) return [];
        var raw = row.image_display_urls || row.image_urls || row.imageUrls;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (eJson) { raw = []; }
        }
        if (!Array.isArray(raw)) return [];
        return raw.map(function (u) { return String(u || '').trim(); }).filter(Boolean);
    }

    function initFeedbackPage() {
        if (typeof window.wrappedFetch !== 'function') {
            initFeedbackPageMock();
            return;
        }
        initFeedbackPageLive();
    }

    function initFeedbackPageMock() {
        var tbody = el('ops-fb-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500 text-sm">请登录运维账号并启动网关与 OpsService 后查看真实数据</td></tr>';
        }
    }

    function initFeedbackPageLive() {
        var tenantFilter = el('ops-fb-filter-tenant');
        if (tenantFilter) {
            tenantFilter.value = '';
        }

        function statusPill(st) {
            var label = FB_STATUS_LABEL[st] || st;
            var cls = FB_STATUS_CLASS[st] || 'bg-slate-100 text-slate-600';
            return '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ' + cls + '">' + escapeHtml(label) + '</span>';
        }

        function renderSummary(summary) {
            var box = el('ops-fb-summary-cards');
            if (!box) return;
            var map = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
            (summary || []).forEach(function (row) {
                var k = String(row.status || '');
                map[k] = Number(row.cnt) || 0;
            });
            var total = map.OPEN + map.IN_PROGRESS + map.RESOLVED + map.CLOSED;
            box.innerHTML = [
                { label: '全部', val: total, cls: 'text-slate-800' },
                { label: '待处理', val: map.OPEN, cls: 'text-amber-700' },
                { label: '处理中', val: map.IN_PROGRESS, cls: 'text-indigo-700' },
                { label: '已解决', val: map.RESOLVED, cls: 'text-emerald-700' }
            ].map(function (c) {
                return '<div class="tm-ops-glass rounded-2xl p-4 border border-indigo-50"><p class="text-[10px] text-slate-500 font-bold uppercase">' + c.label + '</p><p class="text-2xl font-black mt-1 ' + c.cls + '">' + c.val + '</p></div>';
            }).join('');
        }

        function renderTable(items) {
            var tbody = el('ops-fb-tbody');
            var empty = el('ops-fb-empty');
            if (!tbody) return;
            if (!items || !items.length) {
                tbody.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');
            tbody.innerHTML = items.map(function (row) {
                var id = String(row.id || '');
                var preview = row.content_preview || (row.content ? String(row.content).slice(0, 40) : '');
                var rowImgs = fbExtractImageUrls(row);
                var imgCnt = row.image_count != null ? row.image_count : rowImgs.length;
                return '<tr class="hover:bg-ops-50/50">'
                    + '<td class="px-4 py-3 font-mono text-[10px]">' + escapeHtml(String(row.feedback_no || '')) + '</td>'
                    + '<td class="px-4 py-3"><div class="font-semibold text-slate-800">' + escapeHtml(String(row.tenant_name || '')) + '</div><div class="text-[10px] text-slate-400 font-mono">' + escapeHtml(String(row.tenant_id || '')) + '</div></td>'
                    + '<td class="px-4 py-3">' + escapeHtml(String(row.user_name || '')) + '</td>'
                    + '<td class="px-4 py-3 max-w-[12rem] truncate text-slate-600" title="' + escapeHtml(String(row.content || preview)) + '">' + escapeHtml(preview) + '</td>'
                    + '<td class="px-4 py-3 text-center">' + (imgCnt ? '<span class="text-ops-700 font-bold">' + imgCnt + '</span>' : '—') + '</td>'
                    + '<td class="px-4 py-3">' + statusPill(String(row.status || '')) + '</td>'
                    + '<td class="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">' + escapeHtml(fbFormatTime(row.created_at)) + '</td>'
                    + '<td class="px-4 py-3 text-right"><button type="button" class="ops-fb-view text-ops-600 font-bold hover:underline" data-id="' + escapeHtml(id) + '">查看</button></td>'
                    + '</tr>';
            }).join('');
        }

        async function loadList() {
            var tbody = el('ops-fb-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">加载中…</td></tr>';
            var q = [];
            var st = el('ops-fb-filter-status');
            var tenant = el('ops-fb-filter-tenant');
            var df = el('ops-fb-filter-from');
            var dt = el('ops-fb-filter-to');
            if (st && st.value && st.value !== 'ALL') q.push('status=' + encodeURIComponent(st.value));
            if (tenant && tenant.value.trim()) q.push('tenantId=' + encodeURIComponent(tenant.value.trim()));
            if (df && df.value) q.push('dateFrom=' + encodeURIComponent(df.value));
            if (dt && dt.value) q.push('dateTo=' + encodeURIComponent(dt.value));
            try {
                var res = await opsFetch('/api/v1/ops/feedback?' + q.join('&'), { method: 'GET' });
                if (!res.ok) {
                    throw new Error(await opsParseError(res));
                }
                var data = await res.json();
                renderSummary(data.summary);
                renderTable(data.items);
            } catch (e) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-rose-600 text-sm">' + escapeHtml(e.message) + '</td></tr>';
            }
        }

        function closeDrawer() {
            var dr = el('ops-fb-drawer');
            if (dr) dr.classList.add('hidden');
            opsFbCurrentId = null;
        }

        function openLightbox(url) {
            var lb = el('ops-fb-lightbox');
            var img = el('ops-fb-lightbox-img');
            if (!lb || !img) return;
            img.src = url;
            lb.classList.remove('hidden');
        }

        async function openDrawer(id) {
            opsFbCurrentId = id;
            var dr = el('ops-fb-drawer');
            var body = el('ops-fb-drawer-body');
            if (!dr || !body) return;
            dr.classList.remove('hidden');
            body.innerHTML = '<p class="text-center text-slate-400 text-xs py-8">加载中…</p>';
            try {
                var res = await opsFetch('/api/v1/ops/feedback/' + encodeURIComponent(id), { method: 'GET' });
                var row = await res.json();
                if (!res.ok) throw new Error((row && row.message) || '加载失败');
                if (el('ops-fb-drawer-no')) el('ops-fb-drawer-no').textContent = String(row.feedback_no || '');
                var stSel = el('ops-fb-drawer-status');
                if (stSel) stSel.value = String(row.status || 'OPEN');
                var imgs = fbExtractImageUrls(row);
                var imgHtml = imgs.length
                    ? '<div class="flex flex-wrap gap-2">' + imgs.map(function (u, idx) {
                        return '<button type="button" class="ops-fb-img w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100" data-url="' + escapeHtml(u) + '">'
                            + '<img src="' + escapeHtml(u) + '" class="w-full h-full object-cover" alt="截图' + (idx + 1) + '" loading="lazy" referrerpolicy="no-referrer" /></button>';
                    }).join('') + '</div>'
                    : '<p class="text-xs text-slate-400">无截图</p>';
                var timeline = (row.followups || []).map(function (f) {
                    var line = escapeHtml(fbFormatTime(f.created_at)) + ' · ' + escapeHtml(String(f.operator_name || '运维'));
                    if (f.action === 'STATUS_CHANGE' && f.from_status && f.to_status) {
                        line += ' · ' + escapeHtml(FB_STATUS_LABEL[f.from_status] || f.from_status) + ' → ' + escapeHtml(FB_STATUS_LABEL[f.to_status] || f.to_status);
                    }
                    var note = f.note ? '<p class="text-xs text-slate-600 mt-1">' + escapeHtml(String(f.note)) + '</p>' : '';
                    return '<li class="border-l-2 border-ops-200 pl-3 py-2"><p class="text-[10px] text-slate-500">' + line + '</p>' + note + '</li>';
                }).join('');
                body.innerHTML = ''
                    + '<div class="text-xs space-y-1 text-slate-500"><p><span class="font-bold text-slate-700">租户</span> ' + escapeHtml(String(row.tenant_name || '')) + ' <span class="font-mono">(' + escapeHtml(String(row.tenant_id || '')) + ')</span></p>'
                    + '<p><span class="font-bold text-slate-700">提交人</span> ' + escapeHtml(String(row.user_name || '')) + ' · ' + escapeHtml(fbFormatTime(row.created_at)) + '</p></div>'
                    + '<div class="bg-slate-50 rounded-2xl p-4 border border-slate-100"><p class="text-xs font-bold text-slate-500 mb-2">问题描述</p><p class="text-sm text-slate-800 whitespace-pre-wrap">' + escapeHtml(String(row.content || '')) + '</p></div>'
                    + '<div><p class="text-xs font-bold text-slate-500 mb-2">截图</p>' + imgHtml + '</div>'
                    + '<div><p class="text-xs font-bold text-slate-500 mb-2">跟进记录</p><ul class="space-y-1">' + (timeline || '<li class="text-xs text-slate-400">暂无</li>') + '</ul></div>';
                body.querySelectorAll('.ops-fb-img').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        openLightbox(btn.getAttribute('data-url'));
                    });
                });
            } catch (err) {
                body.innerHTML = '<p class="text-center text-rose-600 text-sm">' + escapeHtml(err.message) + '</p>';
            }
        }

        var refreshBtn = el('ops-fb-btn-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', loadList);

        var tbody = el('ops-fb-tbody');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var btn = e.target.closest('.ops-fb-view');
                if (btn) openDrawer(btn.getAttribute('data-id'));
            });
        }

        var closeBtn = el('ops-fb-drawer-close');
        var backdrop = el('ops-fb-drawer-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
        if (backdrop) backdrop.addEventListener('click', closeDrawer);

        var lbClose = el('ops-fb-lightbox-close');
        var lb = el('ops-fb-lightbox');
        if (lbClose) lbClose.addEventListener('click', function () { if (lb) lb.classList.add('hidden'); });
        if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) lb.classList.add('hidden'); });

        var saveSt = el('ops-fb-btn-save-status');
        if (saveSt) {
            saveSt.addEventListener('click', async function () {
                if (!opsFbCurrentId) return;
                var status = el('ops-fb-drawer-status').value;
                var note = (el('ops-fb-drawer-note') && el('ops-fb-drawer-note').value) || '';
                try {
                    var res = await opsFetch('/api/v1/ops/feedback/' + encodeURIComponent(opsFbCurrentId) + '/status', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: status, note: note })
                    });
                    var j = await res.json();
                    if (!res.ok) throw new Error((j && j.message) || '更新失败');
                    appendAudit('FEEDBACK_STATUS', opsFbCurrentId + ' -> ' + status);
                    if (el('ops-fb-drawer-note')) el('ops-fb-drawer-note').value = '';
                    await openDrawer(opsFbCurrentId);
                    loadList();
                } catch (err) {
                    alert(err.message || String(err));
                }
            });
        }

        var addNote = el('ops-fb-btn-add-note');
        if (addNote) {
            addNote.addEventListener('click', async function () {
                if (!opsFbCurrentId) return;
                var note = (el('ops-fb-drawer-note') && el('ops-fb-drawer-note').value.trim()) || '';
                if (!note) { alert('请填写备注'); return; }
                try {
                    var res = await opsFetch('/api/v1/ops/feedback/' + encodeURIComponent(opsFbCurrentId) + '/followups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ note: note })
                    });
                    var j = await res.json();
                    if (!res.ok) throw new Error((j && j.message) || '保存失败');
                    appendAudit('FEEDBACK_NOTE', opsFbCurrentId);
                    if (el('ops-fb-drawer-note')) el('ops-fb-drawer-note').value = '';
                    await openDrawer(opsFbCurrentId);
                } catch (err) {
                    alert(err.message || String(err));
                }
            });
        }

        loadList();
    }

    function initAnnouncePageLive() {
        renderAudit();

        async function loadAnnouncements() {
            try {
                var res = await opsFetch('/api/v1/ops/announcements', { method: 'GET' });
                var items = await res.json();
                if (!res.ok || !Array.isArray(items) || !items.length) return;
                var a = items[0];
                if (el('ops-ann-html')) el('ops-ann-html').value = a.bodyMd || a.body_md || '';
                if (el('ops-ann-from') && a.activeFrom) {
                    var f = String(a.activeFrom).slice(0, 16);
                    el('ops-ann-from').value = f;
                }
                if (el('ops-ann-to') && a.activeUntil) {
                    el('ops-ann-to').value = String(a.activeUntil).slice(0, 16);
                }
            } catch (e) { /* ignore */ }
        }

        var pub = el('ops-btn-publish-ann');
        var clr = el('ops-btn-clear-ann');
        if (pub) {
            pub.addEventListener('click', async function () {
                var html = el('ops-ann-html').value.trim();
                var title = html.replace(/<[^>]+>/g, '').slice(0, 80) || '全站公告';
                var vf = el('ops-ann-from').value;
                var vt = el('ops-ann-to').value;
                if (!html) { alert('请填写 HTML 内容'); return; }
                try {
                    var body = {
                        title: title,
                        bodyMd: html,
                        priority: 0,
                        activeFrom: vf ? new Date(vf).toISOString() : null,
                        activeUntil: vt ? new Date(vt).toISOString() : null
                    };
                    var res = await opsFetch('/api/v1/ops/announcements', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    var j = await res.json();
                    if (!res.ok) throw new Error(j.message || '发布失败');
                    appendAudit('SITE_ANNOUNCEMENT_PUBLISH', j.id || '');
                    renderAudit();
                    alert('公告已发布');
                } catch (err) {
                    alert(err.message || String(err));
                }
            });
        }
        if (clr) {
            clr.addEventListener('click', function () {
                try { localStorage.removeItem(ANNOUNCE_KEY); } catch (e) { /* ignore */ }
                appendAudit('SITE_ANNOUNCEMENT_CLEAR', '');
                renderAudit();
                alert('已清除本地公告缓存；服务端公告请在库中管理');
            });
        }

        var auditHint = document.querySelector('#ops-audit-log');
        if (auditHint && auditHint.previousElementSibling) {
            auditHint.previousElementSibling.innerHTML = '敏感操作审计（本页操作写入浏览器本地；生产可对接服务端审计表）';
        }

        loadAnnouncements();
    }

    function maskPromoterPhone(phone) {
        if (!phone) return '—';
        var s = String(phone).trim();
        if (s.length === 11) return s.slice(0, 3) + '****' + s.slice(7);
        return s;
    }

    function formatPromoterTime(val) {
        if (val == null || val === '') return '—';
        var s = String(val);
        return s.length >= 10 ? s.slice(0, 10) : s;
    }

    function renderPromoterList(items, total) {
        var body = el('ops-promoter-list-body');
        var countEl = el('ops-promoter-list-count');
        if (!body) return;
        if (countEl) countEl.textContent = total != null ? ('(' + total + ')') : '';
        if (!items || !items.length) {
            body.innerHTML = '<p class="text-center py-8 text-slate-400">暂无推广员，请在左侧创建</p>';
            body.className = 'flex-1 overflow-y-auto list-scrollbar-ops text-xs text-slate-400 text-center py-8';
            return;
        }
        body.className = 'flex-1 overflow-y-auto list-scrollbar-ops';
        var rows = items.map(function (p) {
            var commission = p.commissionPerReferral != null ? ('¥' + p.commissionPerReferral) : '—';
            var pending = p.pendingSettlement != null ? ('¥' + p.pendingSettlement) : '—';
            var status = p.userStatus === 'NORMAL'
                ? '<span class="text-emerald-600 font-bold text-[10px]">正常</span>'
                : '<span class="text-slate-400 font-bold text-[10px]">' + escapeHtml(p.userStatus || '—') + '</span>';
            return (
                '<div class="rounded-2xl border border-indigo-100/80 bg-white/70 p-3 mb-2 last:mb-0">' +
                '<div class="flex flex-wrap items-start justify-between gap-2">' +
                '<div class="min-w-0">' +
                '<p class="text-xs font-bold text-slate-800">' + escapeHtml(p.realName || p.userName || '—') +
                ' <span class="text-[10px] font-normal text-slate-400 font-mono">#' + escapeHtml(p.userId) + '</span></p>' +
                '<p class="text-[10px] text-slate-500 mt-0.5 font-mono">' + escapeHtml(p.userName || '') + ' · ' + escapeHtml(maskPromoterPhone(p.phone)) + '</p></div>' +
                status + '</div>' +
                '<div class="mt-2 flex flex-wrap gap-2 text-[10px]">' +
                '<span class="px-2 py-1 rounded-lg bg-ops-50 text-ops-700 font-mono font-bold border border-ops-100">' + escapeHtml(p.referralCode || '—') + '</span>' +
                '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">返佣 ' + commission + '</span>' +
                '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">有效推荐 ' + (p.validReferralCount != null ? p.validReferralCount : 0) + '</span>' +
                '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">待结 ' + pending + '</span>' +
                '<span class="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-400">开号 ' + escapeHtml(formatPromoterTime(p.createTime)) + '</span>' +
                '<button type="button" class="ops-promoter-reset-pwd px-2 py-1 rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 text-[10px] font-bold" data-id="' + escapeHtml(String(p.userId)) + '" data-name="' + escapeHtml(p.userName || '') + '">重置密码</button>' +
                '</div></div>'
            );
        }).join('');
        body.innerHTML = rows;
    }

    async function loadPromoterList() {
        var body = el('ops-promoter-list-body');
        if (!body || typeof window.wrappedFetch !== 'function') return;
        body.innerHTML = '<p class="text-center py-8 text-slate-400">加载推广员列表…</p>';
        body.className = 'flex-1 overflow-y-auto list-scrollbar-ops text-xs text-slate-400 text-center py-8';
        try {
            var res = await opsFetch('/api/v1/ops/promoters?page=0&size=200', { method: 'GET' });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok) throw new Error((data && data.message) || '加载失败');
            var items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
            renderPromoterList(items, data.total != null ? data.total : items.length);
        } catch (err) {
            body.innerHTML = '<p class="text-center py-8 text-rose-500">' + escapeHtml(err.message || String(err)) + '</p>';
        }
    }

    function initPromotersPage() {
        loadPromoterList();
        var form = el('ops-promoter-form');
        if (!form || form.dataset.bound === '1') {
            return;
        }
        form.dataset.bound = '1';
        var resultBox = el('ops-promoter-result');
        var lastCode = '';

        var refreshBtn = el('ops-promoter-list-refresh');
        if (refreshBtn && refreshBtn.dataset.bound !== '1') {
            refreshBtn.dataset.bound = '1';
            refreshBtn.addEventListener('click', function () { loadPromoterList(); });
        }
        var listBody = el('ops-promoter-list-body');
        if (listBody && listBody.dataset.resetBound !== '1') {
            listBody.dataset.resetBound = '1';
            listBody.addEventListener('click', function (e) {
                var btn = e.target.closest('.ops-promoter-reset-pwd');
                if (!btn) return;
                var uid = btn.getAttribute('data-id');
                var name = btn.getAttribute('data-name') || uid;
                var pwd = prompt('为推广员「' + name + '」设置新密码（至少 6 位）：');
                if (!pwd || pwd.length < 6) {
                    if (pwd !== null) opsNotify('密码至少 6 位', 'warning');
                    return;
                }
                (async function () {
                    try {
                        var res = await opsFetch('/api/v1/ops/promoters/' + encodeURIComponent(uid) + '/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password: pwd })
                        });
                        var data = await res.json().catch(function () { return {}; });
                        if (!res.ok) throw new Error(data.message || '重置失败');
                        opsNotify('密码已重置，请通知推广员用新密码登录', 'success');
                    } catch (err) {
                        opsNotify(err.message || String(err), 'error');
                    }
                })();
            });
        }

        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            var userName = (el('ops-promoter-username').value || '').trim();
            var password = el('ops-promoter-password').value || '';
            var realName = (el('ops-promoter-realname').value || '').trim();
            var phone = (el('ops-promoter-phone').value || '').trim();
            var email = (el('ops-promoter-email').value || '').trim();
            var commission = parseFloat(el('ops-promoter-commission') && el('ops-promoter-commission').value);
            if (!userName || !password || !realName || !phone) {
                opsNotify('请填写必填项', 'error');
                return;
            }
            if (!/^1\d{10}$/.test(phone)) {
                opsNotify('手机号须为 11 位且以 1 开头', 'error');
                return;
            }
            if (!isFinite(commission) || commission <= 0) {
                opsNotify('请填写有效的单笔返佣金额', 'error');
                return;
            }
            var submitBtn = el('ops-promoter-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '提交中…';
            }
            try {
                var res = await opsFetch('/api/v1/ops/promoters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userName: userName,
                        password: password,
                        realName: realName,
                        phone: phone,
                        email: email || null,
                        commissionPerReferral: commission
                    })
                });
                var data = await res.json();
                if (!res.ok) {
                    throw new Error((data && data.message) || '开号失败');
                }
                lastCode = data.referralCode || '';
                if (el('ops-promoter-res-uid')) el('ops-promoter-res-uid').textContent = data.userId != null ? String(data.userId) : '—';
                if (el('ops-promoter-res-user')) el('ops-promoter-res-user').textContent = data.userName || userName;
                if (el('ops-promoter-res-name')) el('ops-promoter-res-name').textContent = data.realName || realName;
                if (el('ops-promoter-res-phone')) el('ops-promoter-res-phone').textContent = data.phone || phone;
                if (el('ops-promoter-res-code')) el('ops-promoter-res-code').textContent = lastCode || '—';
                if (el('ops-promoter-res-commission')) {
                    el('ops-promoter-res-commission').textContent = data.commissionPerReferral != null ? ('¥' + data.commissionPerReferral) : ('¥' + commission);
                }
                if (resultBox) resultBox.classList.remove('hidden');
                appendAudit('PROMOTER_CREATE', (data.userName || userName) + ' ' + (lastCode || ''));
                form.reset();
                if (el('ops-promoter-commission')) el('ops-promoter-commission').value = '150';
                await loadPromoterList();
                opsNotify('推广员开号成功', 'success');
            } catch (err) {
                opsNotify(err.message || String(err), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '创建推广员';
                }
            }
        });

        var copyBtn = el('ops-promoter-copy-code');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                if (!lastCode) {
                    alert('暂无推广码');
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(lastCode).then(function () {
                        alert('已复制推广码');
                    }).catch(function () {
                        alert(lastCode);
                    });
                } else {
                    alert(lastCode);
                }
            });
        }
    }

    /** 商户主壳 index-app（含 view-dashboard）：不得自动拉运维 API，由 ui-main 的 switchTab / TM_bootOpsIndexShell 触发 */
    function isMerchantIndexAppShell() {
        return !!document.getElementById('view-dashboard');
    }

    function shouldDeferOpsAutoBoot() {
        if (typeof window.TM_isStandaloneOpsHub === 'function' && window.TM_isStandaloneOpsHub()) {
            return true;
        }
        if (isMerchantIndexAppShell()) {
            return true;
        }
        return false;
    }

    function mayHandleOpsHashChange() {
        if (!isMerchantIndexAppShell()) {
            return true;
        }
        return typeof window.TM_isOpsAdminShell === 'function' && window.TM_isOpsAdminShell();
    }

    function bindNav() {
        if (document.body.dataset.opsNavDelegated === '1') {
            return;
        }
        document.body.dataset.opsNavDelegated = '1';
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-ops-route]');
            if (!btn) return;
            var route = normalizeOpsRoute(btn.getAttribute('data-ops-route'));
            if (!route || !ROUTES[route]) return;
            e.preventDefault();
            if (typeof window.TM_switchOpsRoute === 'function') {
                window.TM_switchOpsRoute(route);
                return;
            }
            location.hash = route;
            loadModule(route);
        });
    }

    function boot() {
        bindNav();
        if (shouldDeferOpsAutoBoot()) {
            return;
        }
        var raw = normalizeOpsRoute((location.hash || '').replace(/^#/, ''));
        if (!ROUTES[raw]) raw = 'tenants';
        if (raw !== ((location.hash || '').replace(/^#/, ''))) {
            try { history.replaceState(null, '', '#' + raw); } catch (e1) { location.hash = raw; }
        }
        loadModule(raw);
    }

    window.TM_OPS = {
        loadModule: loadModule,
        appendAudit: appendAudit,
        loadAudit: loadAudit,
        normalizeRoute: normalizeOpsRoute
    };
    window.TM_OPS_normalizeRoute = normalizeOpsRoute;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    window.addEventListener('hashchange', function () {
        if (!mayHandleOpsHashChange()) {
            return;
        }
        var hash = normalizeOpsRoute((location.hash || '').replace(/^#/, ''));
        if (!ROUTES[hash]) {
            return;
        }
        if (typeof window.TM_switchOpsRoute === 'function') {
            window.TM_switchOpsRoute(hash);
            return;
        }
        loadModule(hash);
    });
})();
