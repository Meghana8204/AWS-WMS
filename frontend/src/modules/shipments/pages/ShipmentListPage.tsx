import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigation, Search, MapPin, Clock } from 'lucide-react';
import { shipmentService } from '../services/shipment-service';
import { Table } from '@/components/common/Table';
import { Shipment } from '../types';

export const ShipmentListPage: React.FC = () => {
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: shipmentService.getShipments,
  });

  const columns = [
    {
      header: 'Shipment',
      accessor: (item: Shipment) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-slate-900">{item.shipment_number}</span>
        </div>
      ),
    },
    {
      header: 'Route',
      accessor: (item: Shipment) => (
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-bold">{item.origin} → {item.destination}</span>
        </div>
      ),
    },
    { header: 'Carrier', accessor: 'carrier' as any },
    {
      header: 'ETA',
      accessor: (item: Shipment) => (
        <div className="flex items-center gap-2 text-slate-500">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-bold">{new Date(item.estimated_arrival).toLocaleString()}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item: Shipment) => (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600">
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <Navigation className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Transit Intelligence</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Shipment Tracking</h1>
        <p className="text-slate-500 font-medium italic mt-1">Real-time transportation and freight monitoring</p>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-slate-200 rounded-[40px] p-2 overflow-hidden premium-shadow">
        <div className="p-6 flex items-center gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input
               type="text"
               placeholder="Search shipments by number, carrier or route..."
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
             />
           </div>
        </div>

        <Table columns={columns} data={shipments} isLoading={isLoading} />
      </div>
    </div>
  );
};
