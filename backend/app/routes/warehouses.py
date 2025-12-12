from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.warehouse import Warehouse, Stock
from app.models.product import Product

warehouses_bp = Blueprint('warehouses', __name__)


@warehouses_bp.route('', methods=['GET'])
@jwt_required()
def get_warehouses():
    """Get all warehouses"""
    warehouses = Warehouse.query.filter_by(is_active=True).all()
    return jsonify([w.to_dict() for w in warehouses])


@warehouses_bp.route('/<int:warehouse_id>', methods=['GET'])
@jwt_required()
def get_warehouse(warehouse_id):
    """Get a single warehouse"""
    warehouse = Warehouse.query.get_or_404(warehouse_id)
    return jsonify(warehouse.to_dict())


@warehouses_bp.route('', methods=['POST'])
@jwt_required()
def create_warehouse():
    """Create a new warehouse (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    data = request.get_json()
    
    if not data.get('code') or not data.get('name') or not data.get('city'):
        return jsonify({'message': 'Code, name, and city are required'}), 400
    
    if Warehouse.query.filter_by(code=data['code']).first():
        return jsonify({'message': 'Warehouse code already exists'}), 409
    
    warehouse = Warehouse(
        code=data['code'],
        name=data['name'],
        city=data['city'],
        state=data.get('state'),
        country=data.get('country', 'India'),
        address=data.get('address'),
        contact_person=data.get('contactPerson'),
        contact_phone=data.get('contactPhone'),
        contact_email=data.get('contactEmail'),
        total_capacity=data.get('totalCapacity', 10000)
    )
    
    db.session.add(warehouse)
    db.session.commit()
    
    return jsonify(warehouse.to_dict()), 201


@warehouses_bp.route('/<int:warehouse_id>/stock', methods=['GET'])
@jwt_required()
def get_warehouse_stock(warehouse_id):
    """Get stock levels for a warehouse"""
    warehouse = Warehouse.query.get_or_404(warehouse_id)
    stocks = Stock.query.filter_by(warehouse_id=warehouse_id).all()
    return jsonify([s.to_dict() for s in stocks])


@warehouses_bp.route('/<int:warehouse_id>/stock', methods=['POST'])
@jwt_required()
def update_stock(warehouse_id):
    """Update stock levels (Admin/Warehouse Operator)"""
    claims = get_jwt()
    if claims['role'] not in ['ADMIN', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Not authorized'}), 403
    
    warehouse = Warehouse.query.get_or_404(warehouse_id)
    data = request.get_json()
    
    product_id = data.get('productId')
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404
    
    # Find or create stock record
    stock = Stock.query.filter_by(
        warehouse_id=warehouse_id,
        product_id=product_id,
        batch_number=data.get('batchNumber')
    ).first()
    
    if not stock:
        stock = Stock(
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch_number=data.get('batchNumber')
        )
        db.session.add(stock)
    
    stock.quantity = data.get('quantity', stock.quantity)
    stock.location_code = data.get('locationCode', stock.location_code)
    
    if data.get('expiryDate'):
        from datetime import datetime
        stock.expiry_date = datetime.fromisoformat(data['expiryDate']).date()
    
    db.session.commit()
    return jsonify(stock.to_dict())


@warehouses_bp.route('/stock/product/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product_stock(product_id):
    """Get stock for a product across all warehouses"""
    stocks = Stock.query.filter_by(product_id=product_id).filter(Stock.quantity > 0).all()
    return jsonify([s.to_dict() for s in stocks])
