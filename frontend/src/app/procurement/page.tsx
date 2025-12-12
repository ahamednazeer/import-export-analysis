'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCard from '@/components/DashboardCard';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { Warning, CheckCircle, ClipboardText, ArrowsClockwise } from '@phosphor-icons/react';
import { ProductRequest } from '@/types';
import { useRouter } from 'next/navigation';

export default function ProcurementDashboard() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({ firstName: 'Manager', email: 'procurement@example.com' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [requestsData, userData] = await Promise.all([
                    api.getPendingProcurement(),
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

    const pendingApproval = requests.filter(r => r.status === 'AWAITING_PROCUREMENT_APPROVAL').length;
    const blockedCount = requests.filter(r => r.status === 'PARTIALLY_BLOCKED').length;

    if (loading) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER" userName={user.firstName} userEmail={user.email}>
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading dashboard...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER" userName={user.firstName} userEmail={user.email}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">Procurement Dashboard</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DashboardCard
                            title="Pending Approval"
                            value={pendingApproval}
                            icon={<ClipboardText size={24} weight="duotone" />}
                            variant="procurement"
                        />
                        <DashboardCard
                            title="Issues to Resolve"
                            value={blockedCount}
                            icon={<Warning size={24} weight="duotone" />}
                            variant="procurement"
                        />
                        <DashboardCard
                            title="Resolved Today"
                            value={0}
                            icon={<CheckCircle size={24} weight="duotone" />}
                            variant="procurement"
                        />
                        <DashboardCard
                            title="Import Approvals"
                            value={0}
                            icon={<ArrowsClockwise size={24} weight="duotone" />}
                            variant="procurement"
                        />
                    </div>
                </div>

                <div>
                    <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Items Requiring Decision</h4>

                    <DataTable
                        data={requests}
                        columns={[
                            {
                                key: 'requestNumber',
                                label: 'Request #',
                                render: (item) => (
                                    <span className="font-mono text-yellow-400">{item.requestNumber}</span>
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
                                key: 'recommendedSource',
                                label: 'Source',
                                render: (item) => (
                                    <span className={`text-xs font-mono ${item.recommendedSource === 'LOCAL' ? 'text-green-400' :
                                            item.recommendedSource === 'IMPORT' ? 'text-blue-400' : 'text-yellow-400'
                                        }`}>
                                        {item.recommendedSource || '-'}
                                    </span>
                                ),
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
                                            router.push(`/procurement/resolve/${item.id}`);
                                        }}
                                        className="text-xs btn-primary py-1 px-2"
                                    >
                                        Review
                                    </button>
                                ),
                            },
                        ]}
                        emptyMessage="No items pending review"
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
