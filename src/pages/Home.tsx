import { Link } from 'react-router-dom'
import { ArrowRight, Cpu, Gift, Lock, UserX, WifiOff, Zap } from 'lucide-react'
import { HeroSearch } from '@/components/home/HeroSearch'
import { HeroDrop } from '@/components/home/HeroDrop'
import { ToolCard } from '@/components/tools/ToolCard'
import { FaqList } from '@/components/Content'
import { Icon } from '@/components/Icon'
import { buttonVariants } from '@/components/ui/button'
import { categories } from '@/data/categories'
import { homeFaqs } from '@/data/pages'
import { popularTools, toolPath, toolsInCategory, primaryToolsInCategory, tools } from '@/data/tools'
import { cn } from '@/lib/utils/cn'

const reasons = [
  { icon: Cpu, title: '100% browser-based', text: 'Files are decoded, edited and saved by code running in this tab.' },
  { icon: Lock, title: 'No file uploads', text: 'There is no server that receives your files. Check the Network tab yourself.' },
  { icon: Gift, title: 'Free to use', text: 'No limits per day, no watermarks, no premium tier.' },
  { icon: UserX, title: 'No registration', text: 'Open a tool and use it. There are no accounts to create.' },
  { icon: Zap, title: 'Fast processing', text: 'Your own CPU does the work. Heavy codecs run in WebAssembly off the main thread.' },
  { icon: WifiOff, title: 'Private by design', text: 'Tools keep working offline once loaded, because nothing depends on a server.' },
]

export default function Home() {
  const popular = popularTools()
  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-surface/70 to-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-20">
          <div>
            <h1 className="text-[clamp(2.4rem,6vw,4.1rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Every tool you need. Nothing uploaded.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              Free, powerful online tools that run entirely in your browser. Your files stay on your device.
            </p>
            <div className="mt-8 max-w-xl">
              <HeroSearch />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Popular tools">
              <span className="mr-1 text-sm text-muted">Popular:</span>
              {popular.slice(0, 6).map((t) => (
                <Link key={t.id} to={toolPath(t)} className="rounded-full border border-line-strong bg-paper px-3 py-1 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent">
                  {t.name}
                </Link>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/tools" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                Explore all tools <ArrowRight className="size-4" aria-hidden />
              </Link>
              <p className="max-w-xs text-sm text-muted">{tools.length} tools, all processed locally. No account needed.</p>
            </div>
          </div>
          <HeroDrop />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="popular-h">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="popular-h" className="text-2xl font-semibold sm:text-3xl">Popular tools</h2>
          <Link to="/tools" className="text-sm font-medium text-accent hover:underline">See all</Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((t) => (
            <li key={t.id}><ToolCard tool={t} /></li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="cats-h">
        <h2 id="cats-h" className="mb-8 text-2xl font-semibold sm:text-3xl">Browse by category</h2>
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const list = toolsInCategory(c.id)
            return (
              <div key={c.id}>
                <Link to={`/${c.slug}`} className="group flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent text-white">
                    <Icon name={c.icon} className="size-5" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold tracking-tight group-hover:text-accent">{c.name}</span>
                    <span className="block text-sm text-muted">{list.length} tools</span>
                  </span>
                </Link>
                <p className="mt-3 text-sm text-ink-2">{c.tagline}</p>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {primaryToolsInCategory(c.id).slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link to={toolPath(t)} className="flex items-center justify-between py-2 text-sm hover:text-accent">
                        {t.name}
                        <ArrowRight className="size-3.5 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to={`/${c.slug}`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">All {c.name.toLowerCase()}</Link>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="why-h">
        <div className="rounded-3xl bg-surface px-6 py-12 sm:px-12">
          <h2 id="why-h" className="max-w-xl text-2xl font-semibold sm:text-3xl">Why your files are safer here</h2>
          <p className="mt-3 max-w-2xl text-ink-2">Most online converters upload your file to a server. Stayput does the work on your device, so there is nothing to upload, store or leak.</p>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r) => (
              <li key={r.title} className="flex gap-3">
                <r.icon className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <h3 className="text-base font-semibold">{r.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl px-4 sm:px-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-6 text-2xl font-semibold sm:text-3xl">Questions people ask</h2>
        <FaqList faqs={homeFaqs} />
      </section>
    </>
  )
}
