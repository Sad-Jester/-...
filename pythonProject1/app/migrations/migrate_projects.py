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


def migrate_projects_table():
    """Добавление таблицы projects"""

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
        # Создание таблицы projects
        cur.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                comment TEXT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✓ Таблица projects создана или уже существует")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)')
        print("✓ Индексы для projects созданы")

        print("\n✅ Таблица projects успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_projects_table()