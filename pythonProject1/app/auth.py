from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from app.config import Config
from app.database import get_db_connection
from app.models import User
from app.utils import limiter, bcrypt, token_required, invalidate_token, log_action, admin_token_required
from app.validators import Validators

auth_bp = Blueprint('auth', __name__)


def generate_token(user_id, login, remember=False):
    """Генерация JWT токена"""
    expires_delta = timedelta(days=Config.JWT_EXPIRATION_DAYS) if remember else timedelta(
        hours=Config.JWT_EXPIRATION_HOURS)
    token = jwt.encode({
        'userId': user_id,
        'login': login,
        'exp': datetime.utcnow() + expires_delta,
        'iat': datetime.utcnow()
    }, Config.SECRET_KEY, algorithm='HS256')
    return token


# Регистрация доступна ТОЛЬКО для администраторов
@auth_bp.route('/register', methods=['POST'])
@admin_token_required
def register(current_user):
    data = request.json

    surname = Validators.sanitize_input(data.get('surname'))
    name = Validators.sanitize_input(data.get('name'))
    patronymic = Validators.sanitize_input(data.get('patronymic'))
    login = Validators.sanitize_input(data.get('login'))
    email = Validators.sanitize_input(data.get('email'))
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    if not all([surname, name, login, email, password, confirm_password]):
        return jsonify({'error': 'Все обязательные поля должны быть заполнены'}), 400

    validation_errors = Validators.validate_user_data({
        'surname': surname,
        'name': name,
        'email': email,
        'login': login
    })

    if validation_errors:
        return jsonify({'error': list(validation_errors.values())[0]}), 400

    if patronymic and len(patronymic) > 100:
        return jsonify({'error': 'Отчество не может быть длиннее 100 символов'}), 400

    is_valid, message = Validators.validate_password_strength(password)
    if not is_valid:
        return jsonify({'error': message}), 400

    if password != confirm_password:
        return jsonify({'error': 'Пароли не совпадают'}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id FROM users WHERE login = %s', (login,))
        if cur.fetchone():
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400

        cur.execute('SELECT id FROM users WHERE email = %s', (email,))
        if cur.fetchone():
            return jsonify({'error': 'Пользователь с таким email уже существует'}), 400

    password_hash = bcrypt.generate_password_hash(password, rounds=Config.BCRYPT_ROUNDS).decode('utf-8')

    try:
        # Новый пользователь получает роль 'employeer' по умолчанию
        user = User.create(surname, name, login, email, password_hash, patronymic, role='employeer')

        log_action(current_user['userId'], 'CREATE_USER', f"Created user: {login} ({email})")

        return jsonify({
            'success': True,
            'message': 'Пользователь успешно создан',
            'user': {
                'id': user['id'],
                'surname': user['surname'],
                'name': user['name'],
                'patronymic': user.get('patronymic'),
                'login': user['login'],
                'email': user['email'],
                'role': user.get('role', 'employeer')
            }
        }), 201

    except Exception as e:
        log_action(current_user['userId'], 'REGISTER_FAILED', f"Error: {str(e)}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500


@auth_bp.route('/login', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT)
def login():
    data = request.json
    login = Validators.sanitize_input(data.get('login'))
    password = data.get('password')
    remember = data.get('remember', False)

    if not login or not password:
        return jsonify({'error': 'Логин и пароль обязательны'}), 400

    if User.is_account_locked(login):
        return jsonify({'error': 'Аккаунт заблокирован на 15 минут. Попробуйте позже'}), 401

    user = User.find_by_login(login)

    if not user or not bcrypt.check_password_hash(user['password_hash'], password):
        locked_until = User.increment_failed_attempts(login)
        if locked_until:
            return jsonify({'error': 'Аккаунт заблокирован на 15 минут из-за множества неудачных попыток'}), 401
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    if not user.get('is_active', True):
        return jsonify({'error': 'Пользователь заблокирован. Обратитесь к администратору'}), 401

    User.reset_failed_attempts(login)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s', (user['id'],))

    token = generate_token(user['id'], user['login'], remember)
    log_action(user['id'], 'LOGIN', f"User {login} logged in")

    response = jsonify({
        'success': True,
        'message': 'Вход выполнен успешно',
        'token': token,
        'user': {
            'id': user['id'],
            'surname': user['surname'],
            'name': user['name'],
            'patronymic': user.get('patronymic'),
            'login': user['login'],
            'email': user['email'],
            'role': user.get('role', 'employeer'),
            'is_active': user.get('is_active', True)
        }
    })

    max_age = 30 * 24 * 60 * 60 if remember else 24 * 60 * 60
    response.set_cookie(
        'token',
        token,
        max_age=max_age,
        path='/',
        httponly=False,
        samesite='Lax'
    )

    return response


@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        invalidate_token(token)

    log_action(current_user['userId'], 'LOGOUT', f"User logged out")
    return jsonify({'success': True, 'message': 'Вы успешно вышли из системы'}), 200