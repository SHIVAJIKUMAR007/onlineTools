import { tools, type ToolMeta } from '@/data/tools'
import { extMatchesAccept, sniffFile, typeMatchesAccept } from '@/lib/utils/sniff'

const priority = ['image-compressor', 'pdf-merger', 'background-remover', 'image-resizer', 'pdf-compressor', 'image-converter']

/** Tools that can take this file, judged by its real contents and then its extension. */
export async function suggestToolsForFile(file: File): Promise<ToolMeta[]> {
  const sniffed = await sniffFile(file).catch(() => 'unknown' as const)
  const name = file.name.toLowerCase()
  const matches = tools.filter((t) => {
    if (!t.accept || t.accept.includes('*/*')) return false
    if (sniffed !== 'unknown') return typeMatchesAccept(sniffed, t.accept)
    return extMatchesAccept(name, t.accept)
  })
  if (name.endsWith('.json')) matches.push(...tools.filter((t) => t.id === 'json-formatter' || t.id === 'json-to-csv'))
  if (name.endsWith('.css')) matches.push(...tools.filter((t) => t.id === 'css-minifier'))
  const rank = (t: ToolMeta) => {
    const i = priority.indexOf(t.id)
    return i === -1 ? 99 : i
  }
  return [...new Map(matches.map((t) => [t.id, t])).values()].sort((a, b) => rank(a) - rank(b))
}
