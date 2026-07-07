(function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.TM_API_BASE = isLocal ? 'http://localhost:8080' : '';
    })();
