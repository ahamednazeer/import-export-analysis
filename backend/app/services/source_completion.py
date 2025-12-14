"""
SourceCompletionService - Core service for Joint Wait model

This service checks if ALL sources (warehouses + suppliers) for a request 
are complete before transitioning to logistics.

A source is complete when:
- Warehouse: picked + AI confirmed (OK or procurement-approved)
- Supplier: confirmed availability + ready for dispatch
"""

from datetime import datetime
from app import db
from app.models.request import ProductRequest, Reservation, RequestStatus, ReservationStatus


class SourceCompletionService:
    """
    Service for checking if all sources are ready before logistics.
    
    Key principle: Procurement resolves issues but does NOT push to logistics.
    System WAITS for ALL sources to complete before transitioning.
    """
    
    def check_all_sources_ready(self, request_id: int) -> bool:
        """
        Check if all warehouse and supplier reservations are ready.
        
        Returns True if request was transitioned to READY_FOR_ALLOCATION.
        Returns False if still waiting for some sources.
        """
        product_request = ProductRequest.query.get(request_id)
        if not product_request:
            print(f"[SOURCE_COMPLETION] Request {request_id} not found")
            return False
        
        # Only check if request is in appropriate status
        valid_statuses = [
            RequestStatus.PICKING,
            RequestStatus.INSPECTION_PENDING,
            RequestStatus.PARTIALLY_BLOCKED,
            RequestStatus.WAITING_FOR_ALL_PICKUPS,
            RequestStatus.RESOLVED_PARTIAL,
            RequestStatus.IMPORT_APPROVED
        ]
        
        if product_request.status not in valid_statuses:
            print(f"[SOURCE_COMPLETION] Request {request_id} status {product_request.status.value} not eligible for completion check")
            return False
        
        # Get all active reservations (not blocked/replaced)
        reservations = Reservation.query.filter_by(request_id=request_id).all()
        
        if not reservations:
            print(f"[SOURCE_COMPLETION] Request {request_id} has no reservations")
            return False
        
        all_ready = True
        summary = []
        
        for res in reservations:
            # Skip zero-quantity (fully replaced) reservations
            if res.quantity <= 0:
                continue

            is_ready = self._is_reservation_ready(res)
            source_type = "Warehouse" if res.warehouse_id else "Supplier"
            source_id = res.warehouse_id or res.supplier_id
            
            summary.append({
                'reservation_id': res.id,
                'source_type': source_type,
                'source_id': source_id,
                'quantity': res.quantity,
                'is_ready': is_ready,
                'status': res.reservation_status.value if res.reservation_status else 'UNKNOWN'
            })
            
            if not is_ready:
                all_ready = False
        
        # Log summary
        ready_count = sum(1 for s in summary if s['is_ready'])
        total_count = len(summary)
        print(f"[SOURCE_COMPLETION] Request {request_id}: {ready_count}/{total_count} sources ready")
        for s in summary:
            status_icon = "✓" if s['is_ready'] else "✗"
            print(f"  {status_icon} {s['source_type']} {s['source_id']}: {s['status']} (qty: {s['quantity']})")
        
        if all_ready:
            return self._transition_to_logistics(product_request)
        else:
            # Keep or set WAITING_FOR_ALL_PICKUPS status
            if product_request.status not in [RequestStatus.PICKING, RequestStatus.INSPECTION_PENDING]:
                product_request.status = RequestStatus.WAITING_FOR_ALL_PICKUPS
                db.session.commit()
                print(f"[SOURCE_COMPLETION] Request {request_id} set to WAITING_FOR_ALL_PICKUPS")
            return False
    
    def _is_reservation_ready(self, reservation: Reservation) -> bool:
        """
        Check if a single reservation/source is ready.
        
        Warehouse source is ready when:
        - is_picked = True AND
        - (ai_confirmed = True OR procurement_resolved = True) AND
        - is_blocked = False
        
        Supplier source is ready when:
        - reservation_status in [SUPPLIER_CONFIRMED, READY]
        """
        # Blocked reservations are not ready (they need replacement)
        if reservation.is_blocked:
            return False
        
        # Warehouse source
        if reservation.warehouse_id:
            # Must be picked
            if not reservation.is_picked:
                return False
            
            # Must have AI confirmation or procurement resolution
            if reservation.ai_confirmed or reservation.procurement_resolved:
                return True
            
            # Check reservation status
            if reservation.reservation_status in [
                ReservationStatus.AI_CONFIRMED,
                ReservationStatus.READY,
                ReservationStatus.PROCUREMENT_RESOLVED
            ]:
                return True
            
            return False
        
        # Supplier source
        if reservation.supplier_id:
            # Supplier must confirm availability
            if reservation.reservation_status in [
                ReservationStatus.SUPPLIER_CONFIRMED,
                ReservationStatus.READY
            ]:
                return True
            
            # Legacy check for older reservations
            if reservation.procurement_resolved:
                return True
            
            return False
        
        # Unknown source type
        return False
    
    def mark_source_ready(self, reservation_id: int, reason: str = None) -> bool:
        """
        Mark a single source as ready and trigger completion check.
        
        Args:
            reservation_id: The reservation to mark as ready
            reason: Optional reason for the status change
            
        Returns:
            True if the entire request is now ready for logistics
        """
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} not found")
            return False
        
        # Update reservation status to READY
        reservation.reservation_status = ReservationStatus.READY
        reservation.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"[SOURCE_COMPLETION] Reservation {reservation_id} marked as READY. Reason: {reason or 'Not specified'}")
        
        # Trigger completion check for the parent request
        return self.check_all_sources_ready(reservation.request_id)
    
    def mark_warehouse_ai_confirmed(self, reservation_id: int, ai_result: str) -> bool:
        """
        Mark a warehouse reservation as AI-confirmed.
        
        Args:
            reservation_id: The reservation that passed AI inspection
            ai_result: The AI result (OK)
            
        Returns:
            True if the entire request is now ready for logistics
        """
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} not found")
            return False
        
        if not reservation.warehouse_id:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} is not a warehouse source")
            return False
        
        # Update AI confirmation flags
        reservation.ai_confirmed = True
        reservation.ai_confirmation_date = datetime.utcnow()
        reservation.reservation_status = ReservationStatus.AI_CONFIRMED
        
        db.session.commit()
        
        print(f"[SOURCE_COMPLETION] Warehouse reservation {reservation_id} AI confirmed: {ai_result}")
        
        # Trigger completion check
        return self.check_all_sources_ready(reservation.request_id)
    
    def mark_procurement_resolved(self, reservation_id: int, resolution_notes: str = None) -> bool:
        """
        Mark a reservation as procurement-resolved.
        
        This is called when procurement accepts/approves a LOW_CONFIDENCE or DAMAGED item.
        
        Args:
            reservation_id: The reservation that was resolved by procurement
            resolution_notes: Optional notes about the resolution
            
        Returns:
            True if the entire request is now ready for logistics
        """
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} not found")
            return False
        
        # Mark as procurement resolved
        reservation.procurement_resolved = True
        reservation.procurement_resolved_at = datetime.utcnow()
        reservation.procurement_resolution_notes = resolution_notes
        reservation.reservation_status = ReservationStatus.PROCUREMENT_RESOLVED
        reservation.is_blocked = False  # Unblock the reservation
        
        db.session.commit()
        
        print(f"[SOURCE_COMPLETION] Reservation {reservation_id} procurement resolved. Notes: {resolution_notes or 'None'}")
        
        # Trigger completion check
        return self.check_all_sources_ready(reservation.request_id)
    
    def mark_supplier_confirmed(self, reservation_id: int) -> bool:
        """
        Mark a supplier reservation as confirmed.
        
        Called when supplier confirms availability and is ready to dispatch.
        
        Returns:
            True if the entire request is now ready for logistics
        """
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} not found")
            return False
        
        if not reservation.supplier_id:
            print(f"[SOURCE_COMPLETION] Reservation {reservation_id} is not a supplier source")
            return False
        
        # Update supplier confirmation
        reservation.reservation_status = ReservationStatus.SUPPLIER_CONFIRMED
        reservation.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"[SOURCE_COMPLETION] Supplier reservation {reservation_id} confirmed")
        
        # Trigger completion check
        return self.check_all_sources_ready(reservation.request_id)
    
    def _transition_to_logistics(self, product_request: ProductRequest) -> bool:
        """
        Transition request to READY_FOR_ALLOCATION when all sources complete.
        
        This is the ONLY place where we transition to logistics stage.
        """
        print(f"[SOURCE_COMPLETION] *** ALL SOURCES READY for request {product_request.id} ***")
        print(f"[SOURCE_COMPLETION] Transitioning from {product_request.status.value} to READY_FOR_ALLOCATION")
        
        product_request.status = RequestStatus.READY_FOR_ALLOCATION
        product_request.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"[SOURCE_COMPLETION] Request {product_request.id} is now READY_FOR_ALLOCATION")
        return True
    
    def get_completion_status(self, request_id: int) -> dict:
        """
        Get detailed completion status for a request.
        
        Returns a dictionary with:
        - is_complete: bool
        - sources: list of source statuses
        - summary: human-readable summary
        """
        product_request = ProductRequest.query.get(request_id)
        if not product_request:
            return {'error': 'Request not found'}
        
        reservations = Reservation.query.filter_by(request_id=request_id).all()
        
        sources = []
        for res in reservations:
            # Skip zero-quantity (fully replaced) reservations
            if res.quantity <= 0:
                continue

            source_type = "Warehouse" if res.warehouse_id else "Supplier"
            source_name = None
            
            if res.warehouse_id and res.warehouse:
                source_name = res.warehouse.name
            elif res.supplier_id and res.supplier:
                source_name = res.supplier.name
            
            sources.append({
                'reservationId': res.id,
                'sourceType': source_type,
                'sourceId': res.warehouse_id or res.supplier_id,
                'sourceName': source_name,
                'quantity': res.quantity,
                'isReady': self._is_reservation_ready(res),
                'status': res.reservation_status.value if res.reservation_status else 'PENDING',
                'isPicked': res.is_picked,
                'aiConfirmed': res.ai_confirmed,
                'procurementResolved': res.procurement_resolved,
                'isBlocked': res.is_blocked
            })
        
        ready_count = sum(1 for s in sources if s['isReady'])
        total_count = len(sources)
        all_ready = ready_count == total_count and total_count > 0
        
        return {
            'requestId': request_id,
            'requestStatus': product_request.status.value,
            'isComplete': all_ready,
            'readyCount': ready_count,
            'totalCount': total_count,
            'sources': sources,
            'summary': f"{ready_count}/{total_count} sources ready" if not all_ready else "All sources ready for logistics"
        }
