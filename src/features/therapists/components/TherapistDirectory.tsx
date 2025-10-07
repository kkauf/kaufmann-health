'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TherapistCard } from './TherapistCard';
import { TherapistDetailModal } from './TherapistDetailModal';

export type TherapistData = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  session_preferences?: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  metadata?: {
    profile?: {
      approach_text?: string;
      languages?: string[];
      years_experience?: number;
    };
  };
};

export function TherapistDirectory() {
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [onlineOnly, setOnlineOnly] = useState<boolean | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistData | null>(null);

  useEffect(() => {
    async function fetchTherapists() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/therapists');
        if (!res.ok) throw new Error('Failed to fetch therapists');
        const data = await res.json();
        const therapistList = data.therapists || [];
        console.log('Fetched therapists:', therapistList);
        console.log('Sample metadata:', therapistList[0]?.metadata);
        setTherapists(therapistList);
      } catch (err) {
        console.error('Error fetching therapists:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTherapists();
  }, []);

  const normalizeModality = (m: string): string => {
    return m.toLowerCase().replace(/\s+/g, '-');
  };

  const getModalityLabel = (m: string): string => {
    const map: Record<string, string> = {
      'narm': 'NARM',
      'somatic-experiencing': 'Somatic Experiencing',
      'hakomi': 'Hakomi',
      'core-energetics': 'Core Energetics',
    };
    const normalized = normalizeModality(m);
    return map[normalized] || m;
  };

  const allModalities = useMemo(() => {
    const modalitySet = new Set<string>();
    therapists.forEach(t => {
      t.modalities?.forEach(m => modalitySet.add(m));
    });
    return Array.from(modalitySet).sort();
  }, [therapists]);

  const filteredTherapists = useMemo(() => {
    return therapists.filter(t => {
      // Filter by modality
      if (selectedModality !== 'all' && !t.modalities?.includes(selectedModality)) {
        return false;
      }

      // Filter by online availability
      if (onlineOnly !== null) {
        const sessionPrefs = t.session_preferences || [];
        const hasOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
        const hasInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');
        if (onlineOnly && !hasOnline) return false;
        if (!onlineOnly && !hasInPerson) return false;
      }

      return true;
    });
  }, [therapists, selectedModality, onlineOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Lade Therapeuten...</div>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Modalität
          </label>
          <Select value={selectedModality} onValueChange={setSelectedModality}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Alle Modalitäten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Modalitäten</SelectItem>
              {allModalities.map(m => (
                <SelectItem key={m} value={m}>
                  {getModalityLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Therapieformat
          </label>
          <div className="flex gap-2">
            <Button
              variant={onlineOnly === null ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(null)}
              className="flex-1"
            >
              Alle
            </Button>
            <Button
              variant={onlineOnly === true ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(true)}
              className="flex-1"
            >
              Online
            </Button>
            <Button
              variant={onlineOnly === false ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(false)}
              className="flex-1"
            >
              Vor Ort
            </Button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        {filteredTherapists.length} {filteredTherapists.length === 1 ? 'Therapeut:in' : 'Therapeut:innen'} gefunden
      </div>

      {/* Therapist grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTherapists.map(therapist => (
          <TherapistCard
            key={therapist.id}
            therapist={therapist}
            onViewDetails={() => setSelectedTherapist(therapist)}
          />
        ))}
      </div>

      {filteredTherapists.length === 0 && (
        <div className="py-12 text-center text-gray-600">
          Keine Therapeut:innen gefunden. Bitte passe deine Filter an.
        </div>
      )}

      {/* Detail modal */}
      {selectedTherapist && (
        <TherapistDetailModal
          therapist={selectedTherapist}
          open={!!selectedTherapist}
          onClose={() => setSelectedTherapist(null)}
        />
      )}
    </>
  );
}
