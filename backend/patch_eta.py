from datetime import datetime, timedelta
from app import create_app, db
from app.models.request import ProductRequest
from app.services.sourcing import SourcingService

app = create_app()

with app.app_context():
    request = ProductRequest.query.filter_by(request_number="REQ-20251212-2L97JL").first()
    if request:
        print(f"Found request: {request.request_number}")
        
        # Re-run recommendation to get ETA (or just calculate from existing if stored)
        # Since we don't store allocation plan in DB raw, we might need to regenerate it
        service = SourcingService()
        rec = service.get_recommendation(request)
        
        max_days = 0
        if rec['allocationPlan']:
            max_days = max(a['estimatedDays'] for a in rec['allocationPlan'])
            print(f"Calculated max days: {max_days}")
            
            new_date = datetime.utcnow().date() + timedelta(days=max_days)
            request.estimated_delivery_date = new_date
            db.session.commit()
            print(f"Updated estimated delivery date to: {new_date}")
        else:
            print("No allocation plan found, cannot calculate ETA")
    else:
        print("Request not found")
