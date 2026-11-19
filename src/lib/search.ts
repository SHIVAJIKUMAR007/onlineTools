import { tools, type ToolMeta } from '@/data/tools'
import { categoryById } from '@/data/categories'

export interface SearchHit {
  tool: ToolMeta
  score: number
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** True when every character of `q` appears in `text` in order. Tolerates typos like "pdf mrge". */
function subsequence(q: string, text: string): boolean {
  let i = 0
  for (const ch of text) if (ch === q[i] && ++i === q.length) return true
  return q.length === 0
}

/**
 * Score tools against a query. Name matches outrank keyword matches, which
 * outrank description and category matches. Every query word must match somewhere.
 */
export function searchTools(query: string, list: ToolMeta[] = tools): SearchHit[] {
  const q = norm(query).trim()
  if (!q) return []
  const words = q.split(/\s+/).filter(Boolean)
  const hits: SearchHit[] = []
  for (const tool of list) {
    const name = norm(tool.name)
    const slug = tool.slug.replace(/-/g, ' ')
    const keywords = tool.keywords.map(norm)
    const desc = norm(tool.description)
    const cat = norm(categoryById(tool.category).name)
    let total = 0
    let allMatched = true
    for (const w of words) {
      let s = 0
      if (name === w) s = 100
      else if (name.startsWith(w)) s = 80
      else if (name.split(/\W+/).some((n) => n.startsWith(w))) s = 70
      else if (name.includes(w) || slug.includes(w)) s = 55
      else if (keywords.some((k) => k === w)) s = 50
      else if (keywords.some((k) => k.includes(w))) s = 40
      else if (desc.includes(w)) s = 25
      else if (cat.includes(w)) s = 20
      else if (w.length >= 3 && subsequence(w, name)) s = 10
      if (s === 0) {
        allMatched = false
        break
      }
      total += s
    }
    if (allMatched) hits.push({ tool, score: total + (tool.popular ? 3 : 0) })
  }
  return hits.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
}
