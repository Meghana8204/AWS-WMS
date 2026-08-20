import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, FileText, MoreVertical, Calendar, User } from 'lucide-react';
import { poService } from '../services/po-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder } from '../types';

export const POListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: poService.getPOs,
  });

  const columns = [
    {
      header: 'Purchase Order',
      accessor: (item: PurchaseOrder) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900">{item.po_number}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-tight">{item.po_type}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Supplier',
      accessor: (item: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">{item.supplier_name}</span>
        </div>
      ),
    },
    {
      header: 'Value',
      accessor: (item: PurchaseOrder) => (
        <span className="font-black text-slate-900">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.net_amount)}
        </span>
      ),
    },
    {
      header: 'Expected Delivery',
      accessor: (item: PurchaseOrder) => (
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-bold">{new Date(item.expected_delivery_date).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: 'Workflow',
      accessor: (item: PurchaseOrder) => {
        const colors: any = {
          DRAFT: 'bg-slate-100 text-slate-500',
          SUBMITTED: 'bg-amber-50 text-amber-600',
          APPROVED: 'bg-emerald-50 text-emerald-600',
          SENT: 'bg-indigo-50 text-indigo-600',
        };
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${colors[item.status] || 'bg-slate-50'}`}>
            {item.status}
          </span>
        );
      },
    },
    {
      header: 'Receipt',
      accessor: (item: PurchaseOrder) => {
        const colors: any = {
          OPEN: 'bg-slate-100 text-slate-500',
          PARTIALLY_RECEIVED: 'bg-sky-50 text-sky-600',
          FULLY_RECEIVED: 'bg-emerald-50 text-emerald-600',
        };
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${colors[item.receipt_status] || 'bg-slate-50'}`}>
            {item.receipt_status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Acquisition</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Purchase Orders</h1>
          <p className="text-slate-500 font-medium italic mt-1">Enterprise acquisition and commitment management</p>
        </div>

        <Button icon={<Plus className="w-5 h-5" />} onClick={() => navigate('/purchase-orders/create')}>
          NEW ORDER
        </Button>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search orders by number, supplier or item..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table
          columns={columns}
          data={pos}
          isLoading={isLoading}
          onRowClick={(item) => navigate(`/purchase-orders/${item.id}`)}
        />
      </div>
    </div>
  );
};
