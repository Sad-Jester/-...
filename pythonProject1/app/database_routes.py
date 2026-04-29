from flask import Blueprint, request, jsonify
from app.database import get_db_connection
from app.utils import admin_token_required, log_action, bcrypt
from app.models import User
from app.validators import Validators

database_bp = Blueprint('database', __name__)


@database_bp.route('/users', methods=['GET'])
@admin_token_required
def get_users(current_user):
    """Получение списка пользователей с пагинацией"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    offset = (page - 1) * per_page

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute('SELECT COUNT(*) FROM users')
        total = cur.fetchone()['count']

        cur.execute('''
            SELECT id, surname, name, patronymic, login, email, created_at, role, is_active
            FROM users
            ORDER BY is_active DESC, id
            LIMIT %s OFFSET %s
        ''', (per_page, offset))
        users = cur.fetchall()

        return jsonify({
            'users': users,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        })


@database_bp.route('/users', methods=['POST'])
@admin_token_required
def create_user(current_user):
    """Создание нового пользователя (только роль employeer)"""
    data = request.json

    surname = Validators.sanitize_input(data.get('surname'))
    name = Validators.sanitize_input(data.get('name'))
    patronymic = Validators.sanitize_input(data.get('patronymic'))
    login = Validators.sanitize_input(data.get('login'))
    email = Validators.sanitize_input(data.get('email'))
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    validation_errors = Validators.validate_user_data({
        'surname': surname,
        'name': name,
        'email': email,
        'login': login
    })

    if validation_errors:
        return jsonify({'error': list(validation_errors.values())[0]}), 400

    if not password:
        return jsonify({'error': 'Пароль обязателен'}), 400

    if password != confirm_password:
        return jsonify({'error': 'Пароли не совпадают'}), 400

    is_valid, message = Validators.validate_password_strength(password)
    if not is_valid:
        return jsonify({'error': message}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute('SELECT id FROM users WHERE login = %s', (login,))
            if cur.fetchone():
                return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400

            cur.execute('SELECT id FROM users WHERE email = %s', (email,))
            if cur.fetchone():
                return jsonify({'error': 'Пользователь с таким email уже существует'}), 400

            password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

            # Новый пользователь получает роль employeer
            cur.execute('''
                INSERT INTO users (surname, name, patronymic, login, email, password_hash, role, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, 'employeer', TRUE)
                RETURNING id, surname, name, patronymic, login, email, created_at, role, is_active
            ''', (surname, name, patronymic, login, email, password_hash))
            new_user = cur.fetchone()

            log_action(current_user['userId'], 'CREATE_USER',
                       f"Created user: {login} ({email})")

            return jsonify(new_user), 201

    except Exception as e:
        log_action(current_user['userId'], 'CREATE_USER_ERROR', str(e))
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500


@database_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_token_required
def get_user(current_user, user_id):
    """Получение одного пользователя по ID"""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('''
            SELECT id, surname, name, patronymic, login, email, created_at, role, is_active
            FROM users
            WHERE id = %s
        ''', (user_id,))
        user = cur.fetchone()

        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        return jsonify(user)


@database_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_token_required
def update_user(current_user, user_id):
    """Обновление данных пользователя (включая пароль)"""
    data = request.json

    surname = Validators.sanitize_input(data.get('surname'))
    name = Validators.sanitize_input(data.get('name'))
    patronymic = Validators.sanitize_input(data.get('patronymic'))
    login = Validators.sanitize_input(data.get('login'))
    email = Validators.sanitize_input(data.get('email'))
    password = data.get('password')

    validation_errors = Validators.validate_user_data({
        'surname': surname,
        'name': name,
        'email': email,
        'login': login
    })

    if validation_errors:
        return jsonify({'error': list(validation_errors.values())[0]}), 400

    if password:
        is_valid, message = Validators.validate_password_strength(password)
        if not is_valid:
            return jsonify({'error': message}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute('SELECT id FROM users WHERE login = %s AND id != %s', (login, user_id))
            if cur.fetchone():
                return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400

            cur.execute('SELECT id FROM users WHERE email = %s AND id != %s', (email, user_id))
            if cur.fetchone():
                return jsonify({'error': 'Пользователь с таким email уже существует'}), 400

            if password:
                password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
                cur.execute('''
                    UPDATE users
                    SET surname = %s, name = %s, patronymic = %s, login = %s, email = %s, 
                        password_hash = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id, surname, name, patronymic, login, email, created_at, role, is_active
                ''', (surname, name, patronymic, login, email, password_hash, user_id))
            else:
                cur.execute('''
                    UPDATE users
                    SET surname = %s, name = %s, patronymic = %s, login = %s, email = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id, surname, name, patronymic, login, email, created_at, role, is_active
                ''', (surname, name, patronymic, login, email, user_id))

            updated_user = cur.fetchone()

            if not updated_user:
                return jsonify({'error': 'Пользователь не найден'}), 404

            log_action(current_user['userId'], 'UPDATE_USER',
                       f"Updated user ID {user_id}: {login} ({email})" + (" (password changed)" if password else ""))

            return jsonify(updated_user)

    except Exception as e:
        log_action(current_user['userId'], 'UPDATE_USER_ERROR', str(e))
        return jsonify({'error': f'Ошибка обновления пользователя: {str(e)}'}), 500


@database_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_token_required
def delete_user(current_user, user_id):
    """Удаление пользователя"""
    if user_id == current_user['userId']:
        return jsonify({'error': 'Нельзя удалить свой собственный аккаунт'}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM users WHERE id = %s RETURNING id', (user_id,))
            deleted = cur.fetchone()

            if not deleted:
                return jsonify({'error': 'Пользователь не найден'}), 404

            log_action(current_user['userId'], 'DELETE_USER', f"Deleted user ID {user_id}")
            return jsonify({'success': True, 'message': 'Пользователь удален'})

    except Exception as e:
        log_action(current_user['userId'], 'DELETE_USER_ERROR', str(e))
        return jsonify({'error': f'Ошибка удаления пользователя: {str(e)}'}), 500


@database_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@admin_token_required
def update_user_role(current_user, user_id):
    """Обновление роли пользователя (только admin или employeer)"""
    data = request.json
    role = data.get('role')

    if role not in ['admin', 'employeer']:
        return jsonify({'error': 'Некорректная роль. Допустимые значения: admin, employeer'}), 400

    if user_id == current_user['userId']:
        return jsonify({'error': 'Нельзя изменить роль своего аккаунта'}), 400

    try:
        updated_user = User.update_user_role(user_id, role)

        if not updated_user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        log_action(current_user['userId'], 'UPDATE_ROLE',
                   f"Updated role for user ID {user_id} to {role}")

        return jsonify({
            'success': True,
            'message': f'Роль пользователя изменена на {role}',
            'user': updated_user
        })

    except Exception as e:
        return jsonify({'error': f'Ошибка обновления роли: {str(e)}'}), 500


@database_bp.route('/users/<int:user_id>/active', methods=['PUT'])
@admin_token_required
def update_user_active_status(current_user, user_id):
    """Обновление статуса активности пользователя"""
    data = request.json
    is_active = data.get('is_active', False)

    if user_id == current_user['userId']:
        return jsonify({'error': 'Нельзя изменить статус активности своего аккаунта'}), 400

    try:
        result = User.update_active_status(user_id, is_active)

        if not result:
            return jsonify({'error': 'Пользователь не найден'}), 404

        log_action(current_user['userId'], 'UPDATE_ACTIVE_STATUS',
                   f"Updated active status for user ID {user_id} to {is_active}")

        return jsonify({
            'success': True,
            'message': f'Аккаунт {"активирован" if is_active else "деактивирован"}',
            'is_active': is_active
        })

    except Exception as e:
        return jsonify({'error': f'Ошибка обновления статуса: {str(e)}'}), 500