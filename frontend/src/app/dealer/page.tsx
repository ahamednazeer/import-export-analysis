'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCard from '@/components/DashboardCard';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { ShoppingCart, Package, Truck, CheckCircle } from '@phosphor-icons/react';
import { ProductRequest } from '@/types';
import { useRouter } from 'next/navigation';

export default function DealerDashboard() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({ firstName: 'Dealer', email: 'dealer@example.com' });

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

    const pendingCount = requests.filter(r => ['PENDING', 'AWAITING_RECOMMENDATION', 'AWAITING_PROCUREMENT_APPROVAL'].includes(r.status)).length;
    const activeCount = requests.filter(r => ['RESERVED', 'PICKING', 'INSPECTION_PENDING', 'ALLOCATED', 'IN_TRANSIT'].includes(r.status)).length;
    const completedCount = requests.filter(r => r.status === 'COMPLETED').length;

    const recentRequests = requests.slice(0, 5);

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER" userName={user.firstName} userEmail={user.email}>
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading dashboard...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER" userName={user.firstName} userEmail={user.email}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">Dealer Dashboard</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DashboardCard
                            title="Total Requests"
                            value={requests.length}
                            icon={<ShoppingCart size={24} weight="duotone" />}
                            variant="dealer"
                        />
                        <DashboardCard
                            title="Pending"
                            value={pendingCount}
                            icon={<Package size={24} weight="duotone" />}
                            variant="dealer"
                        />
                        <DashboardCard
                            title="In Progress"
                            value={activeCount}
                            icon={<Truck size={24} weight="duotone" />}
                            variant="dealer"
                        />
                        <DashboardCard
                            title="Completed"
                            value={completedCount}
                            icon={<CheckCircle size={24} weight="duotone" />}
                            variant="dealer"
                        />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono">Recent Requests</h4>
                        <button
                            onClick={() => router.push('/dealer/new-request')}
                            className="btn-primary text-xs"
                        >
                            + New Request
                        </button>
                    </div>

                    <DataTable
                        data={recentRequests}
                        columns={[
                            {
                                key: 'requestNumber',
                                label: 'Request #',
                                render: (item) => (
                                    <span className="font-mono text-blue-400">{item.requestNumber}</span>
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
                                key: 'createdAt',
                                label: 'Date',
                                render: (item) => new Date(item.createdAt).toLocaleDateString(),
                            },
                        ]}
                        onRowClick={(item) => router.push(`/dealer/requests/${item.id}`)}
                        emptyMessage="No requests yet. Create your first request!"
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
