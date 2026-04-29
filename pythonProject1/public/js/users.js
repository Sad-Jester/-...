let currentUserRole = null;
let currentPage = 1;

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
            window.location.href = '/access-denied';
            return false;
        }

        try {
            const response = await fetch(`${API_URL}/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();
                currentUserRole = user.role;

                if (user.role !== 'admin') {
                    const messageDiv = document.getElementById('message');
                    if (messageDiv) {
                        messageDiv.textContent = 'Доступ запрещен. Требуются права администратора.';
                        messageDiv.className = 'message error';
                        messageDiv.style.display = 'block';
                    }
                    setTimeout(() => { window.location.href = '/access-denied'; }, 2000);
                    return false;
                }
                return true;
            } else {
                this.removeToken();
                window.location.href = '/access-denied';
                return false;
            }
        } catch (error) {
            console.error('Ошибка:', error);
            window.location.href = '/access-denied';
            return false;
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

// Валидация для формы добавления пользователя
function validateAddForm() {
    const loginInput = document.getElementById('user-login');
    const surnameInput = document.getElementById('user-surname');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const passwordInput = document.getElementById('user-password');
    const confirmPasswordInput = document.getElementById('user-confirm-password');

    const login = loginInput ? loginInput.value : '';
    const surname = surnameInput ? surnameInput.value : '';
    const name = nameInput ? nameInput.value : '';
    const email = emailInput ? emailInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    let isValid = true;

    clearFieldError(loginInput, 'add-login-error');
    clearFieldError(surnameInput, 'add-surname-error');
    clearFieldError(nameInput, 'add-name-error');
    clearFieldError(emailInput, 'add-email-error');
    clearFieldError(passwordInput, 'add-password-error');
    clearFieldError(confirmPasswordInput, 'add-confirm-password-error');

    if (!login.trim()) {
        showFieldError(loginInput, 'add-login-error', 'Заполните поле "Логин"');
        isValid = false;
    } else if (!Validators.validateLogin(login)) {
        showFieldError(loginInput, 'add-login-error', 'Логин должен содержать 3-50 символов (латинские буквы, цифры, _)');
        isValid = false;
    }

    const surnameValidation = Validators.validateName(surname, 'Фамилия');
    if (!surnameValidation.valid) {
        showFieldError(surnameInput, 'add-surname-error', surnameValidation.error);
        isValid = false;
    }

    const nameValidation = Validators.validateName(name, 'Имя');
    if (!nameValidation.valid) {
        showFieldError(nameInput, 'add-name-error', nameValidation.error);
        isValid = false;
    }

    if (!email.trim()) {
        showFieldError(emailInput, 'add-email-error', 'Заполните поле "Email"');
        isValid = false;
    } else if (!Validators.validateEmail(email)) {
        showFieldError(emailInput, 'add-email-error', 'Введите корректный email адрес');
        isValid = false;
    }

    if (!password) {
        showFieldError(passwordInput, 'add-password-error', 'Заполните поле "Пароль"');
        isValid = false;
    } else if (!Validators.validatePassword(password)) {
        showFieldError(passwordInput, 'add-password-error', 'Пароль должен содержать минимум 8 символов, заглавные и строчные буквы, а также цифры');
        isValid = false;
    }

    if (!confirmPassword) {
        showFieldError(confirmPasswordInput, 'add-confirm-password-error', 'Подтвердите пароль');
        isValid = false;
    } else if (password !== confirmPassword) {
        showFieldError(confirmPasswordInput, 'add-confirm-password-error', 'Пароли не совпадают');
        isValid = false;
    }

    return isValid;
}

// Валидация для формы редактирования пользователя
function validateEditForm() {
    const surnameInput = document.getElementById('edit-user-surname');
    const nameInput = document.getElementById('edit-user-name');
    const emailInput = document.getElementById('edit-user-email');
    const passwordInput = document.getElementById('edit-user-password');

    const surname = surnameInput ? surnameInput.value : '';
    const name = nameInput ? nameInput.value : '';
    const email = emailInput ? emailInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    let isValid = true;

    clearFieldError(surnameInput, 'edit-surname-error');
    clearFieldError(nameInput, 'edit-name-error');
    clearFieldError(emailInput, 'edit-email-error');
    clearFieldError(passwordInput, 'edit-password-error');

    const surnameValidation = Validators.validateName(surname, 'Фамилия');
    if (!surnameValidation.valid) {
        showFieldError(surnameInput, 'edit-surname-error', surnameValidation.error);
        isValid = false;
    }

    const nameValidation = Validators.validateName(name, 'Имя');
    if (!nameValidation.valid) {
        showFieldError(nameInput, 'edit-name-error', nameValidation.error);
        isValid = false;
    }

    if (!email.trim()) {
        showFieldError(emailInput, 'edit-email-error', 'Заполните поле "Email"');
        isValid = false;
    } else if (!Validators.validateEmail(email)) {
        showFieldError(emailInput, 'edit-email-error', 'Введите корректный email адрес');
        isValid = false;
    }

    if (password && password.trim()) {
        if (!Validators.validatePassword(password)) {
            showFieldError(passwordInput, 'edit-password-error', 'Пароль должен содержать минимум 8 символов, заглавные и строчные буквы, а также цифры');
            isValid = false;
        }
    }

    return isValid;
}

// Модуль API
const API = {
    async fetchUsers(page = 1) {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/users?page=${page}&per_page=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                renderUsersTable(data.users);
                renderPagination(data);
                currentPage = data.page;
            } else if (response.status === 403) {
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Доступ запрещен. Требуются права администратора.';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
                setTimeout(() => { window.location.href = '/profile'; }, 2000);
            } else {
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Ошибка загрузки пользователей';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                    setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
                }
            }
        } catch (error) {
            console.error('Ошибка:', error);
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'Ошибка соединения с сервером';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
        }
    },

    async getUser(userId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) return await response.json();
        throw new Error('Ошибка загрузки пользователя');
    },

    async createUser(userData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.ok) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'Пользователь успешно добавлен';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async updateUser(userId, userData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.ok) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'Пользователь успешно обновлен';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async deleteUser(userId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'Пользователь успешно удален';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
            return true;
        }
        const data = await response.json();
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = data.error || 'Ошибка при удалении';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }
        return false;
    }
};

// UI функции
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Нет данных</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(user => `
        <tr class="${user.is_active === false ? 'inactive-user' : ''}">
            <td>${user.id}</td>
            <td>${escapeHtml(user.surname)}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.patronymic || '-')}</td>
            <td>${escapeHtml(user.login)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-employeer'}">${user.role === 'admin' ? 'Администратор' : 'Сотрудник'}</span></td>
            <td><span class="status-badge ${user.is_active !== false ? 'status-active' : 'status-inactive'}">${user.is_active !== false ? 'Активен' : 'Заблокирован'}</span></td>
            <td><div class="action-buttons"><button class="edit-btn" onclick="editUser(${user.id})">✎</button><button class="delete-btn" onclick="deleteUser(${user.id})">❌</button></div></td>
        </tr>
    `).join('');
}

function renderPagination(data) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    if (data.total_pages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    let html = '<div class="pagination-controls">';
    if (data.page > 1) html += `<button onclick="loadPage(${data.page - 1})" class="page-btn">← Предыдущая</button>`;
    html += `<span class="page-info">Страница ${data.page} из ${data.total_pages}</span>`;
    if (data.page < data.total_pages) html += `<button onclick="loadPage(${data.page + 1})" class="page-btn">Следующая →</button>`;
    html += '</div>';
    paginationDiv.innerHTML = html;
}

async function loadPage(page) { await API.fetchUsers(page); }

async function editUser(userId) {
    try {
        const user = await API.getUser(userId);

        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-surname').value = user.surname || '';
        document.getElementById('edit-user-name').value = user.name || '';
        document.getElementById('edit-user-patronymic').value = user.patronymic || '';
        document.getElementById('edit-user-login').value = user.login || '';
        document.getElementById('edit-user-email').value = user.email || '';

        const passwordInput = document.getElementById('edit-user-password');
        if (passwordInput) {
            passwordInput.value = '';
            clearFieldError(passwordInput, 'edit-password-error');
        }

        const activeCheckbox = document.getElementById('edit-user-active');
        if (activeCheckbox) {
            activeCheckbox.checked = user.is_active !== false;
        }

        const roleSelect = document.getElementById('edit-user-role');
        if (roleSelect) {
            roleSelect.value = user.role || 'employeer';
        }

        clearFieldError(document.getElementById('edit-user-surname'), 'edit-surname-error');
        clearFieldError(document.getElementById('edit-user-name'), 'edit-name-error');
        clearFieldError(document.getElementById('edit-user-email'), 'edit-email-error');

        openModal('edit-user-modal');

    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = 'Ошибка загрузки данных пользователя';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }
    }
}

async function updateUserActiveStatus(userId, isActive) {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/users/${userId}/active`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: isActive })
        });
        const data = await response.json();
        if (response.ok) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = data.message;
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
            return true;
        }
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = data.error || 'Ошибка обновления статуса';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }
        return false;
    } catch (error) {
        console.error('Ошибка:', error);
        return false;
    }
}

async function updateUserRole(userId, role) {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ role })
        });
        const data = await response.json();
        if (response.ok) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = data.message;
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
                setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
            }
            return true;
        }
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = data.error || 'Ошибка обновления роли';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }
        return false;
    } catch (error) {
        console.error('Ошибка:', error);
        return false;
    }
}

async function deleteUser(userId) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    const success = await API.deleteUser(userId);
    if (success) await API.fetchUsers(currentPage);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработчики форм
async function handleAddUser(e) {
    e.preventDefault();
    if (!validateAddForm()) return;

    const password = document.getElementById('user-password').value;
    const confirmPassword = document.getElementById('user-confirm-password').value;

    if (password !== confirmPassword) {
        const confirmInput = document.getElementById('user-confirm-password');
        showFieldError(confirmInput, 'add-confirm-password-error', 'Пароли не совпадают');
        return;
    }

    const result = await API.createUser({
        surname: document.getElementById('user-surname').value.trim(),
        name: document.getElementById('user-name').value.trim(),
        patronymic: document.getElementById('user-patronymic').value.trim() || null,
        login: document.getElementById('user-login').value.trim(),
        email: document.getElementById('user-email').value.trim(),
        password: password,
        confirmPassword: confirmPassword
    });

    if (result.success) {
        closeModal('add-user-modal');
        document.getElementById('add-user-form').reset();
        await API.fetchUsers(currentPage);
    } else {
        const modalError = document.getElementById('modal-error');
        if (modalError) {
            modalError.textContent = result.error;
            modalError.style.display = 'block';
            setTimeout(() => { modalError.style.display = 'none'; }, 3000);
        }
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    if (!validateEditForm()) return;

    const userId = document.getElementById('edit-user-id').value;
    const password = document.getElementById('edit-user-password').value;
    const isActive = document.getElementById('edit-user-active').checked;
    const role = document.getElementById('edit-user-role').value;

    const updateData = {
        surname: document.getElementById('edit-user-surname').value.trim(),
        name: document.getElementById('edit-user-name').value.trim(),
        patronymic: document.getElementById('edit-user-patronymic').value.trim() || null,
        login: document.getElementById('edit-user-login').value,
        email: document.getElementById('edit-user-email').value.trim()
    };

    if (password && password.trim()) {
        updateData.password = password;
    }

    const result = await API.updateUser(userId, updateData);

    if (result.success) {
        await updateUserRole(userId, role);
        await updateUserActiveStatus(userId, isActive);

        closeModal('edit-user-modal');
        await API.fetchUsers(currentPage);
    } else {
        const modalError = document.getElementById('edit-modal-error');
        if (modalError) {
            modalError.textContent = result.error;
            modalError.style.display = 'block';
            setTimeout(() => { modalError.style.display = 'none'; }, 3000);
        }
    }
}

function setupInputValidation() {
    const addFields = ['login', 'surname', 'name', 'email', 'password', 'confirm-password'];
    addFields.forEach(field => {
        const input = document.getElementById(`user-${field}`);
        if (input) {
            input.addEventListener('input', () => {
                clearFieldError(input, `add-${field}-error`);

                if (field === 'password' || field === 'confirm-password') {
                    const passwordInput = document.getElementById('user-password');
                    const confirmInput = document.getElementById('user-confirm-password');
                    if (passwordInput && confirmInput && confirmInput.value && passwordInput.value !== confirmInput.value) {
                        showFieldError(confirmInput, 'add-confirm-password-error', 'Пароли не совпадают');
                    } else if (confirmInput && confirmInput.value) {
                        clearFieldError(confirmInput, 'add-confirm-password-error');
                    }
                }
            });
        }
    });

    const editFields = ['surname', 'name', 'email', 'password'];
    editFields.forEach(field => {
        const input = document.getElementById(`edit-user-${field}`);
        if (input) {
            input.addEventListener('input', () => {
                clearFieldError(input, `edit-${field}-error`);
            });
        }
    });
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
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await Auth.checkAuth();
    if (!isAuth) return;
    await API.fetchUsers();
    setupPasswordToggles();
    setupInputValidation();
    setupDropdown();

    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => openModal('add-user-modal'));
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.addEventListener('submit', handleAddUser);
    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) editUserForm.addEventListener('submit', handleEditUser);
    const logoutBtn = document.getElementById('logout-btn-menu');
    if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => { closeModal('add-user-modal'); document.getElementById('add-user-form').reset(); });
    const cancelEditModalBtn = document.getElementById('cancel-edit-modal-btn');
    if (cancelEditModalBtn) cancelEditModalBtn.addEventListener('click', () => closeModal('edit-user-modal'));

    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target.id);
    });
});