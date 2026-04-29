import os
from pathlib import Path

# Явно указываем путь
env_path = Path(__file__).parent.parent / '.env'


def clean_string(s):
    """Очищает строку от невалидных UTF-8 символов"""
    if not s:
        return s
    # Удаляем все не-ASCII символы кроме допустимых в URL
    import re
    # Оставляем только ASCII символы
    s = s.encode('ascii', 'ignore').decode('ascii')
    return s.strip()


def load_env_file():
    if not env_path.exists():
        return False

    # Читаем файл с определением кодировки
    with open(env_path, 'rb') as f:
        raw_data = f.read()

    # Удаляем BOM если есть
    if raw_data.startswith(b'\xef\xbb\xbf'):
        raw_data = raw_data[3:]
        print("DEBUG: Обнаружен и удалён UTF-8 BOM")

    # Декодируем как UTF-8 с игнорированием ошибок
    content = raw_data.decode('utf-8', errors='ignore')

    # Парсим строки
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            key = clean_string(key)
            value = clean_string(value)

            # Убираем кавычки если есть
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            os.environ[key] = value

            # Для DATABASE_URL показываем длину и hex первых байт для отладки
            if key == 'DATABASE_URL':
                print(f"DEBUG: {key} = {value}")
                print(f"DEBUG: Длина строки: {len(value)} символов")
                # Показываем ASCII коды подозрительных символов
                for i, char in enumerate(value):
                    if ord(char) > 127:
                        print(f"  WARNING: Не-ASCII символ на позиции {i}: {repr(char)} (код: {ord(char)})")

    return True

# Пробуем загрузить
print("DEBUG: Загружаем переменные окружения...")
load_env_file()
print("=" * 50)


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')

    if not SECRET_KEY:
        raise ValueError(f"SECRET_KEY не установлен. Проверьте файл: {env_path.absolute()}")

    # Очищаем DATABASE_URL от проблемных символов
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/my_site')
    DATABASE_URL = clean_string(DATABASE_URL)

    print(f"DEBUG: Итоговый DATABASE_URL: {DATABASE_URL}")

    JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))
    JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', 30))
    BCRYPT_ROUNDS = int(os.environ.get('BCRYPT_ROUNDS', 12))
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:8080').split(',')
    RATE_LIMIT = os.environ.get('RATE_LIMIT', '5 per minute')

    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'