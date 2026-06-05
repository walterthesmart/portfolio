import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculatePositions, calculateOverallMetrics, calculateAdvancedMetrics } from '@/lib/calculations';
import { PriceData } from '@/types';

export async function POST(request: Request) {
  try {
    const { startDate, endDate, excludedSymbols = [], livePrices = {} } = await request.json();

    // 1. Fetch transactions from DB
    let transactions = await prisma.transaction.findMany({
      orderBy: { date: 'asc' },
    });

    // 2. Filter transactions by end date if provided
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      transactions = transactions.filter(t => new Date(t.date).getTime() <= endMs);
    }

    // 3. Calculate all positions (using start date for Performance Period reset)
    const allPositions = calculatePositions(transactions, livePrices, startDate);

    // 4. Filter active items
    const activePositions = allPositions.filter(p => !excludedSymbols.includes(p.symbol));
    const activeTransactions = transactions.filter(t => !excludedSymbols.includes(t.symbol));

    // 5. Calculate metrics
    const metrics = calculateOverallMetrics(activeTransactions, activePositions);
    const advancedMetrics = calculateAdvancedMetrics(
      activeTransactions, 
      livePrices, 
      metrics.totalValue, 
      startDate, 
      excludedSymbols.includes('GEF Cash')
    );

    return NextResponse.json({
      data: {
        allPositions,
        activePositions,
        metrics,
        advancedMetrics
      }
    });

  } catch (error) {
    console.error('API /metrics error:', error);
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 });
  }
}
