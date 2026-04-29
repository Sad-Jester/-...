from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=8080,
        debug=False,  # В production всегда False
        ssl_context=None  # Добавьте SSL сертификаты для HTTPS
    )