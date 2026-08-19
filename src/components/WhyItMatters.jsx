import './WhyItMatters.css'

const REASONS = [
  {
    title: 'Built for the speech others ignore',
    body: "Most ASR systems are trained on clear, typical speech and simply fail on dysarthric or non-standard voices. We built specifically for the voices that get left out.",
  },
  {
    title: 'Nothing hidden in the correction',
    body: 'You can see why the model changed a word \u2014 confidence, error type, and alternatives are all visible, not buried in a black box.',
  },
  {
    title: 'Grounded in real human judgment',
    body: 'The system only improves when a person confirms it against the real audio, so it earns accuracy instead of guessing its way there.',
  },
  {
    title: 'Measured honestly, not marketed',
    body: 'Every transcript is scored on multiple independent metrics, so progress is something you can verify, not just claim.',
  },
]

export default function WhyItMatters() {
  return (
    <section className="why wrap">
      <div className="section-label">Why it matters</div>
      <div className="why-grid">
        <div className="why-lead">
          <p>
            Every day, voice assistants, call centers, and dictation tools
            mishear millions of people simply because their speech doesn't
            match what these systems were trained on. That isn't a small bug
            &mdash; it's a wall between real people and the technology
            everyone else takes for granted.
          </p>
        </div>
        <ul className="why-list">
          {REASONS.map((reason) => (
            <li key={reason.title}>
              <h4>{reason.title}</h4>
              <p>{reason.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
