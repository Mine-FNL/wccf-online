import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** max width utility, e.g. "max-w-md" */
  widthClass?: string
  className?: string
}

/**
 * Centered modal — bg-panel, 10px radius, blurred dark backdrop,
 * entrance scale 0.96 → 1 + fade 200ms (design.md §6).
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-md',
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ backgroundColor: 'rgba(4,6,10,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'w-full rounded-panel border border-line bg-panel shadow-modal',
              widthClass,
              className,
            )}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {title !== undefined && (
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-wccf-ink">
                  {title}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-btn p-1 text-wccf-mute transition-colors hover:bg-raised hover:text-wccf-ink"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
