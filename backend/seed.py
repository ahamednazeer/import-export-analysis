"""
Seed script to populate database with demo data
"""
from app import create_app, db
from app.models.user import User, Role
from app.models.product import Product
from app.models.warehouse import Warehouse, Stock
from app.models.supplier import Supplier, SupplierStock
from datetime import date, timedelta


def seed_database():
    app = create_app()
    
    with app.app_context():
        print("Seeding database...")
        
        # Create users
        users_data = [
            {'username': 'admin', 'email': 'admin@example.com', 'password': 'admin123', 'first_name': 'System', 'last_name': 'Admin', 'role': Role.ADMIN},
            {'username': 'dealer1', 'email': 'dealer1@example.com', 'password': 'dealer123', 'first_name': 'Rajesh', 'last_name': 'Kumar', 'role': Role.DEALER},
            {'username': 'dealer2', 'email': 'dealer2@example.com', 'password': 'dealer123', 'first_name': 'Priya', 'last_name': 'Sharma', 'role': Role.DEALER},
            {'username': 'warehouse1', 'email': 'wh1@example.com', 'password': 'wh123', 'first_name': 'Chennai', 'last_name': 'Operator', 'role': Role.WAREHOUSE_OPERATOR},
            {'username': 'warehouse2', 'email': 'wh2@example.com', 'password': 'wh123', 'first_name': 'Madurai', 'last_name': 'Operator', 'role': Role.WAREHOUSE_OPERATOR},
            {'username': 'procurement1', 'email': 'procurement@example.com', 'password': 'proc123', 'first_name': 'Anil', 'last_name': 'Reddy', 'role': Role.PROCUREMENT_MANAGER},
            {'username': 'logistics1', 'email': 'logistics@example.com', 'password': 'log123', 'first_name': 'Suresh', 'last_name': 'Nair', 'role': Role.LOGISTICS_PLANNER},
        ]
        
        for user_data in users_data:
            if not User.query.filter_by(username=user_data['username']).first():
                user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name'],
                    role=user_data['role']
                )
                user.set_password(user_data['password'])
                db.session.add(user)
        
        db.session.commit()
        print(f"Created {len(users_data)} users")
        
        # Create warehouses
        warehouses_data = [
            {'code': 'CHN', 'name': 'Chennai Central Warehouse', 'city': 'Chennai', 'state': 'Tamil Nadu'},
            {'code': 'MDU', 'name': 'Madurai Distribution Center', 'city': 'Madurai', 'state': 'Tamil Nadu'},
            {'code': 'CBE', 'name': 'Coimbatore Hub', 'city': 'Coimbatore', 'state': 'Tamil Nadu'},
            {'code': 'BLR', 'name': 'Bangalore Warehouse', 'city': 'Bangalore', 'state': 'Karnataka'},
        ]
        
        for wh_data in warehouses_data:
            if not Warehouse.query.filter_by(code=wh_data['code']).first():
                warehouse = Warehouse(**wh_data)
                db.session.add(warehouse)
        
        db.session.commit()
        print(f"Created {len(warehouses_data)} warehouses")
        
        # Create suppliers
        suppliers_data = [
            {'code': 'SUP-CN', 'name': 'China Electronics Ltd', 'country': 'China', 'city': 'Shenzhen', 'lead_time_days': 14},
            {'code': 'SUP-DE', 'name': 'German Machinery GmbH', 'country': 'Germany', 'city': 'Munich', 'lead_time_days': 21},
            {'code': 'SUP-JP', 'name': 'Japan Parts Co', 'country': 'Japan', 'city': 'Tokyo', 'lead_time_days': 10},
        ]
        
        for sup_data in suppliers_data:
            if not Supplier.query.filter_by(code=sup_data['code']).first():
                supplier = Supplier(**sup_data)
                db.session.add(supplier)
        
        db.session.commit()
        print(f"Created {len(suppliers_data)} suppliers")
        
        # Create products
        products_data = [
            {'sku': 'ELEC-001', 'name': 'Industrial Motor 5HP', 'category': 'Electronics', 'unit': 'units', 'unit_price': 15000, 'shelf_life_days': 1825},
            {'sku': 'ELEC-002', 'name': 'Control Panel Module', 'category': 'Electronics', 'unit': 'units', 'unit_price': 8500, 'shelf_life_days': 1095},
            {'sku': 'MECH-001', 'name': 'Bearing Set (Heavy Duty)', 'category': 'Mechanical', 'unit': 'sets', 'unit_price': 3200, 'shelf_life_days': 730},
            {'sku': 'MECH-002', 'name': 'Hydraulic Pump Assembly', 'category': 'Mechanical', 'unit': 'units', 'unit_price': 25000, 'shelf_life_days': 1460},
            {'sku': 'CHEM-001', 'name': 'Industrial Lubricant 20L', 'category': 'Chemicals', 'unit': 'drums', 'unit_price': 4500, 'shelf_life_days': 365},
        ]
        
        for prod_data in products_data:
            if not Product.query.filter_by(sku=prod_data['sku']).first():
                product = Product(**prod_data)
                db.session.add(product)
        
        db.session.commit()
        print(f"Created {len(products_data)} products")
        
        # Create stock entries
        warehouses = Warehouse.query.all()
        products = Product.query.all()
        
        stock_count = 0
        for warehouse in warehouses:
            for product in products:
                if not Stock.query.filter_by(warehouse_id=warehouse.id, product_id=product.id).first():
                    import random
                    qty = random.randint(20, 100)
                    stock = Stock(
                        warehouse_id=warehouse.id,
                        product_id=product.id,
                        quantity=qty,
                        batch_number=f"BATCH-{warehouse.code}-{product.sku}",
                        expiry_date=date.today() + timedelta(days=product.shelf_life_days or 365),
                        location_code=f"{chr(65 + random.randint(0, 5))}-{random.randint(1, 20)}-{random.randint(1, 5)}"
                    )
                    db.session.add(stock)
                    stock_count += 1
        
        db.session.commit()
        print(f"Created {stock_count} stock entries")
        
        # Create supplier stocks
        suppliers = Supplier.query.all()
        supplier_stock_count = 0
        for supplier in suppliers:
            for product in products:
                if not SupplierStock.query.filter_by(supplier_id=supplier.id, product_id=product.id).first():
                    import random
                    stock = SupplierStock(
                        supplier_id=supplier.id,
                        product_id=product.id,
                        available_quantity=random.randint(500, 2000),
                        min_order_quantity=10,
                        unit_price=float(product.unit_price) * 0.85,  # 15% cheaper from supplier
                        currency='USD'
                    )
                    db.session.add(stock)
                    supplier_stock_count += 1
        
        db.session.commit()
        print(f"Created {supplier_stock_count} supplier stock entries")
        
        print("Database seeding complete!")


if __name__ == '__main__':
    seed_database()
