"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Video, Building2, Clock, Calendar, Save, CheckCircle2, Loader2 } from "lucide-react";

type Slot = {
  id?: string;
  day_of_week: number;
  time_local: string;
  format: 'online' | 'in_person' | 'both';
  duration_minutes: number;
  active: boolean;
  is_recurring: boolean;
  specific_date?: string | null;
};

type Props = {
  therapistId: string;
  practiceAddress: string;
  allowsOnline: boolean;
  allowsInPerson: boolean;
};

const DAYS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 0, label: "Sonntag" },
];

const DAY_LABELS: Record<number, string> = {
  0: "So", 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa"
};

export default function SlotsManager({ therapistId, practiceAddress, allowsOnline, allowsInPerson }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // Track initial slots for unsaved changes detection
  const initialSlotsRef = useRef<string>('');

  // New slot form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<'recurring' | 'one-time'>('recurring');
  const [newDay, setNewDay] = useState<string>("1");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const [newFormat, setNewFormat] = useState<'online' | 'in_person' | 'both'>("online");
  const [newDuration, setNewDuration] = useState("50");

  // Fetch slots on mount
  useEffect(() => {
    async function fetchSlots() {
      try {
        const res = await fetch(`/api/public/therapists/${therapistId}/slots`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.data) {
          setSlots(json.data);
          initialSlotsRef.current = JSON.stringify(json.data);
        }
      } catch (e) {
        console.error('Failed to fetch slots:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, [therapistId]);

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (loading) return false;
    return JSON.stringify(slots) !== initialSlotsRef.current;
  }, [slots, loading]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Reset saved state
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const addSlot = useCallback(() => {
    setError(null);

    const duration = parseInt(newDuration, 10) || 50;

    if (!allowsOnline && !allowsInPerson) {
      setError('Bitte zuerst im Profil ein Sitzungsformat auswählen (Online oder Vor Ort).');
      return;
    }

    if (newType === 'recurring') {
      const dayNum = parseInt(newDay, 10);
      if (isNaN(dayNum)) return;

      const newSlot: Slot = {
        day_of_week: dayNum,
        time_local: newTime,
        format: newFormat,
        duration_minutes: duration,
        active: true,
        is_recurring: true,
        specific_date: null,
      };

      setSlots(prev => [...prev, newSlot]);
    } else {
      if (!newDate) {
        setError('Bitte ein Datum auswählen');
        return;
      }

      const dayOfWeek = new Date(`${newDate}T12:00:00`).getDay();

      const newSlot: Slot = {
        day_of_week: dayOfWeek,
        time_local: newTime,
        format: newFormat,
        duration_minutes: duration,
        active: true,
        is_recurring: false,
        specific_date: newDate,
      };

      setSlots(prev => [...prev, newSlot]);
    }

    setShowAddForm(false);
    // Reset form
    setNewType('recurring');
    setNewDay("1");
    setNewDate("");
    setNewTime("10:00");
    if (!allowsOnline && allowsInPerson) {
      setNewFormat('in_person');
    } else {
      setNewFormat('online');
    }
    setNewDuration("50");
  }, [newType, newDay, newDate, newTime, newFormat, newDuration, allowsOnline, allowsInPerson]);

  const removeSlot = useCallback((index: number) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleSlotActive = useCallback((index: number) => {
    setSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, active: !slot.active } : slot
    ));
  }, []);

  const saveSlots = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/public/therapists/${therapistId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slots }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Speichern fehlgeschlagen');
      }

      if (json.data) {
        setSlots(json.data);
        initialSlotsRef.current = JSON.stringify(json.data);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }, [therapistId, slots]);

  const deleteSlot = useCallback(async (slotId: string, index: number) => {
    if (!slotId) {
      // Not saved yet, just remove from local state
      removeSlot(index);
      return;
    }

    try {
      const res = await fetch(`/api/public/therapists/${therapistId}/slots?slot_id=${slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSlots(prev => prev.filter((_, i) => i !== index));
      }
    } catch (e) {
      console.error('Failed to delete slot:', e);
    }
  }, [therapistId, removeSlot]);

  if (loading) {
    return (
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-8 text-center">
          <Loader2 className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Termine werden geladen...</p>
        </div>
      </Card>
    );
  }

  const activeSlots = slots.filter(s => s.active);
  const inactiveSlots = slots.filter(s => !s.active);

  const formatDateLabel = (slot: Slot): string => {
    if (slot.is_recurring || !slot.specific_date) {
      return `${DAY_LABELS[slot.day_of_week]} ${slot.time_local}`;
    }
    const parts = (slot.specific_date || '').split('-');
    if (parts.length !== 3) return slot.time_local;
    const [y, m, d] = parts;
    return `${d}.${m}.${y} ${slot.time_local}`;
  };

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm" role="status">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-800 font-medium">Ungespeicherte Änderungen</span>
          <span className="text-amber-600">– Vergiss nicht zu speichern!</span>
        </div>
      )}

      {/* Active Slots */}
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Verfügbare Termine</h2>
              <p className="text-sm text-gray-500">Wiederkehrende oder einmalige Termine, die im Buchungsprozess angezeigt werden.</p>
            </div>
            <span className="text-sm text-gray-500">{activeSlots.length}/5 aktiv</span>
          </div>

          {activeSlots.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Noch keine Termine angelegt</p>
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot, index) => slot.active && (
                <div
                  key={slot.id || `new-${index}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
                >
                  <div className="flex-1 flex flex-wrap items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {formatDateLabel(slot)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      {slot.format === 'online' && <><Video className="h-4 w-4" /> Online</>}
                      {slot.format === 'in_person' && <><Building2 className="h-4 w-4" /> Vor Ort</>}
                      {slot.format === 'both' && <><Video className="h-4 w-4" /> Beides</>}
                    </span>
                    <span className="text-gray-500">{slot.duration_minutes} Min.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSlotActive(index)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100"
                    >
                      Deaktivieren
                    </button>
                    <button
                      type="button"
                      onClick={() => slot.id ? deleteSlot(slot.id, index) : removeSlot(index)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Slot */}
          {activeSlots.length < 5 && (
            <div className="mt-4">
              {showAddForm ? (
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">Terminart</span>
                    <div className="inline-flex rounded-full bg-white border border-emerald-100 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setNewType('recurring')}
                        className={`px-3 py-1 rounded-full ${newType === 'recurring' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Wöchentlich
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewType('one-time')}
                        className={`px-3 py-1 rounded-full ${newType === 'one-time' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Einmalig
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">{newType === 'recurring' ? 'Wochentag' : 'Datum'}</Label>
                      {newType === 'recurring' ? (
                        <Select value={newDay} onValueChange={setNewDay}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map(d => (
                              <SelectItem key={d.value} value={d.value.toString()}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="mt-1"
                        />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Uhrzeit</Label>
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Format</Label>
                      <Select value={newFormat} onValueChange={(v) => setNewFormat(v as 'online' | 'in_person' | 'both')}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowsOnline && (
                            <SelectItem value="online">Online</SelectItem>
                          )}
                          {allowsInPerson && (
                            <SelectItem value="in_person">Vor Ort</SelectItem>
                          )}
                          {allowsOnline && allowsInPerson && (
                            <SelectItem value="both">Beides</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Dauer (Min.)</Label>
                      <Select value={newDuration} onValueChange={setNewDuration}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="45">45</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="60">60</SelectItem>
                          <SelectItem value="75">75</SelectItem>
                          <SelectItem value="90">90</SelectItem>
                          <SelectItem value="120">120</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(newFormat === 'in_person' || newFormat === 'both') && !practiceAddress && (
                    <p className="text-xs text-amber-600">
                      Hinweis: Bitte speichere zuerst eine Praxisadresse im Profil-Tab für Vor-Ort-Termine.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={addSlot}>
                      <Plus className="h-4 w-4 mr-1" />
                      Hinzufügen
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Termin hinzufügen
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Inactive Slots */}
      {inactiveSlots.length > 0 && (
        <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm opacity-75">
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Deaktivierte Termine</h3>
            <div className="space-y-2">
              {slots.map((slot, index) => !slot.active && (
                <div
                  key={slot.id || `inactive-${index}`}
                  className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-500"
                >
                  <span className="flex-1">
                    {formatDateLabel(slot)} • {slot.duration_minutes} Min.
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSlotActive(index)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-50"
                  >
                    Aktivieren
                  </button>
                  <button
                    type="button"
                    onClick={() => slot.id ? deleteSlot(slot.id, index) : removeSlot(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-lg">
          <Button
            type="button"
            onClick={saveSlots}
            disabled={saving}
            className="h-11 px-6 font-semibold shadow-md hover:shadow-lg transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Gespeichert
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Termine speichern
              </>
            )}
          </Button>

          <div className="flex-1 min-w-0">
            {error && (
              <p className="text-sm text-red-600 font-medium" role="alert" aria-live="assertive">
                {error}
              </p>
            )}
            {saved && !error && (
              <p className="text-sm text-emerald-600 font-medium flex items-center gap-2" role="status" aria-live="polite">
                <CheckCircle2 className="h-4 w-4" />
                Termine erfolgreich gespeichert
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
