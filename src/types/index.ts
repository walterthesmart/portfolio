export interface Transaction {
  id: string;
  symbol: string;
  date: string; // YYYY-MM-DD
  type: 'BUY' | 'SELL' | 'TXIN' | 'TXOUT';
  price: number;
  shares: number;
  fees: number;
  assetClass: string;
}

export interface PriceData {
  price: number;
  previousClose: number;
  currency: string;
  longName: string;
  historical?: HistoricalPrice[];
}

export interface HistoricalPrice {
  date: string; // YYYY-MM-DD
  close: number;
}


export interface PortfolioPosition {
  symbol: string;
  shares: number;
  averagePrice: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  returnAmount: number;
  returnPercentage: number;
  assetClass: string;
}
