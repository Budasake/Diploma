type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

/** The small label + title + description block reused by every section. */
export default function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-gradient text-sm font-semibold uppercase tracking-widest">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-lg text-muted">{description}</p>}
    </div>
  );
}
