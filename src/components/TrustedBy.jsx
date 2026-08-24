const NAMES = ['Placeholder Co', 'HealthTech', 'Sonoma', 'Greenfield', 'Northline']

export default function TrustedBy() {
  return (
    <section className="bg-paper py-14">
      <div className="wrap">
        <div className="eyebrow mb-8 text-center text-ink-muted">
          Trusted by (placeholder)
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {NAMES.map((name) => (
            <span
              className="font-display text-lg font-semibold text-ink-muted/50"
              key={name}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
