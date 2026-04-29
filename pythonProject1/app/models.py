from datetime import datetime, timedelta
import jwt
from app.config import Config
from app.database import get_db_connection


class User:
    @staticmethod
    def create(surname, name, login, email, password_hash, patronymic=None, birthdate=None, role='employeer'):
        """Создание нового пользователя (по умолчанию роль employeer)"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO users (surname, name, patronymic, login, email, password_hash, birthdate, role)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, surname, name, patronymic, login, email, birthdate, created_at, role
            ''', (surname, name, patronymic, login, email, password_hash, birthdate, role))
            result = cur.fetchone()
            if result and result.get('birthdate'):
                result['birthdate'] = result['birthdate'].strftime('%Y-%m-%d') if result['birthdate'] else None
            return result

    @staticmethod
    def find_by_login(login):
        """Поиск пользователя по логину"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT * FROM users WHERE login = %s', (login,))
            result = cur.fetchone()
            if result and result.get('birthdate'):
                result['birthdate'] = result['birthdate'].strftime('%Y-%m-%d') if result['birthdate'] else None
            return result

    @staticmethod
    def find_by_id(user_id):
        """Поиск пользователя по ID (без пароля для безопасности)"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT id, surname, name, patronymic, login, email, birthdate, created_at, is_verified, role
                FROM users WHERE id = %s
            ''', (user_id,))
            result = cur.fetchone()
            if result and result.get('birthdate'):
                result['birthdate'] = result['birthdate'].strftime('%Y-%m-%d') if result['birthdate'] else None
            return result

    @staticmethod
    def update_active_status(user_id, is_active):
        """Обновление статуса активности пользователя"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE users 
                SET is_active = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, is_active
            ''', (is_active, user_id))
            return cur.fetchone()

    @staticmethod
    def update_profile(user_id, surname, name, patronymic, email):
        """Обновление профиля (включая email)"""
        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute('''
                SELECT id FROM users WHERE email = %s AND id != %s
            ''', (email, user_id))
            if cur.fetchone():
                raise ValueError("Email уже используется другим пользователем")

            cur.execute('''
                UPDATE users 
                SET surname = %s, name = %s, patronymic = %s, email = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, surname, name, patronymic, login, email, birthdate
            ''', (surname, name, patronymic, email, user_id))
            result = cur.fetchone()
            if result and result.get('birthdate'):
                result['birthdate'] = result['birthdate'].strftime('%Y-%m-%d') if result['birthdate'] else None
            return result

    @staticmethod
    def update_password(user_id, new_password_hash):
        """Обновление пароля"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE users 
                SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (new_password_hash, user_id))
            return True

    @staticmethod
    def increment_failed_attempts(login):
        """Увеличение счетчика неудачных попыток входа"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE users 
                SET failed_login_attempts = failed_login_attempts + 1,
                    locked_until = CASE 
                        WHEN failed_login_attempts + 1 >= 5 
                        THEN NOW() + INTERVAL '15 minutes'
                        ELSE locked_until
                    END
                WHERE login = %s
                RETURNING locked_until
            ''', (login,))
            result = cur.fetchone()
            return result['locked_until'] if result else None

    @staticmethod
    def reset_failed_attempts(login):
        """Сброс счетчика неудачных попыток"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE users 
                SET failed_login_attempts = 0, locked_until = NULL
                WHERE login = %s
            ''', (login,))

    @staticmethod
    def is_account_locked(login):
        """Проверка заблокирован ли аккаунт"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT locked_until FROM users 
                WHERE login = %s AND locked_until > NOW()
            ''', (login,))
            return cur.fetchone() is not None

    @staticmethod
    def get_user_role(user_id):
        """Получение роли пользователя"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
            result = cur.fetchone()
            return result['role'] if result else 'employeer'

    @staticmethod
    def update_user_role(user_id, role):
        """Обновление роли пользователя"""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE users 
                SET role = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, role
            ''', (role, user_id))
            return cur.fetchone()