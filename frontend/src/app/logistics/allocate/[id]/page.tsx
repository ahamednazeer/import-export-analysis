'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { ProductRequest } from '@/types';
import { ArrowLeft, Truck, Package } from '@phosphor-icons/react';

export default function AllocateShipmentPage() {
    const params = useParams();
    const router = useRouter();
    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [carrier, setCarrier] = useState('');
    const [estimatedDelivery, setEstimatedDelivery] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchRequest = async () => {
            if (!params.id) return;
            try {
                const data = await api.getRequest(parseInt(params.id as string));
                setRequest(data);
            } catch (error) {
                console.error('Failed to fetch request:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequest();
    }, [params.id]);

    const handleAllocate = async () => {
        if (!request) return;
        setSubmitting(true);
        try {
            // Simplified allocation logic: creating one shipment for the whole request
            // In a real app we would map reservations to multiple allocations
            const allocations = [{
                quantity: request.quantity,
                carrier: carrier,
                estimatedDeliveryDate: estimatedDelivery,
                // Assuming first reservation details for simplicity
                warehouseId: request.reservations?.[0]?.warehouseId,
                supplierId: request.reservations?.[0]?.supplierId,
                reservationId: request.reservations?.[0]?.id
            }];

            await api.allocateShipments(request.id, allocations);
            router.push('/logistics');
        } catch (error: any) {
            alert(error.message || 'Allocation failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="LOGISTICS_PLANNER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!request) return null;

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="max-w-2xl mx-auto space-y-6">
                <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm flex items-center gap-2">
                    <ArrowLeft /> Back
                </button>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                    <h3 className="text-xl font-bold font-mono text-slate-100 mb-6">Allocate Shipment for {request.requestNumber}</h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">Carrier</label>
                                <select
                                    className="input-modern"
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                >
                                    <option value="">Select Carrier</option>
                                    <option value="DHL">DHL Express</option>
                                    <option value="FedEx">FedEx Logistics</option>
                                    <option value="BlueDart">BlueDart</option>
                                    <option value="Maersk">Maersk Line</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">Est. Delivery Date</label>
                                <input
                                    type="date"
                                    className="input-modern cursor-pointer"
                                    value={estimatedDelivery}
                                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                                    onClick={(e) => e.currentTarget.showPicker()}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-sm mt-4">
                            <h4 className="text-xs uppercase text-slate-500 font-bold mb-2 flex items-center gap-2">
                                <Package size={16} /> Shipment Summary
                            </h4>
                            <div className="flex justify-between items-center text-sm text-slate-300">
                                <span>Total Quantity</span>
                                <span className="font-mono text-white">{request.quantity}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-300 mt-2">
                                <span>Destination</span>
                                <span className="text-white">{request.deliveryCity}, {request.deliveryState}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleAllocate}
                            disabled={!carrier || !estimatedDelivery || submitting}
                            className="btn-primary w-full mt-4 flex justify-center items-center gap-2"
                        >
                            <Truck size={18} />
                            {submitting ? 'Allocating...' : 'Confirm Allocation'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
