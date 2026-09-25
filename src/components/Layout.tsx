import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import Navbar from './Navbar'
import Footer from './Footer'
import { ToastProvider } from './Toast'

/**
 * App shell — children pattern: `<Layout><Routes>…</Routes></Layout>`.
 * Navbar is sticky (normal flow), so no page needs offset bookkeeping.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation()

  /* scroll to top on route change; honor #hash anchors */
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <ToastProvider>
      <div className="flex min-h-[100dvh] flex-col bg-base">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ToastProvider>
  )
}
