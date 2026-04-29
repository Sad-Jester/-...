import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def migrate_program_employees_table():
    """Создание таблицы связи программ и сотрудников"""

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
        # Создание таблицы program_employees
        cur.execute('''
            CREATE TABLE IF NOT EXISTS program_employees (
                id SERIAL PRIMARY KEY,
                program_id INTEGER NOT NULL REFERENCES programms(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(program_id, employee_id)
            )
        ''')
        print("✓ Таблица program_employees создана")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_program_employees_program ON program_employees(program_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_program_employees_employee ON program_employees(employee_id)')
        print("✓ Индексы для program_employees созданы")

        print("\n✅ Таблица program_employees успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_program_employees_table()