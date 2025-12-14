from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus
from app.models.shipment import Shipment, ShipmentStatus
from app.models.warehouse import Stock

logistics_bp = Blueprint('logistics', __name__)


@logistics_bp.route('/ready-for-allocation', methods=['GET'])
@jwt_required()
def get_ready_for_allocation():
    """Get requests ready for shipment allocation"""
    claims = get_jwt()

    if claims['role'] not in ['LOGISTICS_PLANNER', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Logistics planner or warehouse operator access required'}), 403
    
    requests_list = ProductRequest.query.filter_by(
        status=RequestStatus.READY_FOR_ALLOCATION
    ).order_by(ProductRequest.created_at.desc()).all()
    
    return jsonify([r.to_dict() for r in requests_list])


@logistics_bp.route('/allocate/<int:request_id>', methods=['POST'])
@jwt_required()
def allocate_shipments(request_id):
    """Create shipment allocations for a request"""
    claims = get_jwt()
    
    if claims['role'] != 'LOGISTICS_PLANNER':
        return jsonify({'message': 'Logistics planner access required'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    if product_request.status != RequestStatus.READY_FOR_ALLOCATION:
        return jsonify({'message': 'Request is not ready for allocation'}), 400
    
    data = request.get_json()
    allocations = data.get('allocations', [])
    
    shipments_created = []
    
    for alloc in allocations:
        # Skip zero-quantity allocations (ghost/replaced items)
        if alloc['quantity'] <= 0:
            continue

        shipment = Shipment(
            request_id=request_id,
            reservation_id=alloc.get('reservationId'),
            warehouse_id=alloc.get('warehouseId'),
            supplier_id=alloc.get('supplierId'),
            is_import=alloc.get('supplierId') is not None,
            quantity=alloc['quantity'],
            status=ShipmentStatus.CONFIRMED,
            carrier=alloc.get('carrier'),
            estimated_dispatch_date=datetime.utcnow().date() + timedelta(days=1),
            estimated_delivery_date=datetime.fromisoformat(alloc['estimatedDeliveryDate']).date() if alloc.get('estimatedDeliveryDate') else None,
            delivery_address=product_request.delivery_location,
            delivery_city=product_request.delivery_city,
            delivery_state=product_request.delivery_state,
            created_by_id=int(get_jwt_identity())
        )
        shipment.generate_tracking_number()
        db.session.add(shipment)
        shipments_created.append(shipment)
    
    product_request.status = RequestStatus.ALLOCATED
    db.session.commit()
    
    return jsonify({
        'message': 'Shipments allocated successfully',
        'shipments': [s.to_dict() for s in shipments_created]
    })


@logistics_bp.route('/shipments', methods=['GET'])
@jwt_required()
def get_shipments():
    """Get all shipments"""
    # Simply verifying token here
    
    status = request.args.get('status')
    query = Shipment.query
    
    if status:
        query = query.filter_by(status=ShipmentStatus(status))
    
    # Filter out ghost shipments (Qty 0)
    query = query.filter(Shipment.quantity > 0)
    
    shipments = query.order_by(Shipment.created_at.desc()).all()
    return jsonify([s.to_dict() for s in shipments])


@logistics_bp.route('/shipments/<int:shipment_id>', methods=['GET'])
@jwt_required()
def get_shipment(shipment_id):
    """Get a single shipment"""
    shipment = Shipment.query.get_or_404(shipment_id)
    return jsonify(shipment.to_dict())


@logistics_bp.route('/shipments/<int:shipment_id>/dispatch', methods=['POST'])
@jwt_required()
def dispatch_shipment(shipment_id):
    """Mark shipment as dispatched"""
    claims = get_jwt()
    
    if claims['role'] not in ['LOGISTICS_PLANNER', 'WAREHOUSE_OPERATOR']:
        return jsonify({'message': 'Not authorized'}), 403
    
    shipment = Shipment.query.get_or_404(shipment_id)
    data = request.get_json()
    
    shipment.status = ShipmentStatus.DISPATCHED
    shipment.actual_dispatch_date = datetime.utcnow().date()
    shipment.carrier = data.get('carrier', shipment.carrier)
    shipment.carrier_tracking_url = data.get('trackingUrl')
    
    db.session.commit()
    
    # Check if all shipments for request are dispatched
    product_request = shipment.request
    all_dispatched = all(
        s.status in [ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED]
        for s in product_request.shipments
    )
    
    if all_dispatched:
        product_request.status = RequestStatus.IN_TRANSIT
        db.session.commit()
    
    return jsonify(shipment.to_dict())


@logistics_bp.route('/shipments/<int:shipment_id>/update-status', methods=['POST'])
@jwt_required()
def update_shipment_status(shipment_id):
    """Update shipment tracking status"""
    identity = get_jwt_identity()
    
    shipment = Shipment.query.get_or_404(shipment_id)
    data = request.get_json()
    
    new_status = data.get('status')
    if not new_status:
        return jsonify({'message': 'Status is required'}), 400
    
    shipment.status = ShipmentStatus(new_status)
    
    # Update ETA if provided
    if data.get('estimatedDeliveryDate'):
        shipment.estimated_delivery_date = datetime.fromisoformat(data['estimatedDeliveryDate']).date()

    if new_status == 'DELIVERED':
        shipment.actual_delivery_date = datetime.utcnow().date()
        shipment.delivered_to = data.get('deliveredTo')

    elif new_status == 'RECEIVED': # Dealer Confirmation
        # Check if all shipments received
        product_request = shipment.request
        all_received = all(
            s.status == ShipmentStatus.RECEIVED
            for s in product_request.shipments
        )

        if all_received:
            product_request.status = RequestStatus.COMPLETED
            product_request.completed_at = datetime.utcnow()

            # Release stock reservations and reduce actual stock quantities for completed sales
            for res in product_request.reservations:
                if res.warehouse_id and not res.is_blocked:  # Only for successful reservations
                    # Find stock record - prefer records with available quantity first, then any matching record
                    stock = Stock.query.filter(
                        Stock.warehouse_id == res.warehouse_id,
                        Stock.product_id == product_request.product_id,
                        Stock.quantity > 0
                    ).order_by(Stock.quantity.desc()).first()

                    # If no stock with quantity > 0, get any matching record
                    if not stock:
                        stock = Stock.query.filter_by(
                            warehouse_id=res.warehouse_id,
                            product_id=product_request.product_id
                        ).first()

                    if stock:
                        # Release the reservation and reduce actual stock
                        stock.reserved_quantity = max(0, stock.reserved_quantity - res.quantity)
                        stock.quantity = max(0, stock.quantity - res.quantity)
                        print(f"[STOCK_REDUCTION] Reduced stock for warehouse {res.warehouse_id}, product {product_request.product_id}: reserved -{res.quantity}, quantity -{res.quantity}")
    
    db.session.commit()
    return jsonify(shipment.to_dict())


@logistics_bp.route('/track/<tracking_number>', methods=['GET'])
@jwt_required()
def track_shipment(tracking_number):
    """Track shipment by tracking number"""
    shipment = Shipment.query.filter_by(tracking_number=tracking_number).first()
    
    if not shipment:
        return jsonify({'message': 'Shipment not found'}), 404
    
    return jsonify(shipment.to_dict())
