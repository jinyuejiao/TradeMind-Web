(function() {
    var host = window.location.hostname;
    var isLocal = host === 'localhost' || host === '127.0.0.1';
    // 生产/ECS：空字符串表示同源（https://IP:8443/api/...），由外层 Nginx 反代至 gateway
    window.TM_API_BASE = isLocal ? 'http://localhost:8080' : '';
})();
