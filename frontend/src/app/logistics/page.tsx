'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCard from '@/components/DashboardCard';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { Package, Truck, CheckCircle, MapPin } from '@phosphor-icons/react';
import { ProductRequest, Shipment } from '@/types';
import { useRouter } from 'next/navigation';

export default function LogisticsDashboard() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({ firstName: 'Planner', email: 'logistics@example.com' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [requestsData, shipmentsData, userData] = await Promise.all([
                    api.getReadyForAllocation(),
                    api.getShipments(),
                    api.getCurrentUser().catch(() => null),
                ]);
                setRequests(requestsData);
                setShipments(shipmentsData);
                if (userData) setUser(userData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const inTransitCount = shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'DISPATCHED').length;
    const deliveredToday = shipments.filter(s => s.status === 'DELIVERED').length;

    if (loading) {
        return (
            <DashboardLayout userRole="LOGISTICS_PLANNER" userName={user.firstName} userEmail={user.email}>
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading dashboard...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="LOGISTICS_PLANNER" userName={user.firstName} userEmail={user.email}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">Logistics Dashboard</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DashboardCard
                            title="Ready for Allocation"
                            value={requests.length}
                            icon={<Package size={24} weight="duotone" />}
                            variant="logistics"
                        />
                        <DashboardCard
                            title="Active Shipments"
                            value={inTransitCount}
                            icon={<Truck size={24} weight="duotone" />}
                            variant="logistics"
                        />
                        <DashboardCard
                            title="Delivered Today"
                            value={deliveredToday}
                            icon={<CheckCircle size={24} weight="duotone" />}
                            variant="logistics"
                        />
                        <DashboardCard
                            title="Total Shipments"
                            value={shipments.length}
                            icon={<MapPin size={24} weight="duotone" />}
                            variant="logistics"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Ready for Allocation</h4>
                        <DataTable
                            data={requests}
                            columns={[
                                {
                                    key: 'requestNumber',
                                    label: 'Request #',
                                    render: (item) => (
                                        <span className="font-mono text-purple-400">{item.requestNumber}</span>
                                    ),
                                },
                                {
                                    key: 'quantity',
                                    label: 'Qty',
                                },
                                {
                                    key: 'deliveryCity',
                                    label: 'Destination',
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
                                            className="text-xs btn-primary py-1 px-2"
                                        >
                                            Allocate
                                        </button>
                                    ),
                                },
                            ]}
                            emptyMessage="No requests ready for allocation"
                        />
                    </div>

                    <div>
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Active Shipments</h4>
                        <DataTable
                            data={shipments.filter(s => ['CONFIRMED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)).slice(0, 5)}
                            columns={[
                                {
                                    key: 'trackingNumber',
                                    label: 'Tracking #',
                                    render: (item) => (
                                        <span className="font-mono text-purple-400">{item.trackingNumber}</span>
                                    ),
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
                            ]}
                            onRowClick={(item) => router.push(`/logistics/shipments/${item.id}`)}
                            emptyMessage="No active shipments"
                        />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
