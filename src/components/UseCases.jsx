import { IconHand, IconHeart, IconCap, IconBriefcase } from './icons.jsx'

const CASES = [
  {
    icon: IconHand,
    title: 'Assistive tech',
    body: 'Voice control for mobility and communication devices. Placeholder copy — replace with real deployment details.',
  },
  {
    icon: IconHeart,
    title: 'Healthcare',
    body: 'Telehealth communication support for patients with speech disorders. Placeholder copy.',
  },
  {
    icon: IconCap,
    title: 'Education',
    body: 'Inclusive learning tools for students with non-standard speech. Placeholder copy.',
  },
  {
    icon: IconBriefcase,
    title: 'Business',
    body: 'Accessible, efficient transcription for teams and meetings. Placeholder copy.',
  },
]

export default function UseCases() {
  return (
    <section id="use-cases" className="bg-mint py-20">
      <div className="wrap">
        <div className="eyebrow mb-3 text-signal-ink">Use cases</div>
        <h2 className="mb-12 max-w-lg font-display text-[28px] font-semibold text-ink md:text-[34px]">
          Where it fits
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CASES.map((item) => (
            <div
              className="rounded-card border border-line bg-paper p-7 shadow-card transition-all duration-250 ease-out-quart hover:-translate-y-1 hover:shadow-pop"
              key={item.title}
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mb-2 font-display text-base font-semibold text-ink">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
