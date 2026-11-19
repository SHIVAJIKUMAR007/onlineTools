import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type Loader = () => Promise<{ default: ComponentType }>

/**
 * Maps a tool id (see data/tools.ts) to its component. Every tool is lazy, and
 * tools in the same category share a chunk, so a visitor only downloads the code
 * for the tool they open.
 */
const named =
  <T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): Loader =>
  () =>
    load().then((m) => ({ default: m[key] as ComponentType }))

const loaders: Record<string, Loader> = {
  // image
  'image-compressor': named(() => import('./image/converters'), 'ImageCompressor'),
  'image-resizer': () => import('./image/ImageResizer'),
  'png-to-jpg': named(() => import('./image/converters'), 'PngToJpg'),
  'jpg-to-png': named(() => import('./image/converters'), 'JpgToPng'),
  'png-to-webp': named(() => import('./image/converters'), 'PngToWebp'),
  'jpg-to-webp': named(() => import('./image/converters'), 'JpgToWebp'),
  'webp-to-png': named(() => import('./image/converters'), 'WebpToPng'),
  'webp-to-jpg': named(() => import('./image/converters'), 'WebpToJpg'),
  'image-converter': named(() => import('./image/converters'), 'ImageConverter'),
  'heic-to-jpg': named(() => import('./image/converters'), 'HeicToJpg'),
  'image-cropper': () => import('./image/ImageCropper'),
  'image-rotator': () => import('./image/ImageRotator'),
  'image-to-base64': () => import('./image/ImageToBase64'),
  'svg-optimizer': () => import('./image/SvgOptimizer'),
  'image-metadata-viewer': () => import('./image/ImageMetadataViewer'),
  'background-remover': () => import('./image/BackgroundRemover'),
  // pdf
  'pdf-merger': () => import('./pdf/PdfMerger'),
  'pdf-splitter': () => import('./pdf/PdfSplitter'),
  'pdf-page-remover': () => import('./pdf/PdfPageRemover'),
  'pdf-page-rotator': () => import('./pdf/PdfPageRotator'),
  'pdf-to-images': () => import('./pdf/PdfToImages'),
  'images-to-pdf': () => import('./pdf/ImagesToPdf'),
  'pdf-metadata-viewer': () => import('./pdf/PdfMetadataViewer'),
  'pdf-compressor': () => import('./pdf/PdfCompressor'),
  // text
  'word-counter': named(() => import('./text/TextTools'), 'WordCounter'),
  'case-converter': named(() => import('./text/TextTools'), 'CaseConverter'),
  'remove-duplicate-lines': named(() => import('./text/TextTools'), 'DuplicateLines'),
  'text-diff-checker': named(() => import('./text/TextTools'), 'TextDiff'),
  'lorem-ipsum-generator': named(() => import('./text/TextTools'), 'LoremIpsum'),
  'text-reverser': named(() => import('./text/TextTools'), 'TextReverser'),
  // developer
  'json-formatter': named(() => import('./developer/DevTools'), 'JsonFormatter'),
  'json-to-csv': named(() => import('./developer/DevTools'), 'JsonToCsv'),
  'base64-encoder-decoder': named(() => import('./developer/DevTools'), 'Base64Tool'),
  'url-encoder-decoder': named(() => import('./developer/DevTools'), 'UrlTool'),
  'uuid-generator': named(() => import('./developer/DevTools'), 'UuidGenerator'),
  'hash-generator': named(() => import('./developer/DevTools'), 'HashGenerator'),
  'css-minifier': named(() => import('./developer/DevTools'), 'CssMinifier'),
  'html-entity-encoder-decoder': named(() => import('./developer/DevTools'), 'HtmlEntities'),
  'jwt-decoder': named(() => import('./developer/DevTools'), 'JwtDecoder'),
  'color-converter': named(() => import('./developer/DevTools'), 'ColorConverter'),
  'password-generator': named(() => import('./developer/DevUtilities'), 'PasswordGenerator'),
  'regex-tester': named(() => import('./developer/DevUtilities'), 'RegexTester'),
  'unix-timestamp-converter': named(() => import('./developer/DevUtilities'), 'TimestampConverter'),
  'hex-binary-ascii-converter': named(() => import('./developer/DevUtilities'), 'BaseConverter'),
  // more text
  'sort-lines': named(() => import('./text/TextUtilities'), 'SortLines'),
  'find-and-replace': named(() => import('./text/TextUtilities'), 'FindReplace'),
  'text-to-slug': named(() => import('./text/TextUtilities'), 'TextToSlug'),
  'remove-extra-spaces': named(() => import('./text/TextUtilities'), 'CleanWhitespace'),
  // more converters
  'morse-code-translator': named(() => import('./converters/CodeConverters'), 'MorseConverter'),
  'roman-numeral-converter': named(() => import('./converters/CodeConverters'), 'RomanNumerals'),
}

const cache = new Map<string, LazyExoticComponent<ComponentType>>()

export function toolComponent(id: string): LazyExoticComponent<ComponentType> | null {
  const loader = loaders[id]
  if (!loader) return null
  let c = cache.get(id)
  if (!c) {
    c = lazy(loader)
    cache.set(id, c)
  }
  return c
}

export const implementedToolIds = Object.keys(loaders)
