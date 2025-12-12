'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { Shipment } from '@/types';

export default function LogisticsShipmentsPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);

    const [dispatchingShipment, setDispatchingShipment] = useState<Shipment | null>(null);

    useEffect(() => {
        const fetchShipments = async () => {
            try {
                const data = await api.getShipments();
                setShipments(data);
            } catch (error) {
                console.error('Failed to fetch shipments:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShipments();
    }, []);

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">All Shipments</h3>
                    <p className="text-slate-400 text-sm mt-1">Global logistics overview</p>
                </div>

                <DataTable
                    data={shipments}
                    columns={[
                        {
                            key: 'trackingNumber',
                            label: 'Tracking ID',
                            render: (item) => (
                                <span className="font-mono text-blue-400">{item.trackingNumber}</span>
                            ),
                        },
                        {
                            key: 'carrier',
                            label: 'Carrier',
                            render: (item) => item.carrier || <span className="text-slate-500 italic">Pending</span>,
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (item) => <StatusChip status={item.status} size="sm" />,
                        },
                        {
                            key: 'destination',
                            label: 'Destination',
                            render: (item) => <span className="text-sm text-slate-300">{item.deliveryCity}</span>,
                        },
                        {
                            key: 'eta',
                            label: 'ETA (Click to Edit)',
                            render: (item) => (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingShipment(item);
                                    }}
                                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-mono flex items-center gap-1 transition-colors"
                                >
                                    {item.estimatedDeliveryDate ? new Date(item.estimatedDeliveryDate).toLocaleDateString() : '-'}
                                    <span className="text-[10px] opacity-50">✎</span>
                                </button>
                            ),
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => {
                                if (item.status === 'CONFIRMED') {
                                    return (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDispatchingShipment(item);
                                            }}
                                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-sm transition-colors uppercase font-bold tracking-wider"
                                        >
                                            Dispatch
                                        </button>
                                    );
                                }
                                return null;
                            }
                        }
                    ]}
                    emptyMessage="No shipments found."
                />

                {/* Edit Modal (Existing) */}
                {editingShipment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-sm w-full max-w-md p-6 shadow-xl">
                            <h3 className="text-xl font-chivo font-bold text-white mb-4">Update Shipment</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tracking ID</label>
                                    <div className="text-slate-200 font-mono">{editingShipment.trackingNumber}</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm"
                                        defaultValue={editingShipment.status}
                                        id="update-status"
                                    >
                                        <option value="CONFIRMED">Confirmed</option>
                                        <option value="DISPATCHED">Dispatched</option>
                                        <option value="IN_TRANSIT">In Transit</option>
                                        <option value="DELIVERED">Delivered</option>
                                        <option value="DELAYED">Delayed</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Delivery Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded-sm text-sm cursor-pointer"
                                        defaultValue={editingShipment.estimatedDeliveryDate ? new Date(editingShipment.estimatedDeliveryDate).toISOString().split('T')[0] : ''}
                                        id="update-eta"
                                        onClick={(e) => e.currentTarget.showPicker()}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setEditingShipment(null)}
                                        className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const status = (document.getElementById('update-status') as HTMLSelectElement).value;
                                            const eta = (document.getElementById('update-eta') as HTMLInputElement).value;

                                            try {
                                                await api.updateShipmentStatus(editingShipment.id, status, undefined, eta);
                                                // Refresh
                                                const data = await api.getShipments();
                                                setShipments(data);
                                                setEditingShipment(null);
                                            } catch (err) {
                                                alert('Failed to update shipment');
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-500 transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dispatch Modal (New) */}
                {dispatchingShipment && (
                    <DispatchModal
                        shipment={dispatchingShipment}
                        onClose={() => setDispatchingShipment(null)}
                        onSuccess={async () => {
                            const data = await api.getShipments();
                            setShipments(data);
                            setDispatchingShipment(null);
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
                        <div className="text-xs text-slate-400 uppercase mb-1">Shipment ID</div>
                        <div className="font-mono text-purple-400">{shipment.trackingNumber}</div>
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
