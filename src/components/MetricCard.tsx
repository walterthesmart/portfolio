import React from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  trend?: number; // percentage e.g., 5.4 for +5.4%, -2.1 for -2.1%
  prefix?: string;
  suffix?: string;
  isLoading?: boolean;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  prefix,
  suffix,
  isLoading,
}: MetricCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h3>
      {isLoading ? (
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      ) : (
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {prefix}{value}{suffix}
          </span>
          {trend !== undefined && (
            <span
              className={clsx(
                'flex items-center text-sm font-medium',
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {isPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
              {Math.abs(trend).toFixed(2)}%
            </span>
          )}
        </div>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
      )}
    </div>
  );
}
