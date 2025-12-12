'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { Storefront, Truck } from '@phosphor-icons/react';
import { ProductRequest } from '@/types';

export default function ProcurementResolvedPage() {
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                // In a real app, this would be a filtered history endpoint
                // For now, fetching general request list and filtering client side
                const data = await api.getRequests();
                setRequests(data);
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const resolvedRequests = requests.filter(r =>
        r.status === 'RESOLVED_PARTIAL' ||
        r.status === 'READY_FOR_ALLOCATION' ||
        r.status === 'ALLOCATED'
    );

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Resolved History</h3>
                    <p className="text-slate-400 text-sm mt-1">Recently resolved issues and approvals</p>
                </div>

                <DataTable
                    data={resolvedRequests}
                    columns={[
                        {
                            key: 'requestNumber',
                            label: 'Request #',
                            render: (item) => (
                                <span className="font-mono text-purple-400">{item.requestNumber}</span>
                            ),
                        },
                        {
                            key: 'product',
                            label: 'Product',
                            render: (item) => item.product?.name || '-',
                        },
                        {
                            key: 'status',
                            label: 'Current Status',
                            render: (item) => <StatusChip status={item.status} size="sm" />,
                        },
                        {
                            key: 'action_taken',
                            label: 'Action Taken',
                            render: (item) => {
                                // Check reservations to see what happened
                                const replacementRes = item.reservations?.find(r => r.isReplacement);
                                const importRes = item.reservations?.find(r => !r.isLocal);

                                if (replacementRes) {
                                    return (
                                        <div className="flex flex-col">
                                            <span className="text-blue-400 font-bold text-xs uppercase flex items-center gap-1">
                                                <Storefront size={12} weight="fill" /> Local Replacement
                                            </span>
                                            <span className="text-slate-400 text-xs">
                                                {replacementRes.warehouse?.city} ({replacementRes.quantity} units)
                                            </span>
                                        </div>
                                    );
                                } else if (importRes) {
                                    return (
                                        <div className="flex flex-col">
                                            <span className="text-purple-400 font-bold text-xs uppercase flex items-center gap-1">
                                                <Truck size={12} weight="fill" /> Import
                                            </span>
                                            <span className="text-slate-400 text-xs">
                                                {importRes.supplier?.name} ({importRes.quantity} units)
                                            </span>
                                        </div>
                                    );
                                } else if (item.procurementNotes?.includes('Damage accepted')) {
                                    return (
                                        <span className="text-slate-400 text-xs italic">Damage Accepted</span>
                                    );
                                }

                                return <span className="text-slate-500 text-xs">-</span>;
                            },
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => {
                                if (item.status === 'RESOLVED_PARTIAL') {
                                    return (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm('Mark this request as ready for logistics allocation?')) {
                                                    try {
                                                        await api.markReadyForAllocation(item.id);
                                                        // Refresh list
                                                        const data = await api.getRequests();
                                                        setRequests(data);
                                                    } catch (err) {
                                                        alert('Failed to update status');
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-sm transition-colors"
                                        >
                                            Send to Logistics
                                        </button>
                                    );
                                }
                                return null;
                            }
                        },
                        {
                            key: 'date',
                            label: 'Date',
                            render: (item) => item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-',
                        },
                    ]}
                    emptyMessage="No resolved requests history found."
                />
            </div>
        </DashboardLayout>
    );
}
