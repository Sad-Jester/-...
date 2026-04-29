import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def column_exists(cur, table_name, column_name):
    """Проверка существования колонки в таблице"""
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name=%s AND column_name=%s
    """, (table_name, column_name))
    return cur.fetchone() is not None


def migrate_database():
    """Миграция существующей базы данных"""

    # Подключение к БД
    conn = psycopg2.connect(
        host='localhost',
        database='postgres',
        user='postgres',
        password='1234',
        port=5432
    )
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # Добавляем колонку is_active
        if not column_exists(cur, 'users', 'is_active'):
            print("Добавление колонки is_active...")
            cur.execute('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE')
            print("✓ Колонка is_active добавлена")
        else:
            print("✓ Колонка is_active уже существует")

        # Обновляем существующих пользователей - все активны по умолчанию
        cur.execute('UPDATE users SET is_active = TRUE WHERE is_active IS NULL')
        print("✓ Существующие пользователи активированы")

        # Остальной код без изменений...
        # Проверяем существование колонки email
        if not column_exists(cur, 'users', 'email'):
            print("Добавление колонки email...")
            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN email VARCHAR(255) UNIQUE
            """)
            print("✓ Колонка email добавлена")

            # Заполняем email для существующих пользователей (временные email)
            cur.execute("""
                UPDATE users 
                SET email = login || '@temp.local' 
                WHERE email IS NULL
            """)
            print("✓ Временные email добавлены для существующих пользователей")

            # Делаем колонку NOT NULL
            cur.execute("""
                ALTER TABLE users 
                ALTER COLUMN email SET NOT NULL
            """)
            print("✓ Колонка email теперь NOT NULL")
        else:
            print("✓ Колонка email уже существует")

        # Добавляем остальные колонки с проверкой
        columns_to_add = {
            'is_verified': 'BOOLEAN DEFAULT FALSE',
            'verification_token': 'VARCHAR(255)',
            'reset_token': 'VARCHAR(255)',
            'reset_token_expires': 'TIMESTAMP',
            'failed_login_attempts': 'INTEGER DEFAULT 0',
            'locked_until': 'TIMESTAMP',
            'last_login': 'TIMESTAMP',
            'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }

        for col_name, col_type in columns_to_add.items():
            if not column_exists(cur, 'users', col_name):
                try:
                    cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                    print(f"✓ Колонка {col_name} добавлена")
                except Exception as e:
                    print(f"! Ошибка добавления {col_name}: {e}")
            else:
                print(f"✓ Колонка {col_name} уже существует")

        # Создаем индексы
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_login ON users(login)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_login_lower ON users(LOWER(login))")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)")
        print("✓ Индексы созданы")

        print("\n✅ Миграция базы данных успешно завершена!")

    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_database()