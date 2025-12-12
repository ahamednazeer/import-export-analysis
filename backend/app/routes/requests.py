from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus, SourceType
from app.models.product import Product
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock
from app.services.sourcing import SourcingService

requests_bp = Blueprint('requests', __name__)


@requests_bp.route('', methods=['GET'])
@jwt_required()
def get_requests():
    """Get product requests based on user role"""
    claims = get_jwt()
    role = claims['role']
    user_id = int(get_jwt_identity())
    
    query = ProductRequest.query
    
    # Filter by role
    if role == 'DEALER':
        query = query.filter_by(dealer_id=user_id)
    elif role == 'PROCUREMENT_MANAGER':
        # Show requests needing procurement attention + resolved history
        query = query.filter(ProductRequest.status.in_([
            RequestStatus.AWAITING_PROCUREMENT_APPROVAL,
            RequestStatus.PARTIALLY_BLOCKED,
            RequestStatus.RESOLVED_PARTIAL,
            RequestStatus.READY_FOR_ALLOCATION,
            RequestStatus.ALLOCATED
        ]))
    elif role == 'LOGISTICS_PLANNER':
        # Show requests ready for allocation
        query = query.filter(ProductRequest.status.in_([
            RequestStatus.READY_FOR_ALLOCATION,
            RequestStatus.ALLOCATED,
            RequestStatus.IN_TRANSIT
        ]))
    elif role == 'WAREHOUSE_OPERATOR':
        # Show requests in picking/inspection phase + completed history
        query = query.filter(ProductRequest.status.in_([
            RequestStatus.RESERVED,
            RequestStatus.PICKING,
            RequestStatus.INSPECTION_PENDING,
            RequestStatus.PARTIALLY_BLOCKED,
            RequestStatus.RESOLVED_PARTIAL,
            RequestStatus.READY_FOR_ALLOCATION,
            RequestStatus.ALLOCATED,
            RequestStatus.IN_TRANSIT,
            RequestStatus.COMPLETED
        ]))
    
    # Apply filters
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=RequestStatus(status))
    
    requests_list = query.order_by(ProductRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in requests_list])


@requests_bp.route('/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request(request_id):
    """Get a single request by ID"""
    product_request = ProductRequest.query.get_or_404(request_id)
    return jsonify(product_request.to_dict())


@requests_bp.route('', methods=['POST'])
@jwt_required()
def create_request():
    """Create a new product request (Dealer)"""
    claims = get_jwt()
    
    if claims['role'] != 'DEALER':
        return jsonify({'message': 'Only dealers can create requests'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    required = ['productId', 'quantity', 'deliveryLocation']
    for field in required:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400
    
    # Verify product exists
    product = Product.query.get(data['productId'])
    if not product:
        return jsonify({'message': 'Product not found'}), 404
    
    # Create request
    product_request = ProductRequest(
        dealer_id=int(get_jwt_identity()),
        product_id=data['productId'],
        quantity=data['quantity'],
        delivery_location=data['deliveryLocation'],
        delivery_city=data.get('deliveryCity'),
        delivery_state=data.get('deliveryState'),
        requested_delivery_date=datetime.fromisoformat(data['requestedDeliveryDate']).date() if data.get('requestedDeliveryDate') else None,
        dealer_notes=data.get('notes'),
        status=RequestStatus.PENDING
    )
    product_request.generate_request_number()
    
    db.session.add(product_request)
    db.session.commit()
    
    # Generate sourcing recommendation
    sourcing_service = SourcingService()
    recommendation = sourcing_service.get_recommendation(product_request)
    
    product_request.recommended_source = recommendation['source_type']
    product_request.recommendation_explanation = recommendation['explanation']
    
    # Calculate estimated delivery date
    max_days = 0
    if recommendation['allocationPlan']:
        max_days = max(a['estimatedDays'] for a in recommendation['allocationPlan'])
    
    product_request.estimated_delivery_date = datetime.utcnow().date() + timedelta(days=max_days)
    product_request.status = RequestStatus.AWAITING_RECOMMENDATION
    
    db.session.commit()
    
    return jsonify({
        'request': product_request.to_dict(),
        'recommendation': recommendation
    }), 201


@requests_bp.route('/<int:request_id>/recommendation', methods=['GET'])
@jwt_required()
def get_recommendation(request_id):
    """Get sourcing recommendation for a request"""
    product_request = ProductRequest.query.get_or_404(request_id)
    
    sourcing_service = SourcingService()
    recommendation = sourcing_service.get_recommendation(product_request)
    
    return jsonify(recommendation)


@requests_bp.route('/<int:request_id>/confirm', methods=['POST'])
@jwt_required()
def confirm_request(request_id):
    """Dealer confirms sourcing recommendation"""
    claims = get_jwt()
    product_request = ProductRequest.query.get_or_404(request_id)
    
    # Verify ownership
    if claims['role'] == 'DEALER' and product_request.dealer_id != int(get_jwt_identity()):
        return jsonify({'message': 'Not authorized'}), 403
    
    data = request.get_json()
    action = data.get('action')  # 'confirm', 'send_to_procurement', 'cancel'
    
    if action == 'confirm':
        # Create reservations based on recommendation
        sourcing_service = SourcingService()
        reservations = sourcing_service.create_reservations(product_request)
        
        product_request.status = RequestStatus.RESERVED
        product_request.confirmed_at = datetime.utcnow()
        
    elif action == 'send_to_procurement':
        product_request.status = RequestStatus.AWAITING_PROCUREMENT_APPROVAL
        product_request.dealer_notes = data.get('notes', product_request.dealer_notes)
        
    elif action == 'cancel':
        product_request.status = RequestStatus.CANCELLED
        
    else:
        return jsonify({'message': 'Invalid action'}), 400
    
    db.session.commit()
    return jsonify(product_request.to_dict())


@requests_bp.route('/<int:request_id>/start-picking', methods=['POST'])
@jwt_required()
def start_picking(request_id):
    """Warehouse operator starts picking"""
    claims = get_jwt()
    
    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can start picking'}), 403
    
    product_request = ProductRequest.query.get_or_404(request_id)
    
    if product_request.status != RequestStatus.RESERVED:
        return jsonify({'message': 'Request is not in RESERVED status'}), 400
    
    product_request.status = RequestStatus.PICKING
    db.session.commit()
    
    return jsonify(product_request.to_dict())
