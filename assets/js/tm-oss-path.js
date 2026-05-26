/**
 * OSS 对象键路径（与后端 OssMediaPaths 保持一致）
 */
(function () {
    'use strict';

    var ROOT_PREFIX = 'trade-mind';
    var cachedRootPrefix = null;

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    /** yyyyMMdd，与 OSS 控制台日期目录一致 */
    function dateFolder() {
        var d = new Date();
        return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    }

    function rootPrefix() {
        return cachedRootPrefix || ROOT_PREFIX;
    }

    function setRootPrefix(prefix) {
        if (prefix && typeof prefix === 'string') {
            cachedRootPrefix = prefix.replace(/^\/+|\/+$/g, '');
        }
    }

    function joinKey() {
        var parts = Array.prototype.slice.call(arguments).filter(function (p) {
            return p != null && String(p).length > 0;
        });
        return parts.map(function (p) {
            return String(p).replace(/^\/+|\/+$/g, '');
        }).join('/');
    }

    function buildAudioKey(ext) {
        var safeExt = ext || 'webm';
        return joinKey(rootPrefix(), 'audio', dateFolder(), Date.now() + '.' + safeExt);
    }

    function buildImageKey() {
        return joinKey(rootPrefix(), 'image', dateFolder(), 'image-' + Date.now() + '.jpg');
    }

    function buildProblemKey(feedbackId, index) {
        var id = String(feedbackId || '').replace(/[^\w-]/g, '');
        var seq = typeof index === 'number' ? index : 0;
        return joinKey(rootPrefix(), 'problem', dateFolder(), id, 'image-' + seq + '-' + Date.now() + '.jpg');
    }

    window.TMOssPath = {
        ROOT_PREFIX: ROOT_PREFIX,
        dateFolder: dateFolder,
        rootPrefix: rootPrefix,
        setRootPrefix: setRootPrefix,
        buildAudioKey: buildAudioKey,
        buildImageKey: buildImageKey,
        buildProblemKey: buildProblemKey,
        joinKey: joinKey
    };
})();
