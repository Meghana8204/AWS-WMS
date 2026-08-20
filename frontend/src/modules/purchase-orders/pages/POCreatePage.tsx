import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Trash2, Calendar, FileText, ShoppingCart } from 'lucide-react';
import { poService } from '../services/po-service';
import { organizationService } from '@/modules/organization/services/organization-service';
import { suppliersService } from '@/modules/suppliers/services/suppliers-service';
import { warehouseService } from '@/modules/warehouses/services/warehouse-service';
import { mastersService } from '@/modules/masters/services/masters-service';
import { itemService } from '@/modules/items/services/item-service';
import { Button } from '@/components/common/Button';

interface LineItemForm {
  item: string;
  quantity: number;
  uom: string;
  unit_price: number;
  tax_percentage: number;
  discount_percentage: number;
  expected_delivery_date: string;
}

export const POCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Master Data Queries
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: organizationService.getCompanies,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersService.getSuppliers,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseService.getWarehouses,
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: mastersService.getCurrencies,
  });

  const { data: paymentTerms = [] } = useQuery({
    queryKey: ['payment-terms'],
    queryFn: mastersService.getPaymentTerms,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: itemService.getItems,
  });

  // Form State
  const [poType, setPoType] = useState('STANDARD');
  const [company, setCompany] = useState('');
  const [supplier, setSupplier] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [currency, setCurrency] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<LineItemForm[]>([
    {
      item: '',
      quantity: 1,
      uom: '',
      unit_price: 0,
      tax_percentage: 18,
      discount_percentage: 0,
      expected_delivery_date: '',
    },
  ]);

  // Mutation
  const createMutation = useMutation({
    mutationFn: poService.createPO,
    onSuccess: (newPO) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate(`/purchase-orders/${newPO.id}`);
    },
  });

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        item: '',
        quantity: 1,
        uom: '',
        unit_price: 0,
        tax_percentage: 18,
        discount_percentage: 0,
        expected_delivery_date: expectedDeliveryDate,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleLineChange = (index: number, field: keyof LineItemForm, value: any) => {
    const updatedLines = [...lines];
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value,
    };

    // Auto-populate UOM when item is selected
    if (field === 'item' && value) {
      const selectedItem = items.find((i: any) => i.id === value);
      if (selectedItem) {
        updatedLines[index].uom = selectedItem.uom;
      }
    }

    setLines(updatedLines);
  };

  // Calculations
  const calculateSummary = () => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;

    lines.forEach((line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      const lineSubtotal = qty * price;
      
      const lineTax = lineSubtotal * ((Number(line.tax_percentage) || 0) / 100);
      const lineDiscount = lineSubtotal * ((Number(line.discount_percentage) || 0) / 100);

      subtotal += lineSubtotal;
      tax += lineTax;
      discount += lineDiscount;
    });

    const net = subtotal + tax - discount;

    return { subtotal, tax, discount, net };
  };

  const { subtotal, tax, discount, net } = calculateSummary();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!company || !supplier || !warehouse || !currency || !paymentTerm || !expectedDeliveryDate) {
      alert('Please fill in all required header fields');
      return;
    }

    if (lines.some((line) => !line.item || !line.quantity || !line.uom || !line.expected_delivery_date)) {
      alert('Please complete all line item fields');
      return;
    }

    const payload = {
      po_type: poType,
      company,
      supplier,
      warehouse,
      currency,
      reporting_currency: currency,
      payment_terms: paymentTerm,
      expected_delivery_date: expectedDeliveryDate,
      notes,
      lines: lines.map((l) => ({
        item: l.item,
        quantity: Number(l.quantity),
        uom: l.uom,
        unit_price: Number(l.unit_price),
        tax_percentage: Number(l.tax_percentage),
        discount_percentage: Number(l.discount_percentage),
        expected_delivery_date: l.expected_delivery_date,
      })),
    };

    createMutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="animate-premium-fade space-y-8 pb-16">
      {/* Top Navigation / Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Acquisition</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Create Purchase Order</h1>
          </div>
        </div>

        <Button type="submit" isLoading={createMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          GENERATE PURCHASE ORDER
        </Button>
      </div>

      {/* Main Grid: Header fields & Notes */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
        <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-4">
          <FileText className="w-5 h-5 text-indigo-600" />
          Header Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PO Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Purchase Order Type</label>
            <select
              value={poType}
              onChange={(e) => setPoType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="STANDARD">Standard PO</option>
              <option value="BLANKET">Blanket PO</option>
              <option value="FRAMEWORK">Framework Agreement</option>
            </select>
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Operating Entity (Company) *</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="">Select Company</option>
              {companies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>

          {/* Supplier */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Supplier Partner *</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
          </div>

          {/* Destination Facility */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Destination Facility (Warehouse) *</label>
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acquisition Currency *</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="">Select Currency</option>
              {currencies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
              ))}
            </select>
          </div>

          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Commitment Payment Terms *</label>
            <select
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            >
              <option value="">Select Payment Term</option>
              {paymentTerms.map((pt: any) => (
                <option key={pt.id} value={pt.id}>{pt.name} ({pt.days} days)</option>
              ))}
            </select>
          </div>

          {/* Delivery Target */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Expected Delivery Date *</label>
            <div className="relative">
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => {
                  setExpectedDeliveryDate(e.target.value);
                  // Update dates on line items if they are empty
                  const updatedLines = lines.map((l) => ({
                    ...l,
                    expected_delivery_date: l.expected_delivery_date || e.target.value,
                  }));
                  setLines(updatedLines);
                }}
                required
                className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Procurement Notes & Special Instructions</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-slate-50 border border-slate-100 text-slate-900 px-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-200 focus:bg-white transition-all font-semibold"
            placeholder="Add general notes or instructions for the supplier..."
          />
        </div>
      </div>

      {/* Line Items Section */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-lg font-extrabold text-slate-905 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Asset Line Items
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddLine}>
            <Plus className="w-4 h-4 mr-2" />
            ADD ASSET
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group"
            >
              {/* Item selection */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Asset Item *</label>
                <select
                  value={line.item}
                  onChange={(e) => handleLineChange(index, 'item', e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                >
                  <option value="">Select Item</option>
                  {items.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="md:col-span-1.5 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Quantity *</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={line.quantity}
                  onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                />
              </div>

              {/* Unit Price */}
              <div className="md:col-span-1.5 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Unit Price *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={line.unit_price}
                  onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                />
              </div>

              {/* Tax Percentage */}
              <div className="md:col-span-1 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tax %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={line.tax_percentage}
                  onChange={(e) => handleLineChange(index, 'tax_percentage', e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                />
              </div>

              {/* Discount Percentage */}
              <div className="md:col-span-1 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Disc %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={line.discount_percentage}
                  onChange={(e) => handleLineChange(index, 'discount_percentage', e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                />
              </div>

              {/* Expected Delivery */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">ETA *</label>
                <input
                  type="date"
                  value={line.expected_delivery_date}
                  onChange={(e) => handleLineChange(index, 'expected_delivery_date', e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-200 transition-all font-semibold text-xs"
                />
              </div>

              {/* Total display & Remove button */}
              <div className="md:col-span-2 flex items-center justify-between pl-2">
                <div className="text-right">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Line Total</div>
                  <div className="font-extrabold text-xs text-slate-900">
                    ₹{((Number(line.quantity) || 0) * (Number(line.unit_price) || 0) * (1 + (Number(line.tax_percentage) || 0) / 100 - (Number(line.discount_percentage) || 0) / 100)).toFixed(2)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveLine(index)}
                  disabled={lines.length === 1}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Valuation */}
      <div className="flex justify-end">
        <div className="w-full md:w-96 bg-slate-900 border border-slate-800 rounded-[32px] p-6 text-white space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold text-emerald-400">
            <span>Tax Added</span>
            <span>+ ₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold text-rose-400">
            <span>Discount Applied</span>
            <span>- ₹{discount.toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Net Commit Value</span>
            <span className="font-black text-xl text-white">₹{net.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </form>
  );
};
