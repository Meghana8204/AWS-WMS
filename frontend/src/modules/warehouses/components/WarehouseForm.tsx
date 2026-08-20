import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Warehouse } from '../types';
import { useQuery } from '@tanstack/react-query';
import { organizationService } from '@/modules/organization/services/organization-service';

const warehouseSchema = z.object({
  warehouse_code: z.string().min(2, 'Warehouse code is required'),
  warehouse_name: z.string().min(2, 'Warehouse name is required'),
  company: z.string().min(1, 'Company is required'),
  address: z.string().min(5, 'Address is required'),
  country: z.string().min(2, 'Country is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  status: z.string().default('ACTIVE'),
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;

interface WarehouseFormProps {
  initialData?: Warehouse | null;
  onSubmit: (values: WarehouseFormValues) => void;
  isLoading?: boolean;
}

export const WarehouseForm: React.FC<WarehouseFormProps> = ({ initialData, onSubmit, isLoading }) => {
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: organizationService.getCompanies,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: initialData || {
      warehouse_code: '',
      warehouse_name: '',
      company: '',
      address: '',
      country: '',
      timezone: 'UTC',
      status: 'ACTIVE',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Warehouse Code"
          placeholder="e.g. WH-01"
          error={errors.warehouse_code?.message}
          {...register('warehouse_code')}
        />
        <Input
          label="Warehouse Name"
          placeholder="e.g. Main Distribution Center"
          error={errors.warehouse_name?.message}
          {...register('warehouse_name')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
          Operating Entity
        </label>
        <select
          {...register('company')}
          className="w-full px-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
        >
          <option value="">Select Company...</option>
          {companies.map((c: any) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        {errors.company && <p className="text-xs text-rose-500 font-bold px-1">{errors.company.message}</p>}
      </div>

      <Input
        label="Address"
        placeholder="Full facility address"
        error={errors.address?.message}
        {...register('address')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Country"
          placeholder="e.g. United Kingdom"
          error={errors.country?.message}
          {...register('country')}
        />
        <Input
          label="Timezone"
          placeholder="e.g. Europe/London"
          error={errors.timezone?.message}
          {...register('timezone')}
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'UPDATE FACILITY' : 'REGISTER FACILITY'}
        </Button>
      </div>
    </form>
  );
};
