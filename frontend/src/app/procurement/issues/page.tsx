'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { ProductRequest } from '@/types';
import { ArrowBendUpLeft, Warning } from '@phosphor-icons/react';

export default function ProcurementIssuesPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                // Fetch all pending requests, then filter locally for issues (BLOCKED/DAMAGED)
                const data = await api.getPendingProcurement();
                setRequests(data);
            } catch (error) {
                console.error('Failed to fetch requests:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const issueRequests = requests.filter(r => r.status === 'PARTIALLY_BLOCKED');

    if (loading) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading issues...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider text-red-400">Blocked Issues</h3>
                    <p className="text-slate-400 text-sm mt-1">Requests blocked due to damage, expiry, or stock shortages</p>
                </div>

                <div className="grid gap-4">
                    {issueRequests.length === 0 ? (
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-8 text-center">
                            <CheckCircle className="text-green-400 mx-auto mb-3" size={32} />
                            <p className="text-slate-300">No active issues found.</p>
                            <p className="text-slate-500 text-sm">All inspections and reservations are proceeding normally.</p>
                        </div>
                    ) : (
                        issueRequests.map(item => (
                            <div key={item.id} className="bg-red-950/10 border border-red-900/40 rounded-sm p-6 flex flex-col md:flex-row gap-6 items-start">
                                <div className="p-3 bg-red-900/20 rounded-full text-red-400 shrink-0">
                                    <Warning size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-lg font-bold text-slate-100 font-mono">{item.requestNumber}</h4>
                                            <p className="text-slate-400 text-sm">{item.product?.name}</p>
                                        </div>
                                        <span className="bg-red-900/30 text-red-300 px-3 py-1 rounded-full text-xs font-semibold uppercase">
                                            Issues Found
                                        </span>
                                    </div>

                                    <div className="mt-4 p-4 bg-slate-900/50 rounded-sm border-l-2 border-red-500">
                                        <p className="text-slate-300 text-sm">
                                            This request is partially blocked. Likely caused by <strong>Damaged</strong> or <strong>Expired</strong> items found during inspection at the warehouse.
                                        </p>
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => router.push(`/procurement/resolve/${item.id}`)}
                                            className="btn-primary text-sm flex items-center gap-2"
                                        >
                                            <ArrowBendUpLeft size={16} /> Resolve Issue
                                        </button>
                                        <button
                                            onClick={() => router.push(`/inspection/request/${item.id}`)} // This page will need to be made too if we want to view images directly
                                            className="btn-secondary text-sm"
                                        >
                                            View Evidence
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

// Helper icon import
import { CheckCircle } from '@phosphor-icons/react';
