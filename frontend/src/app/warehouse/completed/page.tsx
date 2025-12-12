'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { ProductRequest } from '@/types';

export default function WarehouseCompletedPage() {
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const allRequests = await api.getRequests();
                // Filter for completed statuses relevant to warehouse (e.g. passed inspection)
                setRequests(allRequests.filter(r => [
                    'PARTIALLY_BLOCKED',
                    'RESOLVED_PARTIAL',
                    'READY_FOR_ALLOCATION',
                    'ALLOCATED',
                    'IN_TRANSIT',
                    'COMPLETED'
                ].includes(r.status)));
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Completed Tasks</h3>
                    <p className="text-slate-400 text-sm mt-1">History of processed requests</p>
                </div>

                <DataTable
                    data={requests}
                    columns={[
                        {
                            key: 'requestNumber',
                            label: 'Task ID',
                            render: (item) => <span className="font-mono text-slate-500">{item.requestNumber}</span>
                        },
                        {
                            key: 'product',
                            label: 'Product',
                            render: (item) => item.product?.name || '-'
                        },
                        {
                            key: 'quantity',
                            label: 'Qty',
                            render: (item) => <span className="font-mono text-slate-400">{item.quantity}</span>
                        },
                        {
                            key: 'status',
                            label: 'Final Status',
                            render: (item) => <StatusChip status={item.status} size="sm" />
                        },
                        {
                            key: 'date',
                            label: 'Date',
                            render: (item) => item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'
                        }
                    ]}
                    emptyMessage="No completed tasks yet."
                />
            </div>
        </DashboardLayout>
    );
}
