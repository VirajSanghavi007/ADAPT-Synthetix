export default function LiveDemo() {
  return (
    <section id="demo" className="bg-paper py-20">
      <div className="wrap">
        <div className="eyebrow mb-3 text-signal-ink">Live demo</div>
        <h2 className="mb-3 max-w-lg font-display text-[28px] font-semibold text-ink md:text-[34px]">
          Experience the difference
        </h2>
        <p className="mb-10 max-w-lg text-[15px] leading-relaxed text-ink-muted">
          Placeholder mockup — wire this panel up to the real transcription
          endpoint when it's ready.
        </p>

        <div className="grid grid-cols-1 gap-6 rounded-card border border-line bg-mint p-8 shadow-card md:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[12px] border border-line bg-paper p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow text-ink-muted">Real-time transcription</span>
              <button
                type="button"
                disabled
                className="btn btn-primary cursor-not-allowed opacity-70"
              >
                Start recording
              </button>
            </div>
            <div className="mb-4 h-20 rounded-[10px] border border-dashed border-line bg-mint/60" />
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-ink-muted">
                Accuracy score
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full w-4/5 rounded-full bg-signal" />
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-line bg-paper p-6">
            <span className="eyebrow mb-4 block text-ink-muted">Speech type</span>
            <ul className="flex flex-col gap-3 text-sm text-ink">
              {['Dysarthric', 'Strong accent', 'Typical'].map((label, i) => (
                <li className="flex items-center gap-2.5" key={label}>
                  <span
                    className={`h-3.5 w-3.5 rounded-full border ${i === 0 ? 'border-signal bg-signal' : 'border-line'}`}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
