import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def migrate_project_employees_table():
    """Создание таблицы связи проектов и сотрудников"""

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
        # Создание таблицы project_employees
        cur.execute('''
            CREATE TABLE IF NOT EXISTS project_employees (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, employee_id)
            )
        ''')
        print("✓ Таблица project_employees создана или уже существует")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_project_employees_project ON project_employees(project_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_project_employees_employee ON project_employees(employee_id)')
        print("✓ Индексы для project_employees созданы")

        print("\n✅ Таблица project_employees успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_project_employees_table()