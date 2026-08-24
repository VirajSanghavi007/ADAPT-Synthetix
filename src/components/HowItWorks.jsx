const STEPS = [
  {
    num: 'IN',
    title: 'Speech comes in',
    body: 'Dysarthric or non-standard audio, uploaded or recorded live.',
  },
  {
    num: '01',
    title: 'Recognize & correct',
    body: 'One model transcribes it, then reviews and corrects its own output.',
  },
  {
    num: '02',
    title: 'Score it',
    body: 'Every transcript is scored across seven accuracy and reliability metrics.',
  },
  {
    num: '03',
    title: 'Human review',
    body: 'A sample goes to a real listener, who confirms what was truly said.',
  },
  {
    num: 'OUT',
    title: 'Model improves',
    body: 'Confirmed feedback — not raw model output — retrains the system.',
  },
]

export default function HowItWorks() {
  return (
    <section className="wrap py-10 pb-[100px]">
      <div className="section-label">How it works</div>
      <div className="rounded-card border border-line bg-surface2 shadow-card">
        <div className="px-6 pt-4 font-mono text-[11px] tracking-wider text-signal">
          Signal path
        </div>
        <div className="flex items-stretch gap-0 overflow-x-auto pb-2 max-md:flex-col">
          {STEPS.map((step, i) => (
            <div
              className="relative min-w-[210px] flex-1 rounded-[10px] p-7 px-6 transition-colors duration-250 ease-out-quart hover:bg-surface"
              key={step.num}
            >
              <div className="mb-3.5 font-mono text-[11px] tracking-wider text-text-muted">
                {step.num}
              </div>
              <h4 className="mb-2 font-display text-base font-semibold text-text">
                {step.title}
              </h4>
              <p className="text-[13.5px] leading-relaxed text-text-muted">
                {step.body}
              </p>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-[-4px] top-1/2 z-10 -translate-y-1/2 text-lg text-noise max-md:bottom-[-14px] max-md:right-6 max-md:top-auto max-md:translate-y-0"
                >
                  <span className="max-md:hidden">&#8594;</span>
                  <span className="hidden max-md:inline">&#8595;</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
