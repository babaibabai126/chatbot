import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/quotations?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const quotations = await db.quotation.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true, phone: true } },
        items: true,
      },
    });

    return NextResponse.json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

// POST /api/quotations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, clientId, quotationNumber, date, validUntil, subtotal, tax, discount, total, status, notes, items } = body;

    if (!businessId || !clientId || !quotationNumber || !date || !validUntil || total === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const quotation = await db.quotation.create({
      data: {
        businessId,
        clientId,
        quotationNumber,
        date: new Date(date),
        validUntil: new Date(validUntil),
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        total: parseFloat(total) || 0,
        status: status || 'draft',
        notes,
        items: {
          create: (items || []).map((item: { description: string; quantity: number; rate: number; amount: number }) => ({
            description: item.description,
            quantity: parseFloat(String(item.quantity)) || 0,
            rate: parseFloat(String(item.rate)) || 0,
            amount: parseFloat(String(item.amount)) || 0,
          })),
        },
      },
      include: { items: true, client: true },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
  }
}

// PUT /api/quotations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const quotation = await db.quotation.update({
      where: { id },
      data: updateData,
      include: { items: true, client: true },
    });

    return NextResponse.json(quotation);
  } catch (error) {
    console.error('Error updating quotation:', error);
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

// DELETE /api/quotations?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    await db.quotationItem.deleteMany({ where: { quotationId: id } });
    await db.quotation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
