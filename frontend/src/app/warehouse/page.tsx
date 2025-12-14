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
    const [user, setUser] = useState<{ firstName: string; email: string; assignedWarehouse?: { name?: string } }>({ firstName: 'Operator', email: 'wh@example.com' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pickTasksData, userData] = await Promise.all([
                    api.getMyPickTasks(),
                    api.getCurrentUser().catch(() => null),
                ]);
                // Transform the grouped tasks into a flat list for the table
                const flatTasks = pickTasksData.map((taskGroup: any) => ({
                    ...taskGroup.request,
                    reservations: taskGroup.reservations
                }));
                setRequests(flatTasks);
                if (userData) setUser(userData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getEffectiveStatus = (item: any) => {
        if (['COMPLETED', 'CANCELLED', 'READY_FOR_ALLOCATION', 'ALLOCATED'].includes(item.status)) {
            return item.status;
        }

        const hasLocalBlock = item.reservations?.some((r: any) => r.isBlocked);
        if (hasLocalBlock) return 'BLOCKED';

        const totalRes = item.reservations?.length || 0;
        const pickedCount = item.reservations?.filter((r: any) => r.isPicked).length || 0;

        if (totalRes > 0) {
            if (pickedCount === 0) return 'RESERVED';
            if (pickedCount < totalRes) return 'PICKING';
            return 'INSPECTION_PENDING';
        }

        return item.status;
    };

    const pickingCount = requests.filter(r => {
        const status = getEffectiveStatus(r);
        return status === 'RESERVED' || status === 'PICKING';
    }).length;

    const inspectionCount = requests.filter(r => getEffectiveStatus(r) === 'INSPECTION_PENDING').length;
    const blockedCount = requests.filter(r => {
        const status = getEffectiveStatus(r);
        return status === 'BLOCKED' || status === 'PARTIALLY_BLOCKED';
    }).length;

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
        <DashboardLayout
            userRole="WAREHOUSE_OPERATOR"
            userName={user.firstName}
            userEmail={user.email}
            warehouseName={user.assignedWarehouse?.name}
        >
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
                    <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Tasks Requiring Action (Your Warehouse Only)</h4>

                    <DataTable
                        data={requests.filter(r => {
                            const status = getEffectiveStatus(r);
                            return ['RESERVED', 'PICKING', 'INSPECTION_PENDING', 'BLOCKED', 'PARTIALLY_BLOCKED', 'WAITING_FOR_ALL_PICKUPS'].includes(status);
                        })}
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
                                key: 'progress',
                                label: 'Progress',
                                render: (item) => {
                                    if (!item.reservations || item.reservations.length === 0) return '-';

                                    const effectiveStatus = getEffectiveStatus(item);

                                    if (effectiveStatus === 'INSPECTION_PENDING') {
                                        // For inspection pending, calculate inspection progress
                                        // Check how many reservations have completed inspection
                                        const inspectedCount = item.reservations ? item.reservations.filter((r: any) => {
                                            // A reservation is considered inspected if it has inspection images with final results
                                            // Since we can't query this directly, we'll use a simple heuristic for now
                                            return r.isPicked; // Temporary: assume picked reservations are ready for inspection
                                        }).length : 0;
                                        const total = item.reservations ? item.reservations.length : 0;
                                        const progress = total > 0 ? Math.round((inspectedCount / total) * 100) : 0;

                                        return (
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-yellow-500"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    Inspection: {progress}%
                                                </span>
                                            </div>
                                        );
                                    } else {
                                        // For picking status, show picking progress
                                        const pickedCount = item.reservations.filter((r: any) => r.isPicked).length;
                                        const total = item.reservations.length;
                                        const progress = Math.round((pickedCount / total) * 100);
                                        const allPicked = pickedCount === total;

                                        return (
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${allPicked ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">{pickedCount}/{total} picked</span>
                                            </div>
                                        );
                                    }
                                }
                            },
                            {
                                key: 'quantity',
                                label: 'Qty',
                                render: (item) => {
                                    if (item.reservations && Array.isArray(item.reservations)) {
                                        const warehouseQuantity = item.reservations.reduce((sum: number, res: any) => sum + (res.quantity || 0), 0);
                                        return warehouseQuantity || item.quantity;
                                    }
                                    return item.quantity;
                                }
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (item) => <StatusChip status={getEffectiveStatus(item)} size="sm" />,
                            },
                            {
                                key: 'action',
                                label: 'Action',
                                render: (item) => (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const effectiveStatus = getEffectiveStatus(item);

                                            if (effectiveStatus === 'RESERVED') {
                                                api.startPicking(item.id).then(() => {
                                                    // Navigate instead of reload
                                                    router.push(`/warehouse/upload?requestId=${item.id}`);
                                                });
                                            } else {
                                                router.push(`/warehouse/upload?requestId=${item.id}`);
                                            }
                                        }}
                                        className="text-xs btn-primary py-1 px-2"
                                    >
                                        {getEffectiveStatus(item) === 'RESERVED' ? 'Start Pick' : 'Upload Image'}
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
