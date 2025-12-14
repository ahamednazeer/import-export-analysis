from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    with db.engine.connect() as conn:
        try:
            # Add the missing local_delivery_days column to warehouses table
            conn.execute(text("ALTER TABLE warehouses ADD COLUMN local_delivery_days INTEGER DEFAULT 1;"))
            conn.commit()
            print("Successfully added local_delivery_days column to warehouses table")
        except Exception as e:
            print(f"Error adding column: {e}")
