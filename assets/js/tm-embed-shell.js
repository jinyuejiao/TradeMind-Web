/**
 * iframe 嵌入模块与主壳协同：弹窗打开时隐藏底栏、避免遮挡
 */
(function () {
    'use strict';

    function isEmbedded() {
        try {
            return window.self !== window.top || new URLSearchParams(location.search).get('embed') === '1';
        } catch (e) {
            return true;
        }
    }

    window.TM_notifyEmbedModal = function (open) {
        if (!isEmbedded()) return;
        try {
            window.parent.postMessage({ type: 'TM_EMBED_MODAL', open: !!open }, '*');
        } catch (e) { /* ignore */ }
    };
})();
