from flask import Blueprint, request, jsonify
from app.models import User
from app.utils import token_required, validate_password_strength, sanitize_input, log_action, bcrypt, validate_email
from app.config import Config
from app.database import get_db_connection

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    user = User.find_by_id(current_user['userId'])

    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    # Добавляем поле role в ответ
    user['role'] = User.get_user_role(current_user['userId'])

    # Удаляем password_hash из ответа, если он вдруг там оказался
    if 'password_hash' in user:
        del user['password_hash']

    return jsonify(user)


@profile_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.json
    surname = sanitize_input(data.get('surname'))
    name = sanitize_input(data.get('name'))
    patronymic = sanitize_input(data.get('patronymic'))
    email = sanitize_input(data.get('email'))

    # Валидация обязательных полей
    if not surname or not name:
        return jsonify({'error': 'Фамилия и имя обязательны'}), 400

    if not email:
        return jsonify({'error': 'Email обязателен'}), 400

    # Валидация email
    if not validate_email(email):
        return jsonify({'error': 'Некорректный email адрес'}), 400

    try:
        user = User.update_profile(current_user['userId'], surname, name, patronymic, email)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    log_action(current_user['userId'], 'UPDATE_PROFILE', f"Profile updated. Email: {email}")

    return jsonify(user)


@profile_bp.route('/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    data = request.json
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    confirm_password = data.get('confirmPassword')

    if not all([current_password, new_password, confirm_password]):
        return jsonify({'error': 'Все поля обязательны'}), 400

    if new_password != confirm_password:
        return jsonify({'error': 'Новый пароль и подтверждение не совпадают'}), 400

    # Проверка сложности нового пароля
    is_valid, message = validate_password_strength(new_password)
    if not is_valid:
        return jsonify({'error': message}), 400

    # Получаем хеш пароля из базы данных
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT password_hash FROM users WHERE id = %s', (current_user['userId'],))
        user_row = cur.fetchone()

        if not user_row:
            return jsonify({'error': 'Пользователь не найден'}), 404

        password_hash = user_row['password_hash']

        # Проверка текущего пароля
        if not bcrypt.check_password_hash(password_hash, current_password):
            return jsonify({'error': 'Неверный текущий пароль'}), 401

    # Обновление пароля
    new_password_hash = bcrypt.generate_password_hash(new_password, rounds=Config.BCRYPT_ROUNDS).decode('utf-8')
    User.update_password(current_user['userId'], new_password_hash)

    log_action(current_user['userId'], 'CHANGE_PASSWORD', "Password changed")

    return jsonify({'success': True, 'message': 'Пароль успешно изменен'})