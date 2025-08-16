"use client";

import { ChevronDown } from "lucide-react";
import { useCallback } from "react";

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
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "faq_open", id: item.id, title: item.question }),
        keepalive: true,
      });
    } catch (err) {
      console.error("FAQ tracking failed", err);
    }
  }, []);

  return (
    <div className="divide-y rounded-xl border bg-white">
      {items.map((item) => (
        <details
          key={item.id}
          className="group px-4 py-3 sm:px-6"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) track(item);
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 outline-none">
            <span className="text-left font-medium">{item.question}</span>
            <span className="shrink-0 rounded-full bg-slate-100 p-2 transition-transform duration-200 group-open:rotate-180">
              <ChevronDown className="h-4 w-4 text-slate-600" />
            </span>
          </summary>

          {/* Animated content using grid-rows trick (no JS measurement) */}
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="pb-3 pt-1 text-sm text-gray-600">
                {item.answer}
              </div>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
