'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Eye, FileCheck, FileMinus, UserCheck, UserPlus } from 'lucide-react';
import InvoicePreview from './invoice-preview';

export interface Client { id: string; name: string; company: string | null; phone: string; address: string | null; email: string | null; }
export interface BillItem { id?: string; description: string; quantity: string; rate: string; amount: string; itemName: string; taxMode: string; cgst: string; sgst: string; baseRate: string; }
export interface Bill {
  id: string; billNumber: string; clientId: string; date: string; dueDate: string;
  subtotal: number; tax: number; discount: number; total: number; paidAmount: number;
  status: string; notes: string | null; billType: string; clientGst: string | null; clientAddress: string | null;
  client: Client; items: BillItem[];
}

const GST_RATE = 0.18;
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

export default function BillsView({ businessId }: { businessId: string }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [billType, setBillType] = useState<'gst' | 'non_gst'>('non_gst');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [form, setForm] = useState({
    clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0],
    dueDate: '', discount: '0', notes: '', clientGst: '', clientAddress: '',
    // New client fields
    newClientName: '', newClientPhone: '', newClientAddress: '', newClientEmail: '', newClientCompany: '',
  });
  const [items, setItems] = useState<BillItem[]>([{
    description: '', quantity: '1', rate: '0', amount: '0',
    itemName: '', taxMode: 'excl', cgst: '0', sgst: '0', baseRate: '0',
  }]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        fetch(`/api/bills?businessId=${businessId}`),
        fetch(`/api/clients?businessId=${businessId}`),
      ]);
      setBills(await bRes.json());
      setClients(await cRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    (newItems[index] as Record<string, string>)[field] = value;

    const q = parseFloat(newItems[index].quantity) || 0;
    const r = parseFloat(newItems[index].rate) || 0;

    if (field === 'quantity' || field === 'rate' || field === 'taxMode') {
      if (billType === 'gst') {
        const taxMode = newItems[index].taxMode;
        if (taxMode === 'incl') {
          const baseRate = r / (1 + GST_RATE);
          newItems[index].baseRate = baseRate.toFixed(2);
          newItems[index].cgst = (baseRate * CGST_RATE * q).toFixed(2);
          newItems[index].sgst = (baseRate * SGST_RATE * q).toFixed(2);
          newItems[index].amount = (r * q).toFixed(2);
        } else {
          const baseRate = r;
          newItems[index].baseRate = baseRate.toFixed(2);
          newItems[index].cgst = (baseRate * CGST_RATE * q).toFixed(2);
          newItems[index].sgst = (baseRate * SGST_RATE * q).toFixed(2);
          newItems[index].amount = (baseRate * (1 + GST_RATE) * q).toFixed(2);
        }
      } else {
        newItems[index].baseRate = r.toFixed(2);
        newItems[index].cgst = '0';
        newItems[index].sgst = '0';
        newItems[index].amount = (q * r).toFixed(2);
      }
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, {
    description: '', quantity: '1', rate: '0', amount: '0',
    itemName: '', taxMode: 'excl', cgst: '0', sgst: '0', baseRate: '0',
  }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.baseRate || item.rate) * (parseFloat(item.quantity) || 0)), 0);
  const totalCgst = items.reduce((sum, item) => sum + (parseFloat(item.cgst) || 0), 0);
  const totalSgst = items.reduce((sum, item) => sum + (parseFloat(item.sgst) || 0), 0);
  const totalGst = totalCgst + totalSgst;
  const discountAmt = parseFloat(form.discount) || 0;
  const total = billType === 'gst'
    ? subtotal + totalGst - discountAmt
    : items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) - discountAmt;

  const handleSubmit = async () => {
    let clientId = form.clientId;

    // If new client, create client first
    if (clientMode === 'new') {
      if (!form.newClientName || !form.newClientPhone) return;
      try {
        const cRes = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            name: form.newClientName,
            phone: form.newClientPhone,
            address: form.newClientAddress || null,
            email: form.newClientEmail || null,
            company: form.newClientCompany || null,
          }),
        });
        const newClient = await cRes.json();
        clientId = newClient.id;
      } catch (err) { console.error(err); return; }
    }

    if (!clientId || !form.billNumber || !form.dueDate) return;

    try {
      await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          clientId,
          billNumber: form.billNumber,
          date: form.date,
          dueDate: form.dueDate,
          subtotal: billType === 'gst' ? subtotal : items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
          tax: totalGst,
          discount: discountAmt,
          total,
          notes: form.notes,
          billType,
          clientGst: billType === 'gst' ? form.clientGst : null,
          clientAddress: form.clientAddress || null,
          items: items.map(i => ({
            description: i.description,
            quantity: parseFloat(i.quantity) || 0,
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0,
            itemName: i.itemName,
            taxMode: i.taxMode,
            cgst: parseFloat(i.cgst) || 0,
            sgst: parseFloat(i.sgst) || 0,
            baseRate: parseFloat(i.baseRate) || 0,
          })),
        }),
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setForm({
      clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0],
      dueDate: '', discount: '0', notes: '', clientGst: '', clientAddress: '',
      newClientName: '', newClientPhone: '', newClientAddress: '', newClientEmail: '', newClientCompany: '',
    });
    setItems([{ description: '', quantity: '1', rate: '0', amount: '0', itemName: '', taxMode: 'excl', cgst: '0', sgst: '0', baseRate: '0' }]);
    setBillType('non_gst');
    setClientMode('existing');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill?')) return;
    await fetch(`/api/bills?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) { case 'paid': return 'bg-green-100 text-green-700'; case 'partial': return 'bg-yellow-100 text-yellow-700'; default: return 'bg-red-100 text-red-700'; }
  };

  const nextBillNum = () => {
    const num = bills.length > 0 ? Math.max(...bills.map(b => parseInt(b.billNumber.replace(/\D/g, '')) || 0)) + 1 : 1;
    return `${String(num).padStart(3, '0')}`;
  };

  const handleBillTypeChange = (type: 'gst' | 'non_gst') => {
    setBillType(type);
    const newItems = items.map(item => {
      const q = parseFloat(item.quantity) || 0;
      const r = parseFloat(item.rate) || 0;
      if (type === 'gst') {
        const baseRate = item.taxMode === 'incl' ? r / (1 + GST_RATE) : r;
        return {
          ...item,
          baseRate: baseRate.toFixed(2),
          cgst: (baseRate * CGST_RATE * q).toFixed(2),
          sgst: (baseRate * SGST_RATE * q).toFixed(2),
          amount: item.taxMode === 'incl' ? (r * q).toFixed(2) : (baseRate * (1 + GST_RATE) * q).toFixed(2),
        };
      } else {
        return { ...item, baseRate: r.toFixed(2), cgst: '0', sgst: '0', amount: (q * r).toFixed(2) };
      }
    });
    setItems(newItems);
  };

  // When existing client selected, auto-fill address
  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setForm({ ...form, clientId, clientAddress: client?.address || '' });
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bills</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{bills.length} bills</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 min-h-[44px]" onClick={() => setForm(f => ({ ...f, billNumber: nextBillNum() }))}>
              <Plus className="h-4 w-4" /> New Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Bill</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Step 1: Bill Type */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Step 1: Bill Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleBillTypeChange('gst')}
                    className={`p-4 rounded-xl border-2 transition-all text-center min-h-[80px] ${
                      billType === 'gst'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <FileCheck className="h-6 w-6 mx-auto mb-1" />
                    <p className="font-bold text-sm">GST Bill</p>
                    <p className="text-[11px] mt-0.5">CGST + SGST (18%)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBillTypeChange('non_gst')}
                    className={`p-4 rounded-xl border-2 transition-all text-center min-h-[80px] ${
                      billType === 'non_gst'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <FileMinus className="h-6 w-6 mx-auto mb-1" />
                    <p className="font-bold text-sm">Non-GST Bill</p>
                    <p className="text-[11px] mt-0.5">Without GST</p>
                  </button>
                </div>
              </div>

              {/* Step 2: Client Selection */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Step 2: Client</Label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    className={`p-3 rounded-xl border-2 transition-all text-center min-h-[64px] ${
                      clientMode === 'existing'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <UserCheck className="h-5 w-5 mx-auto mb-1" />
                    <p className="font-semibold text-xs">Existing Client</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('new')}
                    className={`p-3 rounded-xl border-2 transition-all text-center min-h-[64px] ${
                      clientMode === 'new'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <UserPlus className="h-5 w-5 mx-auto mb-1" />
                    <p className="font-semibold text-xs">New Client</p>
                  </button>
                </div>

                {clientMode === 'existing' ? (
                  <div className="space-y-3">
                    <Select value={form.clientId} onValueChange={handleClientSelect}>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select existing client..." /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''} - {c.phone}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.clientId && (() => {
                      const sel = clients.find(c => c.id === form.clientId);
                      return sel ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs space-y-1">
                          <p><span className="text-gray-500">Name:</span> <span className="font-medium">{sel.name}</span></p>
                          <p><span className="text-gray-500">Phone:</span> {sel.phone}</p>
                          {sel.address && <p><span className="text-gray-500">Address:</span> {sel.address}</p>}
                          {sel.email && <p><span className="text-gray-500">Email:</span> {sel.email}</p>}
                          {sel.company && <p><span className="text-gray-500">Company:</span> {sel.company}</p>}
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Client Name *</Label>
                        <Input placeholder="Full name" value={form.newClientName} onChange={(e) => setForm({ ...form, newClientName: e.target.value })} className="min-h-[44px]" />
                      </div>
                      <div>
                        <Label className="text-xs">Phone Number *</Label>
                        <Input placeholder="Phone" value={form.newClientPhone} onChange={(e) => setForm({ ...form, newClientPhone: e.target.value })} className="min-h-[44px]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Address</Label>
                        <Input placeholder="Address" value={form.newClientAddress} onChange={(e) => setForm({ ...form, newClientAddress: e.target.value, clientAddress: e.target.value })} className="min-h-[44px]" />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input placeholder="Email" value={form.newClientEmail} onChange={(e) => setForm({ ...form, newClientEmail: e.target.value })} className="min-h-[44px]" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Company</Label>
                      <Input placeholder="Company name" value={form.newClientCompany} onChange={(e) => setForm({ ...form, newClientCompany: e.target.value })} className="min-h-[44px]" />
                    </div>
                  </div>
                )}
              </div>

              {/* GST-specific fields */}
              {billType === 'gst' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div>
                    <Label className="text-xs">Client GSTIN</Label>
                    <Input value={form.clientGst} onChange={(e) => setForm({ ...form, clientGst: e.target.value.toUpperCase() })} placeholder="e.g. 19XXXXX1234F1ZG" className="uppercase min-h-[44px]" />
                  </div>
                  <div>
                    <Label className="text-xs">Billing Address</Label>
                    <Input value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} placeholder="Billing address" className="min-h-[44px]" />
                  </div>
                </div>
              )}

              {/* Bill Details */}
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Bill # *</Label><Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} className="min-h-[44px]" /></div>
                <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="min-h-[44px]" /></div>
                <div><Label className="text-xs">Due Date *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="min-h-[44px]" /></div>
              </div>

              {/* Items */}
              <div>
                <Label className="text-sm font-semibold">Step 3: Items</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${billType === 'gst' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                      {/* Mobile: stack layout, Desktop: grid */}
                      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                        <div className="col-span-2 md:col-span-2">
                          <Label className="text-[10px]">Item Name</Label>
                          <Input placeholder="Item" value={item.itemName} onChange={(e) => updateItem(i, 'itemName', e.target.value)} className="h-10 text-sm" />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                          <Label className="text-[10px]">Description</Label>
                          <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="h-10 text-sm" />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <Label className="text-[10px]">Rate (₹)</Label>
                          <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} className="h-10 text-sm" />
                        </div>
                        <div className="col-span-1 md:col-span-1">
                          <Label className="text-[10px]">Qty</Label>
                          <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="h-10 text-sm" />
                        </div>
                        {billType === 'gst' && (
                          <div className="col-span-2 md:col-span-2">
                            <Label className="text-[10px]">Tax Mode</Label>
                            <Select value={item.taxMode} onValueChange={(v) => updateItem(i, 'taxMode', v)}>
                              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excl">Excl. GST</SelectItem>
                                <SelectItem value="incl">Incl. GST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="col-span-1 md:col-span-1">
                          <Label className="text-[10px]">Total</Label>
                          <Input readOnly value={item.amount} className="h-10 text-sm bg-white dark:bg-gray-900" />
                        </div>
                        <div className="col-span-1 md:col-span-1 flex items-end">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-10 w-10 min-w-[44px]">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      {billType === 'gst' && parseFloat(item.rate) > 0 && (
                        <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex gap-3">
                          <span>Base: ₹{parseFloat(item.baseRate).toFixed(2)}</span>
                          <span>CGST: ₹{item.cgst}</span>
                          <span>SGST: ₹{item.sgst}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addItem} className="mt-2 gap-1 min-h-[40px]"><Plus className="h-3 w-3" /> Add Item</Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Discount (₹)</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="min-h-[44px]" /></div>
                <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." className="min-h-[44px]" /></div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-1">
                {billType === 'gst' ? (
                  <>
                    <div className="flex justify-between text-sm"><span>Taxable Amount:</span><span>{fmt(subtotal)}</span></div>
                    <div className="flex justify-between text-sm"><span>CGST (9%):</span><span>{fmt(totalCgst)}</span></div>
                    <div className="flex justify-between text-sm"><span>SGST (9%):</span><span>{fmt(totalSgst)}</span></div>
                    {discountAmt > 0 && <div className="flex justify-between text-sm"><span>Discount:</span><span>-{fmt(discountAmt)}</span></div>}
                    <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1 dark:border-gray-700"><span>Grand Total:</span><span>{fmt(total)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm"><span>Subtotal:</span><span>{fmt(items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</span></div>
                    {discountAmt > 0 && <div className="flex justify-between text-sm"><span>Discount:</span><span>-{fmt(discountAmt)}</span></div>}
                    <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1 dark:border-gray-700"><span>Total:</span><span>{fmt(total)}</span></div>
                  </>
                )}
              </div>

              <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 min-h-[48px] text-base font-semibold"
                disabled={!form.billNumber || !form.dueDate || (clientMode === 'existing' ? !form.clientId : !form.newClientName || !form.newClientPhone)}>
                {billType === 'gst' ? 'Create GST Invoice' : 'Create Bill'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : bills.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No bills yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => (
            <Card key={bill.id} className="p-4 hover:shadow-md transition-shadow active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    bill.billType === 'gst' ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <FileText className={`h-5 w-5 ${bill.billType === 'gst' ? 'text-blue-500' : 'text-gray-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {bill.billNumber}
                      {bill.billType === 'gst' && <Badge className="ml-2 text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GST</Badge>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{bill.client.name} • {new Date(bill.date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{fmt(bill.total)}</p>
                    <Badge className={`text-[10px] ${statusColor(bill.status)}`}>
                      {bill.status === 'paid' ? 'Paid' : bill.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </Badge>
                  </div>
                  <button onClick={() => setViewBill(bill)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Eye className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewBill && <InvoicePreview bill={viewBill} onClose={() => setViewBill(null)} />}
    </div>
  );
}
