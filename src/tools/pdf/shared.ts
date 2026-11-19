import { useFileUpload } from '@/hooks/useFileUpload'

export { PDF_ACCEPT } from '@/hooks/usePdf'
import { PDF_ACCEPT } from '@/hooks/usePdf'

/** Single-PDF upload without opening it in PDF.js (for tools that only need the bytes). */
export function useFileUploadSingle() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: PDF_ACCEPT, multiple: false })
  return { upload: files[0], rejected, loading, load: addFiles, reset: clear }
}
