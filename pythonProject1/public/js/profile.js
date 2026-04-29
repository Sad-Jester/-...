// Модуль авторизации
const Auth = {
    getToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    },

    removeToken() {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    },

    async checkAuth() {
        const token = this.getToken();
        if (!token) {
            window.location.href = '/';
            return null;
        }

        try {
            const response = await fetch(`${API_URL}/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                return await response.json();
            } else {
                this.removeToken();
                window.location.href = '/';
                return null;
            }
        } catch (error) {
            console.error('Ошибка:', error);
            window.location.href = '/';
            return null;
        }
    },

    async logout() {
        const token = this.getToken();
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
        this.removeToken();
        window.location.href = '/';
    }
};

// Модуль API профиля
const ProfileAPI = {
    async updateProfile(userData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async changePassword(passwords) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(passwords)
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, message: data.message };
        }
        return { success: false, error: data.error };
    }
};

// Валидация формы профиля
function validateProfileForm() {
    const surnameInput = document.getElementById('surname');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');

    const surname = surnameInput ? surnameInput.value : '';
    const name = nameInput ? nameInput.value : '';
    const email = emailInput ? emailInput.value : '';

    let isValid = true;

    clearFieldError(surnameInput, 'surname-error');
    clearFieldError(nameInput, 'name-error');
    clearFieldError(emailInput, 'email-error');

    const surnameValidation = Validators.validateName(surname, 'Фамилия');
    if (!surnameValidation.valid) {
        showFieldError(surnameInput, 'surname-error', surnameValidation.error);
        isValid = false;
    }

    const nameValidation = Validators.validateName(name, 'Имя');
    if (!nameValidation.valid) {
        showFieldError(nameInput, 'name-error', nameValidation.error);
        isValid = false;
    }

    if (!email.trim()) {
        showFieldError(emailInput, 'email-error', 'Заполните поле "Email"');
        isValid = false;
    } else if (!Validators.validateEmail(email)) {
        showFieldError(emailInput, 'email-error', 'Введите корректный email адрес');
        isValid = false;
    }

    return isValid;
}

// Валидация формы смены пароля
function validatePasswordForm() {
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
    const newPassword = newPasswordInput ? newPasswordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    let isValid = true;

    clearFieldError(currentPasswordInput, 'current-password-error');
    clearFieldError(newPasswordInput, 'new-password-error');
    clearFieldError(confirmPasswordInput, 'confirm-password-error');

    if (!currentPassword) {
        showFieldError(currentPasswordInput, 'current-password-error', 'Введите текущий пароль');
        isValid = false;
    }

    if (!newPassword) {
        showFieldError(newPasswordInput, 'new-password-error', 'Введите новый пароль');
        isValid = false;
    } else if (!Validators.validatePassword(newPassword)) {
        showFieldError(newPasswordInput, 'new-password-error', 'Пароль должен содержать минимум 8 символов, заглавные и строчные буквы, а также цифры');
        isValid = false;
    }

    if (!confirmPassword) {
        showFieldError(confirmPasswordInput, 'confirm-password-error', 'Подтвердите новый пароль');
        isValid = false;
    } else if (newPassword !== confirmPassword) {
        showFieldError(confirmPasswordInput, 'confirm-password-error', 'Пароли не совпадают');
        isValid = false;
    }

    return isValid;
}

// UI функции
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
}

function displayUserData(user) {
    document.getElementById('surname').value = user.surname || '';
    document.getElementById('name').value = user.name || '';
    document.getElementById('patronymic').value = user.patronymic || '';
    document.getElementById('login').value = user.login || '';
    document.getElementById('email').value = user.email || '';

    const initials = `${(user.surname?.[0] || '')}${(user.name?.[0] || '')}`.toUpperCase();
    document.getElementById('avatar-initials').textContent = initials || 'U';

    let fullName = `${user.surname || ''} ${user.name || ''}`;
    if (user.patronymic) fullName += ` ${user.patronymic}`;
    document.getElementById('short-name').textContent = fullName.trim() || 'Пользователь';
    document.getElementById('short-login').textContent = user.login || '';
}

async function loadUserData() {
    const user = await Auth.checkAuth();
    if (user) {
        displayUserData(user);

        const isAdmin = user.role === 'admin';
        const isEmployeer = user.role === 'employeer';

        // Показываем ссылку на проекты для admin и employeer
        const projectsLink = document.getElementById('projects-link');
        if (projectsLink) {
            projectsLink.style.display = (isAdmin || isEmployeer) ? 'inline-flex' : 'none';
        }

        // Остальные элементы только для admin
        const employeesLink = document.getElementById('employees-link');
        const usersLink = document.getElementById('users-link');
        const dropdownBtn = document.getElementById('dropdownBtn');

        if (employeesLink) employeesLink.style.display = isAdmin ? 'inline-flex' : 'none';
        if (usersLink) usersLink.style.display = isAdmin ? 'inline-flex' : 'none';
        if (dropdownBtn) dropdownBtn.style.display = isAdmin ? 'inline-flex' : 'none';

        // Обновляем обработчик ссылки на пользователей (только для админа)
        if (isAdmin) {
            const usersLink = document.getElementById('users-link');
            if (usersLink) {
                const newUsersLink = usersLink.cloneNode(true);
                usersLink.parentNode.replaceChild(newUsersLink, usersLink);
                newUsersLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    const token = Auth.getToken();
                    if (token) {
                        document.cookie = `token=${token}; path=/; max-age=86400`;
                        window.location.href = '/users';
                    } else {
                        window.location.href = '/access-denied';
                    }
                });
            }
        }
    }
}

// Обработчики форм
async function handleProfileUpdate(e) {
    e.preventDefault();
    if (!validateProfileForm()) return;

    const result = await ProfileAPI.updateProfile({
        surname: document.getElementById('surname').value.trim(),
        name: document.getElementById('name').value.trim(),
        patronymic: document.getElementById('patronymic').value.trim() || null,
        email: document.getElementById('email').value.trim()
    });

    if (result.success) {
        showMessage('Профиль успешно обновлен', 'success');
        await loadUserData();
    } else {
        showMessage(result.error || 'Ошибка при обновлении', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();

    if (!validatePasswordForm()) return;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    const result = await ProfileAPI.changePassword({
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
    });

    if (result.success) {
        showMessage('Пароль успешно изменен', 'success');
        document.getElementById('password-form').reset();
        clearFieldError(document.getElementById('current-password'), 'current-password-error');
        clearFieldError(document.getElementById('new-password'), 'new-password-error');
        clearFieldError(document.getElementById('confirm-password'), 'confirm-password-error');
    } else {
        if (result.error === 'Неверный текущий пароль') {
            const currentPasswordInput = document.getElementById('current-password');
            showFieldError(currentPasswordInput, 'current-password-error', 'Неверный текущий пароль');
        } else if (result.error.includes('пароль')) {
            const newPasswordInput = document.getElementById('new-password');
            showFieldError(newPasswordInput, 'new-password-error', result.error);
        } else {
            showMessage(result.error || 'Ошибка при смене пароля', 'error');
        }
    }
}

// Очистка ошибок при вводе
function setupInputValidation() {
    const surnameInput = document.getElementById('surname');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');

    if (surnameInput) surnameInput.addEventListener('input', () => clearFieldError(surnameInput, 'surname-error'));
    if (nameInput) nameInput.addEventListener('input', () => clearFieldError(nameInput, 'name-error'));
    if (emailInput) emailInput.addEventListener('input', () => clearFieldError(emailInput, 'email-error'));

    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (currentPasswordInput) {
        currentPasswordInput.addEventListener('input', () => {
            clearFieldError(currentPasswordInput, 'current-password-error');
        });
    }
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            clearFieldError(newPasswordInput, 'new-password-error');
            if (confirmPasswordInput && confirmPasswordInput.value && newPasswordInput.value === confirmPasswordInput.value) {
                clearFieldError(confirmPasswordInput, 'confirm-password-error');
            }
        });
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            if (newPasswordInput && newPasswordInput.value === confirmPasswordInput.value) {
                clearFieldError(confirmPasswordInput, 'confirm-password-error');
            } else if (confirmPasswordInput.value) {
                showFieldError(confirmPasswordInput, 'confirm-password-error', 'Пароли не совпадают');
            } else {
                clearFieldError(confirmPasswordInput, 'confirm-password-error');
            }
        });
    }
}

function setupDropdown() {
    const dropdownBtn = document.getElementById('dropdownBtn');
    const dropdownContent = document.getElementById('dropdownContent');

    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target)) {
                dropdownContent.classList.remove('show');
            }
        });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    setupPasswordToggles();
    setupInputValidation();
    setupDropdown();

    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordChange);

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', loadUserData);

    const logoutBtn = document.getElementById('logout-btn-menu');
    if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

    const referenceLink = document.querySelector('#reference-link');
    if (referenceLink) {
        referenceLink.addEventListener('click', (e) => {
            e.preventDefault();
            showMessage('Страница "Справочник" находится в разработке', 'info');
        });
    }
});