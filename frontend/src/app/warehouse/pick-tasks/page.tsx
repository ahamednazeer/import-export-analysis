'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { useRouter } from 'next/navigation';
import { ProductRequest, InspectionImage } from '@/types';
import { CheckCircle, Clock, Warning, Package } from '@phosphor-icons/react';

export default function WarehousePickTasksPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [completedRequests, setCompletedRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            // Fetch active tasks
            const tasks = await api.getMyPickTasks();
            const flatTasks = tasks.map((taskGroup: any) => ({
                ...taskGroup.request,
                reservations: taskGroup.reservations,
                inspectionImages: taskGroup.inspectionImages || []
            }));
            setRequests(flatTasks);

            // Fetch completed tasks
            const completed = await api.getMyCompletedTasks();
            setCompletedRequests(completed);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleStartPicking = async (id: number) => {
        try {
            await api.startPicking(id);
            // Navigate immediately to processing
            router.push(`/warehouse/upload?requestId=${id}`);
        } catch (error) {
            console.error('Failed to start picking:', error);
        }
    };

    const getEffectiveStatus = (item: any) => {
        if (['COMPLETED', 'CANCELLED', 'READY_FOR_ALLOCATION', 'ALLOCATED', 'IN_TRANSIT', 'BLOCKED'].includes(item.status)) {
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

    // Get task completion status - shows BOTH pickup and inspection
    const getTaskStatus = (item: any) => {
        if (!item.reservations || item.reservations.length === 0) {
            return { status: 'pending', label: 'No tasks', progress: 0 };
        }

        const totalReservations = item.reservations.length;
        const pickedCount = item.reservations.filter((r: any) => r.isPicked).length;

        // Check inspection status from reservation data
        const aiConfirmedCount = item.reservations.filter((r: any) =>
            r.aiConfirmed ||
            r.reservationStatus === 'AI_CONFIRMED' ||
            r.reservationStatus === 'READY' ||
            r.reservationStatus === 'PROCUREMENT_RESOLVED' ||
            // Completed items in history might be fully done
            item.status === 'READY_FOR_ALLOCATION'
        ).length;

        // Check if there are inspection images with OK result
        const hasOkInspection = item.inspectionImages?.some((img: InspectionImage) =>
            img.effectiveResult === 'OK' || img.result === 'OK'
        );

        // Calculate overall progress
        // Stage 1: Picking (50%), Stage 2: AI Inspection (50%)
        let progress = 0;
        let stage = '';

        if (aiConfirmedCount === totalReservations || hasOkInspection || ['READY_FOR_ALLOCATION', 'ALLOCATED'].includes(item.status)) {
            // All complete (or fully processed history items)
            progress = 100;
            stage = 'complete';
        } else if (aiConfirmedCount > 0) {
            // Some AI confirmed
            progress = 50 + Math.round((aiConfirmedCount / totalReservations) * 50);
            stage = 'inspecting';
        } else if (pickedCount === totalReservations) {
            // All picked, awaiting inspection
            progress = 50;
            stage = 'awaiting-inspection';
        } else if (pickedCount > 0) {
            // Partially picked
            progress = Math.round((pickedCount / totalReservations) * 50);
            stage = 'picking';
        } else {
            progress = 0;
            stage = 'pending';
        }

        return {
            status: stage,
            pickedCount,
            aiConfirmedCount,
            totalReservations,
            progress,
            hasOkInspection
        };
    };

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR">
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Pick Tasks</h3>
                        <p className="text-slate-400 text-sm mt-1">Manage warehouse pick tasks and inspections</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-4 border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'active'
                            ? 'text-green-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        Active Tasks
                        <span className="ml-2 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs">
                            {requests.length}
                        </span>
                        {activeTab === 'active' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-400" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'completed'
                            ? 'text-green-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        Completed History
                        <span className="ml-2 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs">
                            {completedRequests.length}
                        </span>
                        {activeTab === 'completed' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-400" />
                        )}
                    </button>
                </div>

                <DataTable
                    data={activeTab === 'active' ? requests : completedRequests}
                    isLoading={loading}
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
                                    <p className="text-xs text-slate-500 font-mono">Qty: {item.reservations?.reduce((sum: number, res: any) => sum + res.quantity, 0) || item.warehouseQuantity || 0}</p>
                                </div>
                            )
                        },
                        {
                            key: 'progress',
                            label: 'Task Progress',
                            render: (item) => {
                                const taskStatus = getTaskStatus(item);
                                const isComplete = taskStatus.status === 'complete' || activeTab === 'completed';

                                // Check local blocks only
                                const hasLocalIssue = item.reservations?.some((r: any) => r.isBlocked);

                                return (
                                    <div className="w-full max-w-xs">
                                        {/* Status label with icon */}
                                        <div className="flex items-center gap-2 mb-2">
                                            {isComplete ? (
                                                <CheckCircle size={16} className="text-green-400" />
                                            ) : hasLocalIssue ? (
                                                <Warning size={16} className="text-yellow-400" />
                                            ) : (
                                                <Clock size={16} className="text-blue-400" />
                                            )}
                                            <span className={`text-xs font-medium ${isComplete ? 'text-green-400' :
                                                hasLocalIssue ? 'text-yellow-400' : 'text-slate-400'
                                                }`}>
                                                {isComplete ? 'Complete ✓' :
                                                    hasLocalIssue ? 'Needs Review' :
                                                        taskStatus.status === 'awaiting-inspection' ? 'Awaiting AI Check' :
                                                            taskStatus.status === 'inspecting' ? 'AI Processing' :
                                                                taskStatus.status === 'picking' ? 'Picking...' :
                                                                    'Not Started'}
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${isComplete ? 'bg-green-500' :
                                                    hasLocalIssue ? 'bg-yellow-500' : 'bg-blue-500'
                                                    }`}
                                                style={{ width: `${isComplete ? 100 : taskStatus.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            }
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (item) => {
                                const effectiveStatus = getEffectiveStatus(item);
                                return <StatusChip status={effectiveStatus} size="sm" />;
                            }
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => {
                                const taskStatus = getTaskStatus(item);
                                const isComplete = taskStatus.status === 'complete' || activeTab === 'completed';
                                const isReady = item.status === 'READY_FOR_ALLOCATION' || item.status === 'ALLOCATED';
                                const effectiveStatus = getEffectiveStatus(item);

                                // If in completed tab, just show View button or nothing
                                if (activeTab === 'completed') {
                                    return (
                                        <span className="text-xs text-slate-500 font-mono uppercase">Archived</span>
                                    );
                                }

                                return (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (effectiveStatus === 'RESERVED') {
                                                handleStartPicking(item.id);
                                            } else if (!isReady && !isComplete) {
                                                router.push(`/warehouse/upload?requestId=${item.id}`);
                                            }
                                        }}
                                        disabled={isReady || isComplete}
                                        className={`py-1.5 px-4 text-xs rounded-sm transition-colors uppercase font-bold tracking-wide ${effectiveStatus === 'RESERVED'
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                            : isReady || isComplete
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                            }`}
                                    >
                                        {effectiveStatus === 'RESERVED' ? 'Start Pick' :
                                            isReady || isComplete ? 'Complete' :
                                                'Inspect'}
                                    </button>
                                );
                            },
                        },
                    ]}
                    emptyMessage={activeTab === 'active' ? "No active pick tasks." : "No completed tasks found."}
                />
            </div>
        </DashboardLayout>
    );
}

