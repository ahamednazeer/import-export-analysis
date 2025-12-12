'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import { Package } from '@phosphor-icons/react';

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: 'units',
        minOrderQuantity: 1,
        unitPrice: 0,
        currency: 'USD',
        requiresInspection: true,
        shelfLifeDays: 365
    });

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createProduct({
                ...formData,
                minOrderQuantity: Number(formData.minOrderQuantity),
                unitPrice: Number(formData.unitPrice),
                shelfLifeDays: Number(formData.shelfLifeDays)
            });
            alert('Product created successfully');
            setModalOpen(false);
            setFormData({
                sku: '',
                name: '',
                description: '',
                category: '',
                unit: 'units',
                minOrderQuantity: 1,
                unitPrice: 0,
                currency: 'USD',
                requiresInspection: true,
                shelfLifeDays: 365
            });
            // Refetch
            const data = await api.getProducts();
            setProducts(data);
        } catch (error) {
            console.error(error);
            alert('Failed to create product');
        }
    };

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Product Catalog</h3>
                        <p className="text-slate-400 text-sm mt-1">Manage SKUs and pricing</p>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Package size={16} /> Add Product
                    </button>
                </div>

                <DataTable
                    data={products}
                    columns={[
                        {
                            key: 'sku',
                            label: 'SKU',
                            render: (item) => <span className="font-mono text-blue-400">{item.sku}</span>
                        },
                        {
                            key: 'name',
                            label: 'Name',
                            render: (item) => <span className="text-slate-200 font-medium">{item.name}</span>
                        },
                        {
                            key: 'category',
                            label: 'Category',
                            render: (item) => <span className="text-slate-400 text-xs uppercase">{item.category}</span>
                        },
                        {
                            key: 'price',
                            label: 'Price',
                            render: (item) => <span className="font-mono text-green-400">{item.currency} {item.unitPrice}</span>
                        },
                        {
                            key: 'shelf_life',
                            label: 'Shelf Life',
                            render: (item) => <span className="text-slate-500 text-xs">{item.shelfLifeDays} days</span>
                        }
                    ]}
                    emptyMessage="No products found."
                />
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create New Product">
                <form onSubmit={handleCreateProduct} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">SKU</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Description</label>
                        <textarea
                            className="input-field h-20"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Category</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Unit</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Unit Price</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    className="input-field w-24"
                                    value={formData.unitPrice}
                                    onChange={e => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                                    min="0"
                                    step="0.01"
                                />
                                <select
                                    className="input-field w-20"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="INR">INR</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Min Order Qty</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.minOrderQuantity}
                                onChange={e => setFormData({ ...formData, minOrderQuantity: Number(e.target.value) })}
                                min="1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Shelf Life (Days)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.shelfLifeDays}
                                onChange={e => setFormData({ ...formData, shelfLifeDays: Number(e.target.value) })}
                            />
                        </div>
                        <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.requiresInspection}
                                    onChange={e => setFormData({ ...formData, requiresInspection: e.target.checked })}
                                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                                />
                                <span className="text-sm text-slate-300">Requires Inspection</span>
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary w-full mt-6">
                        Create Product
                    </button>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
