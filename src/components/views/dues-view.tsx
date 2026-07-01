'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface DueBill {
  id: string; billNumber: string; total: number; paidAmount: number;
  dueDate: string; status: string;
  client: { name: string; company: string | null; phone: string };
}

export default function DuesView({ businessId }: { businessId: string }) {
  const [dueBills, setDueBills] = useState<DueBill[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/bills?businessId=${businessId}&status=unpaid`);
      const partialRes = await fetch(`/api/bills?businessId=${businessId}&status=partial`);
      const unpaid = await res.json();
      const partial = await partialRes.json();
      setDueBills([...partial, ...unpaid]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDue = dueBills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);
  const overdueBills = dueBills.filter(b => new Date(b.dueDate) < new Date());
  const upcomingBills = dueBills.filter(b => new Date(b.dueDate) >= new Date());

  if (loading) return <div className="p-6 text-center text-gray-400">লোড হচ্ছে...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">বকেয়া / Upcoming Dues</h2>
        <p className="text-sm text-gray-500">মোট বকেয়া / Total Due: <span className="font-bold text-red-600">{fmt(totalDue)}</span></p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-2xl font-bold text-red-600">{overdueBills.length}</p>
          <p className="text-xs text-gray-500">মেয়াদোত্তীর্ণ / Overdue</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-600">{upcomingBills.length}</p>
          <p className="text-xs text-gray-500">আসন্ন / Upcoming</p>
        </Card>
      </div>

      {/* Overdue */}
      {overdueBills.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-2">মেয়াদোত্তীর্ণ / Overdue</h3>
          <div className="space-y-2">
            {overdueBills.map(b => (
              <Card key={b.id} className="p-4 border-red-200 bg-red-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-red-500" /></div>
                    <div>
                      <p className="font-semibold text-gray-900">{b.client.name}</p>
                      <p className="text-xs text-gray-500">{b.billNumber} • মেয়াদ: {new Date(b.dueDate).toLocaleDateString('en-IN')}</p>
                      {b.client.phone && <p className="text-xs text-gray-400">ফোন: {b.client.phone}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{fmt(b.total - b.paidAmount)}</p>
                    <Badge className="text-[10px] bg-red-100 text-red-700">
                      {b.status === 'partial' ? 'আংশিক' : 'অপরিশোধিত'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingBills.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-600 mb-2">আসন্ন / Upcoming</h3>
          <div className="space-y-2">
            {upcomingBills.map(b => (
              <Card key={b.id} className="p-4 border-amber-200 bg-amber-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-amber-500" /></div>
                    <div>
                      <p className="font-semibold text-gray-900">{b.client.name}</p>
                      <p className="text-xs text-gray-500">{b.billNumber} • শেষ তারিখ: {new Date(b.dueDate).toLocaleDateString('en-IN')}</p>
                      {b.client.phone && <p className="text-xs text-gray-400">ফোন: {b.client.phone}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">{fmt(b.total - b.paidAmount)}</p>
                    <Badge className="text-[10px] bg-amber-100 text-amber-700">
                      {b.status === 'partial' ? `আংশিক (${fmt(b.paidAmount)} পরিশোধিত)` : 'অপরিশোধিত'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {dueBills.length === 0 && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">কোনো বকেয়া নেই! / No dues!</p>
          <p className="text-sm text-green-500 mt-1">🎉 সব পরিশোধিত / All paid up</p>
        </Card>
      )}
    </div>
  );
}
