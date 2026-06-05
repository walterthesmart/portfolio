'use client';

import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileType, CheckCircle, AlertCircle } from 'lucide-react';
import { Transaction } from '@/types';
import { parse } from 'date-fns';
import { usePortfolio } from '@/context/PortfolioContext';

export default function CSVUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importTransactions } = usePortfolio();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setStatus('processing');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const txs: Transaction[] = [];
          
          results.data.forEach((row: any) => {
            // Expected columns: SYMB,ED,TRAN,ANUM,BNUM,CNUM,TYPE
            if (!row.SYMB || !row.ED || !row.TRAN) return;

            // Format date from YYYYMMDD to YYYY-MM-DD
            let dateStr = row.ED;
            if (dateStr.length === 8) {
               dateStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
            }

            let txType: 'BUY' | 'SELL' | 'TXIN' | 'TXOUT' = 'BUY';
            const rawTran = row.TRAN ? row.TRAN.toUpperCase() : '';
            if (rawTran === 'SELL') txType = 'SELL';
            else if (rawTran === 'TXIN') txType = 'TXIN';
            else if (rawTran === 'TXOUT') txType = 'TXOUT';

            const tx: Transaction = {
              id: `${row.SYMB}-${row.ED}-${Math.random().toString(36).substring(7)}`,
              symbol: row.SYMB,
              date: dateStr,
              type: txType,
              price: parseFloat(row.ANUM) || 0,
              shares: parseFloat(row.BNUM) || 0,
              fees: parseFloat(row.CNUM) || 0,
              assetClass: row.TYPE || 'Stock'
            };
            txs.push(tx);
          });

          importTransactions(txs);
          setStatus('success');
          setMessage(`Successfully imported ${txs.length} transactions.`);
          
          setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
          setStatus('error');
          setMessage('Failed to parse CSV. Make sure it matches the expected format.');
        }
      },
      error: (error) => {
        setStatus('error');
        setMessage(`CSV Parsing Error: ${error.message}`);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept=".csv"
        className="hidden"
      />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        {status === 'idle' && (
          <>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                CSV files only (SYMB, ED, TRAN, ANUM, BNUM...)
              </p>
            </div>
          </>
        )}
        
        {status === 'processing' && (
          <div className="animate-pulse flex flex-col items-center">
            <FileType className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-300">Processing file...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-green-600 dark:text-green-400">
            <CheckCircle className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
