import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

print("=" * 60)
print("ДИАГНОСТИКА ПОДКЛЮЧЕНИЯ К POSTGRESQL")
print("=" * 60)

# 1. Проверяем версию Python и psycopg2
print(f"Python версия: {sys.version}")
print(f"psycopg2 версия: {psycopg2.__version__}")
print()

# 2. Проверяем системную кодировку
print(f"Системная кодировка: {sys.getfilesystemencoding()}")
print(f"Стандартный ввод/вывод: {sys.stdin.encoding}/{sys.stdout.encoding}")
print()

# 3. Проверяем переменные окружения, связанные с PostgreSQL
pg_vars = ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']
print("Переменные окружения PostgreSQL:")
for var in pg_vars:
    value = os.environ.get(var)
    if value:
        # Показываем безопасно
        if 'PASSWORD' in var:
            print(f"  {var} = {'*' * len(value)}")
        else:
            print(f"  {var} = {value}")
print()

# 4. Пробуем разные способы подключения
test_configs = [
    {
        'name': 'Через DSN строку',
        'dsn': 'postgresql://postgres:postgres@localhost:5432/postgres'
    },
    {
        'name': 'Через параметры',
        'params': {
            'host': 'localhost',
            'port': 5432,
            'database': 'postgres',
            'user': 'postgres',
            'password': 'postgres'
        }
    },
    {
        'name': 'Через DSN с экранированием',
        'dsn': 'postgresql://postgres:postgres@localhost:5432/postgres?client_encoding=UTF8'
    }
]

for config in test_configs:
    print(f"\nПробуем: {config['name']}")
    try:
        if 'dsn' in config:
            # Очищаем DSN от возможных проблемных символов
            dsn = config['dsn'].encode('ascii', errors='ignore').decode('ascii')
            print(f"  DSN: {dsn}")
            conn = psycopg2.connect(dsn, connect_timeout=5)
        else:
            params = config['params'].copy()
            # Очищаем все строковые параметры
            for key, value in params.items():
                if isinstance(value, str):
                    params[key] = value.encode('ascii', errors='ignore').decode('ascii')
            print(f"  Параметры: {params}")
            conn = psycopg2.connect(**params, connect_timeout=5)

        print("  ✓ ПОДКЛЮЧЕНИЕ УСПЕШНО!")

        # Проверяем версию PostgreSQL
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"  Версия PostgreSQL: {version[:50]}...")

        # Проверяем кодировку базы
        cur.execute("SHOW server_encoding;")
        encoding = cur.fetchone()[0]
        print(f"  Кодировка сервера: {encoding}")

        cur.execute("SHOW client_encoding;")
        encoding = cur.fetchone()[0]
        print(f"  Кодировка клиента: {encoding}")

        conn.close()
        print("  Соединение закрыто")
        break  # Если один способ сработал, остальные не пробуем

    except psycopg2.OperationalError as e:
        print(f"  ✗ Ошибка подключения: {e}")
    except Exception as e:
        print(f"  ✗ Другая ошибка: {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("ДИАГНОСТИКА ЗАВЕРШЕНА")
print("=" * 60)