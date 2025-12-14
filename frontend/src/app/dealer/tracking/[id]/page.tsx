'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import StatusChip from '@/components/StatusChip';
import { Shipment } from '@/types';
import { MapPin, Truck, CheckCircle, Clock, Phone, User } from '@phosphor-icons/react';

export default function DealerShipmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const shipmentId = parseInt(params.id as string);

    const [shipment, setShipment] = useState<Shipment | null>(null);
    const [loading, setLoading] = useState(true);

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

    const getStatusDetails = (status: string) => {
        const statusMap: Record<string, { icon: any, color: string, message: string }> = {
            CONFIRMED: { icon: CheckCircle, color: 'text-green-400', message: 'Shipment confirmed and being prepared' },
            DISPATCHED: { icon: Truck, color: 'text-blue-400', message: 'Shipment has been dispatched' },
            IN_TRANSIT: { icon: Truck, color: 'text-blue-400', message: 'Currently in transit to destination' },
            OUT_FOR_DELIVERY: { icon: MapPin, color: 'text-yellow-400', message: 'Out for delivery in your area' },
            DELIVERED: { icon: CheckCircle, color: 'text-green-400', message: 'Successfully delivered' },
            DELAYED: { icon: Clock, color: 'text-red-400', message: 'Shipment is experiencing delays' },
            PENDING: { icon: Clock, color: 'text-slate-400', message: 'Awaiting processing' }
        };
        return statusMap[status] || { icon: Clock, color: 'text-slate-400', message: 'Status unknown' };
    };

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading shipment details...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!shipment) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Shipment not found</div>
                </div>
            </DashboardLayout>
        );
    }

    const statusDetails = getStatusDetails(shipment.status);

    return (
        <DashboardLayout userRole="DEALER">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Shipment Details</h3>
                        <p className="text-slate-400 text-sm mt-1">Tracking ID: {shipment.trackingNumber}</p>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors text-sm"
                    >
                        Back to Tracking
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Overview */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <statusDetails.icon size={24} className={statusDetails.color} />
                            <div>
                                <h4 className="text-lg font-chivo font-bold text-white">Current Status</h4>
                                <StatusChip status={shipment.status} size="md" />
                            </div>
                        </div>
                        <p className="text-slate-300 text-sm">{statusDetails.message}</p>
                    </div>

                    {/* Shipment Progress */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <h4 className="text-lg font-chivo font-bold text-white mb-4">Delivery Progress</h4>
                        <div className="relative h-2 bg-slate-700 rounded-full mb-3">
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

                    {/* Shipment Details */}
                    <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                        <h4 className="text-lg font-chivo font-bold text-white mb-6">Shipment Information</h4>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tracking Number</label>
                                    <p className="font-mono text-blue-400">{shipment.trackingNumber}</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Quantity</label>
                                    <p className="text-slate-200">{shipment.quantity} units</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Type</label>
                                    <p className="text-slate-200">{shipment.isImport ? 'Import' : 'Local'}</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Carrier</label>
                                    <p className="text-slate-200">{shipment.carrier || <span className="text-slate-500 italic">Not assigned</span>}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Receiver Details */}
                    <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                        <h4 className="text-lg font-chivo font-bold text-white mb-6 flex items-center gap-2">
                            <User size={18} /> Receiver Information
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
                                <p className="flex items-center gap-2 text-slate-200">
                                    <User size={16} className="text-slate-400" />
                                    {shipment.receiverName || <span className="text-slate-500 italic">Not provided</span>}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                                <p className="flex items-center gap-2 text-slate-200">
                                    <Phone size={16} className="text-slate-400" />
                                    {shipment.receiverPhone || <span className="text-slate-500 italic">Not provided</span>}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Delivery Address</label>
                                <p className="text-slate-200 text-sm leading-relaxed">
                                    {shipment.deliveryAddress ? (
                                        <span className="flex items-start gap-2">
                                            <MapPin size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                            {shipment.deliveryAddress}
                                            {shipment.deliveryCity && <>, {shipment.deliveryCity}</>}
                                            {shipment.deliveryState && <>, {shipment.deliveryState}</>}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 italic">Not provided</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-sm p-6">
                        <h4 className="text-lg font-chivo font-bold text-white mb-6">Timeline & Updates</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700/50">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Confirmed</label>
                                <div className="text-slate-300 text-sm font-mono">
                                    {shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'Pending'}
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700/50">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Dispatch</label>
                                <div className="text-slate-300 text-sm font-mono">
                                    {shipment.estimatedDispatchDate
                                        ? new Date(shipment.estimatedDispatchDate).toLocaleDateString()
                                        : <span className="text-slate-500 italic">Not set</span>
                                    }
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700/50">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Est. Delivery</label>
                                <div className="text-slate-300 text-sm font-mono">
                                    {shipment.estimatedDeliveryDate
                                        ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString()
                                        : <span className="text-slate-500 italic">Not set</span>
                                    }
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700/50">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Actual Delivery</label>
                                <div className="text-slate-300 text-sm font-mono">
                                    {shipment.actualDeliveryDate
                                        ? new Date(shipment.actualDeliveryDate).toLocaleDateString()
                                        : <span className="text-slate-500 italic">Pending</span>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Carrier Tracking */}
                    {shipment.carrierTrackingUrl && (
                        <div className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-sm p-6">
                            <h4 className="text-lg font-chivo font-bold text-white mb-4 flex items-center gap-2">
                                <Truck size={18} /> Carrier Tracking
                            </h4>
                            <a
                                href={shipment.carrierTrackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 hover:underline text-sm break-all"
                            >
                                {shipment.carrierTrackingUrl}
                            </a>
                            <p className="text-xs text-slate-400 mt-2">
                                Click the link above to track your shipment directly with the carrier
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
