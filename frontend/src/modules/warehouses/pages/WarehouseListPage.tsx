import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Warehouse as WarehouseIcon, MoreVertical, MapPin } from 'lucide-react';
import { warehouseService } from '../services/warehouse-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { WarehouseForm } from '../components/WarehouseForm';
import { Warehouse } from '../types';

export const WarehouseListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseService.getWarehouses,
  });

  const createMutation = useMutation({
    mutationFn: warehouseService.createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Warehouse>) => warehouseService.updateWarehouse(editingWarehouse!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsModalOpen(false);
      setEditingWarehouse(null);
    },
  });

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const columns = [
    {
      header: 'Warehouse',
      accessor: (item: Warehouse) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
            <WarehouseIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900">{item.warehouse_name}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-tight">{item.warehouse_code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Location',
      accessor: (item: Warehouse) => (
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className="w-4 h-4" />
          <span>{item.country}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item: Warehouse) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
          item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {item.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (item: Warehouse) => (
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
            <WarehouseIcon className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Logistics</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Warehouse Master</h1>
          <p className="text-slate-500 font-medium italic mt-1">Strategic distribution facility registry</p>
        </div>

        <Button icon={<Plus className="w-5 h-5" />} onClick={() => {
          setEditingWarehouse(null);
          setIsModalOpen(true);
        }}>
          ADD FACILITY
        </Button>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search facilities by name, code or location..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={warehouses} isLoading={isLoading} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWarehouse ? 'Update Facility' : 'Register New Facility'}
      >
        <WarehouseForm
          initialData={editingWarehouse}
          onSubmit={(values) => {
            if (editingWarehouse) {
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
