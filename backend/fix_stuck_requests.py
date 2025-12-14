#!/usr/bin/env python3
"""
Fix script for requests stuck in PICKING status with completed AI inspection.

This script finds reservations where AI is confirmed but is_picked is False,
and updates them to allow proper status transition.

Run with: python3 fix_stuck_requests.py
"""

from app import create_app, db
from app.models.request import ProductRequest, Reservation, RequestStatus, ReservationStatus
from app.models.inspection import InspectionImage, InspectionResult
from app.services.source_completion import SourceCompletionService
from datetime import datetime


def fix_stuck_requests():
    app = create_app()
    
    with app.app_context():
        print("Looking for stuck requests...")
        
        # Find requests in PICKING status
        picking_requests = ProductRequest.query.filter(
            ProductRequest.status.in_([RequestStatus.PICKING, RequestStatus.INSPECTION_PENDING])
        ).all()
        
        print(f"Found {len(picking_requests)} requests in PICKING/INSPECTION_PENDING status")
        
        fixed_count = 0
        
        for request in picking_requests:
            print(f"\nProcessing request {request.request_number}...")
            
            for reservation in request.reservations:
                # Check if this reservation has AI OK inspection
                ok_image = InspectionImage.query.filter_by(
                    reservation_id=reservation.id,
                    result=InspectionResult.OK
                ).first()
                
                if ok_image:
                    updated = False
                    
                    # Fix is_picked if not set
                    if not reservation.is_picked:
                        reservation.is_picked = True
                        reservation.picked_at = datetime.utcnow()
                        print(f"  Fixed: Reservation {reservation.id} marked as picked")
                        updated = True
                    
                    # Fix ai_confirmed if not set
                    if not reservation.ai_confirmed:
                        reservation.ai_confirmed = True
                        reservation.ai_confirmation_date = ok_image.created_at
                        print(f"  Fixed: Reservation {reservation.id} marked as AI confirmed")
                        updated = True
                    
                    # Fix reservation_status if not set
                    if reservation.reservation_status not in [ReservationStatus.AI_CONFIRMED, ReservationStatus.READY]:
                        reservation.reservation_status = ReservationStatus.AI_CONFIRMED
                        print(f"  Fixed: Reservation {reservation.id} status set to AI_CONFIRMED")
                        updated = True
                    
                    if updated:
                        fixed_count += 1
            
            db.session.commit()
            
            # Now trigger completion check
            source_completion = SourceCompletionService()
            all_ready = source_completion.check_all_sources_ready(request.id)
            
            if all_ready:
                print(f"  ✓ Request {request.request_number} transitioned to READY_FOR_ALLOCATION!")
            else:
                print(f"  ○ Request {request.request_number} still waiting for other sources")
        
        print(f"\n✓ Fixed {fixed_count} reservations")


if __name__ == "__main__":
    fix_stuck_requests()
