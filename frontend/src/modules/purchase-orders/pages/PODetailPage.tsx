import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Building2,
  Warehouse,
  Calendar,
  DollarSign,
  ArrowLeft,
  CheckCircle2,
  Send,
  Plus,
  Trash2,
  Package
} from 'lucide-react';
import { poService } from '../services/po-service';
import { Button } from '@/components/common/Button';
import { Table } from '@/components/common/Table';

export const PODetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('lines');

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => poService.getPO(id!),
    enabled: !!id && id !== 'create',
  });

  const submitMutation = useMutation({
    mutationFn: () => poService.submitPO(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => poService.approvePO(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  });

  if (isLoading || !po) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const lineColumns = [
    {
      header: 'Item',
      accessor: (item: any) => (
        <div>
          <div className="font-extrabold text-slate-900">{item.item_name}</div>
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.item_code}</div>
        </div>
      ),
    },
    { header: 'Quantity', accessor: (item: any) => `${item.quantity} ${item.uom_symbol}` },
    { header: 'Unit Price', accessor: (item: any) => `₹${item.unit_price}` },
    { header: 'Tax', accessor: (item: any) => `${item.tax_percentage}%` },
    {
      header: 'Total',
      accessor: (item: any) => (
        <span className="font-black text-slate-900">₹{item.line_total}</span>
      ),
    },
    {
      header: 'Status',
      accessor: (item: any) => (
        <div className="flex flex-col gap-1">
           <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
              <span>Recv: {item.received_quantity}</span>
              <span>/ {item.quantity}</span>
           </div>
           <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(item.received_quantity / item.quantity) * 100}%` }}
              />
           </div>
        </div>
      )
    }
  ];

  return (
    <div className="animate-premium-fade space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">{po.po_number}</h1>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 bg-indigo-50 text-indigo-600`}>
                {po.status}
              </span>
            </div>
            <p className="text-slate-500 font-medium text-lg italic">{po.supplier_name}</p>
          </div>
        </div>

        <div className="flex gap-4">
           {po.status === 'DRAFT' && (
             <Button onClick={() => submitMutation.mutate()} isLoading={submitMutation.isPending}>
                <Send className="w-4 h-4 mr-2" />
                SUBMIT FOR APPROVAL
             </Button>
           )}
           {po.status === 'SUBMITTED' && (
             <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate()} isLoading={approveMutation.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                APPROVE ORDER
             </Button>
           )}
           {po.status === 'APPROVED' && (
             <Button className="bg-indigo-600">
                <Send className="w-4 h-4 mr-2" />
                TRANSMIT TO SUPPLIER
             </Button>
           )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operating Entity</p>
            <div className="flex items-center gap-2 font-bold text-slate-900">
               <Building2 className="w-4 h-4 text-indigo-600" />
               {po.company_name}
            </div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination Facility</p>
            <div className="flex items-center gap-2 font-bold text-slate-900">
               <Warehouse className="w-4 h-4 text-indigo-600" />
               {po.warehouse_name}
            </div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Target</p>
            <div className="flex items-center gap-2 font-bold text-slate-900">
               <Calendar className="w-4 h-4 text-indigo-600" />
               {new Date(po.expected_delivery_date).toLocaleDateString()}
            </div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm bg-slate-900 border-slate-800">
            <p className="text-[10px] font-black text-slate-400/60 uppercase tracking-widest mb-1">Net Commitment</p>
            <div className="flex items-center gap-2 font-bold text-white text-xl">
               <DollarSign className="w-5 h-5 text-emerald-400" />
               {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(po.net_amount)}
            </div>
         </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-2 premium-shadow overflow-hidden">
         <div className="p-4 border-b border-slate-50 flex items-center gap-2">
            {[
              { id: 'lines', label: 'Line Items', icon: Package },
              { id: 'history', label: 'Approval History', icon: FileText },
              { id: 'documents', label: 'Documents', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
         </div>

         <div className="p-2">
            {activeTab === 'lines' && (
              <>
                <div className="p-6 flex items-center justify-between">
                   <h3 className="text-lg font-extrabold text-slate-900">Ordered Assets</h3>
                   {po.status === 'DRAFT' && (
                     <Button variant="ghost" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        ADD ITEM
                     </Button>
                   )}
                </div>
                <Table columns={lineColumns} data={po.lines || []} />
              </>
            )}

            {activeTab !== 'lines' && (
              <div className="py-32 text-center text-slate-400 italic flex flex-col items-center gap-4">
                 <FileText className="w-12 h-12 text-slate-100" />
                 <p>Additional registries are being synthesized...</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
