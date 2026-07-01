'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, Receipt, Wallet, CreditCard, AlertCircle, TrendingUp, TrendingDown, IndianRupee } from 'lucide-react';
import { useAppStore, ViewType } from '@/lib/store';

interface DashboardData {
  counts: { clients: number; bills: number; quotations: number; expenses: number; payments: number };
  financial: { totalBilled: number; totalPaid: number; totalExpenses: number; totalDue: number; profit: number };
  unpaidBills: Array<{ id: string; billNumber: string; total: number; paidAmount: number; dueDate: string; client: { name: string } }>;
  recentActivity: {
    bills: Array<{ id: string; billNumber: string; total: number; status: string; createdAt: string; client: { name: string } }>;
    payments: Array<{ id: string; amount: number; date: string; paymentMethod: string; client: { name: string } }>;
    expenses: Array<{ id: string; category: string; description: string; amount: number; date: string }>;
  };
  categoryBreakdown: Record<string, number>;
}

export default function DashboardView({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCurrentView } = useAppStore();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?businessId=${businessId}`);
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return <div className="p-6 text-center text-gray-400">লোড হচ্ছে... / Loading...</div>;
  }

  if (!data) return <div className="p-6 text-center text-gray-400">ডাটা পাওয়া যায়নি</div>;

  const stats: Array<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    clickable: boolean;
    view?: ViewType;
    iconSize?: 'normal' | 'large';
  }> = [
    {
      label: 'Clients',
      value: data.counts.clients,
      icon: <Users className="h-5 w-5" />,
      color: 'text-blue-600 bg-blue-50',
      clickable: true,
      view: 'clients',
    },
    {
      label: 'Total Billing',
      value: fmt(data.financial.totalBilled),
      icon: <FileText className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-50',
      clickable: true,
      view: 'bills',
    },
    {
      label: 'Payment Received',
      value: fmt(data.financial.totalPaid),
      icon: <IndianRupee className="h-7 w-7" />,
      color: 'text-green-600 bg-green-50',
      clickable: true,
      view: 'payments',
      iconSize: 'large',
    },
    {
      label: 'Expenses',
      value: fmt(data.financial.totalExpenses),
      icon: <Wallet className="h-5 w-5" />,
      color: 'text-orange-600 bg-orange-50',
      clickable: true,
      view: 'expenses',
    },
    {
      label: 'Client Dues',
      value: fmt(data.financial.totalDue),
      icon: <AlertCircle className="h-5 w-5" />,
      color: 'text-red-600 bg-red-50',
      clickable: true,
      view: 'dues',
    },
    {
      label: 'Profit',
      value: fmt(data.financial.profit),
      icon: data.financial.profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
      color: data.financial.profit >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50',
      clickable: false,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{businessName}</h2>
        <p className="text-gray-500 text-sm mt-1">Dashboard Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const isLargeIcon = s.iconSize === 'large';
          const card = (
            <Card
              key={i}
              className={`p-4 transition-all ${
                s.clickable
                  ? 'hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-[0.98]'
                  : 'hover:shadow-md'
              }`}
            >
              <div className={`inline-flex p-2 rounded-lg ${s.color} mb-2 ${isLargeIcon ? 'p-3' : ''}`}>
                {s.icon}
              </div>
              <p className={`font-bold text-gray-900 ${isLargeIcon ? 'text-xl' : 'text-lg'}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </Card>
          );

          if (s.clickable && s.view) {
            return (
              <div key={i} onClick={() => setCurrentView(s.view)}>
                {card}
              </div>
            );
          }
          return card;
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Dues */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Upcoming Dues
          </h3>
          {data.unpaidBills.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No dues</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.unpaidBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50/50 border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{bill.client.name}</p>
                    <p className="text-xs text-gray-500">{bill.billNumber} • Due: {new Date(bill.dueDate).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{fmt(bill.total - bill.paidAmount)}</p>
                    <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700">{bill.total === bill.paidAmount ? 'Paid' : bill.paidAmount > 0 ? 'Partial' : 'Unpaid'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-500" />
            Recent Activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentActivity.payments.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-50/50 border border-green-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">💵 {p.client.name}</p>
                  <p className="text-xs text-gray-500">{p.paymentMethod} • {new Date(p.date).toLocaleDateString('en-IN')}</p>
                </div>
                <p className="text-sm font-bold text-green-600">+{fmt(p.amount)}</p>
              </div>
            ))}
            {data.recentActivity.expenses.slice(0, 3).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-orange-50/50 border border-orange-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">📤 {e.description}</p>
                  <p className="text-xs text-gray-500">{e.category} • {new Date(e.date).toLocaleDateString('en-IN')}</p>
                </div>
                <p className="text-sm font-bold text-orange-600">-{fmt(e.amount)}</p>
              </div>
            ))}
            {data.recentActivity.bills.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50/50 border border-blue-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">📄 {b.client.name}</p>
                  <p className="text-xs text-gray-500">{b.billNumber}</p>
                </div>
                <p className="text-sm font-bold text-blue-600">{fmt(b.total)}</p>
              </div>
            ))}
            {data.recentActivity.payments.length === 0 && data.recentActivity.expenses.length === 0 && data.recentActivity.bills.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Expense Categories */}
      {Object.keys(data.categoryBreakdown).length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense Categories</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.categoryBreakdown).map(([cat, amount]) => (
              <Badge key={cat} variant="secondary" className="text-xs py-1.5 px-3 bg-gray-100">
                {cat}: {fmt(amount)}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
