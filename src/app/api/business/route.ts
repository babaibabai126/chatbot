import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/business - Get all businesses
export async function GET() {
  try {
    const businesses = await db.business.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Seed if empty
    if (businesses.length === 0) {
      const seeded = await Promise.all([
        db.business.create({
          data: { name: 'AAROHAN TECH SOLUTIONS', type: 'MARKETING AGENCY', isActive: true },
        }),
        db.business.create({
          data: { name: 'ASTRONAUT STIKERZ', type: 'NOTEBOOK & MOUSEPAD', isActive: true },
        }),
        db.business.create({
          data: { name: 'AAROHAN WEB ACADEMY', type: 'INSTITUTE', isActive: true },
        }),
      ]);
      return NextResponse.json(seeded);
    }

    return NextResponse.json(businesses);
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 });
  }
}

// POST /api/business - Create new business
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const business = await db.business.create({
      data: { name: name.toUpperCase(), type: type.toUpperCase(), isActive: true },
    });

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    console.error('Error creating business:', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}
