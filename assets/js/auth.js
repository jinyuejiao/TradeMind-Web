// 配置常量
const TOKEN_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时

// 公共 HTML 模板常量
const LOGO_TEMPLATE = '<div class="h-16 flex items-center px-6 border-b border-slate-800">' +
    '<div class="w-10 h-10 bg-[#14B8A6] rounded-xl flex items-center justify-center mr-3 text-white shadow-lg shadow-[#14B8A6]/20">' +
        '<i class="ph ph-brain text-xl"></i>' +
    '</div>' +
    '<span class="text-white text-lg font-bold tracking-wider">TradeMind</span>' +
'</div>';

const USER_SECTION_TEMPLATE = '<div class="p-4 border-t border-slate-800 bg-slate-900 mt-auto flex items-center cursor-pointer transition-all hover:bg-slate-800" onclick="openSubscriptionModal()">' +
    '<div class="w-10 h-10 rounded-full bg-slate-800 text-[#14B8A6] border-2 border-[#14B8A6] flex items-center justify-center text-xs font-bold font-mono" id="sidebar-user-avatar">AD</div>' +
    '<div class="ml-3 text-left">' +
        '<p class="text-xs font-bold text-slate-200" id="sidebar-user-name">用户 (角色)</p>' +
        '<div class="flex items-center gap-1.5 mt-1">' +
            '<i class="ph ph-crown text-[#14B8A6] text-[10px]"></i>' +
            '<span class="text-[#14B8A6] text-[10px] font-bold">试用版本</span>' +
        '</div>' +
    '</div>' +
'</div>';


const MODAL_TEMPLATE = '<!-- ================= [会员订阅中心弹窗] ================= -->' +
'<div id="subscription-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 modal-blur">' +
'    <div class="absolute inset-0" onclick="closeSubscriptionModal()"></div>' +
'    <div class="relative bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[95vh] rounded-none md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col fade-in modal-content-box text-left">' +
'        <!-- 头部 -->' +
'        <div class="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">' +
'            <div class="flex items-center gap-3">' +
'                <div class="w-10 h-10 bg-[#14B8A6] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#14B8A6]/30">' +
'                    <i class="ph ph-brain text-xl"></i>' +
'                </div>' +
'                <div>' +
'                    <h2 class="text-sm font-black text-slate-800 tracking-tight">TradeMind 会员中心</h2>' +
'                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Subscription Protocol v1.9</p>' +
'                </div>' +
'            </div>' +
'            <button onclick="closeSubscriptionModal()" class="p-2 hover:bg-slate-100 rounded-full transition-colors"><i class="ph ph-x text-xl text-slate-400"></i></button>' +
'        </div>' +
'        <!-- 主体内容：适配单屏展示 -->' +
'        <div class="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar space-y-6">' +
'            <!-- 订阅等级对比 -->' +
'            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
'                <!-- 试用版卡片 -->' +
'                <div class="p-5 rounded-[2rem] border border-slate-200 bg-slate-50 relative flex flex-col justify-between">' +
'                    <div>' +
'                        <span class="absolute top-4 right-8 text-[9px] font-black text-slate-300 uppercase tracking-widest">Current Plan</span>' +
'                        <h4 class="text-base font-bold text-slate-600">基础试用版</h4>' +
'                        <div class="mt-4 space-y-2 text-[11px] text-slate-500 border-l-2 border-slate-200 pl-3">' +
'                            <p class="flex items-center gap-2"><i class="ph ph-user"></i> 1位 管理员账号</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-package"></i> 100个 产品SKU限制</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-users-three"></i> 100个 客户档案上限</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-warehouse"></i> 10个 供应商配额</p>' +
'                        </div>' +
'                    </div>' +
'                    <div class="mt-6 text-2xl font-mono font-black text-slate-400">¥ 0</div>' +
'                </div>' +
'                <!-- 普通会员卡片：凸显 888 与 3.7折 -->' +
'                <div class="p-6 rounded-[2rem] border-4 border-[#14B8A6] bg-white shadow-2xl relative overflow-hidden group flex flex-col justify-between transition-all hover:-translate-y-1">' +
'                    <!-- 3.7折 飘带 -->' +
'                    <div class="absolute -right-14 top-8 rotate-45 discount-ribbon text-white text-[11px] font-black py-2 px-16 shadow-lg uppercase tracking-tighter">' +
'                        首发 3.7 折' +
'                    </div>' +
'                    <div>' +
'                        <p class="text-[9px] font-black text-[#14B8A6] uppercase tracking-widest mb-1">Recommended</p>' +
'                        <h4 class="text-xl font-black text-slate-900 flex items-center gap-2">普通会员订阅 <i class="ph ph-seal-check-fill text-[#14B8A6]"></i></h4>' +
'                        <div class="mt-4 space-y-2 text-[11px] text-slate-800 font-bold">' +
'                            <p class="flex items-center gap-2"><i class="ph ph-users-four text-[#14B8A6] text-base"></i> 5个 不同角色子账号</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-package text-[#14B8A6] text-base"></i> 1000个 产品数量管理</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-address-book text-[#14B8A6] text-base"></i> 1000个 客户管理权限</p>' +
'                            <p class="flex items-center gap-2"><i class="ph ph-warehouse text-[#14B8A6] text-base"></i> 100个 供应商管理</p>' +
'                        </div>' +
'                    </div>' +
'                    <div class="mt-6 pt-4 border-t border-slate-50 flex items-end justify-between">' +
'                        <div>' +
'                            <p class="text-[10px] text-slate-300 line-through font-bold italic">原价 ¥2388</p>' +
'                            <div class="flex items-baseline gap-1">' +
'                                <span class="text-5xl font-mono font-black text-[#14B8A6] tracking-tighter">¥888</span>' +
'                                <span class="text-[10px] font-bold text-slate-400 uppercase">/ Year</span>' +
'                            </div>' +
'                        </div>' +
'                        <button class="mb-1 px-8 py-3 bg-[#14B8A6] text-white rounded-xl font-black text-xs shadow-xl shadow-[#14B8A6]/30 hover:bg-[#0D9488] transition-all active:scale-95">立即升级</button>' +
'                    </div>' +
'                </div>' +
'            </div>' +
'            <!-- 2. 推荐官计划 (保留金色 UI) -->' +
'            <div class="gold-referral-card rounded-[2rem] p-5 relative overflow-hidden shadow-sm">' +
'                <div class="absolute -right-8 -top-8 opacity-10 rotate-12"><i class="ph ph-medal text-[10rem] text-amber-600"></i></div>' +
'                <div class="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">' +
'                    <div class="flex items-center gap-4">' +
'                        <div class="w-12 h-12 bg-white/50 rounded-full flex items-center justify-center text-amber-700 shrink-0 shadow-sm"><i class="ph ph-users-plus text-2xl"></i></div>' +
'                        <div class="text-left">' +
'                            <h3 class="text-base font-black text-amber-900 flex items-center gap-2">巨猿推荐官计划 <i class="ph ph-sparkle-fill text-amber-500 text-xs"></i></h3>' +
'                            <p class="text-[11px] text-amber-800 leading-tight">每成功邀请一位用户订阅，立返 <span class="font-black text-amber-900 underline decoration-amber-400">¥ 100</span> 现金奖励。</p>' +
'                        </div>' +
'                    </div>' +
'                    <div class="flex items-center gap-3 w-full md:w-auto">' +
'                        <div class="bg-white/70 backdrop-blur-sm px-5 py-2 rounded-xl border border-amber-300 text-center flex-1 md:flex-none">' +
'                            <p class="text-[8px] font-black text-amber-700 uppercase tracking-widest mb-1">专属推荐码</p>' +
'                            <p id="referral-code" class="text-lg font-mono font-black text-amber-900 tracking-tighter">TM-100001</p>' +
'                        </div>' +
'                        <button onclick="showPoster()" class="px-6 py-4 bg-amber-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-amber-700 active:scale-95 transition-all">' +
'                            <i class="ph ph-image-square-bold text-lg"></i> 生成海报' +
'                        </button>' +
'                    </div>' +
'                </div>' +
'            </div>' +
'        </div>' +
'        <div class="p-4 bg-slate-50 border-t border-slate-100 text-center"><p class="text-[9px] text-slate-300 font-bold uppercase tracking-widest">TradeMind Security & Billing Terminal</p></div>' +
'    </div>' +
'</div>' +
'<!-- ================= [2. 品牌推荐海报弹窗] ================= -->' +
'<div id="poster-modal" class="fixed inset-0 z-[100] flex items-center justify-center hidden p-4">' +
'    <!-- 遮罩 -->' +
'    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closePoster()"></div>' +
'    <!-- 弹窗主体 (已移除左侧，仅保留推荐页，宽度调整为 max-w-lg) -->' +
'    <div class="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[460px] overflow-hidden relative z-10 animate-in fade-in zoom-in duration-300">' +
'        <!-- 关闭按钮 -->' +
'        <button onclick="closePoster()" class="absolute top-6 right-6 text-slate-400 hover:text-slate-900 z-20 transition-colors">' +
'            <i class="ph ph-x text-2xl font-bold"></i>' +
'        </button>' +
'        <!-- 推荐海报区域 -->' +
'        <div class="w-full bg-white p-6 md:p-8 flex flex-col items-center">' +
'            <div class="text-center mb-6">' +
'                <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">专属推荐海报</h3>' +
'                <p class="text-xs text-slate-500 mt-1">分享您的专属名片，邀好友加入</p>' +
'            </div>' +
'            <!-- 海报快照区域 (html2canvas 将截取此处) -->' +
'            <div id="poster-capture-area" class="w-full p-2 bg-white rounded-[2.8rem] shadow-xl">' +
'                <!-- 海报主体：内联样式确保渐变生效 -->' +
'                <div class="w-full aspect-[3/4.2] rounded-[2.2rem] p-8 flex flex-col relative overflow-hidden text-white" style="background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%);">' +
'                    <!-- 装饰光晕 -->' +
'                    <div class="absolute top-[-10%] right-[-10%] w-40 h-40 bg-white/20 rounded-full blur-[40px]"></div>' +
'                    <div class="absolute bottom-[20%] left-[-20%] w-32 h-32 bg-teal-300/20 rounded-full blur-[30px]"></div>' +
'                    <!-- Header -->' +
'                    <div class="flex items-center gap-2 mb-8 relative z-10">' +
'                        <div class="bg-white/20 backdrop-blur-md p-1.5 rounded-lg border border-white/30">' +
'                            <i class="ph ph-intersect text-white text-lg"></i>' +
'                        </div>' +
'                        <span class="text-sm font-black tracking-tighter uppercase italic">TradeMind AI</span>' +
'                    </div>' +
'                    <!-- Slogan -->' +
'                    <h4 class="text-2xl font-bold leading-tight mb-8 relative z-10">' +
'                        重塑商贸效率<br>' +
'                        <span style="color: #99f6e4;">AI 驱动经营决策</span>' +
'                    </h4>' +
'                    <!-- 功能列表 -->' +
'                    <div class="space-y-3 mb-auto relative z-10">' +
'                        <div class="flex items-center gap-2 text-[10px] font-medium text-white/90">' +
'                            <i class="ph ph-sparkle-fill text-yellow-300"></i> 多模态订单自动提取' +
'                        </div>' +
'                        <div class="flex items-center gap-2 text-[10px] font-medium text-white/90">' +
'                            <i class="ph ph-sparkle-fill text-yellow-300"></i> 数字化供应链智能预警' +
'                        </div>' +
'                        <div class="flex items-center gap-2 text-[10px] font-medium text-white/90">' +
'                            <i class="ph ph-sparkle-fill text-yellow-300"></i> 全量多租户经营看板' +
'                        </div>' +
'                    </div>' +
'                    <!-- 推荐码卡片区域 (毛玻璃效果内联实现) -->' +
'                    <div class="mt-8 p-4 rounded-[1.5rem] flex items-center justify-between relative z-10" style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2);">' +
'                        <div>' +
'                            <p class="text-[8px] text-white/60 uppercase tracking-widest mb-0.5 font-bold">我的专属推荐码</p>' +
'                            <p id="poster-ref-code" class="text-xl font-bold text-white" style="font-family: \"Space Grotesk\", monospace; letter-spacing: 0.05em;">TM-100001</p>' +
'                        </div>' +
'                        <div class="bg-white p-1.5 rounded-xl shadow-lg">' +
'                            <!-- 动态二维码 -->' +
'                            <img id="poster-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=TradeMind-TM100001" class="w-10 h-10" alt="QR">' +
'                        </div>' +
'                    </div>' +
'                </div>' +
'            </div>' +
'            <div class="mt-6 text-center">' +
'                <p class="text-[11px] text-slate-400 leading-relaxed">' +
'                    邀请好友注册，双方立享 <span class="text-teal-600 font-bold">15天 专业版</span> 奖励' +
'                </p>' +
'                <!-- 生成并保存海报按钮 -->' +
'                <button onclick="downloadPoster()" class="flex items-center gap-2 text-teal-600 text-xs font-black mt-4 hover:text-teal-700 transition-colors group mx-auto">' +
'                    <i class="ph ph-download-simple-bold text-lg group-hover:translate-y-0.5 transition-transform"></i>' +
'                    保存高清海报到相册' +
'                </button>' +
'            </div>' +
'        </div>' +
'    </div>' +
'</div>'


// MD5加密函数
function md5Hash(string) {
    // 使用Web Crypto API实现MD5加密
    const crypto = window.crypto || window.msCrypto;
    if (!crypto || !crypto.subtle) {
        // 降级方案：使用MD5算法的纯JavaScript实现
        function md5(str) {
            function rotateLeft(n, s) {
                return (n << s) | (n >>> (32 - s));
            }
            function addUnsigned(x, y) {
                let lsw = (x & 0xffff) + (y & 0xffff);
                let msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                return (msw << 16) | (lsw & 0xffff);
            }
            function F(x, y, z) {
                return (x & y) | ((~x) & z);
            }
            function G(x, y, z) {
                return (x & z) | (y & (~z));
            }
            function H(x, y, z) {
                return x ^ y ^ z;
            }
            function I(x, y, z) {
                return y ^ (x | (~z));
            }
            function FF(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
            }
            function GG(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
            }
            function HH(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
            }
            function II(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
            }
            function convertToWordArray(str) {
                let wa = [], i;
                for (i = 0; i < str.length * 8; i += 8) {
                    wa[i >> 5] |= (str.charCodeAt(i / 8) & 0xff) << (24 - i % 32);
                }
                wa[i >> 5] |= 0x80 << (24 - i % 32);
                wa[(((i + 64) >>> 9) << 4) + 14] = str.length * 8;
                return wa;
            }
            function wordToHex(l) {
                let hexTab = '0123456789abcdef';
                let str = '';
                for (let i = 0; i <= 3; i++) {
                    str += hexTab.charAt((l >> (i * 8 + 4)) & 0x0f) + hexTab.charAt((l >> (i * 8)) & 0x0f);
                }
                return str;
            }
            function utf8Encode(str) {
                str = str.replace(/\r\n/g, '\n');
                let utftext = '';
                for (let n = 0; n < str.length; n++) {
                    let c = str.charCodeAt(n);
                    if (c < 128) {
                        utftext += String.fromCharCode(c);
                    } else if ((c > 127) && (c < 2048)) {
                        utftext += String.fromCharCode((c >> 6) | 192);
                        utftext += String.fromCharCode((c & 63) | 128);
                    } else {
                        utftext += String.fromCharCode((c >> 12) | 224);
                        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                        utftext += String.fromCharCode((c & 63) | 128);
                    }
                }
                return utftext;
            }
            let x = [], a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, olda, oldb, oldc, oldd, i;
            str = utf8Encode(str);
            x = convertToWordArray(str);
            for (i = 0; i < x.length; i += 16) {
                olda = a; oldb = b; oldc = c; oldd = d;
                a = FF(a, b, c, d, x[i + 0], 7, -680876936);
                d = FF(d, a, b, c, x[i + 1], 12, -389564586);
                c = FF(c, d, a, b, x[i + 2], 17, 606105819);
                b = FF(b, c, d, a, x[i + 3], 22, -1044525330);
                a = FF(a, b, c, d, x[i + 4], 7, -176418897);
                d = FF(d, a, b, c, x[i + 5], 12, 1200080426);
                c = FF(c, d, a, b, x[i + 6], 17, -1473231341);
                b = FF(b, c, d, a, x[i + 7], 22, -45705983);
                a = FF(a, b, c, d, x[i + 8], 7, 1770035416);
                d = FF(d, a, b, c, x[i + 9], 12, -1958414417);
                c = FF(c, d, a, b, x[i + 10], 17, -42063);
                b = FF(b, c, d, a, x[i + 11], 22, -1990404162);
                a = FF(a, b, c, d, x[i + 12], 7, 1804603682);
                d = FF(d, a, b, c, x[i + 13], 12, -40341101);
                c = FF(c, d, a, b, x[i + 14], 17, -1502002290);
                b = FF(b, c, d, a, x[i + 15], 22, 1236535329);
                a = GG(a, b, c, d, x[i + 1], 5, -165796510);
                d = GG(d, a, b, c, x[i + 6], 9, -1069501632);
                c = GG(c, d, a, b, x[i + 11], 14, 643717713);
                b = GG(b, c, d, a, x[i + 0], 20, -373897302);
                a = GG(a, b, c, d, x[i + 5], 5, -701558691);
                d = GG(d, a, b, c, x[i + 10], 9, 38016083);
                c = GG(c, d, a, b, x[i + 15], 14, -660478335);
                b = GG(b, c, d, a, x[i + 4], 20, -405537848);
                a = GG(a, b, c, d, x[i + 9], 5, 568446438);
                d = GG(d, a, b, c, x[i + 14], 9, -1019803690);
                c = GG(c, d, a, b, x[i + 3], 14, -187363961);
                b = GG(b, c, d, a, x[i + 8], 20, 1163531501);
                a = GG(a, b, c, d, x[i + 13], 5, -1444681467);
                d = GG(d, a, b, c, x[i + 2], 9, -51403784);
                c = GG(c, d, a, b, x[i + 7], 14, 1735328473);
                b = GG(b, c, d, a, x[i + 12], 20, -1926607734);
                a = HH(a, b, c, d, x[i + 5], 4, -378558);
                d = HH(d, a, b, c, x[i + 8], 11, -2022574463);
                c = HH(c, d, a, b, x[i + 11], 16, 1839030562);
                b = HH(b, c, d, a, x[i + 14], 23, -35309556);
                a = HH(a, b, c, d, x[i + 1], 4, -1530992060);
                d = HH(d, a, b, c, x[i + 4], 11, 1272893353);
                c = HH(c, d, a, b, x[i + 7], 16, -155497632);
                b = HH(b, c, d, a, x[i + 10], 23, -1094730640);
                a = HH(a, b, c, d, x[i + 13], 4, 681279174);
                d = HH(d, a, b, c, x[i + 0], 11, -358537222);
                c = HH(c, d, a, b, x[i + 3], 16, -722521979);
                b = HH(b, c, d, a, x[i + 6], 23, 76029189);
                a = HH(a, b, c, d, x[i + 9], 4, -640364487);
                d = HH(d, a, b, c, x[i + 12], 11, -421815835);
                c = HH(c, d, a, b, x[i + 15], 16, 530742520);
                b = HH(b, c, d, a, x[i + 2], 23, -995338651);
                a = II(a, b, c, d, x[i + 0], 6, -198630844);
                d = II(d, a, b, c, x[i + 7], 10, 1126891415);
                c = II(c, d, a, b, x[i + 14], 15, -1416354905);
                b = II(b, c, d, a, x[i + 5], 21, -57434055);
                a = II(a, b, c, d, x[i + 12], 6, 1700485571);
                d = II(d, a, b, c, x[i + 3], 10, -1894986606);
                c = II(c, d, a, b, x[i + 10], 15, -1051523);
                b = II(b, c, d, a, x[i + 1], 21, -2054922799);
                a = II(a, b, c, d, x[i + 8], 6, 1873313359);
                d = II(d, a, b, c, x[i + 15], 10, -30611744);
                c = II(c, d, a, b, x[i + 6], 15, -1560198380);
                b = II(b, c, d, a, x[i + 13], 21, 1309151649);
                a = II(a, b, c, d, x[i + 4], 6, -145523070);
                d = II(d, a, b, c, x[i + 11], 10, -1120210379);
                c = II(c, d, a, b, x[i + 2], 15, 718787259);
                b = II(b, c, d, a, x[i + 9], 21, -343485551);
                a = addUnsigned(a, olda);
                b = addUnsigned(b, oldb);
                c = addUnsigned(c, oldc);
                d = addUnsigned(d, oldd);
            }
            return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
        }
        return md5(string);
    }
    
    // 使用Web Crypto API的MD5实现（如果支持）
    const encoder = new TextEncoder();
    const data = encoder.encode(string);
    
    return crypto.subtle.digest('MD5', data)
        .then(buffer => {
            const hashArray = Array.from(new Uint8Array(buffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        })
        .catch(() => {
            // 如果MD5不支持，使用降级方案
            function md5(str) {
                function rotateLeft(n, s) {
                    return (n << s) | (n >>> (32 - s));
                }
                function addUnsigned(x, y) {
                    let lsw = (x & 0xffff) + (y & 0xffff);
                    let msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                    return (msw << 16) | (lsw & 0xffff);
                }
                function F(x, y, z) {
                    return (x & y) | ((~x) & z);
                }
                function G(x, y, z) {
                    return (x & z) | (y & (~z));
                }
                function H(x, y, z) {
                    return x ^ y ^ z;
                }
                function I(x, y, z) {
                    return y ^ (x | (~z));
                }
                function FF(a, b, c, d, x, s, ac) {
                    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
                    return addUnsigned(rotateLeft(a, s), b);
                }
                function GG(a, b, c, d, x, s, ac) {
                    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
                    return addUnsigned(rotateLeft(a, s), b);
                }
                function HH(a, b, c, d, x, s, ac) {
                    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
                    return addUnsigned(rotateLeft(a, s), b);
                }
                function II(a, b, c, d, x, s, ac) {
                    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
                    return addUnsigned(rotateLeft(a, s), b);
                }
                function convertToWordArray(str) {
                    let wa = [], i;
                    for (i = 0; i < str.length * 8; i += 8) {
                        wa[i >> 5] |= (str.charCodeAt(i / 8) & 0xff) << (24 - i % 32);
                    }
                    wa[i >> 5] |= 0x80 << (24 - i % 32);
                    wa[(((i + 64) >>> 9) << 4) + 14] = str.length * 8;
                    return wa;
                }
                function wordToHex(l) {
                    let hexTab = '0123456789abcdef';
                    let str = '';
                    for (let i = 0; i <= 3; i++) {
                        str += hexTab.charAt((l >> (i * 8 + 4)) & 0x0f) + hexTab.charAt((l >> (i * 8)) & 0x0f);
                    }
                    return str;
                }
                function utf8Encode(str) {
                    str = str.replace(/\r\n/g, '\n');
                    let utftext = '';
                    for (let n = 0; n < str.length; n++) {
                        let c = str.charCodeAt(n);
                        if (c < 128) {
                            utftext += String.fromCharCode(c);
                        } else if ((c > 127) && (c < 2048)) {
                            utftext += String.fromCharCode((c >> 6) | 192);
                            utftext += String.fromCharCode((c & 63) | 128);
                        } else {
                            utftext += String.fromCharCode((c >> 12) | 224);
                            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                            utftext += String.fromCharCode((c & 63) | 128);
                        }
                    }
                    return utftext;
                }
                let x = [], a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, olda, oldb, oldc, oldd, i;
                str = utf8Encode(str);
                x = convertToWordArray(str);
                for (i = 0; i < x.length; i += 16) {
                    olda = a; oldb = b; oldc = c; oldd = d;
                    a = FF(a, b, c, d, x[i + 0], 7, -680876936);
                    d = FF(d, a, b, c, x[i + 1], 12, -389564586);
                    c = FF(c, d, a, b, x[i + 2], 17, 606105819);
                    b = FF(b, c, d, a, x[i + 3], 22, -1044525330);
                    a = FF(a, b, c, d, x[i + 4], 7, -176418897);
                    d = FF(d, a, b, c, x[i + 5], 12, 1200080426);
                    c = FF(c, d, a, b, x[i + 6], 17, -1473231341);
                    b = FF(b, c, d, a, x[i + 7], 22, -45705983);
                    a = FF(a, b, c, d, x[i + 8], 7, 1770035416);
                    d = FF(d, a, b, c, x[i + 9], 12, -1958414417);
                    c = FF(c, d, a, b, x[i + 10], 17, -42063);
                    b = FF(b, c, d, a, x[i + 11], 22, -1990404162);
                    a = FF(a, b, c, d, x[i + 12], 7, 1804603682);
                    d = FF(d, a, b, c, x[i + 13], 12, -40341101);
                    c = FF(c, d, a, b, x[i + 14], 17, -1502002290);
                    b = FF(b, c, d, a, x[i + 15], 22, 1236535329);
                    a = GG(a, b, c, d, x[i + 1], 5, -165796510);
                    d = GG(d, a, b, c, x[i + 6], 9, -1069501632);
                    c = GG(c, d, a, b, x[i + 11], 14, 643717713);
                    b = GG(b, c, d, a, x[i + 0], 20, -373897302);
                    a = GG(a, b, c, d, x[i + 5], 5, -701558691);
                    d = GG(d, a, b, c, x[i + 10], 9, 38016083);
                    c = GG(c, d, a, b, x[i + 15], 14, -660478335);
                    b = GG(b, c, d, a, x[i + 4], 20, -405537848);
                    a = GG(a, b, c, d, x[i + 9], 5, 568446438);
                    d = GG(d, a, b, c, x[i + 14], 9, -1019803690);
                    c = GG(c, d, a, b, x[i + 3], 14, -187363961);
                    b = GG(b, c, d, a, x[i + 8], 20, 1163531501);
                    a = GG(a, b, c, d, x[i + 13], 5, -1444681467);
                    d = GG(d, a, b, c, x[i + 2], 9, -51403784);
                    c = GG(c, d, a, b, x[i + 7], 14, 1735328473);
                    b = GG(b, c, d, a, x[i + 12], 20, -1926607734);
                    a = HH(a, b, c, d, x[i + 5], 4, -378558);
                    d = HH(d, a, b, c, x[i + 8], 11, -2022574463);
                    c = HH(c, d, a, b, x[i + 11], 16, 1839030562);
                    b = HH(b, c, d, a, x[i + 14], 23, -35309556);
                    a = HH(a, b, c, d, x[i + 1], 4, -1530992060);
                    d = HH(d, a, b, c, x[i + 4], 11, 1272893353);
                    c = HH(c, d, a, b, x[i + 7], 16, -155497632);
                    b = HH(b, c, d, a, x[i + 10], 23, -1094730640);
                    a = HH(a, b, c, d, x[i + 13], 4, 681279174);
                    d = HH(d, a, b, c, x[i + 0], 11, -358537222);
                    c = HH(c, d, a, b, x[i + 3], 16, -722521979);
                    b = HH(b, c, d, a, x[i + 6], 23, 76029189);
                    a = HH(a, b, c, d, x[i + 9], 4, -640364487);
                    d = HH(d, a, b, c, x[i + 12], 11, -421815835);
                    c = HH(c, d, a, b, x[i + 15], 16, 530742520);
                    b = HH(b, c, d, a, x[i + 2], 23, -995338651);
                    a = II(a, b, c, d, x[i + 0], 6, -198630844);
                    d = II(d, a, b, c, x[i + 7], 10, 1126891415);
                    c = II(c, d, a, b, x[i + 14], 15, -1416354905);
                    b = II(b, c, d, a, x[i + 5], 21, -57434055);
                    a = II(a, b, c, d, x[i + 12], 6, 1700485571);
                    d = II(d, a, b, c, x[i + 3], 10, -1894986606);
                    c = II(c, d, a, b, x[i + 10], 15, -1051523);
                    b = II(b, c, d, a, x[i + 1], 21, -2054922799);
                    a = II(a, b, c, d, x[i + 8], 6, 1873313359);
                    d = II(d, a, b, c, x[i + 15], 10, -30611744);
                    c = II(c, d, a, b, x[i + 6], 15, -1560198380);
                    b = II(b, c, d, a, x[i + 13], 21, 1309151649);
                    a = II(a, b, c, d, x[i + 4], 6, -145523070);
                    d = II(d, a, b, c, x[i + 11], 10, -1120210379);
                    c = II(c, d, a, b, x[i + 2], 15, 718787259);
                    b = II(b, c, d, a, x[i + 9], 21, -343485551);
                    a = addUnsigned(a, olda);
                    b = addUnsigned(b, oldb);
                    c = addUnsigned(c, oldc);
                    d = addUnsigned(d, oldd);
                }
                return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
            }
            return md5(string);
        });
}

// 显示风格一致的弹窗
function showModal(message, isError = false) {
    // 创建弹窗元素
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.animation = 'fadeIn 0.3s ease-in-out';
    
    // 创建弹窗内容
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.borderRadius = '12px';
    modalContent.style.padding = '24px';
    modalContent.style.maxWidth = '400px';
    modalContent.style.width = '90%';
    modalContent.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
    modalContent.style.animation = 'slideUp 0.3s ease-in-out';
    
    // 创建消息元素
    const messageElement = document.createElement('p');
    // 使用与登录界面一致的颜色
    messageElement.style.color = '#1E293B'; // 与登录界面的文本颜色一致
    messageElement.style.fontSize = '16px';
    messageElement.style.textAlign = 'center';
    messageElement.style.marginBottom = '24px';
    messageElement.style.fontWeight = '500';
    messageElement.style.fontFamily = 'Inter, -apple-system, Microsoft YaHei, sans-serif'; // 与登录界面的字体一致
    messageElement.textContent = message;
    
    // 创建按钮元素
    const button = document.createElement('button');
    // 使用与登录界面一致的按钮颜色
    button.style.backgroundColor = '#0D9488'; // 与登录界面的按钮颜色一致
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '8px';
    button.style.padding = '12px 32px'; // 与登录界面的按钮大小一致
    button.style.fontSize = '14px';
    button.style.fontWeight = '600';
    button.style.cursor = 'pointer';
    button.style.display = 'block';
    button.style.margin = '0 auto';
    button.style.transition = 'background-color 0.2s ease';
    button.style.fontFamily = 'Inter, -apple-system, Microsoft YaHei, sans-serif'; // 与登录界面的字体一致
    button.textContent = '确定';
    
    button.addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    button.addEventListener('mouseenter', function() {
        button.style.opacity = '0.9';
    });
    
    button.addEventListener('mouseleave', function() {
        button.style.opacity = '1';
    });
    
    // 添加元素到弹窗
    modalContent.appendChild(messageElement);
    modalContent.appendChild(button);
    modal.appendChild(modalContent);
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }";
    document.head.appendChild(style);
    
    // 添加弹窗到页面
    document.body.appendChild(modal);
}


// 从环境变量读取配置的工具函数
function getApiUrl(serviceName) {
    // 所有服务都通过网关访问
    return 'http://localhost:8080';
}

// 获取登录页面路径
function getLoginPath() {
    // 返回相对于当前页面的正确路径，确保在任何页面调用时都能正确跳转到登录页面
    const currentPath = window.location.pathname;
    // 计算需要向上返回的层级数
    const pathParts = currentPath.split('/').filter(part => part !== '');
    const backLevels = pathParts.length > 0 ? pathParts.length - 1 : 0;
    // 构建返回登录页面的路径
    let loginPath = '';
    for (let i = 0; i < backLevels; i++) {
        loginPath += '../';
    }
    loginPath += 'login.html';
    return loginPath;
}

// 获取工作台页面路径
function getDashboardPath() {
    // 返回相对于当前页面的正确路径
    const currentPath = window.location.pathname;
    // 计算需要向上返回的层级数
    const pathParts = currentPath.split('/').filter(part => part !== '');
    const backLevels = pathParts.length > 0 ? pathParts.length - 1 : 0;
    // 构建返回工作台页面的路径
    let dashboardPath = '';
    for (let i = 0; i < backLevels; i++) {
        dashboardPath += '../';
    }
    dashboardPath += 'modules/dashboard/dashboard.html';
    return dashboardPath;
}

// 检查localStorage是否可用
function checkLocalStorage() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('localStorage不可用，请关闭"无痕模式"或"严苛的跟踪保护"');
        return false;
    }
}

// 全局logout函数
function logout() {
    console.log('执行全局logout操作');
    // 清除localStorage中的认证信息
    try {
        if (checkLocalStorage()) {
            localStorage.removeItem('token');
            localStorage.removeItem('login_timestamp');
            localStorage.removeItem('user_info');
            localStorage.removeItem('username');
            localStorage.removeItem('currentUser');
            console.log('已清空本地存储中的认证信息');
        }
    } catch (error) {
        console.error('清除localStorage时发生错误:', error);
    }
    // 重定向到登录页面（使用绝对路径，防止加入历史记录堆栈）
    window.location.replace('/login.html');
}

// 检查认证状态
function checkAuth() {
    console.log('========== 开始检查认证状态 ==========');
    
    // 规范化路径判断
    const path = window.location.pathname;
    console.log('当前路径:', path);
    
    // 更健壮的登录页面判断
    const isLoginPage = path.endsWith('login.html');
    console.log('当前是否为登录页面:', isLoginPage);
    
    // 首先检查localStorage是否可用
    console.log('步骤1: 检查localStorage是否可用');
    if (!checkLocalStorage()) {
        console.log('❌ localStorage不可用');
        if (!isLoginPage) {
            console.log('未登录，跳转至登录页');
            window.location.replace('/login.html');
        }
        return false;
    }
    console.log('✅ localStorage可用');
    
    try {
        console.log('步骤2: 获取token');
        const token = localStorage.getItem('token');
        console.log('获取到的token:', token ? '存在' : '不存在');
        
        // 核心重定向逻辑
        if (!token || token.trim() === '' || token === 'null' || token === 'undefined') {
            console.log('❌ Token不存在或无效');
            if (!isLoginPage) {
                console.log('未登录，跳转至登录页');
                window.location.replace('/login.html');
            }
            return false;
        }
        
        if (token && isLoginPage) {
            console.log('已登录，跳转至工作台');
            window.location.replace('/modules/dashboard/dashboard.html');
            return false;
        }
        
        console.log('✅ Token存在且当前页面正确');
        
        // 尝试解析token，检查是否损坏
        try {
            // 这里可以添加token解析逻辑，例如JWT解析
            // 如果解析失败，会抛出异常
            console.log('✅ Token解析成功');
        } catch (tokenError) {
            console.error('❌ Token解析失败，可能已损坏:', tokenError);
            // 清除损坏的token
            if (checkLocalStorage()) {
                localStorage.removeItem('token');
                localStorage.removeItem('login_timestamp');
                localStorage.removeItem('user_info');
                localStorage.removeItem('username');
                localStorage.removeItem('currentUser');
                console.log('已清除损坏的token');
            }
            if (!isLoginPage) {
                console.log('未登录，跳转至登录页');
                window.location.replace('/login.html');
            }
            return false;
        }
        
        // 检查token是否为mock-token且非开发模式
        console.log('步骤3: 检查token是否为mock-token');
        const isDevMode = (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
        console.log('当前是否为开发模式:', isDevMode);
        if (token === 'mock-token' && !isDevMode) {
            console.log('❌ Mock token在非开发模式下无效');
            if (checkLocalStorage()) {
                localStorage.removeItem('token');
                localStorage.removeItem('login_timestamp');
                localStorage.removeItem('user_info');
                localStorage.removeItem('username');
                localStorage.removeItem('currentUser');
                console.log('已清除无效的mock token');
            }
            if (!isLoginPage) {
                console.log('未登录，跳转至登录页');
                window.location.replace('/login.html');
            }
            return false;
        }
        console.log('✅ Token验证通过');
        
        // 检查token是否过期
        console.log('步骤4: 检查token是否过期');
        const loginTimestamp = localStorage.getItem('login_timestamp');
        console.log('获取到的login_timestamp:', loginTimestamp);
        if (loginTimestamp) {
            const currentTime = Date.now();
            const elapsedTime = currentTime - parseInt(loginTimestamp);
            const remainingTime = TOKEN_EXPIRE_TIME - elapsedTime;
            console.log('当前时间:', new Date(currentTime).toLocaleString());
            console.log('登录时间:', new Date(parseInt(loginTimestamp)).toLocaleString());
            console.log('已用时间:', Math.round(elapsedTime / 1000 / 60), '分钟');
            console.log('剩余时间:', Math.round(remainingTime / 1000 / 60), '分钟');
            
            if (elapsedTime > TOKEN_EXPIRE_TIME) {
                console.log('❌ Token已过期');
                if (checkLocalStorage()) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('login_timestamp');
                    localStorage.removeItem('user_info');
                    localStorage.removeItem('username');
                    localStorage.removeItem('currentUser');
                    console.log('已清除过期的token');
                }
                if (!isLoginPage) {
                    console.log('未登录，跳转至登录页');
                    window.location.replace('/login.html');
                }
                return false;
            }
        } else {
            // 没有登录时间戳，视为无效
            console.log('❌ 缺少登录时间戳');
            if (checkLocalStorage()) {
                localStorage.removeItem('token');
                localStorage.removeItem('login_timestamp');
                localStorage.removeItem('user_info');
                localStorage.removeItem('username');
                localStorage.removeItem('currentUser');
                console.log('已清除无效的认证信息');
            }
            if (!isLoginPage) {
                console.log('未登录，跳转至登录页');
                window.location.replace('/login.html');
            }
            return false;
        }
        console.log('✅ Token未过期');
        
        console.log('✅ 认证状态检查通过');
        console.log('========== 认证状态检查完成 ==========');
        return true;
    } catch (error) {
        console.error('❌ 检查认证状态时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        if (checkLocalStorage()) {
            localStorage.removeItem('token');
            localStorage.removeItem('login_timestamp');
            localStorage.removeItem('user_info');
            localStorage.removeItem('username');
            localStorage.removeItem('currentUser');
            console.log('已清除可能损坏的认证信息');
        }
        if (!isLoginPage) {
            console.log('未登录，跳转至登录页');
            window.location.replace('/login.html');
        }
        return false;
    }
}

// 包装fetch函数，自动添加Authorization头并处理401响应
function wrappedFetch(url, options = {}) {
    console.log('========== 开始发送请求 ==========');
    console.log('请求URL:', url);
    console.log('请求选项:', options);
    
    // 首先检查localStorage是否可用
    console.log('步骤1: 检查localStorage是否可用');
    if (!checkLocalStorage()) {
        console.log('❌ localStorage不可用，执行logout');
        logout();
        return Promise.reject(new Error('localStorage不可用'));
    }
    console.log('✅ localStorage可用');
    
    try {
        console.log('步骤2: 获取token');
        const token = localStorage.getItem('token');
        console.log('获取到的token:', token ? '存在' : '不存在');
        
        // 自动添加Authorization头
        console.log('步骤3: 构建请求头');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
            headers['Authorization'] = 'Bearer ' + token;
            console.log('✅ 添加了Authorization头:', headers['Authorization']);
            
            // 从localStorage中获取用户信息并添加租户ID和用户ID到请求头
            try {
                const userInfoStr = localStorage.getItem('user_info');
                if (userInfoStr) {
                    const userInfo = JSON.parse(userInfoStr);
                    if (userInfo.tenantId) {
                        headers['X-Tenant-Id'] = userInfo.tenantId.toString();
                        console.log('✅ 添加了X-Tenant-Id头:', headers['X-Tenant-Id']);
                    }
                    if (userInfo.userId) {
                        headers['X-User-Id'] = userInfo.userId.toString();
                        console.log('✅ 添加了X-User-Id头:', headers['X-User-Id']);
                    }
                }
            } catch (error) {
                console.error('❌ 解析用户信息时发生错误:', error);
            }
        } else {
            console.log('❌ 未添加Authorization头，因为token不存在或为空，跳转到登录页面');
            logout();
            return Promise.reject(new Error('token不存在或为空'));
        }
        console.log('最终请求头:', headers);
        
        // 发送请求
        console.log('步骤4: 发送请求');
        return fetch(url, {
            ...options,
            headers
        }).then(response => {
            console.log('步骤5: 处理响应');
            console.log('响应状态:', response.status);
            console.log('响应状态文本:', response.statusText);
            
            // 处理401响应
            if (response.status === 401) {
                console.log('❌ 收到401响应，执行logout');
                // 先获取响应内容，再执行logout
                return response.json().then(errorData => {
                    console.log('401响应内容:', errorData);
                    logout();
                    throw new Error(errorData.message || '未授权');
                }).catch(() => {
                    logout();
                    throw new Error('未授权');
                });
            }
            console.log('✅ 响应状态正常');
            return response;
        });
    } catch (error) {
        console.error('❌ 创建请求时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        logout();
        return Promise.reject(error);
    }
}

// 跳转异常检测
let lastRedirectTime = 0;
const REDIRECT_THRESHOLD = 1000; // 1秒内连续跳转视为异常

// 检测跳转异常的函数
function detectRedirectLoop() {
    const currentTime = Date.now();
    if (currentTime - lastRedirectTime < REDIRECT_THRESHOLD) {
        console.error('检测到跳转异常，可能存在重定向循环');
        // 清除localStorage
        if (checkLocalStorage()) {
            localStorage.clear();
            console.log('已强制清理localStorage');
        }
        // 重置跳转时间
        lastRedirectTime = 0;
        return true;
    }
    lastRedirectTime = currentTime;
    return false;
}

// 重写window.location.replace方法，添加跳转检测
const originalReplace = window.location.replace;
window.location.replace = function(url) {
    if (!detectRedirectLoop()) {
        originalReplace.call(window.location, url);
    }
};

// 显示通知
function showNotification(message) {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    if (toast && toastText) {
        toastText.textContent = message;
        toast.style.opacity = '1';
        toast.style.pointerEvents = 'auto';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.pointerEvents = 'none';
        }, 3000);
    }
}

// 打开会员订阅弹窗
function openSubscriptionModal() {
    document.getElementById('subscription-modal').classList.remove('hidden');
}

// 关闭会员订阅弹窗
function closeSubscriptionModal() {
    document.getElementById('subscription-modal').classList.add('hidden');
}

// 复制推荐码
function copyReferralCode() {
    const referralCode = document.getElementById('referral-code');
    referralCode.select();
    document.execCommand('copy');
    showNotification('推荐码已复制到剪贴板');
}

// 下载海报
function downloadPoster() {
    const posterPreview = document.getElementById('poster-capture-area');
    if (posterPreview) {
        html2canvas(posterPreview, {
            scale: 2, // 提高清晰度
            useCORS: true, // 允许加载跨域图片
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'trademind-referral-poster.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            showNotification('海报已成功下载');
        }).catch(error => {
            console.error('下载海报失败:', error);
            showNotification('海报下载失败，请重试');
        });
    } else {
        console.error('未找到海报预览元素');
        showNotification('海报元素未找到');
    }
}

// 打开会员中心弹窗
function openMemberModal() {
    document.getElementById('member-modal').classList.remove('hidden');
}

// 关闭会员中心弹窗
function closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
}

// 显示海报弹窗
function showPoster() {
    document.getElementById('poster-modal').classList.remove('hidden');
}

// 关闭海报弹窗
function closePoster() {
    document.getElementById('poster-modal').classList.add('hidden');
}

// 统一注入公共 UI 组件
window.injectCommonUI = function() {
    // 1. Logo 注入
    const logoContainer = document.getElementById('sidebar-logo-container');
    if (logoContainer) {
        logoContainer.innerHTML = LOGO_TEMPLATE;
    }
    
    // 2. 用户信息注入
    const userContainer = document.getElementById('sidebar-user-container');
    if (userContainer) {
        userContainer.innerHTML = USER_SECTION_TEMPLATE;
    }
    
    // 3. 弹窗注入
    if (!document.getElementById('subscription-modal')) {
        document.body.insertAdjacentHTML('beforeend', MODAL_TEMPLATE);
    }
    
    // 4. 动态数据绑定
    loadUserInfo();
};

// 加载用户信息
function loadUserInfo() {
    try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        if (token) {
            // 解析JWT token
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const userName = payload.userName || payload.username || '用户';
                const role = payload.roleType || payload.role || 'USER';
                const userId = payload.userId || '100001';

                // 生成推荐码
                const referralCode = 'TM-' + String(userId).padStart(6, '0');

                // 更新界面元素
                if (document.getElementById('sidebar-user-name')) {
                    document.getElementById('sidebar-user-name').textContent = userName + ' (' + (role === 'ADMIN' ? '管理员' : '操作员') + ')';
                }
                if (document.getElementById('sidebar-user-avatar')) {
                    document.getElementById('sidebar-user-avatar').textContent = userName.substring(0, 2).toUpperCase();
                }
                if (document.getElementById('mobile-user-avatar')) {
                    document.getElementById('mobile-user-avatar').textContent = userName.substring(0, 2).toUpperCase();
                }
                if (document.getElementById('referral-code')) {
                    document.getElementById('referral-code').textContent = referralCode;
                }
                if (document.getElementById('poster-ref-code')) {
                    document.getElementById('poster-ref-code').textContent = referralCode;
                }
                if (document.getElementById('poster-qr')) {
                    document.getElementById('poster-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=TradeMind-${referralCode}`;
                }

                // 更新二维码
                if (document.getElementById('qrcode-img')) {
                    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://trademind.ai/reg?ref=' + referralCode.replace('-', '');
                    document.getElementById('qrcode-img').src = qrCodeUrl;
                }

                // 更新海报上的推荐码
                if (document.getElementById('poster-ref-code')) {
                    document.getElementById('poster-ref-code').textContent = referralCode;
                }
            }
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

// 初始化公共 UI 组件 (保持向后兼容)
window.initCommonUI = function() {
    // 直接调用 injectCommonUI 函数，确保所有页面使用相同的逻辑
    window.injectCommonUI();
};

// 将函数暴露到全局作用域，以便其他页面使用
window.checkAuth = checkAuth;
window.logout = logout;
window.wrappedFetch = wrappedFetch;
window.getApiUrl = getApiUrl;
window.checkLocalStorage = checkLocalStorage;
window.showNotification = showNotification;
window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.copyReferralCode = copyReferralCode;
window.downloadPoster = downloadPoster;
window.loadUserInfo = loadUserInfo;
window.openMemberModal = openMemberModal;
window.closeMemberModal = closeMemberModal;
window.showPoster = showPoster;
window.closePoster = closePoster;
window.initCommonUI = initCommonUI;

// 同步用户上下文信息
window.syncUserContext = function() {
    try {
        // 检查localStorage是否可用
        if (!checkLocalStorage()) {
            console.log('❌ localStorage不可用，无法加载用户信息');
            return;
        }
        
        // 从localStorage获取Token
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        if (token) {
            // 解析JWT token
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const userName = payload.userName || payload.username || '用户';
                const role = payload.roleType || payload.role || 'USER';
                const userId = payload.userId || '100001';
                
                // 生成推荐码
                const referralCode = 'TM-' + String(userId).padStart(6, '0');
                
                // 自动寻找页面中ID为sidebar-user-name和sidebar-user-role的元素并赋值
                if (document.getElementById('sidebar-user-name')) {
                    document.getElementById('sidebar-user-name').textContent = userName + ' (' + (role === 'ADMIN' ? '管理员' : '操作员') + ')';
                }
                if (document.getElementById('sidebar-user-avatar')) {
                    document.getElementById('sidebar-user-avatar').textContent = userName.substring(0, 2).toUpperCase();
                }
                if (document.getElementById('sidebar-user-role')) {
                    document.getElementById('sidebar-user-role').textContent = role === 'ADMIN' ? '管理员' : '操作员';
                }
                
                // 同时更新其他可能的用户信息元素
                if (document.getElementById('user-name')) {
                    document.getElementById('user-name').textContent = userName + ' (' + (role === 'ADMIN' ? '管理员' : '操作员') + ')';
                }
                if (document.getElementById('user-avatar')) {
                    document.getElementById('user-avatar').textContent = userName.substring(0, 2).toUpperCase();
                }
                if (document.getElementById('mobile-user-avatar')) {
                    document.getElementById('mobile-user-avatar').textContent = userName.substring(0, 2).toUpperCase();
                }
                
                // 更新弹窗内的推荐码和用户名
                if (document.getElementById('referral-code')) {
                    document.getElementById('referral-code').textContent = referralCode;
                }
                if (document.getElementById('poster-ref-code')) {
                    document.getElementById('poster-ref-code').textContent = referralCode;
                }
                if (document.getElementById('qrcode-img')) {
                    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://trademind.ai/reg?ref=' + referralCode.replace('-', '');
                    document.getElementById('qrcode-img').src = qrCodeUrl;
                }
                if (document.getElementById('poster-qr')) {
                    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=TradeMind-' + referralCode.replace('-', '');
                    document.getElementById('poster-qr').src = qrCodeUrl;
                }
            }
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    const togglePassword = document.getElementById('togglePassword');
    const password = document.getElementById('password');
    
    if (togglePassword && password) {
        togglePassword.addEventListener('click', function() {
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            
            const icon = togglePassword.querySelector('svg');
            if (icon) {
                if (type === 'text') {
                    icon.innerHTML = '<path fill="currentColor" d="M128 112a48 48 0 0 0 48-48c0-13.26-5.37-25.26-14-33.92L150.25 41.83A8 8 0 0 0 142 32H48a8 8 0 0 0-8.25 9.83L58.63 68.42A55.52 55.52 0 0 0 48 80a56 56 0 0 0 56 56a56 56 0 0 0 55.43-63.23l22.32 19.57a8 8 0 0 0 11.35-1.16l14.71-28.23A8 8 0 0 0 198.51 56H152a8 8 0 0 0-8 6.4l-7.58 14.55A80.08 80.08 0 0 1 128 112Zm-96-32a48 48 0 1 1 96 0a48 48 0 0 1-96 0Z"></path>';
                } else {
                    icon.innerHTML = '<path fill="currentColor" d="M239.69 129.83a123.38 123.38 0 0 0-43.74-30.93l18-34.51a8 8 0 0 0-2.37-11.33l-25.4-18.84a8 8 0 0 0-11.34 2.37l-19.29 37a8 8 0 0 0 2.83 10.24l51.42 38.09a123.2 123.2 0 0 0 13.11 58.67l14.48 21.67a8 8 0 0 0 11.23 3.12l25.55-14.66a8 8 0 0 0 3.12-11.23l-13.77-20.65a123.59 123.59 0 0 0-6.32-65.39Zm-95.74 60.7a8 8 0 0 0-3.61-3.61L68.42 154.54a8 8 0 0 0-3.61 3.61L48.63 224.3a8 8 0 0 0 3.61 3.61l71.92-32.38a8 8 0 0 0 3.61-3.61ZM128 80a48 48 0 1 0 48 48a48 48 0 0 0-48-48Zm0 136a88 88 0 1 1 88-88a88 88 0 0 1-88 88Z"></path>';
                }
            }
        });
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                alert('请输入用户名和密码');
                return;
            }
            
            try {
                // 对密码进行MD5加密
                const encryptedPassword = await md5Hash(password);
                
                const gatewayUrl = getApiUrl('gateway');
                const url = gatewayUrl + '/api/v1/tenant/login';
                
                // 发送MD5加密后的密码
                const loginData = {
                    userName: username,
                    password: encryptedPassword
                };
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(loginData)
                });
                
                const data = await response.json();
                
                console.log('登录接口响应:', data);
                
                if (!response.ok) {
                    // 处理401等错误
                    const errorMessage = data.msg || data.message || '登录失败：用户名或密码错误';
                    showModal(errorMessage, true);
                    return;
                }
                
                // 处理不同格式的响应
                if (data.success === true) {
                    // 新的响应格式：{success: true, message: "登录成功", token: "...", user: {...}}
                    if (data.token) {
                        // 检查localStorage是否可用
                        if (checkLocalStorage()) {
                            localStorage.setItem('token', data.token);
                            localStorage.setItem('login_timestamp', Date.now().toString());
                            localStorage.setItem('user_info', JSON.stringify(data.user || {}));
                            localStorage.setItem('username', username);
                            localStorage.setItem('currentUser', JSON.stringify(data.user || {}));
                        }
                        
                        // 跳转到工作台界面（使用绝对路径）
                        window.location.href = '/modules/dashboard/dashboard.html';
                    } else {
                        showModal('登录失败：缺少token', true);
                    }
                } else if (data.code === 200 && data.data) {
                    // 版本1响应格式：{code: 200, msg: "登录成功", data: {token: "...", user: {...}}}
                    if (data.data.token) {
                        // 检查localStorage是否可用
                        if (checkLocalStorage()) {
                            localStorage.setItem('token', data.data.token);
                            localStorage.setItem('login_timestamp', Date.now().toString());
                            localStorage.setItem('user_info', JSON.stringify(data.data.user || {}));
                            localStorage.setItem('username', username);
                            localStorage.setItem('currentUser', JSON.stringify(data.data.user || {}));
                        }
                        
                        // 跳转到工作台界面（使用绝对路径）
                        window.location.href = '/modules/dashboard/dashboard.html';
                    } else {
                        showModal('登录失败：缺少token', true);
                    }
                } else {
                    // 登录失败
                    const errorMessage = data.msg || data.message || '未知错误';
                    showModal(errorMessage, true);
                }
            } catch (error) {
                console.error('登录请求失败:', error);
                showModal('登录失败：网络错误，请稍后重试', true);
            }
        });
    }
    
    // 验证码发送逻辑
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) {
        let countdown = 0;
        sendCodeBtn.addEventListener('click', function() {
            const phone = document.getElementById('regPhone').value;
            const phoneRegex = /^1[3-9]\d{9}$/;
            
            if (!phone) {
                showModal('请输入手机号', true);
                return;
            }
            
            if (!phoneRegex.test(phone)) {
                showModal('请输入有效的手机号', true);
                return;
            }
            
            // 模拟发送验证码
            if (countdown === 0) {
                countdown = 60;
                sendCodeBtn.disabled = true;
                sendCodeBtn.classList.add('opacity-50', 'cursor-not-allowed');
                
                const timer = setInterval(function() {
                    countdown--;
                    sendCodeBtn.textContent = countdown + '秒后重发';
                    
                    if (countdown <= 0) {
                        clearInterval(timer);
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        sendCodeBtn.textContent = '发送验证码';
                    }
                }, 1000);
                
                showModal('验证码已发送（模拟）', false);
            }
        });
    }
    
    // 密码一致性校验
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');
    const passwordMatchIndicator = document.getElementById('passwordMatchIndicator');
    
    // 密码一致性校验函数
    function checkPasswordMatch() {
        if (!regPassword || !regConfirmPassword || !passwordMatchIndicator) return;
        
        const password = regPassword.value;
        const confirmPassword = regConfirmPassword.value;
        
        if (confirmPassword === '') {
            passwordMatchIndicator.textContent = '';
            passwordMatchIndicator.className = 'ml-3 text-lg';
        } else if (password === confirmPassword) {
            passwordMatchIndicator.textContent = '✓';
            passwordMatchIndicator.className = 'ml-3 text-lg font-bold text-green-500';
        } else {
            passwordMatchIndicator.textContent = '✗';
            passwordMatchIndicator.className = 'ml-3 text-lg font-bold text-red-500';
        }
    }
    
    // 为密码输入框添加事件监听器
    if (regPassword) {
        regPassword.addEventListener('input', checkPasswordMatch);
    }
    
    // 为确认密码输入框添加事件监听器
    if (regConfirmPassword) {
        regConfirmPassword.addEventListener('input', checkPasswordMatch);
    }
    
    // 注册表单提交逻辑
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const phone = document.getElementById('regPhone').value;
            const company = document.getElementById('regCompany').value || '';
            const creditCode = document.getElementById('regCreditCode').value || '';
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const inviteCode = document.getElementById('inviteCode').value || '';
            
            // 验证必填字段
            if (!username || !email || !phone || !password || !confirmPassword) {
                showModal('请填写所有必填字段', true);
                return;
            }
            
            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showModal('请输入有效的邮箱地址', true);
                return;
            }
            
            // 验证手机号格式
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(phone)) {
                showModal('请输入有效的手机号', true);
                return;
            }
            
            // 验证密码一致性
            if (password !== confirmPassword) {
                showModal('两次输入的密码不一致', true);
                return;
            }
            
            // 验证密码长度
            if (password.length < 6) {
                showModal('密码长度不能少于6个字符', true);
                return;
            }
            
            try {
                // 对密码进行MD5加密
                const encryptedPassword = await md5Hash(password);
                
                const gatewayUrl = getApiUrl('gateway');
                const url = gatewayUrl + '/api/v1/tenant/register';
                
                // 构建注册数据
                const registerData = {
                    username: username,
                    email: email,
                    phone: phone,
                    tenantName: company, // 公司名称
                    tenantCode: creditCode, // 社会信用代码
                    password: encryptedPassword,
                    inviteCode: inviteCode
                };
                
                // 发送注册请求
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(registerData)
                });
                
                // 检查响应状态
                console.log('注册请求状态:', response.status);
                console.log('注册请求状态文本:', response.statusText);
                
                // 尝试解析响应
                let data;
                try {
                    data = await response.json();
                    console.log('注册接口响应:', data);
                } catch (parseError) {
                    console.error('解析响应失败:', parseError);
                    showModal('注册失败：服务器响应格式错误', true);
                    return;
                }
                
                if (!response.ok) {
                    const errorMessage = data.msg || data.message || '注册失败，请稍后重试';
                    showModal(errorMessage, true);
                    return;
                }
                
                if (data.success === true) {
                    // 注册成功，直接跳转至登录界面
                    window.location.href = 'login.html';
                } else {
                    showModal('注册失败，请稍后重试', true);
                }
            } catch (error) {
                console.error('注册请求失败:', error);
                showModal('注册失败：网络错误，请稍后重试', true);
            }
        });
    }
    
    // 注册链接处理
    const registerLink = document.querySelector('a[href="register.html"]');
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }
    
    // 登录链接处理
    const loginLink = document.querySelector('a[href="login.html"]');
    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
    
    // 忘记密码链接处理
    const forgotPasswordLink = document.querySelector('a[href="#"]');
    if (forgotPasswordLink && forgotPasswordLink.textContent.includes('忘记密码')) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('忘记密码功能正在开发中');
        });
    }
    
    // 检查当前页面是否需要认证
    const isLoginPage = window.location.pathname.includes('login.html');
    const isRegisterPage = window.location.pathname.includes('register.html');
    const isRootPath = window.location.pathname.endsWith('/');
    
    if (isLoginPage || isRootPath) {
        const token = localStorage.getItem('token');
        if (token && (isLoginPage || isRootPath)) {
            // 检查认证状态
            if (checkAuth()) {
                window.location.href = getDashboardPath();
            }
        }
    } else if (!isLoginPage && !isRegisterPage) {
        // 非登录页面且非注册页面，检查认证状态
        checkAuth();
    }
});
