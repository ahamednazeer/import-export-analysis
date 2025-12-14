
from app import create_app, db
from app.models.warehouse import Warehouse, Stock
from app.models.product import Product
from app.models.request import ProductRequest, Reservation

app = create_app()

with app.app_context():
    print("Checking Warehouses:")
    warehouses = Warehouse.query.all()
    for w in warehouses:
        print(f"ID: {w.id}, Name: {w.name}, City: {w.city}")
        
    print("\nChecking Stocks:")
    stocks = Stock.query.all()
    for s in stocks:
        print(f"Warehouse: {s.warehouse.name if s.warehouse else 'None'}, Product: {s.product_id}, Qty: {s.quantity}, Reserved: {s.reserved_quantity}, Available: {s.quantity - s.reserved_quantity}")

    print("\nChecking Reservations for recent requests:")
    requests = ProductRequest.query.order_by(ProductRequest.id.desc()).limit(5).all()
    for r in requests:
        print(f"Request #{r.request_number} (ID: {r.id}), Status: {r.status}")
        for res in r.reservations:
            print(f"  - Res ID: {res.id}, Wh: {res.warehouse.name if res.warehouse else 'None'}, Qty: {res.quantity}")
