'use client';

import { CheckCircle, Clock, Warning, Warehouse, Truck, ArrowRight } from '@phosphor-icons/react';
import { api } from '@/lib/api';

interface SourceStatus {
    reservationId: number;
    sourceType: 'Warehouse' | 'Supplier';
    sourceId: number;
    sourceName: string | null;
    quantity: number;
    isReady: boolean;
    status: string;
    isPicked: boolean;
    aiConfirmed: boolean;
    procurementResolved: boolean;
    isBlocked: boolean;
}

interface CompletionStatus {
    requestId: number;
    requestStatus: string;
    isComplete: boolean;
    readyCount: number;
    totalCount: number;
    sources: SourceStatus[];
    summary: string;
}

interface SourceCompletionStatusProps {
    completionStatus: CompletionStatus | null;
    loading?: boolean;
}

// Map status to display info
const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: 'check' | 'clock' | 'warning' }> = {
        'PENDING': { label: 'Pending', color: 'text-slate-400', icon: 'clock' },
        'PICKED': { label: 'Picked', color: 'text-blue-400', icon: 'clock' },
        'AI_PROCESSING': { label: 'AI Processing', color: 'text-yellow-400', icon: 'clock' },
        'AI_CONFIRMED': { label: 'AI Confirmed', color: 'text-green-400', icon: 'check' },
        'AI_LOW_CONFIDENCE': { label: 'Low Confidence', color: 'text-orange-400', icon: 'warning' },
        'AI_DAMAGED': { label: 'Damaged', color: 'text-red-400', icon: 'warning' },
        'PROCUREMENT_RESOLVED': { label: 'Resolved', color: 'text-green-400', icon: 'check' },
        'READY': { label: 'Ready', color: 'text-green-400', icon: 'check' },
        'BLOCKED': { label: 'Blocked', color: 'text-red-400', icon: 'warning' },
        'SUPPLIER_PENDING': { label: 'Awaiting Supplier', color: 'text-yellow-400', icon: 'clock' },
        'SUPPLIER_CONFIRMED': { label: 'Supplier Confirmed', color: 'text-green-400', icon: 'check' },
    };
    return statusMap[status] || { label: status, color: 'text-slate-400', icon: 'clock' };
};

export default function SourceCompletionStatus({ completionStatus, loading }: SourceCompletionStatusProps) {
    if (loading) {
        return (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4">
                <div className="text-slate-400 text-sm animate-pulse">Loading source status...</div>
            </div>
        );
    }

    if (!completionStatus) {
        return null;
    }

    const { isComplete, readyCount, totalCount, sources, summary } = completionStatus;
    const progressPercent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

    return (
        <div className={`border rounded-sm p-4 ${isComplete
            ? 'bg-green-950/20 border-green-800/40'
            : 'bg-slate-800/40 border-slate-700/60'
            }`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    {isComplete ? (
                        <CheckCircle size={18} className="text-green-400" />
                    ) : (
                        <Clock size={18} className="text-yellow-400" />
                    )}
                    Source Completion Status
                </h4>
                <span className={`text-xs font-mono px-2 py-1 rounded ${isComplete
                    ? 'bg-green-900/40 text-green-400'
                    : 'bg-slate-700/40 text-slate-300'
                    }`}>
                    {readyCount}/{totalCount} Ready
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Sources List */}
            <div className="space-y-2">
                {sources.map((source) => {
                    const statusDisplay = getStatusDisplay(source.status);
                    const Icon = source.sourceType === 'Warehouse' ? Warehouse : Truck;

                    const handleForceReady = async () => {
                        if (confirm(`Are you sure you want to FORCE mark ${source.sourceType} #${source.sourceId} as Ready? This bypasses all checks.`)) {
                            try {
                                await api.markSourceReady(source.reservationId, 'Manual override by user');
                                window.location.reload(); // Simple refresh to show new status
                            } catch (error) {
                                alert('Failed to update status');
                            }
                        }
                    };

                    return (
                        <div
                            key={source.reservationId}
                            className={`flex items-center justify-between p-3 rounded-sm border ${source.isReady
                                ? 'bg-green-950/20 border-green-800/30'
                                : 'bg-slate-900/40 border-slate-700/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon
                                    size={20}
                                    className={source.sourceType === 'Warehouse' ? 'text-blue-400' : 'text-purple-400'}
                                />
                                <div>
                                    <p className="text-sm font-medium text-slate-200">
                                        {source.sourceName || `${source.sourceType} #${source.sourceId}`}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Qty: {source.quantity} • {source.sourceType}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Status Steps */}
                                <div className="hidden sm:flex items-center gap-1 text-xs mr-2">
                                    <span className={source.isPicked ? 'text-green-400' : 'text-slate-500'}>
                                        Picked
                                    </span>
                                    <ArrowRight size={12} className="text-slate-600" />
                                    <span className={source.aiConfirmed ? 'text-green-400' : 'text-slate-500'}>
                                        AI OK
                                    </span>
                                    {source.procurementResolved && (
                                        <>
                                            <ArrowRight size={12} className="text-slate-600" />
                                            <span className="text-green-400">Resolved</span>
                                        </>
                                    )}
                                </div>

                                {/* Status Badge */}
                                <span className={`text-xs font-medium px-2 py-1 rounded ${statusDisplay.color} bg-slate-800/60`}>
                                    {source.isReady ? (
                                        <span className="flex items-center gap-1">
                                            <CheckCircle size={12} /> Ready
                                        </span>
                                    ) : (
                                        statusDisplay.label
                                    )}
                                </span>

                                {/* Manual Override Button */}
                                {!source.isReady && (
                                    <button
                                        onClick={handleForceReady}
                                        title="Force Mark Ready (Manual Override)"
                                        className="ml-2 p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                                    >
                                        <CheckCircle size={16} weight="bold" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <p className={`mt-4 text-xs ${isComplete ? 'text-green-400' : 'text-slate-400'}`}>
                {isComplete
                    ? '✓ All sources complete — ready for logistics allocation'
                    : `⏳ Waiting: ${summary}`}
            </p>
        </div>
    );
}
