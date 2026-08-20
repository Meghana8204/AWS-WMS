import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, ClipboardList } from 'lucide-react';
import { poService } from '../services/po-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { PurchaseOrder } from '../types';
import { useNavigate } from 'react-router-dom';

export const PORegistryPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: poService.getOrders,
  });

  const columns = [
    {
      header: 'Identifier',
      accessor: (po: PurchaseOrder) => (
        <span className="font-bold text-slate-900 tracking-tight">#{po.po_number}</span>
      )
    },
    {
      header: 'Supply Partner',
      accessor: (po: PurchaseOrder) => (
        <span className="font-bold text-slate-700">{po.supplier_name}</span>
      )
    },
    {
      header: 'Net Valuation',
      accessor: (po: PurchaseOrder) => (
        <div className="flex flex-col">
          <span className="font-black text-slate-900">${Number(po.net_amount).toLocaleString()}</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{po.po_type}</span>
        </div>
      )
    },
    { header: 'ETA', accessor: 'expected_delivery_date' as const },
    {
      header: 'Workflow Phase',
      accessor: (po: PurchaseOrder) => (
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
          po.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
          po.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
          'bg-indigo-50 text-indigo-600 border-indigo-100'
        }`}>
          {po.status}
        </span>
      )
    },
  ];

  return (
    <div className="animate-premium-fade space-y-8">
      <div className="flex items-end justify-between px-1">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Purchase Registry</h1>
          <p className="text-slate-500 font-medium text-lg italic">Strategic acquisition ledger and commitment monitoring</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[0.2em] px-10 py-5 rounded-[20px] shadow-2xl shadow-indigo-200 flex items-center gap-3">
          <Plus className="w-5 h-5" />
          <span>New Acquisition Order</span>
        </Button>
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-[32px] flex flex-col lg:flex-row gap-6 shadow-sm">
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-50/50 border border-slate-100 text-slate-900 pl-14 pr-6 py-4 rounded-[18px] focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-bold placeholder:text-slate-300 shadow-inner"
            placeholder="Search identifier, vendor or line items..."
          />
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="px-8 py-4 rounded-[18px] flex gap-3 text-xs font-black uppercase tracking-widest">
            <Filter className="w-4 h-4" />
            <span>Refine Ledger</span>
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={orders}
        isLoading={isLoading}
        onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
      />
    </div>
  );
};
