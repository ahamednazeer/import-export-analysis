from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus, ReservationStatus
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock
from app.models.inspection import InspectionImage, InspectionResult
from app.services.source_completion import SourceCompletionService

procurement_bp = Blueprint('procurement', __name__)


@procurement_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending():
    """Get requests pending procurement approval"""
    claims = get_jwt()

    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    from sqlalchemy import or_
    
    requests_list = ProductRequest.query.filter(
        or_(
            ProductRequest.status.in_([
                RequestStatus.AWAITING_PROCUREMENT_APPROVAL,
                RequestStatus.PARTIALLY_BLOCKED,
                RequestStatus.BLOCKED
            ]),
            ProductRequest.reservations.any(Reservation.is_blocked == True)
        )
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
        # NOTE: Replacement creates a NEW reservation that must complete its own pickup/inspection
        blocked_reservation_id = data.get('blockedReservationId')
        new_warehouse_id = data.get('newWarehouseId')
        quantity = data.get('quantity')

        blocked_reservation = Reservation.query.get(blocked_reservation_id)
        if not blocked_reservation:
            return jsonify({'message': 'Blocked reservation not found'}), 404

        # Release stock reservation from the original blocked warehouse
        if blocked_reservation.warehouse_id:
            original_stock = Stock.query.filter_by(
                warehouse_id=blocked_reservation.warehouse_id,
                product_id=product_request.product_id
            ).first()
            if original_stock:
                original_stock.reserved_quantity = max(0, original_stock.reserved_quantity - quantity)

        # Mark blocked reservation as BLOCKED status (will be replaced)
        blocked_reservation.reservation_status = ReservationStatus.BLOCKED
        blocked_reservation.procurement_resolved = True
        blocked_reservation.procurement_resolved_at = datetime.utcnow()
        blocked_reservation.procurement_resolution_notes = f"Replaced with warehouse {new_warehouse_id}"
        
        # Reduce blocked reservation quantity or delete if fully replaced
        blocked_reservation.quantity -= quantity
        if blocked_reservation.quantity <= 0:
            # Soft delete: keep record but zero out quantity and mark as resolved
            blocked_reservation.quantity = 0
            blocked_reservation.reservation_status = ReservationStatus.PROCUREMENT_RESOLVED
            # Do NOT delete, as it is referenced by new_reservation.original_reservation_id
            # db.session.delete(blocked_reservation)

        # Create new reservation from replacement warehouse
        # NOTE: This new reservation starts at PENDING - must complete its own pickup + AI check
        new_reservation = Reservation(
            request_id=request_id,
            warehouse_id=new_warehouse_id,
            quantity=quantity,
            is_local=True,
            is_replacement=True,
            original_reservation_id=blocked_reservation_id,
            reservation_status=ReservationStatus.PENDING  # New source starts at PENDING
        )
        db.session.add(new_reservation)

        # Update stock reservation for the new warehouse
        new_stock = Stock.query.filter_by(
            warehouse_id=new_warehouse_id,
            product_id=product_request.product_id
        ).first()
        if new_stock:
            new_stock.reserved_quantity += quantity

        # Set request to WAITING_FOR_ALL_PICKUPS
        # The new reservation must complete pickup + AI before logistics can begin
        product_request.status = RequestStatus.WAITING_FOR_ALL_PICKUPS
        product_request.procurement_notes = f"Replacement from warehouse {new_warehouse_id} assigned. Waiting for new source to complete pickup: {data.get('notes', '')}"
        
        # Trigger completion check (will stay in WAITING - new source not ready yet)
        db.session.commit()
        SourceCompletionService().check_all_sources_ready(request_id)
        
    elif action == 'import':
        # Import shortfall from supplier with intelligent status assignment
        supplier_id = data.get('supplierId')
        quantity = data.get('quantity')

        # Handle blocked reservation if specified
        blocked_reservation_id = data.get('blockedReservationId')
        if blocked_reservation_id:
            blocked_reservation = Reservation.query.get(blocked_reservation_id)
            if blocked_reservation:
                blocked_reservation.reservation_status = ReservationStatus.BLOCKED
                blocked_reservation.procurement_resolved = True
                blocked_reservation.procurement_resolved_at = datetime.utcnow()
                blocked_reservation.procurement_resolution_notes = f"Replaced with import from supplier {supplier_id}"

                # Soft delete blocked reservation
                blocked_reservation.reservation_status = ReservationStatus.PROCUREMENT_RESOLVED
                blocked_reservation.quantity = 0

        # Use intelligent supplier reservation creation
        sourcing_service = SourcingService()
        new_reservation = sourcing_service.create_manual_supplier_reservation(
            product_request, supplier_id, quantity
        )

        # Set replacement flag if applicable
        if blocked_reservation_id:
            new_reservation.is_replacement = True
            new_reservation.original_reservation_id = blocked_reservation_id

        # Determine status message based on auto-confirmation
        supplier = Supplier.query.get(supplier_id)
        if new_reservation.reservation_status == ReservationStatus.SUPPLIER_CONFIRMED:
            status_msg = f"Auto-approved import from trusted supplier {supplier.name if supplier else supplier_id}"
        else:
            status_msg = f"Import from supplier {supplier.name if supplier else supplier_id} assigned. Waiting for supplier confirmation"

        # Set request to WAITING_FOR_ALL_PICKUPS
        # Note: If supplier was auto-confirmed, this might transition immediately
        product_request.status = RequestStatus.WAITING_FOR_ALL_PICKUPS
        product_request.procurement_notes = f"{status_msg}: {data.get('notes', '')}"

        # Trigger completion check (may transition to READY_FOR_ALLOCATION if auto-confirmed)
        db.session.commit()
        SourceCompletionService().check_all_sources_ready(request_id)
        
    elif action == 'accept_damage':
        # Accept damaged/low confidence items and proceed anyway
        # Mark all blocked reservations as procurement-resolved
        source_completion = SourceCompletionService()
        
        for res in product_request.reservations:
            if res.is_blocked or res.reservation_status in [
                ReservationStatus.AI_DAMAGED,
                ReservationStatus.AI_LOW_CONFIDENCE
            ]:
                # Mark as procurement resolved - this counts as "ready"
                res.is_blocked = False
                res.block_reason = None
                res.procurement_resolved = True
                res.procurement_resolved_at = datetime.utcnow()
                res.procurement_resolution_notes = f"Damage/issue accepted by manager: {data.get('notes', '')}"
                res.reservation_status = ReservationStatus.PROCUREMENT_RESOLVED
        
        product_request.procurement_notes = f"Damage/issue accepted by manager: {data.get('notes', '')}"
        
        # Commit changes and then check if all sources are ready
        db.session.commit()
        
        # Use SourceCompletionService to check if all sources ready
        # This will transition to READY_FOR_ALLOCATION if all sources are complete
        all_ready = source_completion.check_all_sources_ready(request_id)
        
        if not all_ready:
            # Some sources still not ready, update status
            product_request.status = RequestStatus.WAITING_FOR_ALL_PICKUPS
            db.session.commit()
        
    elif action == 'reject':
        # Release all stock reservations for this request
        for reservation in product_request.reservations:
            if reservation.warehouse_id:
                stock = Stock.query.filter_by(
                    warehouse_id=reservation.warehouse_id,
                    product_id=product_request.product_id
                ).first()
                if stock:
                    stock.reserved_quantity = max(0, stock.reserved_quantity - reservation.quantity)

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


@procurement_bp.route('/completion-status/<int:request_id>', methods=['GET'])
@jwt_required()
def get_completion_status(request_id):
    """
    Get source completion status for a request.
    
    Joint Wait Model: Shows which sources are ready and which are still pending.
    """
    claims = get_jwt()
    
    if claims['role'] not in ['PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_PLANNER']:
        return jsonify({'message': 'Access denied'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    completion_status = SourceCompletionService().get_completion_status(request_id)
    completion_status['request'] = product_request.to_dict(include_relations=True)
    
    return jsonify(completion_status)


@procurement_bp.route('/ready-for-allocation/<int:request_id>', methods=['POST'])
@jwt_required()
def mark_ready_for_allocation(request_id):
    """Mark request as ready for logistics allocation"""
    claims = get_jwt()

    if claims['role'] not in ['PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Procurement manager or warehouse operator access required'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    # Use SourceCompletionService to verify all sources are ready
    source_completion = SourceCompletionService()
    completion_status = source_completion.get_completion_status(request_id)
    
    if not completion_status.get('isComplete'):
        return jsonify({
            'message': 'Not all sources are ready. Cannot proceed to logistics.',
            'completionStatus': completion_status
        }), 400
    
    product_request.status = RequestStatus.READY_FOR_ALLOCATION
    db.session.commit()

    return jsonify(product_request.to_dict())


@procurement_bp.route('/auto-resolve-blocked/<int:request_id>', methods=['POST'])
@jwt_required()
def auto_resolve_blocked(request_id):
    """Auto-resolve BLOCKED requests by allocating full import"""
    claims = get_jwt()

    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403

    product_request = ProductRequest.query.get_or_404(request_id)

    if product_request.status != RequestStatus.BLOCKED:
        return jsonify({'message': 'Request is not in BLOCKED status'}), 400

    # Clear all damaged reservations and release stock reservations
    damaged_reservations = Reservation.query.filter_by(request_id=request_id).all()
    for reservation in damaged_reservations:
        if reservation.warehouse_id:
            stock = Stock.query.filter_by(
                warehouse_id=reservation.warehouse_id,
                product_id=product_request.product_id
            ).first()
            if stock:
                stock.reserved_quantity = max(0, stock.reserved_quantity - reservation.quantity)

    Reservation.query.filter_by(request_id=request_id).delete()

    # Get the sourcing recommendation and create full import reservations
    from app.services.sourcing import SourcingService
    sourcing_service = SourcingService()

    # Create import reservations for full quantity
    supplier_stocks = SupplierStock.query.filter_by(
        product_id=product_request.product_id,
        is_active=True
    ).filter(SupplierStock.available_quantity > 0).order_by(SupplierStock.lead_time_days.asc()).all()

    remaining_qty = product_request.quantity
    import_reservations = []

    for supplier_stock in supplier_stocks:
        if remaining_qty <= 0:
            break
        alloc_qty = min(supplier_stock.available_quantity, remaining_qty)
        reservation = Reservation(
            request_id=request_id,
            supplier_id=supplier_stock.supplier_id,
            quantity=alloc_qty,
            is_local=False
        )
        db.session.add(reservation)
        import_reservations.append(reservation)
        remaining_qty -= alloc_qty

    if remaining_qty > 0:
        return jsonify({'message': 'Insufficient import stock available'}), 400

    product_request.status = RequestStatus.IMPORT_APPROVED
    product_request.procurement_notes = "Auto-approved full import due to all local stock being damaged"

    db.session.commit()

    return jsonify({
        'message': 'Request auto-approved for full import',
        'request': product_request.to_dict(),
        'reservations': [r.to_dict(include_request=False) for r in import_reservations]
    })


@procurement_bp.route('/mark-source-ready', methods=['POST'])
@jwt_required()
def mark_source_ready():
    """Manually mark a source as READY (Procurement Manager only)"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Procurement manager access required'}), 403
    
    data = request.get_json()
    reservation_id = data.get('reservationId')
    reason = data.get('reason', 'Manual override by manager')
    
    if not reservation_id:
        return jsonify({'message': 'reservationId is required'}), 400
        
    source_completion = SourceCompletionService()
    try:
        is_complete = source_completion.mark_source_ready(reservation_id, reason)
        return jsonify({
            'message': 'Source marked as ready',
            'isComplete': is_complete
        })
    except Exception as e:
        return jsonify({'message': str(e)}), 400
