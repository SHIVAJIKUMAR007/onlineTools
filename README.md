# Stayput

Free online tools that run entirely in the browser. Files are decoded, edited and saved by code running in the visitor's tab. There is no backend, no database, no accounts and no analytics.

40 tools across five categories:

| Category | Tools |
| --- | --- |
| Image | Compressor, Resizer, Cropper, Rotator & Flipper, Metadata Viewer, SVG Optimizer, Image to Base64, Background Remover |
| PDF | Merger, Splitter, Page Remover, Page Rotator, Metadata Viewer, Compressor |
| Converters | PNG to JPG, JPG to PNG, PNG to WebP, JPG to WebP, WebP to PNG, WebP to JPG, Image Format Converter (JPG/PNG/WebP/AVIF), HEIC to JPG, PDF to Images, Images to PDF, JSON to CSV |
| Text | Word Counter, Case Converter, Remove Duplicate Lines, Text Diff Checker, Lorem Ipsum Generator, Text Reverser |
| Developer | JSON Formatter & Validator, Base64, URL Encoder/Decoder, UUID Generator, Hash Generator, CSS Minifier, HTML Entity Encoder/Decoder, JWT Decoder, Color Converter |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, bundle, then prerender every public page
npm run preview    # serve the production build at http://localhost:4173
```

Requires Node 20.19 or newer.

Set the public URL before building so canonical links, Open Graph tags and the sitemap point at your domain:

```bash
VITE_SITE_URL=https://your-domain.example npm run build
```

## Testing

```bash
npm test                 # 180+ unit and UI workflow tests (Vitest, Testing Library, jsdom)
npm run typecheck

# Real-browser checks against the production build. Needs Chrome or Edge installed.
npm run build && npm run preview &
npm run e2e              # ~40 scenarios: converts, merges, splits, hashes, and runs the AI model
npm run e2e:models       # CPU/WebAssembly and WebGPU paths for both background models
```

`e2e/smoke.mjs` generates its own test images and PDFs, drives the built site, downloads the results and checks the bytes: JPEG/WebP/AVIF/PNG signatures, pixel values for transparency handling, page counts of merged and split PDFs, rotation flags, ZIP contents, known SHA test vectors, and which hosts the page contacted while the background remover ran. Use `BROWSER_CHANNEL=chrome` if you do not have Edge, `RUN_MODEL=0` to skip the model download.

## How it is built

- **React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Zustand.** UI primitives in `src/components/ui` follow the shadcn/ui pattern (cva + tailwind-merge) and are written in place instead of pulled from the CLI.
- **Central registry.** `src/data/tools.ts` holds every tool's id, route, icon, keywords, accepted file types, SEO copy, how-to steps, features, FAQ and related tools. Routes, nav menus, category pages, the all-tools page, search, related-tool lists, the sitemap and the prerendered HTML are all generated from it. `src/tools/registry.ts` maps each id to a lazily loaded component, and a test fails if the two ever disagree.
- **One image pipeline.** `src/lib/image/core.ts` decodes with `createImageBitmap`, transforms with canvas (rotate, flip, crop, step-down resize) and encodes with MozJPEG, WebP, AVIF and OxiPNG compiled to WebAssembly (jSquash). It runs in `src/workers/image.worker.ts` and falls back to the main thread if OffscreenCanvas workers are unavailable. Compressor, all six format converters, the HEIC converter and the format converter share `ImageBatchTool`.
- **PDF.** `pdf-lib` edits documents (merge, extract, rotate, metadata) and `pdfjs-dist` renders pages for previews and PDF to Images. PDF.js's worker file is bundled with the site.
- **Background remover.** Transformers.js and ONNX Runtime Web run in `src/workers/bg.worker.ts`. WebGPU is used when available, WebAssembly otherwise. The ONNX Runtime `.wasm` files are bundled with the site, so nothing loads from a CDN. Models are fetched from huggingface.co on first use and cached by the browser.
- **Code splitting.** Each tool is its own chunk, tools of a category share dependencies, and heavy libraries (PDF.js, pdf-lib, SVGO, JSZip, Transformers.js, HEIC) load only when needed. The homepage ships React and the app shell only.
- **SEO without a server.** `scripts/prerender.ts` runs after `vite build` and writes `dist/<route>/index.html` for all 50 public pages with the right title, description, canonical, Open Graph and Twitter tags, JSON-LD (WebSite, BreadcrumbList, SoftwareApplication, FAQPage) and a plain-HTML copy of the page for crawlers. It also writes `sitemap.xml`, `robots.txt` and `404.html`. React replaces that HTML on load, so browser-only processing is untouched. `npm run seo:report` lists title and description lengths.

## Background remover models

| Model | Size | License | Notes |
| --- | --- | --- | --- |
| MODNet (`Xenova/modnet`) | 26 MB | Apache-2.0 | Default. Trained for people. |
| RMBG-1.4 (`briaai/RMBG-1.4`, quantized) | 44 MB | Non-commercial | General subjects. Commercial use needs a license from BRIA AI. |

Add or swap models in `src/lib/ml/models.ts`. The UI warns about the RMBG license, and the Terms page repeats it. If you run a commercial site, remove RMBG or buy a license.

## Honest limits

- Processing uses the visitor's memory. Large files can fail on phones. Images above ~120 megapixels are rejected with a message, and PDF pages that would render above browser canvas limits stop with advice to lower the DPI.
- **PDF compression** has two modes. Lossless cleanup repacks structure and drops metadata, so savings are often small. Rasterize mode rebuilds each page as a JPEG, which shrinks scans a lot but removes selectable text. The tool only offers a download when the result is actually smaller.
- **Image compression** keeps the original when recompression would make a file larger and says so.
- **AVIF** encoding is slow. **HEIC** decoding uses `heic2any`, a large library loaded on demand.
- **JWT Decoder** decodes only. It never verifies signatures, and says so.
- Animated GIF/WebP inputs convert their first frame only.
- OCR and DOCX tools from the original wish list are not included. Everything shown on the site works.

## Hosting

The build output in `dist/` is static. Any static host works:

- **Netlify / Cloudflare Pages:** publish `dist/`. `_redirects` is included for SPA fallback.
- **Vercel:** `vercel.json` sets clean URLs and security headers.
- **nginx / S3:** serve `dist/` and use `404.html` as the error page. Make sure `.wasm` files are served as `application/wasm` and `.mjs` as `text/javascript`.

No special headers (COOP/COEP) are required.

## Privacy

See `src/data/pages.ts` for the text of the Privacy Policy. In short: files and text never leave the device; the only third-party request is the model download from huggingface.co when the background remover is used; no cookies, no analytics.

## Project layout

```
src/
  components/    layout/, tools/ (dropzone, batch tool, thumbnails, search), ui/, home/
  data/          tools.ts, categories.ts, pages.ts   <- the registry and site copy
  hooks/         useFileUpload (type sniffing), useImageBatch, usePdf, useObjectUrl
  lib/           image/, pdf/, text/, dev/, ml/, utils/, seo.ts, search.ts
  pages/         Home, Listing (all tools, categories), ToolPage, DocPageView, NotFound
  routes/        route table generated from the registry
  tools/         one component per tool, grouped by category, plus registry.ts
  workers/       image.worker.ts, bg.worker.ts
  test/          unit and UI tests
scripts/         prerender.ts, seo-report.ts, make-og.mjs
e2e/             real-browser smoke tests
```
