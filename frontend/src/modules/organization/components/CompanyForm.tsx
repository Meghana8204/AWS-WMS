import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Company } from '../types';

const companySchema = z.object({
  company_code: z.string().min(2, 'Company code is required'),
  company_name: z.string().min(2, 'Company name is required'),
  legal_name: z.string().min(2, 'Legal name is required'),
  tax_id: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  base_currency: z.string().length(3, 'Must be 3-letter currency code'),
  timezone: z.string().min(1, 'Timezone is required'),
  status: z.string().default('ACTIVE'),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyFormProps {
  initialData?: Company | null;
  onSubmit: (values: CompanyFormValues) => void;
  isLoading?: boolean;
}

export const CompanyForm: React.FC<CompanyFormProps> = ({ initialData, onSubmit, isLoading }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: initialData || {
      company_code: '',
      company_name: '',
      legal_name: '',
      tax_id: '',
      country: '',
      base_currency: 'USD',
      timezone: 'UTC',
      status: 'ACTIVE',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Company Code"
          placeholder="e.g. COMP-001"
          error={errors.company_code?.message}
          {...register('company_code')}
        />
        <Input
          label="Company Name"
          placeholder="e.g. Enterprise Solutions"
          error={errors.company_name?.message}
          {...register('company_name')}
        />
      </div>

      <Input
        label="Legal Name"
        placeholder="e.g. Enterprise Solutions LLC"
        error={errors.legal_name?.message}
        {...register('legal_name')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Tax ID"
          placeholder="e.g. TAX-123456"
          error={errors.tax_id?.message}
          {...register('tax_id')}
        />
        <Input
          label="Country"
          placeholder="e.g. United States"
          error={errors.country?.message}
          {...register('country')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Base Currency"
          placeholder="e.g. USD"
          error={errors.base_currency?.message}
          {...register('base_currency')}
        />
        <Input
          label="Timezone"
          placeholder="e.g. UTC"
          error={errors.timezone?.message}
          {...register('timezone')}
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'UPDATE COMPANY' : 'REGISTER COMPANY'}
        </Button>
      </div>
    </form>
  );
};
