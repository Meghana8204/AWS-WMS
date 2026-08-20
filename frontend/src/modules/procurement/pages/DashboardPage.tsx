import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Truck,
  Layers,
  Search,
  Bell,
  Mail,
  User,
  Heart,
  Plus
} from 'lucide-react';
import { procurementService } from '../services/procurement-service';
import { poService } from '@/modules/purchase-orders/services/po-service';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Queries
  const { data: response, isLoading: isLoadingStats } = useQuery({
    queryKey: ['procurement-dashboard'],
    queryFn: procurementService.getDashboardStats,
  });

  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: poService.getPOs,
  });

  const stats = response?.data || {};

  // Formatted Metrics data based on image
  const cards = [
    {
      label: 'ACTIVE SUPPLIERS',
      value: stats.active_suppliers ?? 1,
      trend: '100%',
      isPositive: true,
      color: 'emerald',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,25 C 20,25 30,22 40,18 C 50,14 60,10 70,12 C 80,14 90,5 100,2" fill="none" stroke="#10b981" strokeWidth="2" />
          <path d="M 0,25 C 20,25 30,22 40,18 C 50,14 60,10 70,12 C 80,14 90,5 100,2 L 100,30 L 0,30 Z" fill="url(#grad-emerald)" opacity="0.1" />
        </svg>
      ),
      icon: Users
    },
    {
      label: 'PENDING APPROVALS',
      value: stats.pending_po_approvals ?? 0,
      trend: '0%',
      isPositive: false,
      color: 'amber',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,20 C 20,22 35,22 50,20 C 65,18 80,24 100,18" fill="none" stroke="#f59e0b" strokeWidth="2" />
          <path d="M 0,20 C 20,22 35,22 50,20 C 65,18 80,24 100,18 L 100,30 L 0,30 Z" fill="url(#grad-amber)" opacity="0.1" />
        </svg>
      ),
      icon: Clock
    },
    {
      label: 'OPERATIONAL POS',
      value: stats.open_pos ?? 2,
      trend: '100%',
      isPositive: true,
      color: 'indigo',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,25 C 20,25 30,20 40,22 C 50,24 60,12 70,15 C 80,18 90,8 100,4" fill="none" stroke="#6366f1" strokeWidth="2" />
          <path d="M 0,25 C 20,25 30,20 40,22 C 50,24 60,12 70,15 C 80,18 90,8 100,4 L 100,30 L 0,30 Z" fill="url(#grad-indigo)" opacity="0.1" />
        </svg>
      ),
      icon: FileText
    },
    {
      label: 'AUTHORIZATION ALERTS',
      value: stats.pending_suppliers ?? 0,
      trend: '0%',
      isPositive: false,
      color: 'rose',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,20 C 20,18 35,24 50,20 C 65,16 80,22 100,14" fill="none" stroke="#f43f5e" strokeWidth="2" />
          <path d="M 0,20 C 20,18 35,24 50,20 C 65,16 80,22 100,14 L 100,30 L 0,30 Z" fill="url(#grad-rose)" opacity="0.1" />
        </svg>
      ),
      icon: AlertTriangle
    },
    {
      label: 'ASSET INTAKE',
      value: stats.partially_received_pos ?? 0,
      trend: '0%',
      isPositive: false,
      color: 'purple',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,22 C 20,22 35,20 50,24 C 65,28 80,18 100,20" fill="none" stroke="#a855f7" strokeWidth="2" />
          <path d="M 0,22 C 20,22 35,20 50,24 C 65,28 80,18 100,20 L 100,30 L 0,30 Z" fill="url(#grad-purple)" opacity="0.1" />
        </svg>
      ),
      icon: Truck
    },
    {
      label: 'PLANNED ARRIVALS',
      value: stats.planned_arrivals ?? 0,
      trend: '100%',
      isPositive: true,
      color: 'sky',
      sparkline: (
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M 0,25 C 20,22 35,24 50,18 C 65,12 80,15 100,5" fill="none" stroke="#0ea5e9" strokeWidth="2" />
          <path d="M 0,25 C 20,22 35,24 50,18 C 65,12 80,15 100,5 L 100,30 L 0,30 Z" fill="url(#grad-sky)" opacity="0.1" />
        </svg>
      ),
      icon: Activity
    }
  ];

  if (isLoadingStats || isLoadingPOs) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Gradients for SVG charts
  const svgGradients = (
    <svg className="absolute w-0 h-0" width="0" height="0">
      <defs>
        <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-indigo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-rose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-purple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <div className="space-y-6 animate-premium-fade">
      {svgGradients}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tighter">Command Overview</h1>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">System Intelligence Terminal — Inbound Acquisition Protocol</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Last 30 Days</span>
            <span className="text-[9px] text-slate-400">▼</span>
          </div>
        </div>
      </div>

      {/* Metrics Row (6 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, idx) => {
          const colorClass = 
            card.color === 'emerald' ? 'text-emerald-500 bg-emerald-50 border-emerald-100/50' :
            card.color === 'amber' ? 'text-amber-500 bg-amber-50 border-amber-100/50' :
            card.color === 'indigo' ? 'text-indigo-500 bg-indigo-50 border-indigo-100/50' :
            card.color === 'rose' ? 'text-rose-500 bg-rose-50 border-rose-100/50' :
            card.color === 'purple' ? 'text-purple-500 bg-purple-50 border-purple-100/50' :
            'text-sky-500 bg-sky-50 border-sky-100/50';

          return (
            <div key={idx} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorClass}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-[8px] font-black tracking-widest uppercase mb-0.5">{card.label}</p>
                <h3 className="text-2xl font-black text-slate-900 leading-none">{card.value}</h3>
              </div>

              <div className="mt-3 flex items-center gap-1">
                <span className={`text-[9px] font-bold ${card.isPositive ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {card.isPositive ? '↑' : '↓'} {card.trend}
                </span>
                <span className="text-[8px] text-slate-400 font-medium">vs last 30 days</span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-8 opacity-60 group-hover:opacity-100 transition-opacity">
                {card.sparkline}
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Row: Partner Proposals & Expedited Acquisitions */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column: Partner Proposals */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">PARTNER PROPOSALS</h3>
            <span className="text-[10px] font-bold text-indigo-600 cursor-pointer hover:underline flex items-center gap-0.5">
              AUDIT PORTAL <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center z-10">
            {/* Circular glowing graphic */}
            <div className="w-32 h-32 rounded-full border border-indigo-100 bg-indigo-50/20 flex items-center justify-center relative mb-4">
              <div className="absolute inset-2 rounded-full border border-indigo-100/50 animate-ping" />
              <div className="absolute inset-4 rounded-full border border-indigo-100/80 bg-white shadow-inner flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-indigo-600" />
              </div>
            </div>

            <h4 className="text-sm font-black text-slate-800 tracking-tight">PROTOCOL CLEAR</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-[200px] leading-relaxed">All systems validated. No pending proposals.</p>
          </div>
        </div>

        {/* Right Column: Expedited Acquisitions */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">EXPEDITED ACQUISITIONS</h3>
            <span className="text-[10px] font-bold text-indigo-600 cursor-pointer hover:underline flex items-center gap-0.5" onClick={() => navigate('/purchase-orders')}>
              REGISTRY ACCESS <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[9px]">
                  <th className="py-3">IDENTIFIER</th>
                  <th className="py-3">ASSIGNEE</th>
                  <th className="py-3">EXPOSURE</th>
                  <th className="py-3 text-right">PROTOCOL PHASE</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length > 0 ? (
                  purchaseOrders.slice(0, 2).map((po: any) => (
                    <tr key={po.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4">
                        <div className="font-extrabold text-slate-800">#{po.po_number}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{po.po_date}</div>
                      </td>
                      <td className="py-4 font-bold text-slate-700">
                        <div className="flex items-center gap-1">
                          {po.supplier_name || 'ABC Electrical'}
                          <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px]">✓</span>
                        </div>
                      </td>
                      <td className="py-4 font-black text-slate-900">
                        ₹{Number(po.net_amount).toLocaleString()}
                      </td>
                      <td className="py-4 text-right">
                        <span
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black tracking-wider cursor-pointer hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          {po.status} <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr className="border-b border-slate-50">
                      <td className="py-4">
                        <div className="font-extrabold text-slate-800">#PO-2026-00006</div>
                        <div className="text-[10px] text-slate-400 font-medium">2026-08-10</div>
                      </td>
                      <td className="py-4 font-bold text-slate-700">
                        <div className="flex items-center gap-1">
                          ABC Electrical
                          <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px]">✓</span>
                        </div>
                      </td>
                      <td className="py-4 font-black text-slate-900">$100,000</td>
                      <td className="py-4 text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black tracking-wider cursor-pointer">
                          OPEN <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-50 last:border-0">
                      <td className="py-4">
                        <div className="font-extrabold text-slate-800">#PO-2026-00001</div>
                        <div className="text-[10px] text-slate-400 font-medium">2026-08-10</div>
                      </td>
                      <td className="py-4 font-bold text-slate-700">
                        <div className="flex items-center gap-1">
                          ABC Electrical
                          <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px]">✓</span>
                        </div>
                      </td>
                      <td className="py-4 font-black text-slate-900">$2,500,000</td>
                      <td className="py-4 text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black tracking-wider cursor-pointer">
                          OPEN <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Bottom Grid: System Health, Procurement Flow, Alert Feed, Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* 1. System Health */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-6">SYSTEM HEALTH</h3>
          <div className="flex items-center justify-between gap-4">
            {/* Circular Progress Ring */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                <circle cx="48" cy="48" r="40" stroke="#6366f1" strokeWidth="8" fill="transparent"
                        strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - 0.98)} strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <span className="text-lg font-black text-slate-900">98%</span>
                <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wide">OPTIMAL</p>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Core Services</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Database</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Network</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Security</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Procurement Flow */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-6">PROCUREMENT FLOW</h3>
          <div className="relative flex flex-col justify-between h-28 py-2">
            {/* Background wave line connecting nodes */}
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-indigo-50 -translate-y-1/2" />
            
            <div className="flex items-center justify-between z-10">
              {[
                { id: 'intake', label: 'Intake', active: true },
                { id: 'eval', label: 'Evaluation', active: true },
                { id: 'auth', label: 'Authorization', active: true },
                { id: 'exec', label: 'Execution', active: false },
                { id: 'comp', label: 'Complete', active: false }
              ].map((step, sIdx) => (
                <div key={sIdx} className="flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    step.active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {sIdx + 1}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider ${
                    step.active ? 'text-indigo-600' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Alert Feed */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">ALERT FEED</h3>
          
          <div className="space-y-3 flex-1 overflow-y-auto max-h-32 pr-1">
            {/* Alert 1 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-800 truncate">Authorization Required</span>
                  <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap">2m ago</span>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold truncate">Vendor ABC Electrical requesting approval</p>
              </div>
            </div>

            {/* Alert 2 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-500 shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-800 truncate">New Planned Arrival</span>
                  <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap">15m ago</span>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold truncate">2 shipments scheduled for tomorrow</p>
              </div>
            </div>

            {/* Alert 3 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-500 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-800 truncate">System Update</span>
                  <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap">1h ago</span>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold truncate">Core protocols synchronized successfully</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-3 mt-3 text-center">
            <span className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer">
              View All Alerts →
            </span>
          </div>
        </div>

        {/* 4. Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">QUICK ACTIONS</h3>
          
          <div className="flex-1 flex items-center justify-center relative py-2">
            {/* Orbital Layout */}
            <div className="relative w-24 h-24 flex items-center justify-center border border-indigo-50 rounded-full bg-indigo-50/10">
              {/* Central Plus Node */}
              <div
                onClick={() => navigate('/purchase-orders/create')}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-all z-20 group hover:scale-105"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </div>

              {/* Orbiting Icons */}
              <div className="absolute top-0 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => navigate('/suppliers')}>
                <Users className="w-3 h-3" />
              </div>
              <div className="absolute right-0 translate-x-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => navigate('/purchase-orders')}>
                <FileText className="w-3 h-3" />
              </div>
              <div className="absolute bottom-0 translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => navigate('/asns')}>
                <Truck className="w-3 h-3" />
              </div>
              <div className="absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => navigate('/masters')}>
                <Layers className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
