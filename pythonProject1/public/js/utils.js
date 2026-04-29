// ========== ОБЩИЕ ФУНКЦИИ ДЛЯ ВСЕГО ПРИЛОЖЕНИЯ ==========

// Конфигурация API
const API_URL = 'http://localhost:8080/api';

// ========== Функции для работы с ошибками ==========
function clearFieldError(inputElement, errorElementId) {
    if (inputElement) {
        inputElement.classList.remove('error');
    }
    const errorEl = document.getElementById(errorElementId);
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }
}

function showFieldError(inputElement, errorElementId, message) {
    if (inputElement) {
        inputElement.classList.add('error');
    }
    const errorEl = document.getElementById(errorElementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// ========== Функция для показа/скрытия пароля ==========
function setupPasswordToggles(containerSelector = 'body') {
    function createToggleButton(inputField) {
        if (!inputField) return;
        const parent = inputField.parentElement;
        if (!parent || parent.querySelector('.toggle-password')) {
            return;
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-password';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.style.cssText = `
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            background: none;
            border: none;
            font-size: 18px;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
            z-index: 1;
        `;

        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
            inputField.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '👁️' : '🔓';
        });

        toggleBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        });

        toggleBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
        });

        parent.style.position = 'relative';
        parent.appendChild(toggleBtn);
    }

    const container = document.querySelector(containerSelector);
    const passwordFields = container.querySelectorAll('.password-wrapper input');
    passwordFields.forEach(field => createToggleButton(field));
}

// ========== Общие валидаторы ==========
const Validators = {
    validateEmail(email) {
        if (!email) return false;
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    },

    validateLogin(login) {
        if (!login) return false;
        return /^[a-zA-Z0-9_]{3,50}$/.test(login);
    },

    validatePassword(password) {
        if (!password) return false;
        if (password.length < 8) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/\d/.test(password)) return false;
        return true;
    },

    validateName(name, fieldName) {
        if (!name || !name.trim()) {
            return { valid: false, error: `${fieldName} не может быть пустым` };
        }
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            return { valid: false, error: `${fieldName} должно содержать минимум 2 символа` };
        }
        if (trimmedName.length > 100) {
            return { valid: false, error: `${fieldName} не может быть длиннее 100 символов` };
        }
        if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(trimmedName)) {
            return { valid: false, error: `${fieldName} может содержать только буквы, дефис и пробел` };
        }
        return { valid: true, error: null };
    },

    getPasswordStrengthMessage(password) {
        if (!password) return null;
        if (password.length < 8) return 'Пароль должен содержать минимум 8 символов';
        if (!/[A-Z]/.test(password)) return 'Пароль должен содержать хотя бы одну заглавную букву';
        if (!/[a-z]/.test(password)) return 'Пароль должен содержать хотя бы одну строчную букву';
        if (!/\d/.test(password)) return 'Пароль должен содержать хотя бы одну цифру';
        return null;
    }
};

// ========== Функции для работы с токенами ==========
function saveToken(token, remember) {
    if (remember) {
        localStorage.setItem('token', token);
        document.cookie = `token=${token}; path=/; max-age=2592000`;
    } else {
        sessionStorage.setItem('token', token);
        document.cookie = `token=${token}; path=/; max-age=86400`;
    }
}

function getToken() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) return token;

    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'token') return value;
    }
    return null;
}

function removeToken() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

// ========== Функции для работы с модальными окнами ==========
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ========== Функция для уведомлений ==========
function showNotification(message, isError = true) {
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.classList.add(isError ? 'notification-error' : 'notification-success');

    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });

    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}