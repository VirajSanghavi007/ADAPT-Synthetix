const REASONS = [
  {
    title: 'Built for the speech others ignore',
    body: "Most ASR systems are trained on clear, typical speech and simply fail on dysarthric or non-standard voices. We built specifically for the voices that get left out.",
  },
  {
    title: 'Nothing hidden in the correction',
    body: 'You can see why the model changed a word — confidence, error type, and alternatives are all visible, not buried in a black box.',
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
    <section className="wrap pb-[100px]">
      <div className="grid grid-cols-1 gap-8 border-t border-line pt-10 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
        <div>
          <p className="font-serif text-[21px] font-normal leading-[1.45] text-text md:text-[26px]">
            Every day, voice assistants, call centers, and dictation tools
            mishear millions of people simply because their speech doesn't
            match what these systems were trained on. That isn't a small bug
            — it's a wall between real people and the technology everyone
            else takes for granted.
          </p>
        </div>
        <ul className="flex list-none flex-col gap-7">
          {REASONS.map((reason) => (
            <li
              className="border-l-2 border-line pl-5 transition-colors duration-250 ease-out-quart hover:border-signal"
              key={reason.title}
            >
              <h4 className="mb-1.5 font-display text-[17px] font-semibold text-text">
                {reason.title}
              </h4>
              <p className="text-[14.5px] leading-relaxed text-text-muted">
                {reason.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
