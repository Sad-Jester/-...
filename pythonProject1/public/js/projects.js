let currentPage = 1;
let currentDeleteProjectId = null;
let isAdmin = false;
let allPrograms = [];
let expandedRows = new Set();
let userRole = null;
let allExpanded = false;
let currentAssignment = {
    programId: null,
    schoolId: null,
    currentEmployeeId: null
};
let selectedEmployeeIdForAssignment = null;
let programVisibilityState = {};
let currentEditRecord = {
    recordId: null,
    programId: null,
    schoolId: null
};

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
        messageDiv.style.display = 'block';
        setTimeout(function() { messageDiv.style.display = 'none'; }, 3000);
    }
}

const Auth = {
    getToken: function() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    },
    removeToken: function() {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    },
    checkAuth: async function() {
        const token = this.getToken();
        if (!token) {
            window.location.href = '/';
            return false;
        }
        try {
            const response = await fetch(API_URL + '/profile', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (response.ok) {
                const user = await response.json();
                userRole = user.role;
                const isAdminUser = user.role === 'admin';
                const adminElements = document.querySelectorAll('.admin-only');
                adminElements.forEach(function(el) {
                    el.style.display = isAdminUser ? 'inline-flex' : 'none';
                });
                const dropdownBtn = document.getElementById('dropdownBtn');
                if (dropdownBtn) {
                    dropdownBtn.style.display = isAdminUser ? 'inline-flex' : 'none';
                }
                const usersLink = document.getElementById('users-link');
                if (usersLink) {
                    usersLink.style.display = isAdminUser ? 'inline-block' : 'none';
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
    logout: async function() {
        const token = this.getToken();
        try {
            await fetch(API_URL + '/logout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
        this.removeToken();
        window.location.href = '/';
    }
};

const ProgramsAPI = {
    fetchAllPrograms: async function() {
        const token = Auth.getToken();
        try {
            const response = await fetch(API_URL + '/programms?page=1&per_page=1000', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (response.ok) {
                const data = await response.json();
                return data.programms;
            }
            return [];
        } catch (error) {
            console.error('Ошибка загрузки программ:', error);
            return [];
        }
    }
};

const ProjectsAPI = {
    fetchProjects: async function(page = 1) {
        const token = Auth.getToken();
        try {
            const response = await fetch(API_URL + '/projects?page=' + page + '&per_page=10', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (response.ok) {
                const data = await response.json();
                isAdmin = data.is_admin;
                renderProjectsTable(data.projects);
                renderPagination(data);
                currentPage = data.page;
            } else if (response.status === 401) {
                Auth.removeToken();
                window.location.href = '/';
            } else {
                showMessage('Ошибка загрузки проектов', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showMessage('Ошибка соединения с сервером', 'error');
        }
    },

    getProject: async function(projectId) {
        const token = Auth.getToken();
        const response = await fetch(API_URL + '/projects/' + projectId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const data = await response.json();
            return {
                id: data.id,
                name: data.name,
                comment: data.comment,
                created_at: data.created_at,
                user_id: data.user_id,
                programs: data.programs || []
            };
        }
        throw new Error('Ошибка загрузки проекта');
    },

    createProject: async function(projectData) {
        const token = Auth.getToken();
        const response = await fetch(API_URL + '/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(projectData)
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Проект успешно создан', 'success');
            return { success: true, data: data };
        }
        return { success: false, error: data.error };
    },

    updateProject: async function(projectId, projectData) {
        const token = Auth.getToken();
        const response = await fetch(API_URL + '/projects/' + projectId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(projectData)
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Проект успешно обновлен', 'success');
            return { success: true, data: data };
        }
        return { success: false, error: data.error };
    },

    deleteProject: async function(projectId) {
        const token = Auth.getToken();
        const response = await fetch(API_URL + '/projects/' + projectId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            showMessage('Проект успешно удален', 'success');
            return true;
        }
        const data = await response.json();
        showMessage(data.error || 'Ошибка при удалении', 'error');
        return false;
    },

    exportProjects: async function() {
        const token = Auth.getToken();
        try {
            const response = await fetch(API_URL + '/projects/export', {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'projects.xlsx';
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
};

function formatDate(dateString) {
    if (!dateString) return '';
    // Парсим дату в формате YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
}

async function renderProjectDetailsForEmployeer(projectId, programs) {
    if (!programs || programs.length === 0) {
        return '<div style="padding: 20px; text-align: center; color: #b0a89d;">Нет привязанных программ</div>';
    }
    let html = '<div style="padding: 10px;">';
    for (const prog of programs) {
        const schools = await fetchEmployeeSchoolsByProgram(prog.id);
        html += '<div class="program-card" style="margin-bottom: 20px; background: white; border: 1px solid #e8e0d5; border-radius: 12px; overflow: hidden;">';
        html += '<div class="program-header" style="background-color: #c4a27a; color: white; padding: 12px 20px; font-weight: 600;">';
        html += '<i class="fas fa-code-branch"></i> ' + escapeHtml(prog.name) + (prog.year ? ' (' + prog.year + ')' : '');
        html += '</div><div class="program-body" style="padding: 15px 20px;">';
        if (schools.length === 0) {
            html += '<div style="padding: 15px; text-align: center; color: #b0a89d;">Нет привязанных школ</div>';
        } else {
            for (const school of schools) {
                html += '<div class="school-card" style="margin-bottom: 10px; background: #faf8f5; border: 1px solid #e8e0d5; border-radius: 10px; overflow: hidden;">';
                html += '<div class="school-header" style="background-color: #8b7355; color: white; padding: 10px 15px; font-weight: 600;">';
                html += '<i class="fas fa-school"></i> ' + escapeHtml(school.name);
                html += '</div>';
                if (school.comment) html += '<div style="padding: 10px 15px; font-size: 12px; color: #7a6b5d;">' + escapeHtml(school.comment) + '</div>';
                html += '</div>';
            }
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

async function fetchEmployeeSchoolsByProgram(programId) {
    if (!programId) return [];
    const token = Auth.getToken();
    try {
        const currentUserId = getUserIdFromToken();
        const response = await fetch(API_URL + '/projects/program-schools-employee/' + programId + '/' + currentUserId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки школ программы для сотрудника:', error);
        return [];
    }
}

function getUserIdFromToken() {
    const token = Auth.getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch (error) {
        console.error('Ошибка декодирования токена:', error);
        return null;
    }
}

async function createSchoolCopy(programId, schoolId, currentEmployeeId) {
    try {
        const token = Auth.getToken();
        openEmployeeModalForCopy(programId, schoolId, null, async function(newEmployeeId) {
            const response = await fetch(API_URL + '/projects/create-school-copy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    original_program_id: programId,
                    original_school_id: schoolId,
                    new_employee_id: newEmployeeId
                })
            });
            if (response.ok) {
                showMessage('Копия школы успешно создана', 'success');
                await refreshCurrentProjectDetails();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Ошибка при создании копии', 'error');
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    }
}

async function updateSchoolEmployee(recordId, programId, schoolId, currentEmployeeId) {
    try {
        const token = Auth.getToken();
        openEmployeeModalForUpdate(programId, schoolId, currentEmployeeId, async function(newEmployeeId) {
            const response = await fetch(API_URL + '/projects/update-school-employee', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    record_id: recordId,
                    employee_id: newEmployeeId
                })
            });
            if (response.ok) {
                showMessage('Сотрудник успешно обновлен', 'success');
                await refreshCurrentProjectDetails();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Ошибка при обновлении сотрудника', 'error');
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    }
}

async function renderProjectDetails(projectId, programs) {
    if (!programs || programs.length === 0) {
        return '<div style="padding: 20px; text-align: center; color: #b0a89d;"><i class="fas fa-code-branch" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>Нет доступных программ</div>';
    }

    let allHtml = '';
    const isEmployeer = (userRole === 'employeer');

    for (const prog of programs) {
        const schoolsData = await fetchProgramSchoolsWithIds(prog.id);
        const programContentId = 'program-content-' + projectId + '-' + prog.id;

        allHtml += '<div style="margin-bottom: 15px;">';
        allHtml += '<div class="program-header-clickable" style="background-color: #c4a27a; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 10px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="toggleProgramBlock(\'' + programContentId + '\', this)">';
        allHtml += '<div><i class="fas fa-code-branch"></i> ' + escapeHtml(prog.name) + (prog.year ? ' (' + prog.year + ')' : '') + '</div>';
        allHtml += '<span class="program-expand-icon" style="transform: rotate(0deg); display: inline-block; transition: transform 0.2s ease;">▼</span>';
        allHtml += '</div>';
        allHtml += '<div id="' + programContentId + '" style="display: none;">';

        if (schoolsData.length === 0) {
            allHtml += '<div style="padding: 20px; text-align: center; color: #b0a89d; background: white; border-radius: 8px; border: 1px solid #e8e0d5;">';
            allHtml += '<i class="fas fa-school" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>Нет привязанных школ и сотрудников</div>';
        } else {
            allHtml += '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; min-width: 900px; background: white; border-radius: 8px; overflow: hidden;">';
            allHtml += '<thead><tr style="background-color: #f5f2ed; border-bottom: 2px solid #e8e0d5;">';

            if (isEmployeer) {
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 35%;">Школа</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 20%;">Класс</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 20%;">Начало</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 25%;">Окончание</th>';
            } else {
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 17%;">Школа</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 8%;">Класс</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 12%;">Код группы</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 15%;">Ссылка</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 9%;">Начало</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 9%;">Окончание</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 20%;">Сотрудник</th>';
                allHtml += '<th style="padding: 10px; text-align: left; font-weight: 600; color: #5c4a3a; width: 10%;">Действия</th>';
            }

            allHtml += '<tr></thead><tbody>';

            for (const schoolData of schoolsData) {
                const schoolName = schoolData.name || 'Без названия';
                const records = schoolData.records || [];

                for (let idx = 0; idx < records.length; idx++) {
                    const record = records[idx];

                    const formattedStartDate = formatDate(record.start_date);
                    const formattedEndDate = formatDate(record.end_date);

                    allHtml += '<tr style="border-bottom: 1px solid #e8e0d5;">';
                    allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><div style="font-weight: 600; color: #3d3a35;">' + escapeHtml(schoolName) + '</div></td>';

                    if (isEmployeer) {
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + (record.class ? escapeHtml(String(record.class)) : '-') + '</span></td>';
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + (formattedStartDate || '-') + '</span></td>';
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + (formattedEndDate || '-') + '</span></td>';
                    } else {
                        // Класс - просто текст или "Пусто"
                        const classText = record.class ? escapeHtml(String(record.class)) : '<span style="color: #b0a89d;">Пусто</span>';
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + classText + '</span></td>';

                        // Код группы - просто текст или "Пусто"
                        const groupCodeText = record.group_code ? escapeHtml(String(record.group_code)) : '<span style="color: #b0a89d;">Пусто</span>';
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + groupCodeText + '</span></td>';

                        // Ссылка - просто текст или "Пусто"
                        const linkText = record.link ? '<a href="' + escapeHtml(String(record.link)) + '" target="_blank" style="color: #8b7355; text-decoration: none;">' + escapeHtml(String(record.link)) + '</a>' : '<span style="color: #b0a89d;">Пусто</span>';
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + linkText + '</span></td>';

                        // Дата начала
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + (formattedStartDate || '<span style="color: #b0a89d;">Пусто</span>') + '</span></td>';

                        // Дата окончания
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;"><span style="font-size: 13px;">' + (formattedEndDate || '<span style="color: #b0a89d;">Пусто</span>') + '</span></td>';

                        // Сотрудник - ФИО или "Пусто"
                        let employeeText = '<span style="color: #b0a89d;">Пусто</span>';
                        if (record.surname && record.name) {
                            let fullName = record.surname + ' ' + record.name;
                            if (record.patronymic) fullName += ' ' + record.patronymic;
                            employeeText = '<span style="font-size: 13px;">' + escapeHtml(fullName) + '</span>';
                        }
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;">' + employeeText + '</td>';

                        // Действия: кнопка редактирования ✎ и кнопка дублирования +
                        allHtml += '<td style="padding: 12px 10px; vertical-align: top;">';
                        allHtml += '<div style="display: flex; align-items: center; gap: 8px;">';
                        allHtml += '<button class="edit-record-btn" data-record-id="' + record.record_id + '" data-program-id="' + prog.id + '" data-school-id="' + schoolData.id + '" data-school-name="' + escapeHtml(schoolName) + '" style="background: none; border: none; color: #ffc107; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 16px; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;" title="Редактировать">✎</button>';
                        allHtml += '<button class="copy-school-btn" data-record-id="' + record.record_id + '" data-program-id="' + prog.id + '" data-school-id="' + schoolData.id + '" data-employee-id="' + (record.employee_id || '') + '" style="background: none; border: none; color: #28a745; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;" title="Создать копию">+</button>';
                        allHtml += '</div>';
                        allHtml += '</div>';
                    }

                    allHtml += '</tr>';
                }
            }
            allHtml += '</tbody></table></div>';
        }

        allHtml += '</div></div>';
    }
    return allHtml;
}

function toggleProgramBlock(contentId, headerElement) {
    const content = document.getElementById(contentId);
    const icon = headerElement.querySelector('.program-expand-icon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (icon) {
            icon.style.transform = 'rotate(90deg)';
        }
    } else {
        content.style.display = 'none';
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    }
}

async function fetchProgramSchoolsWithIds(programId) {
    if (!programId) return [];
    const token = Auth.getToken();
    try {
        const response = await fetch(API_URL + '/projects/program-schools-with-ids/' + programId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const data = await response.json();
            console.log('Raw data from backend:', JSON.stringify(data, null, 2));
            return data;
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки школ программы:', error);
        return [];
    }
}

function attachEmployeeButtonHandlers() {
    // ========== НОВЫЕ ОБРАБОТЧИКИ ==========
    // Обработчики для кнопок редактирования записи
    document.querySelectorAll('.edit-record-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const recordId = parseInt(this.dataset.recordId);
            const programId = parseInt(this.dataset.programId);
            const schoolId = parseInt(this.dataset.schoolId);
            const schoolName = this.dataset.schoolName || '';
            await openEditRecordModal(recordId, programId, schoolId, schoolName);
        });
    });
    // Обработчики для кнопок дублирования
    document.querySelectorAll('.copy-school-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const programId = parseInt(this.dataset.programId);
            const schoolId = parseInt(this.dataset.schoolId);
            const employeeId = this.dataset.employeeId ? parseInt(this.dataset.employeeId) : null;
            await createSchoolCopy(programId, schoolId, employeeId);
        });
    });
}

function openEmployeeModal(programId, schoolId, currentEmployeeId) {
    currentAssignment = { programId: programId, schoolId: schoolId, currentEmployeeId: currentEmployeeId };
    selectedEmployeeIdForAssignment = currentEmployeeId;
    window.employeeSelectionCallback = null;
    const container = document.getElementById('employees-list-container');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Загрузка...</div>';
    }
    loadEmployeesList(currentEmployeeId);
    openModal('employee-select-modal');
}

function openEmployeeModalForCopy(programId, schoolId, currentEmployeeId, callback) {
    currentAssignment = { programId: programId, schoolId: schoolId, currentEmployeeId: currentEmployeeId };
    selectedEmployeeIdForAssignment = currentEmployeeId;
    window.employeeSelectionCallback = callback;
    const container = document.getElementById('employees-list-container');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Загрузка...</div>';
    }
    loadEmployeesList(currentEmployeeId);
    openModal('employee-select-modal');
}

function openEmployeeModalForUpdate(programId, schoolId, currentEmployeeId, callback) {
    currentAssignment = { programId: programId, schoolId: schoolId, currentEmployeeId: currentEmployeeId };
    selectedEmployeeIdForAssignment = currentEmployeeId;
    window.employeeSelectionCallback = callback;
    const container = document.getElementById('employees-list-container');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Загрузка...</div>';
    }
    loadEmployeesList(currentEmployeeId);
    openModal('employee-select-modal');
}

async function loadEmployeesList(selectedEmployeeId) {
    const token = Auth.getToken();
    selectedEmployeeIdForAssignment = selectedEmployeeId;
    try {
        const response = await fetch(API_URL + '/employeers/list', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const employees = await response.json();
            renderEmployeesList(employees, selectedEmployeeId);
        } else {
            showMessage('Ошибка загрузки списка сотрудников', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    }
}

function renderEmployeesList(employees, selectedEmployeeId) {
    const container = document.getElementById('employees-list-container');
    if (!container) return;
    if (!employees || employees.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных сотрудников</div>';
        return;
    }
    let html = '';
    for (const emp of employees) {
        const fullName = emp.surname + ' ' + emp.name + (emp.patronymic ? ' ' + emp.patronymic : '');
        const isChecked = selectedEmployeeId === emp.id;
        html += '<label style="display: flex; align-items: center; gap: 15px; padding: 12px 15px; border-bottom: 1px solid #e8e0d5; cursor: pointer; transition: background-color 0.2s ease; ' + (isChecked ? 'background-color: #e8f5e9;' : '') + '">';
        html += '<input type="radio" name="employee-select" value="' + emp.id + '" ' + (isChecked ? 'checked' : '') + ' style="width: 18px; height: 18px; cursor: pointer;">';
        html += '<div style="flex: 1;"><div style="font-weight: 500; color: #3d3a35;">' + escapeHtml(fullName) + '</div>';
        html += '<div style="font-size: 12px; color: #8b7355;">' + escapeHtml(emp.email) + '</div></div></label>';
    }
    container.innerHTML = html;
    document.querySelectorAll('#employees-list-container input[type="radio"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
            e.stopPropagation();
            selectedEmployeeIdForAssignment = parseInt(e.target.value);
            document.querySelectorAll('#employees-list-container label').forEach(function(label) {
                label.style.backgroundColor = '';
            });
            const selectedLabel = radio.closest('label');
            if (selectedLabel) {
                selectedLabel.style.backgroundColor = '#e8f5e9';
            }
        });
    });
}

async function openEditRecordModal(recordId, programId, schoolId, schoolName) {
    currentEditRecord = { recordId, programId, schoolId };

    // Устанавливаем название школы в заголовке
    document.getElementById('edit-record-school-name').textContent = 'Школа: ' + schoolName;
    document.getElementById('edit-record-id').value = recordId;
    document.getElementById('edit-program-id').value = programId;
    document.getElementById('edit-school-id').value = schoolId;

    // Загружаем данные записи
    await loadRecordData(recordId);

    // Загружаем список сотрудников
    await loadEmployeesForEdit(programId, schoolId);

    openModal('edit-record-modal');
}

// Загрузка данных записи
async function loadRecordData(recordId) {
    const token = Auth.getToken();
    try {
        // Получаем данные о школах программы с ID записей
        const response = await fetch(`${API_URL}/projects/program-schools-with-ids/${currentEditRecord.programId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const schoolsData = await response.json();
            // Ищем нужную запись
            for (const school of schoolsData) {
                for (const record of school.records) {
                    if (record.record_id === recordId) {
                        // Заполняем поля формы
                        document.getElementById('edit-class').value = record.class || '';
                        document.getElementById('edit-group-code').value = record.group_code || '';
                        document.getElementById('edit-link').value = record.link || '';
                        document.getElementById('edit-start-date').value = record.start_date || '';
                        document.getElementById('edit-end-date').value = record.end_date || '';

                        // Сохраняем выбранного сотрудника
                        window.selectedEmployeeIdForEdit = record.employee_id || null;
                        return;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных записи:', error);
    }
}

// Загрузка списка сотрудников для редактирования
async function loadEmployeesForEdit(programId, schoolId) {
    const token = Auth.getToken();
    try {
        const response = await fetch(`${API_URL}/employeers/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const employees = await response.json();
            renderEmployeesForEdit(employees, window.selectedEmployeeIdForEdit);
        }
    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
    }
}

// Рендер списка сотрудников с радиокнопками
function renderEmployeesForEdit(employees, selectedEmployeeId) {
    const container = document.getElementById('edit-employees-list');
    if (!container) return;

    if (!employees || employees.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных сотрудников</div>';
        return;
    }

    let html = '';
    for (const emp of employees) {
        const fullName = emp.surname + ' ' + emp.name + (emp.patronymic ? ' ' + emp.patronymic : '');
        const isChecked = selectedEmployeeId === emp.id;
        html += '<label style="display: flex; align-items: center; gap: 15px; padding: 10px 15px; border-bottom: 1px solid #e8e0d5; cursor: pointer; transition: background-color 0.2s ease; ' + (isChecked ? 'background-color: #e8f5e9;' : '') + '">';
        html += '<input type="radio" name="employee-edit" value="' + emp.id + '" ' + (isChecked ? 'checked' : '') + ' style="width: 18px; height: 18px; cursor: pointer;">';
        html += '<div><div style="font-weight: 500; color: #3d3a35;">' + escapeHtml(fullName) + '</div>';
        html += '<div style="font-size: 12px; color: #8b7355;">' + escapeHtml(emp.email) + '</div></div></label>';
    }
    container.innerHTML = html;

    // Обновляем выбранного сотрудника при изменении радиокнопки
    document.querySelectorAll('#edit-employees-list input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            window.selectedEmployeeIdForEdit = parseInt(this.value);
            // Обновляем стили
            document.querySelectorAll('#edit-employees-list label').forEach(label => {
                label.style.backgroundColor = '';
            });
            this.closest('label').style.backgroundColor = '#e8f5e9';
        });
    });
}

// Сохранение изменений записи
async function saveEditRecord() {
    const recordId = document.getElementById('edit-record-id').value;
    const classValue = document.getElementById('edit-class').value.trim() || null;
    const groupCode = document.getElementById('edit-group-code').value.trim() || null;
    const link = document.getElementById('edit-link').value.trim() || null;
    const startDate = document.getElementById('edit-start-date').value || null;
    const endDate = document.getElementById('edit-end-date').value || null;
    const employeeId = window.selectedEmployeeIdForEdit || null;

    const saveBtn = document.querySelector('#edit-record-form .save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Сохранение...';
    saveBtn.disabled = true;

    const token = Auth.getToken();

    try {
        // Сначала обновляем текстовые поля и даты
        const fieldsToUpdate = [
            { field: 'class', value: classValue },
            { field: 'group_code', value: groupCode },
            { field: 'link', value: link },
            { field: 'start_date', value: startDate },
            { field: 'end_date', value: endDate }
        ];

        for (const field of fieldsToUpdate) {
            const response = await fetch(`${API_URL}/projects/update-field`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    record_id: parseInt(recordId),
                    field_name: field.field,
                    field_value: field.value
                })
            });

            if (!response.ok) {
                console.error(`Ошибка обновления поля ${field.field}`);
            }
        }

        // Обновляем сотрудника
        const response = await fetch(`${API_URL}/projects/update-school-employee`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                record_id: parseInt(recordId),
                employee_id: employeeId
            })
        });

        if (response.ok) {
            showMessage('Запись успешно обновлена', 'success');
            closeModal('edit-record-modal');
            await refreshCurrentProjectDetails();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Ошибка при обновлении', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function saveEmployeeAssignment() {
    const programId = currentAssignment.programId;
    const schoolId = currentAssignment.schoolId;
    const currentEmployeeId = currentAssignment.currentEmployeeId;
    if (selectedEmployeeIdForAssignment === null) {
        showMessage('Пожалуйста, выберите сотрудника', 'error');
        return;
    }
    const saveBtn = document.getElementById('save-employee-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Сохранение...';
    saveBtn.disabled = true;
    try {
        if (window.employeeSelectionCallback) {
            await window.employeeSelectionCallback(selectedEmployeeIdForAssignment);
            closeModal('employee-select-modal');
            currentAssignment = { programId: null, schoolId: null, currentEmployeeId: null };
            selectedEmployeeIdForAssignment = null;
            window.employeeSelectionCallback = null;
        } else {
            if (currentEmployeeId === selectedEmployeeIdForAssignment) {
                closeModal('employee-select-modal');
                currentAssignment = { programId: null, schoolId: null, currentEmployeeId: null };
                selectedEmployeeIdForAssignment = null;
                return;
            }
            const token = Auth.getToken();
            const response = await fetch(API_URL + '/projects/assign-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    program_id: programId,
                    school_id: schoolId,
                    employee_id: selectedEmployeeIdForAssignment
                })
            });
            if (response.ok) {
                showMessage('Сотрудник успешно назначен', 'success');
                closeModal('employee-select-modal');
                currentAssignment = { programId: null, schoolId: null, currentEmployeeId: null };
                selectedEmployeeIdForAssignment = null;
                await refreshCurrentProjectDetails();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Ошибка при назначении сотрудника', 'error');
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка соединения с сервером', 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

function cancelEmployeeSelection() {
    closeModal('employee-select-modal');
    currentAssignment = { programId: null, schoolId: null, currentEmployeeId: null };
    selectedEmployeeIdForAssignment = null;
    window.employeeSelectionCallback = null;
}

async function refreshCurrentProjectDetails() {
    // Сохраняем текущее состояние скрытости программ
    saveProgramVisibilityState();

    const openProjects = Array.from(expandedRows);
    for (const projectId of openProjects) {
        const detailsRow = document.getElementById('details-row-' + projectId);
        if (detailsRow && detailsRow.classList.contains('show')) {
            try {
                const project = await ProjectsAPI.getProject(projectId);
                const detailsHtml = await renderProjectDetails(projectId, project.programs);
                const detailsCell = detailsRow.querySelector('.details-cell');
                detailsCell.innerHTML = detailsHtml;
                detailsCell.setAttribute('data-loaded', 'true');
                attachEmployeeButtonHandlers();
            } catch (error) {
                console.error('Ошибка обновления проекта:', error);
            }
        }
    }

    // Восстанавливаем состояние скрытости программ после обновления
    setTimeout(() => {
        restoreProgramVisibilityState();
    }, 100);
}

async function fetchProgramSchools(programId) {
    if (!programId) return [];
    const token = Auth.getToken();
    try {
        const response = await fetch(API_URL + '/projects/program-schools/' + programId, {
            headers: { 'Authorization': 'Bearer ' + token }
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

async function fetchSchoolUsers(programId, schoolId) {
    if (!programId || !schoolId) return [];
    const token = Auth.getToken();
    try {
        const response = await fetch(API_URL + '/projects/program-school-employees/' + programId + '/' + schoolId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки сотрудников школы:', error);
        return [];
    }
}

async function toggleProjectDetails(projectId) {
    const detailsRow = document.getElementById('details-row-' + projectId);
    const expandIcon = document.getElementById('expand-icon-' + projectId);
    if (expandedRows.has(projectId)) {
        detailsRow.classList.remove('show');
        expandIcon.classList.remove('expanded');
        expandedRows.delete(projectId);
    } else {
        if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
            const project = await ProjectsAPI.getProject(projectId);
            const detailsHtml = await renderProjectDetails(projectId, project.programs);
            detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
            detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
            attachEmployeeButtonHandlers();
        }
        detailsRow.classList.add('show');
        expandIcon.classList.add('expanded');
        expandedRows.add(projectId);
    }
    updateExpandAllIcon();
}

async function toggleAllProjects() {
    const expandAllIcon = document.getElementById('expand-all-icon');
    const allExpandIcons = document.querySelectorAll('.expand-icon');
    const allDetailsRows = document.querySelectorAll('.project-details-row');
    if (allExpanded) {
        for (const row of allDetailsRows) row.classList.remove('show');
        for (const icon of allExpandIcons) icon.classList.remove('expanded');
        expandAllIcon.classList.remove('expanded');
        allExpanded = false;
    } else {
        const promises = [];
        for (const icon of allExpandIcons) {
            const rowId = icon.id.replace('expand-icon-', '');
            const detailsRow = document.getElementById('details-row-' + rowId);
            if (!detailsRow.querySelector('.details-cell').hasAttribute('data-loaded')) {
                promises.push((async function() {
                    const project = await ProjectsAPI.getProject(parseInt(rowId));
                    const detailsHtml = await renderProjectDetails(parseInt(rowId), project.programs);
                    detailsRow.querySelector('.details-cell').innerHTML = detailsHtml;
                    detailsRow.querySelector('.details-cell').setAttribute('data-loaded', 'true');
                })());
            }
        }
        await Promise.all(promises);
        for (const row of allDetailsRows) row.classList.add('show');
        for (const icon of allExpandIcons) icon.classList.add('expanded');
        expandAllIcon.classList.add('expanded');
        allExpanded = true;
    }
}

function updateExpandAllIcon() {
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (!expandAllIcon) return;
    const allExpandIcons = document.querySelectorAll('.expand-icon');
    const allExpandedCount = Array.from(allExpandIcons).filter(function(icon) { return icon.classList.contains('expanded'); }).length;
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

function renderProjectsTable(projects) {
    const tbody = document.getElementById('projects-table-body');
    if (!projects || projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Нет доступных проектов</td></tr>';
        return;
    }
    let html = '';
    for (const project of projects) {
        const projectName = project.name || 'Без названия';
        const projectComment = project.comment || '';
        const ownerName = (project.owner_surname && project.owner_name) ? project.owner_surname + ' ' + project.owner_name : (project.owner_login || 'Неизвестно');
        const showActions = userRole !== 'employeer';
        html += '<tr id="row-' + project.id + '">';
        html += '<td><span class="expand-icon" id="expand-icon-' + project.id + '" onclick="toggleProjectDetails(' + project.id + ')">▶</span></td>';
        html += '<td style="font-weight: 600;">' + escapeHtml(projectName) + '</td>';
        html += '<td>' + (escapeHtml(projectComment) || '-') + '</td>';
        html += '<td>' + escapeHtml(ownerName) + '</td>';
        html += '<td>' + (project.created_at || '-') + '</td>';
        if (showActions) {
            html += '<td><div class="action-buttons"><button class="edit-btn" onclick="editProject(' + project.id + ')">✎</button><button class="delete-btn" onclick="confirmDeleteProject(' + project.id + ')">❌</button></div></td>';
        } else {
            html += '<td></td>';
        }
        html += '</tr><tr id="details-row-' + project.id + '" class="project-details-row"><td colspan="6" class="details-cell"><div style="padding: 20px; text-align: center;">Загрузка...</div></td></tr>';
    }
    tbody.innerHTML = html;
    allExpanded = false;
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.classList.remove('expanded');
        expandAllIcon.style.opacity = '1';
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
    if (data.page > 1) html += '<button onclick="loadPage(' + (data.page - 1) + ')" class="page-btn">← Предыдущая</button>';
    html += '<span class="page-info">Страница ' + data.page + ' из ' + data.total_pages + '</span>';
    if (data.page < data.total_pages) html += '<button onclick="loadPage(' + (data.page + 1) + ')" class="page-btn">Следующая →</button>';
    html += '</div>';
    paginationDiv.innerHTML = html;
}

// Функция для сохранения состояния всех программ
function saveProgramVisibilityState() {
    programVisibilityState = {};
    document.querySelectorAll('[id^="program-content-"]').forEach(content => {
        const programId = content.id;
        const isVisible = content.style.display !== 'none';
        programVisibilityState[programId] = isVisible;
    });
}

// Функция для восстановления состояния программ
function restoreProgramVisibilityState() {
    for (const [programId, isVisible] of Object.entries(programVisibilityState)) {
        const content = document.getElementById(programId);
        if (content) {
            content.style.display = isVisible ? 'block' : 'none';
            // Обновляем иконку в соответствующем заголовке
            const header = content.previousElementSibling;
            if (header && header.classList.contains('program-header-clickable')) {
                const icon = header.querySelector('.program-expand-icon');
                if (icon) {
                    icon.style.transform = isVisible ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            }
        }
    }
}



async function loadPage(page) {
    expandedRows.clear();
    allExpanded = false;
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.classList.remove('expanded');
        expandAllIcon.style.opacity = '1';
    }
    await ProjectsAPI.fetchProjects(page);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderProgramsList(selectedProgramIds) {
    selectedProgramIds = selectedProgramIds || [];
    const container = document.getElementById('programs-list');
    if (!container) return;
    if (!allPrograms || allPrograms.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Нет доступных программ</div>';
        return;
    }
    let html = '';
    for (const prog of allPrograms) {
        const isChecked = selectedProgramIds.includes(prog.id);
        html += '<label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-bottom: 1px solid #f0ece6;">';
        html += '<input type="checkbox" class="program-checkbox" value="' + prog.id + '" ' + (isChecked ? 'checked' : '') + ' style="margin-right: 12px; width: 18px; height: 18px;">';
        html += '<div><div style="font-weight: 500;">' + escapeHtml(prog.name) + '</div>';
        html += '<div style="font-size: 12px; color: #8b7355;">' + (prog.year ? prog.year : 'Год не указан') + '</div></div></label>';
    }
    container.innerHTML = html;
}

function getSelectedProgramIds() {
    const checkboxes = document.querySelectorAll('.program-checkbox');
    const selectedIds = [];
    checkboxes.forEach(function(cb) {
        if (cb.checked) selectedIds.push(parseInt(cb.value));
    });
    return selectedIds;
}

function validateProjectForm() {
    const nameInput = document.getElementById('project-name');
    const name = nameInput ? nameInput.value : '';
    let isValid = true;
    clearFieldError(nameInput, 'name-error');
    if (!name.trim()) {
        showFieldError(nameInput, 'name-error', 'Введите название проекта');
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

async function handleSaveProject(e) {
    e.preventDefault();
    if (!validateProjectForm()) return;
    const projectId = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value.trim();
    const comment = document.getElementById('project-comment').value.trim() || null;
    const programIds = getSelectedProgramIds();
    let result;
    if (projectId) {
        result = await ProjectsAPI.updateProject(projectId, { name: name, comment: comment, program_ids: programIds });
    } else {
        result = await ProjectsAPI.createProject({ name: name, comment: comment, program_ids: programIds });
    }
    if (result.success) {
        closeModal('project-modal');
        document.getElementById('project-form').reset();
        document.getElementById('project-id').value = '';
        expandedRows.clear();
        await ProjectsAPI.fetchProjects(currentPage);
    } else {
        const modalError = document.getElementById('modal-error');
        if (modalError) {
            modalError.textContent = result.error;
            modalError.style.display = 'block';
            setTimeout(function() { modalError.style.display = 'none'; }, 3000);
        }
    }
}

async function editProject(projectId) {
    try {
        resetModalToEditMode();
        const project = await ProjectsAPI.getProject(projectId);
        allPrograms = await ProgramsAPI.fetchAllPrograms();
        const selectedProgramIds = project.programs ? project.programs.map(function(prog) { return prog.id; }) : [];
        document.getElementById('modal-title').textContent = 'Редактирование проекта';
        document.getElementById('modal-subtitle').textContent = 'Измените информацию о проекте';
        document.getElementById('project-id').value = project.id;
        document.getElementById('project-name').value = project.name || '';
        document.getElementById('project-comment').value = project.comment || '';
        clearFieldError(document.getElementById('project-name'), 'name-error');
        await renderProgramsList(selectedProgramIds);
        openModal('project-modal');
    } catch (error) {
        console.error('Ошибка загрузки проекта:', error);
        showMessage('Ошибка загрузки данных проекта', 'error');
    }
}

function confirmDeleteProject(projectId) {
    currentDeleteProjectId = projectId;
    openModal('delete-modal');
}

async function handleDeleteProject() {
    if (currentDeleteProjectId) {
        const success = await ProjectsAPI.deleteProject(currentDeleteProjectId);
        if (success) {
            closeModal('delete-modal');
            expandedRows.clear();
            await ProjectsAPI.fetchProjects(currentPage);
        }
        currentDeleteProjectId = null;
    }
}

function openAddProjectModal() {
    resetModalToEditMode();
    document.getElementById('modal-title').textContent = 'Создание проекта';
    document.getElementById('modal-subtitle').textContent = 'Заполните информацию о проекте';
    document.getElementById('project-id').value = '';
    document.getElementById('project-name').value = '';
    document.getElementById('project-comment').value = '';
    clearFieldError(document.getElementById('project-name'), 'name-error');
    ProgramsAPI.fetchAllPrograms().then(function(programs) {
        allPrograms = programs;
        renderProgramsList([]);
    });
    openModal('project-modal');
}

function resetModalToEditMode() {
    document.getElementById('project-name').disabled = false;
    document.getElementById('project-comment').disabled = false;
    const container = document.getElementById('programs-list');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: #b0a89d; padding: 20px;">Загрузка программ...</div>';
    }
}

function setupInputValidation() {
    const nameInput = document.getElementById('project-name');
    if (nameInput) {
        nameInput.addEventListener('input', function() { clearFieldError(nameInput, 'name-error'); });
    }
}

function setupDropdown() {
    const dropdownBtn = document.getElementById('dropdownBtn');
    const dropdownContent = document.getElementById('dropdownContent');
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });
        document.addEventListener('click', function(e) {
            if (!dropdownBtn.contains(e.target)) {
                dropdownContent.classList.remove('show');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const isAuth = await Auth.checkAuth();
    if (!isAuth) return;
    await ProjectsAPI.fetchProjects();
    setupPasswordToggles();
    setupInputValidation();
    setupDropdown();
    const addProjectBtn = document.getElementById('add-project-btn');
    if (addProjectBtn && userRole === 'employeer') {
        addProjectBtn.style.display = 'none';
    }
    if (addProjectBtn) addProjectBtn.addEventListener('click', openAddProjectModal);
    const projectForm = document.getElementById('project-form');
    if (projectForm) projectForm.addEventListener('submit', handleSaveProject);
    const logoutBtn = document.getElementById('logout-btn-menu');
    if (logoutBtn) logoutBtn.addEventListener('click', function() { Auth.logout(); });
    const expandAllIcon = document.getElementById('expand-all-icon');
    if (expandAllIcon) {
        expandAllIcon.addEventListener('click', toggleAllProjects);
    }
    const cancelEmployeeBtn = document.getElementById('cancel-employee-btn');
    if (cancelEmployeeBtn) {
        cancelEmployeeBtn.addEventListener('click', cancelEmployeeSelection);
    }
    const saveEmployeeBtn = document.getElementById('save-employee-btn');
    if (saveEmployeeBtn) {
        saveEmployeeBtn.addEventListener('click', saveEmployeeAssignment);
    }
    const closeButtons = document.querySelectorAll('#employee-select-modal .close-button');
    closeButtons.forEach(function(btn) {
        btn.addEventListener('click', cancelEmployeeSelection);
    });
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteProject);
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', function() { closeModal('delete-modal'); });
    document.querySelectorAll('.close-button').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    const exportBtn = document.getElementById('export-projects-btn');
    if (exportBtn && userRole === 'admin') {
        exportBtn.style.display = 'inline-flex';
        exportBtn.addEventListener('click', () => ProjectsAPI.exportProjects());
    }
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', function() {
        closeModal('project-modal');
        document.getElementById('project-form').reset();
        document.getElementById('project-id').value = '';
        resetModalToEditMode();
    });
    // Обработчики для модального окна редактирования записи
    const editRecordForm = document.getElementById('edit-record-form');
    if (editRecordForm) {
        editRecordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveEditRecord();
        });
    }

    const cancelEditRecordBtn = document.getElementById('cancel-edit-record-btn');
    if (cancelEditRecordBtn) {
        cancelEditRecordBtn.addEventListener('click', () => closeModal('edit-record-modal'));
    }

    // Закрытие модального окна по крестику
    const editRecordModalClose = document.querySelector('#edit-record-modal .close-button');
    if (editRecordModalClose) {
        editRecordModalClose.addEventListener('click', () => closeModal('edit-record-modal'));
    }
    window.addEventListener('click', function(e) {
        if (e.target.classList && e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
});