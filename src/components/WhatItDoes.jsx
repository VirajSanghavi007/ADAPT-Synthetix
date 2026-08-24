const CARDS = [
  {
    index: '01',
    title: 'Hears what others miss',
    body: 'Built on a fine-tuned Canary‑Qwen model, it recognizes speech patterns that standard ASR systems consistently mis-transcribe or reject.',
  },
  {
    index: '02',
    title: 'Corrects itself, in the open',
    body: 'A built-in correction layer checks its own confidence and error patterns before committing to a final transcript — no black box.',
  },
  {
    index: '03',
    title: 'Improves under supervision',
    body: 'Real people compare candidate transcripts against the original audio. Only their preferences retrain the model — it never learns from its own guesses alone.',
  },
]

export default function WhatItDoes() {
  return (
    <section className="wrap py-10 pb-24">
      <div className="section-label">What it does</div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
        {CARDS.map((card) => (
          <div
            className="bg-surface2 p-9 px-7 transition-all duration-250 ease-out-quart hover:-translate-y-0.5 hover:bg-surface"
            key={card.index}
          >
            <span className="mb-5 block font-mono text-xs text-signal">
              {card.index}
            </span>
            <h3 className="mb-3 font-display text-[22px] font-semibold text-text">
              {card.title}
            </h3>
            <p className="text-[15px] leading-relaxed text-text-muted">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
