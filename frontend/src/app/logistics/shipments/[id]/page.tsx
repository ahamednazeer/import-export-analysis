'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import StatusChip from '@/components/StatusChip';
import { Shipment, ShipmentStatus } from '@/types';

export default function ShipmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const shipmentId = parseInt(params.id as string);
    
    const [shipment, setShipment] = useState<Shipment | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    useEffect(() => {
        const fetchShipment = async () => {
            try {
                const data = await api.getShipment(shipmentId);
                setShipment(data);
            } catch (error) {
                console.error('Failed to fetch shipment:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShipment();
    }, [shipmentId]);

    if (loading) {
        return (
            <DashboardLayout userRole="LOGISTICS_PLANNER">
                <div className="flex items-center justify-center h-screen">
                    <div className="text-slate-400">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!shipment) {
        return (
            <DashboardLayout userRole="LOGISTICS_PLANNER">
                <div className="flex items-center justify-center h-screen">
                    <div className="text-slate-400">Shipment not found</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Shipment Details</h3>
                        <p className="text-slate-400 text-sm mt-1">{shipment.trackingNumber}</p>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors text-sm"
                    >
                        Back
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Main Details Card */}
                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                            <h4 className="text-lg font-chivo font-bold text-white mb-6">Shipment Information</h4>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tracking Number</label>
                                    <div className="font-mono text-blue-400 text-sm">{shipment.trackingNumber}</div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                    <StatusChip status={shipment.status} size="sm" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Quantity</label>
                                    <div className="text-slate-200 text-sm">{shipment.quantity} units</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Type</label>
                                    <div className="text-slate-200 text-sm">{shipment.isImport ? 'Import' : 'Local'}</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Carrier</label>
                                    <div className="text-slate-200 text-sm">{shipment.carrier || '-'}</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Request ID</label>
                                    <div className="text-slate-200 text-sm">{shipment.requestId}</div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Details Card */}
                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                            <h4 className="text-lg font-chivo font-bold text-white mb-6">Delivery Details</h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Address</label>
                                    <div className="text-slate-200 text-sm">{shipment.deliveryAddress || '-'}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">City</label>
                                        <div className="text-slate-200 text-sm">{shipment.deliveryCity || '-'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">State</label>
                                        <div className="text-slate-200 text-sm">{shipment.deliveryState || '-'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Receiver Name</label>
                                        <div className="text-slate-200 text-sm">{shipment.receiverName || '-'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Receiver Phone</label>
                                        <div className="text-slate-200 text-sm">{shipment.receiverPhone || '-'}</div>
                                    </div>
                                </div>

                                {shipment.deliveryNotes && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Delivery Notes</label>
                                        <div className="text-slate-200 text-sm">{shipment.deliveryNotes}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dates Card */}
                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                            <h4 className="text-lg font-chivo font-bold text-white mb-6">Timeline</h4>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Dispatch Date</label>
                                    <div className="text-slate-200 text-sm">
                                        {shipment.estimatedDispatchDate 
                                            ? new Date(shipment.estimatedDispatchDate).toLocaleDateString()
                                            : '-'
                                        }
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Actual Dispatch Date</label>
                                    <div className="text-slate-200 text-sm">
                                        {shipment.actualDispatchDate 
                                            ? new Date(shipment.actualDispatchDate).toLocaleDateString()
                                            : '-'
                                        }
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Delivery Date</label>
                                    <div className="text-slate-200 text-sm">
                                        {shipment.estimatedDeliveryDate 
                                            ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString()
                                            : '-'
                                        }
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Actual Delivery Date</label>
                                    <div className="text-slate-200 text-sm">
                                        {shipment.actualDeliveryDate 
                                            ? new Date(shipment.actualDeliveryDate).toLocaleDateString()
                                            : '-'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {shipment.carrierTrackingUrl && (
                            <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                                <h4 className="text-lg font-chivo font-bold text-white mb-4">Carrier Tracking</h4>
                                <a 
                                    href={shipment.carrierTrackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm"
                                >
                                    {shipment.carrierTrackingUrl}
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={() => setShowUpdateModal(true)}
                            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-sm transition-colors font-bold uppercase tracking-widest text-sm"
                        >
                            Update Status
                        </button>

                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Current Status</label>
                            <StatusChip status={shipment.status} size="md" />
                        </div>

                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Created</label>
                            <div className="text-slate-300 text-sm font-mono">
                                {new Date(shipment.createdAt).toLocaleString()}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-700 rounded-sm p-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Updated</label>
                            <div className="text-slate-300 text-sm font-mono">
                                {new Date(shipment.updatedAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Update Status Modal */}
                {showUpdateModal && (
                    <UpdateStatusModal
                        shipment={shipment}
                        onClose={() => setShowUpdateModal(false)}
                        onSuccess={async () => {
                            const data = await api.getShipment(shipmentId);
                            setShipment(data);
                            setShowUpdateModal(false);
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

function UpdateStatusModal({
    shipment,
    onClose,
    onSuccess
}: {
    shipment: Shipment;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [status, setStatus] = useState<ShipmentStatus>(shipment.status);
    const [eta, setEta] = useState(shipment.estimatedDeliveryDate
        ? new Date(shipment.estimatedDeliveryDate).toISOString().split('T')[0]
        : '');
    const [deliveredTo, setDeliveredTo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-sm w-full max-w-md p-6 shadow-xl">
                <h3 className="text-xl font-chivo font-bold text-white mb-4">Update Shipment Status</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                        <select
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                            value={status}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Type-safe check: ensure the value is a valid ShipmentStatus
                                if (['PENDING', 'CONFIRMED', 'PACKING', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'].includes(value)) {
                                    setStatus(value as ShipmentStatus);
                                }
                            }}
                        >
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="DISPATCHED">Dispatched</option>
                            <option value="IN_TRANSIT">In Transit</option>
                            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="FAILED">Failed</option>
                            <option value="RETURNED">Returned</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Delivery Date</label>
                        <input
                            type="date"
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm cursor-pointer"
                            value={eta}
                            onChange={(e) => setEta(e.target.value)}
                        />
                    </div>

                    {status === 'DELIVERED' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Delivered To (Name)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                                placeholder="Recipient name"
                                value={deliveredTo}
                                onChange={(e) => setDeliveredTo(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                setSubmitting(true);
                                try {
                                    await api.updateShipmentStatus(
                                        shipment.id,
                                        status,
                                        status === 'DELIVERED' ? deliveredTo : undefined,
                                        eta || undefined
                                    );
                                    onSuccess();
                                } catch (err) {
                                    alert('Failed to update shipment');
                                    setSubmitting(false);
                                }
                            }}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-500 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
