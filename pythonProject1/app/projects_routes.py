from flask import Blueprint, request, jsonify, send_file
from app.database import get_db_connection
from app.utils import token_required, log_action
from app.validators import Validators
import pandas as pd
import io
from openpyxl.styles import Font, PatternFill, Alignment

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/projects', methods=['GET'])
@token_required
def get_projects(current_user):
    """Получение списка проектов с программами, школами и сотрудниками"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    offset = (page - 1) * per_page

    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

    with get_db_connection() as conn:
        cur = conn.cursor()

        if user_role == 'admin':
            # Админ видит все проекты
            cur.execute('SELECT COUNT(*) FROM projects')
            total = cur.fetchone()['count']

            cur.execute('''
                SELECT 
                    p.id, p.name, p.comment, p.user_id, p.created_at,
                    u.login as owner_login, u.surname as owner_surname, u.name as owner_name
                FROM projects p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            ''', (per_page, offset))

        elif user_role == 'employeer':
            # Сотрудник видит проекты, где есть его привязка к программам
            cur.execute('''
                SELECT COUNT(DISTINCT p.id)
                FROM projects p
                JOIN project_programs pp ON p.id = pp.project_id
                JOIN program_school_employees pse ON pp.program_id = pse.program_id
                WHERE pse.employee_id = %s
            ''', (user_id,))
            total = cur.fetchone()['count']

            cur.execute('''
                SELECT DISTINCT
                    p.id, p.name, p.comment, p.user_id, p.created_at,
                    u.login as owner_login, u.surname as owner_surname, u.name as owner_name
                FROM projects p
                JOIN users u ON p.user_id = u.id
                JOIN project_programs pp ON p.id = pp.project_id
                JOIN program_school_employees pse ON pp.program_id = pse.program_id
                WHERE pse.employee_id = %s
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            ''', (user_id, per_page, offset))

        else:
            # Другие роли видят только свои проекты
            cur.execute('SELECT COUNT(*) FROM projects WHERE user_id = %s', (user_id,))
            total = cur.fetchone()['count']

            cur.execute('''
                SELECT 
                    p.id, p.name, p.comment, p.user_id, p.created_at,
                    u.login as owner_login, u.surname as owner_surname, u.name as owner_name
                FROM projects p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = %s
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            ''', (user_id, per_page, offset))

        projects = cur.fetchall()

        # Для каждого проекта получаем программы, школы и сотрудников
        for project in projects:
            if project.get('created_at'):
                project['created_at'] = project['created_at'].strftime('%Y-%m-%d %H:%M:%S')

            # Получаем программы проекта
            if user_role == 'employeer':
                cur.execute('''
                    SELECT DISTINCT pr.id, pr.name, pr.year
                    FROM project_programs pp
                    JOIN programms pr ON pp.program_id = pr.id
                    JOIN program_school_employees pse ON pr.id = pse.program_id
                    WHERE pp.project_id = %s AND pse.employee_id = %s
                ''', (project['id'], user_id))
            else:
                cur.execute('''
                    SELECT pr.id, pr.name, pr.year
                    FROM project_programs pp
                    JOIN programms pr ON pp.program_id = pr.id
                    WHERE pp.project_id = %s
                ''', (project['id'],))

            programs = cur.fetchall()

            # Для каждой программы получаем школы и сотрудников
            for program in programs:
                if user_role == 'employeer':
                    # Только школы, где есть этот сотрудник
                    cur.execute('''
                        SELECT DISTINCT s.id, s.name, s.comment
                        FROM program_school_employees pse
                        JOIN schools s ON pse.school_id = s.id
                        WHERE pse.program_id = %s AND pse.employee_id = %s
                    ''', (program['id'], user_id))
                else:
                    # Для администратора - все школы программы
                    cur.execute('''
                        SELECT DISTINCT s.id, s.name, s.comment
                        FROM program_school_employees pse
                        JOIN schools s ON pse.school_id = s.id
                        WHERE pse.program_id = %s
                    ''', (program['id'],))

                schools = cur.fetchall() or []

                # Для каждой школы получаем сотрудников (только для администратора)
                for school in schools:
                    if user_role == 'admin':
                        # ✅ Админ видит ВСЕХ сотрудников, привязанных к этой связке
                        cur.execute('''
                            SELECT DISTINCT 
                                u.id, 
                                u.surname, 
                                u.name, 
                                u.patronymic, 
                                u.login, 
                                u.email
                            FROM program_school_employees pse
                            JOIN users u ON pse.employee_id = u.id
                            WHERE pse.program_id = %s 
                                AND pse.school_id = %s 
                                AND u.role = 'employeer'
                                AND pse.employee_id IS NOT NULL
                            ORDER BY u.surname, u.name
                        ''', (program['id'], school['id']))
                        school['users'] = cur.fetchall() or []
                    else:
                        # Сотрудник видит только себя
                        cur.execute('''
                            SELECT 
                                u.id, u.surname, u.name, u.patronymic, u.login, u.email
                            FROM program_school_employees pse
                            JOIN users u ON pse.employee_id = u.id
                            WHERE pse.program_id = %s 
                                AND pse.school_id = %s 
                                AND pse.employee_id = %s
                        ''', (program['id'], school['id'], user_id))
                        school['users'] = cur.fetchall() or []

                program['schools'] = schools

            project['programs'] = programs

        return jsonify({
            'projects': projects,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page if total > 0 else 1,
            'is_admin': user_role == 'admin',
            'is_employeer': user_role == 'employeer'
        })


@projects_bp.route('/projects', methods=['POST'])
@token_required
def create_project(current_user):
    """Создание нового проекта"""
    data = request.json

    name = Validators.sanitize_input(data.get('name'))
    comment = Validators.sanitize_input(data.get('comment'))
    program_ids = data.get('program_ids', [])

    if not name:
        return jsonify({'error': 'Название проекта обязательно'}), 400

    if len(name) < 2:
        return jsonify({'error': 'Название проекта должно содержать минимум 2 символа'}), 400

    if len(name) > 200:
        return jsonify({'error': 'Название проекта не может быть длиннее 200 символов'}), 400

    if comment and len(comment) > 1000:
        return jsonify({'error': 'Комментарий не может быть длиннее 1000 символов'}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO projects (name, comment, user_id)
                VALUES (%s, %s, %s)
                RETURNING id, name, comment, user_id, created_at
            ''', (name, comment, current_user['userId']))

            new_project = cur.fetchone()
            project_id = new_project['id']

            # Добавляем программы
            for prog_id in program_ids:
                cur.execute('''
                    INSERT INTO project_programs (project_id, program_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                ''', (project_id, prog_id))

            if new_project and new_project.get('created_at'):
                new_project['created_at'] = new_project['created_at'].strftime('%Y-%m-%d %H:%M:%S')

            new_project['programs'] = []

            log_action(current_user['userId'], 'CREATE_PROJECT', f"Created project: {name}")

            return jsonify(new_project), 201

    except Exception as e:
        log_action(current_user['userId'], 'CREATE_PROJECT_ERROR', str(e))
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500


@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
@token_required
def get_project(current_user, project_id):
    """Получение одного проекта с программами, школами и сотрудниками"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        # Получаем проект
        cur.execute('''
            SELECT 
                p.id, p.name, p.comment, p.user_id, p.created_at,
                u.login as owner_login, u.surname as owner_surname, u.name as owner_name
            FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = %s
        ''', (project_id,))
        project = cur.fetchone()

        if not project:
            return jsonify({'error': 'Проект не найден'}), 404

        # Проверка доступа
        has_access = False
        if user_role == 'admin':
            has_access = True
        elif user_role == 'employeer':
            # Проверяем, привязан ли сотрудник к какой-либо связке программа-школа из этого проекта
            cur.execute('''
                SELECT 1
                FROM project_programs pp
                JOIN program_school_employees pse ON pp.program_id = pse.program_id
                WHERE pp.project_id = %s AND pse.employee_id = %s
                LIMIT 1
            ''', (project_id, user_id))
            if cur.fetchone():
                has_access = True
        elif project['user_id'] == user_id:
            has_access = True

        if not has_access:
            return jsonify({'error': 'Доступ запрещен'}), 403

        if project.get('created_at'):
            project['created_at'] = project['created_at'].strftime('%Y-%m-%d %H:%M:%S')

        # Получаем программы проекта
        if user_role == 'employeer':
            cur.execute('''
                SELECT DISTINCT pr.id, pr.name, pr.year
                FROM project_programs pp
                JOIN programms pr ON pp.program_id = pr.id
                JOIN program_school_employees pse ON pr.id = pse.program_id
                WHERE pp.project_id = %s AND pse.employee_id = %s
            ''', (project_id, user_id))
        else:
            cur.execute('''
                SELECT pr.id, pr.name, pr.year
                FROM project_programs pp
                JOIN programms pr ON pp.program_id = pr.id
                WHERE pp.project_id = %s
            ''', (project_id,))

        programs = cur.fetchall()

        # Для каждой программы получаем школы и сотрудников
        for program in programs:
            if user_role == 'employeer':
                # ✅ ИСПРАВЛЕНО: используем только program_school_employees
                cur.execute('''
                    SELECT DISTINCT s.id, s.name, s.comment
                    FROM program_school_employees pse
                    JOIN schools s ON pse.school_id = s.id
                    WHERE pse.program_id = %s AND pse.employee_id = %s
                ''', (program['id'], user_id))
            else:
                # ✅ ИСПРАВЛЕНО: используем только program_school_employees
                cur.execute('''
                    SELECT DISTINCT s.id, s.name, s.comment
                    FROM program_school_employees pse
                    JOIN schools s ON pse.school_id = s.id
                    WHERE pse.program_id = %s
                ''', (program['id'],))

            schools = cur.fetchall() or []

            # Для каждой школы получаем сотрудников
            for school in schools:
                if user_role == 'admin':
                    # Админ видит всех сотрудников, привязанных к этой связке
                    cur.execute('''
                        SELECT DISTINCT u.id, u.surname, u.name, u.patronymic, u.login, u.email
                        FROM program_school_employees pse
                        JOIN users u ON pse.employee_id = u.id
                        WHERE pse.program_id = %s AND pse.school_id = %s AND u.role = 'employeer'
                        ORDER BY u.surname, u.name
                    ''', (program['id'], school['id']))
                    school['users'] = cur.fetchall() or []
                else:
                    # Сотрудник видит только себя
                    cur.execute('''
                        SELECT u.id, u.surname, u.name, u.patronymic, u.login, u.email
                        FROM program_school_employees pse
                        JOIN users u ON pse.employee_id = u.id
                        WHERE pse.program_id = %s AND pse.school_id = %s AND pse.employee_id = %s
                    ''', (program['id'], school['id'], user_id))
                    school['users'] = cur.fetchall() or []

            program['schools'] = schools

        project['programs'] = programs

        return jsonify(project)


@projects_bp.route('/projects/<int:project_id>', methods=['PUT'])
@token_required
def update_project(current_user, project_id):
    """Обновление проекта и программ"""
    data = request.json

    name = Validators.sanitize_input(data.get('name'))
    comment = Validators.sanitize_input(data.get('comment'))
    program_ids = data.get('program_ids', [])

    if not name:
        return jsonify({'error': 'Название проекта обязательно'}), 400

    if len(name) < 2:
        return jsonify({'error': 'Название проекта должно содержать минимум 2 символа'}), 400

    if len(name) > 200:
        return jsonify({'error': 'Название проекта не может быть длиннее 200 символов'}), 400

    if comment and len(comment) > 1000:
        return jsonify({'error': 'Комментарий не может быть длиннее 1000 символов'}), 400

    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        cur.execute('SELECT user_id FROM projects WHERE id = %s', (project_id,))
        project = cur.fetchone()

        if not project:
            return jsonify({'error': 'Проект не найден'}), 404

        if user_role != 'admin' and project['user_id'] != user_id:
            return jsonify({'error': 'Доступ запрещен'}), 403

        # Обновляем проект
        cur.execute('''
            UPDATE projects
            SET name = %s, comment = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, name, comment, user_id, created_at
        ''', (name, comment, project_id))

        updated_project = cur.fetchone()

        # Обновляем программы проекта
        if program_ids is not None:
            # Удаляем старые связи
            cur.execute('DELETE FROM project_programs WHERE project_id = %s', (project_id,))

            # Добавляем новые связи
            for prog_id in program_ids:
                cur.execute('''
                    INSERT INTO project_programs (project_id, program_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                ''', (project_id, prog_id))

        if updated_project and updated_project.get('created_at'):
            updated_project['created_at'] = updated_project['created_at'].strftime('%Y-%m-%d %H:%M:%S')

        log_action(current_user['userId'], 'UPDATE_PROJECT', f"Updated project ID {project_id}: {name}")

        return jsonify(updated_project)


@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
@token_required
def delete_project(current_user, project_id):
    """Удаление проекта"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        cur.execute('SELECT user_id, name FROM projects WHERE id = %s', (project_id,))
        project = cur.fetchone()

        if not project:
            return jsonify({'error': 'Проект не найден'}), 404

        if user_role != 'admin' and project['user_id'] != user_id:
            return jsonify({'error': 'Доступ запрещен'}), 403

        # Удаляем связи с программами
        cur.execute('DELETE FROM project_programs WHERE project_id = %s', (project_id,))

        # Удаляем проект
        cur.execute('DELETE FROM projects WHERE id = %s', (project_id,))

        log_action(current_user['userId'], 'DELETE_PROJECT', f"Deleted project ID {project_id}: {project['name']}")

        return jsonify({'success': True, 'message': 'Проект удален'})


@projects_bp.route('/projects/program-schools/<int:program_id>', methods=['GET'])
@token_required
def get_program_schools(current_user, program_id):
    """Получение школ программы с сотрудниками"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        if user_role == 'employeer':
            # Для сотрудника - ТОЛЬКО школы, к которым он привязан, с сотрудниками
            cur.execute('''
                SELECT DISTINCT s.id, s.name, s.comment
                FROM program_school_employees pse
                JOIN schools s ON pse.school_id = s.id
                WHERE pse.program_id = %s AND pse.employee_id = %s
                ORDER BY s.name
            ''', (program_id, user_id))
            schools = cur.fetchall()

            # Для каждой школы получаем сотрудников (только этого сотрудника)
            for school in schools:
                cur.execute('''
                    SELECT DISTINCT u.id, u.surname, u.name, u.patronymic, u.email
                    FROM program_school_employees pse
                    JOIN users u ON pse.employee_id = u.id
                    WHERE pse.program_id = %s 
                        AND pse.school_id = %s 
                        AND pse.employee_id = %s
                        AND u.role = 'employeer'
                    ORDER BY u.surname, u.name
                ''', (program_id, school['id'], user_id))
                school['employees'] = cur.fetchall() or []

        else:
            # Для админа - все школы с сотрудниками
            cur.execute('''
                SELECT DISTINCT s.id, s.name, s.comment
                FROM program_school_employees pse
                JOIN schools s ON pse.school_id = s.id
                WHERE pse.program_id = %s
                ORDER BY s.name
            ''', (program_id,))
            schools = cur.fetchall()

            # Для каждой школы получаем всех сотрудников
            for school in schools:
                cur.execute('''
                    SELECT DISTINCT u.id, u.surname, u.name, u.patronymic, u.email
                    FROM program_school_employees pse
                    JOIN users u ON pse.employee_id = u.id
                    WHERE pse.program_id = %s 
                        AND pse.school_id = %s 
                        AND u.role = 'employeer'
                        AND pse.employee_id IS NOT NULL
                    ORDER BY u.surname, u.name
                ''', (program_id, school['id']))
                school['employees'] = cur.fetchall() or []

        return jsonify(schools)


@projects_bp.route('/projects/program-schools-employee/<int:program_id>/<int:employee_id>', methods=['GET'])
@token_required
def get_program_schools_for_employee(current_user, program_id, employee_id):
    """Получение школ программы, к которым привязан конкретный сотрудник"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        # Проверяем доступ: админ может всё, сотрудник только свои данные
        if user_role != 'admin' and user_id != employee_id:
            return jsonify({'error': 'Доступ запрещен'}), 403

        # Получаем школы программы, где есть этот сотрудник
        cur.execute('''
            SELECT DISTINCT s.id, s.name, s.comment
            FROM program_school_employees pse
            JOIN schools s ON pse.school_id = s.id
            WHERE pse.program_id = %s AND pse.employee_id = %s
        ''', (program_id, employee_id))

        schools = cur.fetchall()
        return jsonify(schools)


@projects_bp.route('/projects/program-school-employees/<int:program_id>/<int:school_id>', methods=['GET'])
@token_required
def get_program_school_employees(current_user, program_id, school_id):
    """Получение сотрудников, привязанных к конкретной связке программа-школа"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        if user_role == 'admin':
            # Админ видит всех сотрудников, привязанных к этой связке
            cur.execute('''
                SELECT u.id, u.surname, u.name, u.patronymic, u.login, u.email
                FROM program_school_employees pse
                JOIN users u ON pse.employee_id = u.id
                WHERE pse.program_id = %s AND pse.school_id = %s AND u.role = 'employeer'
                ORDER BY u.surname, u.name
            ''', (program_id, school_id))
        elif user_role == 'employeer':
            # Сотрудник видит только себя (если он привязан)
            cur.execute('''
                SELECT u.id, u.surname, u.name, u.patronymic, u.login, u.email
                FROM program_school_employees pse
                JOIN users u ON pse.employee_id = u.id
                WHERE pse.program_id = %s AND pse.school_id = %s AND pse.employee_id = %s
            ''', (program_id, school_id, user_id))
        else:
            return jsonify([])

        employees = cur.fetchall()
        return jsonify(employees)


@projects_bp.route('/projects/assign-employee', methods=['POST'])
@token_required
def assign_employee(current_user):
    """Назначение сотрудника на связку программа-школа"""
    data = request.json
    program_id = data.get('program_id')
    school_id = data.get('school_id')
    employee_id = data.get('employee_id')

    if not all([program_id, school_id, employee_id]):
        return jsonify({'error': 'Не все параметры переданы'}), 400

    # Проверяем, существует ли уже запись
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Проверяем, есть ли уже запись с таким program_id и school_id
        cur.execute('''
            SELECT id FROM program_school_employees 
            WHERE program_id = %s AND school_id = %s
        ''', (program_id, school_id))

        existing = cur.fetchone()

        if existing:
            # Обновляем существующую запись
            cur.execute('''
                UPDATE program_school_employees 
                SET employee_id = %s, updated_at = CURRENT_TIMESTAMP
                WHERE program_id = %s AND school_id = %s
                RETURNING id
            ''', (employee_id, program_id, school_id))
        else:
            # Создаем новую запись
            cur.execute('''
                INSERT INTO program_school_employees (program_id, school_id, employee_id)
                VALUES (%s, %s, %s)
                RETURNING id
            ''', (program_id, school_id, employee_id))

        log_action(current_user['userId'], 'ASSIGN_EMPLOYEE',
                   f"Assigned employee {employee_id} to program {program_id}, school {school_id}")

        return jsonify({'success': True, 'message': 'Сотрудник успешно назначен'})


@projects_bp.route('/projects/remove-employee', methods=['DELETE'])
@token_required
def remove_employee(current_user):
    """Удаление сотрудника со связки программа-школа"""
    data = request.json
    program_id = data.get('program_id')
    school_id = data.get('school_id')

    if not all([program_id, school_id]):
        return jsonify({'error': 'Не все параметры переданы'}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('''
            UPDATE program_school_employees 
            SET employee_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE program_id = %s AND school_id = %s
            RETURNING id
        ''', (program_id, school_id))

        if cur.rowcount == 0:
            return jsonify({'error': 'Запись не найдена'}), 404

        log_action(current_user['userId'], 'REMOVE_EMPLOYEE',
                   f"Removed employee from program {program_id}, school {school_id}")

        return jsonify({'success': True, 'message': 'Сотрудник откреплен'})


@projects_bp.route('/projects/create-school-copy', methods=['POST'])
@token_required
def create_school_copy(current_user):
    """Создание копии связки программа-школа с возможностью назначить другого сотрудника"""
    data = request.json
    original_program_id = data.get('original_program_id')
    original_school_id = data.get('original_school_id')
    new_employee_id = data.get('new_employee_id')  # может быть None или любой сотрудник

    if not all([original_program_id, original_school_id]):
        return jsonify({'error': 'Не все параметры переданы'}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Убираем проверку на уникальность employee_id
        # Теперь можно создать сколько угодно записей с одинаковыми program_id, school_id и employee_id

        # Создаем новую связь
        cur.execute('''
            INSERT INTO program_school_employees (program_id, school_id, employee_id)
            VALUES (%s, %s, %s)
            RETURNING id, program_id, school_id, employee_id, created_at
        ''', (original_program_id, original_school_id, new_employee_id))

        new_record = cur.fetchone()

        log_action(current_user['userId'], 'CREATE_SCHOOL_COPY',
                   f"Created copy for program {original_program_id}, school {original_school_id} with employee {new_employee_id}")

        return jsonify({
            'success': True,
            'message': 'Копия успешно создана',
            'data': new_record
        })


@projects_bp.route('/projects/update-school-employee', methods=['PUT'])
@token_required
def update_school_employee(current_user):
    """Обновление сотрудника для конкретной связки программа-школа"""
    data = request.json
    record_id = data.get('record_id')
    new_employee_id = data.get('employee_id')

    if not record_id:
        return jsonify({'error': 'Не передан ID записи'}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Проверяем, существует ли запись
        cur.execute('SELECT id FROM program_school_employees WHERE id = %s', (record_id,))
        if not cur.fetchone():
            return jsonify({'error': 'Запись не найдена'}), 404

        # Обновляем сотрудника
        cur.execute('''
            UPDATE program_school_employees 
            SET employee_id = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, program_id, school_id, employee_id
        ''', (new_employee_id, record_id))

        updated = cur.fetchone()

        log_action(current_user['userId'], 'UPDATE_SCHOOL_EMPLOYEE',
                   f"Updated employee for record {record_id} to {new_employee_id}")

        return jsonify({
            'success': True,
            'message': 'Сотрудник успешно обновлен',
            'data': updated
        })


@projects_bp.route('/projects/program-schools-with-ids/<int:program_id>', methods=['GET'])
@token_required
def get_program_schools_with_ids(current_user, program_id):
    """Получение школ программы с ID записей для дублирования"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

        if user_role == 'employeer':
            cur.execute('''
                SELECT 
                    pse.id as record_id,
                    s.id, 
                    s.name as school_name,
                    s.comment as school_comment,
                    u.id as employee_id, 
                    u.surname as employee_surname, 
                    u.name as employee_name, 
                    u.patronymic as employee_patronymic, 
                    u.email as employee_email,
                    pse.class,
                    pse.group_code,
                    pse.link,
                    pse.start_date,
                    pse.end_date
                FROM program_school_employees pse
                JOIN schools s ON pse.school_id = s.id
                LEFT JOIN users u ON pse.employee_id = u.id
                WHERE pse.program_id = %s AND pse.employee_id = %s
                ORDER BY s.name, pse.id
            ''', (program_id, user_id))
        else:
            cur.execute('''
                SELECT 
                    pse.id as record_id,
                    s.id, 
                    s.name as school_name,
                    s.comment as school_comment,
                    u.id as employee_id, 
                    u.surname as employee_surname, 
                    u.name as employee_name, 
                    u.patronymic as employee_patronymic, 
                    u.email as employee_email,
                    pse.class,
                    pse.group_code,
                    pse.link,
                    pse.start_date,
                    pse.end_date
                FROM program_school_employees pse
                JOIN schools s ON pse.school_id = s.id
                LEFT JOIN users u ON pse.employee_id = u.id
                WHERE pse.program_id = %s
                ORDER BY s.name, pse.id
            ''', (program_id,))

        schools = cur.fetchall()

        schools_by_school = {}
        for school in schools:
            school_id = school['id']
            if school_id not in schools_by_school:
                schools_by_school[school_id] = {
                    'id': school['id'],
                    'name': school['school_name'],
                    'comment': school['school_comment'],
                    'records': []
                }

            # Форматируем даты для JSON
            start_date = school['start_date']
            if start_date and hasattr(start_date, 'strftime'):
                start_date = start_date.strftime('%Y-%m-%d')
            end_date = school['end_date']
            if end_date and hasattr(end_date, 'strftime'):
                end_date = end_date.strftime('%Y-%m-%d')

            schools_by_school[school_id]['records'].append({
                'record_id': school['record_id'],
                'employee_id': school['employee_id'],
                'surname': school['employee_surname'],
                'name': school['employee_name'],
                'patronymic': school['employee_patronymic'],
                'email': school['employee_email'],
                'class': school['class'],
                'group_code': school['group_code'],
                'link': school['link'],
                'start_date': start_date,
                'end_date': end_date
            })

        return jsonify(list(schools_by_school.values()))


@projects_bp.route('/projects/update-field', methods=['PUT'])
@token_required
def update_project_field(current_user):
    """Обновление любого поля в program_school_employees"""
    data = request.json
    record_id = data.get('record_id')
    field_name = data.get('field_name')
    field_value = data.get('field_value')

    if not record_id or not field_name:
        return jsonify({'error': 'Не все параметры переданы'}), 400

    # Разрешенные поля для обновления
    allowed_fields = ['class', 'group_code', 'link', 'start_date', 'end_date']
    if field_name not in allowed_fields:
        return jsonify({'error': 'Недопустимое поле'}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Проверяем, существует ли запись
        cur.execute('SELECT id FROM program_school_employees WHERE id = %s', (record_id,))
        if not cur.fetchone():
            return jsonify({'error': 'Запись не найдена'}), 404

        # Обновляем поле
        query = f'UPDATE program_school_employees SET {field_name} = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s'
        cur.execute(query, (field_value if field_value else None, record_id))

        log_action(current_user['userId'], 'UPDATE_PROJECT_FIELD',
                   f"Updated {field_name} for record {record_id} to {field_value}")

        return jsonify({
            'success': True,
            'message': 'Поле успешно обновлено'
        })


@projects_bp.route('/projects/export', methods=['GET'])
@token_required
def export_projects(current_user):
    """Экспорт всех проектов в XLSX файл"""
    user_id = current_user['userId']
    user_role = None

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        user_role = user_row['role'] if user_row else 'user'

    # Только для администратора
    if user_role != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Получаем все проекты с их программами, школами и сотрудниками
            cur.execute('''
                SELECT DISTINCT
                    p.id as project_id,
                    p.name as project_name,
                    p.comment as project_comment,
                    pr.name as program_name,
                    s.name as school_name,
                    s.comment as school_comment,
                    u.surname as employee_surname,
                    u.name as employee_name,
                    u.patronymic as employee_patronymic,
                    pse.class,
                    pse.group_code,
                    pse.link,
                    pse.start_date,
                    pse.end_date
                FROM projects p
                JOIN project_programs pp ON p.id = pp.project_id
                JOIN programms pr ON pp.program_id = pr.id
                JOIN program_school_employees pse ON pr.id = pse.program_id
                JOIN schools s ON pse.school_id = s.id
                LEFT JOIN users u ON pse.employee_id = u.id AND u.role = 'employeer'
                ORDER BY p.name, pr.name, s.name
            ''')

            results = cur.fetchall()

        # Формируем данные для Excel
        data = []
        for row in results:
            # Форматируем ФИО сотрудника
            employee_full_name = ''
            if row['employee_surname'] and row['employee_name']:
                employee_full_name = f"{row['employee_surname']} {row['employee_name']}"
                if row['employee_patronymic']:
                    employee_full_name += f" {row['employee_patronymic']}"

            # Форматируем даты
            start_date = row['start_date']
            if start_date and hasattr(start_date, 'strftime'):
                start_date = start_date.strftime('%d.%m.%Y')
            else:
                start_date = ''

            end_date = row['end_date']
            if end_date and hasattr(end_date, 'strftime'):
                end_date = end_date.strftime('%d.%m.%Y')
            else:
                end_date = ''

            data.append({
                'Проект': row['project_name'] or '',
                'Ссылка': row['link'] or '',
                'Код группы': row['group_code'] or '',
                'Школа': row['school_name'] or '',
                'Класс': row['class'] or '',
                'Комментарий к школе': row['school_comment'] or '',
                'Название программы': row['program_name'] or '',
                'Сотрудник': employee_full_name,
                'Начало': start_date,
                'Окончание': end_date
            })

        # Если данных нет, создаём пустой DataFrame с заголовками
        if not data:
            data = [{
                'Проект': '',
                'Ссылка': '',
                'Код группы': '',
                'Школа': '',
                'Класс': '',
                'Комментарий к школе': '',
                'Название программы': '',
                'Сотрудник': '',
                'Начало': '',
                'Окончание': ''
            }]

        # Создаём DataFrame
        df = pd.DataFrame(data)

        # Создаём Excel файл в памяти
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Проекты', index=False)

            # Настраиваем стили
            worksheet = writer.sheets['Проекты']

            # Жирный шрифт для заголовков
            for cell in worksheet[1]:
                cell.font = Font(bold=True)
                cell.fill = PatternFill(start_color="C4A27A", end_color="C4A27A", fill_type="solid")
                cell.font = Font(bold=True, color="FFFFFF")
                cell.alignment = Alignment(horizontal='center', vertical='center')

            # Автоматическая ширина колонок
            column_widths = {
                'A': 30,  # Проект
                'B': 40,  # Ссылка
                'C': 15,  # Код группы
                'D': 30,  # Школа
                'E': 12,  # Класс
                'F': 40,  # Комментарий к школе
                'G': 30,  # Название программы
                'H': 30,  # Сотрудник
                'I': 12,  # Начало
                'J': 12  # Окончание
            }

            for col, width in column_widths.items():
                worksheet.column_dimensions[col].width = width

            # Добавляем фильтр
            worksheet.auto_filter.ref = worksheet.dimensions

        output.seek(0)

        log_action(current_user['userId'], 'EXPORT_PROJECTS',
                   f"Exported projects to Excel")

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='projects.xlsx'
        )

    except Exception as e:
        log_action(current_user['userId'], 'EXPORT_PROJECTS_ERROR', str(e))
        return jsonify({'error': f'Ошибка экспорта: {str(e)}'}), 500