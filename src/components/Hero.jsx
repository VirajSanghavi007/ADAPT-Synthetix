import Waveform from './Waveform.jsx'
import './Hero.css'

export default function Hero() {
  return (
    <section className="hero wrap">
      <Waveform />
      <div className="eyebrow">Speech recognition, retrained for real voices</div>
      <h1>
        Every voice,
        <br />
        <em>understood.</em>
      </h1>
      <p className="subhead">
        Most speech recognition fails the people who need it most.
        ADAPT&#8209;Synthetix listens to{' '}
        <strong>dysarthric and non-standard speech</strong>, corrects its own
        mistakes, and gets better every time a human confirms what was
        actually said.
      </p>
    </section>
  )
}
