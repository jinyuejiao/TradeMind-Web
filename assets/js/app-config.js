(function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // 本地开发用网关地址，云端部署用相对路径配合 Nginx 代理
    window.TM_BASE_URL = isLocal ? 'http://localhost:8080' : '';
})();