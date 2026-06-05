import { Transaction, PriceData, PortfolioPosition } from '@/types';
import { calculateTimeWeightedReturn, calculateMoneyWeightedReturn } from '@railpath/finance-toolkit';

export function calculatePositions(
  transactions: Transaction[],
  livePrices: Record<string, PriceData>,
  startDateStr?: string | null
): PortfolioPosition[] {
  const positionsMap: Record<string, { shares: number; totalCost: number; assetClass: string }> = {};
  let cashBalance = 0;

  // Sort transactions chronologically
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const targetStartMs = startDateStr ? new Date(startDateStr).getTime() : 0;
  
  const beforeTxs = targetStartMs > 0 ? sortedTxs.filter(tx => new Date(tx.date).getTime() < targetStartMs) : sortedTxs;
  const afterTxs = targetStartMs > 0 ? sortedTxs.filter(tx => new Date(tx.date).getTime() >= targetStartMs) : [];

  const processTx = (tx: Transaction) => {
    const amount = (tx.shares * tx.price) + (tx.fees || 0);
    const sellProceeds = (tx.shares * tx.price) - (tx.fees || 0);

    // Handle legacy 'BUY'/'SELL' of 'GEF Cash' that were cached before TXIN/TXOUT support
    if (tx.symbol === 'GEF Cash') {
      if (tx.type === 'TXIN' || tx.type === 'BUY') {
        cashBalance += tx.shares * tx.price;
      } else if (tx.type === 'TXOUT' || tx.type === 'SELL') {
        cashBalance -= tx.shares * tx.price;
      }
      return;
    }

    if (tx.type === 'TXIN') {
      cashBalance += tx.shares * tx.price;
      return;
    } else if (tx.type === 'TXOUT') {
      cashBalance -= tx.shares * tx.price;
      return;
    }

    if (!positionsMap[tx.symbol]) {
      positionsMap[tx.symbol] = { shares: 0, totalCost: 0, assetClass: tx.assetClass || 'Stock' };
    }

    const pos = positionsMap[tx.symbol];
    if (tx.type === 'BUY') {
      pos.shares += tx.shares;
      pos.totalCost += amount;
      cashBalance -= amount;
    } else if (tx.type === 'SELL') {
      const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0;
      pos.shares -= tx.shares;
      pos.totalCost -= (tx.shares * avgCost);
      cashBalance += sellProceeds;
    }
  };

  beforeTxs.forEach(processTx);

  if (targetStartMs > 0 && startDateStr) {
    Object.keys(positionsMap).forEach(symbol => {
      const pos = positionsMap[symbol];
      if (pos.shares > 0) {
        const histPrice = getHistoricalPrice(livePrices, symbol, startDateStr);
        const priceToUse = histPrice !== null ? histPrice : (livePrices[symbol]?.price || 0);
        pos.totalCost = pos.shares * priceToUse;
      } else {
        pos.totalCost = 0;
      }
    });
  }

  afterTxs.forEach(processTx);

  const positions: PortfolioPosition[] = [];

  Object.keys(positionsMap).forEach((symbol) => {
    const pos = positionsMap[symbol];
    if (pos.shares <= 0.000001) return; // Filter out closed positions

    const currentPrice = livePrices[symbol]?.price || 0;
    const averagePrice = pos.shares > 0 ? pos.totalCost / pos.shares : 0;
    const currentValue = pos.shares * currentPrice;
    const returnAmount = currentValue - pos.totalCost;
    const returnPercentage = pos.totalCost > 0 ? (returnAmount / pos.totalCost) * 100 : 0;

    positions.push({
      symbol,
      shares: pos.shares,
      averagePrice,
      totalCost: pos.totalCost,
      currentPrice,
      currentValue,
      returnAmount,
      returnPercentage,
      assetClass: pos.assetClass,
    });
  });

  positions.push({
    symbol: 'GEF Cash',
    shares: cashBalance,
    averagePrice: 1,
    totalCost: cashBalance,
    currentPrice: 1,
    currentValue: cashBalance,
    returnAmount: 0,
    returnPercentage: 0,
    assetClass: 'Cash',
  });

  return positions.sort((a, b) => b.currentValue - a.currentValue);
}

export function calculateOverallMetrics(transactions: Transaction[], positions: PortfolioPosition[]) {
  let totalValue = 0;
  let totalCost = 0;
  
  positions.forEach((pos) => {
    totalValue += pos.currentValue;
    totalCost += pos.totalCost;
  });

  const returnAmount = totalValue - totalCost;
  const returnPercentage = totalCost > 0 ? (returnAmount / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    returnAmount,
    returnPercentage,
  };
}

export const getHistoricalPrice = (livePrices: Record<string, PriceData>, symbol: string, targetDateStr: string): number | null => {
  const data = livePrices[symbol]?.historical;
  if (!data || data.length === 0) return null;
  
  const targetTime = new Date(targetDateStr).getTime();
  let closestPrice = data[0].close;
  let minDiff = Infinity;
  
  for (const h of data) {
    const hTime = new Date(h.date).getTime();
    const diff = Math.abs(targetTime - hTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestPrice = h.close;
    }
  }
  return closestPrice;
};

export function calculateAdvancedMetrics(
  transactions: Transaction[], 
  livePrices: Record<string, PriceData>, 
  finalValue: number,
  startDateStr?: string | null,
  isCashExcluded: boolean = false
) {
  if (transactions.length === 0 || finalValue === 0) {
    return { mwr: 0, twr: 0 };
  }

  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const mwrCashFlows: number[] = [];
  const twrCashFlows: number[] = [];
  const dates: Date[] = [];
  const portfolioValues: number[] = [];
  
  let currentCash = 0;
  const holdings: Record<string, number> = {};



  const getPortfolioValueAtDate = (dateStr: string): number => {
    let val = currentCash;
    for (const [sym, shares] of Object.entries(holdings)) {
      if (shares > 0) {
        const histPrice = getHistoricalPrice(livePrices, sym, dateStr);
        const priceToUse = histPrice !== null ? histPrice : (livePrices[sym]?.price || 0);
        val += shares * priceToUse;
      }
    }
    return val;
  };

  let initialValue = 0;
  const targetStartMs = startDateStr ? new Date(startDateStr).getTime() : 0;
  let hasSetInitialValue = false;

  sortedTxs.forEach((tx) => {
    const amount = (tx.price * tx.shares) + (tx.fees || 0);
    const date = new Date(tx.date);
    const txTime = date.getTime();

    if (targetStartMs > 0 && txTime >= targetStartMs && !hasSetInitialValue) {
      initialValue = getPortfolioValueAtDate(tx.date);
      hasSetInitialValue = true;
    }

    let isExternalCF = false;
    let cfAmount = 0;
    let isDeposit = false;

    if (tx.symbol === 'GEF Cash') {
      cfAmount = tx.shares * tx.price;
      if (tx.type === 'TXIN' || tx.type === 'BUY') {
         currentCash += cfAmount;
         isExternalCF = true;
         isDeposit = true;
      } else if (tx.type === 'TXOUT' || tx.type === 'SELL') {
         currentCash -= cfAmount;
         isExternalCF = true;
         isDeposit = false;
      }
    } else {
      if (tx.type === 'TXIN') {
         cfAmount = tx.shares * tx.price;
         if (!isCashExcluded) currentCash += cfAmount;
         isExternalCF = true;
         isDeposit = true;
      } else if (tx.type === 'TXOUT') {
         cfAmount = tx.shares * tx.price;
         if (!isCashExcluded) currentCash -= cfAmount;
         isExternalCF = true;
         isDeposit = false;
      } else if (tx.type === 'BUY') {
         if (!isCashExcluded) currentCash -= amount;
         holdings[tx.symbol] = (holdings[tx.symbol] || 0) + tx.shares;
         
         if (isCashExcluded) {
            isExternalCF = true;
            isDeposit = true;
            cfAmount = amount;
         }
      } else if (tx.type === 'SELL') {
         const sellProceeds = (tx.price * tx.shares) - (tx.fees || 0);
         if (!isCashExcluded) currentCash += sellProceeds;
         holdings[tx.symbol] = (holdings[tx.symbol] || 0) - tx.shares;
         
         if (isCashExcluded) {
            isExternalCF = true;
            isDeposit = false;
            cfAmount = sellProceeds;
         }
      }
    }

    // Only record cash flows if they occur AFTER the start date (in performance mode)
    if (isExternalCF && (targetStartMs === 0 || txTime >= targetStartMs)) {
       if (isDeposit) {
          mwrCashFlows.push(-cfAmount);
          twrCashFlows.push(cfAmount);
       } else {
          mwrCashFlows.push(cfAmount);
          twrCashFlows.push(-cfAmount);
       }
       dates.push(date);

       let marketValueAfterCf = currentCash;
       for (const [sym, shares] of Object.entries(holdings)) {
         if (shares > 0) {
           const histPrice = getHistoricalPrice(livePrices, sym, tx.date);
           const priceToUse = histPrice !== null ? histPrice : (sym === tx.symbol ? tx.price : (livePrices[sym]?.price || 0));
           marketValueAfterCf += shares * priceToUse;
         }
       }
       portfolioValues.push(marketValueAfterCf);
    }
  });

  // If there were no transactions after the start date, but we have an initial value
  if (targetStartMs > 0 && !hasSetInitialValue) {
    // Meaning all transactions happened before the startDate
    // The initialValue is the finalValue
    initialValue = finalValue; 
  }

  // To make TWR work for performance mode, if we have an initialValue > 0, 
  // we treat it as the very first cash flow deposit!
  if (targetStartMs > 0 && initialValue > 0) {
    // Prepend the initial value as a deposit on the startDate
    mwrCashFlows.unshift(-initialValue);
    twrCashFlows.unshift(initialValue);
    dates.unshift(new Date(targetStartMs));
    portfolioValues.unshift(initialValue);
  }

  if (twrCashFlows.length > 0) {
    twrCashFlows.push(0);
    portfolioValues.push(finalValue);
  }

  let mwr = 0;
  let twr = 0;

  try {
    if (mwrCashFlows.length >= 2) {
      // If we already prepended initialValue as a cashflow, pass 0 for initialValue to avoid double counting.
      const mwrInit = targetStartMs > 0 ? 0 : initialValue;
      const mwrResult = calculateMoneyWeightedReturn({
        cashFlows: mwrCashFlows,
        dates,
        finalValue,
        initialValue: mwrInit
      });
      // calculateMoneyWeightedReturn returns annualized IRR. We calculate cumulative.
      if (mwrResult.timePeriodYears && mwrResult.timePeriodYears > 0) {
        const cumulativeMWR = Math.pow(1 + (mwrResult.mwr || 0), mwrResult.timePeriodYears) - 1;
        mwr = cumulativeMWR * 100;
      } else {
        mwr = (mwrResult.mwr || 0) * 100;
      }
    }
  } catch (e) {
    console.warn("MWR calculation bypassed or failed due to dataset limitations.");
  }

  try {
    const twrResult = calculateTimeWeightedReturn({
      portfolioValues,
      cashFlows: twrCashFlows,
      annualizationFactor: 1,
    });
    twr = (twrResult.twr || 0) * 100;
  } catch (e) {
    console.warn("TWR failed:", e);
  }

  return { mwr, twr };
}


