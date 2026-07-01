'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Plus, Trash2 } from 'lucide-react';

interface Expense {
  id: string; category: string; description: string; amount: number;
  date: string; paymentMethod: string | null; receipt: string | null;
}

const CATEGORIES = [
  'Office Rent / অফিস ভাড়া',
  'Salary / বেতন',
  'Internet / ইন্টারনেট',
  'Software / সফটওয়্যার',
  'Marketing / মার্কেটিং',
  'Travel / ভ্রমণ',
  'Food / খাবার',
  'Equipment / যন্ত্রপাতি',
  'Utilities / ইউটিলিটি',
  'Miscellaneous / বিবিধ',
];

export default function ExpensesView({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [form, setForm] = useState({
    category: '', description: '', amount: '',
    date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash',
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fetchExpenses = useCallback(async () => {
    try {
      const url = filterCategory !== 'all'
        ? `/api/expenses?businessId=${businessId}&category=${filterCategory}`
        : `/api/expenses?businessId=${businessId}`;
      const res = await fetch(url);
      setExpenses(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [businessId, filterCategory]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSubmit = async () => {
    if (!form.category || !form.description || !form.amount) return;
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, ...form, amount: parseFloat(form.amount) }),
      });
      setDialogOpen(false);
      setForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash' });
      fetchExpenses();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('খরচ মুছে ফেলতে চান? / Delete expense?')) return;
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    fetchExpenses();
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryBreakdown = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">খরচ / Expenses</h2>
          <p className="text-sm text-gray-500">{businessName} • মোট: {fmt(totalExpenses)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> খরচ যোগ / Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন খরচ / New Expense</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>ক্যাটাগরি / Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>বিবরণ / Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was the expense for?" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>পরিমাণ / Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
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
              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">খরচ যোগ করুন / Add Expense</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">ক্যাটাগরি ভিত্তিক / By Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryBreakdown).map(([cat, amt]) => (
              <Badge key={cat} variant="secondary" className="text-xs py-1.5 px-3 cursor-pointer hover:bg-emerald-50" onClick={() => setFilterCategory(cat)}>
                {cat}: {fmt(amt)}
              </Badge>
            ))}
            {filterCategory !== 'all' && (
              <Badge variant="outline" className="text-xs py-1.5 px-3 cursor-pointer" onClick={() => setFilterCategory('all')}>
                ✕ সব / All
              </Badge>
            )}
          </div>
        </Card>
      )}

      {loading ? <div className="text-center py-8 text-gray-400">লোড হচ্ছে...</div> : expenses.length === 0 ? (
        <Card className="p-8 text-center"><Wallet className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">কোনো খরচ নেই / No expenses</p></Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center"><Wallet className="h-5 w-5 text-orange-500" /></div>
                  <div>
                    <p className="font-medium text-gray-900">{e.description}</p>
                    <p className="text-xs text-gray-500">{e.category} • {new Date(e.date).toLocaleDateString('en-IN')}{e.paymentMethod ? ` • ${e.paymentMethod}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-orange-600">{fmt(e.amount)}</p>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-gray-400" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
