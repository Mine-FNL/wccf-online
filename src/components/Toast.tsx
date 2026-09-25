/* eslint-disable react-refresh/only-export-components -- shared demo data + hooks intentionally co-located */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type ToastKind = 'info' | 'success' | 'gold' | 'danger'

export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

interface ToastContextValue {
  toast: (text: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

/** useToast() — fire-and-forget bottom-right mono toasts. */
export const useToast = () => useContext(ToastContext)

const KIND_STYLES: Record<ToastKind, string> = {
  info: 'border-line text-wccf-ink',
  success: 'border-[rgba(61,214,140,0.4)] text-wccf-live',
  gold: 'border-[rgba(232,184,75,0.45)] text-wccf-gold',
  danger: 'border-[rgba(255,77,79,0.45)] text-wccf-danger',
}

/**
 * Bottom-right toast stack — mono 12px, slide-up, auto-dismiss 3.2s.
 * Mount <ToastProvider> once (done in Layout).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setItems((xs) => [...xs.slice(-3), { id, kind, text }])
    window.setTimeout(
      () => setItems((xs) => xs.filter((x) => x.id !== id)),
      3200,
    )
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
          <AnimatePresence>
            {items.map((t) => (
              <motion.div
                key={t.id}
                layout="position"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={cn(
                  'pointer-events-auto rounded-btn border bg-panel px-3 py-2 shadow-modal',
                  'font-mono text-xs tnum',
                  KIND_STYLES[t.kind],
                )}
              >
                {t.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
