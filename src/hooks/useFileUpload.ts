import { useCallback, useEffect, useRef, useState } from 'react'
import { sanitizeFilename } from '@/lib/utils/filename'
import { extMatchesAccept, sniffFile, typeMatchesAccept, type SniffedType } from '@/lib/utils/sniff'
import { useApp } from '@/lib/store'

export interface UploadedFile {
  id: string
  file: File
  /** Name safe for display and for use in downloads. */
  name: string
  size: number
  /** Type detected from the file's bytes. */
  sniffed: SniffedType
}

export interface RejectedFile {
  name: string
  reason: string
}

export interface UseFileUploadOptions {
  accept?: string[]
  multiple?: boolean
  /** Reject files above this size in MB. */
  maxSizeMB?: number
  /** Pick up files handed over from the homepage drop zone. */
  usePending?: boolean
}

let counter = 0
const nextId = () => `f${++counter}-${Math.random().toString(36).slice(2, 7)}`

export async function validateFile(file: File, accept: string[] | undefined, maxSizeMB: number): Promise<UploadedFile | RejectedFile> {
  const name = sanitizeFilename(file.name)
  if (file.size === 0) return { name, reason: 'The file is empty.' }
  if (file.size > maxSizeMB * 1024 * 1024) return { name, reason: `The file is larger than ${maxSizeMB} MB.` }
  const sniffed = await sniffFile(file).catch((): SniffedType => 'unknown')
  if (accept && accept.length) {
    const byContent = sniffed !== 'unknown' && typeMatchesAccept(sniffed, accept)
    // Text-based formats cannot be sniffed reliably, so fall back to the extension when the bytes are inconclusive.
    // Binary formats always have recognizable bytes, so only text formats may fall back to the extension.
    const textual = accept.some((a) => a === 'image/svg+xml' || a.startsWith('text/') || a === 'application/json')
    const byExt = sniffed === 'unknown' && (accept.includes('*/*') || (textual && extMatchesAccept(name, accept)))
    if (!byContent && !byExt) {
      const wanted = accept
        .filter((a) => a.startsWith('.'))
        .map((a) => a.slice(1).toUpperCase())
        .filter((v, i, arr) => arr.indexOf(v) === i)
      const label = wanted.length ? wanted.slice(0, 6).join(', ') : 'a supported file'
      return {
        name,
        reason:
          sniffed !== 'unknown' && !extMatchesAccept(name, accept)
            ? `Not a supported file. Expected ${label}.`
            : `This file's contents do not match its name. Expected ${label}.`,
      }
    }
  }
  return { id: nextId(), file, name, size: file.size, sniffed }
}

const isRejected = (x: UploadedFile | RejectedFile): x is RejectedFile => 'reason' in x

export function useFileUpload({ accept, multiple = false, maxSizeMB = 500, usePending = true }: UseFileUploadOptions = {}) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [rejected, setRejected] = useState<RejectedFile[]>([])
  const [loading, setLoading] = useState(false)
  const acceptRef = useRef(accept)
  acceptRef.current = accept

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming)
      if (list.length === 0) return
      setLoading(true)
      const candidates = multiple ? list : list.slice(0, 1)
      const results = await Promise.all(candidates.map((f) => validateFile(f, acceptRef.current, maxSizeMB)))
      const ok = results.filter((r): r is UploadedFile => !isRejected(r))
      const bad = results.filter(isRejected)
      if (!multiple && list.length > 1) bad.push({ name: `${list.length - 1} more file(s)`, reason: 'This tool works on one file at a time. Only the first was used.' })
      setRejected(bad)
      setFiles((prev) => (multiple ? [...prev, ...ok] : ok.length ? ok : prev))
      setLoading(false)
    },
    [multiple, maxSizeMB],
  )

  const remove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), [])
  const clear = useCallback(() => {
    setFiles([])
    setRejected([])
  }, [])
  const move = useCallback((from: number, to: number) => {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const takePending = useApp((s) => s.takePendingFiles)
  useEffect(() => {
    if (!usePending) return
    const pending = takePending()
    if (pending.length) void addFiles(pending)
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { files, rejected, loading, addFiles, remove, clear, move, dismissRejected: () => setRejected([]) }
}
