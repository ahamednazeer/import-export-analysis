
from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        pass
        with db.engine.connect() as connection:
            # Add WAITING_FOR_ALL_PICKUPS
            connection.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'WAITING_FOR_ALL_PICKUPS'"))
            print("Successfully added 'WAITING_FOR_ALL_PICKUPS' to requeststatus enum")
            
            # Add READY_FOR_ALLOCATION
            connection.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'READY_FOR_ALLOCATION'"))
            print("Successfully added 'READY_FOR_ALLOCATION' to requeststatus enum")
            
            connection.commit()
    except Exception as e:
        print(f"Error: {e}")
