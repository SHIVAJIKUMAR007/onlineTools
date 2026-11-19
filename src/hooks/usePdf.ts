import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useFileUpload, type UploadedFile } from './useFileUpload'

export const PDF_ACCEPT = ['application/pdf', '.pdf']

function destroyDoc(doc: PDFDocumentProxy | null) {
  void doc?.loadingTask.destroy().catch(() => undefined)
}

export interface LoadedPdf {
  upload: UploadedFile
  bytes: Uint8Array
  pageCount: number
  doc: PDFDocumentProxy
}

/** Loads a single PDF: reads its bytes and opens it with PDF.js for previews and page counts. */
export function usePdf() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: PDF_ACCEPT, multiple: false })
  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const upload = files[0]

  useEffect(() => {
    let cancelled = false
    destroyDoc(docRef.current)
    docRef.current = null
    setPdf(null)
    setError(null)
    if (!upload) return
    setOpening(true)
    ;(async () => {
      try {
        const { openPdf } = await import('@/lib/pdf/render')
        const bytes = new Uint8Array(await upload.file.arrayBuffer())
        const doc = await openPdf(bytes)
        if (cancelled) {
          destroyDoc(doc)
          return
        }
        docRef.current = doc
        setPdf({ upload, bytes, pageCount: doc.numPages, doc })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'This PDF could not be opened.')
      } finally {
        if (!cancelled) setOpening(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [upload])

  useEffect(
    () => () => {
      destroyDoc(docRef.current)
    },
    [],
  )

  return { pdf, error, rejected, loading: loading || opening, load: addFiles, reset: clear }
}
