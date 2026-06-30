'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Eye, FileCheck, FileMinus } from 'lucide-react';
import InvoicePreview from './invoice-preview';

export interface Client { id: string; name: string; company: string | null; phone: string; address: string | null; email: string | null; }
export interface BillItem { id?: string; description: string; quantity: string; rate: string; amount: string; itemName: string; taxMode: string; cgst: string; sgst: string; baseRate: string; }
export interface Bill {
  id: string; billNumber: string; clientId: string; date: string; dueDate: string;
  subtotal: number; tax: number; discount: number; total: number; paidAmount: number;
  status: string; notes: string | null; billType: string; clientGst: string | null; clientAddress: string | null;
  client: Client; items: BillItem[];
}

const GST_RATE = 0.18; // 18% GST
const CGST_RATE = 0.09; // 9% CGST
const SGST_RATE = 0.09; // 9% SGST

export default function BillsView({ businessId }: { businessId: string }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [billType, setBillType] = useState<'gst' | 'non_gst'>('non_gst');
  const [form, setForm] = useState({
    clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0],
    dueDate: '', discount: '0', notes: '', clientGst: '', clientAddress: '',
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
          // Rate includes GST - extract base rate
          const baseRate = r / (1 + GST_RATE);
          const gstPerUnit = r - baseRate;
          newItems[index].baseRate = baseRate.toFixed(2);
          newItems[index].cgst = (baseRate * CGST_RATE * q).toFixed(2);
          newItems[index].sgst = (baseRate * SGST_RATE * q).toFixed(2);
          newItems[index].amount = (r * q).toFixed(2);
        } else {
          // Rate excludes GST - add GST on top
          const baseRate = r;
          newItems[index].baseRate = baseRate.toFixed(2);
          newItems[index].cgst = (baseRate * CGST_RATE * q).toFixed(2);
          newItems[index].sgst = (baseRate * SGST_RATE * q).toFixed(2);
          newItems[index].amount = (baseRate * (1 + GST_RATE) * q).toFixed(2);
        }
      } else {
        // Non-GST bill
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
    itemName: '', taxMode: billType === 'gst' ? 'excl' : 'excl', cgst: '0', sgst: '0', baseRate: '0',
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
    if (!form.clientId || !form.billNumber || !form.dueDate) return;
    try {
      await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          clientId: form.clientId,
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
    setForm({ clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0], dueDate: '', discount: '0', notes: '', clientGst: '', clientAddress: '' });
    setItems([{ description: '', quantity: '1', rate: '0', amount: '0', itemName: '', taxMode: 'excl', cgst: '0', sgst: '0', baseRate: '0' }]);
    setBillType('non_gst');
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

  // When bill type changes, recalculate all items
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
        return {
          ...item,
          baseRate: r.toFixed(2),
          cgst: '0',
          sgst: '0',
          amount: (q * r).toFixed(2),
        };
      }
    });
    setItems(newItems);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bills</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{bills.length} bills</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => setForm(f => ({ ...f, billNumber: nextBillNum() }))}>
              <Plus className="h-4 w-4" /> New Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Bill</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Bill Type Selection */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Bill Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleBillTypeChange('gst')}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      billType === 'gst'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <FileCheck className="h-6 w-6 mx-auto mb-2" />
                    <p className="font-bold text-sm">GST Bill</p>
                    <p className="text-xs mt-1">With CGST/SGST (18%)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBillTypeChange('non_gst')}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      billType === 'non_gst'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <FileMinus className="h-6 w-6 mx-auto mb-2" />
                    <p className="font-bold text-sm">Non-GST Bill</p>
                    <p className="text-xs mt-1">Without GST</p>
                  </button>
                </div>
              </div>

              {/* Client Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client *</Label>
                  <Select value={form.clientId} onValueChange={(v) => {
                    const client = clients.find(c => c.id === v);
                    setForm({ ...form, clientId: v, clientAddress: client?.address || '', clientGst: '' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Bill # *</Label><Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} /></div>
              </div>

              {/* GST-specific fields */}
              {billType === 'gst' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div>
                    <Label>Client GSTIN</Label>
                    <Input
                      value={form.clientGst}
                      onChange={(e) => setForm({ ...form, clientGst: e.target.value.toUpperCase() })}
                      placeholder="e.g. 19XXXXX1234F1ZG"
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label>Client Address</Label>
                    <Input
                      value={form.clientAddress}
                      onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                      placeholder="Client billing address"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Due Date *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <div><Label>Discount (₹)</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
              </div>

              {/* Items */}
              <div>
                <Label className="text-sm font-semibold">Items</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${billType === 'gst' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-2">
                          <Label className="text-[10px]">Item Name</Label>
                          <Input placeholder="Item" value={item.itemName} onChange={(e) => updateItem(i, 'itemName', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px]">Description</Label>
                          <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px]">Rate (₹)</Label>
                          <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-[10px]">Qty</Label>
                          <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="h-8 text-xs" />
                        </div>
                        {billType === 'gst' && (
                          <div className="col-span-2">
                            <Label className="text-[10px]">Tax Mode</Label>
                            <Select value={item.taxMode} onValueChange={(v) => updateItem(i, 'taxMode', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excl">Excl. GST</SelectItem>
                                <SelectItem value="incl">Incl. GST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="col-span-1">
                          <Label className="text-[10px]">Total</Label>
                          <Input readOnly value={item.amount} className="h-8 text-xs bg-white dark:bg-gray-900" />
                        </div>
                        <div className="col-span-1">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      {billType === 'gst' && parseFloat(item.rate) > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex gap-3">
                          <span>Base: ₹{parseFloat(item.baseRate).toFixed(2)}</span>
                          <span>CGST: ₹{item.cgst}</span>
                          <span>SGST: ₹{item.sgst}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addItem} className="mt-2 gap-1"><Plus className="h-3 w-3" /> Add Item</Button>
              </div>

              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
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

              <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!form.clientId || !form.billNumber || !form.dueDate}>
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
            <Card key={bill.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    bill.billType === 'gst' ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <FileText className={`h-5 w-5 ${bill.billType === 'gst' ? 'text-blue-500' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {bill.billNumber}
                      {bill.billType === 'gst' && (
                        <Badge className="ml-2 text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GST</Badge>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{bill.client.name} • {new Date(bill.date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{fmt(bill.total)}</p>
                    <Badge className={`text-[10px] ${statusColor(bill.status)}`}>
                      {bill.status === 'paid' ? 'Paid' : bill.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewBill(bill)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      <Eye className="h-4 w-4 text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(bill.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950 rounded">
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Invoice Preview */}
      {viewBill && (
        <InvoicePreview bill={viewBill} onClose={() => setViewBill(null)} />
      )}
    </div>
  );
}
