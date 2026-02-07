"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import InteractionFilters from '@/features/admin/components/InteractionFilters';
import InteractionsTable from '@/features/admin/components/InteractionsTable';
import InteractionDetailPanel from '@/features/admin/components/InteractionDetailPanel';

export const dynamic = 'force-dynamic';

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

type Filter = 'all' | 'messaging_only' | 'booked_only' | 'has_upcoming';

export default function AdminInteractionsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [rows, setRows] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/interactions', window.location.origin);
      if (filter !== 'all') url.searchParams.set('filter', filter);
      if (debouncedSearch) url.searchParams.set('search', debouncedSearch);
      if (createdAfter) url.searchParams.set('created_after', createdAfter);
      if (createdBefore) url.searchParams.set('created_before', createdBefore);
      url.searchParams.set('limit', '200');

      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data?.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, createdAfter, createdBefore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.patient_id === selectedPatientId) ?? null,
    [rows, selectedPatientId],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-lg font-semibold mb-4">Interaktionen</h1>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <InteractionFilters
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        createdAfter={createdAfter}
        onCreatedAfterChange={setCreatedAfter}
        createdBefore={createdBefore}
        onCreatedBeforeChange={setCreatedBefore}
      />

      <div className="mt-4">
        <InteractionsTable
          rows={rows}
          loading={loading}
          onRowClick={(id) => setSelectedPatientId(id)}
        />
      </div>

      <InteractionDetailPanel
        open={!!selectedPatientId}
        onOpenChange={(open) => { if (!open) setSelectedPatientId(null); }}
        patientId={selectedPatientId}
        patientName={selectedRow?.patient_name ?? null}
        patientEmail={selectedRow?.patient_email ?? null}
      />
    </div>
  );
}
