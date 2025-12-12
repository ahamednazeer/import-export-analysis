from datetime import datetime
from app import db


class Warehouse(db.Model):
    """Warehouse location model"""
    __tablename__ = 'warehouses'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100))
    country = db.Column(db.String(100), default='India')
    address = db.Column(db.Text)
    
    # Contact
    contact_person = db.Column(db.String(100))
    contact_phone = db.Column(db.String(20))
    contact_email = db.Column(db.String(255))
    
    # Capacity
    total_capacity = db.Column(db.Integer, default=10000)
    current_utilization = db.Column(db.Integer, default=0)
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    stocks = db.relationship('Stock', back_populates='warehouse')
    operators = db.relationship('User', back_populates='assigned_warehouse')
    reservations = db.relationship('Reservation', back_populates='warehouse')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'city': self.city,
            'state': self.state,
            'country': self.country,
            'address': self.address,
            'contactPerson': self.contact_person,
            'contactPhone': self.contact_phone,
            'contactEmail': self.contact_email,
            'totalCapacity': self.total_capacity,
            'currentUtilization': self.current_utilization,
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class Stock(db.Model):
    """Stock levels at each warehouse"""
    __tablename__ = 'stocks'
    
    id = db.Column(db.Integer, primary_key=True)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    
    quantity = db.Column(db.Integer, default=0)
    reserved_quantity = db.Column(db.Integer, default=0)  # Reserved but not yet picked
    
    # Batch tracking
    batch_number = db.Column(db.String(100))
    manufacturing_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    
    # Location within warehouse
    location_code = db.Column(db.String(50))  # e.g., "A-12-3"
    
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    warehouse = db.relationship('Warehouse', back_populates='stocks')
    product = db.relationship('Product', back_populates='stocks')
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('warehouse_id', 'product_id', 'batch_number', name='uq_warehouse_product_batch'),
    )
    
    @property
    def available_quantity(self):
        """Get quantity available for reservation"""
        return max(0, self.quantity - self.reserved_quantity)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'warehouseId': self.warehouse_id,
            'productId': self.product_id,
            'quantity': self.quantity,
            'reservedQuantity': self.reserved_quantity,
            'availableQuantity': self.available_quantity,
            'batchNumber': self.batch_number,
            'manufacturingDate': self.manufacturing_date.isoformat() if self.manufacturing_date else None,
            'expiryDate': self.expiry_date.isoformat() if self.expiry_date else None,
            'locationCode': self.location_code,
            'lastUpdated': self.last_updated.isoformat() if self.last_updated else None,
            'warehouse': self.warehouse.to_dict() if self.warehouse else None,
            'product': self.product.to_dict() if self.product else None
        }
