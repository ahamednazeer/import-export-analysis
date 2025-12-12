from datetime import datetime
from app import db


class Product(db.Model):
    """Product/SKU model"""
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))
    unit = db.Column(db.String(50), default='units')  # units, kg, liters, etc.
    min_order_quantity = db.Column(db.Integer, default=1)
    
    # Pricing
    unit_price = db.Column(db.Numeric(10, 2), default=0)
    currency = db.Column(db.String(3), default='INR')
    
    # Tracking
    is_active = db.Column(db.Boolean, default=True)
    requires_inspection = db.Column(db.Boolean, default=True)
    shelf_life_days = db.Column(db.Integer, nullable=True)  # For expiry tracking
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    stocks = db.relationship('Stock', back_populates='product')
    supplier_stocks = db.relationship('SupplierStock', back_populates='product')
    requests = db.relationship('ProductRequest', back_populates='product')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'sku': self.sku,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'unit': self.unit,
            'minOrderQuantity': self.min_order_quantity,
            'unitPrice': float(self.unit_price) if self.unit_price else 0,
            'currency': self.currency,
            'isActive': self.is_active,
            'requiresInspection': self.requires_inspection,
            'shelfLifeDays': self.shelf_life_days,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }
