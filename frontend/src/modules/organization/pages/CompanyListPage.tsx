import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, MoreVertical } from 'lucide-react';
import { organizationService } from '../services/organization-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { CompanyForm } from '../components/CompanyForm';
import { Company } from '../types';

export const CompanyListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: organizationService.getCompanies,
  });

  const createMutation = useMutation({
    mutationFn: organizationService.createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Company>) => organizationService.updateCompany(editingCompany!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsModalOpen(false);
      setEditingCompany(null);
    },
  });

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const columns = [
    {
      header: 'Company',
      accessor: (item: Company) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold border border-slate-100">
            {item.company_code.substring(0, 2)}
          </div>
          <div>
            <div className="font-extrabold text-slate-900">{item.company_name}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-tight">{item.company_code}</div>
          </div>
        </div>
      ),
    },
    { header: 'Legal Name', accessor: 'legal_name' as keyof Company },
    { header: 'Country', accessor: 'country' as keyof Company },
    { header: 'Currency', accessor: 'base_currency' as keyof Company },
    {
      header: 'Status',
      accessor: (item: Company) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
          item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (item: Company) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(item);
          }}
          className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Registry</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Organization Master</h1>
          <p className="text-slate-500 font-medium italic mt-1">Multi-entity corporate structure management</p>
        </div>

        <Button icon={<Plus className="w-5 h-5" />} onClick={() => {
          setEditingCompany(null);
          setIsModalOpen(true);
        }}>
          ADD ENTITY
        </Button>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search entities by name or code..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={companies} isLoading={isLoading} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCompany ? 'Update Entity' : 'Register New Entity'}
      >
        <CompanyForm
          initialData={editingCompany}
          onSubmit={(values) => {
            if (editingCompany) {
              updateMutation.mutate(values);
            } else {
              createMutation.mutate(values);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  );
};
