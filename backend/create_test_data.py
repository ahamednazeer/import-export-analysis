#!/usr/bin/env python3

from app import create_app, db
from app.models.user import User
from app.models.product import Product
from app.models.request import ProductRequest, Reservation, RequestStatus

def create_test_requests():
    app = create_app()
    with app.app_context():
        # Get existing users and products
        dealer = User.query.filter_by(role='DEALER').first()
        product = Product.query.first()
        warehouse = User.query.filter_by(role='WAREHOUSE_OPERATOR').first()

        if not dealer or not product or not warehouse:
            print("Missing required data. Run seed.py first.")
            return

        # Create a request with RESOLVED_PARTIAL status (warehouse can send to logistics)
        request1 = ProductRequest(
            request_number="TEST-001",
            dealer_id=dealer.id,
            product_id=product.id,
            quantity=10,
            delivery_location="Test Location",
            delivery_city="Test City",
            delivery_state="Test State",
            status=RequestStatus.RESOLVED_PARTIAL,
            procurement_notes="Test request - resolved partial issues"
        )
        db.session.add(request1)

        # Create a request with READY_FOR_ALLOCATION status (already sent to logistics)
        request2 = ProductRequest(
            request_number="TEST-002",
            dealer_id=dealer.id,
            product_id=product.id,
            quantity=5,
            delivery_location="Test Location 2",
            delivery_city="Test City 2",
            delivery_state="Test State 2",
            status=RequestStatus.READY_FOR_ALLOCATION,
            procurement_notes="Test request - ready for allocation"
        )
        db.session.add(request2)

        # Create a request with PARTIALLY_BLOCKED status (waiting for procurement)
        request3 = ProductRequest(
            request_number="TEST-003",
            dealer_id=dealer.id,
            product_id=product.id,
            quantity=8,
            delivery_location="Test Location 3",
            delivery_city="Test City 3",
            delivery_state="Test State 3",
            status=RequestStatus.PARTIALLY_BLOCKED,
            procurement_notes="Test request - partially blocked"
        )
        db.session.add(request3)

        db.session.commit()
        print("Created test requests:")
        print("- TEST-001: RESOLVED_PARTIAL (should show 'Send to Logistics' button)")
        print("- TEST-002: READY_FOR_ALLOCATION (should show 'Sent to Logistics' text)")
        print("- TEST-003: PARTIALLY_BLOCKED (should show 'Waiting for procurement' text)")

if __name__ == "__main__":
    create_test_requests()
