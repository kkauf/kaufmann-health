"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Camera, Save, CheckCircle2, LogOut, MapPin, Euro, Video, Building2, X, Mail, Calendar, Info, Lock } from "lucide-react";
import SlotsManager from "./SlotsManager";

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
    typical_rate?: number;
    practice_street: string;
    practice_postal_code: string;
    practice_city: string;
    accepting_new: boolean;
    city: string;
  };
};

// Profile field character limits
const PROFILE_LIMITS = {
  who_comes_to_me: 200,
  session_focus: 250,
  first_session: 200,
  about_me: 150,
};

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

  // Form state - New profile sections
  const [whoComesToMe, setWhoComesToMe] = useState(initialData.who_comes_to_me);
  const [sessionFocus, setSessionFocus] = useState(initialData.session_focus);
  const [firstSession, setFirstSession] = useState(initialData.first_session);
  const [aboutMe, setAboutMe] = useState(initialData.about_me);
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
    if (offersOnline !== b.offersOnline) return true;
    if (offersInPerson !== b.offersInPerson) return true;
    if (typicalRate !== b.typicalRate) return true;
    if (practiceStreet !== b.practiceStreet) return true;
    if (practicePostalCode !== b.practicePostalCode) return true;
    if (practiceCity !== b.practiceCity) return true;
    if (acceptingNew !== b.acceptingNew) return true;
    if (city !== b.city) return true;
    return false;
  }, [photoFile, whoComesToMe, sessionFocus, firstSession, aboutMe, offersOnline, offersInPerson, typicalRate, practiceStreet, practicePostalCode, practiceCity, acceptingNew, city]);

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
      
      form.set('session_preferences', JSON.stringify(sessionPrefs));
      form.set('accepting_new', acceptingNew ? 'true' : 'false');
      form.set('city', city.trim());

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
        offersOnline,
        offersInPerson,
        typicalRate,
        practiceStreet,
        practicePostalCode,
        practiceCity,
        acceptingNew,
        city,
      };
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
  }, [therapistId, whoComesToMe, sessionFocus, firstSession, aboutMe, offersOnline, offersInPerson, typicalRate, practiceStreet, practicePostalCode, practiceCity, acceptingNew, city, photoFile, photoError]);

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
              
              {/* Section 1: Who comes to me */}
              <div className="space-y-2 mb-6">
                <Label htmlFor="who_comes_to_me" className="text-sm font-medium text-gray-900">
                  Zu mir kommen Menschen, die...
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Beschreibe, welche Menschen zu dir finden — nicht Diagnosen, sondern wie sie sich fühlen oder was sie erleben.
                </p>
                <textarea
                  id="who_comes_to_me"
                  rows={3}
                  maxLength={PROFILE_LIMITS.who_comes_to_me}
                  value={whoComesToMe}
                  onChange={(e) => setWhoComesToMe(e.target.value)}
                  placeholder="...merken, dass Gespräche allein nicht reichen und der Körper noch festhält"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end text-xs text-gray-500">
                  <span className={whoComesToMe.length > PROFILE_LIMITS.who_comes_to_me - 30 ? 'text-amber-600 font-medium' : ''}>
                    {PROFILE_LIMITS.who_comes_to_me - whoComesToMe.length} Zeichen
                  </span>
                </div>
              </div>

              {/* Section 2: Session focus */}
              <div className="space-y-2 mb-6">
                <Label htmlFor="session_focus" className="text-sm font-medium text-gray-900">
                  In unserer Arbeit geht es oft um...
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Was passiert in euren Sitzungen? Welche Themen tauchen auf, welche Prozesse?
                </p>
                <textarea
                  id="session_focus"
                  rows={4}
                  maxLength={PROFILE_LIMITS.session_focus}
                  value={sessionFocus}
                  onChange={(e) => setSessionFocus(e.target.value)}
                  placeholder="...langsamer werden und spüren, was der Körper eigentlich will"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end text-xs text-gray-500">
                  <span className={sessionFocus.length > PROFILE_LIMITS.session_focus - 30 ? 'text-amber-600 font-medium' : ''}>
                    {PROFILE_LIMITS.session_focus - sessionFocus.length} Zeichen
                  </span>
                </div>
              </div>

              {/* Section 3: First session */}
              <div className="space-y-2 mb-6">
                <Label htmlFor="first_session" className="text-sm font-medium text-gray-900">
                  Das erste Gespräch
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Wie läuft ein Erstgespräch bei dir ab? Was erwartet jemanden?
                </p>
                <textarea
                  id="first_session"
                  rows={3}
                  maxLength={PROFILE_LIMITS.first_session}
                  value={firstSession}
                  onChange={(e) => setFirstSession(e.target.value)}
                  placeholder="Wir lernen uns kennen. Du erzählst, was dich herbringt — so viel oder wenig du möchtest."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end text-xs text-gray-500">
                  <span className={firstSession.length > PROFILE_LIMITS.first_session - 30 ? 'text-amber-600 font-medium' : ''}>
                    {PROFILE_LIMITS.first_session - firstSession.length} Zeichen
                  </span>
                </div>
              </div>

              {/* Section 4: About me (optional) */}
              <div className="space-y-2">
                <Label htmlFor="about_me" className="text-sm font-medium text-gray-900">
                  Über mich <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Was sollten Menschen über dich wissen, das nicht in Qualifikationen steht?
                </p>
                <textarea
                  id="about_me"
                  rows={2}
                  maxLength={PROFILE_LIMITS.about_me}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="Nur ausfüllen, wenn du etwas Echtes zu erzählen hast"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end text-xs text-gray-500">
                  <span className={aboutMe.length > PROFILE_LIMITS.about_me - 20 ? 'text-amber-600 font-medium' : ''}>
                    {PROFILE_LIMITS.about_me - aboutMe.length} Zeichen
                  </span>
                </div>
              </div>
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

              {/* City */}
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
                type="submit"
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
    </div>
  );
}
