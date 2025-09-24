import { Card, CardHeader, CardTitle } from "@/components/ui/card";

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
    <section aria-labelledby="process-heading" className={(className ? className + " " : "") + "mt-10 sm:mt-14"}>
      <h2 id="process-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {items.map((it, idx) => (
          <Card key={idx} className="group relative overflow-hidden transition-all duration-200">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  {it.icon}
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{it.step}</div>
              </div>
              <CardTitle className="mt-2 text-lg">{it.title}</CardTitle>
              {it.description ? (
                <p className="text-sm text-slate-600">{it.description}</p>
              ) : null}
              {Array.isArray(it.bullets) && it.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {it.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>
      {footnote ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700">
          {footnote}
        </div>
      ) : null}
    </section>
  );
}

export default ProcessSteps;
