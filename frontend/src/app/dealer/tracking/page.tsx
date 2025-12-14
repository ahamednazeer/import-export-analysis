'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import StatusChip from '@/components/StatusChip';
// Removed unused useRouter
import { Shipment } from '@/types';
import { Truck, Package, Warehouse, AirplaneTilt, ArrowRight, CheckCircle } from '@phosphor-icons/react';

interface GroupedShipments {
    requestNumber: string;
    productName: string;
    requestId: number;
    shipments: Shipment[];
}

export default function DealerTrackingPage() {
    // Removed unused router
    const [groupedShipments, setGroupedShipments] = useState<GroupedShipments[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        fetchShipments();
    }, []);

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono animate-pulse">Loading tracking info...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER">
            <div className="space-y-8 max-w-5xl mx-auto">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Shipment Tracking</h3>
                    <p className="text-slate-400 text-sm mt-1">Real-time status of your deliveries</p>
                </div>

                {groupedShipments.length === 0 ? (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-8 text-center">
                        <Package size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">No shipments found</h3>
                        <p className="text-slate-500 text-sm mt-1">Your active orders will appear here once allocated.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedShipments.map((group) => (
                            <div key={group.requestNumber} className="animate-fade-in">
                                {/* Group Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-900/20 text-blue-400 px-3 py-1 rounded text-sm font-mono border border-blue-800/30">
                                        {group.requestNumber}
                                    </div>
                                    <h4 className="text-white font-medium text-lg">{group.productName}</h4>
                                    <div className="h-px bg-slate-800 flex-1 ml-4" />
                                </div>

                                {/* Shipments Grid */}
                                <div className="grid gap-4">
                                    {group.shipments.map(shipment => {
                                        const isLocal = !!shipment.warehouseId;
                                        const sourceName = shipment.warehouseName || shipment.supplierName || 'Unknown Source';

                                        return (
                                            <div key={shipment.id} className="bg-slate-900/40 border border-slate-700/50 rounded-sm p-5 hover:border-slate-600 transition-colors">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                                    {/* Left: Icon & Info */}
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isLocal ? 'bg-blue-900/20 text-blue-400' : 'bg-orange-900/20 text-orange-400'
                                                            }`}>
                                                            {isLocal ? <Warehouse size={24} /> : <AirplaneTilt size={24} />}
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <span className="font-mono text-white text-lg tracking-wide">{shipment.trackingNumber}</span>
                                                                <StatusChip status={shipment.status} size="sm" />
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-sm">
                                                                <p className="text-slate-500">From: <span className="text-slate-300 font-medium">{sourceName}</span></p>
                                                                <p className="text-slate-500">Carrier: <span className="text-slate-300">{shipment.carrier || 'Pending'}</span></p>
                                                                <p className="text-slate-500">Qty: <span className="text-slate-300">{shipment.quantity} units</span></p>
                                                                <p className="text-slate-500">ETA: <span className="text-blue-300 font-mono">{shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString() : '-'}</span></p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: progress bar & CTA */}
                                                    <div className="flex-1 max-w-sm ml-auto w-full md:w-auto">
                                                        {/* Progress Visual */}
                                                        <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                                                            <span>Packed</span>
                                                            <span className={['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED'].includes(shipment.status) ? 'text-blue-400' : ''}>Transit</span>
                                                            <span className={['DELIVERED', 'RECEIVED'].includes(shipment.status) ? 'text-green-400' : ''}>Delivered</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${['DELAYED', 'BLOCKED'].includes(shipment.status) ? 'bg-red-500' :
                                                                    ['DELIVERED', 'RECEIVED'].includes(shipment.status) ? 'bg-green-500' : 'bg-blue-500'
                                                                    }`}
                                                                style={{
                                                                    width: shipment.status === 'CONFIRMED' ? '15%' :
                                                                        shipment.status === 'DISPATCHED' ? '40%' :
                                                                            shipment.status === 'IN_TRANSIT' ? '65%' :
                                                                                shipment.status === 'OUT_FOR_DELIVERY' ? '85%' :
                                                                                    ['DELIVERED', 'RECEIVED'].includes(shipment.status) ? '100%' : '5%'
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="text-right">
                                                            {shipment.status === 'DELIVERED' ? (
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.preventDefault();
                                                                        if (confirm('Confirm that you have received this shipment?')) {
                                                                            try {
                                                                                await api.updateShipmentStatus(shipment.id, 'RECEIVED');
                                                                                // Ideally refresh data here
                                                                                window.location.reload();
                                                                            } catch (err) {
                                                                                alert('Failed to confirm receipt');
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-xs font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-sm transition-colors uppercase tracking-wider"
                                                                >
                                                                    Confirm Receipt
                                                                </button>
                                                            ) : shipment.status === 'RECEIVED' ? (
                                                                <span className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                                                                    <CheckCircle size={14} weight="fill" /> Received
                                                                </span>
                                                            ) : (
                                                                <Link
                                                                    href={`/dealer/tracking/${shipment.id}`}
                                                                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                                                >
                                                                    View Details <ArrowRight />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
