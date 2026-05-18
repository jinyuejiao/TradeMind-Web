const fs = require('fs');
const authPath = 'd:/项目/TradeMind/项目工程/TM_Project/TradeMind-Web/assets/js/auth.js';
let s = fs.readFileSync(authPath, 'utf8');
const begin = s.indexOf('/** 与 UI 工程一致的海报弹窗');
const end = s.indexOf('/** 注册/专题页商户意图');
if (begin < 0 || end < 0) throw new Error('markers not found');
const replacement = `/** 与 UI 工程一致的海报弹窗（片段 modules/fragments/poster-modal.html） */
var TM_POSTER_MODAL_FRAGMENT_URL = '/modules/fragments/poster-modal.html';
var _tmPosterModalHtmlCache = null;

function tmIsPlaceholderReferralCode(code) {
    if (!code || code === '—') return true;
    return /^TM-\\d+$/i.test(code) || code === 'GIGA-JIN-8821';
}

window.tmMountPosterModal = async function () {
    var existing = document.getElementById('poster-modal');
    if (existing && existing.querySelector('.poster-card-inner')) return;
    if (existing) existing.remove();
    if (!_tmPosterModalHtmlCache) {
        var res = await fetch(TM_POSTER_MODAL_FRAGMENT_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('poster-modal.html load failed');
        _tmPosterModalHtmlCache = await res.text();
    }
    document.body.insertAdjacentHTML('beforeend', _tmPosterModalHtmlCache);
};

window.tmApplyPosterReferralData = function (referralCode, merchantType) {
    var code = String(referralCode || '').trim();
    var mt = merchantType || (window._tmMemberMe && window._tmMemberMe.merchantType) || (window._tmMemberCtx && window._tmMemberCtx.merchantType) || 'WHOLESALE';
    if (tmIsPlaceholderReferralCode(code)) code = window._tmCachedReferralCode || '';
    if (!code) return;
    var landing = tmBuildPosterLandingUrl(code, mt);
    window._tmPosterLandingUrl = landing;
    window._tmCachedReferralCode = code;
    ['referral-code', 'member-referral-inline', 'poster-ref-code'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = code;
    });
    var qr = document.getElementById('poster-qr');
    if (qr) qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(landing);
    var hint = document.getElementById('poster-qr-url-hint');
    if (hint) hint.textContent = 'trademind.com.cn';
    var linkEl = document.getElementById('poster-landing-link');
    if (linkEl) {
        linkEl.href = landing;
        linkEl.textContent = 'trademind.com.cn';
    }
};

window.tmSyncPosterReferral = async function () {
    await tmMountPosterModal();
    var code = '';
    var mt = 'WHOLESALE';
    try {
        if (localStorage.getItem('token')) {
            var refRes = await wrappedFetch(tmMemberApiUrl('/api/v1/tenant/referral/summary'), { method: 'GET' });
            var refJson = await refRes.json().catch(function () { return {}; });
            if (refJson.success && refJson.referralCode) code = String(refJson.referralCode).trim();
            try {
                var meRes = await wrappedFetch(tmMemberApiUrl('/api/v1/tenant/subscription/me'), { method: 'GET' });
                var meJson = await meRes.json().catch(function () { return {}; });
                if (meJson.merchantType) mt = meJson.merchantType;
                window._tmMemberMe = meJson;
            } catch (eMe) { /* ignore */ }
        }
    } catch (eRef) { /* ignore */ }
    if (!code || tmIsPlaceholderReferralCode(code)) {
        var rc = document.getElementById('referral-code');
        if (rc) {
            var t = rc.textContent.trim();
            if (t && !tmIsPlaceholderReferralCode(t)) code = t;
        }
    }
    if (code) tmApplyPosterReferralData(code, mt);
    return code;
};

`;
s = s.slice(0, begin) + replacement + s.slice(end);
fs.writeFileSync(authPath, s);
console.log('patched auth.js');
