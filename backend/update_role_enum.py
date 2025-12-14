#!/usr/bin/env python3
"""
Update the role enum to include SUPPLIER
"""

from app import create_app, db
from sqlalchemy import text

def update_role_enum():
    """Update the role enum to include all new roles"""
    try:
        # First, add the new enum value to the existing enum
        db.session.execute(text("""
            ALTER TYPE role ADD VALUE IF NOT EXISTS 'SUPPLIER';
        """))

        db.session.commit()
        print("Successfully updated role enum to include SUPPLIER")

    except Exception as e:
        print(f"Error updating enum: {e}")
        # If that fails, try recreating the enum completely
        try:
            db.session.execute(text("""
                -- Drop existing enum and recreate with all values
                ALTER TYPE role RENAME TO role_old;

                CREATE TYPE role AS ENUM (
                    'DEALER',
                    'WAREHOUSE_OPERATOR',
                    'SUPPLIER',
                    'PROCUREMENT_MANAGER',
                    'LOGISTICS_PLANNER',
                    'ADMIN',
                    'CUSTOMER_SERVICE',
                    'ML_ENGINEER'
                );

                ALTER TABLE users ALTER COLUMN role TYPE role USING role::text::role;

                DROP TYPE role_old;
            """))

            db.session.commit()
            print("Successfully recreated role enum with all values")

        except Exception as e2:
            print(f"Error recreating enum: {e2}")
            db.session.rollback()

    finally:
        db.session.close()

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        update_role_enum()
