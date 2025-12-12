'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { useRouter } from 'next/navigation';
import { Shipment } from '@/types';
import { MapPin, Package, Truck, CheckCircle } from '@phosphor-icons/react';

export default function DealerTrackingPage() {
    const router = useRouter();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchShipments = async () => {
            try {
                // For a real app, we'd have a specific endpoint for user's shipments
                // Here we'll filter client-side or assume the backend filters for us
                const data = await api.getShipments(); // This endpoint needs to be role-aware in backend
                setShipments(data);
            } catch (error) {
                console.error('Failed to fetch shipments:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShipments();
    }, []);

    const activeShipments = shipments.filter(s =>
        ['CONFIRMED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELAYED', 'PENDING'].includes(s.status)
    );
    const deliveredShipments = shipments.filter(s => s.status === 'DELIVERED');

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading tracking info...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Shipment Tracking</h3>
                    <p className="text-slate-400 text-sm mt-1">Real-time status of your deliveries</p>
                </div>

                {/* Track Search */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6 flex gap-4">
                    <input
                        type="text"
                        placeholder="Enter Request # or Tracking ID"
                        className="input-modern flex-1"
                    />
                    <button className="btn-primary">Track</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                            <Truck size={16} /> Active Shipments
                        </h4>
                        <div className="space-y-4">
                            {activeShipments.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No active shipments currently.</p>
                            ) : (
                                activeShipments.map(shipment => (
                                    <div key={shipment.id} className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4 relative overflow-hidden group hover:border-blue-500/30 transition-colors cursor-pointer" onClick={() => { }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-mono text-blue-400 text-sm">{shipment.trackingNumber}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">Carrier: {shipment.carrier || 'TBD'}</p>
                                            </div>
                                            <StatusChip status={shipment.status} size="sm" />
                                        </div>

                                        {/* Progress Bar Visual */}
                                        {/* Progress Bar Visual */}
                                        <div className="relative h-1.5 bg-slate-700 rounded-full mb-3">
                                            <div
                                                className={`absolute top-0 left-0 h-full rounded-full ${['DELAYED', 'BLOCKED'].includes(shipment.status) ? 'bg-red-500' : 'bg-blue-500 animate-pulse-glow'}`}
                                                style={{
                                                    width: shipment.status === 'CONFIRMED' ? '10%' :
                                                        shipment.status === 'DISPATCHED' ? '40%' :
                                                            shipment.status === 'IN_TRANSIT' ? '70%' :
                                                                shipment.status === 'OUT_FOR_DELIVERY' ? '90%' :
                                                                    shipment.status === 'DELIVERED' ? '100%' : '5%'
                                                }}
                                            ></div>
                                        </div>

                                        <div className="flex justify-between text-xs text-slate-400 font-mono">
                                            <span className={shipment.status === 'CONFIRMED' ? 'text-blue-400' : ''}>Processing</span>
                                            <span className={['DISPATCHED', 'IN_TRANSIT'].includes(shipment.status) ? 'text-blue-400' : ''}>In Transit</span>
                                            <span className={shipment.status === 'DELIVERED' ? 'text-green-400' : ''}>Delivered</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                            <CheckCircle size={16} /> Recently Delivered
                        </h4>
                        <div className="space-y-2">
                            {deliveredShipments.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No recent deliveries.</p>
                            ) : (
                                deliveredShipments.map(shipment => (
                                    <div key={shipment.id} className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-3 flex justify-between items-center opacity-75">
                                        <div>
                                            <p className="font-mono text-green-400 text-sm">{shipment.trackingNumber}</p>
                                            <p className="text-xs text-slate-500">
                                                Delivered on {shipment.actualDeliveryDate ? new Date(shipment.actualDeliveryDate).toLocaleDateString() : 'Unknown'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-300 text-sm">{shipment.quantity} units</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
