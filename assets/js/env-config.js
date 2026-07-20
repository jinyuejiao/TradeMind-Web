(function() {
    var host = window.location.hostname;
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';

    var isNativeApp = false;
    try {
        var C = (window.TMCapacitor && window.TMCapacitor.Capacitor) || window.Capacitor;
        isNativeApp = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
    } catch (e) {
        isNativeApp = false;
    }
    // Capacitor WebView 主机名也是 localhost，但协议/桥接可识别；兜底：显式开关
    if (!isNativeApp && window.TM_FORCE_NATIVE_API === true) {
        isNativeApp = true;
    }
    // 同步产物标记：App 包内存在 tm-app-build.json 时，若仍判为 web 且 hostname=localhost，按 App 处理
    if (!isNativeApp && isLocal && window.TM_APP_CHANNEL === 'capacitor') {
        isNativeApp = true;
    }

    var stored = null;
    try { stored = localStorage.getItem('tm_api_base'); } catch (e) { stored = null; }

    /**
     * 优先级：
     * 1) TM_APP_API_BASE（tm-app-api-override.js / 运营注入）
     * 2) localStorage.tm_api_base（调试）
     * 3) 原生 App → 默认生产域名（可被 override 覆盖）
     * 4) 本地 Web → localhost:8080
     * 5) 生产 Web → '' 同源
     */
    if (typeof window.TM_APP_API_BASE === 'string' && window.TM_APP_API_BASE) {
        window.TM_API_BASE = window.TM_APP_API_BASE.replace(/\/$/, '');
    } else if (stored) {
        window.TM_API_BASE = String(stored).replace(/\/$/, '');
    } else if (isNativeApp) {
        window.TM_API_BASE = 'https://trademind.com.cn';
    } else if (isLocal) {
        window.TM_API_BASE = 'http://localhost:8080';
    } else {
        window.TM_API_BASE = '';
    }

    window.TM_RUNTIME = isNativeApp ? 'capacitor' : 'web';
})();
