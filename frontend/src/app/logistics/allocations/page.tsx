'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { ProductRequest } from '@/types';

export default function LogisticsAllocationsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const data = await api.getReadyForAllocation();
                setRequests(data);
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    if (loading) {
        return (
            <DashboardLayout userRole="LOGISTICS_PLANNER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading allocations...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Pending Allocations</h3>
                    <p className="text-slate-400 text-sm mt-1">Assign carriers and schedule shipments</p>
                </div>

                <DataTable
                    data={requests}
                    columns={[
                        {
                            key: 'requestNumber',
                            label: 'Request #',
                            render: (item) => (
                                <span className="font-mono text-purple-400 font-medium">{item.requestNumber}</span>
                            ),
                        },
                        {
                            key: 'product',
                            label: 'Product',
                            render: (item) => item.product?.name || '-',
                        },
                        {
                            key: 'quantity',
                            label: 'Quantity',
                            render: (item) => <span className="font-mono">{item.quantity}</span>,
                        },
                        {
                            key: 'destination',
                            label: 'Destination',
                            render: (item) => (
                                <div>
                                    <p className="text-slate-200 text-sm">{item.deliveryCity}, {item.deliveryState}</p>
                                    <p className="text-xs text-slate-500">Requested: {item.requestedDeliveryDate || 'ASAP'}</p>
                                </div>
                            ),
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/logistics/allocate/${item.id}`);
                                    }}
                                    className="btn-primary py-1 px-3 text-xs"
                                >
                                    Allocate
                                </button>
                            ),
                        },
                    ]}
                    onRowClick={(item) => router.push(`/logistics/allocate/${item.id}`)}
                    emptyMessage="No pending allocations. Great job!"
                />
            </div>
        </DashboardLayout>
    );
}
