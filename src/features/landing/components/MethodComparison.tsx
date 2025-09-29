import RevealContainer from "@/components/RevealContainer";

export function MethodComparison({
  leftTitle = "Gesprächstherapie",
  rightTitle = "+ Körperorientierte Verfahren",
  leftItems = [],
  rightItems = [],
  className,
}: {
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
  className?: string;
}) {
  return (
    <section className={(className ? className + " " : "") + "mt-10 sm:mt-14"}>
      <RevealContainer>
        <div className="grid gap-6 sm:grid-cols-2">
          <div
            className="rounded-2xl border bg-white p-5 sm:p-6 opacity-0 translate-y-2 transition-all duration-500"
            data-reveal
            style={{ transitionDelay: '0ms' }}
          >
          <h3 className="text-lg font-semibold">{leftTitle}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {leftItems.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
          </div>
          <div
            className="rounded-2xl border bg-white p-5 sm:p-6 opacity-0 translate-y-2 transition-all duration-500"
            data-reveal
            style={{ transitionDelay: '60ms' }}
          >
          <h3 className="text-lg font-semibold">{rightTitle}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {rightItems.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

export default MethodComparison;
