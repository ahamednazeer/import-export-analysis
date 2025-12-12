'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { ProductRequest, Stock, Supplier, InspectionImage } from '@/types';
import StatusChip from '@/components/StatusChip';
import { ArrowLeft, Warning, CheckCircle, Package, Truck, Storefront } from '@phosphor-icons/react';

export default function ResolveIssuePage() {
    const params = useParams();
    const router = useRouter();
    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [options, setOptions] = useState<{ localOptions: Stock[], importOptions: any[] }>({ localOptions: [], importOptions: [] });
    const [action, setAction] = useState<'replace' | 'import' | 'reject' | 'approve' | null>(null);
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!params.id) return;
            try {
                const [reqData, optionsData] = await Promise.all([
                    api.getRequest(parseInt(params.id as string)),
                    api.getReplacementOptions(parseInt(params.id as string))
                ]);
                setRequest(reqData);
                setOptions(optionsData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id]);

    const handleSubmit = async () => {
        if (!request || !action) return;
        setSubmitting(true);

        try {
            const payload: any = { action, notes };

            if (action === 'replace' && selectedOption) {
                payload.newWarehouseId = selectedOption.warehouseId;
                payload.quantity = request.quantity; // Simplified for demo
                // Ideally we'd need to know specifically which reservation/quantity is blocked
                payload.blockedReservationId = request.reservations?.find(r => r.isBlocked)?.id;
            } else if (action === 'import' && selectedOption) {
                payload.supplierId = selectedOption.supplierId;
                payload.quantity = request.quantity;
            }

            await api.resolveProcurement(request.id, action, payload);
            router.push('/procurement');
        } catch (error: any) {
            alert(error.message || 'Failed to resolve');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading details...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!request) return null;

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER">
            <div className="max-w-4xl mx-auto space-y-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                    <div className="flex justify-between mb-4">
                        <h3 className="text-xl font-bold font-mono text-slate-100">Resolution for {request.requestNumber}</h3>
                        <StatusChip status={request.status} />
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-sm mb-6">
                        <h4 className="text-xs uppercase text-slate-500 font-bold mb-2">Request Summary</h4>
                        <p className="text-slate-300 text-sm">Product: <strong>{request.product?.name}</strong></p>
                        <p className="text-slate-300 text-sm">Quantity: <strong>{request.quantity}</strong></p>
                        <p className="text-slate-300 text-sm mt-2">Notes: <span className="italic">{request.dealerNotes || 'None'}</span></p>
                    </div>

                    {request.status === 'PARTIALLY_BLOCKED' && (
                        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-sm mb-8">
                            <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                                <Warning size={20} /> Issue Detected
                            </h4>
                            <p className="text-slate-300 text-sm mb-4">
                                Some items in this request were marked as <strong>DAMAGED</strong> or <strong>EXPIRED</strong>.
                                A replacement source is required to fulfill the order.
                            </p>

                            <h5 className="text-xs uppercase text-slate-500 font-bold mb-3">Replacement Options</h5>

                            <div className="space-y-3">
                                {options.localOptions.map((opt) => (
                                    <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-sm cursor-pointer transition-all ${selectedOption?.id === opt.id
                                            ? 'bg-blue-900/20 border-blue-500'
                                            : 'bg-slate-900/40 border-slate-700 hover:border-slate-500'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="option"
                                                onChange={() => {
                                                    setSelectedOption(opt);
                                                    setAction('replace');
                                                }}
                                                checked={selectedOption?.id === opt.id}
                                            />
                                            <div>
                                                <p className="font-semibold text-slate-200">Local Warehouse: {opt.warehouse?.city}</p>
                                                <p className="text-xs text-slate-500">Available: {opt.availableQuantity} units</p>
                                            </div>
                                        </div>
                                        <Storefront size={24} className="text-green-400" />
                                    </label>
                                ))}

                                {options.importOptions.map((opt) => (
                                    <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-sm cursor-pointer transition-all ${selectedOption?.id === opt.id
                                            ? 'bg-blue-900/20 border-blue-500'
                                            : 'bg-slate-900/40 border-slate-700 hover:border-slate-500'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="option"
                                                onChange={() => {
                                                    setSelectedOption(opt);
                                                    setAction('import');
                                                }}
                                                checked={selectedOption?.id === opt.id}
                                            />
                                            <div>
                                                <p className="font-semibold text-slate-200">Import: {opt.supplier?.name} ({opt.supplier?.country})</p>
                                                <p className="text-xs text-slate-500">Lead Time: {opt.supplier?.leadTimeDays} days</p>
                                            </div>
                                        </div>
                                        <Truck size={24} className="text-blue-400" />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {request.status === 'AWAITING_PROCUREMENT_APPROVAL' && (
                        <div className="mb-8">
                            <h4 className="text-xs uppercase text-slate-500 font-bold mb-3">Decision</h4>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setAction('approve')}
                                    className={`flex-1 p-4 border rounded-sm text-center transition-all ${action === 'approve' ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <CheckCircle size={24} className="mx-auto mb-2" />
                                    <span className="font-bold">Approve Request</span>
                                </button>
                                <button
                                    onClick={() => setAction('reject')}
                                    className={`flex-1 p-4 border rounded-sm text-center transition-all ${action === 'reject' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <Warning size={24} className="mx-auto mb-2" />
                                    <span className="font-bold">Reject Request</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                            Resolution Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="input-modern h-24 resize-none mb-4"
                            placeholder="Add reasoning for this decision..."
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={!action || submitting}
                            className="btn-primary w-full"
                        >
                            {submitting ? 'Processing...' : 'Confirm Resolution'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
