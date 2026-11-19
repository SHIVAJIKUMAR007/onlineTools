import { saveAs } from 'file-saver'
import { uniqueName } from './filename'

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  saveAs(new Blob([text], { type: mime }), filename)
}

export interface ZipEntry {
  name: string
  blob: Blob
}

/** JSZip is loaded on demand so it never weighs down pages that do not zip. */
export async function zipBlobs(entries: ZipEntry[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const used = new Set<string>()
  for (const e of entries) zip.file(uniqueName(e.name, used), e.blob)
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export async function downloadZip(entries: ZipEntry[], zipName: string) {
  downloadBlob(await zipBlobs(entries), zipName)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
