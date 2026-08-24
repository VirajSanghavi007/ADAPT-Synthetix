const QUOTES = [
  {
    quote:
      'Placeholder testimonial — swap in a real quote from a pilot user once available.',
    name: 'Jasmine R.',
    role: 'Placeholder role',
  },
  {
    quote:
      'Placeholder testimonial — this is where accessibility feedback would go.',
    name: 'Aidan M.',
    role: 'Placeholder role',
  },
  {
    quote:
      'Placeholder testimonial — replace with a clinician or partner quote.',
    name: 'Kate H.',
    role: 'Placeholder role',
  },
]

export default function Testimonials() {
  return (
    <section className="bg-mint py-20">
      <div className="wrap">
        <div className="eyebrow mb-3 text-signal-ink">Testimonials</div>
        <h2 className="mb-12 max-w-lg font-display text-[28px] font-semibold text-ink md:text-[34px]">
          What people are saying
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {QUOTES.map((t) => (
            <figure
              className="rounded-card border border-line bg-paper p-7 shadow-card"
              key={t.name}
            >
              <blockquote className="mb-6 text-[15px] leading-relaxed text-ink">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-signal-soft font-display text-sm font-semibold text-signal-ink">
                  {t.name.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-ink-muted">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
