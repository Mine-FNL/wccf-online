import { Link } from 'react-router'
import { motion } from 'framer-motion'

/** Shared placeholder panel for sub-pages under construction. */
export default function ComingSoon({
  title,
  blurb,
}: {
  title: string
  blurb: string
}) {
  return (
    <div className="mx-auto flex max-w-shell items-center justify-center px-4 py-24">
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-lg rounded-panel border border-line bg-panel p-8 text-center"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-accent" />
        <h1 className="font-display text-3xl font-bold uppercase tracking-[0.04em] text-wccf-ink">
          {title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-wccf-dim">{blurb}</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-wccf-mute">
          Coming soon
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-btn border border-line px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
        >
          ← Back to the lobby
        </Link>
      </motion.div>
    </div>
  )
}
