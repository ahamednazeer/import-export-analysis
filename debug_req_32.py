from app import create_app, db
from app.models.request import ProductRequest, Reservation
from app.services.source_completion import SourceCompletionService

app = create_app()

with app.app_context():
    req = ProductRequest.query.get(32)
    print(f"Request 32 Status: {req.status.value}")
    
    reservations = Reservation.query.filter_by(request_id=32).all()
    for r in reservations:
        print(f"Res {r.id}: Warehouse {r.warehouse_id} | Qty {r.quantity} | Blocked? {r.is_blocked} | Status {r.reservation_status.value if r.reservation_status else 'None'} | AI Confirmed? {r.ai_confirmed} | Picked? {r.is_picked}")

    print("\nRunning Source Completion Check...")
    service = SourceCompletionService()
    service.check_all_sources_ready(32)
