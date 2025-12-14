'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { ProductRequest, Stock, Supplier, InspectionImage } from '@/types';
import StatusChip from '@/components/StatusChip';
import SourceCompletionStatus from '@/components/SourceCompletionStatus';
import { ArrowLeft, Warning, CheckCircle, Package, Truck, Storefront } from '@phosphor-icons/react';

interface CompletionStatus {
    requestId: number;
    requestStatus: string;
    isComplete: boolean;
    readyCount: number;
    totalCount: number;
    sources: any[];
    summary: string;
}

export default function ResolveIssuePage() {
    const params = useParams();
    const router = useRouter();
    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [options, setOptions] = useState<{ localOptions: Stock[], importOptions: any[] }>({ localOptions: [], importOptions: [] });
    const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
    const [action, setAction] = useState<'replace' | 'import' | 'reject' | 'approve' | 'accept_damage' | 'request_reupload' | 'auto_resolve_blocked' | null>(null);
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

                // Fetch completion status for Joint Wait model
                try {
                    const status = await api.getCompletionStatus(parseInt(params.id as string));
                    setCompletionStatus(status);
                } catch (e) {
                    console.log('Completion status not available');
                }
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
            if (action === 'auto_resolve_blocked') {
                await api.autoResolveBlocked(request.id);
            } else {
                const payload: any = { action, notes };

                // Identify blocked reservation
                const blockedRes = request.reservations?.find((r: any) => r.isBlocked);

                // For replacement, we MUST have a blocked reservation to replace
                if ((action === 'replace' || action === 'import') && !blockedRes) {
                    // Fallback only if no specific block found (unlikely in this flow)
                    console.warn('No blocked reservation found for replacement action');
                }

                if (action === 'replace' && selectedOption) {
                    payload.newWarehouseId = selectedOption.warehouseId;
                    payload.quantity = blockedRes ? blockedRes.quantity : request.quantity;
                    payload.blockedReservationId = blockedRes?.id;
                } else if (action === 'import' && selectedOption) {
                    payload.supplierId = selectedOption.supplierId;
                    payload.quantity = blockedRes ? blockedRes.quantity : request.quantity;
                    payload.blockedReservationId = blockedRes?.id;
                }

                await api.resolveProcurement(request.id, action, payload);
            }
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

                    {/* Source Completion Status - Joint Wait Model */}
                    {completionStatus && (
                        <div className="mb-6">
                            <SourceCompletionStatus completionStatus={completionStatus} />
                        </div>
                    )}

                    {request.status === 'BLOCKED' && (
                        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-sm mb-8">
                            <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                                <Warning size={20} /> Full Damage Detected
                            </h4>
                            <p className="text-slate-300 text-sm mb-4">
                                <strong>All reservations have been blocked due to damage/expiry.</strong>
                                This request will be automatically converted to full import.
                            </p>

                            <button
                                onClick={() => setAction('auto_resolve_blocked')}
                                disabled={submitting}
                                className="btn-primary w-full"
                            >
                                Auto-Approve Full Import
                            </button>
                        </div>
                    )}

                    {(request.status === 'PARTIALLY_BLOCKED' || (request.status !== 'BLOCKED' && request.reservations?.some((r: any) => r.isBlocked))) && (
                        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-sm mb-8">
                            <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                                <Warning size={20} /> Issue Detected
                            </h4>
                            <p className="text-slate-300 text-sm mb-4">
                                Some items in this request were marked as <strong>DAMAGED</strong> or <strong>EXPIRED</strong>.
                                A replacement source is required to fulfill the order.
                            </p>

                            {/* Display correct quantity to replace */}
                            <div className="bg-red-950/40 p-3 rounded mb-6 border border-red-900/50 flex justify-between items-center">
                                <span className="text-red-200 text-sm font-medium">Replacement Required:</span>
                                <span className="text-red-100 font-bold font-mono text-lg">
                                    {request.reservations?.find((r: any) => r.isBlocked)?.quantity || request.quantity} units
                                </span>
                            </div>

                            <h5 className="text-xs uppercase text-slate-500 font-bold mb-3">Replacement Options</h5>

                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Local Warehouses */}
                                    <div>
                                        <h5 className="text-xs uppercase text-slate-500 font-bold mb-3 flex items-center gap-2">
                                            <Storefront size={16} /> Local Options
                                        </h5>
                                        <div className="space-y-3">
                                            {options.localOptions.length > 0 ? options.localOptions.map((opt) => (
                                                <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-sm cursor-pointer transition-all ${selectedOption?.id === opt.id && action === 'replace'
                                                    ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500'
                                                    : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'
                                                    }`}>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="option"
                                                            onChange={() => {
                                                                setSelectedOption(opt);
                                                                setAction('replace');
                                                            }}
                                                            checked={selectedOption?.id === opt.id && action === 'replace'}
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-slate-200">{opt.warehouse?.city}</p>
                                                            <p className="text-xs text-slate-400">
                                                                <span className="text-green-400 font-bold">{opt.availableQuantity}</span> available
                                                                <span className="text-slate-600 mx-1">/</span>
                                                                <span className="text-slate-500">{opt.quantity} total</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </label>
                                            )) : (
                                                <p className="text-slate-500 text-sm italic">No local stock available.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Import Options */}
                                    <div>
                                        <h5 className="text-xs uppercase text-slate-500 font-bold mb-3 flex items-center gap-2">
                                            <Truck size={16} /> Import Options
                                        </h5>
                                        <div className="space-y-3">
                                            {options.importOptions.length > 0 ? options.importOptions.map((opt) => (
                                                <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-sm cursor-pointer transition-all ${selectedOption?.id === opt.id && action === 'import'
                                                    ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500'
                                                    : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'
                                                    }`}>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="option"
                                                            onChange={() => {
                                                                setSelectedOption(opt);
                                                                setAction('import');
                                                            }}
                                                            checked={selectedOption?.id === opt.id && action === 'import'}
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-slate-200">{opt.supplier?.name}</p>
                                                            <p className="text-xs text-slate-400">
                                                                {opt.supplier?.country} • {opt.supplier?.leadTimeDays} days
                                                            </p>
                                                        </div>
                                                    </div>
                                                </label>
                                            )) : (
                                                <p className="text-slate-500 text-sm italic">No import options available.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Accept Damage / Request Re-upload buttons */}
                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={() => setAction('accept_damage')}
                                        className={`flex-1 py-2 px-3 text-sm border rounded-sm transition-all ${action === 'accept_damage'
                                            ? 'bg-yellow-900/30 border-yellow-600 text-yellow-400'
                                            : 'bg-slate-800/40 border-slate-600 text-slate-400 hover:border-slate-500'
                                            }`}
                                    >
                                        Accept As-Is
                                    </button>
                                    <button
                                        onClick={() => setAction('request_reupload')}
                                        className={`flex-1 py-2 px-3 text-sm border rounded-sm transition-all ${action === 'request_reupload'
                                            ? 'bg-blue-900/30 border-blue-600 text-blue-400'
                                            : 'bg-slate-800/40 border-slate-600 text-slate-400 hover:border-slate-500'
                                            }`}
                                    >
                                        Request Re-upload
                                    </button>
                                </div>
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
