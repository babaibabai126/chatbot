'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Printer, Eye } from 'lucide-react';

interface Client { id: string; name: string; company: string | null; phone: string; }
interface BillItem { id?: string; description: string; quantity: string; rate: string; amount: string; }
interface Bill {
  id: string; billNumber: string; clientId: string; date: string; dueDate: string;
  subtotal: number; tax: number; discount: number; total: number; paidAmount: number;
  status: string; notes: string | null; client: Client; items: BillItem[];
}

export default function BillsView({ businessId }: { businessId: string }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [form, setForm] = useState({
    clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0],
    dueDate: '', tax: '0', discount: '0', notes: '',
  });
  const [items, setItems] = useState<BillItem[]>([{ description: '', quantity: '1', rate: '0', amount: '0' }]);

  const fmt = (n: number) => `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;

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
    if (field === 'quantity' || field === 'rate') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const r = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = (q * r).toFixed(2);
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: '', quantity: '1', rate: '0', amount: '0' }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const taxAmt = subtotal * (parseFloat(form.tax) || 0) / 100;
  const total = subtotal + taxAmt - (parseFloat(form.discount) || 0);

  const handleSubmit = async () => {
    if (!form.clientId || !form.billNumber || !form.dueDate) return;
    try {
      await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId, clientId: form.clientId, billNumber: form.billNumber,
          date: form.date, dueDate: form.dueDate,
          subtotal, tax: parseFloat(form.tax) || 0, discount: parseFloat(form.discount) || 0,
          total, notes: form.notes, items: items.map(i => ({
            description: i.description, quantity: parseFloat(i.quantity) || 0,
            rate: parseFloat(i.rate) || 0, amount: parseFloat(i.amount) || 0,
          })),
        }),
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setForm({ clientId: '', billNumber: '', date: new Date().toISOString().split('T')[0], dueDate: '', tax: '0', discount: '0', notes: '' });
    setItems([{ description: '', quantity: '1', rate: '0', amount: '0' }]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('বিল মুছে ফেলতে চান? / Delete bill?')) return;
    await fetch(`/api/bills?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) { case 'paid': return 'bg-green-100 text-green-700'; case 'partial': return 'bg-yellow-100 text-yellow-700'; default: return 'bg-red-100 text-red-700'; }
  };

  const nextBillNum = () => {
    const num = bills.length > 0 ? Math.max(...bills.map(b => parseInt(b.billNumber.replace(/\D/g, '')) || 0)) + 1 : 1;
    return `BILL-${String(num).padStart(4, '0')}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">বিল / Bills</h2>
          <p className="text-sm text-gray-500">{bills.length} টি বিল</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setForm(f => ({ ...f, billNumber: nextBillNum() }))}>
              <Plus className="h-4 w-4" /> নতুন বিল / New Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>নতুন বিল তৈরি / Create Bill</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ক্লায়েন্ট / Client *</Label>
                  <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                    <SelectTrigger><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>বিল নম্বর / Bill # *</Label><Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>তারিখ / Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>শেষ তারিখ / Due Date *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <div><Label>ট্যাক্স % / Tax %</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
              </div>

              {/* Items */}
              <div>
                <Label>আইটেম / Items</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} /></div>
                      <div className="col-span-2"><Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></div>
                      <div className="col-span-2"><Input type="number" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} /></div>
                      <div className="col-span-2"><Input readOnly value={item.amount} className="bg-gray-50" /></div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button></div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addItem} className="mt-2 gap-1"><Plus className="h-3 w-3" /> আইটেম যোগ / Add Item</Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>ডিসকাউন্ট / Discount</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
                <div><Label>নোট / Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." /></div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm"><span>সাবটোটাল / Subtotal:</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>ট্যাক্স / Tax ({form.tax}%):</span><span>{fmt(taxAmt)}</span></div>
                {parseFloat(form.discount) > 0 && <div className="flex justify-between text-sm"><span>ডিসকাউন্ট / Discount:</span><span>-{fmt(parseFloat(form.discount))}</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1"><span>মোট / Total:</span><span>{fmt(total)}</span></div>
              </div>

              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!form.clientId || !form.billNumber || !form.dueDate}>
                বিল তৈরি করুন / Create Bill
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">লোড হচ্ছে...</div> : bills.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">কোনো বিল নেই / No bills yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => (
            <Card key={bill.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{bill.billNumber}</p>
                    <p className="text-xs text-gray-500">{bill.client.name} • {new Date(bill.date).toLocaleDateString('en-BD')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{fmt(bill.total)}</p>
                    <Badge className={`text-[10px] ${statusColor(bill.status)}`}>
                      {bill.status === 'paid' ? 'পরিশোধিত' : bill.status === 'partial' ? 'আংশিক' : 'অপরিশোধিত'}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewBill(bill)} className="p-1.5 hover:bg-gray-100 rounded"><Eye className="h-4 w-4 text-gray-400" /></button>
                    <button onClick={() => handleDelete(bill.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-gray-400" /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Bill Dialog */}
      <Dialog open={!!viewBill} onOpenChange={() => setViewBill(null)}>
        <DialogContent className="max-w-lg">
          {viewBill && (
            <>
              <DialogHeader><DialogTitle>বিল বিস্তারিত / Bill Details</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between">
                  <div><p className="font-bold text-lg">{viewBill.billNumber}</p><p className="text-sm text-gray-500">{viewBill.client.name}</p></div>
                  <Badge className={statusColor(viewBill.status)}>{viewBill.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>তারিখ: {new Date(viewBill.date).toLocaleDateString('en-BD')}</p>
                  <p>শেষ তারিখ: {new Date(viewBill.dueDate).toLocaleDateString('en-BD')}</p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="p-2 text-left">বিবরণ</th><th className="p-2 text-right">পরিমাণ</th><th className="p-2 text-right">রেট</th><th className="p-2 text-right">মোট</th></tr></thead>
                    <tbody>
                      {viewBill.items.map((item, i) => (
                        <tr key={i} className="border-t"><td className="p-2">{item.description}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right">{fmt(item.rate)}</td><td className="p-2 text-right">{fmt(item.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm">সাবটোটাল: {fmt(viewBill.subtotal)}</p>
                  <p className="text-sm">ট্যাক্স: {fmt(viewBill.tax)}</p>
                  <p className="font-bold text-lg">মোট: {fmt(viewBill.total)}</p>
                  {viewBill.paidAmount > 0 && <p className="text-sm text-green-600">পরিশোধিত: {fmt(viewBill.paidAmount)}</p>}
                  {viewBill.total - viewBill.paidAmount > 0 && <p className="text-sm text-red-600">বকেয়া: {fmt(viewBill.total - viewBill.paidAmount)}</p>}
                </div>
                <Button variant="outline" className="w-full gap-1.5" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> প্রিন্ট / Print
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
