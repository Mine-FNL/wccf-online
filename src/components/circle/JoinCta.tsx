import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'
import { useAuth } from '@/hooks/useAuth'

/**
 * Auth-aware Join CTA. Signed out → gold pill linking to sign-in.
 * Signed in → disabled "coming with Season 2" state (no payments exist).
 */
export default function JoinCta({ large = false }: { large?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth()

  const size = large ? 'px-8 py-3.5 text-[15px]' : 'px-6 py-2.5 text-[13px]'

  if (isLoading) {
    return <span className={cn('inline-block animate-pulse rounded-full bg-raised', size)} aria-label="Loading" />
  }

  if (!isAuthenticated) {
    return (
      <Link
        to={LOGIN_PATH}
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-wccf-gold font-sans font-bold uppercase tracking-[0.06em] text-[#0B0E14]',
          'transition-all duration-150 hover:scale-[1.03] hover:bg-[#F5CC6E]',
          size,
        )}
      >
        Sign in
      </Link>
    )
  }

  return (
    <button
      disabled
      title="Circle membership arrives with Season 2"
      className={cn(
        'inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-[rgba(232,184,75,0.45)] bg-[rgba(232,184,75,0.08)]',
        'font-sans font-bold uppercase tracking-[0.06em] text-wccf-gold/70',
        size,
      )}
    >
      <Lock size={14} />
      Circle membership — coming with Season 2
    </button>
  )
}
