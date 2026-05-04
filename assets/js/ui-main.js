/**
 * 从完整模块 HTML 中截取指定节点的 innerHTML，避免把整页侧栏/壳层再次注入单页壳导致重复导航。
 */
function TM_extractInnerFromModuleHtml(htmlString, selector) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const node = doc.querySelector(selector);
        if (!node) {
            console.warn('[TM] 未找到片段选择器:', selector);
            return '';
        }
        return node.innerHTML;
    } catch (e) {
        console.error('[TM] 解析模块 HTML 失败:', selector, e);
        return '';
    }
}

/**
 * 将 dashboard 模块里的弹窗节点同步到壳层页面，避免继续使用 index-app 里的旧弹窗DOM。
 */
function TM_syncDashboardOverlays(htmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const overlayIds = ['audit-modal', 'order-detail-modal', 'manual-order-modal', 'unit-modal', 'voice-modal', 'photo-modal', 'toast'];
        overlayIds.forEach(function (id) {
            const nextNode = doc.getElementById(id);
            if (!nextNode) return;
            const current = document.getElementById(id);
            const cloned = nextNode.cloneNode(true);
            if (current && current.parentNode) {
                current.parentNode.replaceChild(cloned, current);
            } else {
                document.body.appendChild(cloned);
            }
        });
    } catch (e) {
        console.warn('[TM] 同步 dashboard 弹窗节点失败:', e);
    }
}

/**
 * 注入 dashboard 模块脚本（仅用于 index-app 抽取 #view-dashboard 片段模式）。
 * 不得再把 dashboard.html 中的 auth/app/tailwind 等整页脚本插入主壳：会污染全局、错误解析相对路径，
 * 且 TM_restoreShellNavigationGlobals 若早于异步脚本执行则无法恢复 switchTab，导致跳转到 /dashboard/dashboard.html 等 404。
 */
function TM_injectModuleScripts(htmlString, moduleKey) {
    if (moduleKey !== 'dashboard') {
        return;
    }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const scripts = doc.querySelectorAll('script');
        if (!scripts || scripts.length === 0) {
            return;
        }

        document.querySelectorAll('script[data-tm-module="dashboard"]').forEach(function (el) {
            el.remove();
        });

        const baseForResolve = window.location.origin + '/modules/dashboard/dashboard.html';
        const queue = [];

        scripts.forEach(function (srcScript) {
            const srcAttr = srcScript.getAttribute('src');
            if (srcAttr) {
                if (/\b(env-config|api-client|auth\.js|app\.js)\b/i.test(srcAttr)) {
                    return;
                }
                if (/tailwindcss\.com|phosphor-icons|html2canvas/.test(srcAttr)) {
                    return;
                }
                if (/aliyun-oss/.test(srcAttr)) {
                    if (typeof window.OSS !== 'undefined') {
                        return;
                    }
                    queue.push({ kind: 'ext', src: new URL(srcAttr, baseForResolve).href });
                }
                return;
            }
            const text = (srcScript.textContent || '').trim();
            if (!text) {
                return;
            }
            if (/tailwind\.config\s*=/.test(text)) {
                return;
            }
            if (/injectCommonUI/.test(text) && text.length < 600) {
                return;
            }
            queue.push({ kind: 'inline', text: srcScript.textContent || '' });
        });

        function runStep(index) {
            if (index >= queue.length) {
                TM_restoreShellNavigationGlobals();
                TM_refreshDashboardPendingOrders();
                return;
            }
            const item = queue[index];
            const script = document.createElement('script');
            script.setAttribute('data-tm-module', 'dashboard');
            if (item.kind === 'ext') {
                script.src = item.src;
                script.async = false;
                script.onload = function () {
                    runStep(index + 1);
                };
                script.onerror = function () {
                    console.warn('[TM] dashboard 依赖脚本加载失败:', item.src);
                    runStep(index + 1);
                };
                document.body.appendChild(script);
            } else {
                try {
                    script.textContent = item.text;
                    document.body.appendChild(script);
                } catch (err) {
                    console.error('[TM] dashboard 内联脚本执行异常:', err);
                }
                runStep(index + 1);
            }
        }

        runStep(0);
    } catch (e) {
        console.error('[TM] 注入模块脚本失败:', moduleKey, e);
        TM_restoreShellNavigationGlobals();
    }
}

/**
 * 统一挂载 iframe 模块并在加载后强制裁剪子页面壳层。
 * 这样即使子页面 embed 脚本未按预期执行，也不会出现重复导航栏。
 */
function TM_mountEmbeddedFrame(host, frameKey, src, title) {
    if (!host) return;
    function revealFrame(frame) {
        if (!frame) return;
        frame.style.visibility = 'visible';
        frame.style.opacity = '1';
    }

    function cleanupFrame(frame) {
        try {
            var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (!doc) return;

            if (doc.documentElement) doc.documentElement.classList.add('tm-embedded');
            if (doc.body) doc.body.classList.add('tm-embedded');

            // 保留 DOM 结构，仅隐藏壳层节点，避免子页面脚本因节点缺失而中断。
            var shells = doc.querySelectorAll('aside, header, .tm-compliance-footer');
            shells.forEach(function (el) {
                el.style.setProperty('display', 'none', 'important');
            });

            var main = doc.querySelector('main');
            if (main) {
                main.style.setProperty('width', '100%', 'important');
                main.style.setProperty('max-width', '100%', 'important');
                main.style.setProperty('min-width', '0', 'important');
                // 不强改 display/flex，避免破坏模块原生布局（尤其 CRM 左右双栏）
            }

            var content = doc.getElementById('content-area');
            if (content) {
                content.style.setProperty('padding-bottom', '0', 'important');
            }
        } catch (e) {
            console.warn('[TM] iframe 壳层裁剪失败:', frameKey, e);
        }
    }

    var existed = host.querySelector('iframe[data-tm-embed="' + frameKey + '"]');
    if (existed) {
        cleanupFrame(existed);
        revealFrame(existed);
        return;
    }

    host.innerHTML =
        '<iframe data-tm-embed="' + frameKey + '" class="tm-module-frame" src="' + src + '" title="' + (title || frameKey) + '"></iframe>';

    var frame = host.querySelector('iframe[data-tm-embed="' + frameKey + '"]');
    if (!frame) return;
    frame.style.visibility = 'hidden';
    frame.style.opacity = '0';
    frame.style.transition = 'opacity .12s ease';

    frame.addEventListener('load', function () {
        cleanupFrame(frame);
        // 某些模块会在 load 后异步注入公共壳层，延迟再清一次
        setTimeout(function () {
            cleanupFrame(frame);
            revealFrame(frame);
        }, 120);
    });

    // 兜底：个别浏览器/缓存场景下 load 回调可能延迟或丢失，避免一直空白。
    setTimeout(function () {
        cleanupFrame(frame);
        revealFrame(frame);
    }, 1500);
}

/**
 * 工作台「待确认单据」：AIService GET /api/v1/ai/records 直接返回数组，字段为 camelCase（见 AIController#getRecords）。
 */
function TM_refreshDashboardPendingOrders() {
    const pendingOrdersList = document.getElementById('pending-orders-list');
    if (!pendingOrdersList) {
        return;
    }
    if (!window.wrappedFetch) {
        console.warn('[TM] wrappedFetch 不可用，跳过待确认单据加载');
        return;
    }

    pendingOrdersList.innerHTML = `
        <div class="flex items-center justify-center h-full text-slate-400 text-sm">
            <div class="text-center">
                <i class="ph ph-spinner ph-spin text-xl mb-2"></i>
                <p>加载待确认单据中...</p>
            </div>
        </div>
    `;

    window.wrappedFetch('/api/v1/ai/records', { method: 'GET' })
        .then(async function (response) {
            const ct = response.headers.get('content-type') || '';
            if (ct.indexOf('application/json') === -1) {
                const text = await response.text();
                throw new Error('非 JSON 响应: ' + text.substring(0, 120));
            }
            return response.json();
        })
        .then(function (data) {
            const list = Array.isArray(data) ? data : (data && data.data ? data.data : null);
            if (!Array.isArray(list)) {
                console.error('[TM] 待确认单据接口返回格式异常:', data);
                pendingOrdersList.innerHTML = `
                    <div class="flex items-center justify-center h-full text-slate-400 text-sm">
                        <div class="text-center">
                            <i class="ph ph-x-circle text-xl mb-2"></i>
                            <p>数据格式异常，请稍后重试</p>
                        </div>
                    </div>
                `;
                return;
            }

            function pickCustomerName(record) {
                if (record.customerName && record.customerName !== '解析中...' && record.customerName !== '未知客户') {
                    return record.customerName;
                }
                const raw = record.aiResult || record.ai_result;
                if (!raw) return '未知客户';
                if (typeof window.TM_parseOrderExtractStructured === 'function') {
                    try {
                        var pr = window.TM_parseOrderExtractStructured(raw);
                        var d = pr && pr.data;
                        if (d && d.customer_data) {
                            var cd0 = d.customer_data;
                            var mn = (cd0.matched_customer_name || '').trim();
                            if (mn) return mn;
                            if (cd0.name) return cd0.name;
                        }
                        var ncf = d && Array.isArray(d.new_customers_found) ? d.new_customers_found[0] : null;
                        if (ncf && ncf.name) return String(ncf.name).trim();
                    } catch (e0) { /* ignore */ }
                }
                try {
                    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    const inner = obj && obj.data && typeof obj.data === 'object' && obj.result == null ? obj.data : obj;
                    if (inner.new_customer_info && inner.new_customer_info.name) return inner.new_customer_info.name;
                    if (inner.customer_data) {
                        const cd = inner.customer_data;
                        if (cd.matched_customer_name) return cd.matched_customer_name;
                        if (cd.name) return cd.name;
                    }
                    let r = inner && inner.result;
                    if (typeof r === 'string') {
                        try {
                            const parsed = JSON.parse(r);
                            if (parsed && parsed.customer_data) {
                                const cd = parsed.customer_data;
                                if (cd.matched_customer_name) return cd.matched_customer_name;
                                if (cd.name) return cd.name;
                            }
                        } catch (e2) { /* ignore */ }
                    }
                } catch (e) { /* ignore */ }
                return '未知客户';
            }

            const filtered = list
                .filter(function (r) { return r.status === 'SUCCESS' || r.status === 'EXTRACTING'; })
                .sort(function (a, b) {
                    const ta = new Date(a.createTime || a.created_at || 0).getTime();
                    const tb = new Date(b.createTime || b.created_at || 0).getTime();
                    return tb - ta;
                })
                .slice(0, 20);
            window.__TM_PENDING_RECORDS = filtered;

            if (filtered.length === 0) {
                pendingOrdersList.innerHTML = `
                    <div class="flex items-center justify-center h-full text-slate-400 text-sm">
                        <div class="text-center">
                            <i class="ph ph-check-circle text-xl mb-2"></i>
                            <p>暂无待确认单据</p>
                        </div>
                    </div>
                `;
                return;
            }

            function escapeHtml(s) {
                return String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            pendingOrdersList.innerHTML = filtered.map(function (record) {
                const rawId = record.id != null ? String(record.id) : '';
                const ridSafe = /^\d+$/.test(rawId) ? rawId : '';
                const customerName = escapeHtml(pickCustomerName(record));
                const t = record.createTime || record.created_at;
                const recognitionTime = t ? new Date(t).toLocaleString('zh-CN') : '';
                const st = record.status;
                const badgeClass = st === 'SUCCESS' ? 'text-brand-600' : 'text-orange-500';
                const badgeText = st === 'SUCCESS' ? '已提取' : '提取中';
                let itemCount = 0;
                try {
                    const ar = record.aiResult || record.ai_result;
                    if (typeof window.TM_parseOrderExtractStructured === 'function') {
                        var pr2 = window.TM_parseOrderExtractStructured(ar);
                        var od2 = pr2 && pr2.data && pr2.data.order_data;
                        if (od2 && Array.isArray(od2.items)) {
                            itemCount = od2.items.length;
                        }
                    }
                    if (itemCount === 0) {
                        const parsed = typeof ar === 'string' ? JSON.parse(ar) : ar;
                        const inner = parsed && parsed.data && typeof parsed.data === 'object' && parsed.result == null ? parsed.data : parsed;
                        let od = inner && inner.order_data;
                        if (!od && inner && typeof inner.result === 'string') {
                            try {
                                const pr = JSON.parse(inner.result);
                                od = pr && pr.order_data;
                            } catch (e2) { /* ignore */ }
                        }
                        if (od && Array.isArray(od.items)) {
                            itemCount = od.items.length;
                        } else if (inner && Array.isArray(inner.new_products_found)) {
                            itemCount = inner.new_products_found.length;
                        }
                    }
                } catch (e) { /* ignore */ }

                return (
                    '<div onclick="openAuditModal(\'' + ridSafe + '\')" class="p-4 border border-slate-50 rounded-xl bg-white hover:border-brand-500 transition-all cursor-pointer flex justify-between items-center group">' +
                    '<div>' +
                    '<p class="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors">客户：' + customerName + '</p>' +
                    '<div class="flex items-center gap-2 mt-1">' +
                    '<span class="text-[9px] text-slate-400 uppercase tracking-tighter">' + recognitionTime + '</span>' +
                    '<span class="w-1 h-1 bg-slate-200 rounded-full"></span>' +
                    '<span class="text-[9px] ' + badgeClass + ' font-bold">' + badgeText + '</span>' +
                    '</div></div>' +
                    '<div class="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-black text-[10px]">' + itemCount + '</div>' +
                    '</div>'
                );
            }).join('');
        })
        .catch(function (error) {
            console.error('[TM] 加载待确认单据失败:', error);
            pendingOrdersList.innerHTML = `
                <div class="flex items-center justify-center h-full text-slate-400 text-sm">
                    <div class="text-center">
                        <i class="ph ph-x-circle text-xl mb-2"></i>
                        <p>加载失败，请稍后重试</p>
                    </div>
                </div>
            `;
        });
}

// 模块加载函数（仅注入内容片段；CRM/供应链用 iframe+embed 保留原页面脚本与样式路径）
function loadDashboard() {
    console.log('[TM] 加载 dashboard 内容片段');
    fetch('/modules/dashboard/dashboard.html?v=20260504r15', { cache: 'no-store' })
        .then(function (response) { return response.text(); })
        .then(function (html) {
            const inner = TM_extractInnerFromModuleHtml(html, '#view-dashboard');
            document.getElementById('view-dashboard').innerHTML = inner || html;
            TM_syncDashboardOverlays(html);
            TM_injectModuleScripts(html, 'dashboard');
        })
        .catch(function (error) {
            console.error('Error loading dashboard:', error);
        });
}

function loadSmartOps() {
    console.log('[TM] 以 iframe(embed) 加载 SmartOps');
    TM_mountEmbeddedFrame(
        document.getElementById('view-biz'),
        'biz',
        '/modules/SmartOps/SmartOps.html?embed=1&v=20260422r24',
        '智能经营'
    );
}

function loadCRM() {
    console.log('[TM] 以 iframe(embed) 加载 CRM');
    TM_mountEmbeddedFrame(
        document.getElementById('view-crm'),
        'crm',
        '/modules/crm/crm.html?embed=1&v=20260422r23',
        'CRM'
    );
}

function loadProductCenter() {
    console.log('[TM] 加载产品中心内容（含管理弹窗与抽屉）');
    fetch('/modules/product-center/product-center.html?v=20260503r3', { cache: 'no-store' })
        .then(function (response) { return response.text(); })
        .then(function (html) {
            // 产品中心的类别/仓库编辑依赖 #content-area 内的弹窗与抽屉 DOM，
            // 仅注入主内容会导致“编辑图标点击无反应”。
            var inner = TM_extractInnerFromModuleHtml(html, '#content-area');
            document.getElementById('view-supply').innerHTML = inner || html;
            setTimeout(function () {
                if (window.ProductModule && window.ProductModule.init) {
                    console.log('[ui-main] 初始化 ProductModule');
                    window.ProductModule.init();
                }
            }, 100);
        })
        .catch(function (error) {
            console.error('[ui-main] 加载产品中心错误:', error);
        });
}

function loadSupplier() {
    console.log('[TM] 以 iframe(embed) 加载供应链/供应商');
    TM_mountEmbeddedFrame(
        document.getElementById('view-supplier'),
        'supplier',
        '/modules/supply-chain/supply-chain.html?embed=1&v=20260422r16',
        '供应商'
    );
}

const TM_NAV_CONFIG = [
    { tab: 'dashboard', label: '工作台', icon: 'ph-squares-four' },
    { tab: 'biz', label: '智能经营', icon: 'ph-chart-line-up' },
    { tab: 'crm', label: '客户 CRM', icon: 'ph-users' },
    { tab: 'supply', label: '产品中心', icon: 'ph-flask' },
    { tab: 'supplier', label: '供应商管理', icon: 'ph-warehouse' }
];

function initNavigationFromConfig() {
    const navButtons = document.querySelectorAll('aside .nav-btn');
    navButtons.forEach((btn, index) => {
        const cfg = TM_NAV_CONFIG[index];
        if (!cfg) return;
        btn.setAttribute('data-tab', cfg.tab);
        btn.setAttribute('onclick', `switchTab('${cfg.tab}')`);
        const iconEl = btn.querySelector('i');
        const textEl = btn.querySelector('span');
        if (iconEl) {
            iconEl.className = `ph ${cfg.icon} text-xl mr-3`;
        }
        if (textEl) {
            textEl.textContent = cfg.label;
        }
    });

    const mobileButtons = document.querySelectorAll('#tm-app-tabbar .mobile-nav-btn');
    mobileButtons.forEach((btn, index) => {
        const cfg = TM_NAV_CONFIG[index];
        if (!cfg) return;
        btn.setAttribute('data-tab', cfg.tab);
        btn.setAttribute('type', 'button');
        btn.removeAttribute('onclick');
        const iconEl = btn.querySelector('i');
        const textEl = btn.querySelector('span');
        if (iconEl) {
            iconEl.className = `ph ${cfg.icon} text-xl mb-0.5`;
        }
        if (textEl) {
            textEl.textContent = cfg.label;
        }
    });
}

/** 判断导航按钮是否对应当前 tab（避免 supply / supplier 被 includes 误匹配） */
function TM_navBtnMatchesTab(btn, tabId) {
    const dataTab = btn.getAttribute('data-tab');
    if (dataTab === tabId) {
        return true;
    }
    const oc = btn.getAttribute('onclick') || '';
    return new RegExp('switchTab\\(\\s*[\'"]' + tabId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\s*\\)').test(oc);
}

function TM_bindAppShellTabbar() {
    const bar = document.getElementById('tm-app-tabbar');
    if (!bar) {
        return;
    }

    let lastInvokeAt = 0;
    function runShellTab(tab) {
        if (!tab) {
            return;
        }
        const now = Date.now();
        if (now - lastInvokeAt < 120) {
            return;
        }
        lastInvokeAt = now;
        /** 仅用主壳保存的 TM_shellSwitchTab，避免模块内联脚本覆盖 window.switchTab 后底栏调到错误实现 */
        const fn = window.TM_shellSwitchTab;
        if (typeof fn === 'function') {
            fn(tab);
        } else {
            console.warn('[TM] TM_shellSwitchTab 未就绪，无法切换模块');
        }
    }

    /**
     * 在「每个底栏按钮」上绑定 pointerup + click（去抖），避免：
     * 1) 仅委托在 nav 上时，部分 WebView / iOS 下 touchend preventDefault 与点击合成异常；
     * 2) document 里其它 .mobile-nav-btn 与底栏混用 querySelectorAll 导致 data-tab 错乱。
     */
    bar.querySelectorAll('.mobile-nav-btn').forEach(function (btn) {
        if (btn.dataset.tmShellNav === '1') {
            return;
        }
        btn.dataset.tmShellNav = '1';

        function activate() {
            const tab = btn.getAttribute('data-tab');
            if (tab) {
                runShellTab(tab);
            }
        }

        btn.addEventListener(
            'pointerup',
            function (ev) {
                if (ev.pointerType === 'mouse' && ev.button !== 0) {
                    return;
                }
                activate();
            },
            { passive: true }
        );

        btn.addEventListener('click', function () {
            activate();
        });
    });
}

function getInitialTabFromHash() {
    const rawHash = window.location.hash || '';
    const match = rawHash.match(/tab=([^&]+)/);
    const tab = match ? decodeURIComponent(match[1]) : '';
    const allowedTabs = ['dashboard', 'biz', 'crm', 'supply', 'supplier'];
    return allowedTabs.includes(tab) ? tab : 'dashboard';
}

/**
 * index-app 主壳：按实测绘制底栏高度写入 --tm-tabbar-h，供 iframe 与内容区留白对齐（方案 A：仅 HTML 底栏）。
 */
function TM_syncAppShellMetrics() {
    var tabbar = document.getElementById('tm-app-tabbar');
    if (!tabbar) {
        return;
    }
    function apply() {
        var root = document.documentElement;
        if (window.innerWidth >= 768) {
            root.style.setProperty('--tm-tabbar-h', '0px');
            return;
        }
        var h = Math.ceil(tabbar.getBoundingClientRect().height);
        if (h > 0) {
            root.style.setProperty('--tm-tabbar-h', h + 'px');
        }
    }
    apply();
    if (!window.__tmShellMetricsBound) {
        window.__tmShellMetricsBound = true;
        window.addEventListener('resize', function () {
            clearTimeout(window.__tmShellResizeTimer);
            window.__tmShellResizeTimer = setTimeout(apply, 100);
        });
    }
    requestAnimationFrame(apply);
}

window.TM_syncAppShellMetrics = TM_syncAppShellMetrics;

function TM_bootIndexAppShell() {
    initNavigationFromConfig();
    TM_bindAppShellTabbar();
    TM_syncAppShellMetrics();
    switchTab(getInitialTabFromHash());
}

// 尽早绑定底栏；若脚本执行时 DOM 已就绪，则立即绑定（避免错过 DOMContentLoaded）
function TM_scheduleAppShellTabbarBind() {
    function go() {
        TM_bindAppShellTabbar();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go);
    } else {
        go();
    }
}
TM_scheduleAppShellTabbarBind();

window.addEventListener('load', function () {
    TM_bootIndexAppShell();
});

function switchTab(tabId) {
    const validTabs = ['dashboard', 'biz', 'crm', 'supply', 'supplier'];
    if (!validTabs.includes(tabId)) {
        tabId = 'dashboard';
    }

    if (tabId === 'crm') {
        hideCrmDetail();
    }

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + tabId);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('aside .nav-btn, #tm-app-tabbar .mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active-nav', 'bg-slate-800', 'text-brand-500', 'text-brand-600');
        btn.classList.add('text-slate-400');
        if (!TM_navBtnMatchesTab(btn, tabId)) {
            return;
        }
        if (btn.classList.contains('mobile-nav-btn')) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-brand-600', 'active-nav');
        } else {
            btn.classList.add('bg-slate-800', 'text-brand-500', 'text-brand-600', 'active-nav');
            btn.classList.remove('text-slate-400');
        }
    });
    if (window.TM_Responsive && typeof window.TM_Responsive.syncMobileNav === 'function') {
        window.TM_Responsive.syncMobileNav(tabId);
    }

    const titles = { 'dashboard': '工作台', 'biz': '智能经营', 'crm': '客户管理 CRM', 'supply': '产品中心', 'supplier': '供应商管理' };
    if (document.getElementById('page-title')) document.getElementById('page-title').innerText = titles[tabId];
    document.getElementById('content-area').scrollTop = 0;
    window.history.replaceState(null, '', '#tab=' + encodeURIComponent(tabId));

    // 加载对应模块
    if (tabId === 'dashboard') loadDashboard();
    else if (tabId === 'biz') loadSmartOps();
    else if (tabId === 'crm') loadCRM();
    else if (tabId === 'supply') loadProductCenter();
    else if (tabId === 'supplier') loadSupplier();
}

window.TM_shellSwitchTab = switchTab;

const TM_SHELL_NAV_FN_NAMES = ['switchTab', 'loadDashboard', 'loadSmartOps', 'loadCRM', 'loadProductCenter', 'loadSupplier'];
const TM_SHELL_NAV_FN_SNAPSHOT = {};

function TM_captureShellNavigationGlobals() {
    TM_SHELL_NAV_FN_NAMES.forEach(function (name) {
        if (typeof window[name] === 'function') {
            TM_SHELL_NAV_FN_SNAPSHOT[name] = window[name];
        }
    });
}

function TM_restoreShellNavigationGlobals() {
    if (typeof window.TM_shellSwitchTab === 'function') {
        window.switchTab = window.TM_shellSwitchTab;
    }
    TM_SHELL_NAV_FN_NAMES.forEach(function (name) {
        if (name === 'switchTab') {
            return;
        }
        if (typeof TM_SHELL_NAV_FN_SNAPSHOT[name] === 'function') {
            window[name] = TM_SHELL_NAV_FN_SNAPSHOT[name];
        }
    });
}

TM_captureShellNavigationGlobals();

function openAIAnalysis() { document.getElementById('ai-modal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeAIAnalysis() { document.getElementById('ai-modal').classList.add('hidden'); document.body.style.overflow = ''; }

// 手机端侧边栏切换
function toggleSidebar() {
    const sb = document.getElementById('main-sidebar');
    const ol = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ol) ol.classList.toggle('hidden');
}

// --- <用户订阅>语音逻辑 (修复版) ---
// 会员弹窗控制
function openMemberModal() { document.getElementById('member-modal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeMemberModal() { document.getElementById('member-modal').classList.add('hidden'); document.body.style.overflow = ''; }

// 品牌海报控制
function showPoster() { document.getElementById('poster-modal').classList.remove('hidden'); }
function closePoster() { document.getElementById('poster-modal').classList.add('hidden'); }
/**
* 核心功能：生成并下载海报照片
*/
async function downloadPoster() {
    const saveBtn = event.currentTarget;
    const originalText = saveBtn.innerHTML;

    // 改变按钮状态
    saveBtn.innerHTML = '<i class="ph ph-circle-notch animate-spin text-lg"></i> 生成中...';
    saveBtn.disabled = true;

    const element = document.getElementById('poster-capture-area');

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: null,
            useCORS: true, // 允许加载跨域图片(二维码)
            scale: 3,      // 提升清晰度
            borderRadius: 40
        });

        // 转为图片并下载
        const link = document.createElement('a');
        link.download = `TradeMind-Invite-${USER_REF_CODE}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('海报生成失败:', err);
        alert('保存失败，请稍后重试');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// --- <工作台>语音逻辑 (修复版) ---
let recTimer;
function openVoiceModal() { document.getElementById('voice-modal').classList.remove('hidden'); setVoiceUI('ready'); }
function setVoiceUI(s) {
    document.getElementById('voice-ready-ui').classList.toggle('hidden', s !== 'ready');
    document.getElementById('voice-active-ui').classList.toggle('hidden', s !== 'active');
    document.getElementById('voice-processing-ui').classList.toggle('hidden', s !== 'processing');
}
function startVoiceRecording() {
    setVoiceUI('active');
    document.getElementById('voice-pulse-icon').classList.add('recording-pulse');
    let sec = 0;
    recTimer = setInterval(() => { sec++; document.getElementById('voice-timer').innerText = `00:${sec.toString().padStart(2, '0')}`; }, 1000);
}
function stopVoiceRecording() {
    clearInterval(recTimer);
    document.getElementById('voice-pulse-icon').classList.remove('recording-pulse');
    setVoiceUI('processing'); // 切换到 AI 处理中状态

    // 核心修复：模拟处理闭环
    setTimeout(() => {
        closeVoiceModal();
        showToast("语音解析成功，已生成草稿单据");
    }, 2000);
}

function closeVoiceModal() { document.getElementById('voice-modal').classList.add('hidden'); clearInterval(recTimer); document.getElementById('voice-timer').innerText = "00:00"; }

// --- 拍照逻辑 (修复版) ---
function openPhotoModal() { document.getElementById('photo-modal').classList.remove('hidden'); resetPhoto(); }
function handlePhotoSelected(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('photo-preview-area').classList.remove('hidden');
            // 核心修复：选择图片后，手动移除按钮的禁用状态
            const btn = document.getElementById('photo-submit-btn');
            btn.disabled = false;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function resetPhoto() { document.getElementById('photo-preview-area').classList.add('hidden'); document.getElementById('photo-submit-btn').disabled = true; }
function submitPhoto() { closePhotoModal(); showToast("识别任务已提交 AI 队列"); }
function closePhotoModal() { document.getElementById('photo-modal').classList.add('hidden'); }

// --- 4. 文本解析逻辑 (修复清空动作) ---
function handleTextSubmit() {
    const el = document.getElementById('orderTextInput');
    if (!el.value.trim()) {
        alert("请先粘贴订单文本");
        return;
    }
    showToast("文本内容已提交 AI 解析");
    el.value = ""; // 核心修复：提交后清空内容
}

// 弹窗 Tab 切换 (订单核对)
function switchAuditTab(tab) {
    document.querySelectorAll('.sub-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pane-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
}

//  进行中单据：详情查看逻辑
function openOrderDetail(orderId) {
    document.getElementById('detail-order-id').innerText = orderId;
    const modal = document.getElementById('order-detail-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeOrderDetail() {
    const modal = document.getElementById('order-detail-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// 弹窗开关
function openAuditModal(name) {
    // 优先路由到 dashboard 模块的真实审核逻辑（含AI结果填充）
    if (typeof window.__TM_DASHBOARD_OPEN_AUDIT === 'function') {
        return window.__TM_DASHBOARD_OPEN_AUDIT(name);
    }
    var modal = document.getElementById('audit-modal');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeAuditModal() { document.getElementById('audit-modal').classList.add('hidden'); document.body.style.overflow = ''; }

// 高级信息抽屉切换
function toggleAdvancedPanel(type) {
    const drawer = document.getElementById('drawer-' + type);
    const icon = document.getElementById('icon-' + type);
    drawer.classList.toggle('open');
    icon.classList.toggle('ph-caret-up');
    icon.classList.toggle('ph-caret-down');
}

// 单位弹窗开关
function openUnitModal() {
    document.querySelectorAll('#unit-modal, #unit-modal-product').forEach((modal) => {
        modal.classList.remove('hidden');
    });
}
function closeUnitModal() {
    document.querySelectorAll('#unit-modal, #unit-modal-product').forEach((modal) => {
        modal.classList.add('hidden');
    });
}

// 模拟报表切换逻辑 (补全)
function legacySwitchReport(type) {
    document.querySelectorAll('.report-tab').forEach(btn => btn.classList.remove('report-active'));
    event.target.closest('.report-tab').classList.add('report-active');
    const container = document.getElementById('report-visual-container');
    const title = document.getElementById('report-display-title');
    container.style.opacity = '0';
    setTimeout(() => {
        container.style.opacity = '1';
        if (type === 'rev') {
            title.innerText = '营收走势 (近6个月)';
            container.innerHTML = `<div class="bar-item-slim h-[40%] bg-slate-100"></div><div class="bar-item-slim h-[55%] bg-slate-100"></div><div class="bar-item-slim h-[45%] bg-slate-100"></div><div class="bar-item-slim h-[70%] bg-brand-100"></div><div class="bar-item-slim h-[85%] shadow-lg"></div><div class="bar-item-slim h-[92%] shadow-lg"></div>`;
        } else if (type === 'stock') {
            title.innerText = '实时库存健康状况分布';
            container.innerHTML = `<div class="donut-ring"><div class="donut-hole"><p class="text-[10px] text-slate-400 font-bold">健康度</p><p class="text-2xl font-mono font-bold text-brand-600">82%</p></div></div>`;
        }
    }, 300);
}

// --- 手动订单逻辑 ---
function openManualOrderModal() {
    document.getElementById('manual-order-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    calculateManualTotal();
}

function closeManualOrderModal() {
    document.getElementById('manual-order-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function addOrderRow() {
    const tbody = document.querySelector('#manual-order-table tbody');
    const newRow = tbody.rows[0].cloneNode(true);
    newRow.querySelector('.qty-input').value = 1;
    newRow.querySelector('.price-input').value = 0;
    newRow.querySelector('.row-total').innerText = "$0.00";
    tbody.appendChild(newRow);

    // 绑定新行的下拉联动
    const selects = newRow.querySelectorAll('.product-select');
    selects.forEach(s => {
        s.addEventListener('change', function () {
            newRow.querySelector('.price-input').value = this.value;
            calculateManualTotal();
        });
    });
}

// 核心功能：自动计算总金额
function calculateManualTotal() {
    let grandTotal = 0;
    const rows = document.querySelectorAll('#manual-order-table tbody tr');

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
        const price = parseFloat(row.querySelector('.price-input').value) || 0;
        const subtotal = qty * price;
        row.querySelector('.row-total').innerText = `$${subtotal.toFixed(2)}`;
        grandTotal += subtotal;
    });

    document.getElementById('manual-grand-total').innerText = `$${grandTotal.toFixed(2)}`;
}

// 监听现有第一行的选择变化
document.querySelectorAll('.product-select').forEach(s => {
    s.addEventListener('change', function () {
        this.closest('tr').querySelector('.price-input').value = this.value;
        calculateManualTotal();
    });
});

// 确认入库逻辑
function saveManualOrder() {
    const grandTotal = document.getElementById('manual-grand-total').innerText;
    if (grandTotal === "$0.00") return alert("请添加有效商品和金额");

    // 模拟入库：在右侧列表新增一项
    const list = document.getElementById('inprogress-list');
    const newItem = document.createElement('div');
    newItem.className = "p-4 border border-slate-50 rounded-xl bg-white hover:border-brand-500 transition-all cursor-pointer flex justify-between items-center group fade-in";
    const newId = "INV-MANUAL-" + Math.floor(Math.random() * 9000 + 1000);
    newItem.onclick = function () { openViewDetail('新录入客户', 'MANUAL'); };
    newItem.innerHTML = `
                                            <div><p class="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors">${newId}</p>
                                            <div class="flex items-center gap-2 mt-1"><span class="text-[9px] text-slate-400 uppercase tracking-tighter">手动录入单据</span><span class="w-1 h-1 bg-brand-500 rounded-full"></span><span class="text-[9px] text-brand-600 font-bold">待发货</span></div></div>
                                            <div class="text-[11px] font-mono font-bold text-slate-900">${grandTotal}</div>`;
    list.prepend(newItem);

    closeManualOrderModal();
    alert("订单已成功入库并生成履约任务。");
}

// --- 详情查看逻辑 (包含来源标识) ---
function openViewDetail(customer, sourceKey) {
    const sources = {
        'AUDIO': '音频提取',
        'PHOTO': '图片提取',
        'TEXT': '文字提取',
        'MANUAL': '手动添加'
    };
    document.getElementById('detail-customer-display').innerText = customer;
    document.getElementById('detail-source-display').innerText = "提取源：" + (sources[sourceKey] || "系统生成");
    document.getElementById('view-detail-modal').classList.remove('hidden');
}

function closeViewDetail() { document.getElementById('view-detail-modal').classList.add('hidden'); }

// --- 智能经营交互逻辑 ---
function switchReport(type) {
    // 修复：确保 active 状态切换到正确的按钮上
    document.querySelectorAll('.report-tab').forEach(btn => btn.classList.remove('report-active'));
    // 如果点击的是按钮内部元素，强制寻找最近的 button 标签
    const targetBtn = event.target.closest('.report-tab');
    if (targetBtn) targetBtn.classList.add('report-active');

    const container = document.getElementById('report-visual-container');
    const labelContainer = document.getElementById('report-label-container');
    const title = document.getElementById('report-display-title');
    const legend = document.getElementById('report-legend');

    container.style.opacity = '0';

    setTimeout(() => {
        container.style.opacity = '1';
        if (type === 'rev') {
            title.innerText = '营收趋势分析 (近6个月)';
            if (legend) {
                legend.style.display = 'flex';
                legend.innerHTML = `
                                                                                            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-brand-500 rounded-full"></span> 实绩</span>
                                                                                            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-slate-200 rounded-full"></span> 历史</span>
                                                                                            <span class="flex items-center gap-1"><span class="w-2 h-0.5 border-t border-brand-500 border-dashed"></span> 预测</span>
                                                                                        `;
            }

            // 重新定义容器布局：[Y轴区域] + [主绘图区]
            container.className = 'flex-1 flex flex-row items-stretch overflow-hidden pt-4';

            container.innerHTML = `
                                                                                            <!-- 1. Y轴刻度区域 -->
                                                                                            <div class="flex flex-col justify-between mb-8 pb-1 axis-text shrink-0 text-right w-10 pr-3 border-r border-slate-100">
                                                                                                <span>20k</span>
                                                                                                <span>15k</span>
                                                                                                <span>10k</span>
                                                                                                <span>5k</span>
                                                                                                <span class="text-slate-300">0</span>
                                                                                            </div>

                                                                                            <!-- 2. 主绘图区 -->
                                                                                            <div class="relative flex-1 flex items-end justify-between px-2 md:px-6">
                                                                                                <!-- 背景水平辅助网格线 -->
                                                                                                <div class="absolute inset-0 flex flex-col justify-between mb-8 pb-1 pointer-events-none">
                                                                                                    <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                    <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                    <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                    <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                    <div class="w-full"></div> <!-- 底部基准线 -->
                                                                                                </div>

                                                                                            <!-- 数据列：[柱体 + 标签] 强绑定 -->

                                                                                            <!-- 8月：历史 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim bg-slate-100 h-[40%] hover:bg-slate-200 transition-colors"></div>
                                                                                                <span class="axis-text mt-3">08月</span>
                                                                                            </div>

                                                                                            <!-- 9月：历史 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim bg-slate-100 h-[52%] hover:bg-slate-200 transition-colors"></div>
                                                                                                <span class="axis-text mt-3">09月</span>
                                                                                            </div>

                                                                                            <!-- 10月：历史 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim bg-slate-100 h-[45%] hover:bg-slate-200 transition-colors"></div>
                                                                                                <span class="axis-text mt-3">10月</span>
                                                                                            </div>

                                                                                            <!-- 11月：实绩上涨 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim bg-brand-100 h-[68%] border-t-2 border-brand-500"></div>
                                                                                                <span class="axis-text mt-3">11月</span>
                                                                                            </div>

                                                                                            <!-- 12月：实绩高峰 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim h-[82%] shadow-lg shadow-brand-500/10"></div>
                                                                                                <span class="axis-text mt-3">12月</span>
                                                                                            </div>

                                                                                            <!-- 1月：当前/预测 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10">
                                                                                                <div class="bar-item-slim h-[92%] bg-brand-50 border-2 border-dashed border-brand-400 opacity-80"></div>
                                                                                                <span class="axis-text mt-3 text-brand-600 font-bold">预测01</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    `;
            // 隐藏旧的外部 Label 容器，防止布局位移
            if (labelContainer) {
                labelContainer.innerHTML = '';
                labelContainer.className = "hidden";
            }
        }
        else if (type === 'stock') {
            title.innerText = '实时库存健康状况分布';
            if (legend) legend.style.display = 'none';
            container.className = 'flex-1 flex flex-col items-center justify-center';

            /**
             * 精确数学计算 (半径 r=70, 周长 C ≈ 439.82)
             * 1. 正常 (绿色): 82%  => 长度 360.65
             * 2. 积压 (黄色): 10%  => 长度 43.98
             * 3. 缺货 (红色): 8%   => 长度 35.19
             *
             * 移除 stroke-linecap，使用默认的 butt (平头)，确保衔接严丝合缝
             */
            container.innerHTML = `
                                                                                            <div class="chart-container-svg fade-in">
                                                                                            <svg width="180" height="180" viewBox="0 0 160 160">
                                                                                                <!-- 底部背景圆环 -->
                                                                                                <circle cx="80" cy="80" r="70" stroke="#F1F5F9" stroke-width="15" fill="none" />

                                                                                                <!-- 正常 (82%) - 起点: 12点钟 -->
                                                                                                <circle cx="80" cy="80" r="70" stroke="#14B8A6" stroke-width="15" fill="none"
                                                                                                    stroke-dasharray="360.65 439.82"
                                                                                                    stroke-dashoffset="0"
                                                                                                    transform="rotate(-90 80 80)" />

                                                                                                <!-- 积压 (10%) - 起点: 紧随绿色终点 -->
                                                                                                <circle cx="80" cy="80" r="70" stroke="#F59E0B" stroke-width="15" fill="none"
                                                                                                    stroke-dasharray="43.98 439.82"
                                                                                                    stroke-dashoffset="-360.65"
                                                                                                    transform="rotate(-90 80 80)" />

                                                                                                <!-- 缺货 (8%) - 起点: 紧随黄色终点 -->
                                                                                                <circle cx="80" cy="80" r="70" stroke="#F43F5E" stroke-width="15" fill="none"
                                                                                                    stroke-dasharray="35.19 439.82"
                                                                                                    stroke-dashoffset="-404.63"
                                                                                                    transform="rotate(-90 80 80)" />
                                                                                            </svg>
                                                                                            <div class="donut-text-box">
                                                                                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">健康度</p>
                                                                                                <p class="text-3xl font-mono font-bold text-brand-600">82%</p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <!-- 图例展示 -->
                                                                                        <div class="flex gap-6 mt-8 text-[11px] font-bold">
                                                                                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-brand-500 rounded-sm"></span> 正常 82%</span>
                                                                                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-yellow-500 rounded-sm"></span> 积压 10%</span>
                                                                                            <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-red-500 rounded-sm"></span> 缺货 8%</span>
                                                                                        </div>`;
            labelContainer.innerHTML = '';
        }
        else if (type === 'profit') {
            title.innerText = '销售盈利报表 (Top 3 利润贡献)';
            if (legend) {
                legend.style.display = 'flex';
                legend.innerHTML = `
                                                                                            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: linear-gradient(to bottom, #FBBF24, #D97706);"></span> 第一名</span>
                                                                                            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: linear-gradient(to bottom, #34D399, #059669);"></span> 第二名</span>
                                                                                            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: linear-gradient(to bottom, #22D3EE, #0891B2);"></span> 第三名</span>
                                                                                        `;
            }

            container.className = 'flex-1 flex flex-col w-full px-4 md:px-10 justify-center gap-8';

            container.innerHTML = `
                                                                                                <!-- Top 1 -->
                                                                                                <div class="w-full fade-in group">
                                                                                                    <div class="flex justify-between items-end mb-2.5">
                                                                                                        <div class="flex items-center gap-3">
                                                                                                            <span class="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-yellow-300 to-yellow-600 text-white text-xs font-black rounded-lg shadow-md ring-2 ring-yellow-100">1</span>
                                                                                                            <div>
                                                                                                                <p class="text-sm font-bold text-slate-900 tracking-tight">金色镂空户外灯具 (V3)</p>
                                                                                                                <p class="text-[10px] text-slate-400 font-medium">中东/欧美市场畅销款</p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div class="text-right">
                                                                                                            <p class="text-[10px] text-yellow-600 font-bold uppercase tracking-widest">Gross Profit</p>
                                                                                                            <p class="text-lg font-mono font-black text-slate-900">$42,000</p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-[1px]">
                                                                                                        <div class="h-full rounded-full transition-all duration-1000 shadow-sm group-hover:brightness-110"
                                                                                                            style="width: 92%; background: linear-gradient(90deg, #FDE68A 0%, #F59E0B 100%); box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);"></div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                <!-- Top 2 -->
                                                                                                <div class="w-full fade-in group" style="animation-delay: 0.1s">
                                                                                                    <div class="flex justify-between items-end mb-2.5">
                                                                                                        <div class="flex items-center gap-3">
                                                                                                            <span class="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-emerald-300 to-emerald-600 text-white text-xs font-black rounded-lg shadow-md ring-2 ring-emerald-100">2</span>
                                                                                                            <div>
                                                                                                                <p class="text-sm font-bold text-slate-800 tracking-tight">智能感应极简香薰机</p>
                                                                                                                <p class="text-[10px] text-slate-400 font-medium">东南亚区域利润之星</p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div class="text-right">
                                                                                                            <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Gross Profit</p>
                                                                                                            <p class="text-lg font-mono font-black text-slate-800">$28,500</p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-[1px]">
                                                                                                        <div class="h-full rounded-full transition-all duration-1000 group-hover:brightness-110"
                                                                                                            style="width: 65%; background: linear-gradient(90deg, #6EE7B7 0%, #059669 100%); box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);"></div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                <!-- Top 3 -->
                                                                                                <div class="w-full fade-in group" style="animation-delay: 0.2s">
                                                                                                    <div class="flex justify-between items-end mb-2.5">
                                                                                                        <div class="flex items-center gap-3">
                                                                                                            <span class="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-cyan-300 to-cyan-600 text-white text-xs font-black rounded-lg shadow-md ring-2 ring-cyan-100">3</span>
                                                                                                            <div>
                                                                                                                <p class="text-sm font-bold text-slate-800 tracking-tight">多功能户外折叠桌板</p>
                                                                                                                <p class="text-[10px] text-slate-400 font-medium">高频爆款薄利多销</p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div class="text-right">
                                                                                                            <p class="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">Gross Profit</p>
                                                                                                            <p class="text-lg font-mono font-black text-slate-800">$14,200</p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-[1px]">
                                                                                                        <div class="h-full rounded-full transition-all duration-1000 group-hover:brightness-110"
                                                                                                            style="width: 35%; background: linear-gradient(90deg, #67E8F9 0%, #0891B2 100%); box-shadow: 0 2px 8px rgba(8, 145, 178, 0.2);"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            `;

            // 同步隐藏底部 Label
            if (labelContainer) {
                labelContainer.innerHTML = '';
                labelContainer.style.display = "none";
            }
        }
        else if (type === 'finance') {
            title.innerText = '往来账务分析 (应收账款账龄)';
            if (legend) {
                legend.style.display = 'flex';
                legend.innerHTML = `
                                                                                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: #10B981;"></span> 健康</span>
                                                                                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: #F59E0B;"></span> 关注</span>
                                                                                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: #EA580C;"></span> 风险</span>
                                                                                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background: #F43F5E;"></span> 高危</span>
                                                                                    `;
            }

            // 容器布局：[Y轴区域] + [绘图主区]
            container.className = 'flex-1 flex flex-row items-stretch overflow-hidden pt-6';

            container.innerHTML = `
                                                                                        <!-- 1. Y轴刻度区域 -->
                                                                                        <div class="flex flex-col justify-between mb-9 pb-1 axis-text shrink-0 text-right w-12 pr-3 border-r border-slate-100">
                                                                                            <span>$40k</span>
                                                                                            <span>$30k</span>
                                                                                            <span>$20k</span>
                                                                                            <span>$10k</span>
                                                                                            <span class="text-slate-300">0</span>
                                                                                        </div>

                                                                                        <!-- 2. 绘图主区 -->
                                                                                        <div class="relative flex-1 flex items-end justify-around px-2 md:px-12">
                                                                                            <!-- 背景辅助水平网格线 -->
                                                                                            <div class="absolute inset-0 flex flex-col justify-between mb-9 pb-1 pointer-events-none">
                                                                                                <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                                <div class="w-full border-t border-slate-50 border-dashed"></div>
                                                                                            </div>

                                                                                            <!-- 账龄柱状列 -->

                                                                                            <!-- 0-30D：健康绿 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10 group">
                                                                                                <div class="bar-item-slim transition-all group-hover:scale-x-110"
                                                                                                    style="background: linear-gradient(180deg, #34D399 0%, #10B981 100%); height: 85%; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);"></div>
                                                                                                <span class="axis-text mt-3 tracking-tighter">0-30D</span>
                                                                                            </div>

                                                                                            <!-- 31-60D：关注黄 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10 group">
                                                                                                <div class="bar-item-slim transition-all group-hover:scale-x-110"
                                                                                                    style="background: linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%); height: 48%; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);"></div>
                                                                                                <span class="axis-text mt-3 tracking-tighter">31-60D</span>
                                                                                            </div>

                                                                                            <!-- 61-90D：风险橙 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10 group">
                                                                                                <div class="bar-item-slim transition-all group-hover:scale-x-110"
                                                                                                    style="background: linear-gradient(180deg, #FB923C 0%, #EA580C 100%); height: 28%; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2);"></div>
                                                                                                <span class="axis-text mt-3 tracking-tighter">61-90D</span>
                                                                                            </div>

                                                                                            <!-- >90D：高危红 -->
                                                                                            <div class="flex flex-col items-center flex-1 h-full justify-end z-10 group">
                                                                                                <div class="bar-item-slim animate-pulse transition-all group-hover:scale-x-110"
                                                                                                    style="background: linear-gradient(180deg, #FB7185 0%, #F43F5E 100%); height: 15%; box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3);"></div>
                                                                                                <span class="axis-text mt-3 text-pink-600 font-bold tracking-tighter">>90D</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    `;

            // 彻底清空并隐藏旧的外部容器
            if (labelContainer) {
                labelContainer.innerHTML = '';
                labelContainer.style.display = "none";
            }
        }
    }, 300);
}

// --- 客户CRM交互逻辑 ---
/**
* CRM 手机端详情显示逻辑
*/
function showCrmDetail(customerName) {
    // 1. 更新详情页数据 (此处仅演示名称)
    document.getElementById('crm-detail-name').innerText = customerName;

    // 2. 针对手机端的显示切换
    if (window.TM_Responsive && window.TM_Responsive.isMobile()) {
        window.TM_Responsive.showCrmDetail(customerName);
    }
}

/**
 * CRM 手机端返回列表逻辑
 */
function hideCrmDetail() {
    if (window.TM_Responsive && window.TM_Responsive.isMobile()) {
        window.TM_Responsive.hideCrmDetail();
    }
}

function switchCustomerDetail(name, info) {
    const detailName = document.getElementById('crm-detail-name');
    if (detailName) {
        detailName.innerText = name;
    }
    showCrmDetail(name);
}

// 3. 客户列表实时过滤
function filterCrmList() {
    const input = document.getElementById('crmSearchInput').value.toUpperCase();
    const cards = document.querySelectorAll('.customer-card');
    cards.forEach(card => {
        const text = card.innerText.toUpperCase();
        card.style.display = text.includes(input) ? "" : "none";
    });
}

// 产品中心相关函数
function filterInventoryTable() {
    const input = document.getElementById('inventorySearch').value.toUpperCase();
    const rows = document.querySelectorAll('#existingProdTable tbody tr');
    rows.forEach(row => {
        const name = row.querySelector('.product-name-cell').innerText.toUpperCase();
        const sku = row.querySelector('.product-sku-cell').innerText.toUpperCase();
        row.style.display = (name.includes(input) || sku.includes(input)) ? "" : "none";
    });
}

function openPurchaseSuggestionModal() {
    const modal = document.getElementById('purchase-suggestion-modal');
    const content = document.getElementById('purchase-suggestion-content');
    
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    // 模拟API调用获取产品数据
    setTimeout(() => {
        // 模拟产品数据
        const products = [
            {
                id: 1,
                name: "金色镂空户外灯具 (V3)",
                sku: "G-882101",
                stock: 1240,
                warning_stock: 100,
                supplier_id: 1,
                supplierName: "深圳照明科技",
                price: 10.20
            },
            {
                id: 2,
                name: "多功能露营折叠桌",
                sku: "CP-T2-04",
                stock: 42,
                warning_stock: 100,
                supplier_id: 2,
                supplierName: "广州户外用品有限公司",
                price: 48.00
            },
            {
                id: 3,
                name: "智能感应香薰机",
                sku: "AI-Aroma-01",
                stock: 85,
                warning_stock: 100,
                supplier_id: 1,
                supplierName: "深圳照明科技",
                price: 25.50
            }
        ];
        
        // 筛选出库存低于预警值的产品
        const suggestions = products.filter(p => p.stock <= p.warning_stock);
        
        // 按供应商分组
        const groupedBySupplier = suggestions.reduce((acc, p) => {
            const key = p.supplierName || '未知供应商';
            if (!acc[key]) acc[key] = [];
            acc[key].push({
                id: p.id,
                name: p.name,
                sku: p.sku,
                current: p.stock,
                warning: p.warning_stock,
                suggest: Math.max(0, p.warning_stock * 2 - p.stock),
                price: p.price
            });
            return acc;
        }, {});
        
        // 渲染进货建议
        renderPurchaseSuggestion(groupedBySupplier);
    }, 1000);
}

function renderPurchaseSuggestion(groupedBySupplier) {
    const content = document.getElementById('purchase-suggestion-content');
    if (!content) return;
    
    let html = '';
    
    Object.entries(groupedBySupplier).forEach(([supplier, products]) => {
        let supplierTotal = 0;
        
        html += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-50 bg-slate-50/30">
                <h3 class="text-sm font-bold text-slate-800">${supplier}</h3>
            </div>
            
            <!-- 桌面端表格 -->
            <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4">产品名 (SKU)</th>
                            <th class="px-6 py-4 text-right">缺货状态</th>
                            <th class="px-6 py-4 text-right">建议采购</th>
                            <th class="px-6 py-4 text-right">预估小计</th>
                        </tr>
                    </thead>
                    <tbody class="text-xs divide-y divide-slate-50">
        `;
        
        products.forEach(product => {
            const subtotal = product.suggest * product.price;
            supplierTotal += subtotal;
            
            html += `
                        <tr>
                            <td class="px-6 py-4">
                                <div>
                                    <p class="font-bold text-slate-800">${product.name}</p>
                                    <p class="text-[10px] text-slate-400 font-mono">SKU: ${product.sku}</p>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-right font-mono font-bold ${product.current <= product.warning ? 'text-risk-high' : 'text-slate-900'}">
                                ${product.current} / ${product.warning}
                            </td>
                            <td class="px-6 py-4 text-right">
                                <input type="number" value="${product.suggest}" min="0" class="w-20 px-2 py-1 border border-slate-200 rounded text-xs text-right">
                            </td>
                            <td class="px-6 py-4 text-right font-mono font-bold text-slate-900">
                                $${subtotal.toFixed(2)}
                            </td>
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <!-- 手机端卡片 -->
            <div class="md:hidden space-y-4 p-4">
        `;
        
        products.forEach(product => {
            const subtotal = product.suggest * product.price;
            
            html += `
                <div class="border border-slate-100 rounded-xl p-4">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <i class="ph ph-package text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="font-bold text-slate-800">${product.name}</p>
                            <p class="text-[10px] text-slate-400 font-mono">SKU: ${product.sku}</p>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500">缺货状态</span>
                            <span class="font-mono font-bold ${product.current <= product.warning ? 'text-risk-high' : 'text-slate-900'}">
                                ${product.current} / ${product.warning}
                            </span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500">建议采购</span>
                            <input type="number" value="${product.suggest}" min="0" class="w-20 px-2 py-1 border border-slate-200 rounded text-xs text-right">
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500">预估小计</span>
                            <span class="font-mono font-bold text-slate-900">$${subtotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
            
            <div class="px-6 py-4 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
                <span class="text-sm font-bold text-slate-800">供应商总计</span>
                <span class="font-mono font-bold text-slate-900">$${supplierTotal.toFixed(2)}</span>
            </div>
        </div>
        `;
    });
    
    content.innerHTML = html;
}

function closePurchaseSuggestionModal() {
    const modal = document.getElementById('purchase-suggestion-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function savePurchaseOrder() {
    // 模拟保存进货单
    closePurchaseSuggestionModal();
    showToast('进货单已保存');
}

function showToastLegacy(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.innerText = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 2秒后移除
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 2000);
}

// 供应商编辑相关函数
function openSupplierEditModal(supplierName, contact, phone, rating) {
    const modal = document.getElementById('supplier-edit-modal');
    if (modal) {
        // 填充表单数据
        if (supplierName) {
            document.getElementById('supplier-name').value = supplierName;
        }
        if (contact) {
            document.getElementById('supplier-contact').value = contact;
        }
        if (phone) {
            document.getElementById('supplier-phone').value = phone;
        }
        if (rating) {
            document.getElementById('supplier-rating').value = rating;
        }
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeSupplierEditModal() {
    const modal = document.getElementById('supplier-edit-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function saveSupplierEdit() {
    // 获取表单数据
    const name = document.getElementById('supplier-name').value;
    const contact = document.getElementById('supplier-contact').value;
    const phone = document.getElementById('supplier-phone').value;
    const rating = document.getElementById('supplier-rating').value;
    
    // 模拟保存操作
    console.log('保存供应商信息:', { name, contact, phone, rating });
    
    // 关闭弹窗并显示提示
    closeSupplierEditModal();
    showToast('供应商信息已保存');
}

// 仓库管理相关函数
function openWarehouseDrawer() {
    const drawer = document.getElementById('warehouse-drawer');
    if (drawer) {
        drawer.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeWarehouseDrawer() {
    const drawer = document.getElementById('warehouse-drawer');
    if (drawer) {
        drawer.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function saveWarehouse() {
    // 模拟保存操作
    closeWarehouseDrawer();
    showToast('仓库信息已保存');
}

// 客户编辑弹窗逻辑
function openClientEditModal(mode, name) {
    const modal = document.getElementById('client-edit-modal');
    const title = document.getElementById('client-modal-title');
    if (mode === 'new') {
        title.innerText = "新增客户资料";
        document.getElementById('cust-name').value = "";
        document.getElementById('cust-phone').value = "";
    } else {
        title.innerText = "编辑客户详情";
        document.getElementById('cust-name').value = name === 'Ahmed' ? "Ahmed Al-Fayed" : "John Smith";
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeClientEditModal() { document.getElementById('client-edit-modal').classList.add('hidden'); document.body.style.overflow = ''; }

function toggleAdvancedLegacy() {
    const drawer = document.getElementById('advanced-drawer');
    const icon = document.getElementById('advanced-icon');
    drawer.classList.toggle('open');
    icon.classList.toggle('ph-caret-up');
    icon.classList.toggle('ph-caret-down');
}

function confirmDeleteClient(name) { if (confirm(`确定删除客户 [${name}] 吗？`)) alert('删除成功'); }
function saveClient() { alert('客户资料已更新。'); closeClientEditModal(); }

// --- 产品中心交互逻辑 ---
function openWorkshopModal() {
    const modal = document.getElementById('workshop-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeWorkshopModal() {
    document.getElementById('workshop-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function openClearanceModal() {
    const modal = document.getElementById('clearance-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeClearanceModal() {
    document.getElementById('clearance-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function openCostAnalysis(sku) {
    const modal = document.getElementById('cost-analysis-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeCostAnalysis() {
    document.getElementById('cost-analysis-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// 模拟请求新品分析报告
function requestNewProductAnalysis(pName) {
    // 1. 关闭选择弹窗
    closeProductSelectModal();
    // 2. 更新报告内的标题名称
    document.getElementById('analysisTargetName').innerText = "研讨目标：" + pName;
    // 3. 打开分析报告大弹窗
    const reportModal = document.getElementById('new-product-report-modal');
    reportModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 关闭分析报告
function closeNewProductReport() {
    const reportModal = document.getElementById('new-product-report-modal');
    reportModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// 产品中心由 ui-product-center.js（ProductModule）提供；主壳不再内嵌模拟数据或重复 window.* 绑定。
// --- 供应商管理交互逻辑 ---


// --- 供应商视图切换 ---
function switchSupplierView(mode) {
    // 尝试获取元素
    const listView = document.getElementById('sup-list-view');
    const supplierView = document.getElementById('sup-supplier-view');
    const btnList = document.getElementById('btn-sup-list');
    const btnSupplier = document.getElementById('btn-sup-supplier');
    const supStatChips = document.getElementById('sup-stat-chips');

    // 检查元素是否存在
    if (!listView || !supplierView || !btnList || !btnSupplier || !supStatChips) {
        // 元素不存在，可能是模块还未加载完成
        // 延迟一段时间后重试
        setTimeout(() => {
            switchSupplierView(mode);
        }, 100);
        return;
    }

    if (mode === 'list') {
        // 显示/隐藏内容
        listView.classList.remove('hidden');
        supplierView.classList.add('hidden');

        // 处理按钮状态
        btnList.classList.add('active');
        btnSupplier.classList.remove('active');

        // 修正颜色类名冲突 (清除 Tailwind 默认的灰色)
        btnList.classList.remove('text-slate-400');
        btnSupplier.classList.add('text-slate-400');
        
        // 显示统计卡
        supStatChips.classList.remove('hidden');
    } else if (mode === 'supplier') {
        listView.classList.add('hidden');
        supplierView.classList.remove('hidden');

        btnSupplier.classList.add('active');
        btnList.classList.remove('active');

        btnSupplier.classList.remove('text-slate-400');
        btnList.classList.add('text-slate-400');
        
        // 隐藏统计卡
        supStatChips.classList.add('hidden');
    }
}

function confirmDeleteSupplier(supplierName) {
    if (confirm(`确定要删除供应商 "${supplierName}" 吗？`)) {
        // 模拟删除操作
        showToast(`供应商 "${supplierName}" 已删除`);
    }
}

// --- 进货单详情弹窗 ---
function openPurchaseDetail(id) {
    document.getElementById('detail-purchase-id').innerText = id;
    document.getElementById('purchase-detail-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePurchaseDetail() {
    document.getElementById('purchase-detail-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// 其他辅助函数
function showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl z-50';
    toast.innerText = message;
    
    // 添加到body
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 3000);
}

function closeProductSelectModal() {
    const modal = document.getElementById('product-select-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function toggleCustomerDetail(show) {
    const detail = document.getElementById('customer-detail');
    if (detail) {
        if (show) {
            detail.classList.remove('hidden');
        } else {
            detail.classList.add('hidden');
        }
    }
}
