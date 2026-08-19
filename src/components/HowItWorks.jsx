import './HowItWorks.css'

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
    body: 'Confirmed feedback \u2014 not raw model output \u2014 retrains the system.',
  },
]

export default function HowItWorks() {
  return (
    <section className="how wrap">
      <div className="section-label">How it works</div>
      <div className="flow-track">
        <div className="track-label">Signal path</div>
        <div className="flow">
          {STEPS.map((step) => (
            <div className="flow-step" key={step.num}>
              <div className="flow-num">{step.num}</div>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
