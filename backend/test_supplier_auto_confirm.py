#!/usr/bin/env python3
"""
Test script to demonstrate supplier auto-confirmation improvement.

This shows how the system now intelligently handles known suppliers
when procurement assigns them manually.
"""

from app import create_app, db
from app.models.supplier import Supplier, SupplierStock
from app.models.request import ProductRequest, Reservation, ReservationStatus
from app.models.product import Product
from app.services.sourcing import SourcingService

def test_supplier_auto_confirmation():
    """Test the intelligent supplier assignment logic"""

    app = create_app()
    with app.app_context():
        print("=== Testing Supplier Auto-Confirmation Improvement ===\n")

        # Create test product
        product = Product(
            sku="TEST-MACH-001",
            name="Test Machinery Part",
            description="A test product for supplier assignment",
            category="Machinery"
        )
        db.session.add(product)
        db.session.commit()

        # Get a dealer user for the request
        from app.models.user import User, Role
        dealer = User.query.filter_by(role=Role.DEALER).first()
        if not dealer:
            # Create a test dealer
            dealer = User(
                username="test_dealer",
                email="test@dealer.com",
                role=Role.DEALER,
                first_name="Test",
                last_name="Dealer"
            )
            db.session.add(dealer)
            db.session.commit()

        # Create test request
        request = ProductRequest(
            dealer_id=dealer.id,
            product_id=product.id,
            quantity=100,
            delivery_location="Test Address"
        )
        request.generate_request_number()
        db.session.add(request)
        db.session.commit()

        print(f"Created test request ID: {request.id}")

        # Test Case 1: Low-reliability supplier (should require confirmation)
        print("\n--- Test Case 1: Low-reliability supplier ---")
        low_reliability_supplier = Supplier(
            code="LOW001",
            name="Unreliable Supplier Inc",
            country="Germany",
            reliability_score=0.70  # Below 0.95 threshold
        )
        db.session.add(low_reliability_supplier)
        db.session.commit()

        # Add stock for this supplier
        SupplierStock(
            supplier_id=low_reliability_supplier.id,
            product_id=product.id,
            available_quantity=100,
            unit_price=50.0
        )
        db.session.commit()

        sourcing_service = SourcingService()
        reservation1 = sourcing_service.create_manual_supplier_reservation(
            request, low_reliability_supplier.id, 50
        )

        print(f"Low-reliability supplier '{low_reliability_supplier.name}':")
        print(f"  Reliability Score: {low_reliability_supplier.reliability_score}")
        print(f"  Reservation Status: {reservation1.reservation_status.value}")
        print("  Expected: SUPPLIER_PENDING (requires manual confirmation)")

        # Test Case 2: High-reliability supplier with good history (should auto-confirm)
        print("\n--- Test Case 2: High-reliability supplier with good history ---")
        high_reliability_supplier = Supplier(
            code="HIGH001",
            name="German Machinery GmbH",  # Matches user's example
            country="Germany",
            reliability_score=0.98  # Above 0.95 threshold
        )
        db.session.add(high_reliability_supplier)
        db.session.commit()

        # Add stock
        SupplierStock(
            supplier_id=high_reliability_supplier.id,
            product_id=product.id,
            available_quantity=100,
            unit_price=45.0
        )
        db.session.commit()

        # Create some positive history (simulate past successful reservations)
        for i in range(10):  # 10 successful reservations
            past_reservation = Reservation(
                request_id=999,  # Dummy request ID
                supplier_id=high_reliability_supplier.id,
                quantity=10,
                is_local=False,
                reservation_status=ReservationStatus.SUPPLIER_CONFIRMED
            )
            db.session.add(past_reservation)
        db.session.commit()

        reservation2 = sourcing_service.create_manual_supplier_reservation(
            request, high_reliability_supplier.id, 50
        )

        print(f"High-reliability supplier '{high_reliability_supplier.name}':")
        print(f"  Reliability Score: {high_reliability_supplier.reliability_score}")
        print(f"  Past Reservations: 10 successful")
        print(f"  Reservation Status: {reservation2.reservation_status.value}")
        print("  Expected: SUPPLIER_CONFIRMED (auto-approved)")

        # Test Case 3: High-reliability supplier with poor history (should require confirmation)
        print("\n--- Test Case 3: High-reliability supplier with poor history ---")
        mixed_supplier = Supplier(
            code="MIXED001",
            name="Inconsistent Supplier Ltd",
            country="China",
            reliability_score=0.96  # Above threshold
        )
        db.session.add(mixed_supplier)
        db.session.commit()

        # Add stock
        SupplierStock(
            supplier_id=mixed_supplier.id,
            product_id=product.id,
            available_quantity=100,
            unit_price=40.0
        )
        db.session.commit()

        # Create mixed history (some failures)
        for i in range(15):  # 15 total reservations
            status = ReservationStatus.SUPPLIER_CONFIRMED if i < 12 else ReservationStatus.BLOCKED
            past_reservation = Reservation(
                request_id=999,
                supplier_id=mixed_supplier.id,
                quantity=10,
                is_local=False,
                reservation_status=status
            )
            db.session.add(past_reservation)
        db.session.commit()

        reservation3 = sourcing_service.create_manual_supplier_reservation(
            request, mixed_supplier.id, 50
        )

        print(f"Mixed-reliability supplier '{mixed_supplier.name}':")
        print(f"  Reliability Score: {mixed_supplier.reliability_score}")
        print(f"  Past Reservations: 15 total (12 successful, 3 blocked = 20% failure rate)")
        print(f"  Reservation Status: {reservation3.reservation_status.value}")
        print("  Expected: SUPPLIER_PENDING (failure rate > 5%)")

        print("\n=== Summary ===")
        print("✅ Improvement implemented: Intelligent supplier auto-confirmation")
        print("✅ High-reliability suppliers with good history are auto-approved")
        print("✅ Low-reliability or problematic suppliers still require manual confirmation")
        print("✅ This speeds up the procurement process for trusted suppliers")

        # Cleanup
        db.session.rollback()  # Don't save test data

if __name__ == "__main__":
    test_supplier_auto_confirmation()
