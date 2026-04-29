import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()


def migrate_project_programs_table():
    """Создание таблицы связи проектов и программ"""

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
        # Удаляем старую таблицу если существует
        cur.execute('DROP TABLE IF EXISTS project_employees CASCADE')
        print("✓ Старая таблица project_employees удалена")

        # Создание таблицы project_programs
        cur.execute('''
            CREATE TABLE IF NOT EXISTS project_programs (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                program_id INTEGER NOT NULL REFERENCES programms(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, program_id)
            )
        ''')
        print("✓ Таблица project_programs создана")

        # Индексы
        cur.execute('CREATE INDEX IF NOT EXISTS idx_project_programs_project ON project_programs(project_id)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_project_programs_program ON project_programs(program_id)')
        print("✓ Индексы для project_programs созданы")

        print("\n✅ Таблица project_programs успешно добавлена!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    migrate_project_programs_table()