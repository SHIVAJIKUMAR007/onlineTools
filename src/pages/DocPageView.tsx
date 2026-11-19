import { Breadcrumbs } from '@/components/Content'
import type { DocPage } from '@/data/pages'

export default function DocPageView({ page }: { page: DocPage }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ name: page.title }]} />
      <h1 className="text-3xl font-semibold sm:text-4xl">{page.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">{page.lead}</p>
      {page.updated && <p className="mt-2 text-sm text-muted">Last updated {page.updated}</p>}
      <div className="mt-10 space-y-10">
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            <div className="prose-plain mt-3 text-[15px] leading-relaxed text-ink-2">
              {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              {s.list && (
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {s.list.map((l) => <li key={l}>{l}</li>)}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
