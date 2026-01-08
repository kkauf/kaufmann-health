"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, BookOpen, GraduationCap, Video } from "lucide-react";

export default function CalendarManagement() {
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

          <a
            href="https://cal.kaufmann.health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full sm:w-auto"
          >
            <Button 
              size="lg"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 group"
            >
              <Calendar className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              Zu Cal.com wechseln
              <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
            </Button>
          </a>
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
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Wo stelle ich meine Praxisadresse ein?</h4>
              <p className="text-gray-600">
                Im Reiter &bdquo;Profil&ldquo; oben auf dieser Seite. Wenn du dort &bdquo;Vor Ort&ldquo; als Sitzungsformat 
                auswählst und deine Praxisadresse eingibst, wird diese automatisch mit Cal.com synchronisiert.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
