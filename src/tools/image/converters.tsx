import { ImageBatchTool } from '@/components/tools/ImageBatchTool'

const IMG = ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp']
const IMG_ANY = [...IMG, 'image/avif', 'image/gif', 'image/bmp', '.avif', '.gif', '.bmp']

export function ImageCompressor() {
  return <ImageBatchTool mode="compress" accept={IMG} defaultQuality={75} dropHint="JPG, PNG, WebP · several files at once · stays on your device" />
}

export function PngToJpg() {
  return <ImageBatchTool mode="convert" accept={['image/png', '.png']} formats={['jpeg']} defaultQuality={90} />
}

export function JpgToPng() {
  return <ImageBatchTool mode="convert" accept={['image/jpeg', '.jpg', '.jpeg']} formats={['png']} hideQualityFor={['png']} />
}

export function PngToWebp() {
  return <ImageBatchTool mode="convert" accept={['image/png', '.png']} formats={['webp']} defaultQuality={85} />
}

export function JpgToWebp() {
  return <ImageBatchTool mode="convert" accept={['image/jpeg', '.jpg', '.jpeg']} formats={['webp']} defaultQuality={80} />
}

export function WebpToPng() {
  return <ImageBatchTool mode="convert" accept={['image/webp', '.webp']} formats={['png']} hideQualityFor={['png']} />
}

export function WebpToJpg() {
  return <ImageBatchTool mode="convert" accept={['image/webp', '.webp']} formats={['jpeg']} defaultQuality={90} />
}

export function ImageConverter() {
  return <ImageBatchTool mode="convert" accept={IMG_ANY} formats={['jpeg', 'png', 'webp', 'avif']} defaultFormat="webp" defaultQuality={80} hideQualityFor={['png']} />
}

export function HeicToJpg() {
  return (
    <ImageBatchTool
      mode="convert"
      accept={['image/heic', 'image/heif', '.heic', '.heif']}
      formats={['jpeg', 'png']}
      defaultQuality={90}
      hideQualityFor={['png']}
      dropHint="HEIC, HEIF · several files at once · the decoder loads on first use"
    />
  )
}
