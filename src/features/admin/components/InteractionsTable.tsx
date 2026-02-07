"use client";

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';

type InteractionRow = {
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  match_count: number;
  therapist_names: string[];
  intro_count: number;
  session_count: number;
  last_booking: string | null;
  next_booking: string | null;
  channel: 'calendar' | 'messaging' | 'mixed' | 'none';
  email_count: number;
  message_count: number;
  created_at: string;
};

type Props = {
  rows: InteractionRow[];
  loading: boolean;
  onRowClick: (patientId: string) => void;
};

type SortKey =
  | 'match_count'
  | 'intro_count'
  | 'session_count'
  | 'last_booking'
  | 'next_booking'
  | 'email_count'
  | 'message_count'
  | 'created_at';

type SortDir = 'asc' | 'desc';

const CHANNEL_CONFIG: Record<
  InteractionRow['channel'],
  { label: string; className: string }
> = {
  calendar: {
    label: 'Kalender',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  messaging: {
    label: 'Messaging',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  mixed: {
    label: 'Gemischt',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  none: {
    label: 'Keine Kontaktaufnahme',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: 'patient', label: 'Klient:in', sortable: false },
  { key: 'therapists', label: 'Therapeut:innen', sortable: false },
  { key: 'match_count', label: 'Matches', sortable: true },
  { key: 'intro_count', label: 'Intros', sortable: true },
  { key: 'session_count', label: 'Sitzungen', sortable: true },
  { key: 'last_booking', label: 'Letzter Termin', sortable: true },
  { key: 'next_booking', label: 'Nächster Termin', sortable: true },
  { key: 'channel', label: 'Kanal', sortable: false },
  { key: 'message_count', label: 'Nachrichten', sortable: true },
  { key: 'email_count', label: 'E-Mails', sortable: true },
];

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE');
}

function compare(a: InteractionRow, b: InteractionRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv));
}

export default function InteractionsTable({ rows, loading, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => dir * compare(a, b, sortKey));
  }, [rows, sortKey, sortDir]);

  function handleSort(key: string) {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col?.sortable) return;
    const sk = key as SortKey;
    if (sortKey === sk) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(sk);
      setSortDir('asc');
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Keine Ergebnisse
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.patient_id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/30"
              onClick={() => onRowClick(row.patient_id)}
            >
              <td className="px-3 py-2">
                <div className="font-medium">
                  {row.patient_name || 'Unbekannt'}
                </div>
                {row.patient_email && (
                  <div className="text-xs text-muted-foreground">
                    {row.patient_email}
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <TherapistNames names={row.therapist_names} />
              </td>
              <td className="px-3 py-2">{row.match_count}</td>
              <td className="px-3 py-2">{row.intro_count}</td>
              <td className="px-3 py-2">{row.session_count}</td>
              <td className="px-3 py-2">{formatDate(row.last_booking)}</td>
              <td className="px-3 py-2">{formatDate(row.next_booking)}</td>
              <td className="px-3 py-2">
                <ChannelBadge channel={row.channel} />
              </td>
              <td className="px-3 py-2">{row.message_count}</td>
              <td className="px-3 py-2">{row.email_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TherapistNames({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">–</span>;
  if (names.length <= 2) return <span>{names.join(', ')}</span>;
  return (
    <span>
      {names.slice(0, 2).join(', ')}{' '}
      <Badge variant="secondary" className="ml-1">
        +{names.length - 2}
      </Badge>
    </span>
  );
}

function ChannelBadge({ channel }: { channel: InteractionRow['channel'] }) {
  const config = CHANNEL_CONFIG[channel];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
