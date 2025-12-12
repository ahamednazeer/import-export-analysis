import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from datetime import datetime
from app import db
from app.models.inspection import InspectionImage, InspectionResult
from app.models.request import ProductRequest, Reservation, RequestStatus
from app.services.groq_ai import GroqAIService

inspection_bp = Blueprint('inspection', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@inspection_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_image():
    """Upload inspection image"""
    claims = get_jwt()
    
    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can upload images'}), 403
    
    if 'file' not in request.files:
        return jsonify({'message': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'message': 'Invalid file type. Allowed: png, jpg, jpeg, webp'}), 400
    
    request_id = request.form.get('requestId')
    reservation_id = request.form.get('reservationId')
    image_type = request.form.get('imageType', 'package')
    
    if not request_id:
        return jsonify({'message': 'requestId is required'}), 400
    
    product_request = ProductRequest.query.get(request_id)
    if not product_request:
        return jsonify({'message': 'Request not found'}), 404
    
    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    
    # Save file
    file.save(file_path)
    file_size = os.path.getsize(file_path)
    
    # Create inspection record
    inspection = InspectionImage(
        request_id=request_id,
        reservation_id=reservation_id,
        uploaded_by_id=int(get_jwt_identity()),
        filename=filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        image_type=image_type,
        result=InspectionResult.PROCESSING
    )
    
    db.session.add(inspection)
    
    # Update request status
    if product_request.status == RequestStatus.PICKING:
        product_request.status = RequestStatus.INSPECTION_PENDING
    
    db.session.commit()
    
    # Run AI analysis asynchronously (for now, sync)
    try:
        groq_service = GroqAIService()
        ai_result = groq_service.analyze_image(file_path, image_type)
        
        inspection.result = InspectionResult(ai_result['result'])
        inspection.confidence_score = ai_result['confidence']
        inspection.damage_detected = ai_result.get('damage_detected', False)
        inspection.damage_type = ai_result.get('damage_type')
        inspection.damage_severity = ai_result.get('damage_severity')
        inspection.expiry_detected = ai_result.get('expiry_detected', False)
        inspection.is_expired = ai_result.get('is_expired', False)
        inspection.seal_intact = ai_result.get('seal_intact')
        inspection.spoilage_detected = ai_result.get('spoilage_detected', False)
        inspection.ai_raw_response = ai_result.get('raw_response', '')
        inspection.processed_at = datetime.utcnow()
        
        if ai_result.get('detected_expiry_date'):
            inspection.detected_expiry_date = datetime.fromisoformat(ai_result['detected_expiry_date']).date()
        
        # Update reservation if blocked (when there's a specific reservation)
        if reservation_id and ai_result['result'] in ['DAMAGED', 'EXPIRED']:
            reservation = Reservation.query.get(reservation_id)
            if reservation:
                reservation.is_blocked = True
                reservation.block_reason = ai_result['result']
        
        # Update request status based on inspection result
        if ai_result['result'] in ['DAMAGED', 'EXPIRED', 'LOW_CONFIDENCE']:
            # Mark as partially blocked - needs procurement manager review
            product_request.status = RequestStatus.PARTIALLY_BLOCKED
            print(f"[INSPECTION] Request {product_request.id} marked as PARTIALLY_BLOCKED due to {ai_result['result']}")
        elif ai_result['result'] == 'OK':
            # Check if all inspections for this request are OK
            all_inspections = InspectionImage.query.filter_by(request_id=request_id).all()
            all_ok = all(img.result == InspectionResult.OK or img.result == InspectionResult.PROCESSING for img in all_inspections)
            if all_ok and product_request.status == RequestStatus.INSPECTION_PENDING:
                # All inspections passed - ready for allocation
                product_request.status = RequestStatus.READY_FOR_ALLOCATION
                print(f"[INSPECTION] Request {product_request.id} marked as READY_FOR_ALLOCATION - all inspections OK")
        
        db.session.commit()
        
    except Exception as e:
        inspection.result = InspectionResult.ERROR
        inspection.ai_raw_response = str(e)
        db.session.commit()
    
    return jsonify(inspection.to_dict()), 201


@inspection_bp.route('/<int:image_id>/result', methods=['GET'])
@jwt_required()
def get_result(image_id):
    """Get inspection result for an image"""
    inspection = InspectionImage.query.get_or_404(image_id)
    return jsonify(inspection.to_dict())


@inspection_bp.route('/request/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request_images(request_id):
    """Get all inspection images for a request"""
    images = InspectionImage.query.filter_by(request_id=request_id).all()
    return jsonify([i.to_dict() for i in images])


@inspection_bp.route('/<int:image_id>/override', methods=['POST'])
@jwt_required()
def override_result(image_id):
    """Override AI inspection result (Procurement Manager only)"""
    claims = get_jwt()
    
    if claims['role'] != 'PROCUREMENT_MANAGER':
        return jsonify({'message': 'Only procurement managers can override results'}), 403
    
    inspection = InspectionImage.query.get_or_404(image_id)
    data = request.get_json()
    
    new_result = data.get('result')
    reason = data.get('reason')
    
    if not new_result or not reason:
        return jsonify({'message': 'Result and reason are required'}), 400
    
    inspection.overridden = True
    inspection.override_result = InspectionResult(new_result)
    inspection.override_reason = reason
    inspection.overridden_by_id = int(get_jwt_identity())
    inspection.overridden_at = datetime.utcnow()
    
    # Unblock reservation if override is OK
    if new_result == 'OK' and inspection.reservation_id:
        reservation = Reservation.query.get(inspection.reservation_id)
        if reservation:
            reservation.is_blocked = False
            reservation.block_reason = None
    
    db.session.commit()
    return jsonify(inspection.to_dict())
