'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { InspectionImage, ProductRequest } from '@/types';
import { Upload, Camera, CheckCircle, Warning, X } from '@phosphor-icons/react';
import StatusChip from '@/components/StatusChip';

export default function UploadPage() {
    const searchParams = useSearchParams();
    const requestId = searchParams.get('requestId');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [request, setRequest] = useState<ProductRequest | null>(null);
    const [images, setImages] = useState<InspectionImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageType, setImageType] = useState('package');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!requestId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const [requestData, imagesData] = await Promise.all([
                    api.getRequest(parseInt(requestId)),
                    api.getRequestImages(parseInt(requestId)),
                ]);
                setRequest(requestData);
                setImages(imagesData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [requestId]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !requestId) return;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('requestId', requestId);
            formData.append('imageType', imageType);

            const result = await api.uploadInspectionImage(formData);
            setImages([...images, result]);
            setSelectedFile(null);
            setPreviewUrl(null);
        } catch (error: any) {
            alert(error.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="WAREHOUSE_OPERATOR">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!requestId || !request) {
        return (
            <DashboardLayout userRole="WAREHOUSE_OPERATOR">
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-yellow-400 font-mono text-lg mb-2">No Request Selected</div>
                    <p className="text-slate-400">Please select a request from the Pick Tasks page to upload inspection images.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="WAREHOUSE_OPERATOR">
            <div className="max-w-4xl mx-auto">
                <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">Upload Inspection Images</h3>

                {request && (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-mono text-green-400">{request.requestNumber}</p>
                                <p className="text-slate-400 text-sm">{request.product?.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-sm">Quantity: {request.quantity}</p>
                                <StatusChip status={request.status} size="sm" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upload Section */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Upload New Image</h4>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                        />

                        {!previewUrl ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-600 rounded-sm p-12 text-center cursor-pointer hover:border-green-500 transition-colors"
                            >
                                <Camera size={48} className="text-slate-500 mx-auto mb-4" />
                                <p className="text-slate-400">Click to select image</p>
                                <p className="text-slate-600 text-sm mt-2">PNG, JPG, or WEBP</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-full rounded-sm"
                                />
                                <button
                                    onClick={() => {
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                    }}
                                    className="absolute top-2 right-2 bg-red-600 p-1 rounded-full"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="mt-4">
                            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                Image Type
                            </label>
                            <select
                                value={imageType}
                                onChange={(e) => setImageType(e.target.value)}
                                className="input-modern"
                            >
                                <option value="package">Package</option>
                                <option value="label">Label</option>
                                <option value="contents">Contents</option>
                                <option value="damage">Damage</option>
                            </select>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                        >
                            <Upload size={16} />
                            {uploading ? 'Analyzing...' : 'Upload & Analyze'}
                        </button>
                    </div>

                    {/* Results Section */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Inspection Results</h4>

                        {images.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No images uploaded yet</p>
                        ) : (
                            <div className="space-y-4">
                                {images.map((img) => (
                                    <div key={img.id} className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-sm">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${img.effectiveResult === 'OK' ? 'bg-green-950 text-green-400' :
                                            img.effectiveResult === 'DAMAGED' || img.effectiveResult === 'EXPIRED' ? 'bg-red-950 text-red-400' :
                                                'bg-yellow-950 text-yellow-400'
                                            }`}>
                                            {img.effectiveResult === 'OK' ? <CheckCircle size={20} /> : <Warning size={20} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-slate-200 font-medium capitalize">{img.imageType}</p>
                                            <div className="flex items-center gap-2">
                                                <StatusChip status={img.effectiveResult} size="sm" />
                                                {img.confidenceScore && (
                                                    <span className="text-slate-500 text-xs">
                                                        {img.confidenceScore}% confidence
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
