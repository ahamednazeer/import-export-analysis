'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { useRouter } from 'next/navigation';
import { ProductRequest } from '@/types';
import { Warning, CheckCircle, Package } from '@phosphor-icons/react';

export default function ProcurementPendingPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const data = await api.getPendingProcurement();
                setRequests(data);
            } catch (error) {
                console.error('Failed to fetch pending requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const allPendingRequests = requests.filter(r =>
        r.status === 'AWAITING_PROCUREMENT_APPROVAL' ||
        r.status === 'PARTIALLY_BLOCKED' ||
        r.status === 'BLOCKED'
    );

    const approvalRequired = requests.filter(r => r.status === 'AWAITING_PROCUREMENT_APPROVAL');
    const issuesToResolve = requests.filter(r =>
        r.status === 'PARTIALLY_BLOCKED' ||
        r.status === 'BLOCKED' ||
        r.reservations?.some((res: any) => res.isBlocked)
    );

    if (loading) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading pending approvals...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Pending Approvals</h3>
                    <p className="text-slate-400 text-sm mt-1">Review and approve sourcing requests</p>
                </div>

                {approvalRequired.length > 0 ? (
                    <div className="bg-yellow-950/20 border border-yellow-800/30 p-4 rounded-sm flex items-start gap-3">
                        <Warning className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-yellow-400 font-medium">Action Required</p>
                            <p className="text-slate-400 text-sm">{approvalRequired.length} requests are waiting for your approval before they can proceed to reservation.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-green-950/20 border border-green-800/30 p-4 rounded-sm flex items-start gap-3">
                        <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-green-400 font-medium">All Caught Up</p>
                            <p className="text-slate-400 text-sm">There are no new requests requiring approval at this time.</p>
                        </div>
                    </div>
                )}

                {/* Approval Required Section */}
                {approvalRequired.length > 0 && (
                    <div>
                        <h4 className="text-lg font-semibold text-slate-200 mb-4">Requests Requiring Approval</h4>
                        <DataTable
                            data={approvalRequired}
                            columns={[
                                {
                                    key: 'requestNumber',
                                    label: 'Request #',
                                    render: (item) => (
                                        <span className="font-mono text-blue-400 font-medium">{item.requestNumber}</span>
                                    ),
                                },
                                {
                                    key: 'product',
                                    label: 'Product',
                                    render: (item) => (
                                        <div>
                                            <p className="text-slate-200">{item.product?.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">Qty: {item.quantity}</p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'recommendation',
                                    label: 'Recommendation',
                                    render: (item) => (
                                        <div className="max-w-xs">
                                            <p className={`text-xs font-semibold uppercase mb-1 ${item.recommendedSource === 'LOCAL' ? 'text-green-400' :
                                                item.recommendedSource === 'IMPORT' ? 'text-blue-400' : 'text-yellow-400'
                                                }`}>
                                                {item.recommendedSource}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{item.recommendationExplanation}</p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'dealer',
                                    label: 'Dealer',
                                    render: (item) => (
                                        <span className="text-slate-300 text-sm">{item.dealer?.username}</span>
                                    ),
                                },
                                {
                                    key: 'action',
                                    label: 'Action',
                                    render: (item) => (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/procurement/resolve/${item.id}`);
                                            }}
                                            className="btn-primary py-1 px-3 text-xs"
                                        >
                                            Review
                                        </button>
                                    ),
                                },
                            ]}
                            onRowClick={(item) => router.push(`/procurement/resolve/${item.id}`)}
                        />
                    </div>
                )}

                {/* Issues to Resolve Section */}
                {issuesToResolve.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Warning className="text-red-400" size={20} />
                            <h4 className="text-lg font-semibold text-slate-200">Issues Requiring Resolution</h4>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            These requests have inspection issues that need your attention.
                        </p>
                        <DataTable
                            data={issuesToResolve}
                            columns={[
                                {
                                    key: 'requestNumber',
                                    label: 'Request #',
                                    render: (item) => (
                                        <span className="font-mono text-red-400 font-medium">{item.requestNumber}</span>
                                    ),
                                },
                                {
                                    key: 'product',
                                    label: 'Product',
                                    render: (item) => (
                                        <div>
                                            <p className="text-slate-200">{item.product?.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">Qty: {item.quantity}</p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'status',
                                    label: 'Issue Type',
                                    render: (item) => (
                                        <StatusChip status={item.status} size="sm" />
                                    ),
                                },
                                {
                                    key: 'dealer',
                                    label: 'Dealer',
                                    render: (item) => (
                                        <span className="text-slate-300 text-sm">{item.dealer?.username}</span>
                                    ),
                                },
                                {
                                    key: 'action',
                                    label: 'Action',
                                    render: (item) => (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/procurement/resolve/${item.id}`);
                                            }}
                                            className="btn-primary py-1 px-3 text-xs"
                                        >
                                            Resolve
                                        </button>
                                    ),
                                },
                            ]}
                            onRowClick={(item) => router.push(`/procurement/resolve/${item.id}`)}
                        />
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
