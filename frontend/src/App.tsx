import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { SupplierListPage } from '@/modules/suppliers/pages/SupplierListPage'
import { SupplierDetailPage } from '@/modules/suppliers/pages/SupplierDetailPage'
import { CompanyListPage } from '@/modules/organization/pages/CompanyListPage'
import { WarehouseListPage } from '@/modules/warehouses/pages/WarehouseListPage'
import { ItemListPage } from '@/modules/items/pages/ItemListPage'
import { MasterPage } from '@/modules/masters/pages/MasterPage'
import { useAuthStore } from '@/store/auth-store'
import { Layout } from '@/components/layout/Layout'

import { LayoutDashboard } from 'lucide-react'

import { DashboardPage } from '@/modules/procurement/pages/DashboardPage'

import { POListPage } from '@/modules/purchase-orders/pages/POListPage'
import { PODetailPage } from '@/modules/purchase-orders/pages/PODetailPage'
import { POCreatePage } from '@/modules/purchase-orders/pages/POCreatePage'

import { ASNListPage } from '@/modules/asn/pages/ASNListPage'
import { ShipmentListPage } from '@/modules/shipments/pages/ShipmentListPage'

import { GateEntryListPage } from '@/modules/gate-entry/pages/GateEntryListPage'
import { GRNListPage } from '@/modules/receiving/pages/GRNListPage'
import { InventoryPage } from '@/modules/inventory/pages/InventoryPage'

const App: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 text-slate-900">
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />

        <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<DashboardPage />} />

          {/* Phase 1 Routes */}
          <Route path="/organization" element={<CompanyListPage />} />
          <Route path="/warehouses" element={<WarehouseListPage />} />
          <Route path="/items" element={<ItemListPage />} />
          <Route path="/masters" element={<MasterPage />} />

          {/* Phase 2, 3 & 4 Routes */}
          <Route path="/suppliers" element={<SupplierListPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="/purchase-orders" element={<POListPage />} />
          <Route path="/purchase-orders/create" element={<POCreatePage />} />
          <Route path="/purchase-orders/:id" element={<PODetailPage />} />
          <Route path="/asns" element={<ASNListPage />} />
          <Route path="/shipments" element={<ShipmentListPage />} />

          {/* Phase 5 Routes */}
          <Route path="/gate-entries" element={<GateEntryListPage />} />
          <Route path="/receiving" element={<GRNListPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
