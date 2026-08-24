const COLUMNS = [
  { heading: 'Product', links: ['Features', 'Use Cases', 'Demo', 'Pricing'] },
  { heading: 'Company', links: ['About', 'Careers', 'Privacy Policy'] },
  { heading: 'Developers', links: ['Docs', 'API Access', 'Status'] },
]

export default function Footer() {
  return (
    <footer id="developers" className="bg-navy pt-16 text-paper/70">
      <div className="wrap grid grid-cols-1 gap-12 pb-12 sm:grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1.3fr]">
        <div>
          <div className="mb-3 font-display text-base font-semibold text-paper">
            ADAPT&#8211;Synthetix&nbsp;2.0
          </div>
          <p className="max-w-xs text-sm leading-relaxed">
            Speech recognition retrained for dysarthric and non-standard
            voices. Research build &middot; presentation draft.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <div className="eyebrow mb-4 text-paper/40">{col.heading}</div>
            <ul className="flex flex-col gap-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link}>
                  <a
                    className="transition-colors duration-200 hover:text-paper"
                    href="#"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <div className="eyebrow mb-4 text-paper/40">Stay in the loop</div>
          <form
            className="flex gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-full border border-navy-line bg-navy2 px-4 py-2.5 text-sm text-paper placeholder:text-paper/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-signal"
            />
            <button type="submit" className="btn btn-primary shrink-0 !px-5">
              Send
            </button>
          </form>
        </div>
      </div>

      <div className="wrap flex flex-wrap items-center justify-between gap-4 border-t border-navy-line py-6 font-mono text-[13px]">
        <div>&copy; 2026 ADAPT&#8211;Synthetix &mdash; built for accessible speech recognition.</div>
        <div>Team build &middot; presentation draft</div>
      </div>
    </footer>
  )
}
