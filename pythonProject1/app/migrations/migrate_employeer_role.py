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


def migrate_employeer_role():
    """Добавление роли employeer и поля linked_employee_id"""

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
        # Добавляем колонку linked_employee_id если её нет
        if not column_exists(cur, 'users', 'linked_employee_id'):
            cur.execute('''
                ALTER TABLE users 
                ADD COLUMN linked_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL
            ''')
            print("✓ Колонка linked_employee_id добавлена")
        else:
            print("✓ Колонка linked_employee_id уже существует")

        # Создаем индекс для новой колонки
        cur.execute('CREATE INDEX IF NOT EXISTS idx_users_linked_employee ON users(linked_employee_id)')
        print("✓ Индекс для linked_employee_id создан")

        # Обновляем CHECK constraint для ролей (если есть)
        cur.execute("""
            ALTER TABLE users 
            DROP CONSTRAINT IF EXISTS users_role_check
        """)

        cur.execute("""
            ALTER TABLE users 
            ADD CONSTRAINT users_role_check 
            CHECK (role IN ('user', 'admin', 'employeer'))
        """)
        print("✓ Constraint для ролей обновлен")

        print("\n✅ Миграция успешно завершена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_employeer_role()