"use client";

import React from 'react';

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden" aria-label="Fortschritt">
      <div
        className="h-2 bg-emerald-600 transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export default ProgressBar;
