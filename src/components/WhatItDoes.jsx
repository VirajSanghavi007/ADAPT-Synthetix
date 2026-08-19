import './WhatItDoes.css'

const CARDS = [
  {
    index: '01',
    title: 'Hears what others miss',
    body: 'Built on a fine-tuned Canary\u2011Qwen model, it recognizes speech patterns that standard ASR systems consistently mis-transcribe or reject.',
  },
  {
    index: '02',
    title: 'Corrects itself, in the open',
    body: 'A built-in correction layer checks its own confidence and error patterns before committing to a final transcript \u2014 no black box.',
  },
  {
    index: '03',
    title: 'Improves under supervision',
    body: 'Real people compare candidate transcripts against the original audio. Only their preferences retrain the model \u2014 it never learns from its own guesses alone.',
  },
]

export default function WhatItDoes() {
  return (
    <section className="what wrap">
      <div className="section-label">What it does</div>
      <div className="cards">
        {CARDS.map((card) => (
          <div className="card" key={card.index}>
            <span className="card-index">{card.index}</span>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
