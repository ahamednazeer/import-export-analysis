'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import { Globe } from '@phosphor-icons/react';

export default function AdminSuppliersPage() {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                // Assuming api.getSuppliers exists (it was in the seed data logic)
                const data = await api.getSuppliers();
                setSuppliers(data);
            } catch (error) {
                console.error('Failed to fetch suppliers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSuppliers();
    }, []);

    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        country: 'India',
        city: '',
        address: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        leadTimeDays: 7,
        reliabilityScore: 0.95
    });

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createSupplier({
                ...formData,
                leadTimeDays: Number(formData.leadTimeDays),
                reliabilityScore: Number(formData.reliabilityScore)
            });
            alert('Supplier created successfully');
            setModalOpen(false);
            setFormData({
                code: '',
                name: '',
                country: 'India',
                city: '',
                address: '',
                contactPerson: '',
                contactPhone: '',
                contactEmail: '',
                leadTimeDays: 7,
                reliabilityScore: 0.95
            });
            // Refetch
            const data = await api.getSuppliers();
            setSuppliers(data);
        } catch (error) {
            console.error(error);
            alert('Failed to create supplier');
        }
    };

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">Suppliers</h3>
                        <p className="text-slate-400 text-sm mt-1">International supply partners</p>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Globe size={16} /> Add Supplier
                    </button>
                </div>

                <DataTable
                    data={suppliers}
                    columns={[
                        {
                            key: 'name',
                            label: 'Name',
                            render: (item) => <span className="text-slate-200 font-medium">{item.name}</span>
                        },
                        {
                            key: 'country',
                            label: 'Country',
                            render: (item) => <span className="text-slate-400">{item.country}</span>
                        },
                        {
                            key: 'lead_time',
                            label: 'Avg Lead Time',
                            render: (item) => <span className="font-mono text-slate-300">{item.leadTimeDays || '-'} days</span>
                        },
                        {
                            key: 'reliability',
                            label: 'Reliability',
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full w-16">
                                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(item.reliabilityScore || 0) * 100}%` }}></div>
                                    </div>
                                    <span className="text-xs text-green-400">{Math.round((item.reliabilityScore || 0) * 100)}%</span>
                                </div>
                            )
                        }
                    ]}
                    emptyMessage="No suppliers found."
                />
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create New Supplier">
                <form onSubmit={handleCreateSupplier} className="space-y-4">
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
                            <label className="text-sm text-slate-400">Lead Time (Days)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.leadTimeDays}
                                onChange={e => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                                min="1"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary w-full mt-6">
                        Create Supplier
                    </button>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
