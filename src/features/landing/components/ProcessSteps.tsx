import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RevealContainer from "@/components/RevealContainer";
import { cn } from "@/lib/utils";

export type ProcessStep = {
  icon: React.ReactNode;
  step: number;
  title: string;
  description?: string;
  bullets?: string[];
};

export function ProcessSteps({
  heading = "So funktioniert's",
  items,
  className,
  footnote,
}: {
  heading?: string;
  items: ProcessStep[];
  className?: string;
  footnote?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="process-heading"
      className={cn(
        "relative mt-10 overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:mt-14 sm:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="process-heading" className="text-2xl font-semibold tracking-tight">
          {heading}
        </h2>
      </div>

      <RevealContainer>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((it, idx) => (
            <Card
              key={idx}
              data-reveal
              style={{ transitionDelay: `${idx * 60}ms` }}
              className="group relative overflow-hidden border border-slate-200 bg-white/95 shadow-sm opacity-0 translate-y-2 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg"
            >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 group-hover:bg-indigo-100">
                  {it.icon}
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white text-sm font-semibold text-indigo-600 shadow-sm sm:flex">
                  <span>{it.step}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg text-slate-900">{it.title}</CardTitle>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 sm:hidden">
                  <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500" aria-hidden="true" />
                  Schritt {it.step}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {it.description ? (
                <p className="text-sm text-slate-600">{it.description}</p>
              ) : null}
              {Array.isArray(it.bullets) && it.bullets.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {it.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full border border-indigo-100 bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500" aria-hidden="true" />
                      <span className="leading-snug text-slate-700">{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
            </Card>
          ))}
        </div>
      </RevealContainer>

      {footnote ? (
        <div className="mt-8 rounded-xl border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-700 shadow-sm">
          {footnote}
        </div>
      ) : null}
    </section>
  );
}

export default ProcessSteps;
