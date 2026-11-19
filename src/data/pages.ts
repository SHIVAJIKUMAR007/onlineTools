export interface DocSection {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export interface DocPage {
  path: string
  title: string
  seoTitle: string
  seoDescription: string
  lead: string
  updated?: string
  sections: DocSection[]
}

export const SITE_NAME = 'Stayput'
export const MODEL_HOST = 'huggingface.co'

export const aboutPage: DocPage = {
  path: '/about',
  title: 'About Stayput',
  seoTitle: 'About Stayput: Private Browser-Based Tools',
  seoDescription:
    'Stayput is a collection of free online tools that run entirely in your browser. Learn how it works, what it is built with, and where its limits are.',
  lead: 'Stayput is a set of everyday file and text tools that run on your device. The name is the promise: your files stay put.',
  sections: [
    {
      heading: 'Why it exists',
      paragraphs: [
        'Most online converters ask you to upload a file to a server, wait, then download the result. That means a contract, an ID scan or a family photo passes through a machine you know nothing about.',
        'Modern browsers can do the work themselves. Stayput uses that: images are decoded and encoded with Canvas and WebAssembly codecs, PDFs are edited with JavaScript libraries, and the background remover runs a neural network inside your tab.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When you open a tool, your browser downloads the page and the code for that tool. When you drop in a file, the browser reads it into memory and the tool processes it there. The result is a Blob that you save to disk. No request carries your file anywhere.',
        'You can check this yourself. Open your browser developer tools, switch to the Network tab, and process a file. You will see no upload.',
      ],
    },
    {
      heading: 'What it is built with',
      list: [
        'React, Vite and TypeScript for the app',
        'MozJPEG, WebP, AVIF and OxiPNG codecs compiled to WebAssembly (Squoosh codecs via jSquash)',
        'pdf-lib to edit PDFs and PDF.js to render them',
        'SVGO for SVG optimization',
        'Transformers.js and ONNX Runtime Web for the background remover',
        'JSZip and FileSaver for downloads',
      ],
    },
    {
      heading: 'Limits worth knowing',
      list: [
        'Your device does the work, so very large files are limited by your memory. Phones hit limits sooner than laptops.',
        'The background remover downloads a model the first time you use it. After that it is cached by your browser.',
        'PDF compression in a browser is more limited than desktop tools. The tool explains what each mode does and does not do.',
        'AVIF encoding is slow because the format is expensive to compress.',
      ],
    },
  ],
}

export const privacyPage: DocPage = {
  path: '/privacy',
  title: 'Privacy Policy',
  seoTitle: 'Privacy Policy | Stayput',
  seoDescription:
    'Stayput processes your files locally in your browser. This policy states exactly what stays on your device and the few external resources the site downloads.',
  lead: 'Short version: your files and text never leave your device. This page lists the exceptions precisely.',
  updated: 'November 19, 2026',
  sections: [
    {
      heading: 'What stays on your device',
      paragraphs: [
        'Every tool on this site processes your input inside your browser. Files you choose, text you type or paste, and the results you download are not uploaded, transmitted or stored by us. We do not have a server that receives them.',
      ],
    },
    {
      heading: 'What the site downloads',
      paragraphs: ['Using the site means your browser downloads resources to run it:'],
      list: [
        'The site itself: HTML, CSS, JavaScript, WebAssembly codecs and fonts, served from the site\'s own host. Code for each tool loads only when you open that tool.',
        `AI models for the Background Remover. When you open that tool and process an image for the first time, your browser downloads model files from ${MODEL_HOST} (the Hugging Face model hub and its content delivery network). Your image is not part of that request. The files are cached in your browser so they are not downloaded again.`,
      ],
    },
    {
      heading: 'What we store in your browser',
      paragraphs: [
        'We do not set cookies. We do not use analytics or advertising trackers. The Background Remover stores downloaded model files in your browser Cache Storage so the next visit is faster. You can remove them any time by clearing site data in your browser settings.',
      ],
    },
    {
      heading: 'Server logs',
      paragraphs: [
        'Like any website, the host that serves this site may keep standard access logs such as IP address, requested page and time. Those logs record that a page was requested. They cannot contain your files or text because those never reach the server.',
      ],
    },
    {
      heading: 'Security notes',
      list: [
        'File types are checked by reading the first bytes of the file, not only the extension.',
        'File names are cleaned before they are displayed or used in a download.',
        'Malformed files produce an error message instead of crashing the page.',
        'The JWT decoder only decodes tokens. It does not verify signatures, so decoded content is not proof of authenticity.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: ['If we change what the site downloads or stores, we will update this page and its date.'],
    },
  ],
}

export const termsPage: DocPage = {
  path: '/terms',
  title: 'Terms of Service',
  seoTitle: 'Terms of Service | Stayput',
  seoDescription: 'The terms for using Stayput, a set of free browser-based file and text tools.',
  lead: 'These terms are written to be read. By using Stayput you agree to them.',
  updated: 'November 19, 2026',
  sections: [
    {
      heading: 'Using the tools',
      paragraphs: [
        'Stayput is free to use for personal and commercial work. You are responsible for the files you process and for having the right to process them.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'The tools are provided as is. We test them, but results can vary between browsers and devices, and some files will not convert correctly. Keep your originals. Check important output before you rely on it.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the extent the law allows, we are not liable for loss of data, loss of profit or any other damage that comes from using the site. Because processing is local, you are also responsible for the security of your own device.',
      ],
    },
    {
      heading: 'Third-party components',
      paragraphs: [
        'Stayput includes open-source software under their own licenses, and downloads AI model files published by third parties. The Background Remover offers two models. MODNet is Apache-2.0 licensed. RMBG-1.4 from BRIA AI is licensed for non-commercial use, so check its license before using its output in a commercial project.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: ['Do not use the site to break the law, to attack others, or to try to disrupt the service.'],
    },
    {
      heading: 'Changes',
      paragraphs: ['We may update these terms. The date at the top shows when they last changed.'],
    },
  ],
}

export const docPages: DocPage[] = [aboutPage, privacyPage, termsPage]

export const homeFaqs = [
  {
    q: 'Are my files really not uploaded?',
    a: 'Right. Tools run in your browser, so files are read into memory on your device and never sent to a server. Open your browser Network tab while you use a tool to confirm. The one download is the AI model for the Background Remover, and it does not include your image.',
  },
  {
    q: 'Does it work offline?',
    a: 'After a tool has loaded, most tools keep working without a connection because the processing code is already in your browser. The Background Remover also needs its model to have been downloaded once.',
  },
  {
    q: 'Is there a file size limit?',
    a: 'We do not set one. Your device memory does. Laptops handle large photos and PDFs well. Phones may struggle with very large files, and the tool will tell you when something is too big.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There is no sign-up, no login and no usage cap.',
  },
  {
    q: 'Why are some tools slower than server-based sites?',
    a: 'Your device does the work. Modern phones and laptops are fast, but heavy jobs such as AVIF encoding or AI background removal take longer than they would on a large server.',
  },
  {
    q: 'How is it free?',
    a: 'Because the processing happens on your device, running the site costs very little. There are no ads or tracking.',
  },
]
