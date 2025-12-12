'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Gear } from '@phosphor-icons/react';

export default function AdminSettingsPage() {
    return (
        <DashboardLayout userRole="ADMIN">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h3 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                        <Gear size={28} /> System Settings
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Platform configuration parameters</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-6 space-y-6">
                    <div>
                        <h4 className="text-sm font-bold uppercase text-slate-300 mb-4 border-b border-slate-700 pb-2">General Configuration</h4>
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                                <label className="text-slate-400 text-sm">Maintenance Mode</label>
                                <div className="w-12 h-6 bg-slate-700 rounded-full relative cursor-pointer">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-slate-400 rounded-full"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-slate-400 text-sm">System Notifications</label>
                                <div className="w-12 h-6 bg-green-900 rounded-full relative cursor-pointer">
                                    <div className="absolute right-1 top-1 w-4 h-4 bg-green-400 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase text-slate-300 mb-4 border-b border-slate-700 pb-2">AI Thresholds</h4>
                        <div className="grid gap-4">
                            <div>
                                <label className="text-slate-400 text-sm block mb-2">Damage Confidence Threshold (%)</label>
                                <input type="range" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" min="0" max="100" defaultValue="85" />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>0% (Lenient)</span>
                                    <span>85% (Strict)</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
