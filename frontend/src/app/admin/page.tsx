'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCard from '@/components/DashboardCard';
import { Users, Warehouse, Package, Truck, ChartLineUp } from '@phosphor-icons/react';
import { SystemStats } from '@/types';

export default function AdminDashboard() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({ firstName: 'Admin', email: 'admin@example.com' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, userData] = await Promise.all([
                    api.getSystemStats(),
                    api.getCurrentUser().catch(() => null),
                ]);
                setStats(statsData);
                if (userData) setUser(userData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <DashboardLayout userRole="ADMIN" userName={user.firstName} userEmail={user.email}>
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-400 font-mono">Loading system statistics...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userRole="ADMIN" userName={user.firstName} userEmail={user.email}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-6">System Overview</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DashboardCard
                            title="Total Users"
                            value={stats?.users?.total || 0}
                            icon={<Users size={24} weight="duotone" />}
                            variant="admin"
                        />
                        <DashboardCard
                            title="Warehouses"
                            value={stats?.warehouses?.total || 0}
                            icon={<Warehouse size={24} weight="duotone" />}
                            variant="admin"
                        />
                        <DashboardCard
                            title="Total Requests"
                            value={stats?.requests?.total || 0}
                            icon={<Package size={24} weight="duotone" />}
                            variant="admin"
                        />
                        <DashboardCard
                            title="Suppliers"
                            value={stats?.suppliers?.total || 0}
                            icon={<Truck size={24} weight="duotone" />}
                            variant="admin"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Users by Role</h4>
                        <div className="space-y-3">
                            {stats?.users?.byRole && Object.entries(stats.users.byRole).map(([role, count]) => (
                                <div key={role} className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm capitalize">{role.toLowerCase().replace(/_/g, ' ')}</span>
                                    <span className="font-mono text-slate-200">{count as number}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6">
                        <h4 className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-4">Request Statistics</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Pending</span>
                                <span className="font-mono text-yellow-400">{stats?.requests?.pending || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Active</span>
                                <span className="font-mono text-blue-400">{stats?.requests?.active || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Completed</span>
                                <span className="font-mono text-green-400">{stats?.requests?.completed || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
