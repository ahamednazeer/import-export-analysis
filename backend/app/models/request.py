from enum import Enum
from datetime import datetime
from app import db


class RequestStatus(Enum):
    """Status flow for product requests"""
    PENDING = 'PENDING'
    AWAITING_RECOMMENDATION = 'AWAITING_RECOMMENDATION'
    AWAITING_PROCUREMENT_APPROVAL = 'AWAITING_PROCUREMENT_APPROVAL'
    RESERVED = 'RESERVED'
    PICKING = 'PICKING'
    INSPECTION_PENDING = 'INSPECTION_PENDING'
    PARTIALLY_BLOCKED = 'PARTIALLY_BLOCKED'
    RESOLVED_PARTIAL = 'RESOLVED_PARTIAL'
    READY_FOR_ALLOCATION = 'READY_FOR_ALLOCATION'
    ALLOCATED = 'ALLOCATED'
    IN_TRANSIT = 'IN_TRANSIT'
    COMPLETED = 'COMPLETED'
    CANCELLED = 'CANCELLED'


class SourceType(Enum):
    """Source recommendation type"""
    LOCAL = 'LOCAL'
    IMPORT = 'IMPORT'
    MIXED = 'MIXED'


class ProductRequest(db.Model):
    """Dealer product request"""
    __tablename__ = 'product_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    dealer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    
    quantity = db.Column(db.Integer, nullable=False)
    delivery_location = db.Column(db.String(255), nullable=False)
    delivery_city = db.Column(db.String(100))
    delivery_state = db.Column(db.String(100))
    
    # Status
    status = db.Column(db.Enum(RequestStatus), default=RequestStatus.PENDING, index=True)
    
    # Sourcing recommendation
    recommended_source = db.Column(db.Enum(SourceType), nullable=True)
    recommendation_explanation = db.Column(db.Text)
    
    # Timing
    requested_delivery_date = db.Column(db.Date)
    estimated_delivery_date = db.Column(db.Date)
    
    # Notes
    dealer_notes = db.Column(db.Text)
    procurement_notes = db.Column(db.Text)
    
    # Audit
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    confirmed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    dealer = db.relationship('User', back_populates='requests', foreign_keys=[dealer_id])
    product = db.relationship('Product', back_populates='requests')
    reservations = db.relationship('Reservation', back_populates='request', cascade='all, delete-orphan')
    inspection_images = db.relationship('InspectionImage', back_populates='request', cascade='all, delete-orphan')
    shipments = db.relationship('Shipment', back_populates='request', cascade='all, delete-orphan')
    
    def generate_request_number(self):
        """Generate unique request number"""
        import random
        import string
        timestamp = datetime.utcnow().strftime('%Y%m%d')
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        self.request_number = f"REQ-{timestamp}-{random_suffix}"
    
    def to_dict(self, include_relations=True):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'requestNumber': self.request_number,
            'dealerId': self.dealer_id,
            'productId': self.product_id,
            'quantity': self.quantity,
            'deliveryLocation': self.delivery_location,
            'deliveryCity': self.delivery_city,
            'deliveryState': self.delivery_state,
            'status': self.status.value,
            'recommendedSource': self.recommended_source.value if self.recommended_source else None,
            'recommendationExplanation': self.recommendation_explanation,
            'requestedDeliveryDate': self.requested_delivery_date.isoformat() if self.requested_delivery_date else None,
            'estimatedDeliveryDate': self.estimated_delivery_date.isoformat() if self.estimated_delivery_date else None,
            'dealerNotes': self.dealer_notes,
            'procurementNotes': self.procurement_notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'confirmedAt': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'completedAt': self.completed_at.isoformat() if self.completed_at else None
        }
        
        if include_relations:
            data['dealer'] = self.dealer.to_dict() if self.dealer else None
            data['product'] = self.product.to_dict() if self.product else None
            data['reservations'] = [r.to_dict(include_request=False) for r in self.reservations]
        
        return data


class Reservation(db.Model):
    """Stock reservations for a request"""
    __tablename__ = 'reservations'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('product_requests.id'), nullable=False, index=True)
    
    # Source (either warehouse or supplier, not both)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=True, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True, index=True)
    
    quantity = db.Column(db.Integer, nullable=False)
    
    # Status
    is_local = db.Column(db.Boolean, default=True)
    is_blocked = db.Column(db.Boolean, default=False)
    block_reason = db.Column(db.String(50))  # DAMAGED, EXPIRED, LOW_CONFIDENCE
    
    # Picking status
    is_picked = db.Column(db.Boolean, default=False)
    picked_at = db.Column(db.DateTime)
    picked_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # For replacements
    is_replacement = db.Column(db.Boolean, default=False)
    original_reservation_id = db.Column(db.Integer, db.ForeignKey('reservations.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    request = db.relationship('ProductRequest', back_populates='reservations')
    warehouse = db.relationship('Warehouse', back_populates='reservations')
    supplier = db.relationship('Supplier', back_populates='reservations')
    original_reservation = db.relationship('Reservation', remote_side=[id])
    
    def to_dict(self, include_request=True):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'requestId': self.request_id,
            'warehouseId': self.warehouse_id,
            'supplierId': self.supplier_id,
            'quantity': self.quantity,
            'isLocal': self.is_local,
            'isBlocked': self.is_blocked,
            'blockReason': self.block_reason,
            'isPicked': self.is_picked,
            'pickedAt': self.picked_at.isoformat() if self.picked_at else None,
            'isReplacement': self.is_replacement,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'warehouse': self.warehouse.to_dict() if self.warehouse else None,
            'supplier': self.supplier.to_dict() if self.supplier else None
        }
        
        if include_request:
            data['request'] = self.request.to_dict(include_relations=False) if self.request else None
        
        return data
