import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Item } from '../types';
import { useQuery } from '@tanstack/react-query';
import { mastersService } from '@/modules/masters/services/masters-service';

const itemSchema = z.object({
  item_code: z.string().min(2, 'Item code is required'),
  item_name: z.string().min(2, 'Item name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  uom: z.string().min(1, 'UOM is required'),
  serial_controlled: z.boolean().default(false),
  batch_controlled: z.boolean().default(false),
  hazardous: z.boolean().default(false),
  high_value: z.boolean().default(false),
  safety_critical: z.boolean().default(false),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemFormProps {
  initialData?: Item | null;
  onSubmit: (values: ItemFormValues) => void;
  isLoading?: boolean;
}

export const ItemForm: React.FC<ItemFormProps> = ({ initialData, onSubmit, isLoading }) => {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: mastersService.getCategories,
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: mastersService.getUOMs,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: initialData || {
      item_code: '',
      item_name: '',
      description: '',
      category: '',
      uom: '',
      serial_controlled: false,
      batch_controlled: false,
      hazardous: false,
      high_value: false,
      safety_critical: false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Item Code"
          placeholder="e.g. COMP-99"
          error={errors.item_code?.message}
          {...register('item_code')}
        />
        <Input
          label="Item Name"
          placeholder="e.g. Lithium Cell B2"
          error={errors.item_name?.message}
          {...register('item_name')}
        />
      </div>

      <Input
        label="Description"
        placeholder="Detailed technical specification"
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
            Category
          </label>
          <select
            {...register('category')}
            className="w-full px-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="">Select Category...</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
            Base UOM
          </label>
          <select
            {...register('uom')}
            className="w-full px-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="">Select UOM...</option>
            {uoms.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Control Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
           {[
             { label: 'Serial Controlled', name: 'serial_controlled' },
             { label: 'Batch Controlled', name: 'batch_controlled' },
             { label: 'Hazardous Material', name: 'hazardous' },
             { label: 'High Value Item', name: 'high_value' },
             { label: 'Safety Critical', name: 'safety_critical' },
           ].map((flag) => (
             <label key={flag.name} className="flex items-center gap-3 cursor-pointer group">
               <input
                 type="checkbox"
                 {...register(flag.name as any)}
                 className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20 transition-all"
               />
               <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                 {flag.label}
               </span>
             </label>
           ))}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'UPDATE ITEM' : 'REGISTER ITEM'}
        </Button>
      </div>
    </form>
  );
};
