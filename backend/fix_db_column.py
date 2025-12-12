from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    with db.engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE shipments ALTER COLUMN carrier_tracking_url TYPE text;"))
            conn.commit()
            print("Successfully updated column type to TEXT")
        except Exception as e:
            print(f"Error updating column: {e}")
