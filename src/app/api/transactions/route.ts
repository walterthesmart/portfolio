import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const transactionSchema = z.object({
  id: z.string().optional(),
  symbol: z.string().min(1),
  date: z.string(),
  type: z.enum(['BUY', 'SELL', 'TXIN', 'TXOUT']),
  price: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  fees: z.number().nonnegative().default(0),
  assetClass: z.string().default('Stock'),
});

const bulkTransactionSchema = z.array(transactionSchema);

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if it's a bulk import
    if (Array.isArray(body)) {
      const parsed = bulkTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
      }

      const result = await prisma.$transaction(
        parsed.data.map(tx => prisma.transaction.create({ data: tx }))
      );

      return NextResponse.json({ data: result }, { status: 201 });
    } else {
      // Single transaction
      const parsed = transactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
      }

      const tx = await prisma.transaction.create({ data: parsed.data });
      return NextResponse.json({ data: tx }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to create transaction(s):', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await prisma.transaction.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } else {
      // Clear all
      await prisma.transaction.deleteMany();
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Failed to delete transaction(s):', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
