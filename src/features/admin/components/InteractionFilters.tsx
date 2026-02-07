"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FilterValue = 'all' | 'messaging_only' | 'booked_only' | 'has_upcoming';

type Props = {
  filter: FilterValue;
  onFilterChange: (f: FilterValue) => void;
  search: string;
  onSearchChange: (s: string) => void;
  createdAfter: string;
  onCreatedAfterChange: (d: string) => void;
  createdBefore: string;
  onCreatedBeforeChange: (d: string) => void;
};

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'messaging_only', label: 'Nur Messaging' },
  { value: 'booked_only', label: 'Nur Gebucht' },
  { value: 'has_upcoming', label: 'Hat Termin' },
];

export default function InteractionFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  createdAfter,
  onCreatedAfterChange,
  createdBefore,
  onCreatedBeforeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <Input
        placeholder="Name oder E-Mail..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-56"
      />

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Von</span>
        <Input
          type="date"
          value={createdAfter}
          onChange={(e) => onCreatedAfterChange(e.target.value)}
          className="w-36"
        />
        <span>bis</span>
        <Input
          type="date"
          value={createdBefore}
          onChange={(e) => onCreatedBeforeChange(e.target.value)}
          className="w-36"
        />
      </div>
    </div>
  );
}
