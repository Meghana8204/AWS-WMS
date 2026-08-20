import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Warehouse,
  Box,
  LogOut,
  Menu,
  X,
  Settings,
  ShoppingCart,
  Truck,
  Navigation,
  LogIn,
  PackageCheck,
  BarChart3,
  Search,
  Bell,
  Mail
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" />, path: '/' },
    { label: 'Suppliers', icon: <Users className="w-5 h-5" />, path: '/suppliers' },
    { label: 'Purchase Orders', icon: <ShoppingCart className="w-5 h-5" />, path: '/purchase-orders' },
    { label: 'Shipping Notices', icon: <Truck className="w-5 h-5" />, path: '/asns' },
    { label: 'Shipments', icon: <Navigation className="w-5 h-5" />, path: '/shipments' },
    { label: 'Gate Entry', icon: <LogIn className="w-5 h-5" />, path: '/gate-entries' },
    { label: 'Goods Receiving', icon: <PackageCheck className="w-5 h-5" />, path: '/receiving' },
    { label: 'Inventory Balances', icon: <BarChart3 className="w-5 h-5" />, path: '/inventory' },
    { label: 'Organization', icon: <Building2 className="w-5 h-5" />, path: '/organization' },
    { label: 'Warehouses', icon: <Warehouse className="w-5 h-5" />, path: '/warehouses' },
    { label: 'Item Master', icon: <Box className="w-5 h-5" />, path: '/items' },
    { label: 'System Masters', icon: <Settings className="w-5 h-5" />, path: '/masters' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        bg-white border-r border-slate-200 flex flex-col transition-all duration-300
        ${isSidebarOpen ? 'w-72' : 'w-20'}
      `}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-50">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 leading-tight">ProcureHQ</span>
              <span className="text-[9px] text-indigo-600 uppercase font-black tracking-[0.15em] mt-0.5">ENTERPRISE V2.0</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all group
                ${location.pathname === item.path
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm shadow-indigo-100/50'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}
              `}
            >
              <span className={`transition-transform duration-300 ${location.pathname === item.path ? 'scale-110 text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                {item.icon}
              </span>
              {isSidebarOpen && <span className="tracking-tight">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
           <button
            onClick={() => logout()}
            className={`
              w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all
              text-slate-500 hover:text-rose-600 hover:bg-rose-50
            `}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="tracking-tight font-bold">Terminate Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Search Input */}
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search the system..."
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-12 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-300 transition-all placeholder:text-slate-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-white shadow-sm">
                ⌘ K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Sync Telemetry */}
            <div className="hidden lg:flex items-center gap-2 bg-emerald-50/50 border border-emerald-100/50 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-600 tracking-wider uppercase">CORE SYNCHRONIZED</span>
              {/* Telemetry wave */}
              <svg className="w-12 h-3 text-emerald-400" viewBox="0 0 40 10" fill="none">
                <path d="M 0,5 L 5,5 L 8,1 L 12,9 L 15,3 L 18,7 L 20,5 L 40,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-4 text-slate-400">
              <div className="relative cursor-pointer hover:text-slate-600 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-black">
                  3
                </span>
              </div>
              <div className="relative cursor-pointer hover:text-slate-600 transition-colors">
                <Mail className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-black">
                  5
                </span>
              </div>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-slate-900 leading-tight">{user?.username || 'admin'}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">System Administrator</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-indigo-600 font-black shadow-sm text-sm uppercase">
                {user?.username?.[0] || 'A'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto pb-20">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
