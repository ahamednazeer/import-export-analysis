from datetime import datetime
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import func
from app import db


class Supplier(db.Model):
    """External supplier model for imports"""
    __tablename__ = 'suppliers'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(100))
    address = db.Column(db.Text)
    
    # Contact
    contact_person = db.Column(db.String(100))
    contact_phone = db.Column(db.String(50))
    contact_email = db.Column(db.String(255))
    
    # Performance metrics
    lead_time_days = db.Column(db.Integer, default=7)  # Average delivery time
    reliability_score = db.Column(db.Numeric(3, 2), default=0.80)  # 0.00 to 1.00
    
    # Pricing
    default_currency = db.Column(db.String(3), default='USD')
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    stocks = db.relationship('SupplierStock', back_populates='supplier')
    reservations = db.relationship('Reservation', back_populates='supplier')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'country': self.country,
            'city': self.city,
            'address': self.address,
            'contactPerson': self.contact_person,
            'contactPhone': self.contact_phone,
            'contactEmail': self.contact_email,
            'leadTimeDays': self.lead_time_days,
            'reliabilityScore': float(self.reliability_score) if self.reliability_score else 0.8,
            'defaultCurrency': self.default_currency,
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class SupplierStock(db.Model):
    """Products available from suppliers"""
    __tablename__ = 'supplier_stocks'
    
    id = db.Column(db.Integer, primary_key=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    
    # Availability
    available_quantity = db.Column(db.Integer, default=0)
    min_order_quantity = db.Column(db.Integer, default=1)
    
    # Pricing
    unit_price = db.Column(db.Numeric(10, 2), default=0)
    currency = db.Column(db.String(3), default='USD')
    
    # Lead time override (if different from supplier default)
    custom_lead_time_days = db.Column(db.Integer, nullable=True)
    
    is_active = db.Column(db.Boolean, default=True)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    supplier = db.relationship('Supplier', back_populates='stocks')
    product = db.relationship('Product', back_populates='supplier_stocks')
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('supplier_id', 'product_id', name='uq_supplier_product'),
    )
    
    @hybrid_property
    def lead_time_days(self):
        """Get effective lead time"""
        return self.custom_lead_time_days or (self.supplier.lead_time_days if self.supplier else 7)

    @lead_time_days.expression
    def lead_time_days(cls):
        """SQL expression for lead_time_days"""
        return func.coalesce(cls.custom_lead_time_days, Supplier.lead_time_days, 7)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'supplierId': self.supplier_id,
            'productId': self.product_id,
            'availableQuantity': self.available_quantity,
            'minOrderQuantity': self.min_order_quantity,
            'unitPrice': float(self.unit_price) if self.unit_price else 0,
            'currency': self.currency,
            'leadTimeDays': self.lead_time_days,
            'isActive': self.is_active,
            'lastUpdated': self.last_updated.isoformat() if self.last_updated else None,
            'supplier': self.supplier.to_dict() if self.supplier else None,
            'product': self.product.to_dict() if self.product else None
        }
