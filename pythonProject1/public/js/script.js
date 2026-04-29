// ========== Функции валидации ==========
function validateLoginForm() {
    const loginInput = document.getElementById('auth-login');
    const passwordInput = document.getElementById('auth-password');
    const login = loginInput ? loginInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    let isValid = true;

    clearFieldError(loginInput, 'login-field-error');
    clearFieldError(passwordInput, 'password-field-error');

    if (!login.trim()) {
        showFieldError(loginInput, 'login-field-error', 'Заполните поле "Логин"');
        isValid = false;
    }

    if (!password.trim()) {
        showFieldError(passwordInput, 'password-field-error', 'Заполните поле "Пароль"');
        isValid = false;
    }

    return isValid;
}

// ========== Функции API ==========
async function handleLogin() {
    if (!validateLoginForm()) {
        return;
    }

    const login = document.getElementById('auth-login')?.value;
    const password = document.getElementById('auth-password')?.value;
    const remember = document.getElementById('remember-me')?.checked || false;

    const submitBtn = document.getElementById('auth-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Вход...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password, remember })
        });

        const data = await response.json();

        if (response.ok) {
            saveToken(data.token, remember);
            window.location.href = '/profile';
        } else {
            let errorMessage = data.error || 'Неверный логин или пароль';

            if (errorMessage.includes('заблокирован') || errorMessage.includes('деактивирован')) {
                showNotification(errorMessage);
            } else {
                showNotification('Неверный логин или пароль');
            }

            const passwordInput = document.getElementById('auth-password');
            if (passwordInput) passwordInput.value = '';
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        showNotification('Ошибка соединения с сервером');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ========== Очистка ошибок при вводе ==========
function setupInputValidation() {
    const loginInput = document.getElementById('auth-login');
    const passwordInput = document.getElementById('auth-password');

    if (loginInput) {
        loginInput.addEventListener('input', () => clearFieldError(loginInput, 'login-field-error'));
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', () => clearFieldError(passwordInput, 'password-field-error'));
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
}

// ========== Настройка показа/скрытия пароля ==========
function setupPagePasswordToggle() {
    const passwordWrapper = document.querySelector('.auth-section .password-wrapper');
    if (!passwordWrapper) return;

    const passwordInput = passwordWrapper.querySelector('input');
    if (!passwordInput) return;

    const existingBtn = passwordWrapper.querySelector('.toggle-password');
    if (existingBtn) existingBtn.remove();

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'toggle-password';
    toggleBtn.innerHTML = '👁️';

    toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '👁️' : '🔓';
    });

    toggleBtn.addEventListener('mouseenter', function() {
        this.style.backgroundColor = 'rgba(139, 115, 85, 0.1)';
    });

    toggleBtn.addEventListener('mouseleave', function() {
        this.style.backgroundColor = 'transparent';
    });

    passwordWrapper.style.position = 'relative';
    passwordWrapper.appendChild(toggleBtn);
}

// ========== Инициализация ==========
function initEventListeners() {
    const authBtn = document.getElementById('auth-submit');
    if (authBtn) authBtn.addEventListener('click', handleLogin);

    setupInputValidation();
    setupPagePasswordToggle();
}

async function checkAuthOnIndex() {
    const token = getToken();
    if (!token) {
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('unauth-info').style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            let fullName = `${user.surname} ${user.name}`;
            if (user.patronymic) fullName += ` ${user.patronymic}`;

            document.getElementById('user-full-name').textContent = fullName;
            document.getElementById('user-info').style.display = 'block';
            document.getElementById('unauth-info').style.display = 'none';

            const logoutBtn = document.getElementById('logout-btn-index');
            if (logoutBtn) {
                const newLogoutBtn = logoutBtn.cloneNode(true);
                logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
                newLogoutBtn.addEventListener('click', async () => {
                    const currentToken = getToken();
                    if (currentToken) {
                        try {
                            await fetch(`${API_URL}/logout`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${currentToken}` }
                            });
                        } catch (error) { console.error('Ошибка при выходе:', error); }
                    }
                    removeToken();
                    window.location.reload();
                });
            }
        } else {
            removeToken();
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('unauth-info').style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('unauth-info').style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkAuthOnIndex();
});