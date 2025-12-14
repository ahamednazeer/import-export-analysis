export type Role =
    | 'DEALER'
    | 'WAREHOUSE_OPERATOR'
    | 'SUPPLIER'
    | 'PROCUREMENT_MANAGER'
    | 'LOGISTICS_PLANNER'
    | 'ADMIN'
    | 'CUSTOMER_SERVICE'
    | 'ML_ENGINEER';

export type RequestStatus =
    | 'PENDING'
    | 'AWAITING_RECOMMENDATION'
    | 'AWAITING_PROCUREMENT_APPROVAL'
    | 'RESERVED'
    | 'PICKING'
    | 'INSPECTION_PENDING'
    | 'PARTIALLY_BLOCKED'
    | 'BLOCKED'
    | 'IMPORT_APPROVED'
    | 'RESOLVED_PARTIAL'
    | 'READY_FOR_ALLOCATION'
    | 'ALLOCATED'
    | 'IN_TRANSIT'
    | 'COMPLETED'
    | 'CANCELLED';

export type SourceType = 'LOCAL' | 'IMPORT' | 'MIXED';

export type InspectionResult =
    | 'PENDING'
    | 'PROCESSING'
    | 'OK'
    | 'DAMAGED'
    | 'EXPIRED'
    | 'LOW_CONFIDENCE'
    | 'MANUAL_OVERRIDE'
    | 'ERROR';

export type ShipmentStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'PACKING'
    | 'DISPATCHED'
    | 'IN_TRANSIT'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'RECEIVED'
    | 'FAILED'
    | 'RETURNED';

export interface User {
    id: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: Role;
    isActive: boolean;
    assignedWarehouseId?: number;
    assignedSupplierId?: number;
    assignedWarehouse?: Warehouse;
    assignedSupplier?: Supplier;
    createdAt: string;
}

export interface Product {
    id: number;
    sku: string;
    name: string;
    description?: string;
    category?: string;
    unit: string;
    minOrderQuantity: number;
    unitPrice: number;
    currency: string;
    isActive: boolean;
    requiresInspection: boolean;
    shelfLifeDays?: number;
    createdAt: string;
}

export interface Warehouse {
    id: number;
    code: string;
    name: string;
    city: string;
    state?: string;
    country: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    totalCapacity: number;
    currentUtilization: number;
    isActive: boolean;
    createdAt: string;
}

export interface Stock {
    id: number;
    warehouseId: number;
    productId: number;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    batchNumber?: string;
    manufacturingDate?: string;
    expiryDate?: string;
    locationCode?: string;
    lastUpdated: string;
    warehouse?: Warehouse;
    product?: Product;
}

export interface Supplier {
    id: number;
    code: string;
    name: string;
    country: string;
    city?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    leadTimeDays: number;
    reliabilityScore: number;
    defaultCurrency: string;
    isActive: boolean;
    createdAt: string;
}

export interface ProductRequest {
    id: number;
    requestNumber: string;
    dealerId: number;
    productId: number;
    quantity: number;
    deliveryLocation: string;
    deliveryCity?: string;
    deliveryState?: string;
    status: RequestStatus;
    recommendedSource?: SourceType;
    recommendationExplanation?: string;
    requestedDeliveryDate?: string;
    estimatedDeliveryDate?: string;
    dealerNotes?: string;
    procurementNotes?: string;
    createdAt: string;
    updatedAt: string;
    confirmedAt?: string;
    completedAt?: string;
    dealer?: User;
    product?: Product;
    reservations?: Reservation[];
    // Warehouse-specific fields for warehouse operators
    warehouseQuantity?: number;
    warehouseReservations?: Reservation[];
    inspectionProgress?: {
        inspected: number;
        total: number;
        percentage: number;
    };
}

export interface Reservation {
    id: number;
    requestId: number;
    warehouseId?: number;
    supplierId?: number;
    quantity: number;
    isLocal: boolean;
    isBlocked: boolean;
    blockReason?: string;
    isPicked: boolean;
    pickedAt?: string;
    aiConfirmed?: boolean;
    reservationStatus?: string;
    isReplacement: boolean;
    createdAt: string;
    warehouse?: Warehouse;
    supplier?: Supplier;
}

export interface InspectionImage {
    id: number;
    requestId: number;
    reservationId?: number;
    uploadedById: number;
    filename: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    imageType?: string;
    result: InspectionResult;
    effectiveResult: InspectionResult;
    confidenceScore?: number;
    damageDetected: boolean;
    damageType?: string;
    damageSeverity?: string;
    expiryDetected: boolean;
    detectedExpiryDate?: string;
    isExpired: boolean;
    sealIntact?: boolean;
    spoilageDetected: boolean;
    overridden: boolean;
    overrideResult?: InspectionResult;
    overrideReason?: string;
    createdAt: string;
    processedAt?: string;
}

export interface Shipment {
    id: number;
    trackingNumber: string;
    requestId: number;
    // New fields for UI display
    requestNumber?: string;
    productName?: string;
    warehouseName?: string;
    supplierName?: string;

    reservationId?: number;
    warehouseId?: number;
    supplierId?: number;
    isImport: boolean;
    quantity: number;
    status: ShipmentStatus;
    carrier?: string;
    carrierTrackingUrl?: string;
    estimatedDispatchDate?: string;
    actualDispatchDate?: string;
    estimatedDeliveryDate?: string;
    actualDeliveryDate?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryState?: string;
    receiverName?: string;
    receiverPhone?: string;
    deliveryNotes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SourcingRecommendation {
    source_type: SourceType;
    explanation: string;
    totalLocalAvailable: number;
    totalImportAvailable: number;
    requestedQuantity: number;
    canFulfill: boolean;
    allocationPlan: AllocationPlan[];
}

export interface AllocationPlan {
    source: 'local' | 'import';
    warehouseId?: number;
    warehouseName?: string;
    warehouseCity?: string;
    supplierId?: number;
    supplierName?: string;
    supplierCountry?: string;
    quantity: number;
    estimatedDays: number;
}

export interface SystemStats {
    users: {
        total: number;
        byRole: Record<Role, number>;
    };
    requests: {
        total: number;
        pending: number;
        active: number;
        completed: number;
    };
    warehouses: {
        total: number;
    };
    suppliers: {
        total: number;
    };
}
