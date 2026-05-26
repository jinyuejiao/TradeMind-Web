/**
 * TradeMind — OSS STS 直传（工作台识图等）；问题反馈图片改走服务端 /feedback/{id}/image
 */
(function () {
    'use strict';

    var ossClient = null;
    var initPromise = null;

    function normalizeEndpoint(endpoint) {
        if (!endpoint || typeof endpoint !== 'string') {
            return endpoint;
        }
        return endpoint.replace(/-internal\.aliyuncs\.com/gi, '.aliyuncs.com');
    }

    function ensureAliOssSdk() {
        return new Promise(function (resolve, reject) {
            if (typeof OSS !== 'undefined') {
                resolve();
                return;
            }
            var existing = document.querySelector('script[data-tm-ali-oss]');
            if (existing) {
                existing.addEventListener('load', function () { resolve(); });
                existing.addEventListener('error', function () { reject(new Error('ali-oss SDK 加载失败')); });
                return;
            }
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/ali-oss@6.17.1/dist/aliyun-oss-sdk.min.js';
            s.async = true;
            s.setAttribute('data-tm-ali-oss', '1');
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('ali-oss SDK 加载失败')); };
            document.head.appendChild(s);
        });
    }

    function initClient() {
        if (ossClient) {
            return Promise.resolve(ossClient);
        }
        if (initPromise) {
            return initPromise;
        }
        initPromise = ensureAliOssSdk().then(function () {
            return window.wrappedFetch('/api/v1/init/config/oss/sts', { method: 'GET' });
        }).then(function (stsRes) {
            if (!stsRes.ok) {
                throw new Error('获取 OSS STS 失败');
            }
            return stsRes.json();
        }).then(function (stsData) {
            if (!stsData || stsData.success === false || !stsData.data) {
                throw new Error((stsData && stsData.message) || 'STS 响应无效');
            }
            return window.wrappedFetch('/api/v1/init/config/oss/base', { method: 'GET' }).then(function (baseRes) {
                if (!baseRes.ok) {
                    throw new Error('获取 OSS 基础配置失败');
                }
                return baseRes.json().then(function (baseData) {
                    return { sts: stsData.data, base: baseData.data };
                });
            });
        }).then(function (cfg) {
            var baseConfig = cfg.base || {};
            var stsCredentials = cfg.sts || {};
            if (window.TMOssPath && baseConfig.objectRootPrefix) {
                window.TMOssPath.setRootPrefix(baseConfig.objectRootPrefix);
            }
            var ossRegion = baseConfig.region || 'cn-hangzhou';
            if (ossRegion.indexOf('oss-') !== 0) {
                ossRegion = 'oss-' + ossRegion;
            }
            var ossEndpoint = normalizeEndpoint(baseConfig.endpoint || '');
            var ossOpts = {
                region: ossRegion,
                accessKeyId: stsCredentials.accessKeyId,
                accessKeySecret: stsCredentials.accessKeySecret,
                stsToken: stsCredentials.securityToken,
                bucket: baseConfig.bucketName || 'trademind-ai',
                secure: true
            };
            if (ossEndpoint) {
                ossOpts.endpoint = ossEndpoint;
            }
            ossClient = new OSS(ossOpts);
            return ossClient;
        }).catch(function (err) {
            initPromise = null;
            throw err;
        });
        return initPromise;
    }

    function extractUrl(result) {
        if (!result) {
            return '';
        }
        if (result.url) {
            return result.url;
        }
        if (result.res && result.res.requestUrls && result.res.requestUrls[0]) {
            return result.res.requestUrls[0];
        }
        return '';
    }

    function uploadBlob(objectKey, blob) {
        return initClient().then(function (client) {
            return client.put(objectKey, blob, { mime: 'image/jpeg' });
        }).then(function (result) {
            var url = extractUrl(result);
            if (!url) {
                throw new Error('上传成功但未获得图片地址');
            }
            return url.split('?')[0];
        });
    }

    function uploadDashboardImage(blob) {
        if (!window.TMOssPath) {
            throw new Error('OSS 路径模块未加载');
        }
        return uploadBlob(window.TMOssPath.buildImageKey(), blob);
    }

    /**
     * 问题反馈图片：经 TenantService 服务端写入 OSS（trade-mind/problem/yyyyMMdd/...）
     */
    function uploadFeedbackImage(feedbackId, blob, index) {
        var formData = new FormData();
        formData.append('file', blob, 'image-' + (typeof index === 'number' ? index : 0) + '.jpg');
        var url = '/api/v1/tenant/feedback/' + encodeURIComponent(feedbackId) + '/image?index=' + encodeURIComponent(String(index || 0));
        return window.wrappedFetch(url, {
            method: 'POST',
            body: formData
        }).then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok || !data || data.success === false) {
                    throw new Error((data && data.message) || ('上传失败 (' + res.status + ')'));
                }
                var imageUrl = data.data && data.data.url;
                if (!imageUrl) {
                    throw new Error('服务端未返回图片地址');
                }
                return imageUrl;
            });
        });
    }

    window.TMOssUpload = {
        initClient: initClient,
        uploadBlob: uploadBlob,
        uploadDashboardImage: uploadDashboardImage,
        uploadFeedbackImage: uploadFeedbackImage
    };
})();
