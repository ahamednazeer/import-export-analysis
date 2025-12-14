#!/usr/bin/env python3
"""
Update request status enum to include new values
"""
import os
from app import create_app, db

def update_request_status_enum():
    """Update the request status enum to include BLOCKED and other new values"""

    app = create_app()

    with app.app_context():
        try:
            # Use SQLAlchemy 2.0 text() and connection.execute()
            from sqlalchemy import text

            with db.engine.connect() as conn:
                # Add missing enum values
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'BLOCKED';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'IMPORT_APPROVED';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'RESOLVED_PARTIAL';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'READY_FOR_ALLOCATION';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'ALLOCATED';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'IN_TRANSIT';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'COMPLETED';"))
                conn.execute(text("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'CANCELLED';"))
                conn.commit()

            print("Successfully updated request status enum")
            return True

        except Exception as e:
            print(f"Error updating request status enum: {e}")
            # If ADD VALUE IF NOT EXISTS doesn't work, try a different approach
            try:
                from sqlalchemy import text

                with db.engine.connect() as conn:
                    # Alternative: recreate the enum with all values
                    conn.execute(text("ALTER TYPE requeststatus RENAME TO requeststatus_old;"))

                    conn.execute(text("""
                        CREATE TYPE requeststatus AS ENUM (
                            'PENDING',
                            'AWAITING_RECOMMENDATION',
                            'AWAITING_PROCUREMENT_APPROVAL',
                            'RESERVED',
                            'PICKING',
                            'INSPECTION_PENDING',
                            'PARTIALLY_BLOCKED',
                            'BLOCKED',
                            'IMPORT_APPROVED',
                            'RESOLVED_PARTIAL',
                            'READY_FOR_ALLOCATION',
                            'ALLOCATED',
                            'IN_TRANSIT',
                            'COMPLETED',
                            'CANCELLED'
                        );
                    """))

                    conn.execute(text("ALTER TABLE product_requests ALTER COLUMN status TYPE requeststatus USING status::text::requeststatus;"))
                    conn.execute(text("DROP TYPE requeststatus_old;"))
                    conn.commit()

                print("Successfully recreated request status enum with all values")
                return True

            except Exception as e2:
                print(f"Error with alternative approach: {e2}")
                return False

if __name__ == '__main__':
    success = update_request_status_enum()
    if success:
        print("Migration completed successfully")
    else:
        print("Migration failed")
