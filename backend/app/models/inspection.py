from enum import Enum
from datetime import datetime
from app import db


class InspectionResult(Enum):
    """AI inspection result types"""
    PENDING = 'PENDING'
    PROCESSING = 'PROCESSING'
    OK = 'OK'
    DAMAGED = 'DAMAGED'
    EXPIRED = 'EXPIRED'
    LOW_CONFIDENCE = 'LOW_CONFIDENCE'
    MANUAL_OVERRIDE = 'MANUAL_OVERRIDE'
    ERROR = 'ERROR'


class InspectionImage(db.Model):
    """Inspection images uploaded by warehouse operators"""
    __tablename__ = 'inspection_images'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('product_requests.id'), nullable=False, index=True)
    reservation_id = db.Column(db.Integer, db.ForeignKey('reservations.id'), nullable=True, index=True)
    
    # Uploader
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Image file
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)  # bytes
    mime_type = db.Column(db.String(100))
    
    # Image type
    image_type = db.Column(db.String(50))  # 'package', 'label', 'contents', 'damage'
    
    # AI Inspection results
    result = db.Column(db.Enum(InspectionResult), default=InspectionResult.PENDING)
    confidence_score = db.Column(db.Numeric(5, 2))  # 0.00 to 100.00
    
    # AI detection details
    damage_detected = db.Column(db.Boolean, default=False)
    damage_type = db.Column(db.String(100))  # 'tear', 'dent', 'water_damage', etc.
    damage_severity = db.Column(db.String(20))  # 'minor', 'moderate', 'severe'
    
    expiry_detected = db.Column(db.Boolean, default=False)
    detected_expiry_date = db.Column(db.Date)
    is_expired = db.Column(db.Boolean, default=False)
    
    seal_intact = db.Column(db.Boolean)
    spoilage_detected = db.Column(db.Boolean, default=False)
    
    # Raw AI response
    ai_raw_response = db.Column(db.Text)
    
    # Manual override
    overridden = db.Column(db.Boolean, default=False)
    override_result = db.Column(db.Enum(InspectionResult), nullable=True)
    override_reason = db.Column(db.Text)
    overridden_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    overridden_at = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime)
    
    # Relationships
    request = db.relationship('ProductRequest', back_populates='inspection_images')
    uploader = db.relationship('User', foreign_keys=[uploaded_by_id])
    overrider = db.relationship('User', foreign_keys=[overridden_by_id])
    
    @property
    def effective_result(self):
        """Get the effective result (override or AI result)"""
        if self.overridden and self.override_result:
            return self.override_result
        return self.result
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'requestId': self.request_id,
            'reservationId': self.reservation_id,
            'uploadedById': self.uploaded_by_id,
            'filename': self.filename,
            'filePath': self.file_path,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'imageType': self.image_type,
            'result': self.result.value,
            'effectiveResult': self.effective_result.value,
            'confidenceScore': float(self.confidence_score) if self.confidence_score else None,
            'damageDetected': self.damage_detected,
            'damageType': self.damage_type,
            'damageSeverity': self.damage_severity,
            'expiryDetected': self.expiry_detected,
            'detectedExpiryDate': self.detected_expiry_date.isoformat() if self.detected_expiry_date else None,
            'isExpired': self.is_expired,
            'sealIntact': self.seal_intact,
            'spoilageDetected': self.spoilage_detected,
            'overridden': self.overridden,
            'overrideResult': self.override_result.value if self.override_result else None,
            'overrideReason': self.override_reason,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'processedAt': self.processed_at.isoformat() if self.processed_at else None
        }
