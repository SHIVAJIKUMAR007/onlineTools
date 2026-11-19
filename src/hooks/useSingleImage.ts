import { useEffect, useState } from 'react'
import { useFileUpload, type UploadedFile } from './useFileUpload'
import { useObjectUrl } from './useObjectUrl'
import { prepareInput } from '@/lib/image/client'

export interface SingleImage {
  upload: UploadedFile
  width: number
  height: number
  /** A blob the browser can always display (SVG and HEIC are rasterized). */
  displayBlob: Blob
}

/** Loads one image, reads its size and exposes a displayable preview. */
export function useSingleImage(accept: string[]) {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept, multiple: false })
  const [image, setImage] = useState<SingleImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decoding, setDecoding] = useState(false)
  const upload = files[0]

  useEffect(() => {
    let cancelled = false
    setImage(null)
    setError(null)
    if (!upload) return
    setDecoding(true)
    ;(async () => {
      try {
        const displayBlob = await prepareInput(upload.file)
        const bmp = await createImageBitmap(displayBlob)
        const dims = { width: bmp.width, height: bmp.height }
        bmp.close()
        if (!cancelled) setImage({ upload, ...dims, displayBlob })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : 'This image could not be opened. It may be damaged.')
      } finally {
        if (!cancelled) setDecoding(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [upload])

  const previewUrl = useObjectUrl(image?.displayBlob)
  return { image, previewUrl, error, rejected, loading: loading || decoding, load: addFiles, reset: clear }
}
