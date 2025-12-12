'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { ChartLineUp, ChartBar, ChartPie } from '@phosphor-icons/react';

export default function AdminReportsPage() {
    return (
        <DashboardLayout userRole="ADMIN">
            <div className="space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider">System Reports</h3>
                    <p className="text-slate-400 text-sm mt-1">Analytics and performance metrics</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-sm hover:border-blue-500/50 transition-colors cursor-pointer group">
                        <ChartLineUp size={32} className="text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
                        <h4 className="text-lg font-bold text-slate-200 mb-2">Demand Forecast</h4>
                        <p className="text-slate-400 text-sm">AI-driven prediction of product demand for the next quarter.</p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-sm hover:border-green-500/50 transition-colors cursor-pointer group">
                        <ChartBar size={32} className="text-green-400 mb-4 group-hover:scale-110 transition-transform" />
                        <h4 className="text-lg font-bold text-slate-200 mb-2">Inventory Turnover</h4>
                        <p className="text-slate-400 text-sm">Efficiency analytics for warehouse stock movement.</p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-sm hover:border-purple-500/50 transition-colors cursor-pointer group">
                        <ChartPie size={32} className="text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
                        <h4 className="text-lg font-bold text-slate-200 mb-2">Supplier Performance</h4>
                        <p className="text-slate-400 text-sm">Reliability scores and lead time analysis by region.</p>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-8 text-center rounded-sm">
                    <p className="text-slate-500 font-mono text-sm">More detailed reporting modules coming soon...</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
