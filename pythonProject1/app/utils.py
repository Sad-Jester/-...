import re
import logging
from functools import wraps
from flask import request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_bcrypt import Bcrypt
import jwt
from app.config import Config

# Импортируем валидаторы
from app.validators import Validators

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["4800 per day", "200 per hour"]
)

bcrypt = Bcrypt()
token_blacklist = set()

# Восстанавливаем реэкспорты функций из Validators для обратной совместимости
validate_email = Validators.validate_email
validate_login = Validators.validate_login
validate_password_strength = Validators.validate_password_strength
sanitize_input = Validators.sanitize_input


def invalidate_token(token):
    """Отзыв токена"""
    token_blacklist.add(token)
    logger.info(f"Token invalidated: {token[:10]}...")


def token_required(f):
    """Декоратор для проверки JWT токена"""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token or not token.startswith('Bearer '):
            return jsonify({'error': 'Требуется авторизация'}), 401

        token = token.split(' ')[1]

        if token in token_blacklist:
            return jsonify({'error': 'Сессия завершена, войдите снова'}), 401

        try:
            current_user = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Токен истек, пожалуйста, войдите снова'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Недействительный токен'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


def log_action(user_id, action, details=None):
    """Логирование действий"""
    # Безопасное логирование - удаляем возможные пароли
    if details and any(word in details.lower() for word in ['password', 'pass', 'pwd']):
        details = "[REDACTED]"
    logger.info(f"User {user_id}: {action} - {details}")


def admin_token_required(f):
    """Декоратор для проверки JWT токена и прав администратора"""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token or not token.startswith('Bearer '):
            return jsonify({'error': 'Требуется авторизация'}), 401

        token = token.split(' ')[1]

        if token in token_blacklist:
            return jsonify({'error': 'Сессия завершена, войдите снова'}), 401

        try:
            current_user = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])

            # Проверяем роль пользователя
            from app.models import User
            user_role = User.get_user_role(current_user['userId'])

            if user_role != 'admin':
                return jsonify({'error': 'Доступ запрещен. Требуются права администратора'}), 403

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Токен истек, пожалуйста, войдите снова'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Недействительный токен'}), 401

        return f(current_user, *args, **kwargs)

    return decorated