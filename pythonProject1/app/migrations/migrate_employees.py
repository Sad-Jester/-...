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


def migrate_employees_table():
    """Создание таблицы employees"""

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
        # Создание таблицы employees
        cur.execute('''
            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                lastname VARCHAR(100) NOT NULL,
                firstname VARCHAR(100) NOT NULL,
                patronymic VARCHAR(100),
                spec VARCHAR(200) NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✓ Таблица employees создана или уже существует")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employees_lastname ON employees(lastname)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employees_spec ON employees(spec)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at)')
        print("✓ Индексы для employees созданы")

        print("\n✅ Таблица employees успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_employees_table()