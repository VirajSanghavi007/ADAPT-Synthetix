import Waveform from './Waveform.jsx'

export default function Hero() {
  return (
    <section className="wrap relative py-16 pb-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-signal/10 blur-[120px]"
      />
      <Waveform />
      <div className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-signal">
        Speech recognition, retrained for real voices
      </div>
      <h1 className="mx-auto mb-6 max-w-3xl font-display text-[clamp(48px,8vw,92px)] font-semibold leading-[1.04] tracking-[-0.02em] text-text">
        Every voice,
        <br />
        <em className="font-serif font-normal not-italic italic text-signal">
          understood.
        </em>
      </h1>
      <p className="mx-auto max-w-xl text-lg font-normal text-text-muted">
        Most speech recognition fails the people who need it most.
        ADAPT&#8209;Synthetix listens to{' '}
        <strong className="font-medium text-text">
          dysarthric and non-standard speech
        </strong>
        , corrects its own mistakes, and gets better every time a human
        confirms what was actually said.
      </p>
    </section>
  )
}
