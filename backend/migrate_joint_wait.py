#!/usr/bin/env python3
"""
Database migration script for Joint Wait Model (PostgreSQL compatible)

This script adds the new columns to the reservations table for the Joint Wait model:
- reservation_status: Per-reservation status tracking
- ai_confirmed: Boolean flag for AI confirmation
- ai_confirmation_date: Timestamp for AI confirmation
- procurement_resolved: Boolean flag for procurement resolution
- procurement_resolved_at: Timestamp for procurement resolution
- procurement_resolution_notes: Notes from procurement resolution

Run this script to update your database schema:
    python3 migrate_joint_wait.py
"""

from app import create_app, db
from sqlalchemy import text, inspect


def migrate():
    """Add new columns to reservations table for Joint Wait model"""
    app = create_app()
    
    with app.app_context():
        print("Starting Joint Wait Model migration...")
        
        # Get database inspector to check existing columns
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('reservations')]
        
        print(f"Existing columns: {existing_columns}")
        
        # List of columns to add with their PostgreSQL definitions
        columns_to_add = [
            ("reservation_status", "VARCHAR(50) DEFAULT 'PENDING'"),
            ("ai_confirmed", "BOOLEAN DEFAULT FALSE"),
            ("ai_confirmation_date", "TIMESTAMP"),
            ("procurement_resolved", "BOOLEAN DEFAULT FALSE"),
            ("procurement_resolved_at", "TIMESTAMP"),
            ("procurement_resolution_notes", "TEXT"),
        ]
        
        for column_name, column_def in columns_to_add:
            try:
                if column_name not in existing_columns:
                    print(f"  Adding column: {column_name}")
                    db.session.execute(text(f"""
                        ALTER TABLE reservations ADD COLUMN {column_name} {column_def}
                    """))
                    db.session.commit()
                    print(f"  ✓ Added {column_name}")
                else:
                    print(f"  ○ Column {column_name} already exists, skipping")
                    
            except Exception as e:
                print(f"  ✗ Error adding {column_name}: {e}")
                db.session.rollback()
        
        # Update existing reservations to set initial status based on current state
        print("\nUpdating existing reservations...")
        try:
            # Set picked reservations to PICKED status (PostgreSQL uses TRUE/FALSE)
            db.session.execute(text("""
                UPDATE reservations 
                SET reservation_status = 'PICKED' 
                WHERE is_picked = TRUE AND (reservation_status IS NULL OR reservation_status = 'PENDING')
            """))
            
            # Set blocked reservations to BLOCKED status
            db.session.execute(text("""
                UPDATE reservations 
                SET reservation_status = 'BLOCKED' 
                WHERE is_blocked = TRUE
            """))
            
            db.session.commit()
            print("  ✓ Updated existing reservations")
            
        except Exception as e:
            print(f"  ✗ Error updating reservations: {e}")
            db.session.rollback()
        
        print("\n✓ Migration complete!")


if __name__ == "__main__":
    migrate()
