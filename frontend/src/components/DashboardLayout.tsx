'use client';

import React, { useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Package,
    SignOut,
    Warehouse,
    ShoppingCart,
    Truck,
    Users,
    Gear,
    ChartLineUp,
    Upload,
    CheckCircle,
    Warning,
    ClipboardText,
    House,
} from '@phosphor-icons/react';

interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
    userRole?: string;
    userName?: string;
    userEmail?: string;
}

const menuItemsByRole: Record<string, MenuItem[]> = {
    DEALER: [
        { icon: House, label: 'Overview', path: '/dealer' },
        { icon: ShoppingCart, label: 'My Requests', path: '/dealer/requests' },
        { icon: Package, label: 'New Request', path: '/dealer/new-request' },
        { icon: Truck, label: 'Track Orders', path: '/dealer/tracking' },
    ],
    WAREHOUSE_OPERATOR: [
        { icon: House, label: 'Overview', path: '/warehouse' },
        { icon: ClipboardText, label: 'Pick Tasks', path: '/warehouse/pick-tasks' },
        { icon: Upload, label: 'Upload Images', path: '/warehouse/upload' },
        { icon: CheckCircle, label: 'Completed', path: '/warehouse/completed' },
    ],
    PROCUREMENT_MANAGER: [
        { icon: House, label: 'Overview', path: '/procurement' },
        { icon: Warning, label: 'Pending Approvals', path: '/procurement/pending' },
        { icon: ClipboardText, label: 'Issues', path: '/procurement/issues' },
        { icon: CheckCircle, label: 'Resolved', path: '/procurement/resolved' },
    ],
    LOGISTICS_PLANNER: [
        { icon: House, label: 'Overview', path: '/logistics' },
        { icon: Package, label: 'Allocations', path: '/logistics/allocations' },
        { icon: Truck, label: 'Shipments', path: '/logistics/shipments' },
        { icon: CheckCircle, label: 'Delivery Status', path: '/logistics/delivery' },
    ],
    ADMIN: [
        { icon: House, label: 'Overview', path: '/admin' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: Warehouse, label: 'Warehouses', path: '/admin/warehouses' },
        { icon: Package, label: 'Products', path: '/admin/products' },
        { icon: Truck, label: 'Suppliers', path: '/admin/suppliers' },
        { icon: ChartLineUp, label: 'Reports', path: '/admin/reports' },
        { icon: Gear, label: 'Settings', path: '/admin/settings' },
    ],
};

const roleColors: Record<string, string> = {
    DEALER: 'text-blue-400',
    WAREHOUSE_OPERATOR: 'text-green-400',
    PROCUREMENT_MANAGER: 'text-yellow-400',
    LOGISTICS_PLANNER: 'text-purple-400',
    ADMIN: 'text-red-400',
};

export default function DashboardLayout({
    children,
    userRole = 'DEALER',
    userName = 'User',
    userEmail = 'user@example.com',
}: DashboardLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/');
    };

    const menuItems = menuItemsByRole[userRole] || menuItemsByRole.DEALER;
    const roleColor = roleColors[userRole] || 'text-blue-400';

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <div className="scanlines" />

            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 flex flex-col">
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <Package size={32} weight="duotone" className={roleColor} />
                        <div>
                            <h1 className="font-chivo font-bold text-sm uppercase tracking-wider">Import/Export Hub</h1>
                            <p className={`text-xs font-mono ${roleColor}`}>{userRole.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
                            return (
                                <li key={item.path}>
                                    <button
                                        onClick={() => router.push(item.path)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-150 text-sm font-medium ${isActive
                                            ? `${roleColor} bg-slate-800/50 border-l-2 border-current`
                                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                                            }`}
                                    >
                                        <Icon size={20} weight="duotone" />
                                        {item.label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-sm transition-all duration-150 text-sm font-medium"
                    >
                        <SignOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {/* Header */}
                <div className="backdrop-blur-md bg-slate-900/80 border-b border-slate-700 sticky top-0 z-40">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div>
                            <h2 className="font-chivo font-bold text-xl uppercase tracking-wider">Operations Center</h2>
                            <p className="text-xs text-slate-400 font-mono mt-1">Welcome back, {userName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Logged in as</p>
                                <p className="text-sm font-mono text-slate-300">{userEmail}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
