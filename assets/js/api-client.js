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
                        if (userInfo.tenantId) {
                            headers['X-Tenant-Id'] = userInfo.tenantId.toString();
                            console.log('[API-Client] ✅ 添加了X-Tenant-Id头');
                        }
                        if (userInfo.userId) {
                            headers['X-User-Id'] = userInfo.userId.toString();
                            console.log('[API-Client] ✅ 添加了X-User-Id头');
                        }
                    }
                } catch (error) {
                    console.error('[API-Client] ❌ 解析用户信息时发生错误:', error);
                }
            } else {
                console.log('[API-Client] ❌ 未添加Authorization头，因为token不存在或为空');
                if (window.TradeMindApp && window.TradeMindApp.logout) {
                    window.TradeMindApp.logout();
                }
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
            
            // 处理401响应
            if (response.status === 401) {
                console.log('[API-Client] ❌ 收到401响应，执行logout');
                try {
                    const errorData = await response.json();
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
            
            if (window.TradeMindApp && window.TradeMindApp.logout) {
                window.TradeMindApp.logout();
            }
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
