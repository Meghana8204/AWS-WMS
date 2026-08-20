import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, Search, Calendar, Hash } from 'lucide-react';
import { asnService } from '../services/asn-service';
import { Table } from '@/components/common/Table';
import { ASN } from '../types';

export const ASNListPage: React.FC = () => {
  const { data: asns = [], isLoading } = useQuery({
    queryKey: ['asns'],
    queryFn: asnService.getASNs,
  });

  const columns = [
    {
      header: 'ASN Number',
      accessor: (item: ASN) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
            <Hash className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-slate-900">{item.asn_number}</span>
        </div>
      ),
    },
    { header: 'PO Reference', accessor: 'po_number' as any },
    { header: 'Carrier', accessor: 'carrier' as any },
    {
      header: 'Expected Arrival',
      accessor: (item: ASN) => (
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-bold">{new Date(item.expected_arrival_date).toLocaleString()}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item: ASN) => (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600">
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <Truck className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Logistics</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Advanced Shipping Notices</h1>
        <p className="text-slate-500 font-medium italic mt-1">Pre-arrival shipment notifications and carrier integration</p>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search notices by number or carrier..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={asns} isLoading={isLoading} />
      </div>
    </div>
  );
};
