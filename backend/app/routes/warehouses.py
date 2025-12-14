from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from sqlalchemy import or_
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
    print(f"[WAREHOUSE_STOCK] Getting stock for warehouse {warehouse_id}")
    warehouse = Warehouse.query.get_or_404(warehouse_id)
    stocks = Stock.query.filter_by(warehouse_id=warehouse_id).all()
    print(f"[WAREHOUSE_STOCK] Found {len(stocks)} stock records")
    for stock in stocks:
        print(f"[WAREHOUSE_STOCK] Stock ID {stock.id}: product {stock.product_id}, quantity {stock.quantity}, reserved {stock.reserved_quantity}")
    return jsonify([s.to_dict() for s in stocks])


@warehouses_bp.route('/<int:warehouse_id>/stock', methods=['POST'])
@jwt_required()
def update_stock(warehouse_id):
    """Update stock levels (Admin/Warehouse Operator)"""
    claims = get_jwt()
    if claims['role'] not in ['ADMIN', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Not authorized'}), 403

    # For warehouse operators, verify they are assigned to this warehouse
    if claims['role'] == 'WAREHOUSE_OPERATOR':
        user_id = int(get_jwt_identity())
        from app.models.user import User
        user = User.query.get(user_id)
        if not user or user.assigned_warehouse_id != warehouse_id:
            return jsonify({'message': 'Unauthorized: can only manage stock for assigned warehouse'}), 403

    warehouse = Warehouse.query.get_or_404(warehouse_id)
    data = request.get_json()
    
    product_id = data.get('productId')
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404
    
    # Find or create stock record - always overwrite existing data
    batch_number = data.get('batchNumber') or None  # Normalize empty string to None
    if batch_number == '':
        batch_number = None

    # Find existing stock record - handle both None and empty string batch numbers
    if batch_number is None:
        # If no batch number, find records with no batch number (None or empty string)
        stock = Stock.query.filter(
            Stock.warehouse_id == warehouse_id,
            Stock.product_id == product_id,
            (Stock.batch_number.is_(None) | (Stock.batch_number == ''))
        ).first()
    else:
        # If batch number provided, find exact match
        stock = Stock.query.filter_by(
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch_number=batch_number
        ).first()

    if not stock:
        stock = Stock(
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch_number=batch_number
        )
        db.session.add(stock)

    # Set quantity
    quantity = data.get('quantity', 0)
    stock.quantity = quantity

    # Handle available quantity setting
    available_quantity = data.get('availableQuantity')
    if available_quantity is not None and available_quantity != '':
        # User specified available quantity - adjust reserved_quantity accordingly
        desired_available = int(available_quantity)
        stock.reserved_quantity = max(0, quantity - desired_available)
    # If no available quantity specified, keep existing reserved_quantity

    stock.location_code = data.get('locationCode')

    if data.get('expiryDate'):
        stock.expiry_date = datetime.fromisoformat(data['expiryDate']).date()
    else:
        stock.expiry_date = None

    # Update last_updated timestamp
    stock.last_updated = datetime.utcnow()
    
    db.session.commit()
    return jsonify(stock.to_dict())


@warehouses_bp.route('/stock/product/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product_stock(product_id):
    """Get stock for a product across all warehouses"""
    stocks = Stock.query.filter_by(product_id=product_id).filter(Stock.quantity > 0).all()
    return jsonify([s.to_dict() for s in stocks])


@warehouses_bp.route('/<int:warehouse_id>/stock/<int:stock_id>', methods=['DELETE'])
@jwt_required()
def delete_stock(warehouse_id, stock_id):
    """Delete stock record (Admin/Warehouse Operator)"""
    claims = get_jwt()
    if claims['role'] not in ['ADMIN', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Not authorized'}), 403

    # For warehouse operators, verify they are assigned to this warehouse
    if claims['role'] == 'WAREHOUSE_OPERATOR':
        user_id = int(get_jwt_identity())
        from app.models.user import User
        user = User.query.get(user_id)
        if not user or user.assigned_warehouse_id != warehouse_id:
            return jsonify({'message': 'Unauthorized: can only manage stock for assigned warehouse'}), 403

    stock = Stock.query.filter_by(id=stock_id, warehouse_id=warehouse_id).first()
    if not stock:
        return jsonify({'message': 'Stock record not found'}), 404

    db.session.delete(stock)
    db.session.commit()

    return jsonify({'message': 'Stock record deleted successfully'})


@warehouses_bp.route('/my/pick-tasks', methods=['GET'])
@jwt_required()
def get_my_pick_tasks():
    """Get pick tasks for the current warehouse operator's warehouse"""
    claims = get_jwt()
    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can access pick tasks'}), 403

    user_id = int(get_jwt_identity())
    from app.models.user import User
    user = User.query.get(user_id)

    if not user or not user.assigned_warehouse_id:
        return jsonify({'message': 'User not assigned to a warehouse'}), 400

    from app.models.request import Reservation, ProductRequest, RequestStatus
    from app.models.inspection import InspectionImage, InspectionResult

    # Get reservations for this warehouse that need picking OR inspection
    reservations = Reservation.query.filter(
        Reservation.warehouse_id == user.assigned_warehouse_id,
        Reservation.is_local == True,
        # Only reservations from requests that are in the right status
        Reservation.request_id.in_(
            db.session.query(ProductRequest.id).filter(
                ProductRequest.status.in_([
                    RequestStatus.RESERVED,
                    RequestStatus.PICKING,
                    RequestStatus.INSPECTION_PENDING,
                    RequestStatus.PICKING,
                    RequestStatus.INSPECTION_PENDING,
                    RequestStatus.PARTIALLY_BLOCKED,
                    RequestStatus.BLOCKED,
                    RequestStatus.RESOLVED_PARTIAL,
                    RequestStatus.WAITING_FOR_ALL_PICKUPS
                ])
            )
        )
    ).filter(
        # Include reservations that haven't been picked yet OR haven't been inspected yet
        # Include reservations that haven't been picked yet, OR haven't been inspected yet, OR are blocked
        or_(
            Reservation.is_picked == False,  # Not picked yet
            Reservation.is_blocked == True,   # Blocked (damaged/issue) - keep visible
            # OR not fully inspected (no inspection images with final results)
            ~db.session.query(InspectionImage.id).filter(
                InspectionImage.reservation_id == Reservation.id,
                InspectionImage.result.in_([
                    InspectionResult.OK,
                    InspectionResult.DAMAGED,
                    InspectionResult.EXPIRED
                ])
            ).exists(),
            # Explicitly include ANY reservation if the request itself is BLOCKED (damaged)
            # This ensures it shows up in "Issues" regardless of individual reservation status
            Reservation.request_id.in_(
                db.session.query(ProductRequest.id).filter(ProductRequest.status == RequestStatus.BLOCKED)
            )
        )
    ).all()

    # Group by request for better UI presentation
    tasks_by_request = {}
    for reservation in reservations:
        request_id = reservation.request_id
        if request_id not in tasks_by_request:
            request_dict = reservation.request.to_dict(include_relations=False)
            request_dict['product'] = reservation.request.product.to_dict() if reservation.request.product else None
            request_dict['dealer'] = reservation.request.dealer.to_dict() if reservation.request.dealer else None
            
            # Get warehouse-specific reservations
            warehouse_reservations = [r for r in reservation.request.reservations if r.warehouse_id == user.assigned_warehouse_id]
            warehouse_res_ids = [r.id for r in warehouse_reservations]
            
            # Add inspection progress
            inspected_images = InspectionImage.query.filter(
                InspectionImage.reservation_id.in_(warehouse_res_ids),
                InspectionImage.result.in_([InspectionResult.OK, InspectionResult.DAMAGED, InspectionResult.EXPIRED, InspectionResult.LOW_CONFIDENCE])
            ).all()
            
            total_warehouse_reservations = len(warehouse_reservations)
            total_warehouse_reservations = len(warehouse_reservations)
            inspected_count = len([img for img in inspected_images if img.result in [InspectionResult.OK, InspectionResult.DAMAGED, InspectionResult.EXPIRED]])
            
            request_dict['inspectionProgress'] = {
                'inspected': inspected_count,
                'total': total_warehouse_reservations,
                'percentage': int((inspected_count / total_warehouse_reservations * 100) if total_warehouse_reservations > 0 else 0)
            }
            
            tasks_by_request[request_id] = {
                'request': request_dict,
                'reservations': [],
                # Include inspection images for better UI status display
                'inspectionImages': [img.to_dict() for img in inspected_images]
            }
        tasks_by_request[request_id]['reservations'].append(reservation.to_dict(include_request=False))

    return jsonify(list(tasks_by_request.values()))


@warehouses_bp.route('/pick/<int:reservation_id>', methods=['POST'])
@jwt_required()
def pick_reservation(reservation_id):
    """Mark a reservation as picked"""
    claims = get_jwt()
    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can pick reservations'}), 403

    user_id = int(get_jwt_identity())
    from app.models.user import User
    user = User.query.get(user_id)

    if not user or not user.assigned_warehouse_id:
        return jsonify({'message': 'User not assigned to a warehouse'}), 400

    from app.models.request import Reservation, ProductRequest, RequestStatus, ReservationStatus

    reservation = Reservation.query.get_or_404(reservation_id)

    # Verify reservation belongs to user's warehouse
    if reservation.warehouse_id != user.assigned_warehouse_id:
        return jsonify({'message': 'Unauthorized: reservation does not belong to your warehouse'}), 403

    # Verify it's not already picked
    if reservation.is_picked:
        return jsonify({'message': 'Reservation already picked'}), 400

    # Mark as picked with Joint Wait model tracking
    reservation.is_picked = True
    reservation.picked_at = datetime.utcnow()
    reservation.picked_by_id = user_id
    reservation.reservation_status = ReservationStatus.PICKED  # Joint Wait: track picking status

    # Update request status to picking if this is the first pick
    product_request = reservation.request
    if product_request.status == RequestStatus.RESERVED:
        product_request.status = RequestStatus.PICKING

    # Check if all reservations for this warehouse are picked
    # If so, move to INSPECTION_PENDING
    warehouse_reservations = Reservation.query.filter_by(
        request_id=reservation.request_id,
        warehouse_id=user.assigned_warehouse_id
    ).all()
    
    if all(r.is_picked for r in warehouse_reservations):
        if product_request.status == RequestStatus.PICKING:
            product_request.status = RequestStatus.INSPECTION_PENDING

    db.session.commit()

    return jsonify(reservation.to_dict())


@warehouses_bp.route('/my/completed-tasks', methods=['GET'])
@jwt_required()
def get_my_completed_tasks():
    """Get completed tasks for the current warehouse operator's warehouse"""
    claims = get_jwt()
    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can access completed tasks'}), 403

    user_id = int(get_jwt_identity())
    from app.models.user import User
    user = User.query.get(user_id)

    if not user or not user.assigned_warehouse_id:
        return jsonify({'message': 'User not assigned to a warehouse'}), 400

    from app.models.request import Reservation, ProductRequest, RequestStatus, ReservationStatus
    from app.models.inspection import InspectionImage, InspectionResult

    # Get requests that have reservations for this warehouse that are LOCALLY complete
    # A reservation is complete if:
    # 1. It is picked (is_picked=True)
    # 2. It is either AI Confirmed, Ready, or has OK inspection images
    
    # First, get all picked reservations for this warehouse
    picked_reservations = Reservation.query.filter(
        Reservation.warehouse_id == user.assigned_warehouse_id,
        Reservation.is_picked == True
    ).all()
    
    completed_request_ids = set()
    
    for reservation in picked_reservations:
        # Check if inspection is complete for this reservation
        # If it has inspection images, check if they are OK/DAMAGED (final results)
        # Or if reservation status implies completion
        
        is_complete = False
        
        # Check explicit status first
        if reservation.reservation_status in [ReservationStatus.READY, ReservationStatus.AI_CONFIRMED, ReservationStatus.PROCUREMENT_RESOLVED]:
            is_complete = True
        else:
            # Check inspection images
            # If there are images, and ALL of them have a final result, it's complete?
            # Or if AT LEAST ONE is OK?
            # Logic: If we have images, we are in inspection phase.
            # If we passed inspection, we are done.
            
            images = InspectionImage.query.filter_by(reservation_id=reservation.id).all()
            if images:
                # If any image is OK, we are good? No, usually all must be processed.
                # But standard flow: Upload -> AI -> OK/DAMAGED.
                # If we have an OK/DAMAGED result, we are done with that image.
                # If all images are finalized?
                # Simplify: If we have ANY OK/DAMAGED image, we assume some inspection happened.
                # But to be "Completed Task", we should be fully done.
                # Let's assume if we have picked AND (AI Confirmed OR Ready OR (Images exist and are processed)), it's done.

                # Actually, simply checking if the request is NOT in "My Pick Tasks" logic might be best.
                # But "My Pick Tasks" logic is complex.
                
                # Let's use the inverse of the Pick Task filter:
                # Pick Task = (Not Picked OR Not Fully Inspected)
                # Completed = (Picked AND Fully Inspected)
                
                has_pending_images = any(img.result == InspectionResult.PROCESSING for img in images)
                if not has_pending_images:
                     is_complete = True
            else:
                # No images yet. If it's pure picking (no inspection required?), it's done upon picking.
                # Assuming all warehouse tasks require inspection?
                # If not, is_picked=True is enough.
                is_complete = True

        if is_complete:
            completed_request_ids.add(reservation.request_id)
            
    # Also include requests that are globally completed (just in case)
    global_completed_ids = db.session.query(ProductRequest.id).filter(
        ProductRequest.status.in_([
            RequestStatus.READY_FOR_ALLOCATION,
            RequestStatus.ALLOCATED,
            RequestStatus.IN_TRANSIT,
            RequestStatus.COMPLETED,
            RequestStatus.BLOCKED,
            RequestStatus.CANCELLED
        ])
    ).join(Reservation).filter(Reservation.warehouse_id == user.assigned_warehouse_id).all()
    
    for rid in global_completed_ids:
        completed_request_ids.add(rid[0])
    
    if not completed_request_ids:
        return jsonify([])

    # Get the full request details
    results = []
    # Sort by updated_at desc
    requests = ProductRequest.query.filter(ProductRequest.id.in_(completed_request_ids)).order_by(ProductRequest.updated_at.desc()).all()
    
    for request in requests:
        # Calculate warehouse-specific quantity
        warehouse_reservations = [r for r in request.reservations if r.warehouse_id == user.assigned_warehouse_id]
        warehouse_quantity = sum(r.quantity for r in warehouse_reservations)

        # Add warehouse-specific data to the request dict
        request_dict = request.to_dict(include_relations=False)
        request_dict['product'] = request.product.to_dict() if request.product else None
        request_dict['warehouseQuantity'] = warehouse_quantity
        request_dict['warehouseReservations'] = [r.to_dict(include_request=False) for r in warehouse_reservations]

        results.append(request_dict)

    return jsonify(results)
