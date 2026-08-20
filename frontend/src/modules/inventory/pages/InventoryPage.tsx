import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Search, BarChart3, ShieldAlert } from 'lucide-react';
import { inventoryService } from '../services/inventory-service';
import { Table } from '@/components/common/Table';
import { InventoryBalance } from '../types';

export const InventoryPage: React.FC = () => {
  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['inventory-balances'],
    queryFn: inventoryService.getBalances,
  });

  const columns = [
    {
      header: 'Item',
      accessor: (item: InventoryBalance) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900">{item.item_name}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-tight">{item.item_code}</div>
          </div>
        </div>
      ),
    },
    { header: 'Total Stock', accessor: 'total_quantity' as any },
    {
      header: 'Available',
      accessor: (item: InventoryBalance) => (
        <span className="font-bold text-emerald-600">{item.available_quantity}</span>
      ),
    },
    {
      header: 'On Hold',
      accessor: (item: InventoryBalance) => (
        <span className={`font-bold ${item.on_hold_quantity > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
          {item.on_hold_quantity}
        </span>
      ),
    },
    { header: 'Reserved', accessor: 'reserved_quantity' as any },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <BarChart3 className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Asset Intelligence</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Inventory Balances</h1>
        <p className="text-slate-500 font-medium italic mt-1">Real-time stock levels and allocation status</p>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search inventory by name, code or warehouse..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={balances} isLoading={isLoading} />
      </div>
    </div>
  );
};
