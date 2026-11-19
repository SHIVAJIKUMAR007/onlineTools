import { useCallback, useEffect, useRef, useState } from 'react'
import { AbortedError, processImage, disposeImageWorker } from '@/lib/image/client'
import type { ProcessOptions, ProcessResult } from '@/lib/image/types'
import type { UploadedFile } from './useFileUpload'

export interface BatchItem {
  id: string
  upload: UploadedFile
  status: 'queued' | 'processing' | 'done' | 'error'
  result?: ProcessResult & { url: string }
  error?: string
  ms?: number
}

/**
 * Runs the image pipeline over a list of files, one at a time, and keeps
 * object URLs tidy. Results are tied to the options used to make them.
 */
export function useImageBatch() {
  const [items, setItems] = useState<BatchItem[]>([])
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const urlsRef = useRef<Set<string>>(new Set())
  const runIdRef = useRef(0)
  const itemsRef = useRef<BatchItem[]>(items)
  itemsRef.current = items

  const revoke = (url?: string) => {
    if (url && urlsRef.current.has(url)) {
      URL.revokeObjectURL(url)
      urlsRef.current.delete(url)
    }
  }

  const setUploads = useCallback((uploads: UploadedFile[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]))
      const next: BatchItem[] = uploads.map((u) => byId.get(u.id) ?? { id: u.id, upload: u, status: 'queued' })
      for (const p of prev) if (!uploads.some((u) => u.id === p.id)) revoke(p.result?.url)
      return next
    })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    runIdRef.current++
    setRunning(false)
  }, [])

  const run = useCallback(
    async (optionsFor: (item: BatchItem) => ProcessOptions, only?: string[]) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const runId = ++runIdRef.current
      setRunning(true)
      // Callers invoke run() from effects, after the render that committed `items`.
      const targets = itemsRef.current.filter((i) => !only || only.includes(i.id))
      setItems((prev) =>
        prev.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, status: 'queued', error: undefined } : i)),
      )
      for (const target of targets) {
        if (controller.signal.aborted || runIdRef.current !== runId) break
        setItems((prev) => prev.map((i) => (i.id === target.id ? { ...i, status: 'processing' } : i)))
        const started = performance.now()
        try {
          const r = await processImage(target.upload.file, optionsFor(target), controller.signal)
          if (controller.signal.aborted || runIdRef.current !== runId) break
          const url = URL.createObjectURL(r.blob)
          urlsRef.current.add(url)
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== target.id) return i
              revoke(i.result?.url)
              return { ...i, status: 'done', result: { ...r, url }, error: undefined, ms: performance.now() - started }
            }),
          )
        } catch (e) {
          if (e instanceof AbortedError) break
          const message = e instanceof Error ? e.message : 'Something went wrong.'
          setItems((prev) => prev.map((i) => (i.id === target.id ? { ...i, status: 'error', error: message } : i)))
        }
      }
      if (runIdRef.current === runId) setRunning(false)
    },
    [],
  )

  const reset = useCallback(() => {
    cancel()
    setItems((prev) => {
      prev.forEach((p) => revoke(p.result?.url))
      return []
    })
  }, [cancel])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlsRef.current.clear()
      disposeImageWorker()
    },
    [],
  )

  return { items, running, setUploads, run, cancel, reset }
}
