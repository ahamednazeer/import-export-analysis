from enum import Enum
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


class Role(Enum):
    """User roles in the system"""
    DEALER = 'DEALER'
    WAREHOUSE_OPERATOR = 'WAREHOUSE_OPERATOR'
    SUPPLIER = 'SUPPLIER'
    PROCUREMENT_MANAGER = 'PROCUREMENT_MANAGER'
    LOGISTICS_PLANNER = 'LOGISTICS_PLANNER'
    ADMIN = 'ADMIN'
    CUSTOMER_SERVICE = 'CUSTOMER_SERVICE'
    ML_ENGINEER = 'ML_ENGINEER'


class User(db.Model):
    """User model for authentication and authorization"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.Enum(Role), nullable=False, default=Role.DEALER)
    is_active = db.Column(db.Boolean, default=True)
    
    # For warehouse operators and suppliers
    assigned_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=True)
    assigned_supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    requests = db.relationship('ProductRequest', back_populates='dealer', foreign_keys='ProductRequest.dealer_id')
    assigned_warehouse = db.relationship('Warehouse', back_populates='operators')
    assigned_supplier = db.relationship('Supplier', foreign_keys=[assigned_supplier_id])
    
    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_relations=True):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'firstName': self.first_name,
            'lastName': self.last_name,
            'role': self.role.value,
            'isActive': self.is_active,
            'assignedWarehouseId': self.assigned_warehouse_id,
            'assignedSupplierId': self.assigned_supplier_id,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

        if include_relations:
            data['assignedWarehouse'] = self.assigned_warehouse.to_dict() if self.assigned_warehouse else None
            data['assignedSupplier'] = self.assigned_supplier.to_dict() if self.assigned_supplier else None

        return data
