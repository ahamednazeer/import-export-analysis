'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { useRouter } from 'next/navigation';
import { ProductRequest } from '@/types';

export default function WarehousePickTasksPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                // Filter for tasks relevant to warehouse ops
                const data = await api.getRequests('RESERVED'); // Fetch reserved items ready for picking
                // Note: API filtering might need enhancement to support multiple statuses OR filter client side
                // Fetching all for now and filtering locally for demo
                const allRequests = await api.getRequests();
                setRequests(allRequests.filter(r => ['RESERVED', 'PICKING'].includes(r.status)));
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const handleStartPicking = async (id: number) => {
        try {
            await api.startPicking(id);
            // Refresh local state
            setRequests(requests.map(r => r.id === id ? { ...r, status: 'PICKING' } : r));
        } catch (error) {
            console.error('Failed to start picking:', error);
        }
    };

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Pick Tasks</h3>
                    <p className="text-slate-400 text-sm mt-1">Items ready for picking and inspection</p>
                </div>

                <DataTable
                    data={requests}
                    columns={[
                        {
                            key: 'requestNumber',
                            label: 'Task ID',
                            render: (item) => <span className="font-mono text-green-400">{item.requestNumber}</span>
                        },
                        {
                            key: 'product',
                            label: 'Product',
                            render: (item) => (
                                <div>
                                    <p className="text-slate-200">{item.product?.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">Loc: {item.reservations?.[0]?.warehouseId ? 'Zone A-12' : 'Pending'}</p>
                                </div>
                            )
                        },
                        {
                            key: 'quantity',
                            label: 'Qty',
                            render: (item) => <span className="font-mono text-slate-300">{item.quantity}</span>
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (item) => <StatusChip status={item.status} size="sm" />
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (item.status === 'RESERVED') {
                                            handleStartPicking(item.id);
                                        } else {
                                            router.push(`/warehouse/upload?requestId=${item.id}`);
                                        }
                                    }}
                                    className={`py-1 px-3 text-xs rounded-sm transition-colors uppercase font-bold tracking-wide ${item.status === 'RESERVED'
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                        }`}
                                >
                                    {item.status === 'RESERVED' ? 'Start Pick' : 'Inspect'}
                                </button>
                            ),
                        },
                    ]}
                    emptyMessage="No active pick tasks."
                />
            </div>
        </DashboardLayout>
    );
}
