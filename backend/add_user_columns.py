#!/usr/bin/env python3
"""
Add new columns to users table for supplier assignment and role support
"""

from app import create_app, db
from sqlalchemy import text

def add_user_columns():
    """Add assigned_supplier_id column to users table"""
    try:
        # Add assigned_supplier_id column
        db.session.execute(text("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_supplier_id INTEGER REFERENCES suppliers(id);
        """))

        db.session.commit()
        print("Successfully added assigned_supplier_id column to users table")

    except Exception as e:
        print(f"Error adding column: {e}")
        db.session.rollback()

    finally:
        db.session.close()

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        add_user_columns()
