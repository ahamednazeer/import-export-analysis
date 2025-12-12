from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.product import Product

products_bp = Blueprint('products', __name__)


@products_bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    """Get all products"""
    category = request.args.get('category')
    search = request.args.get('search')
    
    query = Product.query.filter_by(is_active=True)
    
    if category:
        query = query.filter_by(category=category)
    
    if search:
        query = query.filter(
            db.or_(
                Product.name.ilike(f'%{search}%'),
                Product.sku.ilike(f'%{search}%')
            )
        )
    
    products = query.order_by(Product.name).all()
    return jsonify([p.to_dict() for p in products])


@products_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product(product_id):
    """Get a single product by ID"""
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict())


@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    """Create a new product (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    data = request.get_json()
    
    if not data.get('sku') or not data.get('name'):
        return jsonify({'message': 'SKU and name are required'}), 400
    
    if Product.query.filter_by(sku=data['sku']).first():
        return jsonify({'message': 'SKU already exists'}), 409
    
    product = Product(
        sku=data['sku'],
        name=data['name'],
        description=data.get('description'),
        category=data.get('category'),
        unit=data.get('unit', 'units'),
        min_order_quantity=data.get('minOrderQuantity', 1),
        unit_price=data.get('unitPrice', 0),
        currency=data.get('currency', 'INR'),
        requires_inspection=data.get('requiresInspection', True),
        shelf_life_days=data.get('shelfLifeDays')
    )
    
    db.session.add(product)
    db.session.commit()
    
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:product_id>', methods=['PATCH'])
@jwt_required()
def update_product(product_id):
    """Update a product (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    
    if 'name' in data:
        product.name = data['name']
    if 'description' in data:
        product.description = data['description']
    if 'category' in data:
        product.category = data['category']
    if 'unit' in data:
        product.unit = data['unit']
    if 'minOrderQuantity' in data:
        product.min_order_quantity = data['minOrderQuantity']
    if 'unitPrice' in data:
        product.unit_price = data['unitPrice']
    if 'requiresInspection' in data:
        product.requires_inspection = data['requiresInspection']
    if 'shelfLifeDays' in data:
        product.shelf_life_days = data['shelfLifeDays']
    if 'isActive' in data:
        product.is_active = data['isActive']
    
    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    """Soft delete a product (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    product = Product.query.get_or_404(product_id)
    product.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Product deleted successfully'})


@products_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get all product categories"""
    categories = db.session.query(Product.category).filter(
        Product.category.isnot(None),
        Product.is_active == True
    ).distinct().all()
    
    return jsonify([c[0] for c in categories if c[0]])
