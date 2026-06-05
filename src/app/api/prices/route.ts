import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function fetchQuoteWithFallback(symbol: string) {
  let lastError;
  try { 
    const quote = await yahooFinance.quote(symbol); 
    return { 
      price: quote.regularMarketPrice, 
      previousClose: quote.regularMarketPreviousClose, 
      currency: quote.currency, 
      longName: quote.longName 
    }; 
  } catch(e) { lastError = e; }
  
  if (process.env.ALPHAVANTAGE_API_KEY) {
     try {
       const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`);
       const json = await res.json();
       if (json['Global Quote']) {
         return { price: parseFloat(json['Global Quote']['05. price']), currency: 'USD' };
       }
     } catch(e) { lastError = e; }
  }

  if (process.env.FINNHUB_API_KEY) {
     try {
       const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
       const json = await res.json();
       if (json.c) {
         return { price: json.c, currency: 'USD' };
       }
     } catch(e) { lastError = e; }
  }

  if (process.env.POLYGON_API_KEY) {
     try {
       const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`);
       const json = await res.json();
       if (json.results && json.results.length > 0) {
         return { price: json.results[0].c, currency: 'USD' };
       }
     } catch(e) { lastError = e; }
  }

  throw lastError || new Error('All providers failed');
}

async function fetchHistoricalWithFallback(symbol: string, startDate: string) {
  let lastError;
  try {
     const histData = await yahooFinance.historical(symbol, { period1: startDate, period2: new Date(), interval: '1d' });
     return histData.map((d: any) => ({
       date: d.date.toISOString().split('T')[0],
       close: d.close,
     }));
  } catch(e) { lastError = e; }

  if (process.env.ALPHAVANTAGE_API_KEY) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHAVANTAGE_API_KEY}`);
      const json = await res.json();
      const series = json['Time Series (Daily)'];
      if (series) {
        const hist = [];
        for (const [date, values] of Object.entries(series)) {
          if (date >= startDate) {
            hist.push({ date, close: parseFloat((values as any)['4. close']) });
          }
        }
        return hist.sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch(e) { lastError = e; }
  }
  
  return [];
}

export async function POST(request: Request) {
  try {
    const { symbols, startDate } = await request.json();

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'Symbols array is required' }, { status: 400 });
    }

    const uniqueSymbols = Array.from(new Set(symbols));
    const results: Record<string, any> = {};

    const fetchPromises = uniqueSymbols.map(async (symbol) => {
      try {
        const quote = await fetchQuoteWithFallback(symbol);
        
        let historical: any[] = [];
        if (startDate) {
          // Check cache for latest date
          const existingData = await prisma.historicalPrice.findMany({
            where: { symbol },
            orderBy: { date: 'desc' },
            take: 1
          });

          let fetchStartDate = startDate;
          if (existingData.length > 0) {
            const latestDbDate = existingData[0].date;
            if (latestDbDate >= startDate) {
              // We have data up to latestDbDate. Fetch only delta from latestDbDate onwards.
              // Wait, to be safe and get updates, we fetch from latestDbDate.
              fetchStartDate = latestDbDate;
            }
          }

          // Fetch the delta
          const freshData = await fetchHistoricalWithFallback(symbol, fetchStartDate);
          
          if (freshData.length > 0) {
            // Save to DB ignoring duplicates
            for (const d of freshData) {
              await prisma.historicalPrice.upsert({
                where: { symbol_date: { symbol, date: d.date } },
                update: { close: d.close },
                create: { symbol, date: d.date, close: d.close }
              });
            }
          }

          // Retrieve full cached series from startDate
          const cachedSeries = await prisma.historicalPrice.findMany({
            where: { symbol, date: { gte: startDate } },
            orderBy: { date: 'asc' }
          });
          
          historical = cachedSeries.map(c => ({ date: c.date, close: c.close }));
        }

        return {
          symbol,
          success: true,
          data: {
            ...quote,
            historical,
          }
        };
      } catch (err) {
        console.error(`Failed to fetch quote for ${symbol}:`, err);
        return { symbol, success: false, data: null };
      }
    });

    const settled = await Promise.all(fetchPromises);
    
    settled.forEach((res) => {
      if (res.success) {
        results[res.symbol] = res.data;
      } else {
        results[res.symbol] = null;
      }
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('API /prices error:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
