# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

**Stayput**: free online tools (image, PDF, converters, text, developer) that run **entirely in the browser**. Files and text are never uploaded. Static site: React 19 + Vite + TypeScript + Tailwind 4, prerendered for SEO, deployed to Cloudflare Workers static assets.

## Commands

```
npm run dev          # Vite dev server
npm run typecheck    # tsc -b
npm test             # vitest run (jsdom)
npm run build        # tsc -b && vite build && tsx scripts/prerender.ts
npm run e2e          # Playwright smoke test (needs a build/preview)
npm run seo:report   # SEO audit of prerendered pages
```

Before finishing a change, run `npm run typecheck` and `npm test`. Run `npm run build` if you touched routes, pages, SEO or `vite.config.ts`. There is no ESLint config.

## Layout

- `src/data/tools.ts`: metadata for every tool (name, SEO text, steps, features, FAQs, related). Single source of truth.
- `src/data/categories.ts`, `src/data/pages.ts`: categories, and legal/doc pages (About, Privacy, Terms, Disclaimer, Contact).
- `src/tools/registry.ts`: maps tool id to its lazy-loaded component.
- `src/tools/<category>/`: tool UI components. `src/lib/<area>/`: pure logic with no React.
- `src/components/`: shared UI (`ui/`, `tools/`, `layout/`), `Icon.tsx` (lucide whitelist).
- `src/lib/seo.ts` + `scripts/prerender.ts`: per-route HTML, sitemap, JSON-LD.
- `src/workers/`: Web Workers (image codecs, background removal).
- `src/test/`: vitest suites. `new tools to make.txt`: backlog with `[DONE]`/`[PARTIAL]` marks.

## Adding a tool

1. Put the logic in `src/lib/...` as pure functions, and write tests in `src/test/`.
2. Build the component in `src/tools/<category>/`, using `Panel`, `TextBox`, `Field`, `Segmented`, `Switch` and similar shared pieces.
3. Add a `t({...})` entry in `src/data/tools.ts` and a loader in `src/tools/registry.ts` with the same `id`.
4. If you use a new lucide icon, add it to **both** the import and the map in `src/components/Icon.tsx` (unknown names fall back to a wrench).
5. Write the tool's SEO article (see "Tool article rule" below).
6. Update `new tools to make.txt`.

## Tool article rule

Every tool page must have a written article **below the tool** (after the tool UI, in the tool's page content), of **at least 200 words**. The 200 words are the article alone, not counting the intro, steps, features or FAQs. Adding a tool is not finished until its article is written.

How to write it:

1. **SEO first.** Before writing, load the `marketing-skills:seo-audit` skill and apply its on-page guidance to the article: one clear primary keyword (the thing people search for, such as "sort lines online") in the first 100 words and one `h2`; related terms and questions worked in naturally; descriptive `h2` subheadings (no second `h1`); short paragraphs; no keyword stuffing; accurate claims only. Check that it adds something the intro, steps and FAQs do not already say, such as when to use the tool, how it works, tips and limits.
2. **Then humanize.** Run the draft through the `humanizer:humanizer` skill so it reads like a person wrote it. Remove AI tells: "not X, but Y" contrasts, forced triads, one-line closers, inflated or salesy claims, stock AI words, filler and dash overuse.
3. **Stay truthful.** Describe what the tool really does, including limits. Do not promise accuracy or privacy guarantees the code does not provide. Keep it consistent with the Privacy Policy.
4. **Check the numbers.** Count the words and confirm there are at least 200 before finishing. Keep the page's SEO title, description and the article's wording unique across tools, with no copy-pasted paragraphs.

`src/test/registry.test.ts` enforces: unique ids and slugs, a component for every tool, at least 3 steps, 3 features and 2 FAQs, at least 3 `related` ids that exist, unique SEO titles (16–75 chars) and descriptions (51–200 chars), and slugs that do not collide with static routes. Adding a static page also means updating `docPages`, the route in `src/routes/index.tsx`, the reserved-slug list in that test, and the page lists in `src/test/ui.test.tsx` and `scripts/prerender.ts`.

## Rules

- **Privacy is the product.** Never send user files or text to a server or third party. No uploads, analytics on tool input, or CDN-loaded runtime code. The only network fetch of this kind is the background-remover model from Hugging Face. If you change what the site downloads or stores, update the Privacy Policy in `src/data/pages.ts`.
- **Cloudflare limit: 25 MiB per asset.** `vite.config.ts` deliberately drops the 25.6 MiB onnxruntime `asyncify` wasm, so WebGPU is off and the background remover is CPU-only. Check `find dist -size +25000k` after build-affecting changes.
- **No `public/_redirects`.** The SPA fallback lives in `wrangler.jsonc` (`not_found_handling: single-page-application`); a catch-all `_redirects` rule is rejected as a loop.
- Ads are planned. Keep the Privacy, Terms and Disclaimer wording in sync with reality, and avoid claiming "no ads" or "no tracking".
- Heavy libraries must stay lazy-loaded per tool. Do not import them from shared or top-level code.
- Every tool needs a 200+ word SEO article below it, written with the `marketing-skills:seo-audit` and `humanizer:humanizer` skills (see "Tool article rule").
- Prefer small pure functions with tests over logic inside components. Keep UI copy plain and direct.
- Do not commit unless asked. Site URL comes from `VITE_SITE_URL` (see `.env.example`).
