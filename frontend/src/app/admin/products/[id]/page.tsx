'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import { Product, Stock, Supplier } from '@/types';
import { Building, Truck, Package, CurrencyDollar, Calendar, MapPin, Globe, CheckCircle, Warning, Plus, Trash } from '@phosphor-icons/react';

interface SupplierStock {
    id: number;
    supplierId: number;
    productId: number;
    availableQuantity: number;
    minOrderQuantity: number;
    unitPrice: number;
    currency: string;
    leadTimeDays: number;
    isActive: boolean;
    supplier: {
        id: number;
        name: string;
        country: string;
        city?: string;
        contactPhone?: string;
        reliabilityScore: number;
    };
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = parseInt(params.id as string);

    const [product, setProduct] = useState<Product | null>(null);
    const [warehouseStock, setWarehouseStock] = useState<Stock[]>([]);
    const [supplierStocks, setSupplierStocks] = useState<SupplierStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    useEffect(() => {
        const fetchProductDetails = async () => {
            try {
                const [productData, warehouseData, supplierData] = await Promise.all([
                    api.getProduct(productId),
                    api.getProductStock(productId),
                    api.getProductSuppliers(productId)
                ]);

                setProduct(productData);
                setWarehouseStock(warehouseData);
                setSupplierStocks(supplierData);
            } catch (error) {
                console.error('Failed to fetch product details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (productId) {
            fetchProductDetails();
        }
    }, [productId]);

    const handleRemoveWarehouseStock = async (stockId: number, warehouseId: number) => {
        try {
            await api.deleteWarehouseStock(warehouseId, stockId);
            // Refresh warehouse stock
            const warehouseData = await api.getProductStock(productId);
            setWarehouseStock(warehouseData);
            alert('Warehouse stock removed successfully!');
        } catch (error) {
            console.error('Failed to remove warehouse stock:', error);
            alert('Failed to remove warehouse stock');
        }
    };

    const handleRemoveSupplierStock = async (supplierId: number) => {
        try {
            await api.removeSupplierProduct(supplierId, productId);
            // Refresh supplier stocks
            const supplierData = await api.getProductSuppliers(productId);
            setSupplierStocks(supplierData);
            alert('Supplier product removed successfully!');
        } catch (error) {
            console.error('Failed to remove supplier product:', error);
            alert('Failed to remove supplier product');
        }
    };

    if (loading) {
        return (
            <DashboardLayout userRole="ADMIN">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading product details...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (!product) {
        return (
            <DashboardLayout userRole="ADMIN">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Product not found</div>
                </div>
            </DashboardLayout>
        );
    }

    const totalLocalStock = warehouseStock.reduce((total, stock) => total + stock.availableQuantity, 0);
    const totalImportStock = supplierStocks.reduce((total, stock) => total + stock.availableQuantity, 0);

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Product Details</h3>
                        <p className="text-slate-400 text-sm mt-1">Product: {product.name} ({product.sku})</p>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors text-sm"
                    >
                        Back to Products
                    </button>
                </div>

                {/* Product Overview */}
                <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                    <h4 className="text-lg font-chivo font-bold text-white mb-4">Product Overview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <Package className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                            <div className="text-xl font-bold text-white">{product.sku}</div>
                            <div className="text-xs text-slate-400 uppercase">SKU</div>
                        </div>
                        <div className="text-center">
                            <CurrencyDollar className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <div className="text-xl font-bold text-white">{product.currency} {product.unitPrice}</div>
                            <div className="text-xs text-slate-400 uppercase">Unit Price</div>
                        </div>
                        <div className="text-center">
                            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <div className="text-xl font-bold text-white">{totalLocalStock}</div>
                            <div className="text-xs text-slate-400 uppercase">Local Stock</div>
                        </div>
                        <div className="text-center">
                            <Globe className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                            <div className="text-xl font-bold text-white">{totalImportStock}</div>
                            <div className="text-xs text-slate-400 uppercase">Import Stock</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Warehouse Stock */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Building size={24} className="text-blue-400" />
                                <div>
                                    <h4 className="text-lg font-chivo font-bold text-white">Local Warehouse Stock</h4>
                                    <p className="text-slate-400 text-sm">Available quantities by warehouse</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddWarehouseModal(true)}
                                className="btn-primary flex items-center gap-2 px-3 py-2"
                            >
                                <Plus size={16} /> Add to Warehouse
                            </button>
                        </div>

                        {warehouseStock.length === 0 ? (
                            <div className="text-center py-8">
                                <Building size={48} className="text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-500">No warehouse stock found</p>
                                <p className="text-xs text-slate-600 mt-1">This product has no stock in local warehouses</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {warehouseStock.map((stock) => (
                                    <div key={stock.id} className="bg-slate-900/60 border border-slate-700 rounded-sm p-4 relative group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h5 className="font-semibold text-white flex items-center gap-2">
                                                    <Building size={16} className="text-slate-400" />
                                                    {stock.warehouse?.name || `Warehouse ${stock.warehouseId}`}
                                                </h5>
                                                <p className="text-xs text-slate-400">
                                                    {stock.warehouse?.city}, {stock.warehouse?.state}
                                                </p>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <div>
                                                    <div className="text-lg font-bold text-blue-400">
                                                        {stock.availableQuantity}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Available
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to remove this product from this warehouse? This will delete all stock data.')) {
                                                            handleRemoveWarehouseStock(stock.id, stock.warehouseId);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-sm"
                                                    title="Remove from warehouse"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-slate-400">Total:</span>
                                                <span className="text-white ml-2 font-mono">{stock.quantity}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Reserved:</span>
                                                <span className="text-orange-400 ml-2 font-mono">{stock.reservedQuantity}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Location:</span>
                                                <span className="text-slate-300 ml-2 font-mono">{stock.locationCode || '-'}</span>
                                            </div>
                                        </div>

                                        {stock.batchNumber && (
                                            <div className="mt-3 pt-3 border-t border-slate-700">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400">Batch: {stock.batchNumber}</span>
                                                    {stock.expiryDate && (
                                                        <span className={`font-mono ${
                                                            new Date(stock.expiryDate) < new Date() ? 'text-red-400' : 'text-slate-300'
                                                        }`}>
                                                            Exp: {new Date(stock.expiryDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Supplier Stock */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Truck size={24} className="text-purple-400" />
                                <div>
                                    <h4 className="text-lg font-chivo font-bold text-white">Import Supplier Stock</h4>
                                    <p className="text-slate-400 text-sm">Available from international suppliers</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddSupplierModal(true)}
                                className="btn-primary flex items-center gap-2 px-3 py-2"
                            >
                                <Plus size={16} /> Add Supplier
                            </button>
                        </div>

                        {supplierStocks.length === 0 ? (
                            <div className="text-center py-8">
                                <Truck size={48} className="text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-500">No supplier stock found</p>
                                <p className="text-xs text-slate-600 mt-1">This product has no import suppliers configured</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {supplierStocks.map((supplierStock) => (
                                    <div key={supplierStock.id} className="bg-slate-900/60 border border-slate-700 rounded-sm p-4 relative group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h5 className="font-semibold text-white flex items-center gap-2">
                                                    <Globe size={16} className="text-slate-400" />
                                                    {supplierStock.supplier.name}
                                                </h5>
                                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                                    <MapPin size={12} />
                                                    {supplierStock.supplier.city}, {supplierStock.supplier.country}
                                                </p>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <div>
                                                    <div className="text-lg font-bold text-purple-400">
                                                        {supplierStock.availableQuantity}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Available
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to remove this product from this supplier? This action cannot be undone.')) {
                                                            handleRemoveSupplierStock(supplierStock.supplierId);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-sm"
                                                    title="Remove from supplier"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-slate-400">Price:</span>
                                                <span className="text-green-400 ml-2 font-mono font-semibold">
                                                    {supplierStock.currency} {supplierStock.unitPrice}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Lead Time:</span>
                                                <span className="text-white ml-2 font-mono">{supplierStock.leadTimeDays} days</span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-700">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-400">Min Order:</span>
                                                    <span className="text-white font-mono">{supplierStock.minOrderQuantity}</span>
                                                </div>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs ${
                                                    supplierStock.supplier.reliabilityScore >= 0.8
                                                        ? 'bg-green-900/20 text-green-400 border border-green-700/30'
                                                        : supplierStock.supplier.reliabilityScore >= 0.6
                                                        ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'
                                                        : 'bg-red-900/20 text-red-400 border border-red-700/30'
                                                }`}>
                                                    <CheckCircle size={10} />
                                                    {(supplierStock.supplier.reliabilityScore * 100).toFixed(0)}% Reliable
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-slate-900 border border-slate-700 rounded-sm p-6">
                    <h4 className="text-lg font-chivo font-bold text-white mb-4">Inventory Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-slate-800/50 rounded-sm border border-slate-700/50">
                            <div className="text-2xl font-bold text-blue-400 mb-1">{warehouseStock.length}</div>
                            <div className="text-xs text-slate-400 uppercase">Active Warehouses</div>
                        </div>
                        <div className="text-center p-4 bg-slate-800/50 rounded-sm border border-slate-700/50">
                            <div className="text-2xl font-bold text-purple-400 mb-1">{supplierStocks.length}</div>
                            <div className="text-xs text-slate-400 uppercase">Import Suppliers</div>
                        </div>
                        <div className="text-center p-4 bg-slate-800/50 rounded-sm border border-slate-700/50">
                            <div className={`text-2xl font-bold mb-1 ${
                                totalLocalStock > totalImportStock ? 'text-green-400' :
                                totalLocalStock < totalImportStock ? 'text-yellow-400' : 'text-slate-400'
                            }`}>
                                {totalLocalStock > totalImportStock ? 'Local' : totalLocalStock < totalImportStock ? 'Import' : 'Balanced'}
                            </div>
                            <div className="text-xs text-slate-400 uppercase">Primary Source</div>
                        </div>
                    </div>
                </div>

                {/* Add Warehouse Modal */}
                {showAddWarehouseModal && (
                    <AddWarehouseModal
                        productId={productId}
                        product={product}
                        onClose={() => setShowAddWarehouseModal(false)}
                        onSuccess={async () => {
                            // Refresh warehouse stock
                            const warehouseData = await api.getProductStock(productId);
                            setWarehouseStock(warehouseData);
                            setShowAddWarehouseModal(false);
                        }}
                    />
                )}

                {/* Add Supplier Modal */}
                {showAddSupplierModal && (
                    <AddSupplierModal
                        productId={productId}
                        product={product}
                        onClose={() => setShowAddSupplierModal(false)}
                        onSuccess={async () => {
                            // Refresh supplier stocks
                            const supplierData = await api.getProductSuppliers(productId);
                            setSupplierStocks(supplierData);
                            setShowAddSupplierModal(false);
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

// Add Warehouse Modal Component
function AddWarehouseModal({ productId, product, onClose, onSuccess }: {
    productId: number;
    product: Product | null;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        warehouseId: '',
        quantity: '',
        locationCode: '',
        batchNumber: '',
        expiryDate: ''
    });

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const data = await api.getWarehouses();
                setWarehouses(data);
            } catch (error) {
                console.error('Failed to fetch warehouses:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchWarehouses();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.warehouseId || !formData.quantity) {
            alert('Please select a warehouse and specify quantity');
            return;
        }

        setSubmitting(true);
        try {
            await api.updateWarehouseStock(parseInt(formData.warehouseId), {
                productId: productId,
                quantity: parseInt(formData.quantity),
                locationCode: formData.locationCode || undefined,
                batchNumber: formData.batchNumber || undefined,
                expiryDate: formData.expiryDate || undefined
            });
            alert('Warehouse stock added successfully!');
            onSuccess();
        } catch (error) {
            console.error('Failed to add warehouse stock:', error);
            alert('Failed to add stock to warehouse');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Add Product to Warehouse">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded-sm border border-slate-700/50 mb-4">
                    <div className="text-xs text-slate-400 uppercase mb-1">Product</div>
                    <div className="font-mono text-blue-400">{product?.name} ({product?.sku})</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Warehouse</label>
                        <select
                            className="input-field w-full"
                            value={formData.warehouseId}
                            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                            required
                        >
                            <option value="">Select Warehouse</option>
                            {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name} - {warehouse.city}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Quantity</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            min="1"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Location Code (Optional)</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            value={formData.locationCode}
                            onChange={(e) => setFormData({ ...formData, locationCode: e.target.value })}
                            placeholder="e.g., A-12-3"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Batch Number (Optional)</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            value={formData.batchNumber}
                            onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                            placeholder="e.g., BATCH-2024-001"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-slate-400">Expiry Date (Optional)</label>
                    <input
                        type="date"
                        className="input-field w-full"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-500 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Adding...' : 'Add to Warehouse'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Add Supplier Modal Component
function AddSupplierModal({ productId, product, onClose, onSuccess }: {
    productId: number;
    product: Product | null;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        supplierId: '',
        availableQuantity: '',
        minOrderQuantity: '1',
        unitPrice: '',
        currency: 'USD'
    });

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const data = await api.getSuppliers();
                setSuppliersList(data);
            } catch (error) {
                console.error('Failed to fetch suppliers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSuppliers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplierId || !formData.availableQuantity) {
            alert('Please select a supplier and specify quantity');
            return;
        }

        setSubmitting(true);
        try {
            await api.addSupplierProduct(parseInt(formData.supplierId), {
                productId: productId,
                availableQuantity: parseInt(formData.availableQuantity),
                minOrderQuantity: parseInt(formData.minOrderQuantity),
                unitPrice: parseFloat(formData.unitPrice) || 0,
                currency: formData.currency
            });
            alert('Supplier product added successfully!');
            onSuccess();
        } catch (error) {
            console.error('Failed to add supplier product:', error);
            alert('Failed to add product to supplier');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Add Product to Supplier">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded-sm border border-slate-700/50 mb-4">
                    <div className="text-xs text-slate-400 uppercase mb-1">Product</div>
                    <div className="font-mono text-blue-400">{product?.name} ({product?.sku})</div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-slate-400">Supplier</label>
                    <select
                        className="input-field w-full"
                        value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        required
                    >
                        <option value="">Select Supplier</option>
                        {suppliersList.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name} - {supplier.city}, {supplier.country}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Available Quantity</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            value={formData.availableQuantity}
                            onChange={(e) => setFormData({ ...formData, availableQuantity: e.target.value })}
                            min="0"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Min Order Quantity</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            value={formData.minOrderQuantity}
                            onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
                            min="1"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Unit Price</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            value={formData.unitPrice}
                            onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Currency</label>
                        <select
                            className="input-field w-full"
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="INR">INR</option>
                            <option value="GBP">GBP</option>
                            <option value="CAD">CAD</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-sm hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-sm hover:bg-purple-500 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Adding...' : 'Add to Supplier'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
