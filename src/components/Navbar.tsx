import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, CircleHelp, LogOut, Menu, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import HelpModal from './HelpModal'

const NAV_LINKS = [
  { to: '/', label: 'Play' },
  { to: '/club', label: 'My Club' },
  { to: '/scouting', label: 'Scouting', caret: true },
  { to: '/clubs', label: 'Clubs' },
  { to: '/hall-of-fame', label: 'Hall of Fame' },
  { to: '/events', label: 'Events' },
  { to: '/theatre', label: 'Theatre', star: true },
  { to: '/#live', label: 'Watch Live', live: true },
]

function NavItem({
  to,
  label,
  caret,
  star,
  live,
  onClick,
  mobile,
}: {
  to: string
  label: string
  caret?: boolean
  star?: boolean
  live?: boolean
  onClick?: () => void
  mobile?: boolean
}) {
  const location = useLocation()
  const isHash = to.includes('#')
  const path = to.split('#')[0]
  const active = !isHash && location.pathname === path

  const inner = (
    <>
      {live && (
        <span className="relative mr-1 flex h-[6px] w-[6px]">
          <span className="absolute h-full w-full rounded-full bg-wccf-danger animate-pulse-halo" />
          <span className="relative h-[6px] w-[6px] rounded-full bg-wccf-danger animate-pulse-dot" />
        </span>
      )}
      {label}
      {star && <Star size={10} className="ml-0.5 inline text-wccf-gold" fill="currentColor" />}
      {caret && <ChevronDown size={11} className="ml-0.5 inline" />}
    </>
  )

  const cls = cn(
    'flex items-center font-sans font-semibold uppercase transition-colors duration-150',
    mobile ? 'px-2 py-2 text-[16px]' : 'text-[13px] tracking-[0.02em]',
    active ? 'text-wccf-ink' : 'text-wccf-dim hover:text-wccf-ink',
  )

  const handle = (e: React.MouseEvent) => {
    if (isHash) {
      const id = to.split('#')[1]
      if (location.pathname === path || path === '/') {
        const el = document.getElementById(id)
        if (el) {
          e.preventDefault()
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          history.replaceState(null, '', to)
        }
      }
    }
    onClick?.()
  }

  return isHash ? (
    <Link to={to} className={cls} onClick={handle}>
      {inner}
    </Link>
  ) : (
    <NavLink to={to} className={cls} onClick={handle}>
      {inner}
    </NavLink>
  )
}

/**
 * Account area: skeleton while the session loads, Sign in when logged out,
 * user chip (name/avatar + club short name) + logout when authenticated.
 */
function AuthSlot() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const clubQuery = trpc.club.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
  const club = clubQuery.data?.club

  if (isLoading) {
    return <span className="h-6 w-20 animate-pulse rounded-full bg-raised" aria-label="Loading account" />
  }

  if (!isAuthenticated || !user) {
    return (
      <Link
        to={LOGIN_PATH}
        className="rounded-btn bg-accent px-3.5 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
      >
        Sign in
      </Link>
    )
  }

  const avatarSrc = user.avatar || `/avatar-${(Math.abs(Number(user.id)) % 8) + 1}.png`
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-raised py-1 pl-1 pr-2.5">
        <img src={avatarSrc} alt="" className="h-6 w-6 rounded-full border border-line object-cover" />
        <span className="max-w-[110px] truncate text-[12px] font-semibold text-wccf-ink">
          {user.name ?? 'Manager'}
        </span>
        {club?.shortName && (
          <span className="rounded bg-accent-dim px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase text-accent">
            {club.shortName}
          </span>
        )}
      </span>
      <button
        aria-label="Sign out"
        title="Sign out"
        onClick={() => logout()}
        className="rounded-btn border border-line p-2 text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
      >
        <LogOut size={14} />
      </button>
    </span>
  )
}

/**
 * Global navbar — 56px sticky, bg-panel + hairline, backdrop blur.
 * Contains the Help modal trigger and the useAuth()-wired account area.
 */
export default function Navbar() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  /* close the mobile drawer on navigation (derived during render) */
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-shell items-center gap-4 px-4">
          {/* brand */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-badge.svg" alt="WCCF" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-xl font-bold uppercase tracking-[0.04em] text-wccf-ink">
              WCCF <span className="text-accent">Online</span>
            </span>
          </Link>

          {/* center links */}
          <nav className="mx-auto hidden items-center gap-4 min-[1150px]:flex">
            {NAV_LINKS.map((l) => (
              <NavItem key={l.label} {...l} />
            ))}
          </nav>

          {/* right side */}
          <div className="ml-auto flex items-center gap-2 min-[1150px]:ml-0">
            <Link
              to="/circle"
              className="hidden items-center gap-1.5 rounded-full border border-wccf-gold/60 px-3 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-wccf-gold transition-colors hover:bg-[rgba(232,184,75,0.1)] min-[900px]:flex"
            >
              <img src="/circle-emblem.svg" alt="" className="h-3.5 w-3.5" />
              Champion's Circle
            </Link>
            <button
              aria-label="Help — cabinet controls"
              onClick={() => setHelpOpen(true)}
              className="rounded-btn border border-line p-2 text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
            >
              <CircleHelp size={15} />
            </button>
            {/* AUTH-SLOT: wired to useAuth() */}
            <AuthSlot />
            <button
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-btn border border-line p-2 text-wccf-dim hover:text-wccf-ink min-[1150px]:hidden"
            >
              {menuOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-14 z-40 flex flex-col gap-1 border-t border-line bg-base/97 px-4 py-4 backdrop-blur min-[1150px]:hidden"
          >
            {NAV_LINKS.map((l, i) => (
              <motion.div
                key={l.label}
                initial={{ x: -12, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.04 * i, duration: 0.25, ease: 'easeOut' }}
              >
                <NavItem {...l} mobile onClick={() => setMenuOpen(false)} />
              </motion.div>
            ))}
            <motion.div
              initial={{ x: -12, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.04 * NAV_LINKS.length, duration: 0.25 }}
              className="mt-2"
            >
              <Link
                to="/circle"
                onClick={() => setMenuOpen(false)}
                className="flex w-fit items-center gap-1.5 rounded-full border border-wccf-gold/60 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-wccf-gold"
              >
                <img src="/circle-emblem.svg" alt="" className="h-3.5 w-3.5" />
                Champion's Circle
              </Link>
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
