# Modality Page Recipe

**Reference:** `/therapie/narm` (fully implemented)  
**For:** Somatic Experiencing, Hakomi, Core Energetics  
**Date:** Oct 29, 2025

---

## Quick Start

1. Copy `/therapie/narm/page.tsx` as starting point
2. Update `modalityConfig` reference
3. Replace modality-specific content
4. Verify design compliance checklist

---

## File Structure Template

```typescript
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { Heart, Users, Brain, CheckCircle2 } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";
import { MODALITIES } from "@/features/therapies/modalityConfig";
import { HeroNoForm } from "@/features/landing/components/HeroNoForm";

export const revalidate = 3600;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";
const modalityConfig = MODALITIES['your-slug']; // Change this!
```

---

## Page Structure (Required Order)

```
1. HeroNoForm
2. "Was ist [Modality]?" section
3. Core concept section (modality-specific - e.g., "5 Überlebensstrategien")
4. "Wie funktioniert [Modality]?" section
5. "Für wen ist [Modality] besonders geeignet?" section
6. "Wissenschaftlicher Hintergrund" section
7. PrinciplesGrid component
8. TherapistTeaserSection
9. FinalCtaSection
10. FAQ section
```

**Removed sections:**
- ❌ PrivacySelfPaySection
- ❌ RelatedTreatments
- ❌ Weiterführende Links
- ❌ NARM-Ausbildung

---

## Critical Design Patterns

### Main Container
```typescript
<main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
```
**Note:** `sm:px-6` is required!

### Section Spacing
All sections: `className="mt-14 sm:mt-20 lg:mt-24"`

### Container Types

**Elevated Plain Panel** (most sections):
```typescript
<div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
  <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
  {/* content */}
</div>
```

**Feature Highlight Panel** ("Für wen..." section):
```typescript
<div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30">
  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
  {/* content */}
</div>
```

### Card Structure (CRITICAL)
```typescript
<Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
  <CardContent className="p-5 sm:p-6">
    <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">[Title]</h3>
    {/* content */}
  </CardContent>
</Card>
```
**Never** put padding on Card directly - always use CardContent!

### Typography
- H2: `text-2xl sm:text-3xl font-bold tracking-tight text-gray-900`
- H3: `text-xl sm:text-2xl font-semibold text-gray-900` (not text-lg!)
- Body: `text-base sm:text-lg leading-relaxed text-gray-700`

---

## Section Templates

### 1. Hero
```typescript
<HeroNoForm
  title="[Modality]: [Key Benefit]"
  subtitle="[One-line explanation]"
/>
```

### 2. "Was ist [Modality]?"
```typescript
<section aria-labelledby="what-heading" className="mt-14 sm:mt-20 lg:mt-24">
  <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
    <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
    <h2 id="what-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
      Was ist [Modality]?
    </h2>
    <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
      [2-3 sentences - history, founder, approach]
    </p>
    <blockquote className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
      <p className="text-sm sm:text-base leading-relaxed text-gray-700 italic">
        &bdquo;[Quote]&ldquo; – [Attribution]
      </p>
    </blockquote>
  </div>
</section>
```

### 3. Core Concept (Modality-Specific)
Grid of cards with key concepts. Example from NARM:

```typescript
<div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
  <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
    <CardContent className="p-5 sm:p-6">
      <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">1. [Concept]</h3>
      <ul className="mt-2 ml-4 list-disc space-y-1.5 text-sm sm:text-base text-gray-700">
        <li><strong>Aspect:</strong> Description</li>
      </ul>
    </CardContent>
  </Card>
</div>
```

### 4. "Für wen ist [Modality] besonders geeignet?"
```typescript
<div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2">
  {[
    'Target audience trait 1',
    'Target audience trait 2',
    // 6 items total
  ].map((text, i) => (
    <div key={i} className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 sm:p-4 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span className="text-gray-700 font-medium leading-relaxed">{text}</span>
    </div>
  ))}
</div>
```

### 5. PrinciplesGrid Component
```typescript
function PrinciplesGrid() {
  const items = [
    { icon: <Heart className="h-5 w-5" />, title: "[Principle]", desc: "[Description]" },
    { icon: <Users className="h-5 w-5" />, title: "[Principle]", desc: "[Description]" },
    { icon: <Brain className="h-5 w-5" />, title: "[Principle]", desc: "[Description]" },
  ];
  return (
    <section aria-labelledby="principles-heading" className="mt-14 sm:mt-20 lg:mt-24">
      <RevealContainer>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          {/* radial gradients and blur decorations */}
          <h2 id="principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            [Modality]-Prinzipien
          </h2>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-3">
            {items.map((it, i) => (
              <Card key={i} className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
                  {it.icon}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{it.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}
```

### 6. Therapist Showcase
```typescript
<section className="mt-14 sm:mt-20 lg:mt-24">
  <TherapistTeaserSection
    title={modalityConfig.therapistSectionTitle}
    subtitle={modalityConfig.therapistSectionSubtitle}
    filters={modalityConfig.therapistFilter}
    limit={3}
    showViewAllButton={true}
    viewAllButtonText="Alle Therapeut:innen ansehen"
    viewAllButtonHref={`/therapeuten${modalityConfig.directoryFilterParams}`}
  />
</section>
```

### 7. Final CTA
```typescript
<div className="mt-14 sm:mt-20 lg:mt-24">
  <FinalCtaSection
    heading="Bereit für den ersten Schritt?"
    subtitle="Fülle unseren 5-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte [Modality]-Therapeuten-Vorschläge."
    buttonLabel="Jetzt Therapeut:in finden"
    targetId="/fragebogen"
    align="center"
    variant="tinted"
    showAvailabilityNote={false}
    withEntryOptions={true}
    targetBasePath="/fragebogen"
  />
</div>
```

### 8. FAQ
```typescript
<section aria-labelledby="faq-heading" className="mt-14 sm:mt-20 lg:mt-24">
  <RevealContainer>
    <div className="opacity-0 translate-y-2 transition-all duration-500" data-reveal>
      <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
      <div className="mt-6 sm:mt-8">
        <FaqAccordion items={faqs} />
      </div>
    </div>
  </RevealContainer>
</section>
```

---

## Design Compliance Checklist

### ✅ Before Deploy
- [ ] Main container has `px-4 sm:px-6`
- [ ] All Cards use CardContent wrapper (no direct padding on Card)
- [ ] H3 headings are `text-xl sm:text-2xl` (not text-lg)
- [ ] Section spacing is `mt-14 sm:mt-20 lg:mt-24`
- [ ] All sections have `aria-labelledby`
- [ ] Therapist showcase uses modalityConfig
- [ ] FAQ has 5-6 questions
- [ ] Build passes without errors

---

## Common Mistakes to Avoid

1. ❌ Putting padding on Card: `<Card className="p-5">` → Use CardContent!
2. ❌ Missing sm:px-6 on main container
3. ❌ Using text-lg for H3 headings → Use text-xl sm:text-2xl
4. ❌ Hardcoding therapist section config → Use modalityConfig
5. ❌ Including removed sections (PrivacySelfPaySection, RelatedTreatments)

---

## FAQ Content Template

```typescript
const faqs = [
  { 
    id: "difference", 
    question: "Wie unterscheidet sich [Modality] von [Other]?", 
    answer: "[Explanation]" 
  },
  { 
    id: "childhood", 
    question: "Muss ich über meine Kindheit sprechen?", 
    answer: "[Modality-specific answer]" 
  },
  { 
    id: "duration", 
    question: "Wie lange dauert eine [Modality]-Therapie?", 
    answer: "[Timeline]" 
  },
  { 
    id: "cost", 
    question: "Was kostet eine [Modality]-Sitzung?", 
    answer: "Die meisten [Modality]-Therapeut:innen arbeiten privat. Rechnen Sie mit 80-120€ pro Sitzung." 
  },
  { 
    id: "find", 
    question: "Wie finde ich einen qualifizierten [Modality]-Therapeuten?", 
    answer: "Achten Sie auf abgeschlossene [Modality]-Ausbildung. Unsere Therapeut:innen sind alle zertifiziert." 
  },
];
```

---

## JSON-LD Schemas

```typescript
const therapySchema = {
  "@context": "https://schema.org",
  "@type": "MedicalTherapy",
  name: "[Full Modality Name]",
  url: `${baseUrl}/therapie/${modalityConfig.slug}`,
  description: "[One-line description]",
  mainEntityOfPage: `${baseUrl}/therapie/${modalityConfig.slug}`,
} as const;

// Add at end of component before closing tags
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(therapySchema) }} />
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
}) }} />
```

---

## Next Steps

1. Copy `/therapie/narm/page.tsx` to new modality file
2. Update modalityConfig reference
3. Replace hero title/subtitle
4. Replace modality-specific content sections
5. Update FAQ questions/answers
6. Run `npm run build` to verify
7. Test therapist filtering works
8. Deploy

**Reference implementation:** `/therapie/narm/page.tsx`  
**Design language:** `/docs/design-language.md`
