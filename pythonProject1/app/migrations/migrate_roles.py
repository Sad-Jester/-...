import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()


def migrate_roles():
    """Обновление ролей пользователей: user -> employeer"""

    conn = psycopg2.connect(
        host='localhost',
        database='my_site',
        user='postgres',
        password='postgres',
        port=5432
    )
    conn.autocommit = True
    cur = conn.cursor()  # Убрали RealDictCursor, используем обычный курсор

    try:
        # 1. Сначала преобразуем всех пользователей с ролью 'user' в 'employeer'
        print("1. Обновление ролей пользователей...")
        cur.execute("""
            UPDATE users 
            SET role = 'employeer' 
            WHERE role = 'user'
        """)
        user_count = cur.rowcount
        print(f"   ✓ Обновлено {user_count} пользователей: role 'user' -> 'employeer'")

        # 2. Преобразуем любые другие недопустимые значения в 'employeer'
        cur.execute("""
            UPDATE users 
            SET role = 'employeer' 
            WHERE role NOT IN ('admin', 'employeer')
        """)
        other_count = cur.rowcount
        if other_count > 0:
            print(f"   ✓ Обновлено {other_count} пользователей с недопустимыми ролями -> 'employeer'")

        # 3. Проверяем, есть ли пользователи с NULL ролью
        cur.execute("""
            UPDATE users 
            SET role = 'employeer' 
            WHERE role IS NULL
        """)
        null_count = cur.rowcount
        if null_count > 0:
            print(f"   ✓ Обновлено {null_count} пользователей с NULL ролью -> 'employeer'")

        # 4. Удаляем старый CHECK constraint (если существует)
        print("\n2. Удаление старого CHECK constraint...")
        try:
            cur.execute("""
                ALTER TABLE users 
                DROP CONSTRAINT IF EXISTS users_role_check
            """)
            print("   ✓ Старый CHECK constraint удален")
        except Exception as e:
            print(f"   ! Не удалось удалить constraint: {e}")

        # 5. Добавляем новый CHECK constraint
        print("\n3. Добавление нового CHECK constraint...")
        try:
            cur.execute("""
                ALTER TABLE users 
                ADD CONSTRAINT users_role_check 
                CHECK (role IN ('admin', 'employeer'))
            """)
            print("   ✓ Новый CHECK constraint добавлен")
        except Exception as e:
            print(f"   ! Ошибка добавления constraint: {e}")

        # 6. Удаляем колонку linked_employee_id если она есть (больше не нужна)
        print("\n4. Проверка колонки linked_employee_id...")
        try:
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='linked_employee_id'
            """)
            if cur.fetchone():
                cur.execute("""
                    ALTER TABLE users 
                    DROP COLUMN linked_employee_id
                """)
                print("   ✓ Колонка linked_employee_id удалена")
            else:
                print("   ✓ Колонка linked_employee_id не найдена")
        except Exception as e:
            print(f"   ! Ошибка при работе с колонкой: {e}")

        # 7. Показываем текущие роли в системе
        print("\n5. Текущее распределение ролей:")
        cur.execute("""
            SELECT role, COUNT(*) as count 
            FROM users 
            GROUP BY role 
            ORDER BY role
        """)
        roles = cur.fetchall()
        for role in roles:
            # role[0] - это название роли, role[1] - количество
            role_name = "Администратор" if role[0] == 'admin' else "Сотрудник"
            print(f"   {role_name}: {role[1]} пользователей")

        print("\n✅ Миграция ролей успешно завершена!")

    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        conn.rollback()
        print("\nОткат изменений...")
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    print("=" * 50)
    print("Миграция ролей пользователей")
    print("=" * 50)
    print()
    migrate_roles()