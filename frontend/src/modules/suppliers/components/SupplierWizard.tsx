import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { suppliersService } from '../services/suppliers-service';
import { mastersService } from '@/modules/masters/services/masters-service';

const supplierSchema = z.object({
  supplier_name: z.string().min(2, 'Name is required'),
  registered_company_name: z.string().min(2, 'Legal name is required'),
  vendor_type: z.string().min(1, 'Vendor type is required'),
  industry: z.string().min(1, 'Industry is required'),
  country: z.string().min(1, 'Country is required'),
  default_currency: z.string().min(1, 'Currency is required'),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupplierWizard: React.FC<SupplierWizardProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: mastersService.getCurrencies,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      default_currency: currencies[0]?.id || ''
    }
  });

  const mutation = useMutation({
    mutationFn: suppliersService.createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
      reset();
    },
  });

  const onSubmit = (values: SupplierFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partner Onboarding Protocol"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abort Protocol</Button>
          <Button
            className="bg-indigo-600"
            onClick={handleSubmit(onSubmit)}
            isLoading={mutation.isPending}
          >
            Execute Onboarding
          </Button>
        </>
      }
    >
      <div className="space-y-8">
         <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identity Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Input
                label="Commercial Identity"
                placeholder="e.g. ABC Electrical"
                error={errors.supplier_name?.message}
                {...register('supplier_name')}
               />
               <Input
                label="Legal Registered Name"
                placeholder="e.g. ABC Solutions Pvt Ltd"
                error={errors.registered_company_name?.message}
                {...register('registered_company_name')}
               />
            </div>
         </div>

         <div className="space-y-6 pt-8 border-t border-slate-50">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Classification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1.5">
                  <label className="ml-1 block text-sm font-semibold text-slate-700">Entity Archetype</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    {...register('vendor_type')}
                  >
                    <option value="">Select type...</option>
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Service Provider">Service Provider</option>
                  </select>
                  {errors.vendor_type && <p className="text-xs text-red-500">{errors.vendor_type.message}</p>}
               </div>
               <Input
                label="Primary Industry"
                placeholder="e.g. Electronics"
                error={errors.industry?.message}
                {...register('industry')}
               />
            </div>
         </div>

         <div className="space-y-6 pt-8 border-t border-slate-50">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Logistics & Settlement</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Input
                label="Operational Region"
                placeholder="e.g. India"
                error={errors.country?.message}
                {...register('country')}
               />
               <div className="space-y-1.5">
                  <label className="ml-1 block text-sm font-semibold text-slate-700">Settlement Asset (Currency)</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    {...register('default_currency')}
                  >
                    <option value="">Select currency...</option>
                    {currencies.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                  {errors.default_currency && <p className="text-xs text-red-500">{errors.default_currency.message}</p>}
               </div>
            </div>
         </div>
      </div>
    </Modal>
  );
};
