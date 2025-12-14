'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import { ArrowLeft, Plus } from '@phosphor-icons/react';

export default function AdminWarehouseInventoryPage() {
    const params = useParams();
    const warehouseId = params.id as string;
    const [warehouse, setWarehouse] = useState<any>(null);
    const [stock, setStock] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [warehouseData, stockData] = await Promise.all([
                    api.getWarehouse(Number(warehouseId)),
                    api.getWarehouseStock(Number(warehouseId))
                ]);
                setWarehouse(warehouseData);
                setStock(stockData);
            } catch (error) {
                console.error('Failed to fetch warehouse data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [warehouseId]);

    const [formData, setFormData] = useState({
        productId: '',
        quantity: 0,
        availableQuantity: '',
        batchNumber: '',
        locationCode: '',
        expiryDate: ''
    });

    const handleUpdateStock = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            console.log('Updating stock with data:', formData);
            const result = await api.updateWarehouseStock(Number(warehouseId), {
                ...formData,
                productId: Number(formData.productId),
                quantity: Number(formData.quantity)
            });
            console.log('Stock update result:', result);
            alert('Stock updated successfully');
            setModalOpen(false);
            setFormData({
                productId: '',
                quantity: 0,
                availableQuantity: '',
                batchNumber: '',
                locationCode: '',
                expiryDate: ''
            });
            // Refetch stock with cache busting
            console.log('Refetching stock data...');
            try {
                const stockData = await api.getWarehouseStock(Number(warehouseId));
                console.log('New stock data:', stockData);
                console.log('Stock data type:', typeof stockData, Array.isArray(stockData));
                if (Array.isArray(stockData)) {
                    console.log('Stock data length:', stockData.length);
                    setStock(stockData);
                } else {
                    console.error('Stock data is not an array:', stockData);
                    alert('Error: Invalid stock data received');
                }
            } catch (refetchError) {
                console.error('Error refetching stock data:', refetchError);
                alert(`Error refetching data: ${refetchError}`);
            }
        } catch (error) {
            console.error('Stock update error:', error);
            alert(`Failed to update stock: ${error}`);
        }
    };

    const handleDeleteStock = async (stockId: number) => {
        if (!confirm('Are you sure you want to delete this stock record?')) return;

        try {
            await api.deleteWarehouseStock(Number(warehouseId), stockId);
            alert('Stock record deleted successfully');
            // Refetch stock
            const stockData = await api.getWarehouseStock(Number(warehouseId));
            setStock(stockData);
        } catch (error) {
            console.error(error);
            alert('Failed to delete stock record');
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="ADMIN">
                <div className="flex justify-center items-center h-64">
                    <div className="text-slate-400">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="text-slate-400 hover:text-white flex items-center gap-2"
                        >
                            <ArrowLeft size={16} /> Back to Warehouses
                        </button>
                        <div>
                            <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">
                                {warehouse?.name} Inventory
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                {warehouse?.city}, {warehouse?.state} • Code: {warehouse?.code}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Stock
                    </button>
                </div>

                <DataTable
                    data={stock}
                    columns={[
                        {
                            key: 'product',
                            label: 'Product',
                            render: (item) => (
                                <div>
                                    <p className="text-slate-200 font-medium">{item.product?.name}</p>
                                    <p className="text-xs text-slate-500">ID: {item.productId}</p>
                                </div>
                            )
                        },
                        {
                            key: 'quantity',
                            label: 'Quantity',
                            render: (item) => (
                                <span className="font-mono text-slate-300">{item.quantity}</span>
                            )
                        },
                        {
                            key: 'available',
                            label: 'Available',
                            render: (item) => (
                                <span className="font-mono text-green-400">{item.availableQuantity}</span>
                            )
                        },
                        {
                            key: 'batchNumber',
                            label: 'Batch',
                            render: (item) => (
                                <span className="font-mono text-blue-400 text-xs">{item.batchNumber || 'N/A'}</span>
                            )
                        },
                        {
                            key: 'locationCode',
                            label: 'Location',
                            render: (item) => (
                                <span className="font-mono text-slate-400 text-xs">{item.locationCode || 'N/A'}</span>
                            )
                        },
                        {
                            key: 'expiryDate',
                            label: 'Expiry',
                            render: (item) => (
                                <span className="text-slate-400 text-xs">
                                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                                </span>
                            )
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => (
                                <button
                                    onClick={() => handleDeleteStock(item.id)}
                                    className="text-red-400 hover:text-red-300 text-xs underline"
                                >
                                    Delete
                                </button>
                            ),
                        },
                    ]}
                    emptyMessage="No stock records found for this warehouse."
                />
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add/Update Stock">
                <form onSubmit={handleUpdateStock} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Product ID</label>
                        <input
                            type="number"
                            className="input-field"
                            value={formData.productId}
                            onChange={e => setFormData({ ...formData, productId: e.target.value })}
                            required
                            placeholder="Enter product ID"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Total Quantity</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                min="0"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Available Quantity (Optional)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.availableQuantity}
                                onChange={e => setFormData({ ...formData, availableQuantity: e.target.value })}
                                min="0"
                                placeholder="Leave empty to keep current reservations"
                            />
                            <p className="text-xs text-slate-500">Adjusts reserved stock automatically</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Batch Number (Optional)</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.batchNumber}
                            onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                            placeholder="e.g., BATCH-2024-001"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Location Code (Optional)</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.locationCode}
                            onChange={e => setFormData({ ...formData, locationCode: e.target.value })}
                            placeholder="e.g., A-12-3"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Expiry Date (Optional)</label>
                        <input
                            type="date"
                            className="input-field"
                            value={formData.expiryDate}
                            onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-6">
                        Update Stock
                    </button>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
