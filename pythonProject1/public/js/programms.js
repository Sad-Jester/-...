let currentPage = 1;
let currentDeleteProgramId = null;
let isAdmin = false;
let allEmployees = [];
let expandedRows = new Set();
let allSchools = [];
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
                    if (user.role === 'admin') {
                        usersLink.style.display = 'inline-flex';
                        usersLink.style.pointerEvents = 'auto';
                    } else {
                        usersLink.style.display = 'none';
                    }
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

// Модуль API сотрудников
const EmployeesAPI = {
    async fetchAllEmployees() {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/employees?page=1&per_page=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                return data.employees;
            }
            return [];
        } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error);
            return [];
        }
    }
};

// Модуль API программ
const ProgrammsAPI = {
    async fetchProgramms(page = 1) {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/programms?page=${page}&per_page=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                isAdmin = data.is_admin;
                renderProgrammsTable(data.programms);
                renderPagination(data);
                currentPage = data.page;
            } else if (response.status === 401) {
                Auth.removeToken();
                window.location.href = '/';
            } else {
                showMessage('Ошибка загрузки программ', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showMessage('Ошибка соединения с сервером', 'error');
        }
    },

        async getProgram(programId) {
            const token = Auth.getToken();
            const response = await fetch(`${API_URL}/programms/${programId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    id: data.id,
                    name: data.name,
                    comment: data.comment,
                    year: data.year,
                    created_at: data.created_at,
                    user_id: data.user_id,
                    schools: data.schools || []  // школы приходят из program_school_employees
                };
            }
            throw new Error('Ошибка загрузки программы');
        },

        async createProgram(programData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/programms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                name: programData.name,
                comment: programData.comment,
                year: programData.year,
                employee_ids: programData.employee_ids || [],
                school_ids: programData.school_ids || []  // Добавьте эту строку
            })
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Программа успешно добавлена', 'success');
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

        async updateProgram(programId, programData) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/programms/${programId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                name: programData.name,
                comment: programData.comment,
                year: programData.year,
                employee_ids: programData.employee_ids || [],
                school_ids: programData.school_ids || []  // Добавьте эту строку
            })
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Программа успешно обновлена', 'success');
            return { success: true, data };
        }
        return { success: false, error: data.error };
    },

    async deleteProgram(programId) {
        const token = Auth.getToken();
        const response = await fetch(`${API_URL}/programms/${programId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showMessage('Программа успешно удалена', 'success');
            return true;
        }
        const data = await response.json();
        showMessage(data.error || 'Ошибка при удалении', 'error');
        return false;
    }
};

// Добавьте модуль API школ
const SchoolsAPI = {
    async fetchAllSchools() {
        const token = Auth.getToken();
        try {
            const response = await fetch(`${API_URL}/schools?page=1&per_page=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                return data.schools;
            }
            return [];
        } catch (error) {
            console.error('Ошибка загрузки школ:', error);
            return [];
        }
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

// Функция рендера списка школ с чекбоксами
function renderSchoolsList(selectedSchoolIds = []) {
    const container = document.getElementById('edit-schools-list');
    if (!container) return;

    if (!allSchools || allSchools.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных школ</div>';
        return;
    }

    let html = '';
    for (const school of allSchools) {
        const isChecked = selectedSchoolIds.includes(school.id);
        html += `
            <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-bottom: 1px solid #f0ece6;">
                <input type="checkbox" class="school-checkbox" value="${school.id}" ${isChecked ? 'checked' : ''} style="margin-right: 12px; width: 18px; height: 18px;">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(school.name)}</div>
                    <div style="font-size: 12px; color: #8b7355;">${school.comment ? escapeHtml(school.comment.substring(0, 50)) : 'Без комментария'}</div>
                </div>
            </label>
        `;
    }
    container.innerHTML = html;
}

function getSelectedSchoolIds() {
    const checkboxes = document.querySelectorAll('#edit-schools-list .school-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.value));
        }
    });
    return selectedIds;
}

async function renderProgramDetails(programId, program) {
    // Получаем школы программы через API
    const schools = await fetchProgramSchools(programId);

    if (schools.length === 0) {
        return `
            <div style="padding: 20px; text-align: center; color: #b0a89d;">
                <i class="fas fa-school" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                Нет привязанных школ
            </div>
        `;
    }

    let html = `
        <div style="padding: 10px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f5f2ed; border-bottom: 2px solid #e8e0d5;">
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 40%;">Школа</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 35%;">Комментарий к школе</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 25%;">Сотрудники</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const school of schools) {
        const employees = school.employees || [];
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
                    <div style="font-weight: 600; color: #3d3a35;">${escapeHtml(school.name)}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; color: #b0a89d; font-size: 12px;">
                    ${school.comment ? escapeHtml(school.comment.substring(0, 100)) : '-'}
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

async function fetchProgramSchools(programId) {
    if (!programId) return [];

    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/projects/program-schools/${programId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки школ программы:', error);
        return [];
    }
}

// Переключение раскрытия строки
async function toggleProgramDetails(programId) {
    const detailsRow = document.getElementById(`details-row-${programId}`);
    const expandIcon = document.getElementById(`expand-icon-${programId}`);

    if (expandedRows.has(programId)) {
        detailsRow.classList.remove('show');
        expandIcon.classList.remove('expanded');
        expandedRows.delete(programId);
    } else {
        if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
            const program = await ProgrammsAPI.getProgram(programId);
            const detailsHtml = await renderProgramDetails(programId, program);
            detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
            detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
        }
        detailsRow.classList.add('show');
        expandIcon.classList.add('expanded');
        expandedRows.add(programId);
    }

    // Обновляем состояние иконки массового раскрытия
    updateExpandAllIcon();
}

function renderProgrammsTable(programms) {
    const tbody = document.getElementById('programms-table-body');
    if (!programms || programms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Нет доступных программ</td></tr>';
        return;
    }

    let html = '';
    for (const program of programms) {
        const ownerName = (program.owner_surname && program.owner_name)
            ? `${program.owner_surname} ${program.owner_name}`
            : (program.owner_login || 'Неизвестно');
        const comment = program.comment || '-';
        const year = program.year ? `<span class="year-badge">${program.year}</span>` : '-';

        html += `
            <tr id="row-${program.id}">
                <td>
                    <span class="expand-icon" id="expand-icon-${program.id}" onclick="toggleProgramDetails(${program.id})">
                        ▶
                    </span>
                </td>
                <td style="font-weight: 600;">${escapeHtml(program.name)}</td>
                <td>${escapeHtml(comment)}</td>
                <td>${year}</td>
                <td>${escapeHtml(ownerName)}</td>
                <td>${program.created_at || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="editProgram(${program.id})">✎</button>
                        <button class="delete-btn" onclick="confirmDeleteProgram(${program.id})">❌</button>
                    </div>
                </td>
            </tr>
            <tr id="details-row-${program.id}" class="details-row">
                <td colspan="7" class="details-cell">
                    <div style="padding: 20px; text-align: center;">Загрузка...</div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;

    // Сбрасываем состояние массового раскрытия при новой загрузке
    allExpanded = false;
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.classList.remove('expanded');
        expandAllIcon.style.opacity = '1';
    }
}

// Функция для массового раскрытия/закрытия всех строк
async function toggleAllPrograms() {
    const expandAllIcon = document.getElementById('expand-all-icon');
    const allExpandIcons = document.querySelectorAll('.expand-icon');
    const allDetailsRows = document.querySelectorAll('.details-row');

    if (allExpanded) {
        // Закрываем все строки
        for (const row of allDetailsRows) {
            row.classList.remove('show');
        }
        for (const icon of allExpandIcons) {
            icon.classList.remove('expanded');
        }
        expandAllIcon.classList.remove('expanded');
        allExpanded = false;
    } else {
        // Открываем все строки
        // Сначала загружаем данные для всех не загруженных строк
        const promises = [];
        for (const icon of allExpandIcons) {
            const rowId = icon.id.replace('expand-icon-', '');
            const detailsRow = document.getElementById(`details-row-${rowId}`);

            if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
                // Создаём промис для загрузки данных
                const promise = (async () => {
                    const program = await ProgrammsAPI.getProgram(parseInt(rowId));
                    const detailsHtml = await renderProgramDetails(parseInt(rowId), program);
                    detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
                    detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
                })();
                promises.push(promise);
            }
        }

        // Ждём загрузки всех данных
        await Promise.all(promises);

        // Открываем все строки
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

// Функция для обновления состояния иконки массового раскрытия
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
        // Частичное раскрытие - иконка остаётся в промежуточном состоянии
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
    await ProgrammsAPI.fetchProgramms(page);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Рендер списка сотрудников в режиме редактирования (с чекбоксами)
function renderEmployeesList(selectedEmployeeIds = []) {
    const container = document.getElementById('employees-list');
    if (!container) return;

    if (!allEmployees || allEmployees.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных сотрудников</div>';
        return;
    }

    let html = '';
    for (const emp of allEmployees) {
        const fullName = `${emp.lastname} ${emp.firstname}${emp.patronymic ? ' ' + emp.patronymic : ''}`;
        const isChecked = selectedEmployeeIds.includes(emp.id);
        html += `
            <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-bottom: 1px solid #f0ece6;">
                <input type="checkbox" class="employee-checkbox" value="${emp.id}" ${isChecked ? 'checked' : ''} style="margin-right: 12px; width: 18px; height: 18px;">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(fullName)}</div>
                    <div style="font-size: 12px; color: #8b7355;">${escapeHtml(emp.spec)}</div>
                </div>
            </label>
        `;
    }
    container.innerHTML = html;
}

function getSelectedEmployeeIds() {
    const checkboxes = document.querySelectorAll('.employee-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.value));
        }
    });
    return selectedIds;
}

function validateProgramForm() {
    const nameInput = document.getElementById('program-name');
    const name = nameInput ? nameInput.value : '';
    const yearInput = document.getElementById('program-year');
    const year = yearInput ? yearInput.value : '';

    let isValid = true;

    clearFieldError(nameInput, 'name-error');
    clearFieldError(yearInput, 'year-error');

    if (!name.trim()) {
        showFieldError(nameInput, 'name-error', 'Введите название программы');
        isValid = false;
    } else if (name.trim().length < 2) {
        showFieldError(nameInput, 'name-error', 'Название должно содержать минимум 2 символа');
        isValid = false;
    } else if (name.trim().length > 200) {
        showFieldError(nameInput, 'name-error', 'Название не может быть длиннее 200 символов');
        isValid = false;
    }

    if (year && year.trim()) {
        const yearNum = parseInt(year);
        if (isNaN(yearNum)) {
            showFieldError(yearInput, 'year-error', 'Год должен быть числом');
            isValid = false;
        } else if (yearNum < 1900 || yearNum > 2100) {
            showFieldError(yearInput, 'year-error', 'Год должен быть в диапазоне 1900-2100');
            isValid = false;
        }
    }

    return isValid;
}

async function handleSaveProgram(e) {
    e.preventDefault();
    if (!validateProgramForm()) return;

    const programId = document.getElementById('program-id').value;
    const name = document.getElementById('program-name').value.trim();
    const comment = document.getElementById('program-comment').value.trim() || null;
    const year = document.getElementById('program-year').value.trim() || null;
    const employeeIds = getSelectedEmployeeIds();
    const schoolIds = getSelectedSchoolIds(); // Добавьте получение школ

    let result;
    if (programId) {
        result = await ProgrammsAPI.updateProgram(programId, {
            name,
            comment,
            year,
            employee_ids: employeeIds,
            school_ids: schoolIds  // Добавьте школы
        });
    } else {
        result = await ProgrammsAPI.createProgram({
            name,
            comment,
            year,
            employee_ids: employeeIds,
            school_ids: schoolIds  // Добавьте школы
        });
    }

    if (result.success) {
        closeModal('program-modal');
        document.getElementById('program-form').reset();
        document.getElementById('program-id').value = '';
        expandedRows.clear();
        await ProgrammsAPI.fetchProgramms(currentPage);
    } else {
        const modalError = document.getElementById('modal-error');
        if (modalError) {
            modalError.textContent = result.error;
            modalError.style.display = 'block';
            setTimeout(() => { modalError.style.display = 'none'; }, 3000);
        }
    }
}


async function editProgram(programId) {
    try {
        resetModalToEditMode();

        const program = await ProgrammsAPI.getProgram(programId);

        // Загружаем сотрудников и школы
        allEmployees = await EmployeesAPI.fetchAllEmployees();
        allSchools = await SchoolsAPI.fetchAllSchools();

        const selectedEmployeeIds = program.employees ? program.employees.map(emp => emp.id) : [];
        const selectedSchoolIds = program.schools ? program.schools.map(school => school.id) : [];

        document.getElementById('modal-title').textContent = 'Редактирование программы';
        document.getElementById('modal-subtitle').textContent = 'Измените информацию о программе';
        document.getElementById('program-id').value = program.id;
        document.getElementById('program-name').value = program.name || '';
        document.getElementById('program-comment').value = program.comment || '';
        document.getElementById('program-year').value = program.year || '';
        document.getElementById('program-name').disabled = false;
        document.getElementById('program-comment').disabled = false;
        document.getElementById('program-year').disabled = false;

        clearFieldError(document.getElementById('program-name'), 'name-error');
        clearFieldError(document.getElementById('program-year'), 'year-error');

        // Отображаем списки
        renderEmployeesList(selectedEmployeeIds);
        renderSchoolsList(selectedSchoolIds);  // Добавьте эту строку

        const saveBtn = document.querySelector('#program-form .save-btn');
        const cancelBtn = document.querySelector('#program-form .cancel-btn');
        if (saveBtn) saveBtn.style.display = 'block';
        if (cancelBtn) cancelBtn.style.display = 'block';

        const closeViewBtn = document.getElementById('close-view-btn');
        if (closeViewBtn) closeViewBtn.style.display = 'none';

        openModal('program-modal');
    } catch (error) {
        console.error('Ошибка загрузки программы:', error);
        showMessage('Ошибка загрузки данных программы', 'error');
    }
}

function confirmDeleteProgram(programId) {
    currentDeleteProgramId = programId;
    openModal('delete-modal');
}

async function handleDeleteProgram() {
    if (currentDeleteProgramId) {
        const success = await ProgrammsAPI.deleteProgram(currentDeleteProgramId);
        if (success) {
            closeModal('delete-modal');
            expandedRows.clear();
            await ProgrammsAPI.fetchProgramms(currentPage);
        }
        currentDeleteProgramId = null;
    }
}

function openAddProgramModal() {
    resetModalToEditMode();

    document.getElementById('modal-title').textContent = 'Добавление программы';
    document.getElementById('modal-subtitle').textContent = 'Заполните информацию о программе';
    document.getElementById('program-id').value = '';
    document.getElementById('program-name').value = '';
    document.getElementById('program-comment').value = '';
    document.getElementById('program-year').value = '';
    document.getElementById('program-name').disabled = false;
    document.getElementById('program-comment').disabled = false;
    document.getElementById('program-year').disabled = false;

    clearFieldError(document.getElementById('program-name'), 'name-error');
    clearFieldError(document.getElementById('program-year'), 'year-error');

    // Загружаем сотрудников и школы
    Promise.all([
        EmployeesAPI.fetchAllEmployees(),
        SchoolsAPI.fetchAllSchools()
    ]).then(([employees, schools]) => {
        allEmployees = employees;
        allSchools = schools;
        renderEmployeesList([]);
        renderSchoolsList([]);
    });

    const saveBtn = document.querySelector('#program-form .save-btn');
    const cancelBtn = document.querySelector('#program-form .cancel-btn');
    if (saveBtn) saveBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'block';

    const closeViewBtn = document.getElementById('close-view-btn');
    if (closeViewBtn) closeViewBtn.style.display = 'none';

    openModal('program-modal');
}

function resetModalToEditMode() {
    document.getElementById('program-name').disabled = false;
    document.getElementById('program-comment').disabled = false;
    document.getElementById('program-year').disabled = false;

    document.getElementById('program-comment').placeholder = 'Введите комментарий (необязательно)';

    const requiredStar = document.querySelector('#program-name-label .required');
    if (requiredStar) {
        requiredStar.style.display = 'inline';
    }

    const saveBtn = document.querySelector('#program-form .save-btn');
    const cancelBtn = document.querySelector('#program-form .cancel-btn');
    if (saveBtn) saveBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'block';

    const closeViewBtn = document.getElementById('close-view-btn');
    if (closeViewBtn) closeViewBtn.style.display = 'none';

    const container = document.getElementById('employees-list');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Загрузка сотрудников...</div>';
    }
}

function setupInputValidation() {
    const nameInput = document.getElementById('program-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            clearFieldError(nameInput, 'name-error');
        });
    }

    const yearInput = document.getElementById('program-year');
    if (yearInput) {
        yearInput.addEventListener('input', () => {
            clearFieldError(yearInput, 'year-error');
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
        const response = await fetch(`${API_URL}/programms/template`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'programms_template.xlsx';
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

async function exportProgramms() {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/programms/export`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'programms.xlsx';
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

async function importProgramms(file) {
    const token = Auth.getToken();
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_URL}/programms/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message, 'success');
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
            await ProgrammsAPI.fetchProgramms(currentPage);
        } else if (response.status === 207) {
            // Частичный успех
            showMessage(data.message, 'info');
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
            await ProgrammsAPI.fetchProgramms(currentPage);
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

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await Auth.checkAuth();
    if (!isAuth) return;

    await ProgrammsAPI.fetchProgramms();
    setupPasswordToggles();
    setupInputValidation();
    setupDropdown();

    // Кнопка добавления программы
    const addProgramBtn = document.getElementById('add-program-btn');
    if (addProgramBtn) addProgramBtn.addEventListener('click', openAddProgramModal);

    // Кнопки импорта/экспорта
    const templateBtn = document.getElementById('template-btn');
    if (templateBtn) templateBtn.addEventListener('click', downloadTemplate);

    const importBtn = document.getElementById('import-btn');
    if (importBtn) importBtn.addEventListener('click', openImportModal);

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportProgramms);

    // Форма программы
    const programForm = document.getElementById('program-form');
    if (programForm) programForm.addEventListener('submit', handleSaveProgram);

    // Кнопка выхода
    const logoutBtn = document.getElementById('logout-btn-menu');
    if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

    // Кнопки подтверждения удаления
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteProgram);

    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal('delete-modal'));

    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.addEventListener('click', toggleAllPrograms);
    }

    // Кнопки импорта
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
            importProgramms(file);
        });
    }

    const cancelImportBtn = document.getElementById('cancel-import-btn');
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => {
            closeModal('import-modal');
            document.getElementById('import-file').value = '';
        });
    }

    // Закрытие модальных окон по крестику
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    // Кнопка отмены в модальном окне программы
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => {
        closeModal('program-modal');
        document.getElementById('program-form').reset();
        document.getElementById('program-id').value = '';
        resetModalToEditMode();
    });

    // Закрытие модальных окон по клику вне окна
    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
});