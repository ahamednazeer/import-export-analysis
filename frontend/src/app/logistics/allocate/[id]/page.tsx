'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { ProductRequest } from '@/types';
import { ArrowLeft, Truck, Package, Warehouse, AirplaneTilt, ArrowRight } from '@phosphor-icons/react';

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
            // Create separate shipments for each reservation (local + import)
            const allocations = request.reservations?.map(reservation => ({
                quantity: reservation.quantity,
                carrier: carrier,
                estimatedDeliveryDate: estimatedDelivery,
                warehouseId: reservation.warehouseId,
                supplierId: reservation.supplierId,
                reservationId: reservation.id
            })) || [];

            if (allocations.length === 0) {
                alert('No reservations found for allocation');
                return;
            }

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

    // Filter active reservations that will be turned into shipments
    const activeReservations = request.reservations?.filter(r => !r.isBlocked) || [];
    const totalQuantity = activeReservations.reduce((sum, r) => sum + r.quantity, 0);

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="max-w-4xl mx-auto space-y-6">
                <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm flex items-center gap-2">
                    <ArrowLeft /> Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Source Breakdown */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                            <h3 className="text-xl font-bold font-mono text-slate-100 mb-2">
                                Request <span className="text-purple-400">{request.requestNumber}</span>
                            </h3>
                            <p className="text-slate-400 text-sm mb-6">
                                {request.product?.name} • Total Qty: {request.quantity}
                            </p>

                            <h4 className="text-xs uppercase text-slate-500 font-bold mb-4 tracking-wider">
                                Source Breakdown (Shipment Plan)
                            </h4>

                            <div className="space-y-3">
                                {activeReservations.map((res) => (
                                    <div key={res.id} className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-sm flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${res.warehouseId ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-400'
                                                }`}>
                                                {res.warehouseId ? <Warehouse size={20} /> : <AirplaneTilt size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-slate-200 font-medium">
                                                    {res.warehouse ? res.warehouse.name : res.supplier ? res.supplier.name : 'Unknown Source'}
                                                </p>
                                                <p className="text-xs text-slate-500 font-mono uppercase">
                                                    {res.warehouseId ? 'Local Warehouse' : 'Import Supplier'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-2xl font-mono text-white">{res.quantity}</p>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Units</p>
                                            </div>
                                            <ArrowRight className="text-slate-600" />
                                            <div className="text-right w-24">
                                                <p className="text-xs text-slate-400">Shipment #{res.id}</p>
                                                <p className="text-[10px] text-purple-400 uppercase tracking-wider">Pending</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-sm text-xs text-blue-300 flex items-start gap-2">
                                <Truck size={16} className="shrink-0 mt-0.5" />
                                <p>
                                    This will generate <strong>{activeReservations.length} separate shipments</strong>.
                                    Each source handles dispatch independently.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Allocation Controls */}
                    <div className="space-y-4">
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6 sticky top-6">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Truck size={18} className="text-purple-400" />
                                Allocation Details
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">Carrier Service</label>
                                    <select
                                        className="input-modern w-full"
                                        value={carrier}
                                        onChange={(e) => setCarrier(e.target.value)}
                                    >
                                        <option value="">Select Carrier</option>
                                        <option value="DHL">DHL Express</option>
                                        <option value="FedEx">FedEx Logistics</option>
                                        <option value="BlueDart">BlueDart</option>
                                        <option value="Maersk">Maersk Line</option>
                                        <option value="Delhivery">Delhivery</option>
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1">Applied to all {activeReservations.length} shipments</p>
                                </div>

                                <div>
                                    <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">Est. Delivery Date</label>
                                    <input
                                        type="date"
                                        className="input-modern cursor-pointer w-full"
                                        value={estimatedDelivery}
                                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                                        onClick={(e) => e.currentTarget.showPicker()}
                                    />
                                </div>

                                <div className="border-t border-slate-700 my-4 pt-4">
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-slate-400">Total Units</span>
                                        <span className="text-white font-mono">{totalQuantity}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-slate-400">Shipments</span>
                                        <span className="text-white font-mono">{activeReservations.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Destination</span>
                                        <span className="text-white text-right truncate w-32">{request.deliveryCity}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAllocate}
                                    disabled={!carrier || !estimatedDelivery || submitting}
                                    className="btn-primary w-full flex justify-center items-center gap-2 py-3"
                                >
                                    <Package size={18} weight="bold" />
                                    {submitting ? 'Allocating...' : 'Confirm Allocation'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
