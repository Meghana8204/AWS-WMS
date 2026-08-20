import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { suppliersService } from '../services/suppliers-service';
import { Button } from '@/components/common/Button';

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState('overview');

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersService.getSupplier(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: ({ status, comments }: { status: any, comments: string }) =>
      suppliersService.updateStatus(id!, status, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
    },
  });

  if (isLoading || !supplier) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const statusColors: any = {
    ACTIVE: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-500/10",
    REJECTED: "bg-rose-50 text-rose-600 border-rose-100",
    DRAFT: "bg-slate-100 text-slate-500 border-slate-200",
    UNDER_REVIEW: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
    { id: 'contacts', label: 'Contacts', icon: <Mail className="w-4 h-4" /> },
    { id: 'addresses', label: 'Addresses', icon: <MapPin className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'history', label: 'Audit Trail', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="animate-premium-fade space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/suppliers')}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">{supplier.supplier_name}</h1>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusColors[supplier.status] || statusColors.DRAFT}`}>
                {supplier.status}
              </span>
            </div>
            <p className="text-slate-500 font-medium text-lg italic">{supplier.registered_company_name}</p>
          </div>
        </div>

        <div className="flex gap-4">
          {supplier.status === 'UNDER_REVIEW' && (
            <>
              <Button
                variant="outline"
                className="text-rose-600 border-rose-100 hover:bg-rose-50"
                onClick={() => mutation.mutate({ status: 'REJECTED', comments: 'Manual rejection' })}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Partner
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => mutation.mutate({ status: 'ACTIVE', comments: 'Manual approval' })}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Authorize Status
              </Button>
            </>
          )}
          {supplier.status === 'DRAFT' && (
            <Button onClick={() => mutation.mutate({ status: 'UNDER_REVIEW', comments: 'Submitted for verification' })}>
              Submit for Verification
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Tabs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[32px] p-4 space-y-1.5 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3.5 px-6 py-4 rounded-2xl font-bold text-sm transition-all
                  ${activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] text-white space-y-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-24 h-24" />
             </div>
             <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-400">Compliance Index</h3>
                <p className="text-slate-400 text-sm font-medium mt-1">Verified organizational identity</p>
                <div className="mt-8 flex items-center gap-4">
                   <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                      <span className="text-2xl font-black">98</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="font-bold">A+ Certified</span>
                      <span className="text-xs text-slate-500 uppercase tracking-tighter">Zero protocol breaches</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2">
           <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-sm min-h-[600px]">
              {activeTab === 'overview' && (
                <div className="space-y-12 animate-premium-fade">
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry Classification</p>
                         <p className="text-lg font-bold text-slate-900">{supplier.industry}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor Archetype</p>
                         <p className="text-lg font-bold text-slate-900">{supplier.vendor_type}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxation Identifier</p>
                         <p className="text-lg font-bold text-slate-900 font-mono">{supplier.tax_number || 'PENDING'}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registration ID</p>
                         <p className="text-lg font-bold text-slate-900 font-mono">{supplier.registration_number || 'PENDING'}</p>
                      </div>
                   </div>

                   <div className="pt-10 border-t border-slate-100">
                      <h4 className="text-xs font-black text-slate-950 uppercase tracking-[0.2em] mb-6">Operational Readiness</h4>
                      <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex items-center gap-6">
                         <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 border border-amber-100">
                            <AlertCircle className="w-6 h-6" />
                         </div>
                         <div>
                            <p className="font-bold text-slate-900 text-sm">Actionable Intelligence Required</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Pending verification of Quality Certificates.</p>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'contacts' && (
                <div className="animate-premium-fade">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Executive Contacts</h3>
                      <Button variant="ghost" size="sm">Add Contact</Button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {supplier.contacts?.map((contact: any) => (
                        <div key={contact.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                           <div className="flex items-center gap-4 mb-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 font-bold border border-slate-200">
                                 {contact.name[0]}
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900">{contact.name}</p>
                                 <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{contact.contact_type}</p>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                 <Mail className="w-4 h-4" />
                                 {contact.email}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                 <Phone className="w-4 h-4" />
                                 {contact.mobile}
                              </div>
                           </div>
                        </div>
                      ))}
                      {(!supplier.contacts || supplier.contacts.length === 0) && (
                        <div className="col-span-2 py-10 text-center text-slate-400 italic">No contacts registered.</div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'addresses' && (
                <div className="animate-premium-fade">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Geospatial Registry</h3>
                      <Button variant="ghost" size="sm">Add Address</Button>
                   </div>
                   <div className="space-y-6">
                      {supplier.addresses?.map((address: any) => (
                        <div key={address.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-start gap-6">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                              <MapPin className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                 <p className="font-bold text-slate-900 text-lg">{address.address_type}</p>
                                 {address.is_primary && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-md">Primary</span>}
                              </div>
                              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                 {address.address_line_1}, {address.address_line_2 && `${address.address_line_2}, `}
                                 <br />
                                 {address.city}, {address.state} — {address.postal_code}
                                 <br />
                                 {address.country}
                              </p>
                           </div>
                        </div>
                      ))}
                      {(!supplier.addresses || supplier.addresses.length === 0) && (
                        <div className="py-10 text-center text-slate-400 italic">No addresses registered.</div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="animate-premium-fade">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Compliance Repository</h3>
                      <Button variant="ghost" size="sm">Upload Document</Button>
                   </div>
                   <div className="space-y-4">
                      {supplier.documents?.map((doc: any) => (
                        <div key={doc.id} className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-100 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                                 <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900">{doc.document_type}</p>
                                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{doc.document_number} — Version {doc.version}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="text-right">
                                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Status</p>
                                 <p className={`text-xs font-bold ${doc.status === 'VALID' ? 'text-emerald-500' : 'text-amber-500'}`}>{doc.status}</p>
                              </div>
                              <Button variant="ghost" size="sm">View</Button>
                           </div>
                        </div>
                      ))}
                      {(!supplier.documents || supplier.documents.length === 0) && (
                        <div className="py-10 text-center text-slate-400 italic">No documents uploaded.</div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="animate-premium-fade">
                   <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-8">Immutable Audit Trail</h3>
                   <div className="relative space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                      {supplier.qualification_history?.map((entry: any, idx: number) => (
                        <div key={idx} className="relative pl-12">
                           <div className="absolute left-0 top-1 w-10 h-10 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center z-10">
                              <Clock className="w-4 h-4 text-slate-400" />
                           </div>
                           <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                 <p className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">Transition: {entry.from_status} → {entry.to_status}</p>
                                 <p className="text-[10px] text-slate-400 font-medium">{new Date(entry.created_at).toLocaleString()}</p>
                              </div>
                              <p className="text-sm text-slate-600 font-medium leading-relaxed">{entry.comments}</p>
                              <p className="text-xs text-indigo-600 font-bold mt-4">Authorized by: {entry.performed_by_name}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
