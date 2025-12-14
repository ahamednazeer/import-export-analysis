from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.user import User, Role
from app.models.request import ProductRequest, RequestStatus
from app.models.warehouse import Warehouse
from app.models.supplier import Supplier

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    role_filter = request.args.get('role')
    query = User.query
    
    if role_filter:
        query = query.filter_by(role=Role(role_filter))
    
    users = query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403

    data = request.get_json()

    required_fields = ['email', 'username', 'password', 'firstName', 'lastName', 'role']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 409

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 409

    role = Role(data['role'])
    assigned_warehouse_id = data.get('assignedWarehouseId')
    assigned_supplier_id = data.get('assignedSupplierId')

    # Validate assignment logic based on role
    if role == Role.WAREHOUSE_OPERATOR:
        if not assigned_warehouse_id:
            return jsonify({'message': 'Warehouse operators must be assigned to a warehouse'}), 400
        if assigned_supplier_id:
            return jsonify({'message': 'Warehouse operators cannot be assigned to suppliers'}), 400
    elif role == Role.PROCUREMENT_MANAGER:
        if not assigned_supplier_id:
            return jsonify({'message': 'Procurement managers must be assigned to a supplier'}), 400
        if assigned_warehouse_id:
            return jsonify({'message': 'Procurement managers cannot be assigned to warehouses'}), 400
    elif role == Role.LOGISTICS_PLANNER:
        if not assigned_warehouse_id:
            return jsonify({'message': 'Logistics planners must be assigned to a warehouse'}), 400
        if assigned_supplier_id:
            return jsonify({'message': 'Logistics planners cannot be assigned to suppliers'}), 400
    elif role == Role.SUPPLIER:
        if assigned_warehouse_id:
            return jsonify({'message': 'Suppliers cannot be assigned to warehouses'}), 400
        # Suppliers can optionally be assigned to suppliers
    else:
        # ADMIN and DEALER roles don't require assignments
        if assigned_warehouse_id or assigned_supplier_id:
            return jsonify({'message': f'{role.value} role does not support assignments'}), 400

    user = User(
        email=data['email'],
        username=data['username'],
        first_name=data['firstName'],
        last_name=data['lastName'],
        role=role,
        assigned_warehouse_id=assigned_warehouse_id,
        assigned_supplier_id=assigned_supplier_id
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@admin_bp.route('/users/<int:user_id>', methods=['PATCH'])
@jwt_required()
def update_user(user_id):
    """Update a user (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403

    user = User.query.get_or_404(user_id)
    data = request.get_json()

    # Get the role (either from data or existing user)
    role = Role(data['role']) if 'role' in data else user.role

    # Validate assignment logic based on role
    assigned_warehouse_id = data.get('assignedWarehouseId', user.assigned_warehouse_id)
    assigned_supplier_id = data.get('assignedSupplierId', user.assigned_supplier_id)

    if role == Role.WAREHOUSE_OPERATOR:
        if assigned_warehouse_id is None:
            return jsonify({'message': 'Warehouse operators must be assigned to a warehouse'}), 400
        if assigned_supplier_id is not None:
            return jsonify({'message': 'Warehouse operators cannot be assigned to suppliers'}), 400
    elif role == Role.PROCUREMENT_MANAGER:
        if assigned_supplier_id is None:
            return jsonify({'message': 'Procurement managers must be assigned to a supplier'}), 400
        if assigned_warehouse_id is not None:
            return jsonify({'message': 'Procurement managers cannot be assigned to warehouses'}), 400
    elif role == Role.LOGISTICS_PLANNER:
        if assigned_warehouse_id is None:
            return jsonify({'message': 'Logistics planners must be assigned to a warehouse'}), 400
        if assigned_supplier_id is not None:
            return jsonify({'message': 'Logistics planners cannot be assigned to suppliers'}), 400
    elif role == Role.SUPPLIER:
        if assigned_warehouse_id is not None:
            return jsonify({'message': 'Suppliers cannot be assigned to warehouses'}), 400
        # Suppliers can optionally be assigned to suppliers
    else:
        # ADMIN and DEALER roles don't require assignments
        if assigned_warehouse_id is not None or assigned_supplier_id is not None:
            return jsonify({'message': f'{role.value} role does not support assignments'}), 400

    if 'firstName' in data:
        user.first_name = data['firstName']
    if 'lastName' in data:
        user.last_name = data['lastName']
    if 'role' in data:
        user.role = role
    if 'isActive' in data:
        user.is_active = data['isActive']
    if 'assignedWarehouseId' in data:
        user.assigned_warehouse_id = data['assignedWarehouseId']
    if 'assignedSupplierId' in data:
        user.assigned_supplier_id = data['assignedSupplierId']
    if 'password' in data and data['password']:
        user.set_password(data['password'])

    db.session.commit()
    return jsonify(user.to_dict())


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Deactivate a user (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'User deactivated successfully'})


@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get system statistics (Admin only)"""
    claims = get_jwt()
    if claims['role'] != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403
    
    # User stats
    total_users = User.query.count()
    users_by_role = {}
    for role in Role:
        users_by_role[role.value] = User.query.filter_by(role=role, is_active=True).count()
    
    # Request stats
    total_requests = ProductRequest.query.count()
    pending_requests = ProductRequest.query.filter(
        ProductRequest.status.in_([
            RequestStatus.PENDING,
            RequestStatus.AWAITING_RECOMMENDATION,
            RequestStatus.AWAITING_PROCUREMENT_APPROVAL
        ])
    ).count()
    active_requests = ProductRequest.query.filter(
        ProductRequest.status.in_([
            RequestStatus.RESERVED,
            RequestStatus.PICKING,
            RequestStatus.INSPECTION_PENDING,
            RequestStatus.ALLOCATED,
            RequestStatus.IN_TRANSIT
        ])
    ).count()
    completed_requests = ProductRequest.query.filter_by(
        status=RequestStatus.COMPLETED
    ).count()
    
    # Warehouse stats
    total_warehouses = Warehouse.query.filter_by(is_active=True).count()
    
    # Supplier stats
    total_suppliers = Supplier.query.filter_by(is_active=True).count()
    
    return jsonify({
        'users': {
            'total': total_users,
            'byRole': users_by_role
        },
        'requests': {
            'total': total_requests,
            'pending': pending_requests,
            'active': active_requests,
            'completed': completed_requests
        },
        'warehouses': {
            'total': total_warehouses
        },
        'suppliers': {
            'total': total_suppliers
        }
    })
