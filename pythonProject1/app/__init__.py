import os
import jwt
from flask import Flask, send_from_directory, redirect, jsonify, request
from flask_cors import CORS
from flask_talisman import Talisman
from app.config import Config
from app.utils import limiter, bcrypt
from app.auth import auth_bp
from app.profile import profile_bp
from app.database_routes import database_bp
from app.projects_routes import projects_bp
from app.schools_routes import schools_bp
from app.programms_routes import programms_bp
from app.models import User


def create_app():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, 'public')

    app = Flask(__name__, static_folder=public_dir, static_url_path='')
    app.config.from_object(Config)

    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    Talisman(app,
             content_security_policy={
                 'default-src': "'self'",
                 'script-src': ["'self'", "'unsafe-inline'"],
                 'style-src': ["'self'", "'unsafe-inline'"],
             },
             force_https=False
             )

    limiter.init_app(app)
    bcrypt.init_app(app)

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(database_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(schools_bp, url_prefix='/api')
    app.register_blueprint(programms_bp, url_prefix='/api')

    @app.route('/')
    def index():
        return send_from_directory(public_dir, 'index.html')

    @app.route('/profile')
    def profile():
        token = request.cookies.get('token')

        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return redirect('/')

        try:
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            return send_from_directory(public_dir, 'profile.html')
        except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
            return redirect('/')

    @app.route('/access-denied')
    def access_denied():
        return send_from_directory(public_dir, 'access-denied.html')

    def check_user_access(token):
        """Проверка прав доступа пользователя"""
        if not token:
            return False, None

        try:
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            user_role = User.get_user_role(payload['userId'])
            return True, user_role
        except:
            return False, None

    @app.route('/projects')
    def projects_page():
        token = request.cookies.get('token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        is_valid, user_role = check_user_access(token)

        if not is_valid:
            return redirect('/')

        # Доступ для admin и employeer
        if user_role not in ['admin', 'employeer']:
            return redirect('/access-denied')

        return send_from_directory(public_dir, 'projects.html')

    # УДАЛЕН маршрут /employees

    @app.route('/schools')
    def schools_page():
        token = request.cookies.get('token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        is_valid, user_role = check_user_access(token)

        if not is_valid:
            return redirect('/')

        if user_role != 'admin':
            return redirect('/access-denied')

        return send_from_directory(public_dir, 'schools.html')

    @app.route('/programms')
    def programms_page():
        token = request.cookies.get('token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        is_valid, user_role = check_user_access(token)

        if not is_valid:
            return redirect('/')

        if user_role != 'admin':
            return redirect('/access-denied')

        return send_from_directory(public_dir, 'programms.html')

    @app.route('/users')
    def users():
        token = request.cookies.get('token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        is_valid, user_role = check_user_access(token)

        if not is_valid:
            return redirect('/access-denied')

        if user_role != 'admin':
            return redirect('/access-denied')

        return send_from_directory(public_dir, 'users.html')

    @app.route('/profile.html')
    def profile_redirect():
        return redirect('/profile')

    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory(public_dir, filename)

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Ресурс не найден'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

    return app