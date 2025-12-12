from app import create_app, db
from app.models.request import ProductRequest

app = create_app()

with app.app_context():
    request = ProductRequest.query.filter_by(request_number="REQ-20251212-2L97JL").first()
    if request:
        print(f"Request: {request.request_number}")
        print(f"Estimated Delivery Date: {request.estimated_delivery_date}")
        print(f"Status: {request.status}")
    else:
        print("Request not found")
