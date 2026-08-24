import { IconLayers, IconShield, IconGlobe } from './icons.jsx'

const CARDS = [
  {
    icon: IconLayers,
    title: 'Hears what others miss',
    body: 'Built on a fine-tuned Canary‑Qwen model, it recognizes speech patterns that standard ASR systems consistently mis-transcribe or reject.',
  },
  {
    icon: IconShield,
    title: 'Corrects itself, in the open',
    body: 'A built-in correction layer checks its own confidence and error patterns before committing to a final transcript — no black box.',
  },
  {
    icon: IconGlobe,
    title: 'Improves under supervision',
    body: 'Real people compare candidate transcripts against the original audio. Only their preferences retrain the model — it never learns from its own guesses alone.',
  },
]

export default function WhatItDoes() {
  return (
    <section id="features" className="bg-mint py-20">
      <div className="wrap">
        <div className="eyebrow mb-3 text-signal-ink">Key benefits</div>
        <h2 className="mb-12 max-w-lg font-display text-[28px] font-semibold text-ink md:text-[34px]">
          What it does
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((card) => (
            <div
              className="rounded-card border border-line bg-paper p-8 shadow-card transition-all duration-250 ease-out-quart hover:-translate-y-1 hover:shadow-pop"
              key={card.title}
            >
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
                <card.icon className="h-6 w-6" />
              </span>
              <h3 className="mb-2.5 font-display text-lg font-semibold text-ink">
                {card.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
