import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/bills?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const status = searchParams.get('status');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;

    const bills = await db.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true, phone: true, address: true, email: true } },
        items: true,
        payments: true,
      },
    });

    return NextResponse.json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

// POST /api/bills
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessId, clientId, billNumber, date, dueDate,
      subtotal, tax, discount, total, status, notes,
      billType, clientGst, clientAddress, items
    } = body;

    if (!businessId || !clientId || !billNumber || !date || !dueDate || total === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const bill = await db.bill.create({
      data: {
        businessId,
        clientId,
        billNumber,
        date: new Date(date),
        dueDate: new Date(dueDate),
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        total: parseFloat(total) || 0,
        status: status || 'unpaid',
        notes,
        billType: billType || 'non_gst',
        clientGst: clientGst || null,
        clientAddress: clientAddress || null,
        items: {
          create: (items || []).map((item: {
            description: string; quantity: number; rate: number; amount: number;
            itemName?: string; taxMode?: string; cgst?: number; sgst?: number;
            igst?: number; baseRate?: number;
          }) => ({
            description: item.description,
            quantity: parseFloat(String(item.quantity)) || 0,
            rate: parseFloat(String(item.rate)) || 0,
            amount: parseFloat(String(item.amount)) || 0,
            itemName: item.itemName || null,
            taxMode: item.taxMode || 'excl',
            cgst: parseFloat(String(item.cgst)) || 0,
            sgst: parseFloat(String(item.sgst)) || 0,
            igst: parseFloat(String(item.igst)) || 0,
            baseRate: parseFloat(String(item.baseRate)) || 0,
          })),
        },
      },
      include: { items: true, client: true },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

// PUT /api/bills - update status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, paidAmount, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paidAmount !== undefined) updateData.paidAmount = parseFloat(String(paidAmount)) || 0;
    if (notes !== undefined) updateData.notes = notes;

    const bill = await db.bill.update({
      where: { id },
      data: updateData,
      include: { items: true, client: true, payments: true },
    });

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

// DELETE /api/bills?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    await db.billItem.deleteMany({ where: { billId: id } });
    await db.payment.deleteMany({ where: { billId: id } });
    await db.bill.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
  }
}
