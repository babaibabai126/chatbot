'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Plus, Trash2, Eye } from 'lucide-react';

interface Client { id: string; name: string; company: string | null; }
interface QuotationItem { id?: string; description: string; quantity: string; rate: string; amount: string; }
interface Quotation {
  id: string; quotationNumber: string; clientId: string; date: string; validUntil: string;
  subtotal: number; tax: number; discount: number; total: number; status: string; notes: string | null;
  client: Client; items: QuotationItem[];
}

export default function QuotationsView({ businessId }: { businessId: string }) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewQ, setViewQ] = useState<Quotation | null>(null);
  const [form, setForm] = useState({
    clientId: '', quotationNumber: '', date: new Date().toISOString().split('T')[0],
    validUntil: '', tax: '0', discount: '0', notes: '',
  });
  const [items, setItems] = useState<QuotationItem[]>([{ description: '', quantity: '1', rate: '0', amount: '0' }]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fetchData = useCallback(async () => {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quotations?businessId=${businessId}`),
        fetch(`/api/clients?businessId=${businessId}`),
      ]);
      setQuotations(await qRes.json());
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
    if (!form.clientId || !form.quotationNumber || !form.validUntil) return;
    try {
      await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId, clientId: form.clientId, quotationNumber: form.quotationNumber,
          date: form.date, validUntil: form.validUntil,
          subtotal, tax: parseFloat(form.tax) || 0, discount: parseFloat(form.discount) || 0,
          total, notes: form.notes, items: items.map(i => ({
            description: i.description, quantity: parseFloat(i.quantity) || 0,
            rate: parseFloat(i.rate) || 0, amount: parseFloat(i.amount) || 0,
          })),
        }),
      });
      setDialogOpen(false); resetForm(); fetchData();
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setForm({ clientId: '', quotationNumber: '', date: new Date().toISOString().split('T')[0], validUntil: '', tax: '0', discount: '0', notes: '' });
    setItems([{ description: '', quantity: '1', rate: '0', amount: '0' }]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('কোটেশন মুছে ফেলতে চান? / Delete quotation?')) return;
    await fetch(`/api/quotations?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await fetch('/api/quotations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) { case 'accepted': return 'bg-green-100 text-green-700'; case 'rejected': return 'bg-red-100 text-red-700'; case 'sent': return 'bg-blue-100 text-blue-700'; default: return 'bg-gray-100 text-gray-700'; }
  };

  const nextQuotNum = () => {
    const num = quotations.length > 0 ? Math.max(...quotations.map(q => parseInt(q.quotationNumber.replace(/\D/g, '')) || 0)) + 1 : 1;
    return `QUOT-${String(num).padStart(4, '0')}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">কোটেশন / Quotations</h2>
          <p className="text-sm text-gray-500">{quotations.length} টি কোটেশন</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setForm(f => ({ ...f, quotationNumber: nextQuotNum() }))}>
              <Plus className="h-4 w-4" /> নতুন কোটেশন / New Quotation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>নতুন কোটেশন / Create Quotation</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ক্লায়েন্ট / Client *</Label>
                  <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                    <SelectTrigger><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>কোটেশন # *</Label><Input value={form.quotationNumber} onChange={(e) => setForm({ ...form, quotationNumber: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>তারিখ / Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>বৈধ থাকবে / Valid Until *</Label><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
                <div><Label>ট্যাক্স %</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
              </div>
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
                <Button variant="outline" size="sm" onClick={addItem} className="mt-2 gap-1"><Plus className="h-3 w-3" /> আইটেম যোগ</Button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm"><span>সাবটোটাল:</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>ট্যাক্স:</span><span>{fmt(taxAmt)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-1"><span>মোট:</span><span>{fmt(total)}</span></div>
              </div>
              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">কোটেশন তৈরি / Create Quotation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">লোড হচ্ছে...</div> : quotations.length === 0 ? (
        <Card className="p-8 text-center"><Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">কোনো কোটেশন নেই / No quotations</p></Card>
      ) : (
        <div className="space-y-2">
          {quotations.map((q) => (
            <Card key={q.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center"><Receipt className="h-5 w-5 text-purple-500" /></div>
                  <div>
                    <p className="font-semibold text-gray-900">{q.quotationNumber}</p>
                    <p className="text-xs text-gray-500">{q.client.name} • Valid until: {new Date(q.validUntil).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{fmt(q.total)}</p>
                    <Badge className={`text-[10px] ${statusColor(q.status)}`}>{q.status}</Badge>
                  </div>
                  <div className="flex gap-1 flex-col">
                    {q.status === 'draft' && <button onClick={() => handleStatusUpdate(q.id, 'sent')} className="text-[10px] text-blue-600 hover:underline">Sent →</button>}
                    {q.status === 'sent' && <>
                      <button onClick={() => handleStatusUpdate(q.id, 'accepted')} className="text-[10px] text-green-600 hover:underline">Accept ✓</button>
                      <button onClick={() => handleStatusUpdate(q.id, 'rejected')} className="text-[10px] text-red-600 hover:underline">Reject ✗</button>
                    </>}
                    <button onClick={() => setViewQ(q)} className="p-1 hover:bg-gray-100 rounded"><Eye className="h-3.5 w-3.5 text-gray-400" /></button>
                    <button onClick={() => handleDelete(q.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5 text-gray-400" /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewQ} onOpenChange={() => setViewQ(null)}>
        <DialogContent className="max-w-lg">
          {viewQ && (
            <>
              <DialogHeader><DialogTitle>কোটেশন বিস্তারিত / Quotation Details</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between">
                  <div><p className="font-bold text-lg">{viewQ.quotationNumber}</p><p className="text-sm text-gray-500">{viewQ.client.name}</p></div>
                  <Badge className={statusColor(viewQ.status)}>{viewQ.status}</Badge>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="p-2 text-left">বিবরণ</th><th className="p-2 text-right">পরিমাণ</th><th className="p-2 text-right">রেট</th><th className="p-2 text-right">মোট</th></tr></thead>
                    <tbody>{viewQ.items.map((item, i) => (
                      <tr key={i} className="border-t"><td className="p-2">{item.description}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right">{fmt(item.rate)}</td><td className="p-2 text-right">{fmt(item.amount)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="text-right"><p className="font-bold text-lg">মোট: {fmt(viewQ.total)}</p></div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
