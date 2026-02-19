// 配置常量
const TOKEN_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时

// 从环境变量读取配置的工具函数
function getApiUrl(serviceName) {
    switch(serviceName) {
        case 'tenant':
            return window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1' ? 'http://localhost:8082' : (import.meta?.env?.VITE_TENANT_API_BASE || 'http://localhost:8082');
        case 'init':
            return 'http://localhost:8084';
        case 'ai':
            return 'http://localhost:8083';
        default:
            return '';
    }
}

// 获取登录页面路径
function getLoginPath() {
    return import.meta?.env?.VITE_LOGIN_PATH || 'login.html';
}

// 获取工作台页面路径
function getDashboardPath() {
    return import.meta?.env?.VITE_DASHBOARD_PATH || 'modules/dashboard/dashboard.html';
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
    localStorage.removeItem('token');
    localStorage.removeItem('login_timestamp');
    localStorage.removeItem('user_info');
    localStorage.removeItem('username');
    localStorage.removeItem('currentUser');
    console.log('已清空本地存储中的认证信息');
    // 重定向到登录页面
    window.location.href = getLoginPath();
}

// 检查认证状态
function checkAuth() {
    console.log('开始检查认证状态');
    
    const token = localStorage.getItem('token');
    
    // 如果token不存在，跳转到登录页面
    if (!token) {
        console.log('Token不存在，跳转到登录页面');
        logout();
        return false;
    }
    
    // 检查token是否为mock-token且非开发模式
    const isDevMode = import.meta?.env?.VITE_USER_NODE_ENV === 'development' || window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1';
    if (token === 'mock-token' && !isDevMode) {
        console.log('Mock token在非开发模式下无效，执行logout');
        logout();
        return false;
    }
    
    // 检查token是否过期
    const loginTimestamp = localStorage.getItem('login_timestamp');
    if (loginTimestamp) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - parseInt(loginTimestamp);
        
        if (elapsedTime > TOKEN_EXPIRE_TIME) {
            console.log('Token已过期，执行logout');
            logout();
            return false;
        }
    } else {
        // 没有登录时间戳，视为无效
        console.log('缺少登录时间戳，执行logout');
        logout();
        return false;
    }
    
    console.log('认证状态检查通过');
    return true;
}

// 包装fetch函数，自动添加Authorization头并处理401响应
function wrappedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // 自动添加Authorization头
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 发送请求
    return fetch(url, {
        ...options,
        headers
    }).then(response => {
        // 处理401响应
        if (response.status === 401) {
            console.log('收到401响应，执行logout');
            logout();
            throw new Error('未授权');
        }
        return response;
    });
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
                const tenantApiBase = getApiUrl('tenant');
                const url = `${tenantApiBase}/api/v1/tenant/login`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userName: username,
                        password: password
                    })
                });
                
                if (!response.ok) {
                    throw new Error('登录失败');
                }
                
                const data = await response.json();
                
                console.log('登录接口响应:', data);
                
                // 处理不同格式的响应
                if (data.code === 200 && data.data) {
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
                        alert('登录失败：缺少token');
                    }
                } else if (data.success === true) {
                    // 版本2响应格式：{success: true, message: "登录成功", user: {...}}
                    // 这里需要注意，版本2的响应可能没有token，需要根据实际情况处理
                    console.log('登录成功，但响应格式可能不包含token');
                    
                    // 检查localStorage是否可用
                    if (checkLocalStorage()) {
                        // 暂时使用一个mock token，实际应该由后端返回
                        localStorage.setItem('token', 'mock-token');
                        localStorage.setItem('login_timestamp', Date.now().toString());
                        localStorage.setItem('user_info', JSON.stringify(data.user || {}));
                        localStorage.setItem('username', username);
                        localStorage.setItem('currentUser', JSON.stringify(data.user || {}));
                    }
                    
                    // 跳转到工作台界面
                    window.location.href = getDashboardPath();
                } else {
                    // 登录失败
                    const errorMessage = data.msg || data.message || '未知错误';
                    alert('登录失败：' + errorMessage);
                }
            } catch (error) {
                console.error('登录请求失败:', error);
                alert('登录失败：网络错误，请稍后重试');
            }
        });
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const inviteCode = document.getElementById('inviteCode').value;
            
            if (!username || !email || !password || !confirmPassword) {
                alert('请填写所有必填字段');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('请输入有效的邮箱地址');
                return;
            }
            
            if (password !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }
            
            if (password.length < 6) {
                alert('密码长度不能少于6个字符');
                return;
            }
            
            const users = JSON.parse(localStorage.getItem('trademind_users') || '[]');
            
            if (users.find(u => u.username === username)) {
                alert('用户名已存在');
                return;
            }
            
            if (users.find(u => u.email === email)) {
                alert('邮箱已被注册');
                return;
            }
            
            const newUser = {
                username,
                email,
                password,
                inviteCode,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            localStorage.setItem('trademind_users', JSON.stringify(users));
            
            alert('注册成功，请登录');
            window.location.href = 'login.html';
        });
    }
    
    const registerLink = document.querySelector('a[href="register.html"]');
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }
    
    const loginLink = document.querySelector('a[href="login.html"]');
    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
    
    const forgotPasswordLink = document.querySelector('a[href="#"]');
    if (forgotPasswordLink && forgotPasswordLink.textContent.includes('忘记密码')) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('忘记密码功能正在开发中');
        });
    }
    
    // 检查当前页面是否需要认证
    if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/')) {
        const token = localStorage.getItem('token');
        if (token && (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/'))) {
            // 检查认证状态
            if (checkAuth()) {
                window.location.href = getDashboardPath();
            }
        }
    } else if (!window.location.pathname.includes('login.html')) {
        // 非登录页面，检查认证状态
        checkAuth();
    }
});
