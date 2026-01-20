"use client";

import React from 'react';

export function ProgressBar({ value, showLabel = false }: { value: number; showLabel?: boolean }) {
  const percentage = Math.max(0, Math.min(100, value));
  const isAlmostDone = percentage >= 70;

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{isAlmostDone ? 'Fast geschafft!' : 'Fortschritt'}</span>
          <span className="font-medium tabular-nums">{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        aria-label="Fortschritt"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-2 transition-all duration-300 ease-out ${
            isAlmostDone ? 'bg-emerald-500' : 'bg-emerald-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
