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
                const myRequests = await api.getMyCompletedTasks();
                setRequests(myRequests);
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const handleSendToLogistics = async (requestId: number) => {
        try {
            await api.markReadyForAllocation(requestId);
            // Immediately update the local state to show status change
            setRequests(prevRequests =>
                prevRequests.map(req =>
                    req.id === requestId
                        ? { ...req, status: 'READY_FOR_ALLOCATION' }
                        : req
                )
            );
            alert('Request sent to logistics successfully!');
        } catch (error) {
            console.error('Failed to send to logistics:', error);
            alert('Failed to send request to logistics');
        }
    };

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Completed Tasks</h3>
                    <p className="text-slate-400 text-sm mt-1">History of processed requests</p>
                </div>

                <div className="space-y-4">
                    {requests.map((request) => (
                        <div key={request.id} className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className="font-mono text-slate-500">{request.requestNumber}</span>
                                        <StatusChip status={request.status} size="sm" />
                                        <span className="text-slate-400 text-sm">
                                            {request.product?.name || 'Unknown Product'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm text-slate-500">
                                        <span>Qty: {request.warehouseQuantity || request.quantity}</span>
                                        <span>{request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : 'No date'}</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    {request.status === 'RESOLVED_PARTIAL' && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm('Mark this request as ready for logistics allocation?')) {
                                                    await handleSendToLogistics(request.id);
                                                }
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-sm transition-colors"
                                        >
                                            📦 Send to Logistics
                                        </button>
                                    )}
                                    {request.status === 'READY_FOR_ALLOCATION' && (
                                        <span className="text-sm text-purple-400 font-medium">
                                            📦 Sent to Logistics
                                        </span>
                                    )}
                                    {request.status === 'PARTIALLY_BLOCKED' && (
                                        <span className="text-sm text-red-400 font-medium">⏳ Waiting for procurement</span>
                                    )}
                                    {!['RESOLVED_PARTIAL', 'READY_FOR_ALLOCATION', 'PARTIALLY_BLOCKED'].includes(request.status) && (
                                        <span className="text-sm text-gray-400">Status: {request.status}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && (
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm text-center py-12">
                            <p className="text-slate-500">No completed tasks yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
