/**
 * TradeMind 用户服务协议 / 隐私协议 — 内容与弹窗
 */
(function (global) {
    'use strict';

    var COMPANY = '杭州巨猿科技有限公司';
    var PRODUCT = '商贸智脑（TradeMind）';

    var SERVICE_HTML = [
        '<p class="tm-legal-meta">更新日期：2026年5月18日 · 生效日期：2026年5月18日</p>',
        '<h3>一、总则</h3>',
        '<p>本《用户服务协议》（以下简称「本协议」）由 ' + COMPANY + '（以下简称「我们」）与使用 ' + PRODUCT + ' 产品及服务的用户（以下简称「您」）共同订立。请您在注册、登录或使用服务前仔细阅读并充分理解本协议全部内容。</p>',
        '<h3>二、服务范围</h3>',
        '<p>我们向您提供 AI 辅助商贸经营管理 SaaS 服务，主要包括但不限于：</p>',
        '<ul><li>AI 订单识别：支持语音、图片、文本等多模态智能提取订单、客户与产品信息；</li>',
        '<li>进销存管理：产品、库存、订单、仓库调拨、供应商协同等；</li>',
        '<li>经营分析：销售统计、库存预警、生产进度等数据视图；</li>',
        '<li>按商户类型（批发、电商、外贸、工贸一体）提供的行业化功能模块。</li></ul>',
        '<h3>三、账户与试用</h3>',
        '<p>您应使用真实、合法的信息完成注册，并妥善保管账户与密码。新用户注册成功后，我们为您提供 <strong>30 天试用期</strong>；试用期届满后，您须按所选行业版本与订阅档位支付费用方可继续使用完整功能。我们保留根据运营需要调整试用规则的权利，调整将以页面公告或站内通知方式告知。</p>',
        '<h3>四、用户行为规范</h3>',
        '<p>您承诺不得利用本系统从事下列行为：</p>',
        '<ul><li>违反国家法律法规的贸易、支付或外汇管理活动；</li>',
        '<li>洗钱、诈骗、走私、销售违禁品或其他非法经营活动；</li>',
        '<li>上传含有恶意代码、侵权或违法内容的数据；</li>',
        '<li>未经授权访问、干扰或破坏系统及其他用户数据；</li>',
        '<li>将本服务用于与约定用途无关的自动化爬取、攻击或转售。</li></ul>',
        '<p>我们有权对涉嫌违规的账户采取警告、限制功能、暂停或终止服务等措施，并依法向主管部门报告。</p>',
        '<h3>五、知识产权</h3>',
        '<p>本系统软件、界面设计、文档及商标等知识产权归我们或相关权利人所有。您仅获得在本协议约定范围内的非独占、不可转让的使用许可。</p>',
        '<h3>六、免责声明与责任限制</h3>',
        '<p>AI 识别结果仅供参考，您应在确认订单前进行人工核对。因网络、第三方服务、不可抗力等导致的服务中断或数据损失，我们在法律允许范围内不承担超出您已支付服务费用总额的责任。</p>',
        '<h3>七、协议变更与终止</h3>',
        '<p>我们可能修订本协议，修订后将通过网站公示；若您继续使用服务，视为接受修订。您可随时停止使用并申请注销账户；我们亦可在您严重违约时终止服务。</p>',
        '<h3>八、适用法律与争议解决</h3>',
        '<p>本协议适用中华人民共和国法律。争议由我们住所地有管辖权的人民法院管辖。</p>',
        '<h3>九、联系我们</h3>',
        '<p>如有疑问，请通过产品内客服或官网「关于我们」页面与我们联系。</p>'
    ].join('');

    var PRIVACY_HTML = [
        '<p class="tm-legal-meta">更新日期：2026年5月18日 · 生效日期：2026年5月18日</p>',
        '<h3>一、引言</h3>',
        '<p>' + COMPANY + '（「我们」）重视您的个人信息保护。本《隐私协议》说明我们如何在您使用 ' + PRODUCT + ' 时收集、使用、存储与保护您的信息。</p>',
        '<h3>二、我们收集的信息</h3>',
        '<ul><li><strong>账户信息：</strong>手机号、邮箱、用户名、密码（加密存储）、公司名称等注册信息；</li>',
        '<li><strong>经营数据：</strong>您录入或同步的产品、订单、库存、客户、供应商、账务等业务数据；</li>',
        '<li><strong>AI 处理数据：</strong>您主动上传或录制的用于订单识别的图片、语音及文本，以及模型返回的结构化结果；</li>',
        '<li><strong>设备与日志：</strong>IP 地址、浏览器类型、操作日志，用于安全审计与服务优化。</li></ul>',
        '<h3>三、信息使用目的</h3>',
        '<p>我们仅在以下目的范围内使用您的信息：</p>',
        '<ul><li>提供、维护与改进系统功能（含 AI 订单识别与经营分析）；</li>',
        '<li>完成身份验证、订阅计费与客户支持；</li>',
        '<li>在经去标识化或聚合后，用于产品体验与 AI 模型效果优化；</li>',
        '<li>履行法律法规要求或应对安全事件。</li></ul>',
        '<p>我们<strong>不会</strong>向无关第三方出售您的个人信息。确需委托处理时（如短信、对象存储、大模型 API），我们将与受托方签署保密协议并限定处理范围。</p>',
        '<h3>四、存储与安全</h3>',
        '<p>您的数据存储于中华人民共和国境内服务器。我们采用 <strong>HTTPS 传输加密</strong>、访问控制、租户隔离等措施保护数据安全；敏感媒体文件使用 <strong>阿里云加密存储</strong> 及临时访问凭证机制。尽管如此，互联网传输无法保证绝对安全，请您妥善保管账户凭证。</p>',
        '<h3>五、您的权利</h3>',
        '<p>您有权查询、更正、删除您的个人信息，或撤回部分授权；您可通过产品设置或联系客服行使上述权利。注销账户后，我们将按法律规定删除或匿名化处理相关数据。</p>',
        '<h3>六、Cookie 与同类技术</h3>',
        '<p>我们使用 localStorage 等本地存储保存登录状态与偏好设置，以维持您的会话体验。</p>',
        '<h3>七、未成年人保护</h3>',
        '<p>本服务面向企业用户及具有完全民事行为能力的个人。我们不会主动收集未成年人信息。</p>',
        '<h3>八、政策更新</h3>',
        '<p>我们可能适时修订本政策，重大变更将通过网站公告等方式通知您。</p>',
        '<h3>九、联系我们</h3>',
        '<p>如对本政策有疑问，请通过产品内渠道或官网与我们联系。</p>'
    ].join('');

    var AGREEMENTS = {
        service: { title: '用户服务协议', html: SERVICE_HTML },
        privacy: { title: '隐私协议', html: PRIVACY_HTML }
    };

    function ensureLegalStyles() {
        if (document.getElementById('tm-legal-styles')) return;
        var style = document.createElement('style');
        style.id = 'tm-legal-styles';
        style.textContent = [
            '.tm-legal-row{display:flex;align-items:flex-start;gap:0.5rem;line-height:1.5}',
            '.tm-legal-checkbox{appearance:none;-webkit-appearance:none;width:1rem;height:1rem;margin-top:0.15rem;flex-shrink:0;border:1.5px solid #cbd5e1;border-radius:0.25rem;background:#fff;cursor:pointer;transition:all .15s}',
            '.tm-legal-checkbox:checked{background:#14B8A6;border-color:#14B8A6;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\' fill=\'white\'%3E%3Cpath d=\'M12.2 4.2 6.5 9.9 3.8 7.2l-1.1 1.1L6.5 12.1l6.8-6.8z\'/%3E%3C/svg%3E");background-size:100% 100%}',
            '.tm-legal-checkbox:focus{outline:2px solid rgba(20,184,166,.35);outline-offset:2px}',
            '.tm-legal-link{color:#0d9488;text-decoration:none;font-weight:500}',
            '.tm-legal-link:hover{text-decoration:underline;color:#0f766e}',
            '.tm-legal-modal-root{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:tmLegalFadeIn .25s ease}',
            '.tm-legal-modal-panel{width:100%;max-width:32rem;background:rgba(255,255,255,.96);border:1px solid rgba(226,232,240,.8);border-radius:2.5rem;box-shadow:0 25px 50px -12px rgba(15,23,42,.25);overflow:hidden;animation:tmLegalSlideUp .3s ease}',
            '.tm-legal-modal-head{padding:1.25rem 1.5rem 0.75rem;border-bottom:1px solid #f1f5f9}',
            '.tm-legal-modal-head h2{font-size:1.125rem;font-weight:700;color:#0f172a;margin:0}',
            '.tm-legal-modal-body{max-height:60vh;overflow-y:auto;padding:1rem 1.5rem;font-size:0.8125rem;color:#475569;line-height:1.65}',
            '.tm-legal-modal-body h3{font-size:0.875rem;font-weight:700;color:#1e293b;margin:1rem 0 0.5rem}',
            '.tm-legal-modal-body h3:first-child{margin-top:0}',
            '.tm-legal-modal-body ul{margin:0.25rem 0 0.75rem 1.25rem;padding:0}',
            '.tm-legal-modal-body li{margin-bottom:0.35rem}',
            '.tm-legal-meta{font-size:0.75rem;color:#94a3b8;margin-bottom:0.75rem}',
            '.tm-legal-modal-body::-webkit-scrollbar{width:6px}',
            '.tm-legal-modal-body::-webkit-scrollbar-track{background:#f8fafc;border-radius:999px}',
            '.tm-legal-modal-body::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#5eead4,#14b8a6);border-radius:999px}',
            '.tm-legal-modal-foot{padding:0.75rem 1.5rem 1.25rem;display:flex;justify-content:flex-end}',
            '.tm-legal-modal-close{background:#0d9488;color:#fff;border:none;border-radius:0.75rem;padding:0.625rem 1.5rem;font-size:0.875rem;font-weight:600;cursor:pointer;transition:background .15s}',
            '.tm-legal-modal-close:hover{background:#0f766e}',
            '@keyframes tmLegalFadeIn{from{opacity:0}to{opacity:1}}',
            '@keyframes tmLegalSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
            'button.tm-register-submit:disabled{opacity:.55;cursor:not-allowed}'
        ].join('');
        document.head.appendChild(style);
    }

    function closeLegalModal() {
        var root = document.getElementById('tm-legal-modal-root');
        if (root) root.remove();
        document.body.style.overflow = '';
    }

    function showAgreement(type) {
        var doc = AGREEMENTS[type];
        if (!doc) return;
        ensureLegalStyles();
        closeLegalModal();
        var root = document.createElement('div');
        root.id = 'tm-legal-modal-root';
        root.className = 'tm-legal-modal-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.innerHTML =
            '<div class="tm-legal-modal-panel">' +
            '<div class="tm-legal-modal-head"><h2>' + doc.title + '</h2></div>' +
            '<div class="tm-legal-modal-body tm-legal-scroll">' + doc.html + '</div>' +
            '<div class="tm-legal-modal-foot"><button type="button" class="tm-legal-modal-close">我已阅读</button></div>' +
            '</div>';
        document.body.appendChild(root);
        document.body.style.overflow = 'hidden';
        root.addEventListener('click', function (e) {
            if (e.target === root) closeLegalModal();
        });
        var btn = root.querySelector('.tm-legal-modal-close');
        if (btn) btn.addEventListener('click', closeLegalModal);
        document.addEventListener('keydown', function onEsc(ev) {
            if (ev.key === 'Escape') {
                closeLegalModal();
                document.removeEventListener('keydown', onEsc);
            }
        });
    }

    function toast(msg, type) {
        if (global.TM_UI && typeof global.TM_UI.toast === 'function') {
            global.TM_UI.toast(msg, type || 'warning');
            return;
        }
        if (typeof global.showModal === 'function') {
            global.showModal(msg, true);
        }
    }

    function bindLegalLinks(scope) {
        scope = scope || document;
        scope.querySelectorAll('[data-tm-legal="service"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                showAgreement('service');
            });
        });
        scope.querySelectorAll('[data-tm-legal="privacy"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                showAgreement('privacy');
            });
        });
    }

    function initRegisterCompliance() {
        var cb = document.getElementById('tmAgreeTerms');
        var btn = document.getElementById('registerSubmitBtn');
        if (!cb || !btn) return;
        function syncBtn() {
            btn.disabled = !cb.checked;
        }
        cb.addEventListener('change', syncBtn);
        syncBtn();
        global.tmRegisterTermsAccepted = function () {
            return !!cb.checked;
        };
    }

    global.TM_Legal = {
        showAgreement: showAgreement,
        bindLegalLinks: bindLegalLinks,
        initRegisterCompliance: initRegisterCompliance,
        toastTermsRequired: function () {
            toast('请先阅读并同意相关协议', 'warning');
        }
    };

    global.TM_UI = global.TM_UI || {};
    global.TM_UI.showLegalModal = showAgreement;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bindLegalLinks(document);
            initRegisterCompliance();
        });
    } else {
        bindLegalLinks(document);
        initRegisterCompliance();
    }
})(typeof window !== 'undefined' ? window : this);
