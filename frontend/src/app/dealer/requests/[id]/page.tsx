'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { ProductRequest } from '@/types';
import StatusChip from '@/components/StatusChip';
import { useParams, useRouter } from 'next/navigation';
import { Package, MapPin, Calendar, ClipboardText, ArrowLeft, Truck, Warehouse, CheckCircle, Clock } from '@phosphor-icons/react';

export default function RequestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async (action: 'confirm' | 'send_to_procurement' | 'cancel') => {
        if (!request) return;
        setSubmitting(true);

        try {
            const updatedRequest = await api.confirmRequest(request.id, action);
            setRequest(updatedRequest);

            // If confirmed, maybe show success message or just update UI
            if (action === 'confirm') {
                alert('Request confirmed successfully!');
            }
        } catch (error: any) {
            alert(error.message || 'Failed to update request');
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const fetchRequest = async () => {
            try {
                if (params.id) {
                    const data = await api.getRequest(parseInt(params.id as string));
                    console.log('Fetched request data:', data);
                    console.log('Reservations:', data.reservations);
                    if (data.reservations) {
                        data.reservations.forEach((res: any, index: number) => {
                            console.log(`Reservation ${index}:`, res);
                            console.log(`  Has warehouse:`, !!res.warehouse);
                            console.log(`  Has supplier:`, !!res.supplier);
                        });
                    }
                    setRequest(data);
                }
            } catch (error) {
                console.error('Failed to fetch request:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequest();
    }, [params.id]);

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading details...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!request) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="text-center py-12">
                    <p className="text-slate-400">Request not found.</p>
                    <button onClick={() => router.back()} className="mt-4 btn-secondary">Go Back</button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER">
            <div className="max-w-4xl mx-auto space-y-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm"
                >
                    <ArrowLeft size={16} /> Back to Requests
                </button>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-700/50">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-2xl font-mono font-bold text-blue-400">{request.requestNumber}</h3>
                                <StatusChip status={request.status} />
                            </div>
                            <p className="text-slate-400 text-sm">Created on {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString()}</p>
                        </div>
                        {request.recommendedSource && (
                            <div className="text-right">
                                <p className="text-xs uppercase text-slate-500 font-mono mb-1">Sourcing Type</p>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase ${request.recommendedSource === 'LOCAL' ? 'bg-green-950 text-green-400 border border-green-900' :
                                    request.recommendedSource === 'IMPORT' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                                        'bg-yellow-950 text-yellow-400 border border-yellow-900'
                                    }`}>
                                    {request.recommendedSource === 'LOCAL' ? <Warehouse size={14} /> :
                                        request.recommendedSource === 'IMPORT' ? <Truck size={14} /> : <Package size={14} />}
                                    {request.recommendedSource}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                                <Package size={16} /> Product Information
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">Product Name</span>
                                    <span className="text-slate-200 font-medium">{request.product?.name}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">SKU</span>
                                    <span className="text-slate-200 font-mono">{request.product?.sku}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">Quantity</span>
                                    <span className="text-slate-200">{request.quantity} units</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">Unit Price</span>
                                    <span className="text-slate-200">{request.product?.currency} {request.product?.unitPrice}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                                <MapPin size={16} /> Delivery Details
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">Location</span>
                                    <span className="text-slate-200 text-right">{request.deliveryLocation}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">City/State</span>
                                    <span className="text-slate-200">{request.deliveryCity}, {request.deliveryState}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-800/50">
                                    <span className="text-slate-500 text-sm">Requested Date</span>
                                    <span className="text-slate-200 font-mono">
                                        {request.requestedDeliveryDate ? new Date(request.requestedDeliveryDate).toLocaleDateString() : 'ASAP'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {request.dealerNotes && (
                        <div className="mt-8">
                            <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                                <ClipboardText size={16} /> Notes
                            </h4>
                            <div className="bg-slate-900/50 p-4 rounded-sm text-slate-300 text-sm">
                                {request.dealerNotes}
                            </div>
                        </div>
                    )}

                    {request.recommendationExplanation && (
                        <div className="mt-8">
                            <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                                <ClipboardText size={16} /> Sourcing Plan
                            </h4>
                            <div className="bg-slate-900/50 p-4 rounded-sm text-slate-300 text-sm border-l-2 border-blue-500">
                                {request.recommendationExplanation}
                            </div>
                        </div>
                    )}

                    {request.reservations && request.reservations.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                                <Warehouse size={16} /> Reserved Sources
                            </h4>
                            <div className="space-y-4">
                                {request.reservations.filter(r => r.quantity > 0).map((reservation, index) => (
                                    <div key={reservation.id} className="bg-slate-900/50 p-4 rounded-sm border border-slate-700/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {reservation.warehouse ? (
                                                    <>
                                                        <Warehouse size={18} className="text-blue-400" />
                                                        <div>
                                                            <p className="text-slate-200 font-medium">{reservation.warehouse.name}</p>
                                                            <p className="text-slate-400 text-xs">{reservation.warehouse.city}, {reservation.warehouse.country}</p>
                                                        </div>
                                                    </>
                                                ) : reservation.supplier ? (
                                                    <>
                                                        <Truck size={18} className="text-green-400" />
                                                        <div>
                                                            <p className="text-slate-200 font-medium">{reservation.supplier.name}</p>
                                                            <p className="text-slate-400 text-xs">{reservation.supplier.city}, {reservation.supplier.country}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <p className="text-slate-400 text-sm">Unknown source (ID: {reservation.warehouseId || reservation.supplierId})</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-200 font-mono">{reservation.quantity} units</p>
                                                <p className="text-slate-400 text-xs">
                                                    {reservation.isLocal ? 'Local' : 'Import'}
                                                    {reservation.isBlocked && (
                                                        <span className="text-red-400 ml-2">• Blocked</span>
                                                    )}
                                                </p>

                                                <div className="flex justify-end gap-2 mt-2">
                                                    {/* Status Badges */}
                                                    {reservation.isPicked && (
                                                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full border border-green-900/40">
                                                            <CheckCircle size={12} weight="fill" /> Picked
                                                        </span>
                                                    )}

                                                    {reservation.aiConfirmed && (
                                                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-900/40">
                                                            <CheckCircle size={12} weight="fill" /> AI Checked
                                                        </span>
                                                    )}

                                                    {reservation.reservationStatus === 'READY' && (
                                                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/40">
                                                            <CheckCircle size={12} weight="fill" /> Ready
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {reservation.isBlocked && reservation.blockReason && (
                                            <div className="mt-2 p-2 bg-red-950/50 border border-red-900/50 rounded text-red-300 text-xs">
                                                Blocked: {reservation.blockReason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {request.status === 'AWAITING_RECOMMENDATION' && (
                        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-slate-700/50">
                            <button
                                onClick={() => handleConfirm('confirm')}
                                disabled={submitting}
                                className="btn-primary"
                            >
                                {submitting ? 'Processing...' : 'Confirm & Proceed'}
                            </button>
                            <button
                                onClick={() => handleConfirm('send_to_procurement')}
                                disabled={submitting}
                                className="btn-secondary"
                            >
                                Send to Procurement Review
                            </button>
                            <button
                                onClick={() => handleConfirm('cancel')}
                                disabled={submitting}
                                className="btn-danger"
                            >
                                Cancel Request
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
