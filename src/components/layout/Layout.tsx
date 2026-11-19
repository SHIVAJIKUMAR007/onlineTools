import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { SearchPalette } from '@/components/tools/ToolSearch'
import { Seo } from '@/components/Seo'
import { Spinner } from '@/components/ui/misc'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted" role="status">
      <Spinner /> Loading…
    </div>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Seo />
      <ScrollToTop />
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <SearchPalette />
    </div>
  )
}
