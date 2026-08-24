export default function Nav() {
  return (
    <div className="sticky top-0 z-20 border-b border-line/0 bg-bg/70 backdrop-blur-md transition-colors duration-300">
      <nav className="wrap flex items-center justify-between py-7">
        <div className="flex items-center gap-2.5 font-mono text-sm tracking-wide text-text">
          <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_0_4px_var(--color-signal-soft)]" />
          ADAPT&#8211;SYNTHETIX&nbsp;2.0
        </div>
        <div className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors duration-200 ease-out-quart hover:border-signal hover:text-text">
          Research Build
        </div>
      </nav>
    </div>
  )
}
