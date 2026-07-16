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
/**
 * 产品中心弹窗挂到 body，避免嵌套滚动容器内 fixed 失效
 */
function TM_syncProductCenterOverlays() {
    var url = '/modules/product-center/product-overlays.html?v=20260715variant2';
    return fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            var ids = [
                'product-detail-modal',
                'product-unit-modal',
                'warehouse-transfer-modal',
                'product-variant-modal',
                'product-expiry-modal',
                'attribute-template-modal'
            ];
            ids.forEach(function (id) {
                var nextNode = doc.getElementById(id);
                if (!nextNode) return;
                document.querySelectorAll('#' + id).forEach(function (old) {
                    if (old && old.parentNode) old.parentNode.removeChild(old);
                });
                document.body.appendChild(nextNode.cloneNode(true));
            });
            document.querySelectorAll('#unit-modal').forEach(function (el) {
                el.parentNode.removeChild(el);
            });
            if (typeof window.TM_bindProductCenterGlobalFns === 'function') {
                window.TM_bindProductCenterGlobalFns();
            }
            if (typeof TM_resetShellOverlay === 'function') {
                TM_resetShellOverlay();
            }
        })
        .catch(function (e) {
            console.warn('[TM] 同步产品中心弹窗失败:', e);
        });
}

/** overlay 替换后重新绑定语音停止按钮（避免切 Tab 后 click 监听丢失） */
function TM_rebindVoiceStopAfterOverlaySync() {
    try {
        if (typeof window.__TM_bindVoiceStopButton === 'function') {
            window.__TM_bindVoiceStopButton();
            return;
        }
        var impl = window.__TM_dashboardVoice;
        if (impl && typeof impl.bindVoiceStopButton === 'function') {
            impl.bindVoiceStopButton();
        }
    } catch (e) {
        console.warn('[TM] 重新绑定 voice-stop 失败:', e);
    }
}

function TM_syncDashboardOverlays(htmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const overlayIds = ['audit-modal', 'order-detail-modal', 'manual-order-modal', 'unit-modal', 'voice-modal', 'photo-modal', 'toast'];
        overlayIds.forEach(function (id) {
            const nextNode = doc.getElementById(id);
            if (!nextNode) return;
            const current = document.getElementById(id);
            var preserveVoiceOpen = false;
            if (id === 'voice-modal') {
                var wasDomOpen = current && !current.classList.contains('hidden');
                var inVoiceTour = window.TmOnboarding && typeof window.TmOnboarding.isVoiceModalPhase === 'function'
                    && window.TmOnboarding.isVoiceModalPhase();
                preserveVoiceOpen = !!(wasDomOpen || inVoiceTour);
                if (window.TmOnboarding && typeof window.TmOnboarding.setVoiceOverlaySyncLock === 'function') {
                    window.TmOnboarding.setVoiceOverlaySyncLock(true);
                }
            }
            const cloned = nextNode.cloneNode(true);
            if (current && current.parentNode) {
                current.parentNode.replaceChild(cloned, current);
            } else {
                document.body.appendChild(cloned);
            }
            if (id === 'voice-modal' || id === 'photo-modal') {
                if (window.TM_ShellInsets && typeof window.TM_ShellInsets.applyModalRoot === 'function') {
                    window.TM_ShellInsets.applyModalRoot(cloned, { variant: 'center' });
                } else {
                    cloned.classList.add('tm-dialog-root');
                    cloned.setAttribute('data-tm-dialog-variant', 'center');
                }
            } else if (typeof TM_applyDialogShell === 'function') {
                TM_applyDialogShell(cloned);
            }
            if (id === 'voice-modal' && preserveVoiceOpen) {
                cloned.classList.remove('hidden');
                cloned.style.zIndex = '210';
            }
            if (id === 'voice-modal') {
                if (window.TmOnboarding && typeof window.TmOnboarding.notifyVoiceModalReplaced === 'function') {
                    window.TmOnboarding.notifyVoiceModalReplaced(preserveVoiceOpen);
                } else if (window.TmOnboarding && typeof window.TmOnboarding.setVoiceOverlaySyncLock === 'function') {
                    window.TmOnboarding.setVoiceOverlaySyncLock(false);
                }
            }
        });
        TM_rebindVoiceStopAfterOverlaySync();
        window._detailFinBound = false;
        window._manualFinBound = false;
        if (typeof TM_resetShellOverlay === 'function') {
            TM_resetShellOverlay();
        }
    } catch (e) {
        console.warn('[TM] 同步 dashboard 弹窗节点失败:', e);
    }
}

/**
 * 注入 dashboard 模块脚本（仅用于 index-app 抽取 #view-dashboard 片段模式）。
 * 不得再把 dashboard.html 中的 auth/app/tailwind 等整页脚本插入主壳：会污染全局、错误解析相对路径，
 * 且 TM_restoreShellNavigationGlobals 若早于异步脚本执行则无法恢复 switchTab，导致跳转到 /dashboard/dashboard.html 等 404。
 */
function TM_ensureRapidOrderStyles() {
    if (document.getElementById('tm-rapid-order-css')) return;
    var link = document.createElement('link');
    link.id = 'tm-rapid-order-css';
    link.rel = 'stylesheet';
    link.href = '/assets/css/rapid-order.css?v=20260715total2';
    document.head.appendChild(link);
    var flw = document.getElementById('tm-first-login-wizard-css');
    if (!flw) {
        var link2 = document.createElement('link');
        link2.id = 'tm-first-login-wizard-css';
        link2.rel = 'stylesheet';
        link2.href = '/assets/css/tm-first-login-wizard.css?v=20260630';
        document.head.appendChild(link2);
    }
}

function TM_isRapidOrderReady() {
    var fn = window.TM_openRapidOrder;
    return typeof fn === 'function' && !fn.__tmStub;
}

function TM_flushRapidOrderWaiters() {
    var waiters = window.__TM_RAPID_ORDER_WAITERS || [];
    window.__TM_RAPID_ORDER_WAITERS = [];
    for (var i = 0; i < waiters.length; i++) {
        try { waiters[i](); } catch (e) { console.warn('[TM] rapid-order waiter', e); }
    }
}

/** 主壳片段模式下补载极速开单依赖（白名单遗漏或会话已加载过旧队列时） */
function TM_ensureRapidOrderScripts(done) {
    TM_ensureRapidOrderStyles();
    if (typeof done === 'function') {
        (window.__TM_RAPID_ORDER_WAITERS = window.__TM_RAPID_ORDER_WAITERS || []).push(done);
    }
    if (TM_isRapidOrderReady()) {
        TM_flushRapidOrderWaiters();
        return;
    }
    if (window.__TM_RAPID_ORDER_LOADING) return;
    window.__TM_RAPID_ORDER_LOADING = true;
    var base = window.location.origin + '/assets/js/';
    var deps = [
        'tm-product-domain.js?v=20260713order1',
        'tm-master-data-cache.js?v=20260706fix1',
        'tm-sku-catalog-cache.js?v=20260716cat1',
        'tm-industry-ui.js?v=20260630',
        'tm-workbench-profile.js?v=20260706fix1',
        'tm-first-login-wizard.js?v=20260630',
        'rapid-order.js?v=20260716cat1'
    ];
    function finish() {
        window.__TM_RAPID_ORDER_LOADING = false;
        if (!TM_isRapidOrderReady()) {
            console.error('[TM] 极速开单脚本加载后仍未定义 TM_openRapidOrder');
        }
        TM_flushRapidOrderWaiters();
    }
    function loadNext(i) {
        if (i >= deps.length) {
            finish();
            return;
        }
        if (TM_isRapidOrderReady() && deps[i].indexOf('rapid-order.js') >= 0) {
            // 注入队列可能已装好真实现，跳过后续
            finish();
            return;
        }
        var name = deps[i].split('?')[0];
        if (document.querySelector('script[data-tm-rapid="' + name + '"], script[src*="' + name + '"]')) {
            // 已在加载/已加载：rapid-order 需等真实现就绪
            if (name === 'rapid-order.js' && !TM_isRapidOrderReady()) {
                var polls = 0;
                var timer = setInterval(function () {
                    polls++;
                    if (TM_isRapidOrderReady() || polls > 40) {
                        clearInterval(timer);
                        loadNext(i + 1);
                    }
                }, 50);
                return;
            }
            loadNext(i + 1);
            return;
        }
        var s = document.createElement('script');
        s.src = base + deps[i];
        s.async = false;
        s.setAttribute('data-tm-module', 'dashboard');
        s.setAttribute('data-tm-rapid', name);
        s.onload = function () { loadNext(i + 1); };
        s.onerror = function () {
            console.warn('[TM] 极速开单依赖加载失败:', deps[i]);
            loadNext(i + 1);
        };
        document.body.appendChild(s);
    }
    loadNext(0);
}

/** 点击时若脚本尚未注入，先补载再打开，避免 ReferenceError */
(function TM_installRapidOrderStub() {
    if (TM_isRapidOrderReady()) return;
    function stub() {
        var args = arguments;
        TM_ensureRapidOrderScripts(function () {
            var fn = window.TM_openRapidOrder;
            if (typeof fn === 'function' && !fn.__tmStub) {
                return fn.apply(window, args);
            }
            console.error('[TM] 极速开单不可用：TM_openRapidOrder 未加载');
        });
    }
    stub.__tmStub = true;
    window.TM_openRapidOrder = stub;
})();

function TM_ensureWorkbenchOrderTabs() {
    try {
        if (!window.TM_SalesOrders && !window.__TM_SALES_ORDERS_LOADING) {
            window.__TM_SALES_ORDERS_LOADING = true;
            var base = window.location.origin + '/assets/js/';
            var files = [
                'tm-order-dict.js?v=20260626',
                'ui-sales-orders.js?v=20260716tabs1',
                'ui-returns.js?v=20260716return1'
            ];
            function next(i) {
                if (i >= files.length) {
                    window.__TM_SALES_ORDERS_LOADING = false;
                    if (window.TM_SalesOrders && typeof window.TM_SalesOrders.ensureInit === 'function') {
                        window.TM_SalesOrders.ensureInit();
                    }
                    if (window.TM_Returns && typeof window.TM_Returns.init === 'function') {
                        window.TM_Returns.init();
                    }
                    return;
                }
                var name = files[i].split('?')[0];
                if (document.querySelector('script[src*="' + name + '"]')) {
                    next(i + 1);
                    return;
                }
                var s = document.createElement('script');
                s.src = base + files[i];
                s.async = false;
                s.setAttribute('data-tm-module', 'dashboard');
                s.onload = function () { next(i + 1); };
                s.onerror = function () { next(i + 1); };
                document.body.appendChild(s);
            }
            next(0);
            return;
        }
        if (window.TM_SalesOrders) {
            if (typeof window.TM_SalesOrders.ensureInit === 'function') {
                window.TM_SalesOrders.ensureInit();
            } else if (typeof window.TM_SalesOrders.init === 'function') {
                window.TM_SalesOrders.init();
            }
        }
        if (window.TM_Returns && typeof window.TM_Returns.init === 'function') {
            window.TM_Returns.init();
        }
    } catch (e) {
        console.warn('[TM] 工作台销售/退货 Tab 绑定失败', e);
    }
}

function TM_injectModuleScripts(htmlString, moduleKey) {
    if (moduleKey !== 'dashboard') {
        return;
    }
    try {
        // 工作台内联脚本含大量顶层 let：重复 append 会触发 Identifier has already been declared，导致语音/待确认逻辑整段未执行。
        // 已加载过则只恢复导航全局并刷新待确认列表（DOM 已由 loadDashboard 重注入）。
        var voiceUploadRev = window.__TM_DASHBOARD_VOICE_UPLOAD_REV || '';
        var expectedVoiceRev = '20260524';
        if (window.__TM_DASHBOARD_INLINE_LOADED) {
            TM_restoreShellNavigationGlobals();
            if (typeof window.TM_bindProductCenterGlobalFns === 'function') {
                window.TM_bindProductCenterGlobalFns();
            }
            // 历史会话可能未注入极速开单：补载一次
            if (!TM_isRapidOrderReady()) {
                TM_ensureRapidOrderScripts();
            }
            TM_ensureWorkbenchOrderTabs();
            TM_refreshDashboardPendingOrders();
            TM_rebindVoiceStopAfterOverlaySync();
            try {
                if (typeof window.loadInProgressOrders === 'function') {
                    window.loadInProgressOrders();
                }
                if (typeof window.loadDashboardOverviewStats === 'function') {
                    window.loadDashboardOverviewStats();
                }
            } catch (e0) { /* ignore */ }
            if (voiceUploadRev !== expectedVoiceRev && !window.__TM_VOICE_RELOAD_HINT_SHOWN) {
                window.__TM_VOICE_RELOAD_HINT_SHOWN = true;
                console.warn('[Voice] 检测到旧版工作台脚本，请强制刷新页面 (Ctrl+F5) 以加载语音上传修复');
            }
            return;
        }

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
                    return;
                }
                if (/dashboard-workbench\.js|ai-order-extract-parse\.js|tm-customer-registry-form\.js|tm-product-registry-form\.js|ui-product-center|tm-product-variant-modal|tm-attribute-template-modal|rapid-order\.js|tm-sku-catalog-cache|tm-workbench-profile|tm-product-domain|tm-master-data-cache|tm-industry-ui|tm-industry-product-registry|tm-first-login-wizard|workbench-order-shipment|ui-returns|ui-sales-orders|tm-product-thumb|tm-biz-accounts|tm-subscription-notice|order-workbench-modal|tenant-ops|tm-order-dict|tm-serial-capture|tm-scan-|tm-peripheral|tm-print\//i.test(srcAttr)) {
                    queue.push({ kind: 'ext', src: new URL(srcAttr, baseForResolve).href });
                    return;
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

        if (queue.length === 0) {
            console.warn('[TM] dashboard 脚本队列为空，跳过注入');
            TM_restoreShellNavigationGlobals();
            TM_refreshDashboardPendingOrders();
            return;
        }

        function runStep(index) {
            if (index >= queue.length) {
                window.__TM_DASHBOARD_INLINE_LOADED = true;
                TM_restoreShellNavigationGlobals();
                if (typeof window.TM_bindProductCenterGlobalFns === 'function') {
                    window.TM_bindProductCenterGlobalFns();
                }
                if (!TM_isRapidOrderReady()) {
                    TM_ensureRapidOrderScripts();
                }
                TM_ensureWorkbenchOrderTabs();
                TM_refreshDashboardPendingOrders();
                if (typeof window.loadInProgressOrders === 'function') {
                    window.loadInProgressOrders();
                }
                if (typeof window.loadDashboardOverviewStats === 'function') {
                    window.loadDashboardOverviewStats();
                }
                if (typeof TM_scheduleShellOverlayRecovery === 'function') {
                    TM_scheduleShellOverlayRecovery();
                }
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
function TM_mountEmbeddedFrame(host, frameKey, src, title, opts) {
    opts = opts || {};
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

            doc.querySelectorAll('.tm-mobile-nav, .tm-mobile-header').forEach(function (el) {
                el.style.setProperty('display', 'none', 'important');
            });

            var main = doc.querySelector('main');
            if (main) {
                main.style.setProperty('width', '100%', 'important');
                main.style.setProperty('max-width', '100%', 'important');
                main.style.setProperty('min-width', '0', 'important');
                // 不强改 display/flex，避免破坏模块原生布局（尤其 CRM 左右双栏）
            }

            var parentMobile = false;
            try {
                parentMobile = window.innerWidth < 768;
            } catch (ePm) { /* ignore */ }

            if (parentMobile && window.TM_Compliance) {
                if (typeof window.TM_Compliance.applyEmbedDocumentForFlow === 'function') {
                    window.TM_Compliance.applyEmbedDocumentForFlow(doc);
                }
                if (typeof window.TM_Compliance.syncIframeHeight === 'function') {
                    window.TM_Compliance.syncIframeHeight(frame);
                }
                if (typeof window.TM_Compliance.bindIframeAutoHeight === 'function') {
                    window.TM_Compliance.bindIframeAutoHeight(frame);
                }
            } else if (window.TM_ShellInsets && typeof window.TM_ShellInsets.initEmbeddedDocument === 'function') {
                window.TM_ShellInsets.initEmbeddedDocument(doc);
            } else {
                var content = doc.getElementById('content-area');
                if (content) {
                    content.style.setProperty('padding-top', '0.5rem', 'important');
                    content.style.setProperty(
                        'padding-bottom',
                        'calc(var(--tm-tabbar-h, 4.25rem) + env(safe-area-inset-bottom, 0px) + 0.25rem)',
                        'important'
                    );
                }
            }
        } catch (e) {
            console.warn('[TM] iframe 壳层裁剪失败:', frameKey, e);
        }
    }

    var existed = host.querySelector('iframe[data-tm-embed="' + frameKey + '"]');
    if (existed) {
        var didRewindSrc = false;
        var wantedBase = String(src || '').split('&_tmrec=')[0].split('?_tmrec=')[0];
        var currentBase = String(existed.getAttribute('src') || '').split('&_tmrec=')[0].split('?_tmrec=')[0];
        // 版本号/路径变更时强制换 src，避免长期卡在缓存旧页（如 CRM AI 弹窗）
        if (wantedBase && currentBase && wantedBase !== currentBase) {
            didRewindSrc = true;
            existed.src = wantedBase + (wantedBase.indexOf('?') >= 0 ? '&' : '?') + '_tmrec=' + Date.now();
        } else if (opts.embedPathCheck) {
            try {
                var idoc = existed.contentDocument;
                var path = (idoc && idoc.location && idoc.location.pathname) || '';
                if (path.indexOf(opts.embedPathCheck) === -1) {
                    didRewindSrc = true;
                    existed.src = wantedBase + (wantedBase.indexOf('?') >= 0 ? '&' : '?') + '_tmrec=' + Date.now();
                }
            } catch (eReload) {
                didRewindSrc = true;
                existed.src = wantedBase + (wantedBase.indexOf('?') >= 0 ? '&' : '?') + '_tmrec=' + Date.now();
            }
        }
        if (didRewindSrc) {
            existed.addEventListener('load', function onEmbedReload() {
                existed.removeEventListener('load', onEmbedReload);
                cleanupFrame(existed);
                setTimeout(function () {
                    cleanupFrame(existed);
                    revealFrame(existed);
                }, 120);
            });
            setTimeout(function () {
                cleanupFrame(existed);
                revealFrame(existed);
            }, 1500);
            return;
        }
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
    if (window.TM_PendingOrdersStore && typeof window.TM_PendingOrdersStore.refresh === 'function') {
        return window.TM_PendingOrdersStore.refresh(false);
    }
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
    if (window.__TM_loadDashboardInFlight) {
        return window.__TM_loadDashboardInFlight;
    }
    window.__TM_loadDashboardInFlight = fetch('/modules/dashboard/dashboard.html?v=20260716print1', { cache: 'no-store' })
        .then(function (response) { return response.text(); })
        .then(function (html) {
            TM_ensureRapidOrderStyles();
            const inner = TM_extractInnerFromModuleHtml(html, '#view-dashboard');
            document.getElementById('view-dashboard').innerHTML = inner || html;
            TM_syncDashboardOverlays(html);
            TM_injectModuleScripts(html, 'dashboard');
            // 队列异步；再兜底确保极速开单可用
            setTimeout(function () {
                if (!TM_isRapidOrderReady()) {
                    TM_ensureRapidOrderScripts();
                }
                TM_ensureWorkbenchOrderTabs();
            }, 600);
            var vd = document.getElementById('view-dashboard');
            if (vd && window.TM_UI && typeof window.TM_UI.injectSlots === 'function') {
                window.TM_UI.injectSlots(vd).then(function () {
                    if (window.TM_RoleGate && typeof window.TM_RoleGate.apply === 'function') {
                        window.TM_RoleGate.apply(vd);
                    }
                });
            }
            if (window.TM_Compliance && typeof window.TM_Compliance.onTabChange === 'function') {
                window.TM_Compliance.onTabChange('dashboard');
            }
            if (typeof window.TM_syncAppShellMetrics === 'function') {
                window.TM_syncAppShellMetrics();
            }
        })
        .catch(function (error) {
            console.error('Error loading dashboard:', error);
        })
        .finally(function () {
            window.__TM_loadDashboardInFlight = null;
            if (typeof TM_scheduleShellOverlayRecovery === 'function') {
                TM_scheduleShellOverlayRecovery();
            }
        });
    return window.__TM_loadDashboardInFlight;
}

function loadSmartOps() {
    console.log('[TM] 以 iframe(embed) 加载 SmartOps');
    TM_mountEmbeddedFrame(
        document.getElementById('view-biz'),
        'biz',
        '/modules/SmartOps/SmartOps.html?embed=1&v=20260716promo2',
        '智能经营',
        { embedPathCheck: 'SmartOps' }
    );
}

function loadCRM() {
    console.log('[TM] 以 iframe(embed) 加载 CRM');
    TM_mountEmbeddedFrame(
        document.getElementById('view-crm'),
        'crm',
        '/modules/crm/crm.html?embed=1&v=20260716crmAi1',
        'CRM',
        { embedPathCheck: 'crm' }
    );
}

function loadProductCenter() {
    console.log('[TM] 加载产品中心内容（含管理弹窗与抽屉）');
    var overlayPromise = typeof TM_syncProductCenterOverlays === 'function'
        ? TM_syncProductCenterOverlays()
        : Promise.resolve();
    overlayPromise.then(function () {
        return fetch('/modules/product-center/product-center.html?v=20260716spu1', { cache: 'no-store' });
    })
        .then(function (response) { return response.text(); })
        .then(function (html) {
            var inner = TM_extractInnerFromModuleHtml(html, '#content-area');
            var vs = document.getElementById('view-supply');
            if (vs) {
                vs.innerHTML = inner || html;
                var mobileSupply = window.innerWidth < 768 ||
                    (document.body && document.body.classList.contains('tm-layout-mobile'));
                if (mobileSupply) {
                    vs.classList.remove('tm-view-supply-scroll');
                } else {
                    vs.classList.add('tm-view-supply-scroll');
                }
                var nestedContent = vs.querySelector('#content-area');
                if (nestedContent) {
                    nestedContent.id = 'supply-inner-scroll';
                }
                var shellContent = document.getElementById('content-area');
                if (shellContent) {
                    shellContent.classList.add('tm-shell-tab-supply-active');
                }
            }
            if (vs && window.TM_UI && typeof window.TM_UI.injectSlots === 'function') {
                window.TM_UI.injectSlots(vs).then(function () {
                    if (window.TM_RoleGate && typeof window.TM_RoleGate.apply === 'function') {
                        window.TM_RoleGate.apply(vs);
                    }
                });
            }
            if (window.TM_Compliance && typeof window.TM_Compliance.onTabChange === 'function') {
                window.TM_Compliance.onTabChange('supply');
            }
            setTimeout(function () {
                if (window.ProductModule && window.ProductModule.init) {
                    console.log('[ui-main] 初始化 ProductModule');
                    window.ProductModule.init();
                }
                if (window.TM_Compliance && typeof window.TM_Compliance.onTabChange === 'function') {
                    window.TM_Compliance.onTabChange('supply');
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
        '/modules/supply-chain/supply-chain.html?embed=1&v=20260716po2',
        '供应商',
        { embedPathCheck: 'supply-chain' }
    );
    if (window.TM_Compliance && typeof window.TM_Compliance.onTabChange === 'function') {
        setTimeout(function () {
            window.TM_Compliance.onTabChange('supplier');
        }, 200);
    }
}

const TM_NAV_CONFIG = [
    { tab: 'dashboard', label: '工作台', mobileLabel: '工作台', icon: 'ph-squares-four' },
    { tab: 'biz', label: '智能经营', mobileLabel: '经营', icon: 'ph-chart-line-up' },
    { tab: 'crm', label: '客户 CRM', mobileLabel: '客户', icon: 'ph-users' },
    { tab: 'supply', label: '产品中心', mobileLabel: '产研', icon: 'ph-flask' },
    { tab: 'supplier', label: '供应商管理', mobileLabel: '供应', icon: 'ph-warehouse' }
];

const TM_OPS_NAV_CONFIG = [
    { route: 'tenants', label: '看板', title: '租户看板', icon: 'ph-squares-four' },
    { route: 'plans', label: '订阅', title: '订阅策略', icon: 'ph-currency-circle-dollar' },
    { route: 'referral', label: '推荐', title: '推荐与结算', icon: 'ph-gift' },
    { route: 'promoters', label: '推广', title: '推广员开号', icon: 'ph-user-plus' },
    { route: 'feedback', label: '问题', title: '用户问题', icon: 'ph-chats-circle' },
    { route: 'announce', label: '公告', title: '公告与审计', icon: 'ph-scroll' }
];

const TM_OPS_ROUTE_IDS = TM_OPS_NAV_CONFIG.map(function (item) { return item.route; });

function TM_getCurrentRoleType() {
    if (window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role) {
        return String(window.TM_UI_CONTEXT.role).trim().toUpperCase();
    }
    try {
        var raw = localStorage.getItem('user_info');
        if (raw) {
            var u = JSON.parse(raw);
            if (u && u.roleType) {
                return String(u.roleType).trim().toUpperCase();
            }
        }
    } catch (e) { /* ignore */ }
    try {
        var token = localStorage.getItem('token');
        if (token && token !== 'mock-token') {
            var parts = String(token).split('.');
            if (parts.length >= 2) {
                var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) {
                    b64 += '=';
                }
                var payload = JSON.parse(atob(b64));
                if (payload.roleType) {
                    return String(payload.roleType).trim().toUpperCase();
                }
            }
        }
    } catch (e2) { /* ignore */ }
    return '';
}

function TM_isOpsAdminShell() {
    if (document.body && document.body.classList.contains('tm-ops-portal')) {
        return true;
    }
    return TM_getCurrentRoleType() === 'ROLE_OPS_ADMIN';
}

function TM_isStandaloneOpsHub() {
    return !!document.getElementById('tm-ops-view-root') && !document.getElementById('view-dashboard');
}

function TM_applyShellOpsTheme(on) {
    document.body.classList.toggle('tm-shell-ops', !!on);
    document.documentElement.classList.toggle('tm-shell-ops', !!on);
}

function TM_renderIdentityTabbar() {
    var bar = document.getElementById('tm-app-tabbar');
    if (!bar) {
        return;
    }
    var isOps = TM_isOpsAdminShell();
    var config = isOps ? TM_OPS_NAV_CONFIG : TM_NAV_CONFIG;
    TM_applyShellOpsTheme(isOps);

    var initialRoute = (location.hash || '').replace(/^#/, '');
    var initialTab = 'dashboard';
    try {
        var hashTab = new URLSearchParams((location.hash || '').replace(/^#/, '?')).get('tab');
        if (hashTab) {
            initialTab = hashTab;
        }
    } catch (eHash) { /* ignore */ }

    bar.innerHTML = config.map(function (item) {
        if (isOps) {
            var opsActive = item.route === (TM_OPS_ROUTE_IDS.indexOf(initialRoute) >= 0 ? initialRoute : 'tenants');
            return (
                '<button type="button" data-ops-route="' + item.route + '" ' +
                'class="mobile-nav-btn flex flex-col items-center flex-1 py-1 transition-all ' +
                (opsActive ? 'text-ops-600 active-nav' : 'text-slate-400') + '">' +
                '<i class="ph ' + item.icon + ' text-xl mb-0.5"></i>' +
                '<span class="text-[9px] font-bold tracking-tighter">' + item.label + '</span>' +
                '</button>'
            );
        }
        var tabActive = item.tab === initialTab;
        return (
            '<button type="button" data-tab="' + item.tab + '" data-tm-nav="' + item.tab + '" ' +
            'class="mobile-nav-btn flex flex-col items-center flex-1 py-1 transition-all ' +
            (tabActive ? 'text-brand-600 active-nav' : 'text-slate-400') + '">' +
            '<i class="ph ' + item.icon + ' text-xl mb-0.5"></i>' +
            '<span class="text-[9px] font-bold tracking-tighter">' + (item.mobileLabel || item.label) + '</span>' +
            '</button>'
        );
    }).join('');

    bar.setAttribute('data-tm-nav-mode', isOps ? 'ops' : 'merchant');
    bar.querySelectorAll('.mobile-nav-btn').forEach(function (btn) {
        delete btn.dataset.tmShellNav;
    });
}

function TM_syncOpsNavActive(route) {
    document.querySelectorAll('#tm-app-tabbar .mobile-nav-btn[data-ops-route]').forEach(function (btn) {
        btn.classList.remove('active-nav', 'text-brand-600', 'text-ops-600');
        btn.classList.add('text-slate-400');
        if (btn.getAttribute('data-ops-route') === route) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-ops-600', 'active-nav');
        }
    });
    document.querySelectorAll('.tm-ops-nav-btn[data-ops-route]').forEach(function (btn) {
        if (btn.getAttribute('data-ops-route') === route) {
            btn.classList.add('tm-ops-nav-active');
        } else {
            btn.classList.remove('tm-ops-nav-active');
        }
    });
    var cfg = TM_OPS_NAV_CONFIG.filter(function (item) { return item.route === route; })[0];
    var titleEl = document.getElementById('tm-ops-page-title') || document.getElementById('page-title');
    if (titleEl && cfg) {
        titleEl.textContent = cfg.title;
    }
}

function TM_scrollOpsContentTop() {
    var root = document.getElementById('tm-ops-view-root');
    if (root) {
        root.scrollTop = 0;
    }
    var content = document.getElementById('content-area');
    if (content) {
        content.scrollTop = 0;
    }
}

function TM_switchOpsRoute(route) {
    if (TM_OPS_ROUTE_IDS.indexOf(route) < 0) {
        route = 'tenants';
    }
    TM_syncOpsNavActive(route);
    TM_scrollOpsContentTop();
    if (window.TM_OPS && typeof window.TM_OPS.loadModule === 'function') {
        window.TM_OPS.loadModule(route);
    }
    try {
        var current = (location.hash || '').replace(/^#/, '');
        if (current !== route) {
            if (typeof history.replaceState === 'function') {
                history.replaceState(null, '', '#' + route);
            } else {
                location.hash = route;
            }
        }
    } catch (eHash) { /* ignore */ }
}

function TM_bindOpsShellTabbar() {
    var bar = document.getElementById('tm-app-tabbar');
    if (!bar) {
        return;
    }
    var lastInvokeAt = 0;
    bar.querySelectorAll('.mobile-nav-btn[data-ops-route]').forEach(function (btn) {
        if (btn.dataset.tmShellNav === '1') {
            return;
        }
        btn.dataset.tmShellNav = '1';
        function activate() {
            var route = btn.getAttribute('data-ops-route');
            if (!route) {
                return;
            }
            var now = Date.now();
            if (now - lastInvokeAt < 120) {
                return;
            }
            lastInvokeAt = now;
            TM_switchOpsRoute(route);
        }
        btn.addEventListener('pointerup', function (ev) {
            if (ev.pointerType === 'mouse' && ev.button !== 0) {
                return;
            }
            activate();
        }, { passive: true });
        btn.addEventListener('click', activate);
    });
}

function TM_bootOpsHubShell() {
    document.body.classList.add('tm-ops-portal', 'tm-layout-mobile');
    TM_renderIdentityTabbar();
    TM_bindOpsShellTabbar();
    if (typeof TM_syncAppShellMetrics === 'function') {
        TM_syncAppShellMetrics();
    }
    var raw = (location.hash || '').replace(/^#/, '');
    if (raw === 'quota-ai' || raw === 'lifecycle' || raw === 'tenants-lifecycle' || raw === 'metering') {
        raw = 'tenants';
    }
    var route = TM_OPS_ROUTE_IDS.indexOf(raw) >= 0 ? raw : 'tenants';
    TM_switchOpsRoute(route);
}

function TM_bootOpsIndexShell() {
    TM_applyShellOpsTheme(true);
    document.body.classList.add('tm-layout-mobile');
    document.querySelectorAll('.view-section').forEach(function (el) {
        el.classList.add('hidden');
    });
    var opsView = document.getElementById('view-ops');
    if (opsView) {
        opsView.classList.remove('hidden');
    }
    var contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.classList.add('tm-ops-active');
    }
    var aside = document.querySelector('body > aside');
    if (aside) {
        aside.classList.add('hidden');
    }
    TM_bindOpsShellTabbar();
    if (typeof TM_syncAppShellMetrics === 'function') {
        TM_syncAppShellMetrics();
    }
    var brandEl = document.querySelector('.tm-app-header-brand span');
    if (brandEl) {
        brandEl.textContent = '运维中心';
    }
    var raw = (location.hash || '').replace(/^#(?:tab=)?/, '').split('&')[0];
    if (raw.indexOf('tab=') === 0) {
        raw = raw.slice(4);
    }
    var route = TM_OPS_ROUTE_IDS.indexOf(raw) >= 0 ? raw : 'tenants';
    if (window.TM_OPS && typeof window.TM_OPS.loadModule === 'function') {
        TM_switchOpsRoute(route);
    }
}

window.TM_renderIdentityTabbar = TM_renderIdentityTabbar;
window.TM_switchOpsRoute = TM_switchOpsRoute;
window.TM_syncOpsNavActive = TM_syncOpsNavActive;
window.TM_isOpsAdminShell = TM_isOpsAdminShell;
window.TM_getCurrentRoleType = TM_getCurrentRoleType;
window.TM_isStandaloneOpsHub = TM_isStandaloneOpsHub;

function initNavigationFromConfig() {
    const navButtons = document.querySelectorAll('aside .nav-btn');
    navButtons.forEach((btn, index) => {
        const cfg = TM_NAV_CONFIG[index];
        if (!cfg) return;
        btn.setAttribute('data-tab', cfg.tab);
        btn.setAttribute('data-tm-nav', cfg.tab);
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
        btn.setAttribute('data-tm-nav', cfg.tab);
        btn.setAttribute('type', 'button');
        btn.removeAttribute('onclick');
        const iconEl = btn.querySelector('i');
        const textEl = btn.querySelector('span');
        if (iconEl) {
            iconEl.className = `ph ${cfg.icon} text-xl mb-0.5`;
        }
        if (textEl) {
            textEl.textContent = cfg.mobileLabel || cfg.label;
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
    if (bar.getAttribute('data-tm-nav-mode') === 'ops') {
        TM_bindOpsShellTabbar();
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
    if (window.TM_ShellInsets && typeof window.TM_ShellInsets.sync === 'function') {
        window.TM_ShellInsets.sync();
        return;
    }
    var tabbar = document.getElementById('tm-app-tabbar');
    if (!tabbar) return;
    var root = document.documentElement;
    if (window.innerWidth >= 768) {
        root.style.setProperty('--tm-tabbar-h', '0px');
        return;
    }
    var h = Math.ceil(tabbar.getBoundingClientRect().height);
    if (h > 0) root.style.setProperty('--tm-tabbar-h', h + 'px');
}

window.TM_syncAppShellMetrics = TM_syncAppShellMetrics;

/** 弹窗节点是否处于「已打开」状态（class + aria + 计算样式，避免误判导致底栏被藏） */
function TM_isShellOverlayElementOpen(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList.contains('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    try {
        var st = window.getComputedStyle(el);
        if (!st) return false;
        if (st.display === 'none' || st.visibility === 'hidden') return false;
        if (parseFloat(st.opacity) === 0) return false;
    } catch (e) { /* ignore */ }
    return true;
}

/** 是否仍有未关闭的壳层弹窗（DOM 层校验，用于纠偏） */
function TM_anyShellOverlayOpenInDom() {
    var sel =
        '.tm-unified-mobile-modal, .tm-product-edit-modal, #member-modal';
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
        if (TM_isShellOverlayElementOpen(nodes[i])) return true;
    }
    return false;
}

function TM_findEmbedFrameByWindow(win) {
    var found = null;
    try {
        document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
            try {
                if (frame.contentWindow === win) found = frame;
            } catch (e0) { /* ignore */ }
        });
    } catch (e1) { /* ignore */ }
    return found;
}

/** 嵌入 iframe 弹窗打开时铺满视口，使内部 fixed 弹层与产品中心一致贴底 */
function TM_setEmbedFrameModalExpanded(frame, expanded) {
    if (!frame) return;
    var on = !!expanded;
    if (on) {
        frame.classList.add('tm-embed-frame-modal-open');
        if (!frame.dataset.tmEmbedModalSaved) {
            frame.dataset.tmEmbedModalSaved = '1';
            frame.dataset.tmEmbedModalPosition = frame.style.position || '';
            frame.dataset.tmEmbedModalWidth = frame.style.width || '';
            frame.dataset.tmEmbedModalHeight = frame.style.height || '';
            frame.dataset.tmEmbedModalZIndex = frame.style.zIndex || '';
            frame.dataset.tmEmbedModalMaxHeight = frame.style.maxHeight || '';
        }
        frame.style.setProperty('position', 'fixed', 'important');
        frame.style.setProperty('inset', '0', 'important');
        frame.style.setProperty('width', '100%', 'important');
        frame.style.setProperty('height', '100dvh', 'important');
        frame.style.setProperty('max-height', '100dvh', 'important');
        frame.style.setProperty('z-index', '105', 'important');
        frame.style.setProperty('border', '0', 'important');
    } else {
        frame.classList.remove('tm-embed-frame-modal-open');
        if (frame.dataset.tmEmbedModalSaved) {
            frame.style.position = frame.dataset.tmEmbedModalPosition || '';
            frame.style.width = frame.dataset.tmEmbedModalWidth || '';
            frame.style.height = frame.dataset.tmEmbedModalHeight || '';
            frame.style.zIndex = frame.dataset.tmEmbedModalZIndex || '';
            frame.style.maxHeight = frame.dataset.tmEmbedModalMaxHeight || '';
            frame.style.removeProperty('inset');
            delete frame.dataset.tmEmbedModalSaved;
        }
        if (window.TM_Compliance && typeof window.TM_Compliance.syncIframeHeight === 'function') {
            window.TM_Compliance.syncIframeHeight(frame);
        }
    }
}

function TM_restoreAllEmbedFramesFromModal() {
    if ((window.__TM_embedModalNotifyDepth || 0) > 0) return;
    document.querySelectorAll('iframe.tm-module-frame.tm-embed-frame-modal-open').forEach(function (frame) {
        TM_setEmbedFrameModalExpanded(frame, false);
    });
}

/** 嵌入 iframe 通过 postMessage 上报的弹窗层数（与主壳 __TM_shellOverlayDepth 协同） */
function TM_pushEmbedModalNotify() {
    window.__TM_embedModalNotifyDepth = (window.__TM_embedModalNotifyDepth || 0) + 1;
    TM_pushShellOverlay();
}

function TM_popEmbedModalNotify(frame) {
    window.__TM_embedModalNotifyDepth = Math.max(0, (window.__TM_embedModalNotifyDepth || 0) - 1);
    TM_popShellOverlay();
    if (window.__TM_embedModalNotifyDepth === 0 && frame) {
        TM_setEmbedFrameModalExpanded(frame, false);
    }
}

function TM_anyEmbedFrameModalOpen() {
    try {
        return !!document.querySelector('iframe.tm-module-frame.tm-embed-frame-modal-open');
    } catch (e) {
        return false;
    }
}

window.TM_setEmbedFrameModalExpanded = TM_setEmbedFrameModalExpanded;
window.TM_restoreAllEmbedFramesFromModal = TM_restoreAllEmbedFramesFromModal;

/** 实际应用主壳底栏 / 备案区显隐（仅在引用计数为 0↔1 时调用） */
function TM_applyShellOverlayHidden(hidden) {
    var on = !!hidden;
    if (window.TM_ShellInsets && typeof window.TM_ShellInsets.applyShellOverlayHidden === 'function') {
        window.TM_ShellInsets.applyShellOverlayHidden(on);
        return;
    }
    var tabbar = document.getElementById('tm-app-tabbar');
    if (tabbar) {
        tabbar.classList.toggle('tm-shell-chrome-hidden', on);
        if (!on) {
            tabbar.classList.remove('tm-shell-chrome-hidden');
            tabbar.style.removeProperty('visibility');
            tabbar.style.removeProperty('pointer-events');
        }
    }
    document.documentElement.classList.toggle('tm-embed-modal-open', on);
    document.body.classList.toggle('tm-embed-modal-open', on);
    if (!on) {
        document.documentElement.classList.remove('tm-embed-modal-open');
        document.body.classList.remove('tm-embed-modal-open');
    }
    var complianceFoot = document.querySelector('#content-area > footer.tm-compliance-footer');
    if (complianceFoot) {
        complianceFoot.style.display = on ? 'none' : '';
    }
    if (on) {
        document.documentElement.style.setProperty('--tm-tabbar-h', '0px');
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
        if (typeof TM_syncAppShellMetrics === 'function') {
            TM_syncAppShellMetrics();
        }
    }
}

/** 弹窗壳层引用计数 +1（每次打开弹窗调用一次） */
function TM_pushShellOverlay() {
    window.__TM_shellOverlayDepth = (window.__TM_shellOverlayDepth || 0) + 1;
    if (window.__TM_shellOverlayDepth === 1) {
        TM_applyShellOverlayHidden(true);
    }
}

/** 弹窗壳层引用计数 -1（每次关闭弹窗调用一次） */
function TM_popShellOverlay() {
    window.__TM_shellOverlayDepth = Math.max(0, (window.__TM_shellOverlayDepth || 0) - 1);
    if (window.__TM_shellOverlayDepth === 0) {
        TM_applyShellOverlayHidden(false);
        TM_restoreAllEmbedFramesFromModal();
        if (typeof TM_notifyEmbedModal === 'function') {
            TM_notifyEmbedModal(false);
        }
    }
}

/** 根据 DOM 与计数纠偏，修复「弹窗已关但底栏仍隐藏」（不向 depth=0 时自动 push，避免登录后误藏底栏） */
function TM_reconcileShellOverlay() {
    var domOpen = TM_anyShellOverlayOpenInDom();
    var depth = window.__TM_shellOverlayDepth || 0;
    var embedDepth = window.__TM_embedModalNotifyDepth || 0;
    if (embedDepth > 0 || TM_anyEmbedFrameModalOpen()) {
        return;
    }
    if (!domOpen && depth > 0) {
        window.__TM_shellOverlayDepth = 0;
        TM_applyShellOverlayHidden(false);
        TM_restoreAllEmbedFramesFromModal();
    }
}

/** 登录/刷新/模块弹窗同步后：强制恢复底栏与引用计数 */
function TM_resetShellOverlay() {
    window.__TM_shellOverlayDepth = 0;
    window.__TM_embedModalNotifyDepth = 0;
    TM_applyShellOverlayHidden(false);
    TM_restoreAllEmbedFramesFromModal();
    if (typeof TM_notifyEmbedModal === 'function') {
        TM_notifyEmbedModal(false);
    }
}

/** 无弹窗打开时恢复底栏；有弹窗时仅做 depth 纠偏 */
function TM_ensureShellOverlayVisible() {
    if (TM_anyShellOverlayOpenInDom()) {
        if (typeof TM_reconcileShellOverlay === 'function') {
            TM_reconcileShellOverlay();
        }
        return;
    }
    TM_resetShellOverlay();
}

/** 捕获异步模块加载后误藏底栏（登录闪现后消失） */
function TM_scheduleShellOverlayRecovery() {
    if (!document.getElementById('tm-app-tabbar')) return;
    function run() {
        TM_ensureShellOverlayVisible();
        if (typeof TM_syncAppShellMetrics === 'function') {
            TM_syncAppShellMetrics();
        }
    }
    run();
    setTimeout(run, 150);
    setTimeout(run, 600);
}

window.TM_applyShellOverlayHidden = TM_applyShellOverlayHidden;
window.TM_pushShellOverlay = TM_pushShellOverlay;
window.TM_popShellOverlay = TM_popShellOverlay;
window.TM_reconcileShellOverlay = TM_reconcileShellOverlay;
window.TM_resetShellOverlay = TM_resetShellOverlay;
window.TM_ensureShellOverlayVisible = TM_ensureShellOverlayVisible;
window.TM_scheduleShellOverlayRecovery = TM_scheduleShellOverlayRecovery;

/** 订单/收款变更后通知 CRM 时间轴、智能经营报表等模块刷新 */
var _tmDashboardStatsTimer = null;
function TM_emitOrderDataChanged(detail) {
    detail = detail || {};
    try {
        clearTimeout(_tmDashboardStatsTimer);
        _tmDashboardStatsTimer = setTimeout(function () {
            if (typeof window.loadDashboardOverviewStats === 'function') {
                window.loadDashboardOverviewStats();
            }
        }, 350);
        if (typeof window.TM_refreshDashboardPendingOrders === 'function') {
            window.TM_refreshDashboardPendingOrders();
        }
    } catch (eStats) { /* ignore */ }
    try {
        window.dispatchEvent(new CustomEvent('tm-order-data-changed', { detail: detail }));
    } catch (e) { /* ignore */ }
    try {
        document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
            try {
                if (frame.contentWindow) {
                    frame.contentWindow.postMessage({
                        type: 'TM_ORDER_DATA_CHANGED',
                        custId: detail.custId,
                        orderId: detail.orderId
                    }, '*');
                }
            } catch (e2) { /* ignore */ }
        });
    } catch (e3) { /* ignore */ }
}
window.TM_emitOrderDataChanged = TM_emitOrderDataChanged;

/** 客户档案变更后通知 CRM iframe 等模块刷新列表 */
function TM_emitCustomersChanged(detail) {
    detail = detail || {};
    try {
        window.dispatchEvent(new CustomEvent('tm-customers-changed', { detail: detail }));
    } catch (e) { /* ignore */ }
    try {
        document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
            try {
                if (frame.contentWindow) {
                    frame.contentWindow.postMessage({
                        type: 'TM_CUSTOMERS_CHANGED',
                        customerId: detail.customerId
                    }, '*');
                }
            } catch (e2) { /* ignore */ }
        });
    } catch (e3) { /* ignore */ }
}
window.TM_emitCustomersChanged = TM_emitCustomersChanged;

/** 仓库档案变更后通知各模块刷新仓库下拉 */
function TM_emitWarehousesChanged(detail) {
    detail = detail || {};
    try {
        window.dispatchEvent(new CustomEvent('tm-warehouses-changed', { detail: detail }));
    } catch (e) { /* ignore */ }
    try {
        document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
            try {
                if (frame.contentWindow) {
                    frame.contentWindow.postMessage({
                        type: 'TM_WAREHOUSES_CHANGED',
                        warehouseId: detail.warehouseId
                    }, '*');
                }
            } catch (e2) { /* ignore */ }
        });
    } catch (e3) { /* ignore */ }
}
window.TM_emitWarehousesChanged = TM_emitWarehousesChanged;

/** 弹窗打开时隐藏主壳底栏（兼容旧调用，内部走引用计数） */
function TM_setShellChromeHidden(hidden) {
    if (hidden) {
        TM_pushShellOverlay();
    } else {
        TM_popShellOverlay();
    }
}

window.TM_setShellChromeHidden = TM_setShellChromeHidden;

function TM_applyDialogShell(modalEl, opts) {
    if (!modalEl) return;
    opts = opts || {};
    var variant = opts.variant;
    if (!variant) {
        if (modalEl.getAttribute('data-tm-dialog-variant') === 'center') {
            variant = 'center';
        } else if (modalEl.id === 'voice-modal' || modalEl.id === 'photo-modal') {
            variant = 'center';
        } else {
            variant = 'sheet';
        }
    }
    if (window.TM_ShellInsets && typeof window.TM_ShellInsets.applyModalRoot === 'function') {
        window.TM_ShellInsets.applyModalRoot(modalEl, { variant: variant });
    } else if (variant === 'sheet') {
        modalEl.classList.add('tm-mobile-sheet-modal', 'tm-unified-mobile-modal');
    }
}

/** 打开统一移动端弹窗：应用壳层、锁定滚动、隐藏底栏 */
function TM_openUnifiedModal(modalEl, opts) {
    if (!modalEl) return;
    opts = opts || {};
    if (typeof TM_applyDialogShell === 'function') {
        TM_applyDialogShell(modalEl, { variant: opts.variant || 'sheet' });
    }
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    TM_pushShellOverlay();
    if (typeof TM_notifyEmbedModal === 'function') TM_notifyEmbedModal(true);
}
window.TM_openUnifiedModal = TM_openUnifiedModal;

function TM_closeUnifiedModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    TM_popShellOverlay();
    if ((window.__TM_shellOverlayDepth || 0) === 0) {
        document.body.style.overflow = '';
    }
    TM_reconcileShellOverlay();
}
window.TM_closeUnifiedModal = TM_closeUnifiedModal;
window.TM_applyDialogShell = TM_applyDialogShell;

if (!window.__tmEmbedModalListenerBound) {
    window.__tmEmbedModalListenerBound = true;
    window.addEventListener('message', function (ev) {
        var data = ev.data;
        if (!data || data.type !== 'TM_EMBED_MODAL') return;
        var fromModuleFrame = false;
        try {
            document.querySelectorAll('iframe.tm-module-frame').forEach(function (frame) {
                try {
                    if (frame.contentWindow === ev.source) fromModuleFrame = true;
                } catch (e0) { /* ignore */ }
            });
        } catch (e1) { /* ignore */ }
        if (!fromModuleFrame) return;
        var frame = TM_findEmbedFrameByWindow(ev.source);
        if (data.open) {
            if (typeof TM_pushEmbedModalNotify === 'function') {
                TM_pushEmbedModalNotify();
            } else if (typeof TM_pushShellOverlay === 'function') {
                TM_pushShellOverlay();
            }
            if (frame) TM_setEmbedFrameModalExpanded(frame, true);
        } else {
            if (typeof TM_popEmbedModalNotify === 'function') {
                TM_popEmbedModalNotify(frame);
            } else if (typeof TM_popShellOverlay === 'function') {
                TM_popShellOverlay();
            } else if (frame) {
                TM_setEmbedFrameModalExpanded(frame, false);
            }
            if (typeof TM_reconcileShellOverlay === 'function') TM_reconcileShellOverlay();
        }
    });
}

if (!window.__tmShellOverlayReconcileBound) {
    window.__tmShellOverlayReconcileBound = true;
    window.addEventListener('pageshow', function () {
        if (typeof TM_ensureShellOverlayVisible === 'function') {
            TM_ensureShellOverlayVisible();
        } else if (typeof TM_resetShellOverlay === 'function') {
            TM_resetShellOverlay();
        } else if (typeof TM_reconcileShellOverlay === 'function') {
            TM_reconcileShellOverlay();
        }
    });
}

function TM_bootIndexAppShell() {
    if (typeof TM_resetShellOverlay === 'function') {
        TM_resetShellOverlay();
    }
    TM_renderIdentityTabbar();
    if (TM_isStandaloneOpsHub()) {
        TM_bootOpsHubShell();
        return;
    }
    if (TM_isOpsAdminShell() && document.getElementById('view-ops')) {
        TM_bootOpsIndexShell();
        return;
    }
    initNavigationFromConfig();
    TM_bindAppShellTabbar();
    TM_syncAppShellMetrics();
    if (typeof TM_reconcileShellOverlay === 'function') {
        TM_reconcileShellOverlay();
    }
    if (typeof TM_syncProductCenterOverlays === 'function') {
        TM_syncProductCenterOverlays();
    }
    if (typeof window.tmInjectMemberReferralBanner === 'function') {
        var memberModal = document.getElementById('member-modal');
        if (memberModal) {
            window.tmInjectMemberReferralBanner(memberModal);
        }
    }
    switchTab(getInitialTabFromHash());
    if (typeof TM_scheduleShellOverlayRecovery === 'function') {
        TM_scheduleShellOverlayRecovery();
    }
}

// 尽早绑定底栏；若脚本执行时 DOM 已就绪，则立即绑定（避免错过 DOMContentLoaded）
function TM_scheduleAppShellTabbarBind() {
    function go() {
        var bar = document.getElementById('tm-app-tabbar');
        if (bar && bar.getAttribute('data-tm-nav-mode') === 'ops') {
            TM_bindOpsShellTabbar();
            return;
        }
        TM_bindAppShellTabbar();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go);
    } else {
        go();
    }
}
TM_scheduleAppShellTabbarBind();

function TM_scheduleAppShellBoot() {
    function boot() {
        if (document.getElementById('tm-app-tabbar')) {
            TM_bootIndexAppShell();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}
TM_scheduleAppShellBoot();
window.addEventListener('load', function () {
    if (typeof window.TM_syncAppShellMetrics === 'function') {
        window.TM_syncAppShellMetrics();
    }
});

function switchTab(tabId) {
    const validTabs = ['dashboard', 'biz', 'crm', 'supply', 'supplier'];
    if (!validTabs.includes(tabId)) {
        tabId = 'dashboard';
    }

    if (window.TM_RoleEngine && typeof window.TM_RoleEngine.canAccessTab === 'function') {
        if (!window.TM_RoleEngine.canAccessTab(tabId)) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('当前角色无权访问该模块', 'error');
            }
            tabId = window.TM_RoleEngine.getFirstVisibleTabForRole(
                window.TM_UI_CONTEXT && window.TM_UI_CONTEXT.role
            );
        }
    }

    if (tabId === 'crm') {
        hideCrmDetail();
    }

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const viewSupply = document.getElementById('view-supply');
    const contentArea = document.getElementById('content-area');
    if (viewSupply && tabId !== 'supply') {
        viewSupply.classList.remove('tm-view-supply-scroll');
    }
    if (contentArea) {
        contentArea.classList.toggle('tm-shell-tab-supply-active', tabId === 'supply');
        if (tabId !== 'supply') {
            contentArea.style.removeProperty('overflow');
        }
    }
    const target = document.getElementById('view-' + tabId);
    if (target) target.classList.remove('hidden');

    if (typeof window.TM_syncAppShellMetrics === 'function') {
        window.TM_syncAppShellMetrics();
    }

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
    try {
        const u = new URL(window.location.href);
        u.hash = '#tab=' + encodeURIComponent(tabId);
        window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (eRs) {
        window.history.replaceState(null, '', '#tab=' + encodeURIComponent(tabId));
    }

    // 加载对应模块
    if (tabId === 'dashboard') loadDashboard();
    else if (tabId === 'biz') loadSmartOps();
    else if (tabId === 'crm') loadCRM();
    else if (tabId === 'supply') loadProductCenter();
    else if (tabId === 'supplier') loadSupplier();

    if (window.TM_Compliance && typeof window.TM_Compliance.onTabChange === 'function') {
        setTimeout(function () {
            window.TM_Compliance.onTabChange(tabId);
            var contentEl = document.getElementById('content-area');
            if (contentEl) contentEl.scrollTop = 0;
        }, 200);
    } else {
        requestAnimationFrame(function () {
            var contentEl = document.getElementById('content-area');
            if (contentEl) contentEl.scrollTop = 0;
        });
    }

    if (typeof window.TM_syncAppShellMetrics === 'function') {
        requestAnimationFrame(function () {
            window.TM_syncAppShellMetrics();
        });
    }
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

function openAIAnalysis() {
    if (window.TM_BizAI && typeof window.TM_BizAI.openAIAnalysis === 'function') {
        return window.TM_BizAI.openAIAnalysis();
    }
    var modal = document.getElementById('ai-modal');
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function closeAIAnalysis() {
    if (window.TM_BizAI && typeof window.TM_BizAI.closeAIAnalysis === 'function') {
        return window.TM_BizAI.closeAIAnalysis();
    }
    var modal = document.getElementById('ai-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else if (modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
}

// 手机端侧边栏切换
function toggleSidebar() {
    const sb = document.getElementById('main-sidebar');
    const ol = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ol) ol.classList.toggle('hidden');
}

// --- <用户订阅>会员 / 海报：downloadPoster / showPoster 由 auth.js + tm-save-image.js 提供 ---
// 勿在此重复定义 downloadPoster，避免覆盖手机端「保存到相册」能力。

// --- <工作台>语音逻辑：壳层仅提供稳定入口，真实录音/OSS/AI 由 dashboard 模块注册到 window.__TM_dashboardVoice ---
(function () {
    function tmVoiceToast(msg) {
        if (typeof showToast === 'function') {
            showToast(msg);
        } else if (window.TM_UI && typeof window.TM_UI.showNotification === 'function') {
            window.TM_UI.showNotification(msg, 'info');
        } else {
            alert(msg);
        }
    }
    function tmVoiceImpl() {
        return window.__TM_dashboardVoice;
    }
    function tmVoiceReady() {
        var impl = tmVoiceImpl();
        if (impl && typeof impl.isReady === 'function') {
            return impl.isReady();
        }
        return !!(impl && typeof impl.startVoiceRecording === 'function');
    }
    window.openVoiceModal = function () {
        var impl = tmVoiceImpl();
        if (impl && typeof impl.openVoiceModal === 'function') {
            if (!tmVoiceReady()) {
                tmVoiceToast('工作台语音功能加载中，请稍候再试');
                return;
            }
            return impl.openVoiceModal();
        }
        tmVoiceToast('工作台正在加载，请稍后再试语音提单');
    };
    window.closeVoiceModal = function (opts) {
        var impl = tmVoiceImpl();
        if (impl && typeof impl.closeVoiceModal === 'function') {
            return impl.closeVoiceModal(opts);
        }
        if (window.TmOnboarding && typeof window.TmOnboarding.notifyVoiceModalClosing === 'function') {
            var reason = (opts && opts.reason) ? opts.reason : 'user_cancel';
            window.TmOnboarding.notifyVoiceModalClosing(reason);
        }
        var m = document.getElementById('voice-modal');
        if (m) m.classList.add('hidden');
    };
    window.startVoiceRecording = function () {
        var impl = tmVoiceImpl();
        if (impl && typeof impl.startVoiceRecording === 'function') {
            if (!tmVoiceReady()) {
                tmVoiceToast('工作台语音功能加载中，请稍候再试');
                return;
            }
            return impl.startVoiceRecording();
        }
        tmVoiceToast('工作台正在加载，请稍后再试语音提单');
    };
    window.stopVoiceRecording = function () {
        var impl = tmVoiceImpl();
        if (impl && typeof impl.stopVoiceRecording === 'function') {
            return impl.stopVoiceRecording();
        }
        tmVoiceToast('工作台正在加载，请稍后再试语音提单');
    };
})();

// --- 拍照识图：实现见 tm-dashboard-photo.js（挂载 window.submitPhoto / handlePhotoSelected）---
function openPhotoModal() {
    var modal = document.getElementById('photo-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    if (typeof window.resetPhoto === 'function') {
        window.resetPhoto();
    }
}
function closePhotoModal() {
    var modal = document.getElementById('photo-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

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

//  进行中单据：详情查看逻辑（优先 dashboard 模块实现）
function openOrderDetail(orderId) {
    if (typeof window.__TM_dashboardOpenOrderDetail === 'function') {
        return window.__TM_dashboardOpenOrderDetail(orderId);
    }
    var idEl = document.getElementById('detail-order-id');
    if (idEl) idEl.innerText = orderId || '';
    var modal = document.getElementById('order-detail-modal');
    if (!modal) return;
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else {
        if (typeof TM_applyDialogShell === 'function') TM_applyDialogShell(modal);
        modal.classList.remove('hidden');
        if (typeof TM_pushShellOverlay === 'function') TM_pushShellOverlay();
        else if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(true);
        else document.body.style.overflow = 'hidden';
    }
}

function closeOrderDetail() {
    if (typeof window.__TM_dashboardCloseOrderDetail === 'function') {
        return window.__TM_dashboardCloseOrderDetail();
    }
    var modal = document.getElementById('order-detail-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else {
        if (modal) modal.classList.add('hidden');
        if (typeof TM_popShellOverlay === 'function') TM_popShellOverlay();
        else if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(false);
        document.body.style.overflow = '';
        if (typeof TM_reconcileShellOverlay === 'function') TM_reconcileShellOverlay();
    }
}

// 弹窗开关
function openAuditModal(name) {
    // 优先路由到 dashboard 模块的真实审核逻辑（含AI结果填充）
    if (typeof window.__TM_DASHBOARD_OPEN_AUDIT === 'function') {
        return window.__TM_DASHBOARD_OPEN_AUDIT(name);
    }
    var modal = document.getElementById('audit-modal');
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
async function closeAuditModal(options) {
    if (typeof window.syncAuditDraftBeforePersist === 'function' && !(options && options.skipPersist)) {
        try {
            await window.syncAuditDraftBeforePersist();
            if (typeof showToast === 'function') {
                showToast('草稿已保存', 'success');
            }
        } catch (e) {
            console.warn('[Audit] 草稿保存失败:', e);
            if (typeof showToast === 'function') {
                showToast((e && e.message) ? e.message : '草稿保存失败，请重试', 'error');
            }
            return;
        }
    }
    var modal = document.getElementById('audit-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else if (modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
    if (window.auditState) {
        window.auditState.currentRecordId = null;
        window.auditState.aiEnvelope = null;
        window.auditState.aiStructured = null;
        window.auditState.activeNewProductIndex = 0;
        window.auditState.newProductDrafts = {};
        window.auditState.savedNewProductIds = {};
    }
}

// 高级信息抽屉切换
function toggleAdvancedPanel(type) {
    const drawer = document.getElementById('drawer-' + type);
    const icon = document.getElementById('icon-' + type);
    drawer.classList.toggle('open');
    icon.classList.toggle('ph-caret-up');
    icon.classList.toggle('ph-caret-down');
}

// 单位弹窗开关（产品中心由 ProductModule 接管）
function openUnitModal() {
    if (window.ProductModule && typeof window.ProductModule.openUnitModal === 'function') {
        window.ProductModule.openUnitModal();
        return;
    }
    document.querySelectorAll('#unit-modal').forEach((modal) => {
        modal.classList.remove('hidden');
    });
}
function closeUnitModal() {
    if (window.ProductModule && typeof window.ProductModule.closeUnitModal === 'function') {
        window.ProductModule.closeUnitModal();
        return;
    }
    document.querySelectorAll('#unit-modal').forEach((modal) => {
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
    if (typeof window.TM_openManualOrderModal === 'function') {
        return window.TM_openManualOrderModal();
    }
    var modal = document.getElementById('manual-order-modal');
    if (!modal) return;
    if (typeof TM_applyDialogShell === 'function') TM_applyDialogShell(modal);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (typeof calculateManualTotal === 'function') calculateManualTotal();
}

function closeManualOrderModal() {
    if (typeof window.TM_closeManualOrderModal === 'function') {
        return window.TM_closeManualOrderModal();
    }
    var modal = document.getElementById('manual-order-modal');
    if (modal) modal.classList.add('hidden');
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

function saveManualOrder() {
    if (typeof window.TM_saveManualOrder === 'function') {
        return window.TM_saveManualOrder();
    }
    if (window.TM_UI && window.TM_UI.showNotification) {
        window.TM_UI.showNotification('添加订单模块未加载，请刷新后重试', 'error');
    } else {
        alert('添加订单模块未加载，请刷新后重试');
    }
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
    if (window.ProductModule && typeof window.ProductModule.filterInventoryTable === 'function') {
        window.ProductModule.filterInventoryTable();
        return;
    }
    const input = document.getElementById('inventorySearch');
    if (!input) return;
    const query = input.value.toUpperCase();
    const rows = document.querySelectorAll('#existingProdTable tbody tr');
    rows.forEach(row => {
        const nameCell = row.querySelector('.product-name-cell');
        const skuCell = row.querySelector('.product-sku-cell');
        if (!nameCell || !skuCell) return;
        const name = nameCell.innerText.toUpperCase();
        const sku = skuCell.innerText.toUpperCase();
        row.style.display = (name.includes(query) || sku.includes(query)) ? '' : 'none';
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
        var ratingEl = document.getElementById('supplier-rating');
        if (rating && ratingEl) {
            ratingEl.value = rating;
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
    var ratingEl = document.getElementById('supplier-rating');
    const rating = ratingEl ? ratingEl.value : '';
    
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
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function closeClientEditModal() {
    var modal = document.getElementById('client-edit-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else { if (modal) modal.classList.add('hidden'); document.body.style.overflow = ''; }
}

function toggleAdvancedLegacy() {
    const drawer = document.getElementById('advanced-drawer');
    const icon = document.getElementById('advanced-icon');
    drawer.classList.toggle('open');
    icon.classList.toggle('ph-caret-up');
    icon.classList.toggle('ph-caret-down');
}

/* 客户 CRM 由 modules/crm/crm.html 内联脚本提供，勿在此使用 confirm 占位 */

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

window._promoSelectedProductIds = window._promoSelectedProductIds || [];
window._promoPickerProducts = window._promoPickerProducts || [];

function openPromoProductPickerModal() {
    var modal = document.getElementById('promo-product-picker-modal');
    if (!modal) {
        if (window.TM_BizAI && typeof window.TM_BizAI.openClearanceModalWithGenerate === 'function') {
            window.TM_BizAI.openClearanceModalWithGenerate([], false);
        } else {
            openClearanceModal([]);
        }
        return;
    }
    if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }
    modal.style.setProperty('z-index', '320', 'important');
    window._promoSelectedProductIds = [];
    var bar = document.getElementById('promo-picker-selected-bar');
    var countEl = document.getElementById('promo-picker-count');
    if (bar) bar.classList.add('hidden');
    if (countEl) countEl.textContent = '0';
    var listEl = document.getElementById('promo-product-picker-list');
    if (listEl) {
        listEl.innerHTML = '<p class="text-center text-xs text-slate-400 py-8">正在加载产品…</p>';
    }
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else {
        if (typeof TM_applyDialogShell === 'function') TM_applyDialogShell(modal);
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(true);
    }
    ensurePromoPickerProductsLoaded().then(function () {
        if (typeof window.renderPromoProductPickerList === 'function') {
            window.renderPromoProductPickerList('');
        }
    }).catch(function (err) {
        if (listEl) {
            listEl.innerHTML = '<p class="text-center text-xs text-rose-500 py-8">'
                + (err && err.message ? err.message : '加载产品失败') + '</p>';
        }
    });
}

/** 选品列表：优先内存，否则拉 /api/v1/rd/products（不依赖先进产品中心） */
function ensurePromoPickerProductsLoaded(force) {
    var cached = getPromoPickerProductSource();
    if (!force && cached.length > 0) {
        window._promoPickerProducts = cached;
        return Promise.resolve(cached);
    }
    if (!window.wrappedFetch) {
        return Promise.reject(new Error('网络组件未就绪'));
    }
    return window.wrappedFetch('/api/v1/rd/products', { method: 'GET' }).then(function (response) {
        if (typeof window.handleApiResponse === 'function') {
            return window.handleApiResponse(response);
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    }).then(function (data) {
        if (!data) throw new Error('获取产品列表失败');
        var raw = data.data !== undefined ? data.data : data;
        if (raw && Array.isArray(raw.records)) raw = raw.records;
        if (!Array.isArray(raw)) raw = [];
        var mapped = raw.map(function (p) {
            if (window.ProductModule && typeof window.ProductModule.mapProductFromApi === 'function') {
                return window.ProductModule.mapProductFromApi(p);
            }
            var id = p.productId != null ? p.productId : p.id;
            var name = p.productName || p.name || '';
            var sku = p.productSku || p.sku || '';
            var price = p.salePrice != null ? p.salePrice : p.price;
            return {
                id: id,
                productId: id,
                name: name,
                productName: name,
                sku: sku,
                productSku: sku,
                price: price,
                salePrice: price
            };
        });
        window._promoPickerProducts = mapped;
        window.products = mapped;
        if (window.ProductModule && Array.isArray(window.ProductModule.products)
            && window.ProductModule.products.length === 0) {
            window.ProductModule.products = mapped.slice();
        }
        return mapped;
    });
}

function getPromoPickerProductSource() {
    if (window.ProductModule && Array.isArray(window.ProductModule.products)
        && window.ProductModule.products.length > 0) {
        return window.ProductModule.products;
    }
    if (Array.isArray(window._promoPickerProducts) && window._promoPickerProducts.length > 0) {
        return window._promoPickerProducts;
    }
    if (Array.isArray(window.products) && window.products.length > 0) {
        return window.products;
    }
    return [];
}

function closePromoProductPickerModal() {
    var modal = document.getElementById('promo-product-picker-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else {
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(false);
    }
}

window.filterPromoProductPicker = function () {
    var input = document.getElementById('promo-product-search');
    var q = input ? input.value.trim().toLowerCase() : '';
    if (typeof window.renderPromoProductPickerList === 'function') {
        window.renderPromoProductPickerList(q);
    }
};

window.togglePromoProductSelect = function (productId, checked) {
    var id = Number(productId);
    var list = window._promoSelectedProductIds;
    var idx = list.indexOf(id);
    var on = checked === true || (checked === undefined && idx < 0);
    if (on && idx < 0) list.push(id);
    else if (!on && idx >= 0) list.splice(idx, 1);
    window.filterPromoProductPicker();
    var bar = document.getElementById('promo-picker-selected-bar');
    var countEl = document.getElementById('promo-picker-count');
    if (bar) bar.classList.toggle('hidden', list.length === 0);
    if (countEl) countEl.textContent = String(list.length);
};

window.confirmPromoProductSelection = function () {
    if (!window._promoSelectedProductIds || window._promoSelectedProductIds.length === 0) {
        if (window.TM_UI && window.TM_UI.alert) window.TM_UI.alert('请至少选择一个产品', 'warning');
        return;
    }
    // 确保有促销目标（未走 Step1 时默认清库存）
    if (window.TM_BizAI) {
        var goals = typeof window.TM_BizAI.getPromoGoals === 'function' ? window.TM_BizAI.getPromoGoals() : [];
        if (!goals || !goals.length) {
            if (typeof window.TM_BizAI.setPromoGoals === 'function') {
                window.TM_BizAI.setPromoGoals(['CLEAR_STOCK']);
            }
        }
    }
    closePromoProductPickerModal();
    if (window.TM_BizAI && typeof window.TM_BizAI.openClearanceModalWithGenerate === 'function') {
        window.TM_BizAI.openClearanceModalWithGenerate(window._promoSelectedProductIds, false);
        return;
    }
    openClearanceModal(window._promoSelectedProductIds);
};

window.renderPromoProductPickerList = function (query) {
    var container = document.getElementById('promo-product-picker-list');
    if (!container) return;
    var products = getPromoPickerProductSource();
    var q = (query || '').toLowerCase();
    var selected = window._promoSelectedProductIds || [];
    var filtered = (products || []).filter(function (p) {
        if (!q) return true;
        var name = (p.productName || p.name || '').toLowerCase();
        var sku = String(p.productSku || p.sku || '').toLowerCase();
        return name.indexOf(q) >= 0 || sku.indexOf(q) >= 0;
    });
    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-xs text-slate-400 py-8">'
            + (products.length === 0
                ? '暂无产品，请先在产品中心维护商品'
                : '未找到匹配产品，请调整搜索关键词')
            + '</p>';
        return;
    }
    container.innerHTML = filtered.map(function (p) {
        var pid = p.productId != null ? p.productId : (p.id != null ? p.id : 0);
        var checked = selected.indexOf(Number(pid)) >= 0 ? 'checked' : '';
        var sku = (p.productSku || p.sku || '').toString().replace(/</g, '&lt;');
        var name = (p.productName || p.name || '').toString().replace(/</g, '&lt;');
        var price = p.salePrice != null ? p.salePrice : p.price;
        return (
            '<label class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-brand-200 cursor-pointer">' +
            '<input type="checkbox" class="w-4 h-4 accent-brand-600 shrink-0" ' + checked + ' onchange="togglePromoProductSelect(' + pid + ', this.checked)" />' +
            '<div class="flex-1 min-w-0"><p class="text-xs font-bold text-slate-800 truncate">' + name + '</p>' +
            '<p class="text-[10px] text-slate-400 font-mono">' + sku + '</p></div>' +
            '<span class="text-[10px] font-mono text-brand-600 shrink-0">' +
            (typeof TM_formatCNY === 'function' ? TM_formatCNY(price) : ('¥' + (parseFloat(price) || 0).toFixed(2))) +
            '</span></label>'
        );
    }).join('');
};

window.openPromoProductPickerModal = openPromoProductPickerModal;
window.closePromoProductPickerModal = closePromoProductPickerModal;
window.ensurePromoPickerProductsLoaded = ensurePromoPickerProductsLoaded;

function openClearanceModal(productIds) {
    if (window.TM_BizAI && typeof window.TM_BizAI.openClearanceModalWithGenerate === 'function'
        && Array.isArray(productIds) && productIds.length > 0) {
        window.TM_BizAI.openClearanceModalWithGenerate(productIds, false);
        return;
    }
    var modal = document.getElementById('clearance-modal');
    if (!modal) return;
    var ids = Array.isArray(productIds) ? productIds : (window._promoSelectedProductIds || []);
    var products = getPromoPickerProductSource();
    var names = ids.map(function (id) {
        var p = products.find(function (x) { return Number(x.id || x.productId) === Number(id); });
        return p ? (p.productName || p.name) : null;
    }).filter(Boolean);
    var targetEl = document.getElementById('promo-plan-target-names');
    if (targetEl) {
        targetEl.textContent = names.length
            ? ('针对产品：' + names.join('、'))
            : '针对所选产品生成促销建议';
    }
    if (typeof TM_openUnifiedModal === 'function') TM_openUnifiedModal(modal);
    else {
        if (typeof TM_applyDialogShell === 'function') TM_applyDialogShell(modal);
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(true);
    }
}
function closeClearanceModal() {
    if (window.TM_BizAI && typeof window.TM_BizAI.closeClearanceModal === 'function') {
        return window.TM_BizAI.closeClearanceModal();
    }
    var modal = document.getElementById('clearance-modal');
    if (typeof TM_closeUnifiedModal === 'function') TM_closeUnifiedModal(modal);
    else {
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (typeof TM_setShellChromeHidden === 'function') TM_setShellChromeHidden(false);
    }
}
window.openClearanceModal = openClearanceModal;

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

/* 供应商删除由 ui-supplier.js + TmConfirm 提供 */

// --- 进货单详情弹窗 ---
function openPurchaseDetail(id) {
    if (window.SupplierModule && typeof window.SupplierModule.openPurchaseDetail === 'function') {
        return window.SupplierModule.openPurchaseDetail(id);
    }
    if (typeof window.editPurchase === 'function') {
        return window.editPurchase(id);
    }
    var idEl = document.getElementById('detail-purchase-id');
    if (idEl) idEl.textContent = id || '进货单详情';
    var modal = document.getElementById('purchase-detail-modal');
    if (!modal) return;
    if (typeof TM_applyDialogShell === 'function') TM_applyDialogShell(modal);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePurchaseDetail() {
    var modal = document.getElementById('purchase-detail-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (typeof TM_popShellOverlay === 'function') {
        TM_popShellOverlay();
        if (typeof TM_reconcileShellOverlay === 'function') TM_reconcileShellOverlay();
    } else if (typeof TM_setShellChromeHidden === 'function') {
        TM_setShellChromeHidden(false);
    }
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
