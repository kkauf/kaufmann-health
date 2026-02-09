"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Camera, Save, CheckCircle2, LogOut, MapPin, Euro, Video, Building2, X, Mail, Calendar, Lock, Target, Eye, Globe, HelpCircle, ExternalLink } from "lucide-react";
import { ImageCropper } from "@/components/ImageCropper";
import { TherapistDetailModal } from "@/features/therapists/components/TherapistDetailModal";
import type { TherapistData } from "@/features/therapists/components/TherapistDirectory";
import CalendarManagement from "./CalendarManagement";
import { SchwerpunkteSelector } from "@/components/SchwerpunkteSelector";
import { LanguageInput } from "@/components/ui/language-input";
import { THERAPIST_SCHWERPUNKTE_MIN, THERAPIST_SCHWERPUNKTE_MAX } from "@/lib/schwerpunkte";
import { PROFILE_LIMITS } from "@/lib/config/profileLimits";

type Props = {
  therapistId: string;
  initialData: {
    first_name: string;
    last_name: string;
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
    languages: string[];
    requires_intro_before_booking: boolean;
    // Cal.com integration
    cal_username?: string;
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

// Minimum character count for required text fields
const MIN_CHARS = 50;

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
  
  // Show warning state when field is required but empty or too short
  const showWarning = !optional && value.length < MIN_CHARS;

  return (
    <div className={`space-y-2 p-4 rounded-lg -mx-4 transition-colors ${showWarning ? 'bg-amber-50/50' : ''}`}>
      <Label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
        {optional ? (
          <span className="text-gray-400 font-normal"> (optional)</span>
        ) : (
          <span className="text-red-500 ml-0.5">*</span>
        )}
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
            showWarning
              ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-200'
              : value.length === 0
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

      {/* Required field warning */}
      {showWarning && value.length > 0 && (
        <p className="text-xs text-amber-700">
          Noch {MIN_CHARS - value.length} Zeichen für ein vollständiges Profil
        </p>
      )}
    </div>
  );
}

// German postal code validation (5 digits)
const isValidPostalCode = (code: string): boolean => /^\d{5}$/.test(code.trim());

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB

type Tab = 'profile' | 'calendar';

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
  const [languages, setLanguages] = useState<string[]>(initialData.languages);
  const [requiresIntroBeforeBooking, setRequiresIntroBeforeBooking] = useState(initialData.requires_intro_before_booking);

  // Combine address fields for SlotsManager
  const _practiceAddress = [practiceStreet, practicePostalCode, practiceCity].filter(Boolean).join(', ');

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
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
    languages: [...initialData.languages],
    requiresIntroBeforeBooking: initialData.requires_intro_before_booking,
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
    if (languages.length !== b.languages.length || languages.some((l, i) => l !== b.languages[i])) return true;
    if (requiresIntroBeforeBooking !== b.requiresIntroBeforeBooking) return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFile, whoComesToMe, sessionFocus, firstSession, aboutMe, schwerpunkte, offersOnline, offersInPerson, typicalRate, practiceStreet, practicePostalCode, practiceCity, acceptingNew, city, languages, requiresIntroBeforeBooking, saveCount]);

  // Transform form state to TherapistData for preview modal
  const previewTherapistData: TherapistData = useMemo(() => ({
    id: therapistId,
    first_name: initialData.first_name,
    last_name: initialData.last_name,
    photo_url: currentPhotoUrl,
    modalities: initialData.modalities,
    schwerpunkte: schwerpunkte,
    session_preferences: [
      ...(offersOnline ? ['online'] : []),
      ...(offersInPerson ? ['in_person'] : []),
    ],
    approach_text: initialData.approach_text_legacy || '',
    accepting_new: acceptingNew,
    city: offersInPerson ? practiceCity : city,
    typical_rate: typicalRate ? parseInt(typicalRate, 10) : null,
    languages: languages.length > 0 ? languages : undefined,
    metadata: {
      profile: {
        who_comes_to_me: whoComesToMe,
        session_focus: sessionFocus,
        first_session: firstSession,
        about_me: aboutMe,
        practice_address: offersInPerson
          ? [practiceStreet, practicePostalCode, practiceCity].filter(Boolean).join(', ')
          : undefined,
      },
    },
    credential_tier: 'licensed',
    availability: [], // No slots in preview - therapist manages these separately
  }), [
    therapistId,
    initialData.first_name,
    initialData.last_name,
    initialData.modalities,
    initialData.approach_text_legacy,
    currentPhotoUrl,
    schwerpunkte,
    offersOnline,
    offersInPerson,
    acceptingNew,
    practiceCity,
    city,
    typicalRate,
    languages,
    whoComesToMe,
    sessionFocus,
    firstSession,
    aboutMe,
    practiceStreet,
    practicePostalCode,
  ]);

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
    // Session format: must offer at least one
    if (!offersOnline && !offersInPerson) missing.push('Sitzungsformat (Online oder Vor Ort)');
    // Practice address: required if offering in-person
    if (offersInPerson && (!practiceCity.trim() || !practicePostalCode.trim())) {
      missing.push('Praxisadresse (Stadt + PLZ)');
    }

    const total = 8; // Updated count
    const completed = total - missing.length;
    const percentage = Math.round((completed / total) * 100);
    const isComplete = missing.length === 0;

    return { missing, completed, total, percentage, isComplete };
  }, [whoComesToMe, sessionFocus, firstSession, schwerpunkte, typicalRate, currentPhotoUrl, offersOnline, offersInPerson, practiceCity, practicePostalCode]);

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
      // Open cropper instead of directly setting the file
      const url = URL.createObjectURL(file);
      setCropperImageSrc(url);
      setShowCropper(true);
    }
  }, []);

  const onCropComplete = useCallback((croppedBlob: Blob) => {
    // Create a File from the cropped Blob
    const croppedFile = new File([croppedBlob], 'profile-photo.jpg', { type: 'image/jpeg' });
    setPhotoFile(croppedFile);
    setPhotoPending(true);
    
    // Create preview URL from cropped blob
    const url = URL.createObjectURL(croppedBlob);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    
    // Clean up cropper state
    if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
    setCropperImageSrc(null);
    setShowCropper(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cropperImageSrc]);

  const onCropCancel = useCallback(() => {
    if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
    setCropperImageSrc(null);
    setShowCropper(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cropperImageSrc]);

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

    // CRITICAL: If trying to enable visibility, validate ALL required fields
    if (acceptingNew) {
      if (!typicalRate || parseInt(typicalRate, 10) <= 0) {
        validationErrors.push('Honorar pro Sitzung ist erforderlich, um sichtbar zu sein');
      }
      if (schwerpunkte.length < THERAPIST_SCHWERPUNKTE_MIN) {
        validationErrors.push(`Mind. ${THERAPIST_SCHWERPUNKTE_MIN} Schwerpunkte erforderlich, um sichtbar zu sein`);
      }
      if (!currentPhotoUrl && !photoFile) {
        validationErrors.push('Profilfoto erforderlich, um sichtbar zu sein');
      }
      if (!offersOnline && !offersInPerson) {
        validationErrors.push('Sitzungsformat (Online oder Vor Ort) erforderlich, um sichtbar zu sein');
      }
      if (offersInPerson && (!practiceCity.trim() || !practicePostalCode.trim())) {
        validationErrors.push('Praxisadresse (Stadt + PLZ) erforderlich für Vor-Ort-Sitzungen');
      }
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
      
      // Add languages
      form.set('languages', JSON.stringify(languages));
      
      form.set('session_preferences', JSON.stringify(sessionPrefs));
      form.set('accepting_new', acceptingNew ? 'true' : 'false');
      form.set('requires_intro_before_booking', requiresIntroBeforeBooking ? 'true' : 'false');
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
        languages: [...languages],
        requiresIntroBeforeBooking,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* Unified Profile Status & Progress */}
      {activeTab === 'profile' && (
        <div className={`p-4 rounded-lg border-2 transition-all ${
          acceptingNew
            ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300'
            : profileCompleteness.isComplete
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'
              : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
        }`}>
          {/* Status Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {acceptingNew ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-900">Profil aktiv</span>
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Sichtbar im Verzeichnis</span>
                </>
              ) : profileCompleteness.isComplete ? (
                <>
                  <Eye className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-900">Profil bereit zur Aktivierung</span>
                </>
              ) : (
                <>
                  <Target className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">Profil vervollständigen</span>
                </>
              )}
            </div>
            <span className="text-xs text-gray-600">
              {profileCompleteness.completed}/{profileCompleteness.total} Pflichtfelder
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                acceptingNew
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : profileCompleteness.isComplete
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400'
              }`}
              style={{ width: `${profileCompleteness.percentage}%` }}
            />
          </div>

          {/* Content based on state */}
          {!profileCompleteness.isComplete ? (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Noch offen:</span>{' '}
              {profileCompleteness.missing.join(', ')}
            </div>
          ) : !acceptingNew ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-amber-800">
                Alle Pflichtfelder ausgefüllt. Aktiviere dein Profil, um für Klient:innen sichtbar zu werden.
              </p>
              <Button
                type="button"
                size="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md whitespace-nowrap"
                onClick={() => {
                  const confirmed = window.confirm(
                    'Profil aktivieren?\n\nDein Profil wird für Klient:innen sichtbar und du kannst Anfragen erhalten.\n\nKlicke danach auf "Speichern" um die Änderung zu übernehmen.'
                  );
                  if (confirmed) {
                    setAcceptingNew(true);
                  }
                }}
              >
                ✓ Profil aktivieren
              </Button>
            </div>
          ) : (
            <p className="text-xs text-emerald-700">
              Klient:innen können dich im Verzeichnis finden und Anfragen stellen.
            </p>
          )}
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
          aria-selected={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'calendar'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Kalender
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

              {/* Session Format - REQUIRED */}
              <div className={`space-y-3 mb-6 p-4 rounded-lg -mx-4 ${!offersOnline && !offersInPerson ? 'bg-amber-50 border border-amber-200' : ''}`}>
                <Label className="text-sm font-medium text-gray-700">
                  Sitzungsformat <span className="text-red-500">*</span>
                </Label>
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
                {!offersOnline && !offersInPerson && (
                  <p className="text-xs text-amber-700 font-medium">Pflichtfeld – Wähle mindestens ein Sitzungsformat.</p>
                )}
              </div>

              {/* Practice Address (only if in-person) - REQUIRED */}
              {offersInPerson && (
                <div className={`space-y-4 mb-6 p-4 rounded-lg -mx-4 ${!practiceCity.trim() || !practicePostalCode.trim() ? 'bg-amber-50 border border-amber-200' : ''}`}>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    Praxisadresse <span className="text-red-500">*</span>
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
                          className={`border-gray-200 mt-1 ${!practiceCity.trim() ? 'border-amber-400' : ''}`}
                        />
                      </div>
                    </div>
                    {(!practiceCity.trim() || !practicePostalCode.trim()) && (
                      <p className="text-xs text-amber-700 font-medium">PLZ und Stadt sind Pflichtfelder für Vor-Ort-Sitzungen.</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Wir unterstützen derzeit einen Hauptstandort pro Profil. Wähle den Standort, an dem du die meisten Klient:innen erwartest.
                    </p>
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
                  <p className="text-xs text-gray-500">
                    Wir unterstützen derzeit einen Hauptstandort pro Profil. Wähle den Standort, an dem du die meisten Klient:innen erwartest.
                  </p>
                </div>
              )}

              {/* Languages */}
              <div className="space-y-3 mb-6">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  Sprachen für Sitzungen
                </Label>
                <p className="text-xs text-gray-500">Tippe, um Sprachen auszuwählen oder eigene hinzuzufügen.</p>
                <LanguageInput
                  value={languages}
                  onChange={setLanguages}
                  placeholder="Sprache eingeben..."
                />
                {languages.length === 0 && (
                  <p className="text-xs text-amber-600">Bitte wähle mindestens eine Sprache.</p>
                )}
              </div>

              {/* Typical Rate - REQUIRED */}
              <div className={`space-y-2 p-4 rounded-lg -mx-4 ${!typicalRate ? 'bg-amber-50 border border-amber-200' : ''}`}>
                <Label htmlFor="typical_rate" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Euro className="h-4 w-4 text-gray-400" />
                  Honorar pro Sitzung (EUR)
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="typical_rate"
                  type="number"
                  min="0"
                  step="1"
                  value={typicalRate}
                  onChange={(e) => setTypicalRate(e.target.value)}
                  placeholder="z.B. 100"
                  className={`max-w-32 ${!typicalRate ? 'border-amber-400 bg-white' : 'border-gray-200'}`}
                />
                {!typicalRate ? (
                  <p className="text-xs text-amber-700 font-medium">Pflichtfeld – Gib einen Preis an, damit dein Profil vollständig ist.</p>
                ) : (
                  <p className="text-xs text-gray-500">Wird Klient:innen als Orientierung angezeigt. Bei unterschiedlichen Preisen (online/vor Ort) wähle einen Richtwert.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Booking Settings - control how clients can book */}
          <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Buchungseinstellungen</h2>
              <p className="text-sm text-gray-500 mb-4">
                Bestimme, wie neue Klient:innen dich kontaktieren können.
              </p>
              <div className="rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresIntroBeforeBooking}
                    onChange={(e) => setRequiresIntroBeforeBooking(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Kennenlerngespräch vor Therapiesitzung erforderlich
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      Wenn aktiviert, können Klient:innen nur ein kostenloses Kennenlerngespräch buchen.
                      Therapiesitzungen werden erst nach dem Erstgespräch freigeschaltet.
                      So lernst du neue Klient:innen erst kennen, bevor du dich auf eine Zusammenarbeit einlässt.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </Card>

          {/* Availability - only show when profile is complete for pause/resume control */}
          {profileCompleteness.isComplete && (
          <Card
            id="availability-section"
            className="shadow-md backdrop-blur-sm border border-gray-200/60 bg-white/80"
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Profil pausieren
              </h2>
              <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptingNew}
                    onChange={(e) => setAcceptingNew(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Neue Klient:innen annehmen
                    </span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Deaktiviere dies vorübergehend, wenn du keine Kapazität für neue Anfragen hast.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </Card>
          )}

          {/* Profile incomplete message - only show when profile is not complete */}
          {!profileCompleteness.isComplete && (
            <Card className="shadow-md backdrop-blur-sm border border-amber-200 bg-amber-50/80">
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Lock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      Profil noch nicht vollständig
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Vervollständige alle Pflichtfelder oben, um dein Profil aktivieren zu können.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

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
        /* Calendar Management Tab */
        <CalendarManagement therapistId={therapistId} calUsername={initialData.cal_username} />
      )}

      {/* FAQ & Documentation Section */}
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-emerald-600" />
            Häufige Fragen
          </h2>
          <div className="space-y-3">
            <a
              href="https://docs.google.com/document/d/1wSJJ8_nJ5M3wg-eob4V1-aT3zVFZNnmpwFCzoA1ElbE/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200">
                <Euro className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
                  Provision & Bezahlung
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Wie funktioniert die Abrechnung? Was kostet die Vermittlung?
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-emerald-600 flex-shrink-0 mt-1" />
            </a>
          </div>
        </div>
      </Card>

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

      {/* Profile Preview Modal - reuses the public-facing TherapistDetailModal */}
      <TherapistDetailModal
        therapist={previewTherapistData}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewMode
      />

      {/* Image Cropper Modal */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={onCropComplete}
          onCancel={onCropCancel}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
