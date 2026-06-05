'use client';

import React, { useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import CSVUploader from '@/components/CSVUploader';
import TransactionForm from '@/components/TransactionForm';
import { Trash2, Plus, Upload as UploadIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function Transactions() {
  const { transactions, deleteTransaction, clearTransactions } = usePortfolio();
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'upload'>('list');

  const sortedTxs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        {activeTab === 'list' && transactions.length > 0 && (
          <button
            onClick={clearTransactions}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </button>
        )}
      </div>

      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'list'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'add'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Manual
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'upload'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <UploadIcon className="w-4 h-4 mr-1" /> Import CSV
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mt-6">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upload SGEF-CIM CSV</h2>
            <CSVUploader />
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-2xl">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Transaction</h2>
          <TransactionForm onSuccess={() => setActiveTab('list')} />
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 text-right">Shares</th>
                  <th className="px-6 py-3 text-right">Fees</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTxs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  sortedTxs.map((tx) => (
                    <tr key={tx.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(parseISO(tx.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {tx.symbol}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tx.type === 'BUY' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">${tx.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">{tx.shares.toFixed(4)}</td>
                      <td className="px-6 py-4 text-right">${tx.fees.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-medium">
                        ${((tx.price * tx.shares) + tx.fees).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
