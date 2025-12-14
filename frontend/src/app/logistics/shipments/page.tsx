'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import StatusChip from '@/components/StatusChip';
import { Shipment } from '@/types';
import { Warehouse, AirplaneTilt, Truck, Package, ArrowRight, PencilSimple } from '@phosphor-icons/react';

interface GroupedShipments {
    requestNumber: string;
    productName: string;
    requestId: number;
    shipments: Shipment[];
}

export default function LogisticsShipmentsPage() {
    const [groupedShipments, setGroupedShipments] = useState<GroupedShipments[]>([]);
    const [loading, setLoading] = useState(true);
    const [dispatchingShipment, setDispatchingShipment] = useState<Shipment | null>(null);
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);

    const fetchShipments = async () => {
        try {
            const data = await api.getShipments();

            // Group by Request Number
            const groups: { [key: string]: GroupedShipments } = {};

            data.forEach((s: Shipment) => {
                const reqNum = s.requestNumber || `REQ-${s.requestId}`;
                if (!groups[reqNum]) {
                    groups[reqNum] = {
                        requestNumber: reqNum,
                        productName: s.productName || 'Unknown Product',
                        requestId: s.requestId,
                        shipments: []
                    };
                }
                groups[reqNum].shipments.push(s);
            });

            setGroupedShipments(Object.values(groups).sort((a, b) => b.requestId - a.requestId));
        } catch (error) {
            console.error('Failed to fetch shipments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipments();
    }, []);

    const ShipmentRow = ({ shipment }: { shipment: Shipment }) => {
        const isLocal = !!shipment.warehouseId;
        const sourceName = shipment.warehouseName || shipment.supplierName || 'Unknown Source';

        return (
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-sm p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
                {/* Source & Tracking */}
                <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isLocal ? 'bg-blue-900/20 text-blue-400' : 'bg-orange-900/20 text-orange-400'
                        }`}>
                        {isLocal ? <Warehouse size={20} /> : <AirplaneTilt size={20} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-white text-sm tracking-wide">{shipment.trackingNumber}</span>
                            <StatusChip status={shipment.status} size="sm" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <span>From:</span>
                            <span className="text-slate-300 font-medium">{sourceName}</span>
                            <span className="mx-1">•</span>
                            <span>{shipment.quantity} units</span>
                        </p>
                    </div>
                </div>

                {/* Logistics Info */}
                <div className="flex items-center gap-8 flex-1 justify-end">
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Carrier</p>
                        <p className="text-sm text-white font-medium">{shipment.carrier || 'Pending'}</p>
                    </div>

                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Destination</p>
                        <p className="text-sm text-slate-300">{shipment.deliveryCity}</p>
                    </div>

                    <div className="text-right min-w-[80px]">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">ETA</p>
                        <p className="text-sm text-blue-300 font-mono">
                            {shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString() : '-'}
                        </p>
                    </div>

                    {/* Action */}
                    <div className="w-28 flex justify-end gap-2">
                        {shipment.status === 'CONFIRMED' && (
                            <button
                                onClick={() => setDispatchingShipment(shipment)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-sm transition-colors uppercase font-bold tracking-wider flex items-center gap-1"
                            >
                                Dispatch
                            </button>
                        )}
                        {['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELAYED'].includes(shipment.status) && (
                            <button
                                onClick={() => setEditingShipment(shipment)}
                                className="px-3 py-1.5 border border-slate-600 hover:bg-slate-800 text-slate-300 text-xs rounded-sm transition-colors uppercase font-bold tracking-wider flex items-center gap-1"
                            >
                                <PencilSimple size={14} /> Update
                            </button>
                        )}
                        {shipment.status === 'DELIVERED' && (
                            <span className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                Complete
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Active Shipments</h3>
                        <p className="text-slate-400 text-sm mt-1">Grouped by Customer Request</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading shipments...</div>
                ) : groupedShipments.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/20 rounded-sm border border-slate-700/50">
                        <Package size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">No active shipments</h3>
                        <p className="text-slate-500 text-sm mt-1">Allocated shipments will appear here</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedShipments.map((group) => (
                            <div key={group.requestNumber} className="animate-fade-in">
                                <div className="flex items-center gap-3 mb-3 px-1">
                                    <div className="bg-purple-900/20 text-purple-400 px-2 py-1 rounded text-xs font-mono border border-purple-800/30">
                                        {group.requestNumber}
                                    </div>
                                    <h4 className="text-slate-300 font-medium text-sm">{group.productName}</h4>
                                    <div className="h-px bg-slate-800 flex-1 ml-4" />
                                </div>

                                <div className="space-y-3">
                                    {group.shipments.map(shipment => (
                                        <ShipmentRow key={shipment.id} shipment={shipment} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dispatch Modal */}
                {dispatchingShipment && (
                    <DispatchModal
                        shipment={dispatchingShipment}
                        onClose={() => setDispatchingShipment(null)}
                        onSuccess={() => {
                            setDispatchingShipment(null);
                            fetchShipments();
                        }}
                    />
                )}

                {/* Update Status Modal */}
                {editingShipment && (
                    <UpdateStatusModal
                        shipment={editingShipment}
                        onClose={() => setEditingShipment(null)}
                        onSuccess={() => {
                            setEditingShipment(null);
                            fetchShipments();
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

function DispatchModal({ shipment, onClose, onSuccess }: { shipment: Shipment, onClose: () => void, onSuccess: () => void }) {
    const [carrier, setCarrier] = useState(shipment.carrier || '');
    const [trackingUrl, setTrackingUrl] = useState(shipment.carrierTrackingUrl || '');
    const [submitting, setSubmitting] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-sm w-full max-w-md p-6 shadow-xl">
                <h3 className="text-xl font-chivo font-bold text-white mb-4">Dispatch Shipment</h3>

                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-3 rounded-sm border border-slate-700/50 mb-4">
                        <div className="text-xs text-slate-400 uppercase mb-1">Tracking ID</div>
                        <div className="font-mono text-purple-400 text-lg">{shipment.trackingNumber}</div>
                        <div className="text-xs text-slate-500 mt-2">
                            From: <span className="text-slate-300">{shipment.warehouseName || shipment.supplierName}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Carrier</label>
                        <select
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                        >
                            <option value="">Select Carrier</option>
                            <option value="DHL">DHL Express</option>
                            <option value="FedEx">FedEx Logistics</option>
                            <option value="BlueDart">BlueDart</option>
                            <option value="Maersk">Maersk Line</option>
                            <option value="UPS">UPS Supply Chain</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tracking URL (Optional)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                            placeholder="https://..."
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (!carrier) {
                                    alert('Please select a carrier');
                                    return;
                                }

                                setSubmitting(true);
                                try {
                                    await api.dispatchShipment(shipment.id, carrier, trackingUrl);
                                    onSuccess();
                                } catch (err) {
                                    alert('Failed to dispatch shipment');
                                    setSubmitting(false);
                                }
                            }}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-sm hover:bg-purple-500 transition-colors"
                        >
                            {submitting ? 'Dispatching...' : 'Confirm Dispatch'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function UpdateStatusModal({ shipment, onClose, onSuccess }: { shipment: Shipment, onClose: () => void, onSuccess: () => void }) {
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState(shipment.status);
    const [eta, setEta] = useState(shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toISOString().split('T')[0] : '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-sm w-full max-w-md p-6 shadow-xl">
                <h3 className="text-xl font-chivo font-bold text-white mb-4">Update Status</h3>

                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-3 rounded-sm border border-slate-700/50 mb-4">
                        <div className="text-xs text-slate-400 uppercase mb-1">Tracking ID</div>
                        <div className="font-mono text-purple-400 text-lg">{shipment.trackingNumber}</div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                        <select
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                        >
                            <option value="DISPATCHED">Dispatched</option>
                            <option value="IN_TRANSIT">In Transit</option>
                            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="DELAYED">Delayed</option>
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
                            onClick={(e) => e.currentTarget.showPicker()}
                        />
                    </div>

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
                                    await api.updateShipmentStatus(shipment.id, status, undefined, eta);
                                    onSuccess();
                                } catch (err) {
                                    alert('Failed to update status');
                                    setSubmitting(false);
                                }
                            }}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-500 transition-colors"
                        >
                            {submitting ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
