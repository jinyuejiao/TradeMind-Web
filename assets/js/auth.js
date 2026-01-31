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
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                alert('请输入用户名和密码');
                return;
            }
            
            const users = JSON.parse(localStorage.getItem('trademind_users') || '[]');
            const user = users.find(u => u.username === username && u.password === password);
            
            if (user) {
                localStorage.setItem('token', 'mock-token-' + Date.now());
                localStorage.setItem('username', username);
                localStorage.setItem('currentUser', JSON.stringify(user));
                window.location.href = 'index.html';
            } else {
                alert('用户名或密码错误');
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
    
    if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/')) {
        const token = localStorage.getItem('token');
        if (token && window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        }
    }
});
