"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, BookOpen, GraduationCap, Video, Rocket, CheckCircle, Loader2, Square, CheckSquare } from "lucide-react";

interface Props {
  therapistId: string;
  calBookingsLive?: boolean;
}

export default function CalendarManagement({ therapistId, calBookingsLive: initialCalBookingsLive }: Props) {
  const [calBookingsLive, setCalBookingsLive] = useState(initialCalBookingsLive ?? false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Activation checklist state (one-time confirmation)
  const [hasReviewedAvailability, setHasReviewedAvailability] = useState(false);
  const [hasSetRealHours, setHasSetRealHours] = useState(false);
  
  const canEnable = hasReviewedAvailability && hasSetRealHours;

  const handleGoLive = async () => {
    if (!canEnable) return;
    
    setEnabling(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/public/therapists/${therapistId}/enable-cal`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Aktivieren');
      }
      
      setCalBookingsLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="space-y-6">
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
            
            {calBookingsLive && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Buchungen aktiv</span>
              </div>
            )}
          </div>
          
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
          
          {/* Activation Checklist - only show when not yet enabled */}
          {!calBookingsLive && (
            <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <h4 className="font-semibold text-gray-900 mb-4">
                Freischaltung deiner Online-Buchung
              </h4>
              
              <p className="text-sm text-gray-600 mb-4">
                Bitte bestätige, dass du deine Verfügbarkeit in Cal.com eingerichtet hast:
              </p>
              
              {/* Checkbox 1 */}
              <button
                type="button"
                onClick={() => setHasReviewedAvailability(!hasReviewedAvailability)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 mb-3 text-left ${
                  hasReviewedAvailability 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  hasReviewedAvailability 
                    ? 'bg-emerald-500 border-emerald-500' 
                    : 'border-gray-300'
                }`}>
                  {hasReviewedAvailability && (
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <div>
                  <span className={`font-medium ${hasReviewedAvailability ? 'text-emerald-800' : 'text-gray-900'}`}>
                    Ich habe meine Verfügbarkeit in Cal.com überprüft
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Eingeloggt und den Bereich &bdquo;Availability&ldquo; angeschaut
                  </p>
                </div>
              </button>
              
              {/* Checkbox 2 */}
              <button
                type="button"
                onClick={() => setHasSetRealHours(!hasSetRealHours)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 mb-4 text-left ${
                  hasSetRealHours 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  hasSetRealHours 
                    ? 'bg-emerald-500 border-emerald-500' 
                    : 'border-gray-300'
                }`}>
                  {hasSetRealHours && (
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <div>
                  <span className={`font-medium ${hasSetRealHours ? 'text-emerald-800' : 'text-gray-900'}`}>
                    Ich habe meine tatsächlichen Arbeitszeiten eingetragen
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Nicht nur die Beispielzeiten – sondern wann ich wirklich verfügbar bin
                  </p>
                </div>
              </button>
              
              {/* Enable Button */}
              <Button 
                size="lg"
                onClick={handleGoLive}
                disabled={!canEnable || enabling}
                className={`w-full transition-all duration-200 ${
                  canEnable 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {enabling ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Rocket className="h-5 w-5 mr-2" />
                )}
                {enabling ? 'Wird aktiviert...' : 'Buchungen freischalten'}
              </Button>
              
              {!canEnable && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Bitte bestätige beide Punkte, um fortzufahren
                </p>
              )}
            </div>
          )}
          
          {/* Success state - show after enabling */}
          {calBookingsLive && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Deine Buchungsseite ist live!
              </h4>
              <p className="text-sm text-green-800">
                Klient:innen können ab sofort Termine bei dir buchen. Änderungen an deiner Verfügbarkeit 
                kannst du jederzeit in Cal.com vornehmen – sie werden automatisch übernommen.
              </p>
            </div>
          )}
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
            ❓ Häufige Fragen
          </h3>
          <div className="space-y-4 text-sm">
            {/* Slot Migration Warning */}
            <div className="border-b border-amber-100 pb-4">
              <h4 className="font-medium text-gray-900 mb-1">Was passiert mit meinen bisherigen Slots?</h4>
              <p className="text-gray-600">
                Mit der Aktivierung von Cal.com werden deine bisherigen Verfügbarkeits-Slots im Portal deaktiviert. 
                Bitte richte deine Verfügbarkeit direkt in Cal.com ein – dort hast du deutlich mehr Flexibilität 
                (z.B. Kalender-Sync, Pufferzeiten, individuelle Buchungsregeln).
              </p>
            </div>
            
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
              <h4 className="font-medium text-red-800 mb-1">⚠️ Wichtig: Bitte NICHT ändern!</h4>
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
