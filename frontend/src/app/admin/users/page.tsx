'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';
import StatusChip from '@/components/StatusChip';
import { User as UserIcon, Shield, Eye, Warehouse, Truck, Calendar, Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { User, Warehouse as WarehouseType, Supplier } from '@/types';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editUserModalOpen, setEditUserModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [availableWarehouses, setAvailableWarehouses] = useState<WarehouseType[]>([]);
    const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'DEALER',
        assignedWarehouseId: '',
        assignedSupplierId: ''
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await api.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createUser({
                ...formData,
                assignedWarehouseId: formData.assignedWarehouseId ? parseInt(formData.assignedWarehouseId) : null,
                assignedSupplierId: formData.assignedSupplierId ? parseInt(formData.assignedSupplierId) : null
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
                assignedWarehouseId: '',
                assignedSupplierId: ''
            });
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to create user');
        }
    };

    const handleViewDetails = async (user: User) => {
        setSelectedUser(user);

        // Fetch available warehouses and suppliers for assignment
        try {
            const [warehouses, suppliers] = await Promise.all([
                api.getWarehouses(),
                api.getSuppliers()
            ]);

            // Filter out already assigned ones
            const unassignedWarehouses = warehouses.filter((w: WarehouseType) => !users.some(u => u.assignedWarehouseId === w.id));
            const unassignedSuppliers = suppliers.filter((s: Supplier) => !users.some(u => u.assignedSupplierId === s.id));

            setAvailableWarehouses(unassignedWarehouses);
            setAvailableSuppliers(unassignedSuppliers);
        } catch (error) {
            console.error('Failed to fetch available assignments:', error);
        }

        setDetailsModalOpen(true);
    };

    const handleEditAssignment = (user: User) => {
        setSelectedUser(user);
        // Initialize form data with current assignment values
        setFormData({
            ...formData,
            assignedWarehouseId: user.assignedWarehouseId ? user.assignedWarehouseId.toString() : '',
            assignedSupplierId: user.assignedSupplierId ? user.assignedSupplierId.toString() : ''
        });
        setEditModalOpen(true);
    };

    const handleUpdateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        try {
            const updateData: any = {};
            if (selectedUser.role === 'WAREHOUSE_OPERATOR' || selectedUser.role === 'LOGISTICS_PLANNER') {
                updateData.assignedWarehouseId = formData.assignedWarehouseId ? parseInt(formData.assignedWarehouseId) : null;
                updateData.assignedSupplierId = null;
            } else if (selectedUser.role === 'PROCUREMENT_MANAGER' || selectedUser.role === 'SUPPLIER') {
                updateData.assignedSupplierId = formData.assignedSupplierId ? parseInt(formData.assignedSupplierId) : null;
                updateData.assignedWarehouseId = null;
            }

            await api.updateUser(selectedUser.id, updateData);
            alert('Assignment updated successfully');
            setEditModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to update assignment');
        }
    };

    const handleAssignWarehouse = async (user: User, warehouseId: number) => {
        try {
            await api.updateUser(user.id, {
                assignedWarehouseId: warehouseId,
                assignedSupplierId: null
            });
            alert('Warehouse assigned successfully');
            setDetailsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to assign warehouse');
        }
    };

    const handleAssignSupplier = async (user: User, supplierId: number) => {
        try {
            await api.updateUser(user.id, {
                assignedSupplierId: supplierId,
                assignedWarehouseId: null
            });
            alert('Supplier assigned successfully');
            setDetailsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to assign supplier');
        }
    };

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        // Initialize form data with current user values
        setFormData({
            username: user.username,
            email: user.email,
            password: '', // Don't pre-fill password
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            assignedWarehouseId: user.assignedWarehouseId ? user.assignedWarehouseId.toString() : '',
            assignedSupplierId: user.assignedSupplierId ? user.assignedSupplierId.toString() : ''
        });
        setEditUserModalOpen(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        try {
            const updateData: any = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                role: formData.role,
            };

            // Only include password if provided
            if (formData.password) {
                updateData.password = formData.password;
            }

            // Handle assignments based on role
            if (formData.role === 'WAREHOUSE_OPERATOR' || formData.role === 'LOGISTICS_PLANNER') {
                updateData.assignedWarehouseId = formData.assignedWarehouseId ? parseInt(formData.assignedWarehouseId) : null;
                updateData.assignedSupplierId = null;
            } else if (formData.role === 'PROCUREMENT_MANAGER' || formData.role === 'SUPPLIER') {
                updateData.assignedSupplierId = formData.assignedSupplierId ? parseInt(formData.assignedSupplierId) : null;
                updateData.assignedWarehouseId = null;
            } else {
                // Admin and Dealer don't have assignments
                updateData.assignedWarehouseId = null;
                updateData.assignedSupplierId = null;
            }

            await api.updateUser(selectedUser.id, updateData);
            alert('User updated successfully');
            setEditUserModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to update user');
        }
    };

    const handleToggleUserStatus = async (user: User) => {
        try {
            const action = user.isActive ? 'deactivate' : 'activate';
            await api.updateUser(user.id, { isActive: !user.isActive });
            alert(`User ${action}d successfully`);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to update user status');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Are you sure you want to delete user ${user.firstName} ${user.lastName}? This action cannot be undone.`)) {
            return;
        }

        try {
            // Note: The backend route sets is_active = false, so this is a soft delete
            await api.deleteUser(user.id);
            alert('User deleted successfully');
            setDetailsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to delete user');
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'DEALER': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
            case 'WAREHOUSE_OPERATOR': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'PROCUREMENT_MANAGER': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'LOGISTICS_PLANNER': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
            case 'SUPPLIER': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
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
                        <UserIcon size={16} /> Add User
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading users...</div>
                ) : (
                    <DataTable
                        data={users}
                        columns={[
                            {
                                key: 'username',
                                label: 'User',
                                render: (item) => (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                                            <UserIcon size={16} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-medium">{item.firstName} {item.lastName}</p>
                                            <p className="text-xs text-slate-500">@{item.username}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'email',
                                label: 'Email',
                                render: (item) => (
                                    <span className="text-slate-400 text-sm">{item.email}</span>
                                ),
                            },
                            {
                                key: 'role',
                                label: 'Role',
                                render: (item) => (
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-xs font-mono ${getRoleColor(item.role)}`}>
                                        <Shield size={12} />
                                        {item.role.replace(/_/g, ' ')}
                                    </span>
                                ),
                            },
                            {
                                key: 'assignment',
                                label: 'Assignment',
                                render: (item) => {
                                    if (item.assignedWarehouse) {
                                        return (
                                            <div className="flex items-center gap-1.5 text-green-400 text-xs">
                                                <Warehouse size={14} />
                                                <span>{item.assignedWarehouse.name}</span>
                                            </div>
                                        );
                                    }
                                    if (item.assignedSupplier) {
                                        return (
                                            <div className="flex items-center gap-1.5 text-orange-400 text-xs">
                                                <Truck size={14} />
                                                <span>{item.assignedSupplier.name}</span>
                                            </div>
                                        );
                                    }
                                    return <span className="text-slate-600 text-xs">—</span>;
                                },
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (item) => (
                                    <StatusChip status={item.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                                ),
                            },
                            {
                                key: 'action',
                                label: 'Action',
                                render: (item) => (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewDetails(item);
                                        }}
                                        className="text-sky-400 hover:text-sky-300 text-xs flex items-center gap-1"
                                    >
                                        <Eye size={14} />
                                        View Details
                                    </button>
                                ),
                            },
                        ]}
                        onRowClick={handleViewDetails}
                        emptyMessage="No users found."
                    />
                )}
            </div>

            {/* Create User Modal */}
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

                    {(formData.role === 'WAREHOUSE_OPERATOR' || formData.role === 'LOGISTICS_PLANNER') && (
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

                    {(formData.role === 'PROCUREMENT_MANAGER' || formData.role === 'SUPPLIER') && (
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Assigned Supplier ID</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.assignedSupplierId}
                                onChange={e => setFormData({ ...formData, assignedSupplierId: e.target.value })}
                                placeholder="Supplier ID (e.g. 1)"
                            />
                        </div>
                    )}

                    <button type="submit" className="btn-primary w-full mt-6">
                        Create User
                    </button>
                </form>
            </Modal>

            {/* User Details Modal */}
            <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="User Details">
                {selectedUser && (
                    <div className="space-y-6">
                        {/* User Header */}
                        <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                <UserIcon size={32} className="text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">
                                    {selectedUser.firstName} {selectedUser.lastName}
                                </h3>
                                <p className="text-slate-400">@{selectedUser.username}</p>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 mt-2 rounded-sm border text-xs font-mono ${getRoleColor(selectedUser.role)}`}>
                                    <Shield size={12} />
                                    {selectedUser.role.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        {/* Basic Information */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                                Contact Information
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Envelope size={16} className="text-slate-500" />
                                    <span>{selectedUser.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Calendar size={16} className="text-slate-500" />
                                    <span>Joined {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusChip status={selectedUser.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                                </div>
                            </div>
                        </div>

                        {/* Warehouse Assignment */}
                        {selectedUser.assignedWarehouse && (
                            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse size={16} />
                                        Assigned Warehouse
                                    </h4>
                                    <button
                                        onClick={() => handleEditAssignment(selectedUser)}
                                        className="text-green-400 hover:text-green-300 text-xs underline"
                                    >
                                        Edit Assignment
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 text-sm">Name</span>
                                        <span className="text-slate-200 font-medium">{selectedUser.assignedWarehouse.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 text-sm">Code</span>
                                        <span className="text-slate-300 font-mono">{selectedUser.assignedWarehouse.code}</span>
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <span className="text-slate-500 text-sm">Location</span>
                                        <span className="text-slate-300 text-right">
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="text-slate-500" />
                                                {selectedUser.assignedWarehouse.city}, {selectedUser.assignedWarehouse.country}
                                            </div>
                                        </span>
                                    </div>
                                    {selectedUser.assignedWarehouse.address && (
                                        <div className="flex justify-between items-start">
                                            <span className="text-slate-500 text-sm">Address</span>
                                            <span className="text-slate-300 text-right text-sm max-w-[200px]">
                                                {selectedUser.assignedWarehouse.address}
                                            </span>
                                        </div>
                                    )}
                                    {selectedUser.assignedWarehouse.contactPerson && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 text-sm">Contact Person</span>
                                            <span className="text-slate-300">{selectedUser.assignedWarehouse.contactPerson}</span>
                                        </div>
                                    )}
                                    {selectedUser.assignedWarehouse.contactPhone && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 text-sm">Phone</span>
                                            <span className="text-slate-300 flex items-center gap-1">
                                                <Phone size={12} className="text-slate-500" />
                                                {selectedUser.assignedWarehouse.contactPhone}
                                            </span>
                                        </div>
                                    )}
                                    {selectedUser.assignedWarehouse.contactEmail && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 text-sm">Email</span>
                                            <span className="text-slate-300 flex items-center gap-1">
                                                <Envelope size={12} className="text-slate-500" />
                                                {selectedUser.assignedWarehouse.contactEmail}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between mt-2 pt-2 border-t border-green-500/20">
                                        <span className="text-slate-500 text-sm">Capacity</span>
                                        <span className="text-slate-300">
                                            {selectedUser.assignedWarehouse.currentUtilization.toLocaleString()} / {selectedUser.assignedWarehouse.totalCapacity.toLocaleString()} units
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Supplier Assignment */}
                        {selectedUser.assignedSupplier && (
                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                                        <Truck size={16} />
                                        Assigned Supplier
                                    </h4>
                                    <button
                                        onClick={() => handleEditAssignment(selectedUser)}
                                        className="text-orange-400 hover:text-orange-300 text-xs underline"
                                    >
                                        Edit Assignment
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 text-sm">Name</span>
                                        <span className="text-slate-200 font-medium">{selectedUser.assignedSupplier.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 text-sm">Code</span>
                                        <span className="text-slate-300 font-mono">{selectedUser.assignedSupplier.code}</span>
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <span className="text-slate-500 text-sm">Location</span>
                                        <span className="text-slate-300 text-right">
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="text-slate-500" />
                                                {selectedUser.assignedSupplier.city && `${selectedUser.assignedSupplier.city}, `}{selectedUser.assignedSupplier.country}
                                            </div>
                                        </span>
                                    </div>
                                    {selectedUser.assignedSupplier.contactPerson && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 text-sm">Contact Person</span>
                                            <span className="text-slate-300">{selectedUser.assignedSupplier.contactPerson}</span>
                                        </div>
                                    )}
                                    {selectedUser.assignedSupplier.contactPhone && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 text-sm">Phone</span>
                                            <span className="text-slate-300 flex items-center gap-1">
                                                <Phone size={12} className="text-slate-500" />
                                                {selectedUser.assignedSupplier.contactPhone}
                                            </span>
                                        </div>
                                    )}
                                    {selectedUser.assignedSupplier.contactEmail && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 text-sm">Email</span>
                                            <span className="text-slate-300 flex items-center gap-1">
                                                <Envelope size={12} className="text-slate-500" />
                                                {selectedUser.assignedSupplier.contactEmail}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between mt-2 pt-2 border-t border-orange-500/20">
                                        <span className="text-slate-500 text-sm">Lead Time</span>
                                        <span className="text-slate-300">{selectedUser.assignedSupplier.leadTimeDays} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 text-sm">Reliability Score</span>
                                        <span className="text-slate-300">{selectedUser.assignedSupplier.reliabilityScore}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Available Assignments */}
                        {!selectedUser.assignedWarehouse && !selectedUser.assignedSupplier && (
                            <div className="space-y-4">
                                {/* Available Warehouses */}
                                {(selectedUser.role === 'WAREHOUSE_OPERATOR' || selectedUser.role === 'LOGISTICS_PLANNER') && availableWarehouses.length > 0 && (
                                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">
                                            Available Warehouses
                                        </h4>
                                        <div className="space-y-2">
                                            {availableWarehouses.map((warehouse) => (
                                                <div key={warehouse.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                                                    <div>
                                                        <p className="text-slate-200 font-medium">{warehouse.name}</p>
                                                        <p className="text-xs text-slate-500">{warehouse.city}, {warehouse.country}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAssignWarehouse(selectedUser, warehouse.id)}
                                                        className="btn-primary text-xs"
                                                    >
                                                        Assign
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Available Suppliers */}
                                {(selectedUser.role === 'PROCUREMENT_MANAGER' || selectedUser.role === 'SUPPLIER') && availableSuppliers.length > 0 && (
                                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">
                                            Available Suppliers
                                        </h4>
                                        <div className="space-y-2">
                                            {availableSuppliers.map((supplier) => (
                                                <div key={supplier.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                                                    <div>
                                                        <p className="text-slate-200 font-medium">{supplier.name}</p>
                                                        <p className="text-xs text-slate-500">{supplier.city}, {supplier.country}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAssignSupplier(selectedUser, supplier.id)}
                                                        className="btn-primary text-xs"
                                                    >
                                                        Assign
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No Available Assignments */}
                                {((selectedUser.role === 'WAREHOUSE_OPERATOR' || selectedUser.role === 'LOGISTICS_PLANNER') && availableWarehouses.length === 0) ||
                                 ((selectedUser.role === 'PROCUREMENT_MANAGER' || selectedUser.role === 'SUPPLIER') && availableSuppliers.length === 0) && (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                                        <p className="text-slate-500">No available warehouses or suppliers to assign.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-6 border-t border-slate-700">
                            <button
                                onClick={() => handleEditUser(selectedUser)}
                                className="btn-secondary flex-1"
                            >
                                Edit User
                            </button>
                            <button
                                onClick={() => handleToggleUserStatus(selectedUser)}
                                className={`flex-1 ${selectedUser.isActive ? 'btn-danger' : 'btn-success'}`}
                            >
                                {selectedUser.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                onClick={() => handleDeleteUser(selectedUser)}
                                className="btn-danger flex-1"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Edit Assignment Modal */}
            <Modal isOpen={editModalOpen} onClose={() => {
                setEditModalOpen(false);
                // Clear form data when closing
                setFormData({
                    username: '',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    role: 'DEALER',
                    assignedWarehouseId: '',
                    assignedSupplierId: ''
                });
            }} title="Edit Assignment">
                {selectedUser && (
                    <form onSubmit={handleUpdateAssignment} className="space-y-4">
                        <div className="text-slate-400 text-sm mb-4">
                            Edit assignment for <span className="text-white font-medium">{selectedUser.firstName} {selectedUser.lastName}</span> ({selectedUser.role.replace(/_/g, ' ')})
                        </div>

                        {(selectedUser.role === 'WAREHOUSE_OPERATOR' || selectedUser.role === 'LOGISTICS_PLANNER') && (
                            <div className="space-y-1">
                                <label className="text-sm text-slate-400">Assigned Warehouse ID</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={formData.assignedWarehouseId}
                                    onChange={e => setFormData({ ...formData, assignedWarehouseId: e.target.value })}
                                    placeholder="Warehouse ID (e.g. 1)"
                                />
                                <p className="text-xs text-slate-500">Leave empty to remove assignment</p>
                            </div>
                        )}

                        {(selectedUser.role === 'PROCUREMENT_MANAGER' || selectedUser.role === 'SUPPLIER') && (
                            <div className="space-y-1">
                                <label className="text-sm text-slate-400">Assigned Supplier ID</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={formData.assignedSupplierId}
                                    onChange={e => setFormData({ ...formData, assignedSupplierId: e.target.value })}
                                    placeholder="Supplier ID (e.g. 1)"
                                />
                                <p className="text-xs text-slate-500">Leave empty to remove assignment</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <button type="submit" className="btn-primary flex-1">
                                Update Assignment
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditModalOpen(false)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Edit User Modal */}
            <Modal isOpen={editUserModalOpen} onClose={() => {
                setEditUserModalOpen(false);
                // Clear form data when closing
                setFormData({
                    username: '',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    role: 'DEALER',
                    assignedWarehouseId: '',
                    assignedSupplierId: ''
                });
            }} title="Edit User">
                <form onSubmit={handleUpdateUser} className="space-y-4">
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
                            placeholder="Leave empty to keep current password"
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

                    {(formData.role === 'WAREHOUSE_OPERATOR' || formData.role === 'LOGISTICS_PLANNER') && (
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

                    {(formData.role === 'PROCUREMENT_MANAGER' || formData.role === 'SUPPLIER') && (
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">Assigned Supplier ID</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.assignedSupplierId}
                                onChange={e => setFormData({ ...formData, assignedSupplierId: e.target.value })}
                                placeholder="Supplier ID (e.g. 1)"
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button type="submit" className="btn-primary flex-1">
                            Update User
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditUserModalOpen(false)}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
