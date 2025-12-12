'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { Warehouse } from '@phosphor-icons/react';

export default function AdminWarehousesPage() {
    const router = useRouter();
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                // We need to add getWarehouses to API client, for now assuming it exists or mocking
                // Based on `api.ts` file content earlier, `getWarehouses` exists
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

    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        city: '',
        state: '',
        country: 'India',
        address: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        totalCapacity: 10000
    });

    const handleCreateWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createWarehouse({
                ...formData,
                totalCapacity: Number(formData.totalCapacity)
            });
            alert('Warehouse created successfully');
            setModalOpen(false);
            setFormData({
                code: '',
                name: '',
                city: '',
                state: '',
                country: 'India',
                address: '',
                contactPerson: '',
                contactPhone: '',
                contactEmail: '',
                totalCapacity: 10000
            });
            // Refetch
            const data = await api.getWarehouses();
            setWarehouses(data);
        } catch (error) {
            console.error(error);
            alert('Failed to create warehouse');
        }
    };

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Warehouses</h3>
                        <p className="text-slate-400 text-sm mt-1">Network distribution centers</p>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Warehouse size={16} /> Add Warehouse
                    </button>
                </div>

                <DataTable
                    data={warehouses}
                    columns={[
                        {
                            key: 'name',
                            label: 'Name',
                            render: (item) => <span className="text-slate-200 font-medium">{item.name}</span>
                        },
                        {
                            key: 'location',
                            label: 'Location',
                            render: (item) => (
                                <span className="text-slate-400 text-sm">
                                    {item.city}, {item.state}, {item.country}
                                </span>
                            )
                        },
                        {
                            key: 'capacity',
                            label: 'Capacity',
                            render: (item) => <span className="font-mono text-slate-300">{item.totalCapacity || item.capacity || 'N/A'}</span>
                        },
                        {
                            key: 'code',
                            label: 'Code',
                            render: (item) => <span className="font-mono text-blue-400 text-xs">{item.code}</span>
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => (
                                <button className="text-slate-400 hover:text-white text-xs underline">Manage Inventory</button>
                            ),
                        },
                    ]}
                    emptyMessage="No warehouses found."
                />
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create New Warehouse">
                <form onSubmit={handleCreateWarehouse} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Code</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">City</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Country</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.country}
                                onChange={e => setFormData({ ...formData, country: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Address</label>
                        <textarea
                            className="input-field h-20"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Contact Person</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.contactPerson}
                                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Total Capacity</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.totalCapacity}
                                onChange={e => setFormData({ ...formData, totalCapacity: Number(e.target.value) })}
                                min="100"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary w-full mt-6">
                        Create Warehouse
                    </button>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
