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
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 sm:p-6">
          <h3 className="text-lg font-semibold">{leftTitle}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {leftItems.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-5 sm:p-6">
          <h3 className="text-lg font-semibold">{rightTitle}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {rightItems.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default MethodComparison;
