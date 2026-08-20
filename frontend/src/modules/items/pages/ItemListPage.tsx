import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Box, MoreVertical, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';
import { itemService } from '../services/item-service';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ItemForm } from '../components/ItemForm';
import { Item } from '../types';

export const ItemListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: itemService.getItems,
  });

  const createMutation = useMutation({
    mutationFn: itemService.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Item>) => itemService.updateItem(editingItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
  });

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const columns = [
    {
      header: 'Catalog Item',
      accessor: (item: Item) => (
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
    {
      header: 'Category',
      accessor: (item: Item) => (
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide bg-slate-50 px-3 py-1 rounded-lg">
          {item.category_name || 'Uncategorized'}
        </span>
      ),
    },
    {
      header: 'Control Flags',
      accessor: (item: Item) => (
        <div className="flex items-center gap-2">
          {item.serial_controlled && <Zap className="w-4 h-4 text-amber-500" title="Serial Controlled" />}
          {item.safety_critical && <ShieldCheck className="w-4 h-4 text-emerald-500" title="Safety Critical" />}
          {item.hazardous && <AlertTriangle className="w-4 h-4 text-rose-500" title="Hazardous" />}
        </div>
      ),
    },
    {
      header: 'UOM',
      accessor: (item: Item) => <span className="text-sm font-medium text-slate-600">{item.uom_name || '-'}</span>
    },
    {
      header: 'Actions',
      accessor: (item: Item) => (
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
            <Box className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Inventory</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Item Master</h1>
          <p className="text-slate-500 font-medium italic mt-1">Unified product catalog and traceability configuration</p>
        </div>

        <Button icon={<Plus className="w-5 h-5" />} onClick={() => {
          setEditingItem(null);
          setIsModalOpen(true);
        }}>
          ADD ITEM
        </Button>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search catalog by name, code or category..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={items} isLoading={isLoading} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Update Catalog Item' : 'Register New Item'}
      >
        <ItemForm
          initialData={editingItem}
          onSubmit={(values) => {
            if (editingItem) {
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
