import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dashboard?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Get counts
    const [clientCount, billCount, quotationCount, expenseCount, paymentCount] = await Promise.all([
      db.client.count({ where: { businessId } }),
      db.bill.count({ where: { businessId } }),
      db.quotation.count({ where: { businessId } }),
      db.expense.count({ where: { businessId } }),
      db.payment.count({ where: { businessId } }),
    ]);

    // Get financial summaries
    const [totalBilled, totalPaid, totalExpenses, unpaidBills] = await Promise.all([
      db.bill.aggregate({ where: { businessId }, _sum: { total: true } }),
      db.payment.aggregate({ where: { businessId }, _sum: { amount: true } }),
      db.expense.aggregate({ where: { businessId }, _sum: { amount: true } }),
      db.bill.findMany({
        where: { businessId, status: { in: ['unpaid', 'partial'] } },
        include: { client: { select: { name: true, company: true, phone: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // Recent activity
    const [recentBills, recentPayments, recentExpenses] = await Promise.all([
      db.bill.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      db.payment.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      db.expense.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Expense categories breakdown
    const expenses = await db.expense.findMany({ where: { businessId } });
    const categoryBreakdown: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
    });

    // Calculate total due
    const totalDue = unpaidBills.reduce((sum, bill) => sum + (bill.total - bill.paidAmount), 0);

    return NextResponse.json({
      counts: { clients: clientCount, bills: billCount, quotations: quotationCount, expenses: expenseCount, payments: paymentCount },
      financial: {
        totalBilled: totalBilled._sum.total || 0,
        totalPaid: totalPaid._sum.amount || 0,
        totalExpenses: totalExpenses._sum.amount || 0,
        totalDue,
        profit: (totalPaid._sum.amount || 0) - (totalExpenses._sum.amount || 0),
      },
      unpaidBills,
      recentActivity: { bills: recentBills, payments: recentPayments, expenses: recentExpenses },
      categoryBreakdown,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
