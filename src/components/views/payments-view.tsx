'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Plus, Trash2 } from 'lucide-react';

interface Client { id: string; name: string; company: string | null; }
interface Bill { id: string; billNumber: string; total: number; paidAmount: number; status: string; }
interface Payment {
  id: string; amount: number; date: string; paymentMethod: string; receiptNumber: string;
  notes: string | null; clientId: string; billId: string | null;
  client: { name: string; company: string | null };
  bill: { id: string; billNumber: string } | null;
}

export default function PaymentsView({ businessId }: { businessId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: '', billId: '', amount: '', date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash', receiptNumber: '', notes: '',
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        fetch(`/api/payments?businessId=${businessId}`),
        fetch(`/api/clients?businessId=${businessId}`),
        fetch(`/api/bills?businessId=${businessId}`),
      ]);
      setPayments(await pRes.json());
      setClients(await cRes.json());
      setBills(await bRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unpaidBills = bills.filter(b => b.status !== 'paid');

  const handleSubmit = async () => {
    if (!form.clientId || !form.amount || !form.receiptNumber) return;
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId, clientId: form.clientId, billId: form.billId || null,
          amount: parseFloat(form.amount), date: form.date,
          paymentMethod: form.paymentMethod, receiptNumber: form.receiptNumber, notes: form.notes,
        }),
      });
      setDialogOpen(false);
      setForm({ clientId: '', billId: '', amount: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash', receiptNumber: '', notes: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('পেমেন্ট মুছে ফেলতে চান? / Delete payment?')) return;
    await fetch(`/api/payments?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const nextReceipt = () => `RCP-${String(payments.length + 1).padStart(4, '0')}`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">পেমেন্ট / Payments</h2>
          <p className="text-sm text-gray-500">মোট প্রাপ্ত: {fmt(totalReceived)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (open) setForm(f => ({ ...f, receiptNumber: nextReceipt() })); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> পেমেন্ট যোগ / Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন পেমেন্ট / New Payment</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>ক্লায়েন্ট / Client *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, billId: '' })}>
                  <SelectTrigger><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.clientId && unpaidBills.length > 0 && (
                <div>
                  <Label>বিল (ঐচ্ছিক) / Bill (optional)</Label>
                  <Select value={form.billId} onValueChange={(v) => {
                    const bill = bills.find(b => b.id === v);
                    setForm({ ...form, billId: v, amount: bill ? String(bill.total - bill.paidAmount) : form.amount });
                  }}>
                    <SelectTrigger><SelectValue placeholder="বিল সিলেক্ট করুন" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">বিল ছাড়া / No bill</SelectItem>
                      {unpaidBills.filter(b => true).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.billNumber} - {fmt(b.total - b.paidAmount)} বকেয়া</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>পরিমাণ / Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>রসিদ # / Receipt # *</Label><Input value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>তারিখ / Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div>
                  <Label>পেমেন্ট / Method</Label>
                  <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>নোট / Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">পেমেন্ট যোগ করুন / Add Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">লোড হচ্ছে...</div> : payments.length === 0 ? (
        <Card className="p-8 text-center"><CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">কোনো পেমেন্ট নেই / No payments</p></Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <Card key={p.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"><CreditCard className="h-5 w-5 text-green-500" /></div>
                  <div>
                    <p className="font-medium text-gray-900">{p.client.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.receiptNumber} • {p.paymentMethod} • {new Date(p.date).toLocaleDateString('en-IN')}
                      {p.bill && ` • ${p.bill.billNumber}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-green-600">+{fmt(p.amount)}</p>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-gray-400" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
