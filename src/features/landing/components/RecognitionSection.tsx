import CheckList from "@/components/CheckList";

export function RecognitionSection({
  heading = "Woran du dich wiedererkennst",
  items,
  className,
}: {
  heading?: string;
  items: string[];
  className?: string;
}) {
  return (
    <section aria-labelledby="recognition-heading" className={(className ? className + " " : "") + "mt-10 sm:mt-14"}>
      <h2 id="recognition-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-5">
        <CheckList items={items} />
      </div>
    </section>
  );
}

export default RecognitionSection;
