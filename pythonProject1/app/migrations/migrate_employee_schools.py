import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def migrate_employee_schools_table():
    """Создание таблицы связи сотрудников и школ"""

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
        # Создание таблицы employee_schools
        cur.execute('''
            CREATE TABLE IF NOT EXISTS employee_schools (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, school_id)
            )
        ''')
        print("✓ Таблица employee_schools создана")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employee_schools_employee ON employee_schools(employee_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_employee_schools_school ON employee_schools(school_id)')
        print("✓ Индексы для employee_schools созданы")

        print("\n✅ Таблица employee_schools успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_employee_schools_table()