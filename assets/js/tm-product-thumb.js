/**
 * 统一产品缩略图组件（OSS resize + 占位回退）
 */
(function () {
    'use strict';

    var PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        '<rect fill="#f1f5f9" width="64" height="64" rx="8"/>' +
        '<text x="32" y="38" text-anchor="middle" fill="#94a3b8" font-size="24">📦</text></svg>'
    );

    function thumbUrl(rawUrl, size) {
        if (!rawUrl) return null;
        var s = String(rawUrl);
        if (s.indexOf('data:') === 0) return s;
        if (s.indexOf('http://') !== 0 && s.indexOf('https://') !== 0) return null;
        if (s.indexOf('x-oss-process=') >= 0) return s;
        // 预签名 URL 追加处理参数会破坏签名，直接使用原图
        if (s.indexOf('OSSAccessKeyId=') >= 0 || s.indexOf('Signature=') >= 0) return s;
        var sep = s.indexOf('?') >= 0 ? '&' : '?';
        var dim = size || 100;
        return s + sep + 'x-oss-process=image/resize,w_' + dim + ',h_' + dim + ',m_fill/quality,q_80';
    }

    function renderImg(size, alt) {
        var img = document.createElement('img');
        img.width = size;
        img.height = size;
        img.alt = alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.className = 'tm-product-thumb__img object-cover rounded-lg bg-slate-100';
        img.style.width = size + 'px';
        img.style.height = size + 'px';
        return img;
    }

    window.TM_ProductThumb = {
        placeholder: PLACEHOLDER_SVG,
        thumbUrl: thumbUrl,

        mount: function (container, opts) {
            if (!container) return null;
            opts = opts || {};
            var size = opts.size || 64;
            var url = thumbUrl(opts.coverUrl || opts.url, size);
            container.innerHTML = '';
            container.classList.add('tm-product-thumb');
            var img = renderImg(size, opts.alt || '');
            if (url) {
                img.src = url;
                img.onerror = function () {
                    img.onerror = null;
                    if (opts.coverUrl && opts.coverUrl !== url) {
                        img.src = opts.coverUrl;
                    } else {
                        img.src = PLACEHOLDER_SVG;
                    }
                };
            } else {
                img.src = PLACEHOLDER_SVG;
            }
            container.appendChild(img);
            return img;
        },

        html: function (opts) {
            opts = opts || {};
            var size = opts.size || 64;
            var url = thumbUrl(opts.coverUrl || opts.url, size) || PLACEHOLDER_SVG;
            var alt = (opts.alt || '').replace(/"/g, '&quot;');
            return '<img src="' + url + '" width="' + size + '" height="' + size + '" alt="' + alt + '" ' +
                'class="tm-product-thumb__img object-cover rounded-lg bg-slate-100 shrink-0" loading="lazy" ' +
                'onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\'" />';
        }
    };
})();
