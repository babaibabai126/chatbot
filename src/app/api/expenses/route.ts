import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/expenses?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const category = searchParams.get('category');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { businessId };
    if (category) where.category = category;

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, category, description, amount, date, paymentMethod, receipt } = body;

    if (!businessId || !category || !description || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expense = await db.expense.create({
      data: {
        businessId,
        category,
        description,
        amount: parseFloat(String(amount)) || 0,
        date: new Date(date),
        paymentMethod,
        receipt,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// PUT /api/expenses
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, category, description, amount, date, paymentMethod, receipt } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        category,
        description,
        amount: amount !== undefined ? parseFloat(String(amount)) : undefined,
        date: date ? new Date(date) : undefined,
        paymentMethod,
        receipt,
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/expenses?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    await db.expense.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
