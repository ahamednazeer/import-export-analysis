import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from datetime import datetime
from app import db
from app.models.inspection import InspectionImage, InspectionResult
from app.models.request import ProductRequest, Reservation, RequestStatus, ReservationStatus
from app.models.user import User
from app.services.groq_ai import GroqAIService
from app.services.source_completion import SourceCompletionService

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

    # Verify that this warehouse has reservations for this request
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.assigned_warehouse_id:
        return jsonify({'message': 'User not assigned to a warehouse'}), 400

    # Check if this warehouse has any reservations for this request
    warehouse_has_reservations = Reservation.query.filter_by(
        request_id=request_id,
        warehouse_id=user.assigned_warehouse_id
    ).count() > 0

    if not warehouse_has_reservations:
        return jsonify({'message': 'Unauthorized: your warehouse has no reservations for this request'}), 403

    # If no reservation_id provided, auto-assign to this warehouse's reservation
    if not reservation_id:
        warehouse_reservation = Reservation.query.filter_by(
            request_id=request_id,
            warehouse_id=user.assigned_warehouse_id,
            is_local=True
        ).first()
        if warehouse_reservation:
            reservation_id = warehouse_reservation.id
        # If no reservation found, we'll still create the image but it won't count toward completion

    if reservation_id:
        reservation = Reservation.query.get(reservation_id)
        if reservation and reservation.warehouse_id != user.assigned_warehouse_id:
            return jsonify({'message': 'Unauthorized: reservation does not belong to your warehouse'}), 403

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

    user_warehouse_id = user.assigned_warehouse_id
    
    warehouse_reservations = [r for r in product_request.reservations if r.warehouse_id == user_warehouse_id]
    warehouse_all_picked = all(r.is_picked for r in warehouse_reservations) if warehouse_reservations else False
    
    if warehouse_all_picked and product_request.status == RequestStatus.PICKING:
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
                reservation.reservation_status = ReservationStatus.AI_DAMAGED
        
        # Initialize source completion service for Joint Wait model
        source_completion = SourceCompletionService()
        
        if ai_result['result'] in ['DAMAGED', 'EXPIRED']:
            all_reservations = Reservation.query.filter_by(request_id=request_id).all()
            
            warehouses_in_request = set(r.warehouse_id for r in all_reservations if r.warehouse_id)
            
            warehouses_all_inspected = set()
            for warehouse_id in warehouses_in_request:
                warehouse_reservations = [r for r in all_reservations if r.warehouse_id == warehouse_id]
                
                warehouse_inspected_count = InspectionImage.query.filter(
                    InspectionImage.request_id == request_id,
                    InspectionImage.reservation_id.in_([r.id for r in warehouse_reservations]),
                    InspectionImage.result.in_([
                        InspectionResult.OK,
                        InspectionResult.DAMAGED,
                        InspectionResult.EXPIRED
                    ])
                ).count()
                
                if warehouse_inspected_count == len(warehouse_reservations):
                    warehouses_all_inspected.add(warehouse_id)
            
            all_blocked = Reservation.query.filter_by(
                request_id=request_id,
                is_blocked=True
            ).count()

            total_reservations = Reservation.query.filter_by(request_id=request_id).count()

            if all_blocked == total_reservations and total_reservations > 0:
                product_request.status = RequestStatus.BLOCKED
                print(f"[INSPECTION] Request {product_request.id} marked as BLOCKED - all reservations damaged")
            else:
                # JOINT WAIT: Set to PARTIALLY_BLOCKED, let procurement handle
                # Procurement will use SourceCompletionService after resolution
                product_request.status = RequestStatus.PARTIALLY_BLOCKED
                print(f"[INSPECTION] Request {product_request.id} marked as PARTIALLY_BLOCKED - {all_blocked}/{total_reservations} reservations blocked")

        elif ai_result['result'] == 'LOW_CONFIDENCE':
            # LOW_CONFIDENCE requires procurement review
            # Update reservation status to indicate low confidence
            if reservation_id:
                reservation = Reservation.query.get(reservation_id)
                if reservation:
                    reservation.reservation_status = ReservationStatus.AI_LOW_CONFIDENCE
            
            product_request.status = RequestStatus.PARTIALLY_BLOCKED
            print(f"[INSPECTION] Request {product_request.id} has LOW_CONFIDENCE result - flagged for procurement review")

        elif ai_result['result'] == 'OK':
            # JOINT WAIT MODEL: Mark this reservation as AI-confirmed
            # Then trigger completion check to see if ALL sources are ready
            
            # Mark this reservation as picked and AI-confirmed
            if reservation_id:
                reservation = Reservation.query.get(reservation_id)
                if reservation:
                    # Auto-mark as picked when AI confirms (uploading = already picked)
                    if not reservation.is_picked:
                        reservation.is_picked = True
                        reservation.picked_at = datetime.utcnow()
                        print(f"[INSPECTION] Reservation {reservation_id} auto-marked as picked")
                    
                    reservation.ai_confirmed = True
                    reservation.ai_confirmation_date = datetime.utcnow()
                    reservation.reservation_status = ReservationStatus.AI_CONFIRMED
                    print(f"[INSPECTION] Reservation {reservation_id} marked as AI_CONFIRMED")
            
            # Check if this action completed picking for the warehouse (re-check for auto-pick scenarios)
            # Fetch fresh list or trust identity map
            warehouse_reservations = [r for r in product_request.reservations if r.warehouse_id == user_warehouse_id]
            warehouse_all_picked = all(r.is_picked for r in warehouse_reservations) if warehouse_reservations else False
            
            if warehouse_all_picked and product_request.status == RequestStatus.PICKING:
                product_request.status = RequestStatus.INSPECTION_PENDING
                print(f"[INSPECTION] Request {request_id} picking complete for warehouse - set to INSPECTION_PENDING")
            
            # Commit current changes first
            db.session.commit()
            
            # JOINT WAIT: Use SourceCompletionService to check if ALL sources are ready
            # This will transition to READY_FOR_ALLOCATION only when all sources complete
            all_ready = source_completion.check_all_sources_ready(int(request_id))
            
            if all_ready:
                print(f"[INSPECTION] Request {request_id} ALL SOURCES READY - transitioned to READY_FOR_ALLOCATION")
            else:
                # Some sources still pending - update status to waiting
                if product_request.status == RequestStatus.INSPECTION_PENDING:
                    product_request.status = RequestStatus.WAITING_FOR_ALL_PICKUPS
                    db.session.commit()
                print(f"[INSPECTION] Request {request_id} waiting for other sources to complete")
        
        db.session.commit()
        
    except Exception as e:
        print(f"[UPLOAD_ERROR] {str(e)}")
        db.session.rollback()
        
        # Try to record the error on the inspection object if it exists
        try:
            # We need to fetch it again because rollback detached it
            if 'inspection' in locals() and inspection.id:
                insp = InspectionImage.query.get(inspection.id)
                if insp:
                    insp.result = InspectionResult.ERROR
                    insp.ai_raw_response = str(e)
                    db.session.commit()
        except Exception as inner_e:
            print(f"[UPLOAD_ERROR_RECOVERY_FAILED] {str(inner_e)}")

        return jsonify({'message': f'Processing error: {str(e)}'}), 500
    
    # Refresh inspection object to ensure it's bound to session
    db.session.refresh(inspection)
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


@inspection_bp.route('/warehouse/tasks', methods=['GET'])
@jwt_required()
def get_warehouse_inspection_tasks():
    """Get inspection tasks for the current warehouse operator's warehouse"""
    claims = get_jwt()

    if claims['role'] != 'WAREHOUSE_OPERATOR':
        return jsonify({'message': 'Only warehouse operators can access this endpoint'}), 403

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.assigned_warehouse_id:
        return jsonify({'message': 'User not assigned to a warehouse'}), 400

    # Get reservations for this warehouse that need inspection (picked but not fully inspected)
    from app.models.request import Reservation, ProductRequest, RequestStatus

    reservations = Reservation.query.filter_by(
        warehouse_id=user.assigned_warehouse_id,
        is_local=True
    ).filter(
        Reservation.id.in_(
            # Reservations that have been picked
            db.session.query(Reservation.id).filter_by(
                warehouse_id=user.assigned_warehouse_id,
                is_local=True,
                is_picked=True
            )
        )
    ).outerjoin(
        InspectionImage, InspectionImage.reservation_id == Reservation.id
    ).filter(
        # Reservations where inspection hasn't started or isn't complete
        ~db.session.query(InspectionImage.id).filter(
            InspectionImage.reservation_id == Reservation.id,
            InspectionImage.result.in_([
                InspectionResult.OK, 
                InspectionResult.DAMAGED, 
                InspectionResult.EXPIRED
            ])
        ).correlate(Reservation).exists()
    ).all()

    # Group by request for better UI presentation
    tasks_by_request = {}
    for reservation in reservations:
        request_id = reservation.request_id
        if request_id not in tasks_by_request:
            tasks_by_request[request_id] = {
                'request': reservation.request.to_dict(include_relations=False),
                'reservations': []
            }
        tasks_by_request[request_id]['reservations'].append(reservation.to_dict(include_request=False))

    return jsonify(list(tasks_by_request.values()))


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
