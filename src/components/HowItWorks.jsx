import { IconMic, IconSliders, IconWave, IconShield, IconDoc } from './icons.jsx'

const STEPS = [
  {
    num: 'IN',
    icon: IconMic,
    title: 'Speech comes in',
    body: 'Dysarthric or non-standard audio, uploaded or recorded live.',
  },
  {
    num: '01',
    icon: IconSliders,
    title: 'Recognize & correct',
    body: 'One model transcribes it, then reviews and corrects its own output.',
  },
  {
    num: '02',
    icon: IconWave,
    title: 'Score it',
    body: 'Every transcript is scored across seven accuracy and reliability metrics.',
  },
  {
    num: '03',
    icon: IconShield,
    title: 'Human review',
    body: 'A sample goes to a real listener, who confirms what was truly said.',
  },
  {
    num: 'OUT',
    icon: IconDoc,
    title: 'Model improves',
    body: 'Confirmed feedback — not raw model output — retrains the system.',
  },
]

export default function HowItWorks() {
  return (
    <section className="bg-paper py-20">
      <div className="wrap">
        <div className="eyebrow mb-3 text-signal-ink">Signal path</div>
        <h2 className="mb-14 text-center font-display text-[28px] font-semibold text-ink md:text-[34px]">
          How it works
        </h2>

        <div className="relative grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-5 md:gap-x-4">
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-6 hidden border-t border-dashed border-line md:block"
          />
          {STEPS.map((step) => (
            <div className="relative flex flex-col items-center text-center" key={step.num}>
              <span className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-mint text-signal-ink">
                <step.icon className="h-5 w-5" />
              </span>
              <h4 className="mb-1.5 font-display text-[15px] font-semibold text-ink">
                {step.title}
              </h4>
              <p className="mb-2 text-[13px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                {step.num}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
