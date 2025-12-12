'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { useRouter } from 'next/navigation';
import { ProductRequest } from '@/types';
import { CheckCircle, Truck, Package, Clock } from '@phosphor-icons/react';

export default function DealerRequestsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');

    useEffect(() => {
        const fetchRequests = async () => {
            try {
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

    const filteredRequests = statusFilter === 'ALL'
        ? requests
        : requests.filter(r => r.status === statusFilter);

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading requests...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">My Requests</h3>
                        <p className="text-slate-400 text-sm mt-1">Manage and track your product requests</p>
                    </div>
                    <button
                        onClick={() => router.push('/dealer/new-request')}
                        className="btn-primary"
                    >
                        + New Request
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[
                        { label: 'All', value: 'ALL' },
                        { label: 'Pending', value: 'PENDING' },
                        { label: 'Reserved', value: 'RESERVED' },
                        { label: 'In Transit', value: 'IN_TRANSIT' },
                        { label: 'Completed', value: 'COMPLETED' },
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`px-4 py-2 rounded-full text-xs font-medium uppercase tracking-wide transition-colors whitespace-nowrap ${statusFilter === filter.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <DataTable
                    data={filteredRequests}
                    columns={[
                        {
                            key: 'requestNumber',
                            label: 'Request #',
                            render: (item) => (
                                <div className="flex flex-col">
                                    <span className="font-mono text-blue-400 font-medium">{item.requestNumber}</span>
                                    <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>
                            ),
                        },
                        {
                            key: 'product',
                            label: 'Product Details',
                            render: (item) => (
                                <div>
                                    <p className="text-slate-200">{item.product?.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">SKU: {item.product?.sku}</p>
                                </div>
                            ),
                        },
                        {
                            key: 'quantity',
                            label: 'Qty',
                            render: (item) => (
                                <span className="font-mono text-slate-300">{item.quantity} units</span>
                            ),
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (item) => <StatusChip status={item.status} size="sm" />,
                        },
                        {
                            key: 'delivery',
                            label: 'Delivery',
                            render: (item) => (
                                <div className="text-xs">
                                    <p className="text-slate-400">{item.deliveryCity}</p>
                                    <p className="text-slate-600">
                                        ETA: {item.estimatedDeliveryDate ? new Date(item.estimatedDeliveryDate).toLocaleDateString() : '-'}
                                    </p>
                                </div>
                            ),
                        },
                    ]}
                    onRowClick={(item) => router.push(`/dealer/requests/${item.id}`)}
                    emptyMessage="No requests found matching your filter."
                />
            </div>
        </DashboardLayout>
    );
}
