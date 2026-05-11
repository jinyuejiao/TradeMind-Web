/* ========================================================
 * TradeMind - API 请求拦截器
 * ========================================================
 * 自动处理 BASE_URL 和 Token 注入
 * ======================================================== */

(function() {
    'use strict';

    console.log('[API-Client] 初始化 API 请求拦截器...');

    // ================ 辅助函数：检查 localStorage ================
    function checkLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.error('[API-Client] localStorage 不可用');
            return false;
        }
    }

    // ================ wrappedFetch 函数 ================
    window.wrappedFetch = async function(url, options = {}) {
        console.log('[API-Client] ========== 开始发送请求 ==========');
        console.log('[API-Client] 原始请求URL:', url);
        console.log('[API-Client] 请求选项:', options);
        const { skipAuth = false, ...requestOptions } = options;
        
        // 核心修复：自动识别并拼接基准路径
        const finalUrl = url.startsWith('http') ? url : (window.TM_API_BASE + url);
        console.log('[API-Client] 最终请求URL:', finalUrl);
        
        // 首先检查localStorage是否可用
        console.log('[API-Client] 步骤1: 检查localStorage是否可用');
        if (!checkLocalStorage()) {
            console.log('[API-Client] ❌ localStorage不可用，执行logout');
            if (window.TradeMindApp && window.TradeMindApp.logout) {
                window.TradeMindApp.logout();
            }
            return Promise.reject(new Error('localStorage不可用'));
        }
        console.log('[API-Client] ✅ localStorage可用');
        
        try {
            console.log('[API-Client] 步骤2: 获取token');
            const token = localStorage.getItem('token');
            console.log('[API-Client] 获取到的token:', token ? '存在' : '不存在');
            
            // 自动添加Authorization头
            console.log('[API-Client] 步骤3: 构建请求头');
            const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
            const headers = {
                ...requestOptions.headers
            };
            // FormData 由浏览器自动附加 boundary，不能强制写 application/json
            if (!isFormData && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            
            if (skipAuth) {
                console.log('[API-Client] 跳过Authorization注入（skipAuth=true）');
            } else if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
                headers['Authorization'] = 'Bearer ' + token;
                console.log('[API-Client] ✅ 添加了Authorization头');
                
                // 从localStorage中获取用户信息并添加租户ID和用户ID到请求头
                try {
                    const userInfoStr = localStorage.getItem('user_info');
                    if (userInfoStr) {
                        const userInfo = JSON.parse(userInfoStr);
                        var tid = userInfo.tenantId != null ? userInfo.tenantId : userInfo.tenant_id;
                        if (tid != null && tid !== '') {
                            headers['X-Tenant-Id'] = String(tid);
                            console.log('[API-Client] ✅ 添加了X-Tenant-Id头');
                        }
                        var uid = userInfo.userId != null ? userInfo.userId : userInfo.user_id;
                        if (uid != null && uid !== '') {
                            headers['X-User-Id'] = String(uid);
                            console.log('[API-Client] ✅ 添加了X-User-Id头');
                        }
                    }
                } catch (error) {
                    console.error('[API-Client] ❌ 解析用户信息时发生错误:', error);
                }
            } else {
                // 未登录场景（登录/注册页、injectCommonUI 拉字典等）严禁 logout：否则会 replace(login) 造成页面死循环刷新
                console.log('[API-Client] ❌ 未添加 Authorization：token 为空（skipAuth=false），拒绝请求');
                return Promise.reject(new Error('token不存在或为空'));
            }
            console.log('[API-Client] 最终请求头:', headers);
            
            // 发送请求
            console.log('[API-Client] 步骤4: 发送请求');
            const response = await fetch(finalUrl, {
                ...requestOptions,
                headers
            });
            
            console.log('[API-Client] 步骤5: 处理响应');
            console.log('[API-Client] 响应状态:', response.status);
            console.log('[API-Client] 响应状态文本:', response.statusText);
            
            // 处理401响应：登录/注册等 skipAuth 请求失败也会返回401，不得 logout 或消费 body，否则弹窗一闪即被 replace(login) 刷掉
            if (response.status === 401) {
                if (skipAuth) {
                    console.log('[API-Client] skipAuth 请求收到401，交由调用方展示错误（不执行 logout）');
                    return response;
                }
                console.log('[API-Client] ❌ 收到401响应，执行logout');
                try {
                    const errorData = await response.clone().json();
                    console.log('[API-Client] 401响应内容:', errorData);
                } catch (e) {
                    console.log('[API-Client] 无法解析401响应内容');
                }
                if (window.TradeMindApp && window.TradeMindApp.logout) {
                    window.TradeMindApp.logout();
                }
                throw new Error('未授权');
            }

            if (!response.ok) {
                console.warn('[API-Client] ❌ HTTP 非成功状态:', response.status, response.statusText);
            } else {
                console.log('[API-Client] ✅ 响应状态 2xx');
            }
            
            // 日志契约：每个接口请求完成后，必须 console.log 响应状态及处理后的数据对象
            console.log('[API-Client] ========== 请求完成 ==========');
            console.log('[API-Client] 响应状态:', response.status);
            
            return response;
        } catch (error) {
            console.error('[API-Client] ❌ 创建请求时发生错误:', error);
            console.error('[API-Client] 错误堆栈:', error.stack);
            // 勿在通用 catch 里 logout：网关未启动、DNS、CORS、断网等会导致登录后主壳误踢出并形成「刷新循环」
            // 未授权仅在收到 HTTP 401 响应时处理（见上方分支）；此处仅向上抛出由调用方决定是否提示
            throw error;
        }
    };

    // ================ handleApiResponse 函数 ================
    window.handleApiResponse = async function(response) {
        console.log('[API-Client] 处理API响应...');
        
        // 检查响应状态码
        if (response.status === 401) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('登录过期，请重新登录', 'error');
            }
            // 跳转到登录页面
            window.location.href = '/login.html';
            return null;
        } else if (response.status === 500) {
            if (window.TM_UI && window.TM_UI.showNotification) {
                window.TM_UI.showNotification('服务器配置错误', 'error');
            }
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 日志契约：输出处理后的数据对象
        console.log('[API-Client] API响应数据:', data);
        
        if (!data.success) {
            throw new Error(data.message || '操作失败');
        }

        return data;
    };

    console.log('[API-Client] API 请求拦截器初始化完成！');
})();
