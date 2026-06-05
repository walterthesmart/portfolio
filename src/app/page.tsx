'use client';

import React, { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { calculatePositions, calculateOverallMetrics, calculateAdvancedMetrics } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import { RefreshCw, Pencil, Check, X, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { 
    transactions, livePrices, isLoadingPrices, refreshPrices, updateCustomPrice,
    excludedSymbols, setExcludedSymbols,
    startDate, setStartDate,
    endDate, setEndDate
  } = usePortfolio();

  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const handleEditClick = (symbol: string, currentPrice: number) => {
    setEditingSymbol(symbol);
    setEditPriceValue(currentPrice > 0 ? currentPrice.toString() : '');
  };

  const handleSavePrice = (symbol: string) => {
    if (editPriceValue.trim() === '') {
      updateCustomPrice(symbol, null);
    } else {
      const p = parseFloat(editPriceValue);
      if (!isNaN(p)) {
        updateCustomPrice(symbol, p);
      }
    }
    setEditingSymbol(null);
  };

  const toggleExclusion = (sym: string) => {
    setExcludedSymbols(prev => 
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const [metricsData, setMetricsData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  React.useEffect(() => {
    if (transactions.length === 0) {
      setMetricsData(null);
      return;
    }
    
    setIsCalculating(true);
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate,
        endDate,
        excludedSymbols,
        livePrices
      })
    })
    .then(res => res.json())
    .then(data => {
       if (data.data) {
         setMetricsData(data.data);
       }
    })
    .catch(err => console.error("Failed to fetch metrics", err))
    .finally(() => setIsCalculating(false));

  }, [transactions, livePrices, startDate, endDate, excludedSymbols]);

  const allPositions = metricsData?.allPositions || [];
  const activePositions = metricsData?.activePositions || [];
  const metrics = metricsData?.metrics || { totalValue: 0, totalCost: 0, returnAmount: 0, returnPercentage: 0 };
  const { twr, mwr } = metricsData?.advancedMetrics || { twr: 0, mwr: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <button
          onClick={refreshPrices}
          disabled={isLoadingPrices || isCalculating}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {isLoadingPrices || isCalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {isLoadingPrices ? 'Fetching Prices...' : isCalculating ? 'Calculating...' : 'Refresh Prices'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
         <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Date Filters</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
             <input type="date" className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={startDate || ''} onChange={e => setStartDate(e.target.value || null)} />
           </div>
           <div>
             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
             <input type="date" className="w-full text-sm p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={endDate || ''} onChange={e => setEndDate(e.target.value || null)} />
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Total Cost"
          value={metrics.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          prefix="$"
          isLoading={isLoadingPrices && Object.keys(livePrices).length === 0}
        />
        <MetricCard
          title="Market Value"
          value={metrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          prefix="$"
          isLoading={isLoadingPrices && Object.keys(livePrices).length === 0}
        />
        <MetricCard
          title="Total Return"
          value={metrics.returnAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          prefix="$"
          trend={metrics.returnPercentage}
          isLoading={isLoadingPrices && Object.keys(livePrices).length === 0}
        />
        <MetricCard
          title="Simple Return"
          value={`${metrics.returnPercentage.toFixed(2)}`}
          suffix="%"
          trend={metrics.returnPercentage}
          isLoading={isLoadingPrices && Object.keys(livePrices).length === 0}
        />
        <MetricCard
          title="Time-Weighted Return (TWR)"
          value={`${twr.toFixed(2)}`}
          suffix="%"
          trend={twr}
          isLoading={isLoadingPrices && Object.keys(livePrices).length === 0}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Asset</th>
                <th className="px-6 py-3 text-right">Shares</th>
                <th className="px-6 py-3 text-right">Avg Price</th>
                <th className="px-6 py-3 text-right">Current Price</th>
                <th className="px-6 py-3 text-right">Cost</th>
                <th className="px-6 py-3 text-right">Total Value</th>
                <th className="px-6 py-3 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {allPositions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    No holdings yet. Add some transactions to get started.
                  </td>
                </tr>
              ) : (
                allPositions.map((pos) => {
                  const isExcluded = excludedSymbols.includes(pos.symbol);
                  return (
                  <tr key={pos.symbol} className={`bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-opacity ${isExcluded ? 'opacity-40' : 'opacity-100'}`}>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center space-x-3">
                      <input 
                        type="checkbox" 
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                        checked={!isExcluded}
                        onChange={() => toggleExclusion(pos.symbol)}
                        title={isExcluded ? "Include in calculations" : "Exclude from calculations"}
                      />
                      <div>
                        <span>{pos.symbol}</span>
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {pos.assetClass}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {pos.shares.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      ${pos.averagePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end items-center space-x-2">
                      {editingSymbol === pos.symbol ? (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePrice(pos.symbol);
                              if (e.key === 'Escape') setEditingSymbol(null);
                            }}
                            autoFocus
                          />
                          <button onClick={() => handleSavePrice(pos.symbol)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingSymbol(null)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <span>{pos.currentPrice > 0 ? `$${pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span>
                          <button onClick={() => handleEditClick(pos.symbol, pos.currentPrice)} className="text-gray-400 hover:text-blue-500" title="Override Price">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      ${pos.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      ${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-4 text-right ${pos.returnPercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pos.returnPercentage >= 0 ? '+' : ''}{pos.returnPercentage.toFixed(2)}%
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
