import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        label: string;
    };
    icon?: ReactNode;
    children?: ReactNode;
    className?: string;
    variant?: 'default' | 'dealer' | 'warehouse' | 'procurement' | 'logistics' | 'admin';
    onClick?: () => void;
}

const variantColors = {
    default: 'hover:border-blue-500/30',
    dealer: 'hover:border-blue-500/30',
    warehouse: 'hover:border-green-500/30',
    procurement: 'hover:border-yellow-500/30',
    logistics: 'hover:border-purple-500/30',
    admin: 'hover:border-red-500/30',
};

export default function DashboardCard({
    title,
    value,
    change,
    icon,
    children,
    className = '',
    variant = 'default',
    onClick,
}: DashboardCardProps) {
    return (
        <div
            onClick={onClick}
            className={`
                bg-slate-800/40 border border-slate-700/60 rounded-sm p-6
                transition-all duration-300
                hover:shadow-xl hover:-translate-y-1
                ${variantColors[variant]}
                group
                ${onClick ? 'cursor-pointer' : ''}
                ${className}
            `}
        >
            <div className="flex items-start justify-between mb-4">
                <h3 className="text-slate-400 text-xs uppercase tracking-wider font-mono">
                    {title}
                </h3>
                {icon && (
                    <div className="text-slate-500 transition-all duration-300 group-hover:text-blue-400 group-hover:scale-110">
                        {icon}
                    </div>
                )}
            </div>

            <div className="mb-2">
                <div className="text-3xl font-bold text-slate-100 transition-all duration-300 group-hover:text-blue-400">
                    {value}
                </div>
            </div>

            {change && (
                <div className="flex items-center gap-1 text-sm">
                    {change.value > 0 ? (
                        <>
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-semibold">+{change.value}</span>
                        </>
                    ) : change.value < 0 ? (
                        <>
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-semibold">{change.value}</span>
                        </>
                    ) : null}
                    <span className="text-slate-500 ml-1">{change.label}</span>
                </div>
            )}

            {children && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    {children}
                </div>
            )}
        </div>
    );
}
