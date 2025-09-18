"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Floating WhatsApp/Contact button for public pages.
 * - Uses NEXT_PUBLIC_WHATSAPP_URL when present, falls back to mailto.
 * - No cookies; uses a plain anchor.
 */
export default function FloatingWhatsApp() {
  const href = process.env.NEXT_PUBLIC_WHATSAPP_URL || "mailto:kontakt@kaufmann.health";
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Button asChild size="lg" className="shadow-lg bg-black text-white hover:bg-black/90">
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" aria-label="Fragen? WhatsApp uns">
          <MessageCircle className="mr-2 h-5 w-5" /> Fragen? WhatsApp uns
        </a>
      </Button>
    </div>
  );
}
