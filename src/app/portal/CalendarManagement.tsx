"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ExternalLink, BookOpen, GraduationCap, Video, UserPlus, Users, ChevronDown, Loader2 } from "lucide-react";

interface RecentClient {
  patient_id: string;
  name: string | null;
  email: string;
  last_session: string;
  session_count: number;
}

interface Props {
  therapistId: string;
  calUsername?: string;
}

const CAL_ORIGIN = 'https://cal.kaufmann.health';

function buildBookingUrl(calUsername: string, name?: string, email?: string): string {
  const url = new URL(`/${calUsername}/full-session`, CAL_ORIGIN);
  if (name) url.searchParams.set('name', name);
  if (email) url.searchParams.set('email', email);
  url.searchParams.set('metadata[kh_source]', 'therapist_portal');
  return url.toString();
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

export default function CalendarManagement({ therapistId: _therapistId, calUsername }: Props) {
  const [clients, setClients] = useState<RecentClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<RecentClient | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);

  // Fetch recent clients on mount
  useEffect(() => {
    async function fetchClients() {
      setLoadingClients(true);
      try {
        const res = await fetch('/api/portal/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(data.clients || []);
        }
      } catch (e) {
        console.error('Failed to fetch clients:', e);
      } finally {
        setLoadingClients(false);
      }
    }
    fetchClients();
  }, []);

  const handleClientSelect = (client: RecentClient) => {
    setSelectedClient(client);
    setUseManualEntry(false);
    setShowDropdown(false);
  };

  const handleManualEntry = () => {
    setSelectedClient(null);
    setUseManualEntry(true);
    setShowDropdown(false);
  };

  const handleBookClient = () => {
    if (!calUsername) return;

    let name: string | undefined;
    let email: string | undefined;

    if (useManualEntry) {
      email = manualEmail.trim() || undefined;
      name = manualName.trim() || undefined;
    } else if (selectedClient) {
      email = selectedClient.email;
      name = selectedClient.name || undefined;
    }

    const url = buildBookingUrl(calUsername, name, email);
    window.open(url, '_blank');
  };

  const canBook = calUsername && (
    (useManualEntry && manualEmail.trim()) ||
    selectedClient
  );

  const displayValue = useManualEntry
    ? 'Neue:n Klient:in eingeben'
    : selectedClient
      ? `${selectedClient.name || 'Unbekannt'} (${selectedClient.email})`
      : 'Klient:in auswählen...';

  return (
    <div className="space-y-6">
      {/* Client Booking Card - NEW */}
      {calUsername && (
        <Card className="border border-amber-200/60 shadow-lg bg-gradient-to-br from-white to-amber-50/30 backdrop-blur-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Klient:in einbuchen
                </h2>
                <p className="text-gray-600 text-sm">
                  Buche deine Klient:innen direkt für den nächsten Termin ein.
                  Der Termin landet in beiden Kalendern und Erinnerungen gehen automatisch raus.
                </p>
              </div>
            </div>

            {/* Client Selector */}
            <div className="space-y-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg text-left hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
                >
                  <span className={selectedClient || useManualEntry ? 'text-gray-900' : 'text-gray-500'}>
                    {displayValue}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                    {/* Manual Entry Option */}
                    <button
                      type="button"
                      onClick={handleManualEntry}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 border-b border-gray-100"
                    >
                      <UserPlus className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 font-medium">Neue:n Klient:in eingeben</span>
                    </button>

                    {/* Recent Clients */}
                    {loadingClients ? (
                      <div className="flex items-center justify-center py-4 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Lade Klient:innen...
                      </div>
                    ) : clients.length > 0 ? (
                      <>
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          Letzte Klient:innen
                        </div>
                        {clients.map((client) => (
                          <button
                            key={client.patient_id}
                            type="button"
                            onClick={() => handleClientSelect(client)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {client.name || 'Unbekannt'}
                              </p>
                              <p className="text-sm text-gray-500 truncate">{client.email}</p>
                            </div>
                            <div className="text-right text-xs text-gray-400 ml-3">
                              <p>{formatDate(client.last_session)}</p>
                              <p>{client.session_count} {client.session_count === 1 ? 'Sitzung' : 'Sitzungen'}</p>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        Noch keine Klient:innen vorhanden
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Entry Fields */}
              {useManualEntry && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-Mail-Adresse <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="klient@beispiel.de"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-gray-400">(optional)</span>
                    </label>
                    <Input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Max Mustermann"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Book Button */}
              <Button
                type="button"
                onClick={handleBookClient}
                disabled={!canBook}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Termin buchen
                <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Cal.com Card */}
      <Card className="border border-emerald-200/60 shadow-lg bg-gradient-to-br from-white to-emerald-50/30 backdrop-blur-sm overflow-hidden">
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verfügbarkeit verwalten
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Verwalte deine Termine, Verfügbarkeit und Buchungseinstellungen zentral über Cal.com.
                Alle Änderungen werden automatisch mit deinem Profil synchronisiert.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://cal.kaufmann.health"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 group"
              >
                <Calendar className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                Zu Cal.com wechseln
                <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
              </Button>
            </a>
          </div>

          {/* Info about availability setup */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Hinweis:</strong> Sobald du in Cal.com Verfügbarkeit eingerichtet hast,
              erscheinen die Buchungsbuttons automatisch auf deinem Profil. Neue Accounts
              starten ohne Verfügbarkeit – richte diese in Cal.com unter &bdquo;Availability&ldquo; ein.
            </p>
          </div>
        </div>
      </Card>

      {/* Documentation Section */}
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Anleitungen & Dokumentation
          </h3>

          <div className="space-y-4">
            {/* Getting Started Guide */}
            <a
              href="https://docs.google.com/document/d/1UOjkW5f2P6qq035N1sgnhcGq5gC0QAGvde9OrcEnm7o/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 group"
            >
              <div className="p-2 bg-blue-100 rounded-md group-hover:bg-blue-200 transition-colors">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                  Kurzanleitung für Einsteiger
                </h4>
                <p className="text-sm text-gray-600">
                  Erster Login und Verwaltung deiner Verfügbarkeit
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
            </a>

            {/* Advanced Guide */}
            <a
              href="https://docs.google.com/document/d/1Ts6Ctw17Js6_KXL8wfq9sRId_A3DZRsMCw_uDKdeXtE/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all duration-200 group"
            >
              <div className="p-2 bg-purple-100 rounded-md group-hover:bg-purple-200 transition-colors">
                <GraduationCap className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">
                  Anleitung für Fortgeschrittene
                </h4>
                <p className="text-sm text-gray-600">
                  Buchungslink in deine Website implementieren und erweiterte Einstellungen
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0 mt-1" />
            </a>

            {/* Video Tutorial */}
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-md">
                    <Video className="h-5 w-5 text-red-600" />
                  </div>
                  <h4 className="font-medium text-gray-900">
                    Video-Tutorial: Kalender einrichten
                  </h4>
                </div>
              </div>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/mki1wEu0FDs"
                  title="Cal.com Kalender einrichten Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ Section */}
      <Card className="border border-amber-200/60 shadow-md bg-gradient-to-br from-white to-amber-50/20">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Häufige Fragen
          </h3>
          <div className="space-y-4 text-sm">
            {/* Booking Notice */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Wie kurzfristig können Klient:innen buchen?</h4>
              <p className="text-gray-600">
                <strong>Kennenlerngespräch:</strong> Mindestens 4 Stunden vorher (ermöglicht Same-Day-Buchungen)<br />
                <strong>Therapiesitzung:</strong> Mindestens 24 Stunden vorher<br />
                <span className="text-xs text-gray-500 mt-1 block">Ändern: Cal.com → Ereignistyp → Limits → &bdquo;Mindestvorlaufzeit&ldquo;</span>
              </p>
            </div>

            {/* Intro Call */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Was ist das &bdquo;Kostenloses Kennenlerngespräch&ldquo;?</h4>
              <p className="text-gray-600">
                Ein 15-minütiges Videogespräch zum Kennenlernen. Der Video-Link wird automatisch von Cal.com generiert
                und in der Buchungsbestätigung an beide Parteien verschickt. Du musst nichts einrichten.
              </p>
            </div>

            {/* Full Session */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Wie funktioniert die &bdquo;Therapiesitzung&ldquo;?</h4>
              <p className="text-gray-600">
                Eine 50-minütige Sitzung. Standard ist ein automatisch generierter Cal Video-Link.
                Für Präsenz-Termine wird deine Praxisadresse angezeigt.
              </p>
            </div>

            {/* Custom Video Link */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Kann ich meinen eigenen Video-Link nutzen (z.B. Zoom)?</h4>
              <p className="text-gray-600">
                Ja! Gehe in Cal.com zu deinem Ereignistyp → &bdquo;Ort&ldquo; → wähle &bdquo;Zoom&ldquo;, &bdquo;Google Meet&ldquo; oder füge eine
                eigene URL hinzu. Die Standard-Einstellung ist Cal Video (kostenlos, DSGVO-konform, keine Installation nötig).
              </p>
            </div>

            {/* Practice Address */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Wo stelle ich meine Praxisadresse ein?</h4>
              <p className="text-gray-600">
                Im Reiter &bdquo;Profil&ldquo; oben auf dieser Seite. Wenn du dort &bdquo;Vor Ort&ldquo; als Sitzungsformat
                auswählst und deine Praxisadresse eingibst, wird diese automatisch mit Cal.com synchronisiert.
              </p>
            </div>

            {/* Critical Warning about slugs */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 -mx-1">
              <h4 className="font-medium text-red-800 mb-1">Wichtig: Bitte NICHT ändern!</h4>
              <p className="text-red-700 text-xs">
                Ändere in Cal.com <strong>niemals</strong> folgende Einstellungen – sonst funktioniert die Buchung über Kaufmann Health nicht mehr:
              </p>
              <ul className="text-red-700 text-xs mt-1 ml-4 list-disc">
                <li>Deinen <strong>Benutzernamen</strong> (URL-Slug)</li>
                <li>Die <strong>URL</strong> des Kennenlerngespräch (&bdquo;intro&ldquo;)</li>
                <li>Die <strong>URL</strong> der Therapiesitzung (&bdquo;full-session&ldquo;)</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
