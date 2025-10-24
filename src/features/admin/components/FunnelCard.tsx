"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type FunnelItem = {
  label: string;
  count: number;
  percentage?: number; // 0-100 (one decimal)
  color?: 'emerald' | 'blue' | 'green' | 'cyan' | 'gray' | 'amber';
  emoji?: string;
};

export function FunnelCard({
  title,
  description,
  totalLabel,
  totalCount,
  items,
}: {
  title: string;
  description?: string;
  totalLabel?: string;
  totalCount?: number;
  items: FunnelItem[];
}) {
  const fmtPct = (p?: number) => {
    if (typeof p !== 'number' || Number.isNaN(p)) return null;
    return `${Math.round(p * 10) / 10}%`;
  };

  const colorBg: Record<NonNullable<FunnelItem['color']>, string> = {
    emerald: 'bg-emerald-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    cyan: 'bg-cyan-50',
    gray: 'bg-gray-100',
    amber: 'bg-amber-50',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {typeof totalCount === 'number' && totalLabel ? (
            <div className="flex items-center justify-between p-3 rounded border">
              <div className="text-sm text-muted-foreground">{totalLabel}</div>
              <div className="text-2xl font-semibold tabular-nums">{totalCount}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={`${it.label}-${idx}`} className={`flex items-center justify-between p-2 rounded ${colorBg[it.color || 'gray']}`}>
                <div className="text-sm">
                  {it.emoji ? <span className="mr-1">{it.emoji}</span> : null}
                  {it.label}
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{it.count}</div>
                  {fmtPct(it.percentage) ? (
                    <div className="text-xs text-muted-foreground">({fmtPct(it.percentage)})</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
