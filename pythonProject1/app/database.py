import logging
from contextlib import contextmanager
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from app.config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Пул соединений
db_pool = None


def create_connection_pool():
    """Создание пула соединений с psycopg 3"""
    try:
        # Psycopg 3 использует свой встроенный пул
        pool = ConnectionPool(
            conninfo=Config.DATABASE_URL,
            min_size=1,
            max_size=20,
            kwargs={
                "row_factory": dict_row,  # Аналог RealDictCursor
                "client_encoding": "UTF8"  # Явно указываем кодировку
            }
        )
        logger.info("Пул соединений с БД успешно создан")
        return pool
    except Exception as e:
        logger.error(f"Ошибка создания пула соединений: {e}")
        raise


# Создаём пул при импорте
try:
    db_pool = create_connection_pool()
except Exception as e:
    logger.error(f"Не удалось создать пул соединений: {e}")
    db_pool = None


@contextmanager
def get_db_connection():
    """Контекстный менеджер для работы с БД"""
    if db_pool is None:
        raise Exception("Пул соединений не инициализирован")

    conn = None
    try:
        conn = db_pool.getconn()
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Ошибка базы данных: {e}")
        raise
    finally:
        if conn:
            db_pool.putconn(conn)


def init_db():
    """Инициализация базы данных"""
    if db_pool is None:
        logger.warning("Пул соединений не доступен, пропускаем инициализацию БД")
        return

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Создание таблицы users
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    surname VARCHAR(100) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    patronymic VARCHAR(100),
                    birthdate DATE,
                    email VARCHAR(255) UNIQUE,
                    login VARCHAR(100) UNIQUE,
                    password_hash VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'employeer',
                    is_active BOOLEAN DEFAULT TRUE,
                    is_verified BOOLEAN DEFAULT FALSE,
                    verification_token VARCHAR(255),
                    reset_token VARCHAR(255),
                    reset_token_expires TIMESTAMP,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP,
                    last_login TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Создание таблицы schools
            cur.execute('''
                CREATE TABLE IF NOT EXISTS schools (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    comment TEXT,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Создание таблицы programms
            cur.execute('''
                CREATE TABLE IF NOT EXISTS programms (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    comment TEXT,
                    year INTEGER,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Создание таблицы projects
            cur.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    comment TEXT,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Связка проект-программа
            cur.execute('''
                CREATE TABLE IF NOT EXISTS project_programs (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    program_id INTEGER REFERENCES programms(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(project_id, program_id)
                )
            ''')

            # Таблица для связи программа-школа-сотрудник
            cur.execute('''
                CREATE TABLE IF NOT EXISTS program_school_employees (
                    id SERIAL PRIMARY KEY,
                    program_id INTEGER NOT NULL REFERENCES programms(id) ON DELETE CASCADE,
                    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                    employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    class VARCHAR(50),
                    group_code VARCHAR(100),
                    link TEXT,
                    start_date DATE,
                    end_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Удаляем старые таблицы, если они существуют
            cur.execute('DROP TABLE IF EXISTS program_schools CASCADE')
            cur.execute('DROP TABLE IF EXISTS school_users CASCADE')

            # Индексы
            cur.execute('CREATE INDEX IF NOT EXISTS idx_users_login ON users(login)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)')

            cur.execute('CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_programms_name ON programms(name)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)')

            cur.execute('CREATE INDEX IF NOT EXISTS idx_project_programs_project ON project_programs(project_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_project_programs_program ON project_programs(program_id)')

            cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_program ON program_school_employees(program_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_school ON program_school_employees(school_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_pse_employee ON program_school_employees(employee_id)')

            # Проверяем и добавляем колонку role если её нет
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='role'
            """)
            if not cur.fetchone():
                cur.execute('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT \'employeer\'')
                logger.info("Колонка role добавлена")

                # Назначаем первого пользователя администратором (если есть)
                cur.execute('''
                    UPDATE users 
                    SET role = 'admin' 
                    WHERE id = (SELECT MIN(id) FROM users)
                ''')
                logger.info("Первый пользователь назначен администратором")

            # Проверяем остальные колонки
            columns_to_check = [
                ('class', 'VARCHAR(50)'),
                ('group_code', 'VARCHAR(100)'),
                ('link', 'TEXT'),
                ('start_date', 'DATE'),
                ('end_date', 'DATE')
            ]

            for col_name, col_type in columns_to_check:
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='program_school_employees' AND column_name=%s
                """, (col_name,))
                if not cur.fetchone():
                    cur.execute(f'ALTER TABLE program_school_employees ADD COLUMN {col_name} {col_type}')
                    logger.info(f"Колонка {col_name} добавлена")

            conn.commit()
            logger.info("База данных инициализирована")

    except Exception as e:
        logger.error(f"Ошибка инициализации БД: {e}")
        raise


# Инициализируем БД
if db_pool is not None:
    try:
        init_db()
    except Exception as e:
        logger.error(f"Не удалось инициализировать БД: {e}")