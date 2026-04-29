import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def column_exists(cur, table_name, column_name):
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name=%s AND column_name=%s
    """, (table_name, column_name))
    return cur.fetchone() is not None


def migrate_new_structure():
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
        # 1. Удаляем старые таблицы связей
        cur.execute('DROP TABLE IF EXISTS program_employees CASCADE')
        cur.execute('DROP TABLE IF EXISTS employee_schools CASCADE')
        print("✓ Старые таблицы связей удалены")

        # 2. Создаём таблицу program_schools (программа - школа)
        cur.execute('''
            CREATE TABLE IF NOT EXISTS program_schools (
                id SERIAL PRIMARY KEY,
                program_id INTEGER NOT NULL REFERENCES programms(id) ON DELETE CASCADE,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(program_id, school_id)
            )
        ''')
        print("✓ Таблица program_schools создана")

        # 3. Создаём таблицу school_employees (школа - сотрудник)
        cur.execute('''
            CREATE TABLE IF NOT EXISTS school_employees (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(school_id, employee_id)
            )
        ''')
        print("✓ Таблица school_employees создана")

        # 4. Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_program_schools_program ON program_schools(program_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_program_schools_school ON program_schools(school_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_school_employees_school ON school_employees(school_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_school_employees_employee ON school_employees(employee_id)')
        print("✓ Индексы созданы")

        print("\n✅ Миграция успешно завершена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_new_structure()