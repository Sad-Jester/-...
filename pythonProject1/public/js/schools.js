let currentPage = 1;
let currentDeleteSchoolId = null;
let isAdmin = false;
let allPrograms = [];
let expandedRows = new Set();
let allExpanded = false;

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
            return false;
        }

        try {
            const response = await fetch(`${API_URL}/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();

                const usersLink = document.getElementById('users-link');
                if (usersLink) {
                    usersLink.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
                }
                return true;
            } else {
                this.removeToken();
                window.location.href = '/';
                return false;
            }
        } catch (error) {
            console.error('Ошибка:', error);
            window.location.href = '/';
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

// API для получения программ
const ProgramsAPI = {
    async fetchAvailablePrograms() {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/schools/available-programs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Ошибка загрузки программ:', error);
            return [];
        }
    }
};

// Модуль API школ
const SchoolsAPI = {
    async fetchSchools(page = 1) {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/schools?page=${page}&per_page=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                isAdmin = data.is_admin;
                renderSchoolsTable(data.schools);
                renderPagination(data);
                currentPage = data.page;
            } else if (response.status === 401) {
                Auth.removeToken();
                window.location.href = '/';
            } else {
                showMessage('Ошибка загрузки школ', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showMessage('Ошибка соединения с сервером', 'error');
        }
    },

    async getSchool(schoolId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/schools/${schoolId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Ошибка загрузки школы');
    },

    async createSchool(schoolData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/schools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(schoolData)
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Школа успешно добавлена', 'success');
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async updateSchool(schoolId, schoolData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/schools/${schoolId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(schoolData)
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Школа успешно обновлена', 'success');
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async deleteSchool(schoolId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/schools/${schoolId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showMessage('Школа успешно удалена', 'success');
            return true;
        }
        const data = await response.json();
        showMessage(data.error || 'Ошибка при удалении', 'error');
        return false;
    }
};

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
    }
}

function renderSchoolDetails(school) {
    const programs = school.programs || [];

    if (programs.length === 0) {
        return `
            <div style="padding: 20px; text-align: center; color: #b0a89d;">
                <i class="fas fa-code-branch" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                Нет привязанных программ
            </div>
        `;
    }

    let html = `
        <div style="padding: 10px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f5f2ed; border-bottom: 2px solid #e8e0d5;">
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 40%;">Программа</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 35%;">Комментарий к программе</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 25%;">Сотрудники</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const program of programs) {
        const employees = program.employees || [];
        const hasEmployees = employees.length > 0;

        // Формируем HTML для сотрудников
        let employeesHtml = '';
        if (hasEmployees) {
            employeesHtml = employees.map(emp => {
                const fullName = `${emp.surname} ${emp.name}${emp.patronymic ? ' ' + emp.patronymic : ''}`;
                return `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="font-size: 13px;">${escapeHtml(fullName)}</span>
                        </div>`;
            }).join('');
        } else {
            employeesHtml = `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                                <span style="font-size: 13px; color: #b0a89d;">Нет сотрудника</span>
                            </div>`;
        }

        html += `
            <tr style="border-bottom: 1px solid #e8e0d5;">
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 600; color: #3d3a35;">
                        ${escapeHtml(program.name)}
                        ${program.year ? `<span style="font-size: 11px; color: #8b7355; margin-left: 8px;">(${program.year})</span>` : ''}
                    </div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; color: #b0a89d; font-size: 12px;">
                    ${program.comment ? escapeHtml(program.comment.substring(0, 100)) : '-'}
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    ${employeesHtml}
                </td>
             </tr>
        `;
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

function renderSchoolsTable(schools) {
    const tbody = document.getElementById('schools-table-body');
    if (!schools || schools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Нет доступных школ</td></tr>';
        return;
    }

    let html = '';
    for (const school of schools) {
        const ownerName = (school.owner_surname && school.owner_name)
            ? `${school.owner_surname} ${school.owner_name}`
            : (school.owner_login || 'Неизвестно');
        const comment = school.comment || '-';

        html += `
            <tr id="row-${school.id}">
                <td style="text-align: center;">
                    <span class="expand-icon" id="expand-icon-${school.id}" onclick="toggleSchoolDetails(${school.id})">
                        ▶
                    </span>
                </td>
                <td style="font-weight: 600;">${escapeHtml(school.name)}</td>
                <td>${escapeHtml(comment)}</td>
                <td>${escapeHtml(ownerName)}</td>
                <td>${school.created_at || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="editSchool(${school.id})">✎</button>
                        <button class="delete-btn" onclick="confirmDeleteSchool(${school.id})">❌</button>
                    </div>
                </td>
            </tr>
            <tr id="details-row-${school.id}" class="details-row">
                <td colspan="6" class="details-cell">
                    <div style="padding: 20px; text-align: center;">Загрузка...</div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;

    // Сбрасываем состояние массового раскрытия
    allExpanded = false;
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.classList.remove('expanded');
        expandAllIcon.style.opacity = '1';
    }
}

async function toggleSchoolDetails(schoolId) {
    const detailsRow = document.getElementById(`details-row-${schoolId}`);
    const expandIcon = document.getElementById(`expand-icon-${schoolId}`);

    if (expandedRows.has(schoolId)) {
        detailsRow.classList.remove('show');
        expandIcon.classList.remove('expanded');
        expandedRows.delete(schoolId);
    } else {
        if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
            const school = await SchoolsAPI.getSchool(schoolId);
            const detailsHtml = renderSchoolDetails(school);
            detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
            detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
        }
        detailsRow.classList.add('show');
        expandIcon.classList.add('expanded');
        expandedRows.add(schoolId);
    }

    updateExpandAllIcon();
}

async function toggleAllSchools() {
    const expandAllIcon = document.getElementById('expand-all-icon');
    const allExpandIcons = document.querySelectorAll('.expand-icon');
    const allDetailsRows = document.querySelectorAll('.details-row');

    if (allExpanded) {
        for (const row of allDetailsRows) {
            row.classList.remove('show');
        }
        for (const icon of allExpandIcons) {
            icon.classList.remove('expanded');
        }
        expandAllIcon.classList.remove('expanded');
        allExpanded = false;
    } else {
        const promises = [];
        for (const icon of allExpandIcons) {
            const rowId = icon.id.replace('expand-icon-', '');
            const detailsRow = document.getElementById(`details-row-${rowId}`);

            if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
                const promise = (async () => {
                    const school = await SchoolsAPI.getSchool(parseInt(rowId));
                    const detailsHtml = renderSchoolDetails(school);
                    detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
                    detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
                })();
                promises.push(promise);
            }
        }

        await Promise.all(promises);

        for (const row of allDetailsRows) {
            row.classList.add('show');
        }
        for (const icon of allExpandIcons) {
            icon.classList.add('expanded');
        }
        expandAllIcon.classList.add('expanded');
        allExpanded = true;
    }
}

function updateExpandAllIcon() {
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (!expandAllIcon) return;

    const allExpandIcons = document.querySelectorAll('.expand-icon');
    const allExpandedCount = Array.from(allExpandIcons).filter(icon => icon.classList.contains('expanded')).length;

    if (allExpandedCount === 0) {
        expandAllIcon.classList.remove('expanded');
        allExpanded = false;
    } else if (allExpandedCount === allExpandIcons.length && allExpandIcons.length > 0) {
        expandAllIcon.classList.add('expanded');
        allExpanded = true;
    } else {
        expandAllIcon.style.opacity = '0.6';
        expandAllIcon.classList.remove('expanded');
        allExpanded = false;
    }
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

async function loadPage(page) {
    expandedRows.clear();
    allExpanded = false;
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.classList.remove('expanded');
        expandAllIcon.style.opacity = '1';
    }
    await SchoolsAPI.fetchSchools(page);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function validateSchoolForm() {
    const nameInput = document.getElementById('school-name');
    const name = nameInput ? nameInput.value : '';

    let isValid = true;

    clearFieldError(nameInput, 'name-error');

    if (!name.trim()) {
        showFieldError(nameInput, 'name-error', 'Введите название школы');
        isValid = false;
    } else if (name.trim().length < 2) {
        showFieldError(nameInput, 'name-error', 'Название должно содержать минимум 2 символа');
        isValid = false;
    } else if (name.trim().length > 200) {
        showFieldError(nameInput, 'name-error', 'Название не может быть длиннее 200 символов');
        isValid = false;
    }

    return isValid;
}

// Рендер списка программ с чекбоксами
function renderProgramsList(selectedProgramIds = []) {
    const container = document.getElementById('programs-list');
    if (!container) return;

    if (!allPrograms || allPrograms.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных программ</div>';
        return;
    }

    let html = '';
    for (const program of allPrograms) {
        const isChecked = selectedProgramIds.includes(program.id);
        html += `
            <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-bottom: 1px solid #f0ece6;">
                <input type="checkbox" class="program-checkbox" value="${program.id}" ${isChecked ? 'checked' : ''} style="margin-right: 12px; width: 18px; height: 18px;">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(program.name)}</div>
                    <div style="font-size: 12px; color: #8b7355;">${program.year ? `Год: ${program.year}` : 'Год не указан'}</div>
                </div>
            </label>
        `;
    }
    container.innerHTML = html;
}

function getSelectedProgramIds() {
    const checkboxes = document.querySelectorAll('#programs-list .program-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.value));
        }
    });
    return selectedIds;
}

async function handleSaveSchool(e) {
    e.preventDefault();
    if (!validateSchoolForm()) return;

    const schoolId = document.getElementById('school-id').value;
    const name = document.getElementById('school-name').value.trim();
    const comment = document.getElementById('school-comment').value.trim() || null;
    const programIds = getSelectedProgramIds();

    let result;
    if (schoolId) {
        result = await SchoolsAPI.updateSchool(schoolId, { name, comment, program_ids: programIds });
    } else {
        result = await SchoolsAPI.createSchool({ name, comment, program_ids: programIds });
    }

    if (result.success) {
        closeModal('school-modal');
        document.getElementById('school-form').reset();
        document.getElementById('school-id').value = '';
        expandedRows.clear();
        await SchoolsAPI.fetchSchools(currentPage);
    } else {
        const modalError = document.getElementById('modal-error');
        if (modalError) {
            modalError.textContent = result.error;
            modalError.style.display = 'block';
            setTimeout(() => { modalError.style.display = 'none'; }, 3000);
        }
    }
}

async function editSchool(schoolId) {
    try {
        const school = await SchoolsAPI.getSchool(schoolId);

        allPrograms = await ProgramsAPI.fetchAvailablePrograms();

        const selectedProgramIds = school.programs ? school.programs.map(p => p.id) : [];

        document.getElementById('modal-title').textContent = 'Редактирование школы';
        document.getElementById('modal-subtitle').textContent = 'Измените информацию о школе';
        document.getElementById('school-id').value = school.id;
        document.getElementById('school-name').value = school.name || '';
        document.getElementById('school-comment').value = school.comment || '';

        clearFieldError(document.getElementById('school-name'), 'name-error');

        renderProgramsList(selectedProgramIds);

        openModal('school-modal');
    } catch (error) {
        console.error('Ошибка загрузки школы:', error);
        showMessage('Ошибка загрузки данных школы', 'error');
    }
}

function openAddSchoolModal() {
    document.getElementById('modal-title').textContent = 'Добавление школы';
    document.getElementById('modal-subtitle').textContent = 'Заполните информацию о школе';
    document.getElementById('school-id').value = '';
    document.getElementById('school-name').value = '';
    document.getElementById('school-comment').value = '';

    clearFieldError(document.getElementById('school-name'), 'name-error');

    ProgramsAPI.fetchAvailablePrograms().then(programs => {
        allPrograms = programs;
        renderProgramsList([]);
    });

    openModal('school-modal');
}

function confirmDeleteSchool(schoolId) {
    currentDeleteSchoolId = schoolId;
    openModal('delete-modal');
}

async function handleDeleteSchool() {
    if (currentDeleteSchoolId) {
        const success = await SchoolsAPI.deleteSchool(currentDeleteSchoolId);
        if (success) {
            closeModal('delete-modal');
            expandedRows.clear();
            await SchoolsAPI.fetchSchools(currentPage);
        }
        currentDeleteSchoolId = null;
    }
}

function setupInputValidation() {
    const nameInput = document.getElementById('school-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            clearFieldError(nameInput, 'name-error');
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

// Функции для импорта/экспорта
async function downloadTemplate() {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/schools/template`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schools_template.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showMessage('Шаблон успешно скачан', 'success');
        } else {
            const data = await response.json();
            showMessage(data.error || 'Ошибка скачивания шаблона', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    }
}

async function exportSchools() {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/schools/export`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schools.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showMessage('Экспорт успешно выполнен', 'success');
        } else {
            const data = await response.json();
            showMessage(data.error || 'Ошибка экспорта', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    }
}

async function importSchools(file) {
    const token = Auth.getToken();
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_URL}/schools/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message, 'success');
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
            await SchoolsAPI.fetchSchools(currentPage);
        } else if (response.status === 207) {
            showMessage(data.message, 'info');
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
            await SchoolsAPI.fetchSchools(currentPage);
        } else {
            const errorDiv = document.getElementById('import-error');
            errorDiv.textContent = data.error;
            errorDiv.style.display = 'block';
            setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        const errorDiv = document.getElementById('import-error');
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    }
}

function openImportModal() {
    document.getElementById('import-file').value = '';
    document.getElementById('import-error').style.display = 'none';
    openModal('import-modal');
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await Auth.checkAuth();
    if (!isAuth) return;

    await SchoolsAPI.fetchSchools();
    setupPasswordToggles();
    setupInputValidation();
    setupDropdown();

    const addSchoolBtn = document.getElementById('add-school-btn');
    if (addSchoolBtn) addSchoolBtn.addEventListener('click', openAddSchoolModal);

    const templateBtn = document.getElementById('template-btn');
    if (templateBtn) templateBtn.addEventListener('click', downloadTemplate);

    const importBtn = document.getElementById('import-btn');
    if (importBtn) importBtn.addEventListener('click', openImportModal);

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportSchools);

    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.addEventListener('click', toggleAllSchools);
    }

    const schoolForm = document.getElementById('school-form');
    if (schoolForm) schoolForm.addEventListener('submit', handleSaveSchool);

    const logoutBtn = document.getElementById('logout-btn-menu');
    if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteSchool);

    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal('delete-modal'));

    const importSubmitBtn = document.getElementById('import-submit-btn');
    if (importSubmitBtn) {
        importSubmitBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('import-file');
            const file = fileInput.files[0];
            if (!file) {
                const errorDiv = document.getElementById('import-error');
                errorDiv.textContent = 'Выберите файл для импорта';
                errorDiv.style.display = 'block';
                setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
                return;
            }
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                const errorDiv = document.getElementById('import-error');
                errorDiv.textContent = 'Поддерживаются только файлы .xlsx и .xls';
                errorDiv.style.display = 'block';
                setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
                return;
            }
            importSchools(file);
        });
    }

    const cancelImportBtn = document.getElementById('cancel-import-btn');
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => {
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
        });
    }

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => {
        closeModal('school-modal');
        document.getElementById('school-form').reset();
        document.getElementById('school-id').value = '';
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
});