// Prints title and description lengths for every public page. Run: npx tsx scripts/seo-report.ts
import { allPublicPaths, seoForPath } from '../src/lib/seo.ts'

const rows = allPublicPaths().map((p) => {
  const s = seoForPath(p, 'https://stayput.example')!
  return { path: p, title: s.title.length, desc: s.description.length, t: s.title }
})
const longTitles = rows.filter((r) => r.title > 60)
const longDesc = rows.filter((r) => r.desc > 160)
console.log(`${rows.length} pages. Titles over 60 chars: ${longTitles.length}. Descriptions over 160 chars: ${longDesc.length}.`)
for (const r of longTitles) console.log(`  title ${r.title}: ${r.path}  "${r.t}"`)
for (const r of longDesc) console.log(`  desc ${r.desc}: ${r.path}`)
