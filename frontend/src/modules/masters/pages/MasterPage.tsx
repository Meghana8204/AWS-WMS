import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Database, Ruler, DollarSign, CreditCard } from 'lucide-react';
import { mastersService } from '../services/masters-service';
import { Table } from '@/components/common/Table';

export const MasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'uoms' | 'currencies' | 'payment-terms'>('categories');

  const { data: categories = [], isLoading: isLoadingCats } = useQuery({
    queryKey: ['categories'],
    queryFn: mastersService.getCategories,
  });

  const { data: uoms = [], isLoading: isLoadingUOMs } = useQuery({
    queryKey: ['uoms'],
    queryFn: mastersService.getUOMs,
  });

  const { data: currencies = [], isLoading: isLoadingCurrs } = useQuery({
    queryKey: ['currencies'],
    queryFn: mastersService.getCurrencies,
  });

  const { data: paymentTerms = [], isLoading: isLoadingTerms } = useQuery({
    queryKey: ['payment-terms'],
    queryFn: mastersService.getPaymentTerms,
  });

  const tabs = [
    { id: 'categories', label: 'Categories', icon: Database },
    { id: 'uoms', label: 'Units of Measure', icon: Ruler },
    { id: 'currencies', label: 'Currencies', icon: DollarSign },
    { id: 'payment-terms', label: 'Payment Terms', icon: CreditCard },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'categories':
        return (
          <Table
            columns={[
              { header: 'Code', accessor: 'code' as any },
              { header: 'Name', accessor: 'name' as any },
              { header: 'Description', accessor: 'description' as any },
              { header: 'Status', accessor: 'status' as any },
            ]}
            data={categories}
            isLoading={isLoadingCats}
          />
        );
      case 'uoms':
        return (
          <Table
            columns={[
              { header: 'Code', accessor: 'code' as any },
              { header: 'Name', accessor: 'name' as any },
              { header: 'Symbol', accessor: 'symbol' as any },
            ]}
            data={uoms}
            isLoading={isLoadingUOMs}
          />
        );
      case 'currencies':
        return (
          <Table
            columns={[
              { header: 'Code', accessor: 'code' as any },
              { header: 'Name', accessor: 'name' as any },
              { header: 'Symbol', accessor: 'symbol' as any },
              { header: 'Rate', accessor: (item: any) => item.exchange_rate.toString() },
            ]}
            data={currencies}
            isLoading={isLoadingCurrs}
          />
        );
      case 'payment-terms':
        return (
          <Table
            columns={[
              { header: 'Code', accessor: 'code' as any },
              { header: 'Name', accessor: 'name' as any },
              { header: 'Days', accessor: (item: any) => item.days.toString() },
              { header: 'Description', accessor: 'description' as any },
            ]}
            data={paymentTerms}
            isLoading={isLoadingTerms}
          />
        );
    }
  };

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <Settings className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Configuration</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">System Masters</h1>
        <p className="text-slate-500 font-medium italic mt-1">Core reference data and global configuration</p>
      </div>

      <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-[32px] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-3 rounded-3xl text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        {renderContent()}
      </div>
    </div>
  );
};
