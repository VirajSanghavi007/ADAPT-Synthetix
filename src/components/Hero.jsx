import Waveform from './Waveform.jsx'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy pb-20 pt-14 text-paper md:pb-28 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 -z-0 h-[520px] w-[520px] rounded-full bg-signal/10 blur-[120px]"
      />

      <div className="wrap relative grid grid-cols-1 items-center gap-14 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="eyebrow mb-5 text-signal">
            Speech recognition, retrained for real voices
          </div>
          <h1 className="mb-6 max-w-xl font-display text-[clamp(36px,5.4vw,56px)] font-semibold leading-[1.08] tracking-[-0.02em] text-paper">
            Every voice, understood
            <span className="text-signal">.</span>
          </h1>
          <p className="mb-9 max-w-lg text-[17px] leading-relaxed text-paper/70">
            Most speech recognition fails the people who need it most.
            ADAPT&#8209;Synthetix listens to{' '}
            <strong className="font-medium text-paper">
              dysarthric and non-standard speech
            </strong>
            , corrects its own mistakes, and gets better every time a human
            confirms what was actually said.
          </p>

          <div className="flex flex-wrap gap-4">
            <a href="#demo" className="btn btn-primary">
              Try Live Demo
            </a>
            <a href="#developers" className="btn btn-outline">
              Request API Access
            </a>
          </div>
        </div>

        <div className="relative rounded-card border border-navy-line bg-navy2/60 p-8 shadow-pop backdrop-blur-sm">
          <div className="eyebrow mb-6 text-paper/50">Signal preview</div>
          <Waveform />
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-paper/40">
            <span>Listening</span>
            <span className="text-signal">Correcting</span>
            <span>Confirmed</span>
          </div>
        </div>
      </div>
    </section>
  )
}
