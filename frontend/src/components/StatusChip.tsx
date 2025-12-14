import React from 'react';
import { RequestStatus, InspectionResult, ShipmentStatus } from '@/types';

export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type StatusVariant = RequestStatus | InspectionResult | ShipmentStatus | UserStatus;

interface StatusChipProps {
    status: StatusVariant;
    size?: 'sm' | 'md' | 'lg';
    animated?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; label?: string }> = {
    // Request statuses
    PENDING: {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
    },
    AWAITING_RECOMMENDATION: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'Awaiting Recommendation',
    },
    AWAITING_PROCUREMENT_APPROVAL: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        label: 'Awaiting Approval',
    },
    RESERVED: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
    },
    PICKING: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
    },
    INSPECTION_PENDING: {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
        label: 'Inspection Pending',
    },
    PARTIALLY_BLOCKED: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
        label: 'Partially Blocked',
    },
    BLOCKED: {
        bg: 'bg-red-500/20',
        text: 'text-red-300',
        border: 'border-red-500/40',
    },
    IMPORT_APPROVED: {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        label: 'Import Approved',
    },
    RESOLVED_PARTIAL: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        label: 'Resolved (Partial)',
    },
    READY_FOR_ALLOCATION: {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        label: 'Ready for Allocation',
    },
    ALLOCATED: {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30',
    },
    IN_TRANSIT: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'In Transit',
    },
    COMPLETED: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/30',
    },
    CANCELLED: {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
    },

    // Inspection results
    PROCESSING: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
    },
    OK: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/30',
    },
    DAMAGED: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
    },
    EXPIRED: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
    },
    LOW_CONFIDENCE: {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
        label: 'Low Confidence',
    },
    MANUAL_OVERRIDE: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        label: 'Manual Override',
    },
    ERROR: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
    },

    // Shipment statuses
    CONFIRMED: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
    },
    PACKING: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
    },
    DISPATCHED: {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30',
    },
    OUT_FOR_DELIVERY: {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        label: 'Out for Delivery',
    },
    DELIVERED: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/30',
    },
    FAILED: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
    },
    RETURNED: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
    },

    // User statuses
    ACTIVE: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/30',
    },
    INACTIVE: {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
    },
};

const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
};

export default function StatusChip({ status, size = 'md', animated = true }: StatusChipProps) {
    const config = statusConfig[status] || {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
    };
    const label = config.label || status.replace(/_/g, ' ');

    const shouldPulse = animated && ['PROCESSING', 'PICKING', 'IN_TRANSIT', 'DISPATCHED'].includes(status);

    return (
        <span
            className={`
                inline-flex items-center justify-center
                rounded-full font-semibold uppercase tracking-wide
                border
                transition-all duration-200
                ${config.bg} ${config.text} ${config.border}
                ${sizeClasses[size]}
                ${shouldPulse ? 'animate-pulse-glow' : ''}
            `}
        >
            {shouldPulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse-glow" />
            )}
            {label}
        </span>
    );
}
