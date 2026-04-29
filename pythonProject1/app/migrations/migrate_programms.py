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


def migrate_programms_table():
    """Создание таблицы programms"""

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
        # Создание таблицы programms
        cur.execute('''
            CREATE TABLE IF NOT EXISTS programms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                comment TEXT,
                year INTEGER,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✓ Таблица programms создана или уже существует")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_programms_user_id ON programms(user_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_programms_name ON programms(name)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_programms_year ON programms(year)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_programms_created_at ON programms(created_at)')
        print("✓ Индексы для programms созданы")

        print("\n✅ Таблица programms успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_programms_table()