"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Camera, Save, CheckCircle2, LogOut, MapPin, Euro, Video, Building2, X, Mail, Calendar, Lock, Target, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from "@/lib/schwerpunkte";
import SlotsManager from "./SlotsManager";
import { SchwerpunkteSelector } from "@/components/SchwerpunkteSelector";
import { THERAPIST_SCHWERPUNKTE_MIN, THERAPIST_SCHWERPUNKTE_MAX } from "@/lib/schwerpunkte";
import { PROFILE_LIMITS } from "@/lib/config/profileLimits";

type Props = {
  therapistId: string;
  initialData: {
    photo_url?: string;
    // New structured profile fields
    who_comes_to_me: string;
    session_focus: string;
    first_session: string;
    about_me: string;
    // Legacy field (read-only if present)
    approach_text_legacy?: string;
    session_preferences: string[];
    modalities: string[];
    schwerpunkte: string[];
    typical_rate?: number;
    practice_street: string;
    practice_postal_code: string;
    practice_city: string;
    accepting_new: boolean;
    city: string;
  };
};


// Strength level based on content length relative to recommended
type StrengthLevel = 'empty' | 'minimal' | 'developing' | 'good' | 'excellent';

function getStrengthLevel(length: number, recommended: number): StrengthLevel {
  const ratio = length / recommended;
  if (length === 0) return 'empty';
  if (ratio < 0.25) return 'minimal';
  if (ratio < 0.5) return 'developing';
  if (ratio < 0.75) return 'good';
  return 'excellent';
}

const strengthConfig: Record<StrengthLevel, { color: string; border: string; bg: string; label: string; emoji: string }> = {
  empty: { color: 'text-gray-400', border: 'border-gray-200', bg: 'bg-gray-200', label: 'Noch leer', emoji: '' },
  minimal: { color: 'text-red-500', border: 'border-red-300', bg: 'bg-red-400', label: 'Kurz', emoji: '' },
  developing: { color: 'text-amber-500', border: 'border-amber-300', bg: 'bg-amber-400', label: 'Gut', emoji: '' },
  good: { color: 'text-emerald-500', border: 'border-emerald-300', bg: 'bg-emerald-400', label: 'Sehr gut', emoji: '' },
  excellent: { color: 'text-emerald-600', border: 'border-emerald-400', bg: 'bg-emerald-500', label: 'Ausgezeichnet', emoji: '\u2728' },
};

// Reusable profile text field with strength indicator
function ProfileTextField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  recommended,
  max,
  rows = 3,
  optional = false,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  recommended: number;
  max: number;
  rows?: number;
  optional?: boolean;
}) {
  const strength = getStrengthLevel(value.length, recommended);
  const config = strengthConfig[strength];
  const remaining = max - value.length;
  const isOverRecommended = value.length > recommended;
  
  // Calculate fill percentage for the strength bar (cap at 100%)
  const fillPercent = Math.min((value.length / recommended) * 100, 100);
  
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}{optional && <span className="text-gray-400 font-normal"> (optional)</span>}
      </Label>
      <p className="text-xs text-gray-500">{hint}</p>
      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          maxLength={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            value.length === 0
              ? 'border-gray-200 focus:border-gray-300 focus:ring-gray-200'
              : `${config.border} focus:ring-emerald-200`
          }`}
        />
      </div>
      
      {/* Strength indicator bar and label */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${config.bg}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${config.color} transition-colors duration-300`}>
          {config.emoji && <span>{config.emoji}</span>}
          <span>{config.label}</span>
          {isOverRecommended && (
            <span className="text-amber-500 ml-1">({remaining})</span>
          )}
        </div>
      </div>
    </div>
  );
}

// German postal code validation (5 digits)
const isValidPostalCode = (code: string): boolean => /^\d{5}$/.test(code.trim());

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB

type Tab = 'profile' | 'slots';

export default function EditProfileForm({ therapistId, initialData }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0); // Trigger re-evaluation of hasUnsavedChanges
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form state - New profile sections
  const [whoComesToMe, setWhoComesToMe] = useState(initialData.who_comes_to_me);
  const [sessionFocus, setSessionFocus] = useState(initialData.session_focus);
  const [firstSession, setFirstSession] = useState(initialData.first_session);
  const [aboutMe, setAboutMe] = useState(initialData.about_me);
  const [schwerpunkte, setSchwerpunkte] = useState<string[]>(initialData.schwerpunkte);
  const [offersOnline, setOffersOnline] = useState(initialData.session_preferences.includes('online'));
  const [offersInPerson, setOffersInPerson] = useState(initialData.session_preferences.includes('in_person'));
  const [typicalRate, setTypicalRate] = useState<string>(initialData.typical_rate?.toString() ?? '');
  const [practiceStreet, setPracticeStreet] = useState(initialData.practice_street);
  const [practicePostalCode, setPracticePostalCode] = useState(initialData.practice_postal_code);
  const [practiceCity, setPracticeCity] = useState(initialData.practice_city);
  const [acceptingNew, setAcceptingNew] = useState(initialData.accepting_new);
  const [city, setCity] = useState(initialData.city);

  // Combine address fields for SlotsManager
  const practiceAddress = [practiceStreet, practicePostalCode, practiceCity].filter(Boolean).join(', ');

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPhotoUrl = photoPreview || initialData.photo_url;

  // Track baseline values (updated after save)
  const baselineRef = useRef({
    who_comes_to_me: initialData.who_comes_to_me,
    session_focus: initialData.session_focus,
    first_session: initialData.first_session,
    about_me: initialData.about_me,
    schwerpunkte: [...initialData.schwerpunkte], // Clone array for stable comparison
    offersOnline: initialData.session_preferences.includes('online'),
    offersInPerson: initialData.session_preferences.includes('in_person'),
    typicalRate: initialData.typical_rate?.toString() ?? '',
    practiceStreet: initialData.practice_street,
    practicePostalCode: initialData.practice_postal_code,
    practiceCity: initialData.practice_city,
    acceptingNew: initialData.accepting_new,
    city: initialData.city,
  });

  // Track if form has unsaved changes (compare to baseline, not initialData)
  const hasUnsavedChanges = useMemo(() => {
    const b = baselineRef.current;
    if (photoFile) return true;
    if (whoComesToMe !== b.who_comes_to_me) return true;
    if (sessionFocus !== b.session_focus) return true;
    if (firstSession !== b.first_session) return true;
    if (aboutMe !== b.about_me) return true;
    // Compare schwerpunkte arrays
    if (schwerpunkte.length !== b.schwerpunkte.length || schwerpunkte.some((s, i) => s !== b.schwerpunkte[i])) return true;
    if (offersOnline !== b.offersOnline) return true;
    if (offersInPerson !== b.offersInPerson) return true;
    if (typicalRate !== b.typicalRate) return true;
    if (practiceStreet !== b.practiceStreet) return true;
    if (practicePostalCode !== b.practicePostalCode) return true;
    if (practiceCity !== b.practiceCity) return true;
    if (acceptingNew !== b.acceptingNew) return true;
    if (city !== b.city) return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFile, whoComesToMe, sessionFocus, firstSession, aboutMe, schwerpunkte, offersOnline, offersInPerson, typicalRate, practiceStreet, practicePostalCode, practiceCity, acceptingNew, city, saveCount]);

  // Minimum character count for required text fields
  const MIN_CHARS = 50;

  // Profile completeness check (min 50 chars for required fields)
  const profileCompleteness = useMemo(() => {
    const missing: string[] = [];
    if (!whoComesToMe || whoComesToMe.length < MIN_CHARS) 
      missing.push(`Zu mir kommen Menschen... (mind. ${MIN_CHARS} Zeichen)`);
    if (!sessionFocus || sessionFocus.length < MIN_CHARS) 
      missing.push(`In unserer Arbeit... (mind. ${MIN_CHARS} Zeichen)`);
    if (!firstSession || firstSession.length < MIN_CHARS) 
      missing.push(`Das erste Gespräch (mind. ${MIN_CHARS} Zeichen)`);
    if (schwerpunkte.length < THERAPIST_SCHWERPUNKTE_MIN) missing.push('Schwerpunkte');
    if (!typicalRate) missing.push('Preis pro Sitzung');
    if (!currentPhotoUrl) missing.push('Profilbild');
    
    const total = 6;
    const completed = total - missing.length;
    const percentage = Math.round((completed / total) * 100);
    const isComplete = missing.length === 0;
    
    return { missing, completed, total, percentage, isComplete };
  }, [whoComesToMe, sessionFocus, firstSession, schwerpunkte, typicalRate, currentPhotoUrl]);

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

  // Reset saved state after a delay
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const onPhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    if (file) {
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError('Foto zu groß (max. 4MB). Bitte wähle ein kleineres Bild.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setPhotoFile(file);
      setPhotoPending(true);
      const url = URL.createObjectURL(file);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }
  }, []);

  const clearPhotoSelection = useCallback(() => {
    setPhotoFile(null);
    setPhotoPending(false);
    setPhotoError(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPhotoError(null);
    setSaved(false);

    // Validate min character requirements for required fields
    const validationErrors: string[] = [];
    if (whoComesToMe.trim().length < MIN_CHARS) {
      validationErrors.push(`"Zu mir kommen Menschen..." benötigt mind. ${MIN_CHARS} Zeichen`);
    }
    if (sessionFocus.trim().length < MIN_CHARS) {
      validationErrors.push(`"In unserer Arbeit..." benötigt mind. ${MIN_CHARS} Zeichen`);
    }
    if (firstSession.trim().length < MIN_CHARS) {
      validationErrors.push(`"Das erste Gespräch" benötigt mind. ${MIN_CHARS} Zeichen`);
    }
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();

      // Build session_preferences array
      const sessionPrefs: string[] = [];
      if (offersOnline) sessionPrefs.push('online');
      if (offersInPerson) sessionPrefs.push('in_person');

      // Add profile text fields
      form.set('who_comes_to_me', whoComesToMe.trim());
      form.set('session_focus', sessionFocus.trim());
      form.set('first_session', firstSession.trim());
      form.set('about_me', aboutMe.trim());
      
      // Add schwerpunkte
      form.set('schwerpunkte', JSON.stringify(schwerpunkte));
      
      form.set('session_preferences', JSON.stringify(sessionPrefs));
      form.set('accepting_new', acceptingNew ? 'true' : 'false');
      // Use practiceCity as city when offering in-person; standalone city field only for online-only therapists
      form.set('city', offersInPerson ? practiceCity.trim() : city.trim());

      if (typicalRate.trim()) {
        const rate = parseInt(typicalRate, 10);
        if (!isNaN(rate) && rate > 0) {
          form.set('typical_rate', rate.toString());
        }
      }

      if (offersInPerson) {
        form.set('practice_street', practiceStreet.trim());
        form.set('practice_postal_code', practicePostalCode.trim());
        form.set('practice_city', practiceCity.trim());
      }

      if (photoFile) {
        form.set('profile_photo', photoFile);
      }

      const res = await fetch(`/api/public/therapists/${therapistId}/profile`, {
        method: 'POST',
        body: form,
        credentials: 'include', // Important: send cookies for auth
      });

      if (res.status === 413) {
        setPhotoError('Foto zu groß (max. 4MB)');
        throw new Error('Foto zu groß');
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Speichern fehlgeschlagen');
      }

      // Update baseline to current values so "unsaved changes" clears
      baselineRef.current = {
        who_comes_to_me: whoComesToMe,
        session_focus: sessionFocus,
        first_session: firstSession,
        about_me: aboutMe,
        schwerpunkte: [...schwerpunkte], // Clone array for baseline
        offersOnline,
        offersInPerson,
        typicalRate,
        practiceStreet,
        practicePostalCode,
        practiceCity,
        acceptingNew,
        city,
      };
      setSaveCount(c => c + 1); // Trigger hasUnsavedChanges re-evaluation
      setSaved(true);
      setPhotoFile(null);
      setPhotoPending(false);
    } catch (err) {
      if (!photoError) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
      }
    } finally {
      setLoading(false);
    }
  }, [therapistId, whoComesToMe, sessionFocus, firstSession, aboutMe, schwerpunkte, offersOnline, offersInPerson, typicalRate, practiceStreet, practicePostalCode, practiceCity, acceptingNew, city, photoFile, photoError]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/public/therapist-logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore errors, redirect anyway
    }
    window.location.href = '/portal/login';
  }, []);

  return (
    <div className="space-y-6">
      {/* Profile Completeness Indicator */}
      {!profileCompleteness.isComplete && activeTab === 'profile' && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-900">
              Profil {profileCompleteness.percentage}% vollständig
            </span>
            <span className="text-xs text-amber-700">
              {profileCompleteness.completed}/{profileCompleteness.total} Felder
            </span>
          </div>
          <div className="h-2 bg-amber-100 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${profileCompleteness.percentage}%` }}
            />
          </div>
          <p className="text-xs text-amber-700">
            <span className="font-medium">Noch offen:</span>{' '}
            {profileCompleteness.missing.join(', ')}
          </p>
        </div>
      )}

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && activeTab === 'profile' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm" role="status">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-800 font-medium">Ungespeicherte Änderungen</span>
          <span className="text-amber-600">– Vergiss nicht zu speichern!</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'profile'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Camera className="h-4 w-4" />
          Profil
          {hasUnsavedChanges && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Ungespeichert" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'slots'}
          onClick={() => setActiveTab('slots')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'slots'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Termine
        </button>
      </div>

      {activeTab === 'profile' ? (
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Profile Photo */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profilfoto</h2>
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative group">
                  {currentPhotoUrl ? (
                    <Image
                      src={currentPhotoUrl}
                      alt="Profilfoto"
                      width={120}
                      height={120}
                      className="h-28 w-28 rounded-xl object-cover border border-gray-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-28 w-28 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center border border-gray-200 shadow-sm">
                      <Camera className="h-8 w-8 text-emerald-600" />
                    </div>
                  )}
                  {photoPending && (
                    <div className="absolute inset-0 rounded-xl bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="profile_photo" className="text-sm font-medium text-gray-700">
                      {photoPending ? 'Neues Foto ausgewählt' : 'Foto hochladen'}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">JPG oder PNG, max. 4MB</p>
                  </div>
                  
                  {photoPending ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">{photoFile?.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearPhotoSelection}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Auswahl aufheben"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Input
                        ref={fileInputRef}
                        id="profile_photo"
                        type="file"
                        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                        onChange={onPhotoChange}
                        className="max-w-xs"
                      />
                    </div>
                  )}
                  
                  {photoError && (
                    <p className="text-sm text-red-600 flex items-center gap-2" role="alert">
                      <X className="h-4 w-4" />
                      {photoError}
                    </p>
                  )}
                  
                  {photoPending && !photoError && (
                    <p className="text-xs text-amber-600">
                      Klicke auf &quot;Änderungen speichern&quot; um das neue Foto hochzuladen.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Profile Text Sections */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Dein Profil</h2>
              <p className="text-sm text-gray-500 mb-6">
                Diese Texte erscheinen auf deiner Profilseite und helfen Patient:innen, dich kennenzulernen.
              </p>
              
              {/* Profile text fields with strength indicators */}
              <div className="space-y-6">
                <ProfileTextField
                  id="who_comes_to_me"
                  label="Zu mir kommen Menschen, die..."
                  hint="Beschreibe, welche Menschen zu dir finden — nicht Diagnosen, sondern wie sie sich fühlen oder was sie erleben."
                  placeholder="...in bestimmten Momenten explodieren — und sich danach schämen. Die spüren, dass da etwas Altes getriggert wird, aber nicht wissen, wie sie da rauskommen."
                  value={whoComesToMe}
                  onChange={setWhoComesToMe}
                  recommended={PROFILE_LIMITS.who_comes_to_me.recommended}
                  max={PROFILE_LIMITS.who_comes_to_me.max}
                  rows={3}
                />

                <ProfileTextField
                  id="session_focus"
                  label="In unserer Arbeit geht es oft um..."
                  hint="Was passiert in euren Sitzungen? Welche Themen tauchen auf, welche Prozesse?"
                  placeholder="...langsamer werden. Spüren, was der Körper eigentlich sagen will. Nicht sofort lösen oder wegmachen, sondern erstmal verstehen, was da ist — und warum es vielleicht mal wichtig war."
                  value={sessionFocus}
                  onChange={setSessionFocus}
                  recommended={PROFILE_LIMITS.session_focus.recommended}
                  max={PROFILE_LIMITS.session_focus.max}
                  rows={4}
                />

                <ProfileTextField
                  id="first_session"
                  label="Das erste Gespräch"
                  hint="Wie läuft ein Erstgespräch bei dir ab? Was erwartet jemanden?"
                  placeholder="Wir lernen uns kennen. Du erzählst, was dich herbringt — so viel oder wenig du möchtest. Ich höre zu und frage nach. Am Ende weißt du, ob du dir vorstellen kannst, mit mir zu arbeiten."
                  value={firstSession}
                  onChange={setFirstSession}
                  recommended={PROFILE_LIMITS.first_session.recommended}
                  max={PROFILE_LIMITS.first_session.max}
                  rows={3}
                />

                <ProfileTextField
                  id="about_me"
                  label="Über mich"
                  hint="Was sollten Menschen über dich wissen, das nicht in Qualifikationen steht?"
                  placeholder="Ursprünglich bin ich Volkswirtin — bis ich gemerkt habe, dass mich Menschen mehr interessieren als Zahlen. Ich habe ein Jahr in einem Ashram in Indien verbracht."
                  value={aboutMe}
                  onChange={setAboutMe}
                  recommended={PROFILE_LIMITS.about_me.recommended}
                  max={PROFILE_LIMITS.about_me.max}
                  rows={2}
                  optional
                />
              </div>
            </div>
          </Card>

          {/* Schwerpunkte */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-gray-900">Schwerpunkte</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Wähle {THERAPIST_SCHWERPUNKTE_MIN}–{THERAPIST_SCHWERPUNKTE_MAX} Themenbereiche, in denen du besonders erfahren bist.
                Diese helfen Klient:innen, dich zu finden.
              </p>
              <SchwerpunkteSelector
                value={schwerpunkte}
                onChange={setSchwerpunkte}
                role="therapist"
              />
            </div>
          </Card>

          {/* Legacy Approach Text (read-only) */}
          {initialData.approach_text_legacy && (
            <Card className="border border-gray-200/60 shadow-md bg-gray-50/80 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-start gap-3 mb-3">
                  <Lock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Bisheriger Profiltext</h3>
                    <p className="text-xs text-gray-500">
                      Dieser Text wird weiterhin angezeigt, kann aber nicht mehr bearbeitet werden. 
                      Die neuen Felder oben ersetzen ihn nach und nach.
                    </p>
                  </div>
                </div>
                <div className="bg-white/60 rounded-lg border border-gray-200 p-3">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{initialData.approach_text_legacy}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Session Details */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sitzungsdetails</h2>
              
              {/* Session Format */}
              <div className="space-y-3 mb-6">
                <Label className="text-sm font-medium text-gray-700">Sitzungsformat</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:border-emerald-300 transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:shadow-sm">
                    <input
                      type="checkbox"
                      checked={offersOnline}
                      onChange={(e) => setOffersOnline(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <Video className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Online</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:border-emerald-300 transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:shadow-sm">
                    <input
                      type="checkbox"
                      checked={offersInPerson}
                      onChange={(e) => setOffersInPerson(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <Building2 className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Vor Ort</span>
                  </label>
                </div>
              </div>

              {/* Practice Address (only if in-person) */}
              {offersInPerson && (
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    Praxisadresse
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="practice_street" className="text-xs text-gray-600">Straße und Hausnummer</Label>
                      <Input
                        id="practice_street"
                        value={practiceStreet}
                        onChange={(e) => setPracticeStreet(e.target.value)}
                        placeholder="z.B. Musterstraße 123"
                        className="border-gray-200 mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="practice_postal_code" className="text-xs text-gray-600">PLZ</Label>
                        <Input
                          id="practice_postal_code"
                          value={practicePostalCode}
                          onChange={(e) => setPracticePostalCode(e.target.value)}
                          placeholder="z.B. 10115"
                          maxLength={5}
                          className={`border-gray-200 mt-1 ${practicePostalCode && !isValidPostalCode(practicePostalCode) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {practicePostalCode && !isValidPostalCode(practicePostalCode) && (
                          <p className="text-xs text-red-600 mt-1">PLZ muss 5 Ziffern haben</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="practice_city" className="text-xs text-gray-600">Stadt</Label>
                        <Input
                          id="practice_city"
                          value={practiceCity}
                          onChange={(e) => setPracticeCity(e.target.value)}
                          placeholder="z.B. Berlin"
                          className="border-gray-200 mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* City (only when NOT offering in-person, since practiceCity is used otherwise) */}
              {!offersInPerson && (
                <div className="space-y-2 mb-6">
                  <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                    Stadt
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="z.B. Berlin"
                    className="border-gray-200"
                  />
                </div>
              )}

              {/* Typical Rate */}
              <div className="space-y-2">
                <Label htmlFor="typical_rate" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Euro className="h-4 w-4 text-gray-400" />
                  Honorar pro Sitzung (EUR)
                </Label>
                <Input
                  id="typical_rate"
                  type="number"
                  min="0"
                  step="1"
                  value={typicalRate}
                  onChange={(e) => setTypicalRate(e.target.value)}
                  placeholder="z.B. 100"
                  className="max-w-32 border-gray-200"
                />
                <p className="text-xs text-gray-500">Wird Klient:innen als Orientierung angezeigt</p>
              </div>
            </div>
          </Card>

          {/* Availability */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Verfügbarkeit</h2>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptingNew}
                  onChange={(e) => setAcceptingNew(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Neue Klient:innen annehmen</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Wenn deaktiviert, wirst du bei neuen Anfragen nicht angezeigt
                  </p>
                </div>
              </label>
            </div>
          </Card>

          {/* Submit & Status */}
          <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-lg">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPreviewOpen(true)}
                className="h-11 px-4 font-medium"
              >
                <Eye className="h-4 w-4 mr-2" />
                Vorschau
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-11 px-6 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {loading ? (
                  'Speichern...'
                ) : saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Gespeichert
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Änderungen speichern
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
                    Profil erfolgreich aktualisiert
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Slots Tab */
        <SlotsManager
          therapistId={therapistId}
          practiceAddress={practiceAddress}
          allowsOnline={offersOnline}
          allowsInPerson={offersInPerson}
        />
      )}

      {/* Support & Logout Footer */}
      <div className="pt-6 border-t border-gray-200 space-y-4">
        {/* Support Contact */}
        <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <p className="text-sm text-gray-600 mb-2">
            Fragen zu deinem Profil oder zur Plattform?
          </p>
          <a
            href="mailto:kontakt@kaufmann-health.de?subject=Therapeuten-Portal%20-%20Anfrage"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Kontaktiere uns
          </a>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
        >
          <LogOut className="h-5 w-5" />
          Abmelden
        </button>
      </div>

      {/* Profile Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Profilvorschau</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            {/* Photo & Name Header */}
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {currentPhotoUrl ? (
                  <Image src={currentPhotoUrl} alt="Profilbild" fill className="object-cover" />
                ) : (
                  <Camera className="h-8 w-8" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">So sehen Klient:innen dein Profil</p>
              </div>
            </div>

            {/* Location & Format Badges */}
            <div className="flex flex-wrap gap-2">
              {city && (
                <Badge variant="secondary" className="gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {city}
                </Badge>
              )}
              {offersOnline && (
                <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700">
                  <Video className="h-3 w-3" />
                  Online
                </Badge>
              )}
              {offersInPerson && (
                <Badge variant="secondary" className="gap-1 bg-slate-50 text-slate-700">
                  <Building2 className="h-3 w-3" />
                  Vor Ort
                </Badge>
              )}
            </div>

            {/* Schwerpunkte */}
            {schwerpunkte.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Schwerpunkte</h4>
                <div className="flex flex-wrap gap-2">
                  {schwerpunkte.map((id) => (
                    <Badge key={id} variant="outline" className={`rounded-full border ${getSchwerpunktColorClasses(id)}`}>
                      {getSchwerpunktLabel(id)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Sections */}
            {whoComesToMe && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Zu mir kommen Menschen, die...</h4>
                <p className="text-sm text-gray-700">{whoComesToMe}</p>
              </div>
            )}

            {sessionFocus && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">In unserer Arbeit geht es oft um...</h4>
                <p className="text-sm text-gray-700">{sessionFocus}</p>
              </div>
            )}

            {firstSession && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Das erste Gespräch</h4>
                <p className="text-sm text-gray-700">{firstSession}</p>
              </div>
            )}

            {aboutMe && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Über mich</h4>
                <p className="text-sm text-gray-700">{aboutMe}</p>
              </div>
            )}

            {/* Price */}
            {typicalRate && (
              <div className="pt-2 border-t">
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                  <Euro className="h-3.5 w-3.5" />
                  {typicalRate}€ pro Sitzung
                </Badge>
              </div>
            )}

            {/* Completeness Warning */}
            {(whoComesToMe.length < MIN_CHARS || sessionFocus.length < MIN_CHARS || firstSession.length < MIN_CHARS || schwerpunkte.length === 0 || !typicalRate) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-1">Profil unvollständig</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {whoComesToMe.length < MIN_CHARS && <li>• &quot;Zu mir kommen Menschen...&quot; mind. {MIN_CHARS} Zeichen</li>}
                  {sessionFocus.length < MIN_CHARS && <li>• &quot;In unserer Arbeit...&quot; mind. {MIN_CHARS} Zeichen</li>}
                  {firstSession.length < MIN_CHARS && <li>• &quot;Das erste Gespräch&quot; mind. {MIN_CHARS} Zeichen</li>}
                  {schwerpunkte.length === 0 && <li>• Keine Schwerpunkte ausgewählt</li>}
                  {!typicalRate && <li>• Preis pro Sitzung fehlt</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
