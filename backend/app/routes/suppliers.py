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


@suppliers_bp.route('/products/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product_suppliers(product_id):
    """Get suppliers that carry a specific product"""
    product = Product.query.get_or_404(product_id)
    stocks = SupplierStock.query.filter_by(product_id=product_id, is_active=True).all()
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


@suppliers_bp.route('/<int:supplier_id>/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_supplier_product(supplier_id, product_id):
    """Remove a product from supplier catalog (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or user.role != Role.ADMIN:
        return jsonify({'message': 'Admin access required'}), 403

    stock = SupplierStock.query.filter_by(
        supplier_id=supplier_id,
        product_id=product_id
    ).first()

    if not stock:
        return jsonify({'message': 'Product not found in supplier catalog'}), 404

    db.session.delete(stock)
    db.session.commit()

    return jsonify({'message': 'Product removed from supplier catalog successfully'})


# ============================================================================
# SUPPLIER CONFIRMATION ENDPOINTS (Joint Wait Model)
# ============================================================================

@suppliers_bp.route('/my/pending-reservations', methods=['GET'])
@jwt_required()
def get_my_pending_reservations():
    """
    Get pending reservations for the current supplier user.
    
    Joint Wait Model: Suppliers must confirm their reservations before
    the system can transition requests to logistics.
    """
    claims = get_jwt()
    
    if claims['role'] != 'SUPPLIER':
        return jsonify({'message': 'Supplier access required'}), 403
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.assigned_supplier_id:
        return jsonify({'message': 'User not assigned to a supplier'}), 400
    
    from app.models.request import Reservation, ReservationStatus, ProductRequest
    
    # Get reservations for this supplier that are pending confirmation
    reservations = Reservation.query.filter(
        Reservation.supplier_id == user.assigned_supplier_id,
        Reservation.reservation_status.in_([
            ReservationStatus.PENDING,
            ReservationStatus.SUPPLIER_PENDING
        ])
    ).all()
    
    # Group by request
    result = []
    for res in reservations:
        result.append({
            'reservation': res.to_dict(include_request=True),
            'productRequest': res.request.to_dict(include_relations=True) if res.request else None
        })
    
    return jsonify(result)


@suppliers_bp.route('/confirm-availability/<int:reservation_id>', methods=['POST'])
@jwt_required()
def confirm_availability(reservation_id):
    """
    Supplier confirms availability and readiness to dispatch.
    
    Joint Wait Model: After confirmation, the SourceCompletionService
    checks if ALL sources are ready before transitioning to logistics.
    """
    claims = get_jwt()
    
    if claims['role'] != 'SUPPLIER':
        return jsonify({'message': 'Supplier access required'}), 403
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.assigned_supplier_id:
        return jsonify({'message': 'User not assigned to a supplier'}), 400
    
    from app.models.request import Reservation, ReservationStatus
    from app.services.source_completion import SourceCompletionService
    
    reservation = Reservation.query.get_or_404(reservation_id)
    
    # Verify reservation belongs to user's supplier
    if reservation.supplier_id != user.assigned_supplier_id:
        return jsonify({'message': 'Unauthorized: reservation does not belong to your supplier'}), 403
    
    # Verify reservation is pending confirmation
    if reservation.reservation_status not in [
        ReservationStatus.PENDING,
        ReservationStatus.SUPPLIER_PENDING
    ]:
        return jsonify({'message': 'Reservation is not pending confirmation'}), 400
    
    # Get optional confirmation notes
    data = request.get_json() or {}
    notes = data.get('notes', '')
    
    # Mark as confirmed
    reservation.reservation_status = ReservationStatus.SUPPLIER_CONFIRMED
    
    db.session.commit()
    
    print(f"[SUPPLIER] Reservation {reservation_id} confirmed by supplier {user.assigned_supplier_id}")
    
    # Trigger source completion check
    # This will transition request to READY_FOR_ALLOCATION if ALL sources ready
    source_completion = SourceCompletionService()
    all_ready = source_completion.check_all_sources_ready(reservation.request_id)
    
    if all_ready:
        print(f"[SUPPLIER] Request {reservation.request_id} ALL SOURCES READY - transitioned to READY_FOR_ALLOCATION")
    
    # Return updated reservation with completion status
    completion_status = source_completion.get_completion_status(reservation.request_id)
    
    return jsonify({
        'reservation': reservation.to_dict(),
        'completionStatus': completion_status,
        'message': 'Availability confirmed successfully'
    })


@suppliers_bp.route('/my/confirmed-reservations', methods=['GET'])
@jwt_required()
def get_my_confirmed_reservations():
    """
    Get confirmed reservations for the current supplier user.
    These are ready for dispatch when logistics allocates shipments.
    """
    claims = get_jwt()
    
    if claims['role'] != 'SUPPLIER':
        return jsonify({'message': 'Supplier access required'}), 403
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user or not user.assigned_supplier_id:
        return jsonify({'message': 'User not assigned to a supplier'}), 400
    
    from app.models.request import Reservation, ReservationStatus
    
    # Get confirmed reservations for this supplier
    reservations = Reservation.query.filter(
        Reservation.supplier_id == user.assigned_supplier_id,
        Reservation.reservation_status.in_([
            ReservationStatus.SUPPLIER_CONFIRMED,
            ReservationStatus.READY
        ])
    ).all()
    
    return jsonify([res.to_dict(include_request=True) for res in reservations])

