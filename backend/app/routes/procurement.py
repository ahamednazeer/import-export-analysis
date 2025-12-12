from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock
from app.models.inspection import InspectionImage, InspectionResult

procurement_bp = Blueprint('procurement', __name__)


@procurement_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending():
    """Get requests pending procurement approval"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    requests_list = ProductRequest.query.filter(
        ProductRequest.status.in_([
            RequestStatus.AWAITING_PROCUREMENT_APPROVAL,
            RequestStatus.PARTIALLY_BLOCKED
        ])
    ).order_by(ProductRequest.created_at.desc()).all()
    
    return jsonify([r.to_dict() for r in requests_list])


@procurement_bp.route('/resolve/<int:request_id>', methods=['POST'])
@jwt_required()
def resolve_issue(request_id):
    """Resolve procurement issue"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    data = request.get_json()
    
    action = data.get('action')
    
    if action == 'approve':
        # Approve import/sourcing decision
        product_request.status = RequestStatus.RESERVED
        product_request.confirmed_at = datetime.utcnow()
        product_request.procurement_notes = data.get('notes')
        
    elif action == 'replace':
        # Replace blocked stock from another warehouse
        blocked_reservation_id = data.get('blockedReservationId')
        new_warehouse_id = data.get('newWarehouseId')
        quantity = data.get('quantity')
        
        blocked_reservation = Reservation.query.get(blocked_reservation_id)
        if not blocked_reservation:
            return jsonify({'message': 'Blocked reservation not found'}), 404
        
        # Reduce blocked reservation
        blocked_reservation.quantity -= quantity
        if blocked_reservation.quantity <= 0:
            db.session.delete(blocked_reservation)
        
        # Create new reservation from replacement warehouse
        new_reservation = Reservation(
            request_id=request_id,
            warehouse_id=new_warehouse_id,
            quantity=quantity,
            is_local=True,
            is_replacement=True,
            original_reservation_id=blocked_reservation_id
        )
        db.session.add(new_reservation)
        
        # Update stock reservation
        stock = Stock.query.filter_by(
            warehouse_id=new_warehouse_id,
            product_id=product_request.product_id
        ).first()
        if stock:
            stock.reserved_quantity += quantity
        
        product_request.status = RequestStatus.RESOLVED_PARTIAL
        product_request.procurement_notes = data.get('notes')
        
    elif action == 'import':
        # Import shortfall from supplier
        supplier_id = data.get('supplierId')
        quantity = data.get('quantity')
        
        new_reservation = Reservation(
            request_id=request_id,
            supplier_id=supplier_id,
            quantity=quantity,
            is_local=False
        )
        db.session.add(new_reservation)
        
        product_request.status = RequestStatus.RESOLVED_PARTIAL
        product_request.procurement_notes = data.get('notes')
        
    elif action == 'accept_damage':
        # Accept damaged/low confidence items and proceed anyway
        # Clear all blocked reservations
        for res in product_request.reservations:
            if res.is_blocked:
                res.is_blocked = False
                res.block_reason = None
        
        product_request.status = RequestStatus.READY_FOR_ALLOCATION
        product_request.procurement_notes = f"Damage accepted by manager: {data.get('notes', '')}"
        
    elif action == 'reject':
        # Reject the request
        product_request.status = RequestStatus.CANCELLED
        product_request.procurement_notes = data.get('notes')
        
    elif action == 'request_reupload':
        # Request warehouse to re-upload images
        product_request.status = RequestStatus.PICKING
        product_request.procurement_notes = f"Re-upload requested: {data.get('notes', '')}"
        
    else:
        return jsonify({'message': 'Invalid action'}), 400
    
    db.session.commit()
    return jsonify(product_request.to_dict())


@procurement_bp.route('/replacement-options/<int:request_id>', methods=['GET'])
@jwt_required()
def get_replacement_options(request_id):
    """Get replacement options for a blocked request"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    # Get warehouses with available stock
    # Note: available_quantity is a property, so we filter in Python
    all_stocks = Stock.query.filter_by(
        product_id=product_request.product_id
    ).all()
    available_stocks = [s for s in all_stocks if s.available_quantity > 0]
    
    # Get import options
    all_supplier_stocks = SupplierStock.query.filter_by(
        product_id=product_request.product_id,
        is_active=True
    ).all()
    supplier_stocks = [s for s in all_supplier_stocks if s.available_quantity > 0]
    
    return jsonify({
        'localOptions': [s.to_dict() for s in available_stocks],
        'importOptions': [s.to_dict() for s in supplier_stocks]
    })


@procurement_bp.route('/ready-for-allocation/<int:request_id>', methods=['POST'])
@jwt_required()
def mark_ready_for_allocation(request_id):
    """Mark request as ready for logistics allocation"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    # Verify all reservations are unblocked or replaced
    blocked = Reservation.query.filter_by(
        request_id=request_id,
        is_blocked=True
    ).count()
    
    if blocked > 0:
        return jsonify({'message': 'There are still blocked reservations'}), 400
    
    product_request.status = RequestStatus.READY_FOR_ALLOCATION
    db.session.commit()
    
    return jsonify(product_request.to_dict())
