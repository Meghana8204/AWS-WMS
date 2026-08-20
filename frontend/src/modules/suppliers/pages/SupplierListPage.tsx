import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter } from 'lucide-react';
import { suppliersService } from '../services/suppliers-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { Supplier } from '../types';
import { useNavigate } from 'react-router-dom';
import { SupplierWizard } from '../components/SupplierWizard';

export const SupplierListPage: React.FC = () => {
  const navigate = useNavigate();
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersService.getSuppliers,
  });

  const columns = [
    {
      header: 'Identifier',
      accessor: (s: Supplier) => (
        <span className="font-bold text-slate-900 tracking-tight">{s.supplier_code}</span>
      )
    },
    {
      header: 'Entity Name',
      accessor: (s: Supplier) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{s.supplier_name}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.industry}</span>
        </div>
      )
    },
    { header: 'Country', accessor: 'country' as const },
    {
      header: 'Protocol Phase',
      accessor: (s: Supplier) => (
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
          s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
          s.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
          'bg-slate-100 text-slate-500 border-slate-200'
        }`}>
          {s.status}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (s: Supplier) => (
        <Button variant="ghost" size="sm" className="font-bold text-xs text-indigo-600 uppercase tracking-widest">
          Inspect
        </Button>
      )
    },
  ];

  return (
    <div className="animate-premium-fade space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Supplier Registry</h1>
          <p className="text-slate-500 font-medium text-lg italic">Master ledger for all organizational supply partners</p>
        </div>
        <Button
          onClick={() => setIsWizardOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[0.2em] px-10 py-5 rounded-[20px] shadow-2xl shadow-indigo-200 flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          <span>New Entity Onboarding</span>
        </Button>
      </div>

      <SupplierWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />

      <div className="bg-white border border-slate-200 p-6 rounded-[32px] flex flex-col lg:flex-row gap-6 shadow-sm">
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-50/50 border border-slate-100 text-slate-900 pl-14 pr-6 py-4 rounded-[18px] focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-bold placeholder:text-slate-300 shadow-inner"
            placeholder="Search by code, name or industry..."
          />
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="px-6 py-4 rounded-[18px] flex gap-2">
            <Filter className="w-4 h-4" />
            <span>Advanced Filters</span>
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
      />
    </div>
  );
};
