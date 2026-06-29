import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/payments?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const clientId = searchParams.get('clientId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { businessId };
    if (clientId) where.clientId = clientId;

    const payments = await db.payment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true } },
        bill: { select: { id: true, billNumber: true } },
      },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, clientId, billId, amount, date, paymentMethod, receiptNumber, notes } = body;

    if (!businessId || !clientId || !amount || !date || !paymentMethod || !receiptNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payment = await db.payment.create({
      data: {
        businessId,
        clientId,
        billId: billId || null,
        amount: parseFloat(String(amount)) || 0,
        date: new Date(date),
        paymentMethod,
        receiptNumber,
        notes,
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        bill: { select: { id: true, billNumber: true } },
      },
    });

    // Update bill paid amount if billId is provided
    if (billId) {
      const bill = await db.bill.findUnique({ where: { id: billId }, include: { payments: true } });
      if (bill) {
        const totalPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
        const newStatus = totalPaid >= bill.total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
        await db.bill.update({
          where: { id: billId },
          data: { paidAmount: totalPaid, status: newStatus },
        });
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

// DELETE /api/payments?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    await db.payment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
