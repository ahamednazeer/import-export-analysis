'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCard from '@/components/DashboardCard';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { ClipboardText, Upload, CheckCircle, Warning } from '@phosphor-icons/react';
import { ProductRequest } from '@/types';
import { useRouter } from 'next/navigation';

export default function WarehouseDashboard() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({ firstName: 'Operator', email: 'wh@example.com' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [requestsData, userData] = await Promise.all([
                    api.getRequests(),
                    api.getCurrentUser().catch(() => null),
                ]);
                setRequests(requestsData);
                if (userData) setUser(userData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const pickingCount = requests.filter(r => r.status === 'RESERVED' || r.status === 'PICKING').length;
    const inspectionCount = requests.filter(r => r.status === 'INSPECTION_PENDING').length;
    const blockedCount = requests.filter(r => r.status === 'PARTIALLY_BLOCKED').length;

    if (loading) {
        return (
            <DashboardLayout userRole="WAREHOUSE_OPERATOR" userName={user.firstName} userEmail={user.email}>
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading dashboard...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR" userName={user.firstName} userEmail={user.email}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">Warehouse Dashboard</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DashboardCard
                            title="Pick Tasks"
                            value={pickingCount}
                            icon={<ClipboardText size={24} weight="duotone" />}
                            variant="warehouse"
                        />
                        <DashboardCard
                            title="Pending Upload"
                            value={inspectionCount}
                            icon={<Upload size={24} weight="duotone" />}
                            variant="warehouse"
                        />
                        <DashboardCard
                            title="Issues Detected"
                            value={blockedCount}
                            icon={<Warning size={24} weight="duotone" />}
                            variant="warehouse"
                        />
                        <DashboardCard
                            title="Completed Today"
                            value={0}
                            icon={<CheckCircle size={24} weight="duotone" />}
                            variant="warehouse"
                        />
                    </div>
                </div>

                <div>
                    <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Tasks Requiring Action</h4>

                    <DataTable
                        data={requests.filter(r => ['RESERVED', 'PICKING', 'INSPECTION_PENDING'].includes(r.status))}
                        columns={[
                            {
                                key: 'requestNumber',
                                label: 'Request #',
                                render: (item) => (
                                    <span className="font-mono text-green-400">{item.requestNumber}</span>
                                ),
                            },
                            {
                                key: 'product',
                                label: 'Product',
                                render: (item) => item.product?.name || '-',
                            },
                            {
                                key: 'quantity',
                                label: 'Qty',
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (item) => <StatusChip status={item.status} size="sm" />,
                            },
                            {
                                key: 'action',
                                label: 'Action',
                                render: (item) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.status === 'RESERVED') {
                                                api.startPicking(item.id).then(() => window.location.reload());
                                            } else {
                                                router.push(`/warehouse/upload?requestId=${item.id}`);
                                            }
                                        }}
                                        className="text-xs btn-primary py-1 px-2"
                                    >
                                        {item.status === 'RESERVED' ? 'Start Pick' : 'Upload Image'}
                                    </button>
                                ),
                            },
                        ]}
                        emptyMessage="No tasks pending"
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
