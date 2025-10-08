"use client";

import { ChevronDown } from "lucide-react";
import { useCallback } from "react";
import { buildEventId } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: Props) {
  const track = useCallback(async (item: FaqItem) => {
    try {
      // Lightweight tracking. keepalive ensures it still fires on page unload
      const builtId = buildEventId(
        typeof window !== "undefined" ? window.location.pathname : "",
        "faq",
        "open",
        item.id
      );
      const attrs = getAttribution();
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "faq_open", id: builtId, title: item.question, ...attrs }),
        keepalive: true,
      });
    } catch (err) {
      console.error("FAQ tracking failed", err);
    }
  }, []);

  return (
    <div className="divide-y divide-gray-200/60 rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md">
      {items.map((item) => (
        <details
          key={item.id}
          className="group px-5 py-4 sm:px-6 sm:py-5 hover:bg-slate-50/50 transition-colors"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) track(item);
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 outline-none">
            <span className="text-left font-semibold text-gray-900 text-base sm:text-lg">{item.question}</span>
            <span className="shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200/60 p-2.5 shadow-sm transition-all duration-200 group-open:rotate-180 group-open:bg-gradient-to-br group-open:from-emerald-100 group-open:to-emerald-200/60">
              <ChevronDown className="h-4 w-4 text-slate-700 group-open:text-emerald-700" />
            </span>
          </summary>

          {/* Animated content using grid-rows trick (no JS measurement) */}
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="pb-4 pt-2 text-sm sm:text-base leading-relaxed text-gray-700">
                {item.answer}
              </div>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
