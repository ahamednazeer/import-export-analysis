import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

from app.config import config

db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, origins=['http://localhost:3000'], supports_credentials=True, expose_headers=['Content-Disposition'])

    with app.app_context():
        # Import models so they are registered with SQLAlchemy
        from app.models.user import User
        from app.models.chat import ChatSession, ChatMessage
        db.create_all()
    
    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.products import products_bp
    from app.routes.requests import requests_bp
    from app.routes.warehouses import warehouses_bp
    from app.routes.suppliers import suppliers_bp
    from app.routes.inspection import inspection_bp
    from app.routes.procurement import procurement_bp
    from app.routes.logistics import logistics_bp
    from app.routes.admin import admin_bp
    from app.routes.assistant import assistant_bp
    
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(products_bp, url_prefix='/products')
    app.register_blueprint(requests_bp, url_prefix='/requests')
    app.register_blueprint(warehouses_bp, url_prefix='/warehouses')
    app.register_blueprint(suppliers_bp, url_prefix='/suppliers')
    app.register_blueprint(inspection_bp, url_prefix='/inspection')
    app.register_blueprint(procurement_bp, url_prefix='/procurement')
    app.register_blueprint(logistics_bp, url_prefix='/logistics')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(assistant_bp, url_prefix='/assistant')
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'import-export-api'}
    
    # Serve uploaded images
    from flask import send_from_directory
    @app.route('/uploads/<filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app
