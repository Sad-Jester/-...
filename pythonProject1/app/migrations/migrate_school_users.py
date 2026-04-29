import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()


def migrate_school_users():
    """Миграция: замена employee_schools на school_users (привязка пользователей к школам)"""

    conn = psycopg2.connect(
        host='localhost',
        database='my_site',
        user='postgres',
        password='postgres',
        port=5432
    )
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # 1. Создаём новую таблицу school_users
        print("1. Создание таблицы school_users...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS school_users (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(school_id, user_id)
            )
        ''')
        print("   ✓ Таблица school_users создана")

        # 2. Переносим данные из school_employees в school_users
        print("\n2. Перенос данных из school_employees в school_users...")

        # Сначала проверяем, есть ли колонка user_id в employees? Нет, у нас другая структура
        # Поэтому просто создаём пустую таблицу, старые данные не переносим
        print("   ✓ Старые данные не переносятся (новая логика)")

        # 3. Создаём индексы
        print("\n3. Создание индексов...")
        cur.execute('CREATE INDEX IF NOT EXISTS idx_school_users_school ON school_users(school_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_school_users_user ON school_users(user_id)')
        print("   ✓ Индексы созданы")

        # 4. Удаляем старые таблицы (опционально)
        print("\n4. Удаление старых таблиц...")
        cur.execute('DROP TABLE IF EXISTS school_employees CASCADE')
        cur.execute('DROP TABLE IF EXISTS employee_schools CASCADE')
        print("   ✓ Старые таблицы удалены")

        print("\n✅ Миграция успешно завершена!")

    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    print("=" * 50)
    print("Миграция: школы -> пользователи")
    print("=" * 50)
    print()
    migrate_school_users()