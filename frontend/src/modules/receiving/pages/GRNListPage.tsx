import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageCheck, Search, Calendar, FileText } from 'lucide-react';
import { receivingService } from '../services/receiving-service';
import { Table } from '@/components/common/Table';
import { GRN } from '../types';

export const GRNListPage: React.FC = () => {
  const { data: grns = [], isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: receivingService.getGRNs,
  });

  const columns = [
    {
      header: 'GRN Number',
      accessor: (item: GRN) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <PackageCheck className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-slate-900">{item.grn_number}</span>
        </div>
      ),
    },
    { header: 'PO Ref', accessor: 'po_number' as any },
    { header: 'Supplier', accessor: 'supplier_name' as any },
    {
      header: 'Receipt Date',
      accessor: (item: GRN) => (
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-bold">{new Date(item.receipt_date).toLocaleString()}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item: GRN) => (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600">
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <PackageCheck className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Inventory Receipt</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Goods Receiving (GRN)</h1>
        <p className="text-slate-500 font-medium italic mt-1">Official proof of receipt and inventory commitment</p>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search records by number, supplier or PO..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={grns} isLoading={isLoading} />
      </div>
    </div>
  );
};
