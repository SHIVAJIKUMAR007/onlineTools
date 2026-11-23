import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, Search, X } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { categories } from '@/data/categories'
import { toolPath, primaryToolsInCategory } from '@/data/tools'
import { SITE_NAME } from '@/data/pages'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink', className)} aria-label={`${SITE_NAME} home`}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
        <path d="M9 17.2 14 22l9-12" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {SITE_NAME}
    </Link>
  )
}

const topLinks = [
  { to: '/tools', label: 'All tools' },
  { to: '/image-tools', label: 'Image Tools' },
  { to: '/pdf-tools', label: 'PDF Tools' },
  { to: '/converters', label: 'Converters' },
  { to: '/developer-tools', label: 'Developer Tools' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const location = useLocation()
  const toolsRef = useRef<HTMLDivElement>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    setMenuOpen(false)
    setToolsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!toolsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setToolsOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsOpen])

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2', isActive ? 'text-accent' : 'text-ink-2')

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Logo className="mr-3" />

        <div className="hidden items-center lg:flex">
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              aria-expanded={toolsOpen}
              aria-haspopup="true"
              onClick={() => setToolsOpen((o) => !o)}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
            >
              Tools <ChevronDown className={cn('size-4 transition-transform', toolsOpen && 'rotate-180')} aria-hidden />
            </button>
            {toolsOpen && (
              <div className="absolute left-0 top-full mt-2 w-[44rem] rounded-2xl border border-line bg-paper p-5 shadow-lift">
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                  {categories.map((c) => (
                    <div key={c.id}>
                      <Link to={`/${c.slug}`} className="mb-2 flex items-center gap-2 text-sm font-semibold hover:text-accent">
                        <Icon name={c.icon} className="size-4 text-accent" /> {c.name}
                      </Link>
                      <ul className="space-y-0.5">
                        {primaryToolsInCategory(c.id).slice(0, 6).map((t) => (
                          <li key={t.id}>
                            <Link to={toolPath(t)} className="block rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-surface hover:text-ink">
                              {t.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="flex items-end">
                    <Link to="/tools" className="text-sm font-medium text-accent hover:underline">
                      See all tools
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          {topLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-paper px-3 text-sm text-muted transition-colors hover:border-ink/30 hover:text-ink"
            aria-label="Search tools"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-line px-1.5 text-xs md:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button
            type="button"
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg hover:bg-surface-2 lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-auto border-t border-line bg-paper px-4 pb-6 pt-3 lg:hidden">
          <Link to="/tools" className="block rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-surface-2">All tools</Link>
          {categories.map((c) => (
            <div key={c.id} className="mt-3">
              <Link to={`/${c.slug}`} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold">
                <Icon name={c.icon} className="size-4 text-accent" /> {c.name}
              </Link>
              <ul className="ml-9 border-l border-line">
                {primaryToolsInCategory(c.id).slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <Link to={toolPath(t)} className="block px-3 py-1.5 text-sm text-ink-2">{t.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link to="/blog" className="mt-3 block rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-surface-2">Blog</Link>
          <Link to="/about" className="mt-3 block rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-surface-2">About</Link>
        </div>
      )}
    </header>
  )
}
