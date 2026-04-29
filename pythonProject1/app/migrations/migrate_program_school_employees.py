import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()


def migrate_program_school_employees():
    """Создание таблицы связи сотрудников с конкретной парой программа-школа"""

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
        # Создаём таблицу program_school_employees
        cur.execute('''
            CREATE TABLE IF NOT EXISTS program_school_employees (
                id SERIAL PRIMARY KEY,
                program_id INTEGER NOT NULL REFERENCES programms(id) ON DELETE CASCADE,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(program_id, school_id, employee_id)
            )
        ''')
        print("✓ Таблица program_school_employees создана")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_program ON program_school_employees(program_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_school ON program_school_employees(school_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_employee ON program_school_employees(employee_id)')
        print("✓ Индексы созданы")

        # Переносим существующие связи из school_users
        cur.execute('''
            INSERT INTO program_school_employees (program_id, school_id, employee_id)
            SELECT DISTINCT ps.program_id, su.school_id, su.user_id
            FROM school_users su
            JOIN program_schools ps ON su.school_id = ps.school_id
            ON CONFLICT DO NOTHING
        ''')
        print(f"✓ Перенесено {cur.rowcount} связей")

        print("\n✅ Миграция успешно завершена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_program_school_employees()