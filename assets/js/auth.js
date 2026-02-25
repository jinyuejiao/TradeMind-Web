// 配置常量
const TOKEN_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时

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
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
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
    // 重定向到登录页面
    window.location.href = getLoginPath();
}

// 检查认证状态
function checkAuth() {
    console.log('========== 开始检查认证状态 ==========');
    
    // 首先检查localStorage是否可用
    console.log('步骤1: 检查localStorage是否可用');
    if (!checkLocalStorage()) {
        console.log('❌ localStorage不可用，跳转到登录页面');
        logout();
        return false;
    }
    console.log('✅ localStorage可用');
    
    try {
        console.log('步骤2: 获取token');
        const token = localStorage.getItem('token');
        console.log('获取到的token:', token ? '存在' : '不存在');
        
        // 如果token不存在，跳转到登录页面
        if (!token) {
            console.log('❌ Token不存在，跳转到登录页面');
            logout();
            return false;
        }
        console.log('✅ Token存在');
        
        // 检查token是否为mock-token且非开发模式
        console.log('步骤3: 检查token是否为mock-token');
        const isDevMode = (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
        console.log('当前是否为开发模式:', isDevMode);
        if (token === 'mock-token' && !isDevMode) {
            console.log('❌ Mock token在非开发模式下无效，执行logout');
            logout();
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
                console.log('❌ Token已过期，执行logout');
                logout();
                return false;
            }
        } else {
            // 没有登录时间戳，视为无效
            console.log('❌ 缺少登录时间戳，执行logout');
            logout();
            return false;
        }
        console.log('✅ Token未过期');
        
        console.log('✅ 认证状态检查通过');
        console.log('========== 认证状态检查完成 ==========');
        return true;
    } catch (error) {
        console.error('❌ 检查认证状态时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        logout();
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
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('✅ 添加了Authorization头:', headers['Authorization']);
        } else {
            console.log('❌ 未添加Authorization头，因为token不存在');
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

// 将函数暴露到全局作用域，以便其他页面使用
window.checkAuth = checkAuth;
window.logout = logout;
window.wrappedFetch = wrappedFetch;
window.getApiUrl = getApiUrl;

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
                const url = `${gatewayUrl}/api/v1/tenant/login`;
                
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
                        
                        // 跳转到工作台界面
                        window.location.href = getDashboardPath();
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
                        
                        // 跳转到工作台界面
                        window.location.href = getDashboardPath();
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
                    sendCodeBtn.textContent = `${countdown}秒后重发`;
                    
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
                const url = `${gatewayUrl}/api/v1/tenant/register`;
                
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
