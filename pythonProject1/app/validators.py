import re
from typing import Tuple, Optional


class Validators:
    """Централизованные валидаторы для всего приложения"""

    @staticmethod
    def validate_email(email: str) -> bool:
        """Валидация email"""
        if not email:
            return False
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email.strip()))

    @staticmethod
    def validate_login(login: str) -> bool:
        """Валидация логина: 3-50 символов (буквы, цифры, _)"""
        if not login:
            return False
        return bool(re.match(r'^[a-zA-Z0-9_]{3,50}$', login.strip()))

    @staticmethod
    def validate_password_strength(password: str) -> Tuple[bool, str]:
        """Проверка сложности пароля"""
        if not password:
            return False, "Пароль не может быть пустым"

        if len(password) < 8:
            return False, "Пароль должен содержать минимум 8 символов"

        if not re.search(r'[A-Z]', password):
            return False, "Пароль должен содержать хотя бы одну заглавную букву"

        if not re.search(r'[a-z]', password):
            return False, "Пароль должен содержать хотя бы одну строчную букву"

        if not re.search(r'\d', password):
            return False, "Пароль должен содержать хотя бы одну цифру"

        # Дополнительные проверки
        if re.search(r'(.)\1{2,}', password):  # 3+ одинаковых символа подряд
            return False, "Пароль содержит повторяющиеся символы"

        common_passwords = {'password123', 'qwerty123', 'admin123', '12345678', 'password'}
        if password.lower() in common_passwords:
            return False, "Пароль слишком простой"

        return True, "Пароль надежный"

    @staticmethod
    def validate_name(name: str, field_name: str = "Поле") -> Tuple[bool, Optional[str]]:
        """Валидация имени/фамилии/отчества"""
        if not name:
            return False, f"{field_name} не может быть пустым"

        name = name.strip()
        if len(name) < 2:
            return False, f"{field_name} должно содержать минимум 2 символа"

        if len(name) > 100:
            return False, f"{field_name} не может быть длиннее 100 символов"

        # Только буквы, дефис, пробел (без апострофа для простоты)
        if not re.match(r'^[a-zA-Zа-яА-ЯёЁ\s\-]+$', name):
            return False, f"{field_name} может содержать только буквы, дефис и пробел"

        return True, None

    @staticmethod
    def sanitize_input(text: Optional[str]) -> Optional[str]:
        """Очистка ввода от лишних пробелов и XSS"""
        if not text:
            return None

        # Убираем лишние пробелы
        text = ' '.join(text.strip().split())

        # Экранируем опасные символы для HTML
        import html
        text = html.escape(text)

        return text

    @staticmethod
    def validate_user_data(data: dict) -> dict:
        """Комплексная валидация данных пользователя"""
        errors = {}

        # Проверка фамилии
        surname = data.get('surname')
        if surname is not None:  # Позволяем пустые значения только если поле не обязательное
            is_valid, error = Validators.validate_name(surname, "Фамилия")
            if not is_valid:
                errors['surname'] = error

        # Проверка имени
        name = data.get('name')
        if name is not None:
            is_valid, error = Validators.validate_name(name, "Имя")
            if not is_valid:
                errors['name'] = error

        # Проверка email
        email = data.get('email')
        if email:
            if not Validators.validate_email(email):
                errors['email'] = "Некорректный email адрес"
        elif email is not None:  # Если email передан и пустой
            errors['email'] = "Email обязателен"

        # Проверка логина
        login = data.get('login')
        if login:
            if not Validators.validate_login(login):
                errors['login'] = "Логин должен содержать 3-50 символов (буквы, цифры, _)"
        elif login is not None:  # Если логин передан и пустой
            errors['login'] = "Логин обязателен"

        return errors