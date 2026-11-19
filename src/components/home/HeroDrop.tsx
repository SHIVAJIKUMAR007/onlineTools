import { useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileUp } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { toolPath, type ToolMeta } from '@/data/tools'
import { suggestToolsForFile } from '@/lib/suggest'
import { useApp } from '@/lib/store'
import { sanitizeFilename } from '@/lib/utils/filename'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

/**
 * Drop any file on the homepage and see which tools can handle it. The file
 * is only read in this tab; picking a tool hands it over in memory.
 */
export function HeroDrop() {
  const id = useId()
  const [over, setOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [matches, setMatches] = useState<ToolMeta[] | null>(null)
  const depth = useRef(0)
  const navigate = useNavigate()
  const setPending = useApp((s) => s.setPendingFiles)

  const accept = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setMatches(null)
    setMatches(await suggestToolsForFile(f))
  }

  const open = (t: ToolMeta) => {
    if (file) setPending([file])
    navigate(toolPath(t))
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-3 shadow-lift sm:p-4">
      <label
        htmlFor={id}
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current++
          setOver(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (!depth.current) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          void accept(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-9 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
          over ? 'border-accent bg-accent-tint' : 'border-line-strong bg-surface/60 hover:border-accent/60',
        )}
      >
        <FileUp className="size-6 text-accent" aria-hidden />
        <span className="text-[15px] font-medium">Drop a file to see what you can do with it</span>
        <span className="text-sm text-muted">Images, PDFs, JSON. It stays in this tab.</span>
        <input id={id} type="file" className="sr-only" onChange={(e) => { void accept(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      </label>

      <div aria-live="polite" className="min-h-[3.5rem] px-1 pt-3">
        {file && (
          <p className="mb-2 truncate text-sm text-ink-2">
            <span className="font-medium">{sanitizeFilename(file.name)}</span> <span className="tabular text-muted">· {formatBytes(file.size)}</span>
          </p>
        )}
        {matches && matches.length > 0 && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {matches.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => open(t)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left text-sm font-medium transition-colors hover:border-accent/60 hover:bg-accent-tint">
                  <Icon name={t.icon} className="size-4 shrink-0 text-accent" />
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {matches && matches.length === 0 && (
          <p className="text-sm text-ink-2">
            No tool opens this file type yet. <Link className="font-medium text-accent hover:underline" to="/tools">Browse all tools</Link>
          </p>
        )}
        {!file && <p className="text-xs text-muted">Nothing is sent anywhere. Dropping a file only reads its first bytes to detect its type.</p>}
      </div>
    </div>
  )
}
