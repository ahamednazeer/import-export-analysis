'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { Product, SourcingRecommendation } from '@/types';
import { useRouter } from 'next/navigation';
import { Package, Warehouse, Truck, ArrowRight } from '@phosphor-icons/react';

export default function NewRequestPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [recommendation, setRecommendation] = useState<SourcingRecommendation | null>(null);
    const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        productId: '',
        quantity: '',
        deliveryLocation: '',
        deliveryCity: '',
        deliveryState: '',
        requestedDeliveryDate: '',
        notes: '',
    });

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.getProducts();
                setProducts(data);
            } catch (error) {
                console.error('Failed to fetch products:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await api.createRequest({
                productId: parseInt(formData.productId),
                quantity: parseInt(formData.quantity),
                deliveryLocation: formData.deliveryLocation,
                deliveryCity: formData.deliveryCity,
                deliveryState: formData.deliveryState,
                requestedDeliveryDate: formData.requestedDeliveryDate || null,
                notes: formData.notes,
            });

            setRecommendation(response.recommendation);
            setCreatedRequestId(response.request.id);
            setShowRecommendation(true);
        } catch (error: any) {
            alert(error.message || 'Failed to create request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirm = async (action: 'confirm' | 'send_to_procurement' | 'cancel') => {
        if (!createdRequestId) return;
        setSubmitting(true);

        try {
            await api.confirmRequest(createdRequestId, action);
            router.push('/dealer/requests');
        } catch (error: any) {
            alert(error.message || 'Failed to confirm');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="DEALER">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading products...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="DEALER">
            <div className="max-w-4xl mx-auto">
                <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">New Product Request</h3>

                {!showRecommendation ? (
                    <form onSubmit={handleSubmit} className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    Product *
                                </label>
                                <select
                                    value={formData.productId}
                                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                    required
                                    className="input-modern"
                                >
                                    <option value="">Select Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.sku})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    Quantity *
                                </label>
                                <input
                                    type="number"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    required
                                    min="1"
                                    className="input-modern"
                                    placeholder="Enter quantity"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    Delivery Address *
                                </label>
                                <input
                                    type="text"
                                    value={formData.deliveryLocation}
                                    onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                                    required
                                    className="input-modern"
                                    placeholder="Full delivery address"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    City
                                </label>
                                <input
                                    type="text"
                                    value={formData.deliveryCity}
                                    onChange={(e) => setFormData({ ...formData, deliveryCity: e.target.value })}
                                    className="input-modern"
                                    placeholder="City"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    State
                                </label>
                                <input
                                    type="text"
                                    value={formData.deliveryState}
                                    onChange={(e) => setFormData({ ...formData, deliveryState: e.target.value })}
                                    className="input-modern"
                                    placeholder="State"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    Requested Delivery Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.requestedDeliveryDate}
                                    onChange={(e) => setFormData({ ...formData, requestedDeliveryDate: e.target.value })}
                                    className="input-modern cursor-pointer"
                                    onClick={(e) => {
                                        try {
                                            (e.target as HTMLInputElement).showPicker();
                                        } catch (err) {
                                            console.debug('showPicker not supported', err);
                                        }
                                    }}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="input-modern h-24 resize-none"
                                    placeholder="Any special instructions..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                                {submitting ? 'Processing...' : 'Submit Request'}
                                <ArrowRight size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        {/* Recommendation Display */}
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                            <h4 className="text-lg font-chivo uppercase tracking-wider mb-4">Sourcing Recommendation</h4>

                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-sm mb-4 ${recommendation?.source_type === 'LOCAL' ? 'bg-green-950/50 text-green-400 border border-green-800' :
                                recommendation?.source_type === 'IMPORT' ? 'bg-blue-950/50 text-blue-400 border border-blue-800' :
                                    'bg-yellow-950/50 text-yellow-400 border border-yellow-800'
                                }`}>
                                {recommendation?.source_type === 'LOCAL' ? <Warehouse size={20} /> :
                                    recommendation?.source_type === 'IMPORT' ? <Truck size={20} /> :
                                        <Package size={20} />}
                                <span className="font-bold uppercase">{recommendation?.source_type}</span>
                            </div>

                            <p className="text-slate-300 mb-4">{recommendation?.explanation}</p>

                            {recommendation?.canFulfill === false && (
                                <div className="bg-red-950/30 border border-red-800 rounded-sm p-3 mb-4">
                                    <p className="text-red-400 text-sm">
                                        ⚠️ Warning: Unable to fully fulfill this request. Consider sending to Procurement for review.
                                    </p>
                                </div>
                            )}

                            {/* Allocation Plan */}
                            <div className="space-y-3 mt-4">
                                <h5 className="text-slate-400 text-xs uppercase tracking-wider font-mono">Allocation Plan</h5>
                                {recommendation?.allocationPlan.map((alloc, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-sm">
                                        <div className="flex items-center gap-3">
                                            {alloc.source === 'local' ? (
                                                <Warehouse size={20} className="text-green-400" />
                                            ) : (
                                                <Truck size={20} className="text-blue-400" />
                                            )}
                                            <div>
                                                <p className="text-slate-200 font-medium">
                                                    {alloc.warehouseName || alloc.supplierName}
                                                </p>
                                                <p className="text-slate-500 text-xs">
                                                    {alloc.warehouseCity || alloc.supplierCountry}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-200 font-mono">{alloc.quantity} units</p>
                                            <p className="text-slate-500 text-xs">ETA: {alloc.estimatedDays} days</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleConfirm('confirm')}
                                disabled={submitting}
                                className="btn-primary"
                            >
                                Confirm & Proceed
                            </button>
                            <button
                                onClick={() => handleConfirm('send_to_procurement')}
                                disabled={submitting}
                                className="btn-secondary"
                            >
                                Send to Procurement Review
                            </button>
                            <button
                                onClick={() => handleConfirm('cancel')}
                                disabled={submitting}
                                className="btn-danger"
                            >
                                Cancel Request
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
