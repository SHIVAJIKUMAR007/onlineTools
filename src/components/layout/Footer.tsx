import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Logo } from './Navbar'
import { categories } from '@/data/categories'
import { popularTools, toolPath } from '@/data/tools'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-ink-2">Free tools that run in your browser, so your files stay on your device.</p>
          <p className="flex max-w-xs items-start gap-2 text-sm text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            No uploads, no accounts and no tracking. The only download is the AI model for the background remover, and it does not include your files.
          </p>
        </div>
        <nav aria-label="Categories">
          <h2 className="mb-3 text-sm font-semibold">Categories</h2>
          <ul className="space-y-2 text-sm text-ink-2">
            {categories.map((c) => (
              <li key={c.id}><Link className="hover:text-accent" to={`/${c.slug}`}>{c.name}</Link></li>
            ))}
            <li><Link className="hover:text-accent" to="/tools">All tools</Link></li>
          </ul>
        </nav>
        <nav aria-label="Popular tools">
          <h2 className="mb-3 text-sm font-semibold">Popular tools</h2>
          <ul className="space-y-2 text-sm text-ink-2">
            {popularTools().slice(0, 6).map((t) => (
              <li key={t.id}><Link className="hover:text-accent" to={toolPath(t)}>{t.name}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company and legal">
          <h2 className="mb-3 text-sm font-semibold">About</h2>
          <ul className="space-y-2 text-sm text-ink-2">
            <li><Link className="hover:text-accent" to="/about">About Stayput</Link></li>
            <li><Link className="hover:text-accent" to="/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-accent" to="/terms">Terms of service</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">© {new Date().getFullYear()} Stayput. Your files never leave your device.</p>
      </div>
    </footer>
  )
}
