
from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Add 'RECEIVED' to the enum type
        with db.engine.connect() as connection:
            connection.execute(text("ALTER TYPE shipmentstatus ADD VALUE IF NOT EXISTS 'RECEIVED'"))
            connection.commit()
            print("Successfully added 'RECEIVED' to shipmentstatus enum")
    except Exception as e:
        print(f"Error: {e}")
