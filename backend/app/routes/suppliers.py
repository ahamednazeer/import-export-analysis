from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.supplier import Supplier, SupplierStock
from app.models.product import Product
from app.models.user import User, Role

suppliers_bp = Blueprint('suppliers', __name__)


@suppliers_bp.route('', methods=['GET'])
@jwt_required()
def get_suppliers():
    """Get all suppliers"""
    suppliers = Supplier.query.filter_by(is_active=True).all()
    return jsonify([s.to_dict() for s in suppliers])


@suppliers_bp.route('/<int:supplier_id>', methods=['GET'])
@jwt_required()
def get_supplier(supplier_id):
    """Get a single supplier"""
    supplier = Supplier.query.get_or_404(supplier_id)
    return jsonify(supplier.to_dict())


@suppliers_bp.route('', methods=['POST'])
@jwt_required()
def create_supplier():
    """Create a new supplier (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or user.role != Role.ADMIN:
        return jsonify({'message': 'Admin access required'}), 403
    
    data = request.get_json()
    
    if not data.get('code') or not data.get('name') or not data.get('country'):
        return jsonify({'message': 'Code, name, and country are required'}), 400
    
    if Supplier.query.filter_by(code=data['code']).first():
        return jsonify({'message': 'Supplier code already exists'}), 409
    
    supplier = Supplier(
        code=data['code'],
        name=data['name'],
        country=data['country'],
        city=data.get('city'),
        address=data.get('address'),
        contact_person=data.get('contactPerson'),
        contact_phone=data.get('contactPhone'),
        contact_email=data.get('contactEmail'),
        lead_time_days=data.get('leadTimeDays', 7),
        reliability_score=data.get('reliabilityScore', 0.80)
    )
    
    db.session.add(supplier)
    db.session.commit()
    
    return jsonify(supplier.to_dict()), 201


@suppliers_bp.route('/<int:supplier_id>/products', methods=['GET'])
@jwt_required()
def get_supplier_products(supplier_id):
    """Get products available from a supplier"""
    supplier = Supplier.query.get_or_404(supplier_id)
    stocks = SupplierStock.query.filter_by(supplier_id=supplier_id, is_active=True).all()
    return jsonify([s.to_dict() for s in stocks])


@suppliers_bp.route('/<int:supplier_id>/products', methods=['POST'])
@jwt_required()
def add_supplier_product(supplier_id):
    """Add a product to supplier catalog (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or user.role != Role.ADMIN:
        return jsonify({'message': 'Admin access required'}), 403
    
    supplier = Supplier.query.get_or_404(supplier_id)
    data = request.get_json()
    
    product = Product.query.get(data.get('productId'))
    if not product:
        return jsonify({'message': 'Product not found'}), 404
    
    # Check if already exists
    existing = SupplierStock.query.filter_by(
        supplier_id=supplier_id,
        product_id=product.id
    ).first()
    
    if existing:
        existing.is_active = True
        existing.available_quantity = data.get('availableQuantity', existing.available_quantity)
        existing.unit_price = data.get('unitPrice', existing.unit_price)
        stock = existing
    else:
        stock = SupplierStock(
            supplier_id=supplier_id,
            product_id=product.id,
            available_quantity=data.get('availableQuantity', 0),
            min_order_quantity=data.get('minOrderQuantity', 1),
            unit_price=data.get('unitPrice', 0),
            currency=data.get('currency', 'USD')
        )
        db.session.add(stock)
    
    db.session.commit()
    return jsonify(stock.to_dict()), 201
