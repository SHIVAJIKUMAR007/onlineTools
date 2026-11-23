export type CategoryId = 'image' | 'pdf' | 'converters' | 'text' | 'developer' | 'calculators' | 'utilities'

export interface Category {
  id: CategoryId
  slug: string
  name: string
  navName: string
  icon: string
  tagline: string
  seoTitle: string
  seoDescription: string
  intro: string
}

export const categories: Category[] = [
  {
    id: 'image',
    slug: 'image-tools',
    name: 'Image Tools',
    navName: 'Image Tools',
    icon: 'Image',
    tagline: 'Compress, resize, crop, rotate and inspect images.',
    seoTitle: 'Free Online Image Tools That Run in Your Browser | Stayput',
    seoDescription:
      'Compress, resize, crop, rotate, convert and remove backgrounds from images. Every image tool runs locally in your browser, so nothing is uploaded.',
    intro:
      'Edit photos and graphics without sending them anywhere. These tools decode, change and re-encode your images on your own device.',
  },
  {
    id: 'pdf',
    slug: 'pdf-tools',
    name: 'PDF Tools',
    navName: 'PDF Tools',
    icon: 'FileText',
    tagline: 'Merge, split, rotate, compress and convert PDFs.',
    seoTitle: 'Free Online PDF Tools, No Upload Needed | Stayput',
    seoDescription:
      'Merge, split, rotate, compress, and convert PDF files in your browser. Your documents stay on your device the whole time.',
    intro:
      'Work with PDFs privately. Contracts, statements and scans never leave your computer because the processing happens in this tab.',
  },
  {
    id: 'converters',
    slug: 'converters',
    name: 'File Converters',
    navName: 'Converters',
    icon: 'ArrowLeftRight',
    tagline: 'Switch between PNG, JPG, WebP, AVIF, HEIC, PDF and more.',
    seoTitle: 'Free Online File Converters (PNG, JPG, WebP, PDF) | Stayput',
    seoDescription:
      'Convert images between PNG, JPG, WebP and AVIF, turn HEIC into JPG, and convert PDFs and JSON. Conversion happens in your browser, not on a server.',
    intro:
      'Convert between common file formats locally. Batch conversion is supported, and you can download everything as a single ZIP.',
  },
  {
    id: 'text',
    slug: 'text-tools',
    name: 'Text Tools',
    navName: 'Text Tools',
    icon: 'Type',
    tagline: 'Count, convert, compare and clean up text.',
    seoTitle: 'Free Online Text Tools: Count, Case, Diff | Stayput',
    seoDescription:
      'Count words, change text case, remove duplicate lines, compare two texts and generate placeholder copy. Everything runs in your browser.',
    intro: 'Small text utilities that do one job and stay out of your way. Your text is never sent to a server.',
  },
  {
    id: 'developer',
    slug: 'developer-tools',
    name: 'Developer Tools',
    navName: 'Developer Tools',
    icon: 'Code2',
    tagline: 'Format JSON, hash data, decode JWTs and convert colors.',
    seoTitle: 'Free Online Developer Tools: JSON, JWT, Hash | Stayput',
    seoDescription:
      'Format JSON, encode Base64 and URLs, generate UUIDs and hashes, decode JWTs and minify CSS. Tokens and payloads stay in your browser.',
    intro:
      'Everyday developer utilities that run locally. That matters when you are pasting tokens, payloads or customer data.',
  },
  {
    id: 'calculators',
    slug: 'calculators',
    name: 'Calculators',
    navName: 'Calculators',
    icon: 'Calculator',
    tagline: 'Loans, savings, tax, dates, health and everyday math.',
    seoTitle: 'Free Online Calculators: Loan, SIP, GST, Age | Stayput',
    seoDescription:
      'Calculate loan EMI, SIP returns, compound interest, GST, discounts, age, BMI and dates. Numbers you type stay in your browser.',
    intro: 'Quick calculators for money, dates and everyday sums. Everything is computed in this tab, so the figures you enter are never sent anywhere.',
  },
  {
    id: 'utilities',
    slug: 'utilities',
    name: 'Timers and Utilities',
    navName: 'Utilities',
    icon: 'Timer',
    tagline: 'Timers, random pickers, speed tests and keyboard checks.',
    seoTitle: 'Free Online Timers, Random Pickers and Tests | Stayput',
    seoDescription:
      'Use an online stopwatch, countdown and Pomodoro timer, spin a picker wheel, roll dice, and test your reaction time and click speed.',
    intro: 'Small interactive utilities that run in the page: timers, random pickers and quick tests. Nothing you do here is uploaded.',
  },
]

export const categoryById = (id: CategoryId): Category => categories.find((c) => c.id === id)!
export const categoryBySlug = (slug: string): Category | undefined => categories.find((c) => c.slug === slug)
