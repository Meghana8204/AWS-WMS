import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Lock, Building2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { authService } from '../services/auth-service';
import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const data = await authService.login(values);
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setUser(data.user);
      navigate('/');
    } catch (error: any) {
      console.error('Login failed', error);
      const message = error.response?.data?.detail || 'Identity verification failed. Check credentials.';
      setError(message);
    }
  };

  const [localError, setError] = React.useState<string | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-premium-fade relative z-10">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 p-10 rounded-[32px] shadow-2xl shadow-slate-200/50">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">ProcureHQ</h1>
            <p className="text-slate-500 font-medium italic">Enterprise Acquisition Intelligence</p>
          </div>

          {localError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-bold mb-6 flex items-center gap-3 animate-premium-fade">
               <AlertCircle className="w-5 h-5 shrink-0" />
               {localError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Identity"
              placeholder="Username or Email"
              icon={<Mail className="w-5 h-5" />}
              error={errors.username?.message}
              {...register('username')}
            />

            <Input
              label="Secret Key"
              type="password"
              placeholder="••••••••"
              icon={<Lock className="w-5 h-5" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              className="w-full py-4 text-xs tracking-[0.2em]"
              isLoading={isSubmitting}
            >
              INITIALIZE SESSION
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
