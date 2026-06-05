'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Transaction, PriceData } from '@/types';
import { format, parse } from 'date-fns';

interface PortfolioContextType {
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  importTransactions: (txs: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;
  livePrices: Record<string, PriceData>;
  isLoadingPrices: boolean;
  refreshPrices: () => Promise<void>;
  customPrices: Record<string, number>;
  updateCustomPrice: (symbol: string, price: number | null) => void;
  excludedSymbols: string[];
  setExcludedSymbols: React.Dispatch<React.SetStateAction<string[]>>;
  startDate: string | null;
  setStartDate: React.Dispatch<React.SetStateAction<string | null>>;
  endDate: string | null;
  setEndDate: React.Dispatch<React.SetStateAction<string | null>>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetchedPrices, setFetchedPrices] = useState<Record<string, PriceData>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [excludedSymbols, setExcludedSymbols] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Load from database
  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setTransactions(data.data);
        }
      })
      .catch(e => console.error('Failed to load transactions:', e))
      .finally(() => {
        const savedCustomPrices = localStorage.getItem('portfolio_custom_prices');
        if (savedCustomPrices) {
          try {
            setCustomPrices(JSON.parse(savedCustomPrices));
          } catch (e) {
            console.error('Failed to parse saved custom prices');
          }
        }
        setIsInitialized(true);
      });
  }, []);

  // Save custom prices to local storage (transactions are saved to DB now)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('portfolio_custom_prices', JSON.stringify(customPrices));
    }
  }, [customPrices, isInitialized]);

  // Whenever transactions change, we want to optionally refresh prices, but we can do that separately.
  // Actually, let's keep the automatic refresh on init or tx change.
  useEffect(() => {
    if (isInitialized && transactions.length > 0) {
      refreshPrices();
    }
  }, [transactions, isInitialized]); // We may over-fetch if tx changes often, but it's okay for now.

  const addTransaction = async (tx: Transaction) => {
    setTransactions((prev) => [...prev, tx]);
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
  };

  const importTransactions = async (txs: Transaction[]) => {
    let newTxs: Transaction[] = [];
    setTransactions((prev) => {
      const existingIds = new Set(prev.map(t => t.id));
      newTxs = txs.filter(t => !existingIds.has(t.id));
      return [...prev, ...newTxs];
    });
    
    if (newTxs.length > 0) {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTxs),
      });
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
  };

  const clearTransactions = async () => {
    if (confirm('Are you sure you want to delete all transactions?')) {
      setTransactions([]);
      await fetch('/api/transactions', { method: 'DELETE' });
    }
  };

  const updateCustomPrice = (symbol: string, price: number | null) => {
    setCustomPrices((prev) => {
      const next = { ...prev };
      if (price === null) {
        delete next[symbol];
      } else {
        next[symbol] = price;
      }
      return next;
    });
  };

  const refreshPrices = async () => {
    const rawSymbols = Array.from(new Set(transactions.map((t) => t.symbol)));
    const symbols = rawSymbols.filter(s => s !== 'GEF Cash' && s !== 'Cash');
    if (symbols.length === 0) return;

    setIsLoadingPrices(true);
    
    let startDate: string | undefined;
    if (transactions.length > 0) {
      const earliest = transactions.reduce((earliestTx, currentTx) => {
        return new Date(currentTx.date) < new Date(earliestTx.date) ? currentTx : earliestTx;
      });
      startDate = earliest.date;
    }

    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, startDate }),
      });
      const result = await res.json();
      if (result.data) {
        setFetchedPrices(result.data);
      }
    } catch (e) {
      console.error('Error fetching prices:', e);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const livePrices = useMemo(() => {
    const merged = { ...fetchedPrices };
    Object.keys(customPrices).forEach(sym => {
      if (!merged[sym] || merged[sym] === null) {
        merged[sym] = { price: customPrices[sym], previousClose: 0, currency: 'USD', longName: sym, historical: [] };
      } else {
        merged[sym] = { ...merged[sym], price: customPrices[sym] };
      }
    });
    return merged;
  }, [fetchedPrices, customPrices]);

  return (
    <PortfolioContext.Provider
      value={{
        transactions,
        addTransaction,
        importTransactions,
        deleteTransaction,
        clearTransactions,
        livePrices,
        isLoadingPrices,
        refreshPrices,
        customPrices,
        updateCustomPrice,
        excludedSymbols,
        setExcludedSymbols,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
