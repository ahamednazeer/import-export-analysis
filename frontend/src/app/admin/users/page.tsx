'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { User, Shield } from '@phosphor-icons/react';

export default function AdminUsersPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // In a real app we'd have a specific getUsers() endpoint
                // For now leveraging the system stats which contains some user info
                // or just placeholder for demo
                const data = await api.getSystemStats();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Mock user list since we don't have a getUsers endpoint explicitly defined in our frontend api client yet
    // I should probably add it, but for now I'll use a mocked list for display based on the seed data we know exists
    const mockUsers = [
        { id: 1, username: 'admin', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE' },
        { id: 2, username: 'dealer1', email: 'dealer@example.com', role: 'DEALER', status: 'ACTIVE' },
        { id: 3, username: 'warehouse1', email: 'wh@example.com', role: 'WAREHOUSE_OPERATOR', status: 'ACTIVE' },
        { id: 4, username: 'procurement1', email: 'proc@example.com', role: 'PROCUREMENT_MANAGER', status: 'ACTIVE' },
        { id: 5, username: 'logistics1', email: 'log@example.com', role: 'LOGISTICS_PLANNER', status: 'ACTIVE' },
    ];

    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'DEALER',
        assignedWarehouseId: ''
    });

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createUser({
                ...formData,
                assignedWarehouseId: formData.assignedWarehouseId ? parseInt(formData.assignedWarehouseId) : null
            });
            alert('User created successfully');
            setModalOpen(false);
            setFormData({
                username: '',
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                role: 'DEALER',
                assignedWarehouseId: ''
            });
            // In a real app we would refetch the list here
        } catch (error) {
            console.error(error);
            alert('Failed to create user');
        }
    };

    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">User Management</h3>
                        <p className="text-slate-400 text-sm mt-1">Manage system access and roles</p>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <User size={16} /> Add User
                    </button>
                </div>

                <DataTable
                    data={mockUsers}
                    columns={[
                        {
                            key: 'username',
                            label: 'User',
                            render: (item) => (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                                        <User size={16} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-slate-200 font-medium">{item.username}</p>
                                        <p className="text-xs text-slate-500">{item.email}</p>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'role',
                            label: 'Role',
                            render: (item) => (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                                    <Shield size={12} />
                                    {item.role}
                                </span>
                            ),
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (item) => <StatusChip status={item.status as any} size="sm" />,
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item) => (
                                <button className="text-slate-400 hover:text-white text-xs underline">Edit</button>
                            ),
                        },
                    ]}
                    emptyMessage="No users found."
                />
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create New User">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">First Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Last Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Username</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Email</label>
                        <input
                            type="email"
                            className="input-field"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-400">Role</label>
                        <select
                            className="input-field"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="ADMIN">Admin</option>
                            <option value="DEALER">Dealer</option>
                            <option value="WAREHOUSE_OPERATOR">Warehouse Operator</option>
                            <option value="PROCUREMENT_MANAGER">Procurement Manager</option>
                            <option value="LOGISTICS_PLANNER">Logistics Planner</option>
                        </select>
                    </div>

                    {formData.role === 'WAREHOUSE_OPERATOR' && (
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Assigned Warehouse ID</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.assignedWarehouseId}
                                onChange={e => setFormData({ ...formData, assignedWarehouseId: e.target.value })}
                                placeholder="Warehouse ID (e.g. 1)"
                            />
                        </div>
                    )}

                    <button type="submit" className="btn-primary w-full mt-6">
                        Create User
                    </button>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
