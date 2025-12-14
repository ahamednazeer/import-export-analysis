from enum import Enum
from datetime import datetime
from app import db


class ShipmentStatus(Enum):
    """Shipment tracking status"""
    PENDING = 'PENDING'
    CONFIRMED = 'CONFIRMED'
    PACKING = 'PACKING'
    DISPATCHED = 'DISPATCHED'
    IN_TRANSIT = 'IN_TRANSIT'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY'
    DELIVERED = 'DELIVERED'
    RECEIVED = 'RECEIVED'  # Dealer confirmed receipt
    FAILED = 'FAILED'
    RETURNED = 'RETURNED'


class Shipment(db.Model):
    """Shipment allocation and tracking"""
    __tablename__ = 'shipments'
    
    id = db.Column(db.Integer, primary_key=True)
    tracking_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    request_id = db.Column(db.Integer, db.ForeignKey('product_requests.id'), nullable=False, index=True)
    reservation_id = db.Column(db.Integer, db.ForeignKey('reservations.id'), nullable=True)
    
    # Source
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    is_import = db.Column(db.Boolean, default=False)
    
    # Quantity
    quantity = db.Column(db.Integer, nullable=False)
    
    # Status
    status = db.Column(db.Enum(ShipmentStatus), default=ShipmentStatus.PENDING, index=True)
    
    # Logistics
    carrier = db.Column(db.String(100))
    carrier_tracking_url = db.Column(db.Text)
    
    # Dates
    estimated_dispatch_date = db.Column(db.Date)
    actual_dispatch_date = db.Column(db.Date)
    estimated_delivery_date = db.Column(db.Date)
    actual_delivery_date = db.Column(db.Date)
    
    # Delivery details
    delivery_address = db.Column(db.Text)
    delivery_city = db.Column(db.String(100))
    delivery_state = db.Column(db.String(100))
    
    # Receiver
    receiver_name = db.Column(db.String(100))
    receiver_phone = db.Column(db.String(20))
    delivery_notes = db.Column(db.Text)
    
    # Proof of delivery
    pod_image_path = db.Column(db.String(500))
    pod_signature = db.Column(db.Text)
    delivered_to = db.Column(db.String(100))
    
    # Created/managed by
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    request = db.relationship('ProductRequest', back_populates='shipments')
    warehouse = db.relationship('Warehouse', backref='shipments')
    supplier = db.relationship('Supplier', backref='shipments')
    
    def generate_tracking_number(self):
        """Generate unique tracking number"""
        import random
        import string
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M')
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        prefix = 'LOC'
        if self.warehouse_id and self.warehouse and self.warehouse.code:
            prefix = self.warehouse.code
        elif self.is_import:
            prefix = 'IMP'
            
        self.tracking_number = f"{prefix}-{timestamp}-{random_suffix}"
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'trackingNumber': self.tracking_number,
            'requestId': self.request_id,
            'requestNumber': self.request.request_number if self.request else None,
            'productName': self.request.product.name if self.request and self.request.product else None,
            'reservationId': self.reservation_id,
            'warehouseId': self.warehouse_id,
            'warehouseName': self.warehouse.name if self.warehouse_id and self.warehouse else None,
            'supplierId': self.supplier_id,
            'supplierName': self.supplier.name if self.supplier_id and self.supplier else None,
            'isImport': self.is_import,
            'quantity': self.quantity,
            'status': self.status.value,
            'carrier': self.carrier,
            'carrierTrackingUrl': self.carrier_tracking_url,
            'estimatedDispatchDate': self.estimated_dispatch_date.isoformat() if self.estimated_dispatch_date else None,
            'actualDispatchDate': self.actual_dispatch_date.isoformat() if self.actual_dispatch_date else None,
            'estimatedDeliveryDate': self.estimated_delivery_date.isoformat() if self.estimated_delivery_date else None,
            'actualDeliveryDate': self.actual_delivery_date.isoformat() if self.actual_delivery_date else None,
            'deliveryAddress': self.delivery_address,
            'deliveryCity': self.delivery_city,
            'deliveryState': self.delivery_state,
            'receiverName': self.receiver_name,
            'receiverPhone': self.receiver_phone,
            'deliveryNotes': self.delivery_notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
