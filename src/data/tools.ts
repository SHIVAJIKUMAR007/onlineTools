import type { CategoryId } from './categories'

export interface Faq {
  q: string
  a: string
}

export interface ToolMeta {
  id: string
  slug: string
  name: string
  /** One line shown on cards and in search. */
  description: string
  category: CategoryId
  /** Extra categories the tool is also listed under. */
  alsoIn?: CategoryId[]
  /** lucide-react icon name. */
  icon: string
  keywords: string[]
  popular?: boolean
  /** File types the tool accepts. Mime types and/or extensions. */
  accept?: string[]
  /** Text tools have no file input. */
  kind: 'file' | 'text'
  seoTitle: string
  seoDescription: string
  h1: string
  intro: string
  steps: string[]
  features: string[]
  faqs: Faq[]
  related: string[]
}

type ToolInput = Omit<ToolMeta, 'slug' | 'kind' | 'h1'> & {
  slug?: string
  h1?: string
}

const t = (x: ToolInput): ToolMeta => ({
  ...x,
  slug: x.slug ?? x.id,
  kind: x.accept ? 'file' : 'text',
  h1: x.h1 ?? x.name,
})

const IMG = ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp']
const IMG_ANY = [...IMG, 'image/avif', 'image/gif', 'image/bmp', '.avif', '.gif', '.bmp']

export const tools: ToolMeta[] = [
  // ───────────── Image ─────────────
  t({
    id: 'image-compressor',
    name: 'Image Compressor',
    description: 'Shrink JPG, PNG and WebP files and compare before and after.',
    category: 'image',
    icon: 'Minimize2',
    keywords: ['compress', 'reduce size', 'optimize', 'tinypng', 'shrink', 'jpg', 'png', 'webp'],
    popular: true,
    accept: IMG,
    seoTitle: 'Image Compressor: Shrink JPG, PNG, WebP Online',
    seoDescription:
      'Compress JPG, PNG and WebP images in your browser with a quality slider and a before/after view. Files are never uploaded.',
    intro:
      'Drop in photos or graphics and pick a quality level. The compressor re-encodes each image on your device with MozJPEG, WebP and OxiPNG codecs, then shows the exact size before and after. If a file cannot get smaller, it tells you instead of pretending.',
    steps: [
      'Add one or more JPG, PNG or WebP images.',
      'Move the quality slider. JPG and WebP are lossy; PNG is optimized without losing pixels.',
      'Check the before and after preview, then download each image or all of them as a ZIP.',
    ],
    features: [
      'MozJPEG, WebP and OxiPNG codecs compiled to WebAssembly',
      'Real byte counts and savings for every file',
      'Batch compression with ZIP download',
      'Runs in a Web Worker so the page stays responsive',
    ],
    faqs: [
      {
        q: 'Why did my PNG barely shrink?',
        a: 'PNG is lossless, so the tool only removes redundant data and does not change pixels. Photos saved as PNG compress far better as JPG or WebP.',
      },
      {
        q: 'Are my images uploaded?',
        a: 'No. Compression happens in your browser with WebAssembly. You can disconnect from the internet after the page loads and it still works.',
      },
    ],
    related: ['image-resizer', 'jpg-to-webp', 'png-to-webp', 'image-converter'],
  }),
  t({
    id: 'image-resizer',
    name: 'Image Resizer',
    description: 'Resize by pixels or percent, with presets and aspect ratio lock.',
    category: 'image',
    icon: 'Scaling',
    keywords: ['resize', 'scale', 'dimensions', 'width', 'height', 'thumbnail', 'social media'],
    popular: true,
    accept: IMG_ANY,
    seoTitle: 'Image Resizer: Resize by Pixels or Percent',
    seoDescription:
      'Resize images to exact dimensions or a percentage, with aspect ratio lock and social media presets. Runs in your browser; nothing is uploaded.',
    intro:
      'Set a new width and height, scale by percentage, or choose a preset for common social and web sizes. Downscaling uses a multi-step filter so edges stay sharp.',
    steps: [
      'Add an image.',
      'Enter a width and height, pick a percentage, or choose a preset.',
      'Download the resized image as JPG, PNG or WebP.',
    ],
    features: [
      'Aspect ratio lock',
      'Pixel and percentage modes',
      'Presets for Instagram, YouTube, Open Graph, favicons and more',
      'High-quality stepped downscaling',
    ],
    faqs: [
      {
        q: 'Does enlarging an image make it sharper?',
        a: 'No. Upscaling adds pixels but not detail, so large enlargements look soft. Resize down whenever you can.',
      },
      {
        q: 'Is there a size limit?',
        a: 'Browsers cap canvas size. On most devices that is around 16,000 pixels per side, and less on phones. The tool warns you if you go past a safe size.',
      },
    ],
    related: ['image-compressor', 'image-cropper', 'image-rotator', 'image-converter'],
  }),
  t({
    id: 'png-to-jpg',
    name: 'PNG to JPG',
    description: 'Convert PNG images to JPG with a background color for transparency.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['png', 'jpg', 'jpeg', 'convert', 'transparent background'],
    popular: true,
    accept: ['image/png', '.png'],
    seoTitle: 'PNG to JPG Converter: Free, Private, Batch',
    seoDescription:
      'Convert PNG to JPG online with a custom background for transparent areas and adjustable quality. Batch conversion in your browser.',
    intro:
      'JPG has no transparency, so transparent areas need a fill color. Pick white, black, or any color, set the quality, and convert as many PNG files as you like.',
    steps: ['Add PNG files.', 'Choose the background color and quality.', 'Download each JPG or a ZIP of all of them.'],
    features: ['Background color for transparent pixels', 'Quality control', 'Batch conversion', 'No upload'],
    faqs: [
      {
        q: 'What happens to transparent areas?',
        a: 'They are filled with the background color you choose, because JPG cannot store transparency.',
      },
      {
        q: 'Will quality drop?',
        a: 'JPG is lossy. At 90% quality and above the difference is hard to see for most images.',
      },
    ],
    related: ['jpg-to-png', 'png-to-webp', 'image-converter', 'image-compressor'],
  }),
  t({
    id: 'jpg-to-png',
    name: 'JPG to PNG',
    description: 'Convert JPG images to lossless PNG in bulk.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['jpg', 'jpeg', 'png', 'convert', 'lossless'],
    accept: ['image/jpeg', '.jpg', '.jpeg'],
    seoTitle: 'JPG to PNG Converter: Free Batch Conversion',
    seoDescription: 'Convert JPG and JPEG files to PNG online. Batch processing, no upload, no sign-up.',
    intro:
      'Convert JPEG photos to PNG when an app requires it or you want to edit without further JPEG compression. The PNG will be larger, and it will not restore detail the JPG already lost.',
    steps: ['Add JPG files.', 'Click Convert.', 'Download the PNG files or a ZIP.'],
    features: ['Batch conversion', 'Lossless output', 'ZIP download', 'No upload'],
    faqs: [
      {
        q: 'Why is the PNG so much larger?',
        a: 'PNG stores every pixel without lossy compression. Photos produce big PNG files.',
      },
      {
        q: 'Does converting to PNG improve quality?',
        a: 'No. It stops further loss, but detail that JPG already discarded cannot come back.',
      },
    ],
    related: ['png-to-jpg', 'webp-to-png', 'image-converter', 'image-compressor'],
  }),
  t({
    id: 'png-to-webp',
    name: 'PNG to WebP',
    description: 'Convert PNG to WebP and keep transparency at a smaller size.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['png', 'webp', 'convert', 'transparency', 'web performance'],
    accept: ['image/png', '.png'],
    seoTitle: 'PNG to WebP: Smaller Files, Transparency Kept',
    seoDescription:
      'Convert PNG to WebP in your browser. Keep transparency, tune quality, and convert in batches without uploading files.',
    intro:
      'WebP usually produces much smaller files than PNG and supports transparency. Choose lossy quality or lossless mode, and see the saving for every file.',
    steps: ['Add PNG files.', 'Pick quality, or switch on lossless.', 'Download the WebP files.'],
    features: ['Transparency preserved', 'Lossy and lossless modes', 'Real size comparison', 'Batch + ZIP'],
    faqs: [
      { q: 'Is WebP supported everywhere?', a: 'All current major browsers display WebP. Some older desktop software does not open it.' },
      { q: 'Should I use lossless?', a: 'Lossless keeps every pixel and gives modest savings. Lossy at 80 to 90 is far smaller and looks the same for most images.' },
    ],
    related: ['jpg-to-webp', 'webp-to-png', 'image-compressor', 'image-converter'],
  }),
  t({
    id: 'jpg-to-webp',
    name: 'JPG to WebP',
    description: 'Convert JPG to WebP and preview the file size saving.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['jpg', 'jpeg', 'webp', 'convert', 'compress'],
    popular: true,
    accept: ['image/jpeg', '.jpg', '.jpeg'],
    seoTitle: 'JPG to WebP Converter: Cut File Size, No Upload',
    seoDescription: 'Convert JPG to WebP online with a quality slider and a size comparison for every file. Runs entirely in your browser.',
    intro:
      'Switching photos from JPG to WebP typically saves a quarter to a third of the file size at similar visual quality. Each result shows the original size, new size and percentage saved.',
    steps: ['Add JPG files.', 'Set the quality.', 'Review the savings and download.'],
    features: ['Quality slider', 'Size comparison per file', 'Batch conversion', 'No upload'],
    faqs: [
      { q: 'Will my image look worse?', a: 'At quality 80 or higher the difference is rarely visible. The size comparison helps you find a good trade-off.' },
      { q: 'Can I convert many photos at once?', a: 'Yes. Add as many as your device memory allows and download them together as a ZIP.' },
    ],
    related: ['png-to-webp', 'webp-to-jpg', 'image-compressor', 'image-converter'],
  }),
  t({
    id: 'webp-to-png',
    name: 'WebP to PNG',
    description: 'Decode WebP files and save them as PNG.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['webp', 'png', 'convert', 'decode'],
    accept: ['image/webp', '.webp'],
    seoTitle: 'WebP to PNG Converter: Free and Private',
    seoDescription: 'Convert WebP images to PNG in your browser. Transparency is kept. Batch processing, no upload.',
    intro: 'Open WebP files in software that does not support them by converting to PNG. Transparency is preserved.',
    steps: ['Add WebP files.', 'Click Convert.', 'Download PNG files or a ZIP.'],
    features: ['Transparency preserved', 'Batch conversion', 'ZIP download', 'No upload'],
    faqs: [
      { q: 'Does it work with animated WebP?', a: 'Only the first frame is converted. Animated output is not supported.' },
      { q: 'Is anything lost?', a: 'A lossless WebP converts exactly. A lossy WebP keeps the artifacts it already has.' },
    ],
    related: ['webp-to-jpg', 'png-to-webp', 'image-converter', 'jpg-to-png'],
  }),
  t({
    id: 'webp-to-jpg',
    name: 'WebP to JPG',
    description: 'Convert WebP to JPG with a background color and quality control.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'FileImage',
    keywords: ['webp', 'jpg', 'jpeg', 'convert'],
    accept: ['image/webp', '.webp'],
    seoTitle: 'WebP to JPG Converter: Pick Quality and Background',
    seoDescription: 'Convert WebP to JPG online. Choose a background color for transparent areas and set quality. Private and free.',
    intro: 'Turn WebP images into widely supported JPG files. Transparent areas are filled with the color you choose.',
    steps: ['Add WebP files.', 'Choose quality and background color.', 'Download JPG files or a ZIP.'],
    features: ['Background color', 'Quality control', 'Batch conversion', 'No upload'],
    faqs: [
      { q: 'Why is there a background color option?', a: 'JPG cannot store transparency, so transparent pixels need a solid color.' },
      { q: 'What quality should I use?', a: '85 to 92 is a good range for photos. Go higher only if you plan to edit the file again.' },
    ],
    related: ['webp-to-png', 'jpg-to-webp', 'image-converter', 'png-to-jpg'],
  }),
  t({
    id: 'image-cropper',
    name: 'Image Cropper',
    description: 'Crop with a draggable frame, aspect ratio presets and rotation.',
    category: 'image',
    icon: 'Crop',
    keywords: ['crop', 'cut', 'trim', 'aspect ratio', 'square', 'rotate'],
    accept: IMG_ANY,
    seoTitle: 'Image Cropper: Crop Photos with Aspect Ratios',
    seoDescription: 'Crop images with a freeform or fixed-ratio frame, rotate, and download. Everything runs in your browser.',
    intro:
      'Drag the frame, pull the handles, or type exact values. Lock an aspect ratio like 1:1, 4:3 or 16:9, or crop freely. You can also rotate the image first.',
    steps: ['Add an image.', 'Choose a ratio and drag the crop frame.', 'Download the cropped image.'],
    features: ['Freeform and fixed ratios', 'Pixel-exact numeric inputs', 'Rotate before cropping', 'Export as PNG, JPG or WebP'],
    faqs: [
      { q: 'Does cropping reduce quality?', a: 'The pixels inside the frame are copied as they are. Quality only changes if you export to a lossy format.' },
      { q: 'Can I use the keyboard?', a: 'Yes. Use the numeric fields for exact positions, or focus the frame and use the arrow keys.' },
    ],
    related: ['image-resizer', 'image-rotator', 'image-compressor', 'background-remover'],
  }),
  t({
    id: 'image-rotator',
    name: 'Image Rotator & Flipper',
    description: 'Rotate by 90° steps and flip horizontally or vertically.',
    category: 'image',
    icon: 'RotateCw',
    keywords: ['rotate', 'flip', 'mirror', '90 degrees', 'orientation'],
    accept: IMG_ANY,
    seoTitle: 'Rotate and Flip Images: 90°, 180°, 270°',
    seoDescription: 'Rotate images by 90, 180 or 270 degrees and flip them horizontally or vertically. Private, free and instant.',
    intro: 'Fix sideways photos or mirror an image in one step. The preview updates as you click, and the download matches it.',
    steps: ['Add an image.', 'Use the rotate and flip buttons.', 'Download the result.'],
    features: ['90°, 180°, 270° rotation', 'Horizontal and vertical flip', 'Live preview', 'No upload'],
    faqs: [
      { q: 'Will rotating lower the quality?', a: 'Rotating by multiples of 90 degrees moves pixels without resampling. Only a lossy export format adds compression.' },
      { q: 'My photo is rotated wrongly after upload. Why?', a: 'Phones store orientation in EXIF. This tool applies it when loading, so what you see is what you download.' },
    ],
    related: ['image-cropper', 'image-resizer', 'image-converter', 'image-compressor'],
  }),
  t({
    id: 'image-to-base64',
    name: 'Image to Base64',
    description: 'Encode an image as a Base64 string or data URI.',
    category: 'image',
    alsoIn: ['developer', 'converters'],
    icon: 'Binary',
    keywords: ['base64', 'data uri', 'encode', 'inline image', 'css'],
    accept: [...IMG_ANY, 'image/svg+xml', '.svg'],
    seoTitle: 'Image to Base64 Converter: Data URI and Raw Base64',
    seoDescription: 'Convert an image to a Base64 string or a ready-to-use data URI. Copy it or download a text file. Runs in your browser.',
    intro:
      'Embed small images directly in CSS, HTML or JSON. Choose the full data URI, the raw Base64 string, a ready-made CSS background rule or an img tag.',
    steps: ['Add an image.', 'Choose the output format.', 'Copy the text or download it as a file.'],
    features: ['Data URI, raw Base64, CSS and HTML output', 'Copy to clipboard', 'Download as .txt', 'Shows the size overhead'],
    faqs: [
      { q: 'How much bigger is Base64?', a: 'About 33% larger than the binary file, so it suits small icons rather than photos.' },
      { q: 'Is the image uploaded?', a: 'No. The file is read with the browser FileReader API on your device.' },
    ],
    related: ['base64-encoder-decoder', 'svg-optimizer', 'image-compressor', 'image-metadata-viewer'],
  }),
  t({
    id: 'svg-optimizer',
    name: 'SVG Optimizer',
    description: 'Minify SVG files with SVGO and compare sizes.',
    category: 'image',
    icon: 'Shapes',
    keywords: ['svg', 'svgo', 'optimize', 'minify', 'vector'],
    accept: ['image/svg+xml', '.svg'],
    seoTitle: 'SVG Optimizer: Minify SVG Files with SVGO Online',
    seoDescription: 'Optimize and minify SVG files with SVGO in your browser. See the size saving and preview before downloading.',
    intro:
      'SVGO strips editor metadata, comments, hidden elements and extra precision from SVG files. Check the preview to confirm the artwork looks the same, then download.',
    steps: ['Add an SVG.', 'Adjust precision and options.', 'Compare, then download the optimized SVG.'],
    features: ['Powered by SVGO', 'Side by side preview', 'Configurable precision and viewBox handling', 'Copy or download'],
    faqs: [
      { q: 'Can optimizing break my SVG?', a: 'Rarely. If something looks off, turn off "Remove viewBox" or raise the precision and try again.' },
      { q: 'Is my SVG sanitized?', a: 'The preview is rendered as an image, so scripts do not run. The optimized file is not a security sanitizer, so do not assume it is safe to inline.' },
    ],
    related: ['image-to-base64', 'image-compressor', 'css-minifier', 'image-converter'],
  }),
  t({
    id: 'image-converter',
    name: 'Image Format Converter',
    description: 'Convert between JPG, PNG, WebP and AVIF with batch support.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'Repeat2',
    keywords: ['convert', 'format', 'avif', 'webp', 'png', 'jpg', 'bmp', 'gif'],
    accept: IMG_ANY,
    seoTitle: 'Image Converter: JPG, PNG, WebP, AVIF',
    seoDescription: 'Convert images between JPG, PNG, WebP and AVIF in your browser. Batch conversion, quality control and no uploads.',
    intro:
      'Pick an output format and quality and convert a whole folder of images. AVIF encoding uses a WebAssembly codec, so it works even where the browser cannot encode AVIF itself.',
    steps: ['Add images in any common format.', 'Choose JPG, PNG, WebP or AVIF and set quality.', 'Download the files or a ZIP.'],
    features: ['JPG, PNG, WebP, AVIF output', 'Inputs: JPG, PNG, WebP, AVIF, GIF, BMP', 'Background fill for JPG', 'Batch + ZIP'],
    faqs: [
      { q: 'Why is AVIF slow?', a: 'AVIF compresses very well but takes longer to encode. Large images can take several seconds each.' },
      { q: 'What about HEIC?', a: 'Use the HEIC to JPG tool. HEIC needs its own decoder.' },
    ],
    related: ['heic-to-jpg', 'png-to-jpg', 'jpg-to-webp', 'image-compressor'],
  }),
  t({
    id: 'image-metadata-viewer',
    name: 'Image Metadata Viewer',
    description: 'Inspect dimensions, file type, EXIF data and dominant colors.',
    category: 'image',
    icon: 'ScanSearch',
    keywords: ['exif', 'metadata', 'dimensions', 'camera', 'gps', 'color palette'],
    accept: [...IMG_ANY, '.heic', 'image/heic'],
    seoTitle: 'Image Metadata Viewer: EXIF and Color Info',
    seoDescription: 'View image dimensions, file type, EXIF camera data, GPS location and dominant colors. Files are read locally and never uploaded.',
    intro:
      'See what is inside an image before you share it. The viewer reads EXIF camera settings, timestamps and GPS coordinates when present, and samples the picture for its main colors.',
    steps: ['Add an image.', 'Read the file details, EXIF fields and color summary.', 'Use Remove metadata to download a clean copy.'],
    features: ['EXIF, GPS and timestamps when present', 'Detected type from file contents', 'Dominant colors and transparency check', 'One-click metadata stripping'],
    faqs: [
      { q: 'Why is there no EXIF data?', a: 'Many apps and websites strip it. Screenshots, PNGs and edited exports often have none.' },
      { q: 'Does stripping change the picture?', a: 'The copy is re-encoded from decoded pixels, so metadata is gone. Lossy formats get re-compressed, which can lower quality slightly.' },
    ],
    related: ['image-compressor', 'image-converter', 'pdf-metadata-viewer', 'image-to-base64'],
  }),
  t({
    id: 'heic-to-jpg',
    name: 'HEIC to JPG',
    description: 'Convert iPhone HEIC photos to JPG or PNG.',
    category: 'converters',
    alsoIn: ['image'],
    icon: 'Smartphone',
    keywords: ['heic', 'heif', 'iphone', 'jpg', 'convert', 'apple'],
    accept: ['image/heic', 'image/heif', '.heic', '.heif'],
    seoTitle: 'HEIC to JPG Converter: iPhone Photos, Free',
    seoDescription: 'Convert HEIC and HEIF photos from iPhone to JPG or PNG in your browser. No upload, batch conversion supported.',
    intro:
      'iPhone photos use HEIC, which many apps and sites reject. This converter decodes HEIC on your device and writes standard JPG or PNG files.',
    steps: ['Add HEIC or HEIF photos.', 'Choose JPG or PNG and quality.', 'Download the converted photos.'],
    features: ['Local decoding', 'JPG or PNG output', 'Batch + ZIP', 'No upload'],
    faqs: [
      { q: 'Why does the first conversion take longer?', a: 'The HEIC decoder is loaded the first time you use this tool. It stays cached afterwards.' },
      { q: 'Are Live Photos supported?', a: 'Only the still image is converted.' },
    ],
    related: ['image-converter', 'png-to-jpg', 'image-compressor', 'image-metadata-viewer'],
  }),
  t({
    id: 'background-remover',
    name: 'Background Remover',
    description: 'Remove backgrounds with an AI model that runs on your device.',
    category: 'image',
    icon: 'Wand2',
    keywords: ['remove background', 'transparent', 'cutout', 'ai', 'remove.bg', 'portrait', 'matting'],
    popular: true,
    accept: ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp'],
    seoTitle: 'AI Background Remover, Private in Your Browser',
    seoDescription:
      'Remove image backgrounds with an AI segmentation model running locally in your browser. Download a transparent PNG or add a new background color.',
    intro:
      'A neural network separates the subject from the background directly on your device. The first run downloads a model file (about 26 MB for the default) to your browser and caches it; your photo is never sent anywhere.',
    steps: [
      'Add a photo. The model downloads on first use and is cached after that.',
      'Wait for the cutout, then compare it with the original.',
      'Download a transparent PNG or pick a background color first.',
    ],
    features: [
      'Real model inference with Transformers.js and ONNX Runtime',
      'WebGPU when available, WebAssembly otherwise',
      'Transparent PNG or solid color background',
      'Download progress and a cached model for next time',
    ],
    faqs: [
      { q: 'Does my photo get uploaded?', a: 'No. Only the model file is downloaded, from Hugging Face. Your image stays in memory on your device.' },
      { q: 'Why is the first run slow?', a: 'The model has to be downloaded once. After that, the browser cache serves it.' },
      { q: 'How good are the results?', a: 'The default model is trained for people and portraits. For products and objects, switch to the general model. Hair, glass and busy backgrounds can still produce rough edges.' },
    ],
    related: ['image-cropper', 'image-compressor', 'image-resizer', 'png-to-webp'],
  }),

  // ───────────── PDF ─────────────
  t({
    id: 'pdf-merger',
    name: 'PDF Merger',
    description: 'Combine several PDFs into one, in the order you choose.',
    category: 'pdf',
    icon: 'Combine',
    keywords: ['merge pdf', 'combine pdf', 'join', 'ilovepdf'],
    popular: true,
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Merger: Combine PDFs Without Uploading',
    seoDescription: 'Merge multiple PDF files into one document. Reorder files before merging. Private, free, and runs in your browser.',
    intro:
      'Add PDFs, drag them into the order you want, and merge them into a single file. Pages are copied as they are, so text stays selectable and quality is unchanged.',
    steps: ['Add two or more PDFs.', 'Reorder them with the arrows.', 'Click Merge and download the combined PDF.'],
    features: ['Reorder before merging', 'Page counts shown per file', 'Password-protected files are flagged', 'No quality loss'],
    faqs: [
      { q: 'Can I merge encrypted PDFs?', a: 'Not if they need a password to open. Remove the password in a PDF reader first.' },
      { q: 'Are bookmarks kept?', a: 'Page content is kept. Bookmarks and form fields from the source files may not carry over.' },
    ],
    related: ['pdf-splitter', 'pdf-compressor', 'pdf-page-remover', 'images-to-pdf'],
  }),
  t({
    id: 'pdf-splitter',
    name: 'PDF Splitter',
    description: 'Extract pages or ranges into new PDFs, or split into single pages.',
    category: 'pdf',
    icon: 'Scissors',
    keywords: ['split pdf', 'extract pages', 'page range'],
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Splitter: Extract Pages and Page Ranges Online',
    seoDescription: 'Split a PDF by page range or into single pages. Download separate PDFs or one ZIP. Runs privately in your browser.',
    intro:
      'Type ranges like 1-3, 5, 8-10 to extract those pages. You can keep each range as its own PDF, combine them into one file, or split every page into a separate document.',
    steps: ['Add a PDF.', 'Enter page ranges or choose "every page".', 'Download the PDFs or a ZIP.'],
    features: ['Range syntax with validation', 'One file per range, or one combined file', 'Split every page', 'ZIP download'],
    faqs: [
      { q: 'What is the range format?', a: 'Comma-separated pages and ranges, such as 1-3, 5, 8-10. Each comma-separated item becomes one PDF when "separate files" is selected.' },
      { q: 'Does splitting reduce quality?', a: 'No. Pages are copied without re-rendering.' },
    ],
    related: ['pdf-merger', 'pdf-page-remover', 'pdf-to-images', 'pdf-page-rotator'],
  }),
  t({
    id: 'pdf-page-remover',
    name: 'PDF Page Remover',
    description: 'Preview pages and delete the ones you do not need.',
    category: 'pdf',
    icon: 'FileMinus',
    keywords: ['delete pages', 'remove pages', 'pdf'],
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Page Remover: Delete Pages from a PDF Online',
    seoDescription: 'Preview PDF pages, select the ones to delete, and export the rest as a new PDF. Private and free.',
    intro: 'See thumbnails of every page, click the ones to remove, and export the remainder. The original file is not modified.',
    steps: ['Add a PDF.', 'Click pages to mark them for removal.', 'Export the new PDF.'],
    features: ['Thumbnail previews', 'Page numbers on every thumbnail', 'Select all / clear', 'No quality loss'],
    faqs: [
      { q: 'Can I undo a selection?', a: 'Click the page again to keep it. Nothing is saved until you export.' },
      { q: 'Does the file keep its text?', a: 'Yes. Remaining pages are copied unchanged.' },
    ],
    related: ['pdf-splitter', 'pdf-merger', 'pdf-page-rotator', 'pdf-compressor'],
  }),
  t({
    id: 'pdf-page-rotator',
    name: 'PDF Page Rotator',
    description: 'Rotate selected pages or the whole document.',
    category: 'pdf',
    icon: 'RotateCw',
    keywords: ['rotate pdf', 'landscape', 'portrait', 'sideways'],
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Page Rotator: Rotate PDF Pages Online',
    seoDescription: 'Rotate individual pages or a whole PDF by 90, 180 or 270 degrees with live thumbnails. Private, runs in your browser.',
    intro: 'Fix scanned pages that came out sideways. Rotate pages one at a time, in a selection, or all at once, and see the result before exporting.',
    steps: ['Add a PDF.', 'Rotate pages individually or select several first.', 'Export the rotated PDF.'],
    features: ['Per-page and bulk rotation', 'Live thumbnails', 'Keeps text selectable', 'No upload'],
    faqs: [
      { q: 'Is the content re-rendered?', a: 'No. The tool sets the rotation flag on each page, so quality is unchanged.' },
      { q: 'Will other viewers respect the rotation?', a: 'Yes. Page rotation is part of the PDF standard.' },
    ],
    related: ['pdf-page-remover', 'pdf-splitter', 'pdf-merger', 'image-rotator'],
  }),
  t({
    id: 'pdf-to-images',
    name: 'PDF to Images',
    description: 'Render PDF pages as PNG or JPG images.',
    category: 'converters',
    alsoIn: ['pdf'],
    icon: 'Images',
    keywords: ['pdf to jpg', 'pdf to png', 'export pages', 'screenshot'],
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF to Images: Convert PDF Pages to PNG or JPG',
    seoDescription: 'Convert PDF pages to PNG or JPG images at the resolution you choose. Select a page range and download a ZIP. No upload.',
    intro:
      'Render pages with PDF.js at 72 to 300 DPI. Choose a page range, pick PNG for crisp text or JPG for smaller files, and download images one by one or together.',
    steps: ['Add a PDF.', 'Choose pages, format and resolution.', 'Convert and download.'],
    features: ['Page ranges', 'PNG or JPG', 'Resolution up to 300 DPI', 'ZIP download'],
    faqs: [
      { q: 'What DPI should I choose?', a: '150 is enough for screens. Use 300 for printing. Higher values use more memory.' },
      { q: 'Why did a large page fail?', a: 'Very large pages at high DPI exceed browser canvas limits. Lower the DPI and try again.' },
    ],
    related: ['images-to-pdf', 'pdf-splitter', 'pdf-compressor', 'image-converter'],
  }),
  t({
    id: 'images-to-pdf',
    name: 'Images to PDF',
    description: 'Turn images into a PDF with page size and margin settings.',
    category: 'converters',
    alsoIn: ['pdf', 'image'],
    icon: 'FilePlus2',
    keywords: ['jpg to pdf', 'png to pdf', 'photos to pdf', 'scan'],
    accept: IMG,
    seoTitle: 'Images to PDF: Convert JPG and PNG to PDF Online',
    seoDescription: 'Combine JPG, PNG and WebP images into one PDF. Reorder pages, choose page size and margins. No upload.',
    intro:
      'Add photos or scans, arrange them, and generate a PDF. Choose A4, Letter, or fit the page to each image, then set margins and orientation.',
    steps: ['Add images.', 'Reorder them and set page size and margins.', 'Create and download the PDF.'],
    features: ['Reorder pages', 'A4, Letter, or fit-to-image', 'Adjustable margins', 'JPG and PNG embedded without re-encoding'],
    faqs: [
      { q: 'Will image quality drop?', a: 'JPG and PNG files are embedded directly. WebP files are converted to PNG first.' },
      { q: 'Can I mix portrait and landscape?', a: 'Yes. With "Auto" orientation each page follows its image.' },
    ],
    related: ['pdf-merger', 'pdf-to-images', 'image-compressor', 'image-resizer'],
  }),
  t({
    id: 'pdf-metadata-viewer',
    name: 'PDF Metadata Viewer',
    description: 'See page count, size, title, author and PDF version.',
    category: 'pdf',
    icon: 'Info',
    keywords: ['pdf info', 'properties', 'author', 'producer', 'page count'],
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Metadata Viewer: Pages, Author, Dates',
    seoDescription: 'Inspect a PDF for page count, file size, title, author, creator and dates. Runs locally, no upload.',
    intro: 'Check what a PDF says about itself: title, author, the software that produced it, dates, page sizes and encryption status.',
    steps: ['Add a PDF.', 'Read the document properties.', 'Optionally download a copy with the metadata cleared.'],
    features: ['Title, author, subject, keywords', 'Creator, producer and dates', 'Page count and page sizes', 'Clean copy without metadata'],
    faqs: [
      { q: 'Can I edit the metadata?', a: 'You can download a copy with the standard fields cleared. Custom metadata streams may remain.' },
      { q: 'Why are fields empty?', a: 'Many PDFs do not set them.' },
    ],
    related: ['pdf-compressor', 'pdf-merger', 'image-metadata-viewer', 'pdf-splitter'],
  }),
  t({
    id: 'pdf-compressor',
    name: 'PDF Compressor',
    description: 'Reduce PDF size with lossless cleanup or page rasterizing.',
    category: 'pdf',
    icon: 'FileArchive',
    keywords: ['compress pdf', 'reduce pdf size', 'shrink pdf', 'optimize'],
    popular: true,
    accept: ['application/pdf', '.pdf'],
    seoTitle: 'PDF Compressor: Reduce PDF Size in Browser',
    seoDescription: 'Compress PDFs with lossless cleanup or by recompressing pages as images. See the real size before you download. Private, no upload.',
    intro:
      'Browsers cannot rewrite every part of a PDF, so this tool offers two honest modes. Lossless cleanup repacks the file structure and removes metadata. Rasterize recompresses each page as a JPEG, which can cut scanned documents dramatically but turns text into pixels.',
    steps: [
      'Add a PDF.',
      'Choose lossless cleanup, or rasterize with a quality level.',
      'Compare the sizes and download only if the result is smaller.',
    ],
    features: ['Lossless cleanup mode', 'Rasterize mode with DPI and quality control', 'Real before and after sizes', 'Warns when text will become non-selectable'],
    faqs: [
      { q: 'Why did lossless cleanup save almost nothing?', a: 'Most of a PDF is usually images and fonts, which this mode leaves alone. Try rasterize mode if the file is a scan.' },
      { q: 'What do I lose with rasterize?', a: 'Selectable text, links and forms. Each page becomes a flat image. Use it for scans, not for documents you need to search.' },
    ],
    related: ['pdf-merger', 'pdf-splitter', 'pdf-to-images', 'image-compressor'],
  }),

  // ───────────── Text ─────────────
  t({
    id: 'word-counter',
    name: 'Word Counter',
    description: 'Count words, characters, sentences, paragraphs and reading time.',
    category: 'text',
    icon: 'Hash',
    keywords: ['word count', 'character count', 'reading time', 'sentences', 'paragraphs'],
    seoTitle: 'Word Counter: Words, Characters, Reading Time',
    seoDescription: 'Count words, characters with and without spaces, sentences and paragraphs, and estimate reading time. Live, private and free.',
    intro: 'Paste or type and the counts update as you go. Reading time assumes 238 words per minute, and speaking time assumes 150.',
    steps: ['Paste or type your text.', 'Read the counts.', 'Clear the box when you are done.'],
    features: ['Words, characters, sentences, paragraphs', 'Characters excluding spaces', 'Reading and speaking time', 'Handles Unicode'],
    faqs: [
      { q: 'How are words counted?', a: 'A word is a run of characters separated by whitespace. Hyphenated words count as one.' },
      { q: 'Is my text saved?', a: 'No. It stays in the page and disappears when you close the tab.' },
    ],
    related: ['case-converter', 'remove-duplicate-lines', 'text-diff-checker', 'text-reverser'],
  }),
  t({
    id: 'case-converter',
    name: 'Case Converter',
    description: 'Switch between upper, lower, title, sentence, camel, snake and kebab case.',
    category: 'text',
    icon: 'CaseSensitive',
    keywords: ['uppercase', 'lowercase', 'title case', 'camelcase', 'snake_case', 'kebab-case'],
    seoTitle: 'Case Converter: Upper, Lower, Title, camelCase',
    seoDescription: 'Convert text to uppercase, lowercase, title case, sentence case, camelCase, snake_case and kebab-case instantly in your browser.',
    intro: 'Type or paste text and click a case. Programmer cases split on spaces, dashes, underscores and capital letters, so userID_value becomes user-id-value.',
    steps: ['Paste your text.', 'Click the case you want.', 'Copy the result.'],
    features: ['Seven case styles', 'Smart word splitting', 'Copy in one click', 'Multi-line safe'],
    faqs: [
      { q: 'How does Title Case treat small words?', a: 'Short words like a, of and the stay lowercase unless they start the text.' },
      { q: 'Does it handle accents?', a: 'Yes. Conversions use your browser Unicode rules.' },
    ],
    related: ['word-counter', 'text-reverser', 'remove-duplicate-lines', 'json-formatter'],
  }),
  t({
    id: 'remove-duplicate-lines',
    name: 'Remove Duplicate Lines',
    description: 'Delete repeated lines and keep the original order.',
    category: 'text',
    icon: 'ListX',
    keywords: ['dedupe', 'unique lines', 'duplicate', 'sort'],
    seoTitle: 'Remove Duplicate Lines: Dedupe a List Online',
    seoDescription: 'Remove duplicate lines from text while keeping the first occurrence and original order. Options for case and whitespace.',
    intro: 'Paste a list and get back only the unique lines, in their original order. Choose whether case and surrounding spaces matter.',
    steps: ['Paste your lines.', 'Set the options.', 'Copy the unique lines.'],
    features: ['Preserves order', 'Case-sensitive toggle', 'Trim whitespace option', 'Shows how many were removed'],
    faqs: [
      { q: 'Which copy is kept?', a: 'The first one. Later duplicates are removed.' },
      { q: 'Can it ignore blank lines?', a: 'Yes. Turn on "Remove empty lines".' },
    ],
    related: ['text-diff-checker', 'word-counter', 'case-converter', 'json-to-csv'],
  }),
  t({
    id: 'text-diff-checker',
    name: 'Text Diff Checker',
    description: 'Compare two texts and see additions and deletions side by side.',
    category: 'text',
    icon: 'GitCompare',
    keywords: ['diff', 'compare', 'difference', 'changes'],
    seoTitle: 'Text Diff Checker: Compare Two Texts Side by Side',
    seoDescription: 'Compare two blocks of text and highlight additions and deletions, line by line or word by word. Runs in your browser.',
    intro: 'Paste the original on the left and the changed version on the right. Additions are green, deletions are red, and word-level changes are highlighted inside changed lines.',
    steps: ['Paste both versions.', 'Choose line or word comparison.', 'Review the highlighted changes.'],
    features: ['Side-by-side view', 'Line and word modes', 'Ignore whitespace option', 'Counts of added and removed lines'],
    faqs: [
      { q: 'Is there a size limit?', a: 'Very large inputs get slow because diffing is expensive. Tens of thousands of lines is fine.' },
      { q: 'Is my text sent anywhere?', a: 'No. The comparison runs in this tab.' },
    ],
    related: ['remove-duplicate-lines', 'word-counter', 'json-formatter', 'case-converter'],
  }),
  t({
    id: 'lorem-ipsum-generator',
    name: 'Lorem Ipsum Generator',
    description: 'Generate placeholder paragraphs, sentences or words.',
    category: 'text',
    icon: 'AlignLeft',
    keywords: ['lorem ipsum', 'placeholder', 'dummy text', 'filler'],
    seoTitle: 'Lorem Ipsum Generator: Paragraphs and Words',
    seoDescription: 'Generate lorem ipsum placeholder text by paragraphs, sentences or words, and copy it with one click.',
    intro: 'Pick how many paragraphs, sentences or words you need. You can start with the classic "Lorem ipsum dolor sit amet" or get fully random text.',
    steps: ['Choose the unit and count.', 'Click Generate.', 'Copy the text.'],
    features: ['Paragraphs, sentences, words', 'Optional classic opening', 'Copy in one click', 'Instant'],
    faqs: [
      { q: 'Is the text random each time?', a: 'Yes. Click Generate again for a new sample.' },
      { q: 'Is it real Latin?', a: 'It is scrambled text derived from Cicero. It is not meant to be read.' },
    ],
    related: ['word-counter', 'case-converter', 'text-reverser', 'uuid-generator'],
  }),
  t({
    id: 'text-reverser',
    name: 'Text Reverser',
    description: 'Reverse characters, words or lines.',
    category: 'text',
    icon: 'ArrowDownUp',
    keywords: ['reverse text', 'mirror', 'flip text', 'reverse words'],
    seoTitle: 'Text Reverser: Reverse Characters, Words or Lines',
    seoDescription: 'Reverse text by characters, word order or line order. Handles emoji and accented characters correctly.',
    intro: 'Reverse a string letter by letter, flip the order of the words, or reverse the lines of a list. Emoji and combined characters stay intact.',
    steps: ['Paste your text.', 'Pick a mode.', 'Copy the result.'],
    features: ['Characters, words, lines', 'Unicode-aware', 'Copy in one click', 'Live output'],
    faqs: [
      { q: 'Why does emoji not break?', a: 'The tool reverses user-perceived characters, so multi-part emoji stay together.' },
      { q: 'What is the difference between words and characters?', a: 'Words mode keeps each word spelled normally and reverses their order.' },
    ],
    related: ['case-converter', 'word-counter', 'remove-duplicate-lines', 'text-diff-checker'],
  }),

  // ───────────── Developer ─────────────
  t({
    id: 'json-formatter',
    name: 'JSON Formatter & Validator',
    description: 'Format, minify and validate JSON with clear error positions.',
    category: 'developer',
    icon: 'Braces',
    keywords: ['json', 'pretty print', 'minify', 'validate', 'lint'],
    popular: true,
    seoTitle: 'JSON Formatter and Validator: Pretty Print',
    seoDescription: 'Format, minify and validate JSON in your browser. Errors show the line and column. Your data is never uploaded.',
    intro: 'Paste JSON to format it with 2 or 4 spaces or tabs, minify it, or validate it. When the JSON is invalid, the error is highlighted with its line and column.',
    steps: ['Paste JSON into the input.', 'Choose Format, Minify or Validate.', 'Copy the output.'],
    features: ['Line and column error highlighting', 'Indent size options', 'Optional key sorting', 'Local only, safe for sensitive data'],
    faqs: [
      { q: 'Does it accept comments or trailing commas?', a: 'No. It validates strict JSON, which is what parsers expect.' },
      { q: 'Is the JSON uploaded?', a: 'No. It is parsed with the browser built-in JSON parser.' },
    ],
    related: ['json-to-csv', 'base64-encoder-decoder', 'jwt-decoder', 'text-diff-checker'],
  }),
  t({
    id: 'json-to-csv',
    name: 'JSON to CSV',
    description: 'Convert a JSON array to CSV and download it.',
    category: 'converters',
    alsoIn: ['developer'],
    icon: 'Table',
    keywords: ['json', 'csv', 'spreadsheet', 'excel', 'convert'],
    seoTitle: 'JSON to CSV Converter: Arrays to Spreadsheets',
    seoDescription: 'Convert JSON arrays to CSV online. Nested objects are flattened. Download the CSV file. Runs in your browser.',
    intro: 'Paste a JSON array of objects. Nested objects are flattened with dot notation, and values containing commas or quotes are escaped properly.',
    steps: ['Paste JSON.', 'Choose the delimiter.', 'Copy or download the CSV.'],
    features: ['Flattens nested objects', 'Comma, semicolon, tab or pipe delimiters', 'Proper quoting and escaping', 'Download .csv'],
    faqs: [
      { q: 'What about arrays inside objects?', a: 'They are written as JSON text in the cell so no data is lost.' },
      { q: 'Does Excel open it correctly?', a: 'Yes. Turn on "Add BOM" if accented characters look wrong in Excel.' },
    ],
    related: ['json-formatter', 'base64-encoder-decoder', 'remove-duplicate-lines', 'text-diff-checker'],
  }),
  t({
    id: 'base64-encoder-decoder',
    name: 'Base64 Encoder / Decoder',
    description: 'Encode text to Base64 or decode it back, with Unicode support.',
    category: 'developer',
    icon: 'Binary',
    keywords: ['base64', 'encode', 'decode', 'btoa', 'atob'],
    seoTitle: 'Base64 Encoder and Decoder: Text to Base64',
    seoDescription: 'Encode text to Base64 or decode Base64 to text, with UTF-8 and URL-safe options. Private and instant.',
    intro: 'Convert text to Base64 and back. UTF-8 is handled correctly, so emoji and non-Latin scripts survive the round trip. A URL-safe option swaps + and / for - and _.',
    steps: ['Paste text or Base64.', 'Choose Encode or Decode.', 'Copy the result.'],
    features: ['UTF-8 safe', 'URL-safe variant', 'Clear errors for invalid input', 'Copy in one click'],
    faqs: [
      { q: 'Is Base64 encryption?', a: 'No. Anyone can decode it. It only makes binary data safe to put in text.' },
      { q: 'Why does decoding fail?', a: 'The input may have invalid characters or be missing padding. The tool tells you which.' },
    ],
    related: ['image-to-base64', 'url-encoder-decoder', 'jwt-decoder', 'hash-generator'],
  }),
  t({
    id: 'url-encoder-decoder',
    name: 'URL Encoder / Decoder',
    description: 'Percent-encode or decode URL components and full URLs.',
    category: 'developer',
    icon: 'Link',
    keywords: ['url encode', 'percent encoding', 'decodeURIComponent', 'query string'],
    seoTitle: 'URL Encoder and Decoder: Percent Encoding Online',
    seoDescription: 'Encode or decode URL components and full URLs with percent encoding. Runs in your browser.',
    intro: 'Encode a query-string value, or an entire URL, so special characters are safe to send. Decode percent-encoded text to read it.',
    steps: ['Paste text or a URL.', 'Pick component or full URL mode and Encode or Decode.', 'Copy the result.'],
    features: ['Component and full URL modes', 'Clear errors for malformed input', 'Copy in one click', 'Unicode support'],
    faqs: [
      { q: 'Component or full URL?', a: 'Use component for a single value such as a search term. Use full URL to leave characters like : / ? & intact.' },
      { q: 'Why does decoding fail?', a: 'A stray % that is not followed by two hex digits makes the input invalid.' },
    ],
    related: ['base64-encoder-decoder', 'html-entity-encoder-decoder', 'json-formatter', 'jwt-decoder'],
  }),
  t({
    id: 'uuid-generator',
    name: 'UUID Generator',
    description: 'Generate random UUID v4 values in bulk.',
    category: 'developer',
    icon: 'Fingerprint',
    keywords: ['uuid', 'guid', 'random id', 'v4'],
    seoTitle: 'UUID Generator: Create UUID v4 in Bulk',
    seoDescription: 'Generate random UUID v4 identifiers, up to 1000 at a time, and copy one or all. Uses your browser crypto API.',
    intro: 'Generate cryptographically random version 4 UUIDs with the Web Crypto API. Copy a single value or the whole list, in upper or lower case, with or without hyphens.',
    steps: ['Choose how many.', 'Click Generate.', 'Copy one or all.'],
    features: ['Web Crypto randomness', 'Upper or lower case', 'Hyphens optional', 'Up to 1000 at once'],
    faqs: [
      { q: 'Can two UUIDs collide?', a: 'In practice no. The chance is negligible for v4 UUIDs.' },
      { q: 'Are they stored anywhere?', a: 'No. They exist only in this tab.' },
    ],
    related: ['hash-generator', 'base64-encoder-decoder', 'lorem-ipsum-generator', 'jwt-decoder'],
  }),
  t({
    id: 'hash-generator',
    name: 'Hash Generator',
    description: 'Compute SHA-1, SHA-256, SHA-384 and SHA-512 for text or files.',
    category: 'developer',
    icon: 'Hash',
    keywords: ['sha256', 'sha1', 'sha512', 'checksum', 'digest', 'hash file'],
    seoTitle: 'Hash Generator: SHA-1, SHA-256, SHA-384, SHA-512',
    seoDescription: 'Generate SHA hashes for text or files using your browser Web Crypto API. Files are never uploaded.',
    intro: 'Type text or choose a file to get SHA-1, SHA-256, SHA-384 and SHA-512 digests at once. Hashing uses the Web Crypto API built into your browser.',
    steps: ['Type text or choose a file.', 'Read the digests.', 'Copy the one you need.'],
    features: ['Four algorithms at once', 'Text or file input', 'Hex output, upper or lower case', 'Compare against an expected hash'],
    faqs: [
      { q: 'Why no MD5?', a: 'Web Crypto does not include MD5, and it is not safe for security uses.' },
      { q: 'Is SHA-1 safe?', a: 'Not for security. It is fine for checksums and legacy comparisons.' },
    ],
    related: ['uuid-generator', 'base64-encoder-decoder', 'jwt-decoder', 'pdf-metadata-viewer'],
  }),
  t({
    id: 'css-minifier',
    name: 'CSS Minifier',
    description: 'Minify CSS by removing comments and whitespace.',
    category: 'developer',
    icon: 'FileCode',
    keywords: ['minify css', 'compress css', 'css'],
    seoTitle: 'CSS Minifier: Compress CSS Online',
    seoDescription: 'Minify CSS by removing comments, whitespace and redundant semicolons. See the size saved. Runs in your browser.',
    intro: 'Paste CSS and get a minified version. Comments, extra whitespace and trailing semicolons are removed, and strings and url() values are left untouched.',
    steps: ['Paste your CSS.', 'Read the minified output.', 'Copy it.'],
    features: ['Strips comments and whitespace', 'Preserves strings and url()', 'Shows bytes saved', 'Copy in one click'],
    faqs: [
      { q: 'Is it as aggressive as cssnano?', a: 'No. It is a safe whitespace and comment minifier. It does not merge rules or rewrite values.' },
      { q: 'Does it support modern CSS?', a: 'Yes. Nesting, custom properties and @layer pass through unchanged.' },
    ],
    related: ['svg-optimizer', 'json-formatter', 'html-entity-encoder-decoder', 'color-converter'],
  }),
  t({
    id: 'html-entity-encoder-decoder',
    name: 'HTML Entity Encoder / Decoder',
    description: 'Escape or unescape HTML entities.',
    category: 'developer',
    icon: 'Code2',
    keywords: ['html entities', 'escape html', 'unescape', '&amp;'],
    seoTitle: 'HTML Entity Encoder and Decoder Online',
    seoDescription: 'Encode special characters to HTML entities or decode entities back to text. Handles named, decimal and hex entities.',
    intro: 'Escape &, <, >, quotes and optionally every non-ASCII character, or decode named and numeric entities back into readable text.',
    steps: ['Paste text.', 'Choose Encode or Decode.', 'Copy the result.'],
    features: ['Named, decimal and hex entities', 'Optional non-ASCII encoding', 'Safe decoding without running scripts', 'Copy in one click'],
    faqs: [
      { q: 'Is decoding safe?', a: 'Yes. Decoding uses the DOMParser text content, and nothing is inserted into the page.' },
      { q: 'Which characters are encoded by default?', a: 'Ampersand, less-than, greater-than, double quote and apostrophe.' },
    ],
    related: ['url-encoder-decoder', 'base64-encoder-decoder', 'css-minifier', 'json-formatter'],
  }),
  t({
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    description: 'Decode a JWT header and payload and read its expiry. Does not verify.',
    category: 'developer',
    icon: 'KeyRound',
    keywords: ['jwt', 'json web token', 'decode token', 'bearer', 'exp'],
    seoTitle: 'JWT Decoder: Read Token Header and Payload Locally',
    seoDescription: 'Decode a JSON Web Token in your browser. See the header, payload and expiry. Signatures are not verified, and the token is never sent anywhere.',
    intro:
      'Paste a JWT to read its header and payload. Time claims such as exp, iat and nbf are shown as dates. This tool decodes only: it does not verify the signature, so a decoded token is not proof that the token is genuine.',
    steps: ['Paste the token.', 'Read the header, payload and time claims.', 'Copy the part you need.'],
    features: ['Header and payload as formatted JSON', 'Expiry status for exp, iat, nbf', 'Runs locally, tokens never leave the page', 'Clear signature warning'],
    faqs: [
      { q: 'Does it verify the signature?', a: 'No. Verifying needs the secret or public key. Never trust a token because it decodes.' },
      { q: 'Is it safe to paste a real token?', a: 'The token is not sent anywhere. Still, treat live production tokens with care and revoke any you pasted into untrusted tools.' },
    ],
    related: ['base64-encoder-decoder', 'json-formatter', 'hash-generator', 'url-encoder-decoder'],
  }),
  t({
    id: 'color-converter',
    name: 'Color Converter',
    description: 'Convert between HEX, RGB and HSL with a color picker.',
    category: 'developer',
    icon: 'Palette',
    keywords: ['hex to rgb', 'rgb to hex', 'hsl', 'color picker'],
    seoTitle: 'Color Converter: HEX, RGB and HSL with Picker',
    seoDescription: 'Convert colors between HEX, RGB and HSL with a live preview and color picker. Copy any format in one click.',
    intro: 'Pick a color or type a value in any format and see the others update. Copy HEX, RGB or HSL values ready for CSS.',
    steps: ['Pick a color or type a value.', 'Edit any field.', 'Copy the format you need.'],
    features: ['HEX, RGB, HSL', 'Native color picker', 'Live preview with contrast readout', 'CSS-ready copy buttons'],
    faqs: [
      { q: 'Does it support 3-digit hex?', a: 'Yes. #f80 expands to #ff8800.' },
      { q: 'What about alpha?', a: 'This version converts opaque colors only.' },
    ],
    related: ['css-minifier', 'image-metadata-viewer', 'json-formatter', 'uuid-generator'],
  }),
]

export const toolById = (id: string): ToolMeta | undefined => tools.find((x) => x.id === id)
export const toolBySlug = (slug: string): ToolMeta | undefined => tools.find((x) => x.slug === slug)
export const toolsInCategory = (cat: CategoryId): ToolMeta[] =>
  tools.filter((x) => x.category === cat || x.alsoIn?.includes(cat))
/** Tools whose primary category is `cat`. Used by menus so a tool is listed once. */
export const primaryToolsInCategory = (cat: CategoryId): ToolMeta[] => tools.filter((x) => x.category === cat)
export const relatedTools = (tool: ToolMeta): ToolMeta[] =>
  tool.related.map((id) => toolById(id)).filter((x): x is ToolMeta => !!x)
export const toolPath = (tool: ToolMeta): string => `/${tool.slug}`

/** Homepage popular list in the order requested in the product brief. */
export const popularOrder = [
  'image-compressor',
  'image-resizer',
  'background-remover',
  'png-to-jpg',
  'jpg-to-webp',
  'pdf-merger',
  'pdf-compressor',
  'json-formatter',
]
export const popularTools = (): ToolMeta[] =>
  popularOrder.map((id) => toolById(id)).filter((x): x is ToolMeta => !!x)
