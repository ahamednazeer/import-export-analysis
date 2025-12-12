'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { InspectionImage, ProductRequest } from '@/types';
import StatusChip from '@/components/StatusChip';
import { ArrowLeft, CheckCircle, Warning, Camera, Clock } from '@phosphor-icons/react';

export default function InspectionDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [images, setImages] = useState<InspectionImage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!params.id) return;
            try {
                const [reqData, imagesData] = await Promise.all([
                    api.getRequest(parseInt(params.id as string)),
                    api.getRequestImages(parseInt(params.id as string))
                ]);
                setRequest(reqData);
                setImages(imagesData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id]);

    const getResultIcon = (result: string) => {
        switch (result) {
            case 'OK':
                return <CheckCircle size={24} className="text-green-400" />;
            case 'DAMAGED':
            case 'EXPIRED':
                return <Warning size={24} className="text-red-400" />;
            case 'LOW_CONFIDENCE':
                return <Warning size={24} className="text-yellow-400" />;
            case 'PROCESSING':
                return <Clock size={24} className="text-blue-400" />;
            default:
                return <Camera size={24} className="text-slate-400" />;
        }
    };

    const getResultColor = (result: string) => {
        switch (result) {
            case 'OK':
                return 'bg-green-950/30 border-green-800';
            case 'DAMAGED':
            case 'EXPIRED':
                return 'bg-red-950/30 border-red-800';
            case 'LOW_CONFIDENCE':
                return 'bg-yellow-950/30 border-yellow-800';
            case 'PROCESSING':
                return 'bg-blue-950/30 border-blue-800';
            default:
                return 'bg-slate-800/40 border-slate-700';
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading inspection details...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!request) {
        return (
            <DashboardLayout userRole="PROCUREMENT_MANAGER">
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-red-400 font-mono text-lg mb-2">Request Not Found</div>
                    <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="PROCUREMENT_MANAGER">
            <div className="max-w-5xl mx-auto space-y-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">
                                Inspection Evidence
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                {request.requestNumber} • {request.product?.name}
                            </p>
                        </div>
                        <StatusChip status={request.status} />
                    </div>

                    {images.length === 0 ? (
                        <div className="text-center py-12 bg-slate-900/50 rounded-sm">
                            <Camera size={48} className="text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">No inspection images uploaded yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {images.map((img) => (
                                <div
                                    key={img.id}
                                    className={`border rounded-sm overflow-hidden ${getResultColor(img.effectiveResult)}`}
                                >
                                    <div className="aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/uploads/${img.filename}`}
                                            alt={`Inspection ${img.imageType}`}
                                            className="max-h-full max-w-full object-contain"
                                            crossOrigin="anonymous"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {getResultIcon(img.effectiveResult)}
                                                <div>
                                                    <p className="font-bold text-slate-200 capitalize">{img.imageType}</p>
                                                    <StatusChip status={img.effectiveResult} size="sm" />
                                                </div>
                                            </div>
                                            {img.confidenceScore && (
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-slate-200">
                                                        {img.confidenceScore}%
                                                    </p>
                                                    <p className="text-xs text-slate-500">Confidence</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            {img.damageDetected && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Damage:</span>
                                                    <span className="text-red-400">
                                                        {img.damageType} ({img.damageSeverity})
                                                    </span>
                                                </div>
                                            )}
                                            {img.spoilageDetected && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Spoilage:</span>
                                                    <span className="text-red-400">Detected</span>
                                                </div>
                                            )}
                                            {img.sealIntact !== null && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Seal:</span>
                                                    <span className={img.sealIntact ? 'text-green-400' : 'text-red-400'}>
                                                        {img.sealIntact ? 'Intact' : 'Compromised'}
                                                    </span>
                                                </div>
                                            )}
                                            {img.isExpired && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Expiry:</span>
                                                    <span className="text-red-400">Expired</span>
                                                </div>
                                            )}
                                            {img.detectedExpiryDate && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Expiry Date:</span>
                                                    <span className="text-slate-300">{img.detectedExpiryDate}</span>
                                                </div>
                                            )}
                                        </div>

                                        {img.overridden && (
                                            <div className="mt-3 p-2 bg-blue-950/30 border border-blue-800 rounded-sm">
                                                <p className="text-blue-400 text-xs font-bold">OVERRIDDEN</p>
                                                <p className="text-slate-400 text-xs">
                                                    Result changed to {img.overrideResult}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
