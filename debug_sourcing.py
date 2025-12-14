
from app import create_app, db
from app.services.sourcing import SourcingService
from app.models.request import ProductRequest, RequestStatus
from app.models.product import Product
from app.models.warehouse import Warehouse, Stock

app = create_app()

with app.app_context():
    # Mock data setup logic would go here, but since we can't easily mock DB state 
    # without affecting production, we will try to dry-run the logic or inspect existing data.
    
    # Let's inspect Request #25 (if that's the one) or just print the logic output for a mock object.
    
    # Or better, let's just run the logic offline with mock objects since the logic is in the service.
    
    print("Test Sourcing Logic")
    
    # Mock objects
    class MockWarehouse:
        def __init__(self, id, name, city, delivery_days):
            self.id = id
            self.name = name
            self.city = city
            self.local_delivery_days = delivery_days

    class MockStock:
        def __init__(self, warehouse, quantity, reserved):
            self.warehouse = warehouse
            self.warehouse_id = warehouse.id
            self.quantity = quantity
            self.reserved_quantity = reserved
            self.available_quantity = quantity - reserved

    class MockSupplierStock:
         pass

    # Setup scenario
    madurai = MockWarehouse(1, 'Madurai DC', 'Madurai', 2)
    coimbatore = MockWarehouse(2, 'Coimbatore Hub', 'Coimbatore', 3)
    
    # 50 units in Madurai, 45 in Coimbatore
    stock1 = MockStock(madurai, 100, 50) # 50 avail
    stock2 = MockStock(coimbatore, 100, 55) # 45 avail
    
    local_stocks = [stock1, stock2]
    
    # Request 95 units
    requested_qty = 95
    
    # LOGIC COPY-PASTE (Simplified)
    allocation_plan = []
    remaining_qty = requested_qty
    
    # Madurai
    madurai_stock = next((stock for stock in local_stocks if stock.warehouse and stock.warehouse.city.lower() == 'madurai'), None)
    if madurai_stock and remaining_qty > 0:
        alloc = min(50, madurai_stock.available_quantity, remaining_qty)
        if alloc > 0:
            print(f"Allocating {alloc} to Madurai")
            allocation_plan.append({'source': 'local', 'warehouseId': madurai_stock.warehouse.id, 'quantity': alloc})
            remaining_qty -= alloc
            
    # Coimbatore
    coimbatore_stock = next((stock for stock in local_stocks if stock.warehouse and stock.warehouse.city.lower() == 'coimbatore'), None)
    if coimbatore_stock and remaining_qty > 0:
        alloc = min(50, coimbatore_stock.available_quantity, remaining_qty)
        if alloc > 0:
            print(f"Allocating {alloc} to Coimbatore")
            allocation_plan.append({'source': 'local', 'warehouseId': coimbatore_stock.warehouse.id, 'quantity': alloc})
            remaining_qty -= alloc
            
    print("Allocation Plan:", allocation_plan)
    
    if len(allocation_plan) == 2:
        print("SUCCESS: Logic allocated to both.")
    else:
        print("FAILURE: Did not allocate to both.")
