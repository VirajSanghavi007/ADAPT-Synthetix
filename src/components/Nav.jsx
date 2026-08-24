const LINKS = ['Features', 'Use Cases', 'Demo', 'Developers']

export default function Nav() {
  return (
    <div className="sticky top-0 z-20 border-b border-navy-line/0 bg-navy/85 backdrop-blur-md transition-colors duration-300">
      <nav className="wrap flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5 font-display text-base font-semibold text-paper">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/15 text-signal">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </span>
          ADAPT&#8211;Synthetix&nbsp;2.0
        </div>

        <ul className="hidden items-center gap-8 font-mono text-[12px] uppercase tracking-wider text-paper/70 md:flex">
          {LINKS.map((link) => (
            <li key={link}>
              <a
                className="transition-colors duration-200 hover:text-paper"
                href={`#${link.toLowerCase().replace(' ', '-')}`}
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        <a href="#demo" className="btn btn-primary">
          Get Started
        </a>
      </nav>
    </div>
  )
}
