import { Link } from 'react-router'

const COLUMNS: { title: string; links: { to: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'Play',
    links: [
      { to: '/', label: 'Lobby' },
      { to: '/club', label: 'My Club' },
      { to: '/scouting', label: 'Scouting' },
      { to: '/clubs', label: 'Clubs' },
    ],
  },
  {
    title: 'Community',
    links: [
      { to: '/hall-of-fame', label: 'Hall of Fame' },
      { to: '/events', label: 'Events' },
      { to: '/theatre', label: 'Theatre' },
      { to: '/circle', label: "Champion's Circle" },
    ],
  },
  {
    title: 'Elsewhere',
    links: [
      { to: 'https://discord.com', label: 'Discord', external: true },
      { to: 'https://buymeacoffee.com', label: 'Support (Buy me a coffee)', external: true },
    ],
  },
]

/** Global footer — hairline top, wordmark, link columns, legal line. */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 min-[768px]:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo-badge.svg" alt="WCCF" className="h-7 w-7 rounded-md" />
            <span className="font-display text-lg font-bold uppercase tracking-[0.08em] text-wccf-ink">
              WCCF <span className="text-accent">Online</span>
            </span>
          </div>
          <p className="mt-3 text-[13px] italic text-wccf-dim">
            "Pick a seat at the cabinet."
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-wccf-mute">
              {col.title}
            </div>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.to}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-wccf-dim transition-colors hover:text-wccf-ink"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      className="text-[13px] text-wccf-dim transition-colors hover:text-wccf-ink"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-shell px-4 py-4 font-mono text-[11px] text-wccf-mute">
          Fan project. Not affiliated with SEGA or Panini.
        </div>
      </div>
    </footer>
  )
}
