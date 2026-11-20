export interface BlogSection {
  heading: string
  paragraphs: string[]
}

export interface BlogPost {
  slug: string
  title: string
  seoTitle: string
  seoDescription: string
  excerpt: string
  image: string
  imageAlt: string
  publishedAt: string
  publishedLabel: string
  toolSlug: string
  toolCta: string
  sections: BlogSection[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'compress-images-for-the-web',
    title: 'How to compress images for the web without making them look rough',
    seoTitle: 'How to Compress Images for the Web | Stayput',
    seoDescription:
      'Learn how to reduce image file sizes for websites, choose JPG, PNG or WebP, and check quality before you publish.',
    excerpt:
      'Large image files slow down pages and take longer to share. A little care with format, dimensions and quality can make them lighter without making them look obviously worse.',
    image: '/blog/images/compressing-photos.webp',
    imageAlt: 'A close view of camera lenses on a dark wooden surface',
    publishedAt: '2026-11-20',
    publishedLabel: 'November 20, 2026',
    toolSlug: 'image-compressor',
    toolCta: 'Compress images in your browser',
    sections: [
      {
        heading: 'Image compression for the web starts with the job',
        paragraphs: [
          'When people search for a way to compress images for the web, they usually have a practical problem: a page is slow, an upload form rejects a photo, or a folder of images is too large to send. The answer depends on what the image contains and where it will appear. A product photo, a screenshot with small text, and a transparent logo do not respond to the same settings.',
          'Compression removes or reorganizes data in an image so the file takes fewer bytes. Those bytes affect how long a browser waits to download the picture. They also affect storage and upload limits. The goal is to make the file small enough for its use while keeping the details people need to see. There is no single file size that counts as right for every image.',
        ],
      },
      {
        heading: 'Choose a format that suits the image',
        paragraphs: [
          'JPG is a familiar choice for photographs. It uses lossy compression, which means the encoder discards some image detail to reduce the file. At a moderate setting, the change is often hard to notice at normal viewing size. Lowering the quality too far can create blocky patches around edges, muddy texture, or halos near high-contrast lines.',
          'PNG keeps pixel values intact, so it works well for crisp interface graphics, diagrams, and images that need transparency. A PNG photo can be surprisingly large because it preserves fine photographic detail without the same kind of loss. WebP can store photographic images with lossy compression and also supports transparency. Browser support is broad, but check whether the place you plan to use the file accepts it.',
          'A format change is not automatically an improvement. Converting a small PNG icon to JPG can introduce fuzzy edges and remove transparency. Converting a photo from PNG to JPG or WebP may save much more space. Keep the original format when compatibility or editing matters more than a smaller download.',
        ],
      },
      {
        heading: 'Adjust quality, then inspect the difficult areas',
        paragraphs: [
          'A quality slider is a useful starting point, not a promise that every image will shrink by the same amount. A smooth sky or plain wall compresses differently from leaves, hair, fabric, and grain. Text over a photo can be a useful stress test because artifacts often show up first around letters and thin lines.',
          'Compare the output with the original at the size people will actually see. Look at faces, small labels, diagonal edges and shadow detail. A close zoom can reveal compression damage that no one would notice on a phone, while a tiny preview can hide flaws that become obvious on a large screen. Use the same display size for both images so the comparison is fair.',
          'If the first setting looks too soft, move the quality up and compare again. If the image still looks unchanged, try a lower setting in small steps. There is no need to chase the smallest possible number if it makes the picture look tired or artificial.',
        ],
      },
      {
        heading: 'Dimensions can matter more than quality',
        paragraphs: [
          'A 4000-pixel-wide photo used in a 600-pixel content column contains many pixels the page will never show at full size. Resizing can remove that unnecessary data before compression. If the destination is known, set dimensions around that use rather than exporting every picture at the camera’s maximum resolution.',
          'Keep the aspect ratio locked unless you have a reason to crop or stretch the picture. Stretching changes the shape of objects; cropping changes what is included. Those are editing decisions, not file compression. If a site uses responsive layouts, leave enough resolution for the largest display it supports and test the image on a smaller screen too.',
          'Image compression and resizing solve related but different problems. A compressor changes how image data is stored. A resizer changes the pixel dimensions. Some workflows need both, but doing only one may be enough.',
        ],
      },
      {
        heading: 'Keep an untouched original',
        paragraphs: [
          'Lossy compression removes information. Saving a compressed JPG over the only copy makes it harder to return to the original later, especially after repeated edits and exports. Keep a source copy in your photo library or project folder, and treat the compressed version as a separate delivery file.',
          'This also makes it easier to create a different size or format later. A compressed image is useful for a page today; the original is useful when a designer asks for a crop, a print version, or a larger hero image next month. File names such as `product-original.jpg` and `product-web.webp` can prevent accidental overwrites.',
        ],
      },
      {
        heading: 'Compress a batch and check every result',
        paragraphs: [
          'Batch processing saves time when a folder contains many similar images. It does not mean every output deserves the same setting without review. Pick a representative mix first, including the most detailed and the least detailed images. If those look good, process the rest and review the sizes and previews before replacing anything on a live site.',
          'A browser-based image compressor can show the original and new byte counts side by side, which makes the result easy to judge. Stayput’s Image Compressor accepts JPG, PNG and WebP files, lets you adjust quality, and can package several outputs into a ZIP. PNG compression is lossless in this tool, so it may save less space than a lossy format for photographs.',
          'Files are processed in the browser, which avoids sending the image to a remote compression service. Your device does the work, so very large files may use substantial memory or take longer on a phone. Keep the originals and open the downloaded files once to confirm they look right in the destination where you plan to use them.',
        ],
      },
      {
        heading: 'A short checklist before publishing',
        paragraphs: [
          'Confirm the image dimensions fit the page, choose a format the destination accepts, and compare the compressed copy at a realistic size. Check small text, transparent edges and fine texture. Then look at the new file size and decide whether the visual tradeoff is worthwhile. If a photo still feels too heavy, resize it to the actual display dimensions before lowering quality further.',
          'These checks take less time than replacing a poor-looking image after it has appeared in a newsletter or gone live on a product page. A good compressed image should load more comfortably while still doing its job: showing the detail, color, or context the viewer came to see.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-merge-pdf-files',
    title: 'How to merge PDF files and keep the pages in the right order',
    seoTitle: 'How to Merge PDF Files in the Right Order | Stayput',
    seoDescription:
      'A practical guide to combining PDF files, planning page order, checking the result and understanding what a merger may not preserve.',
    excerpt:
      'Combining reports, forms or scanned pages is straightforward once the files are prepared. The important work is checking the order and knowing which document details may not carry over.',
    image: '/blog/images/organizing-pdfs.webp',
    imageAlt: 'A notebook and pen on a desk, ready for organizing documents',
    publishedAt: '2026-11-20',
    publishedLabel: 'November 20, 2026',
    toolSlug: 'pdf-merger',
    toolCta: 'Merge PDF files in your browser',
    sections: [
      {
        heading: 'Start by planning the combined document',
        paragraphs: [
          'A PDF merger combines two or more PDF files into one document. People often need it for a packet of forms, a report with appendices, receipts for an expense claim, or pages scanned in separate batches. Before choosing a tool, decide what the finished file should contain and in what order. That small bit of planning prevents most avoidable mistakes.',
          'Give the source files names that make their roles clear. “Cover,” “Application,” and “Supporting documents” are easier to arrange than a row of files named `scan001`, `scan002`, and `final-new`. If the order matters, write it down or number copies of the files. A merger can preserve the order you select, but it cannot know the order you intended.',
        ],
      },
      {
        heading: 'Check the source PDFs before merging',
        paragraphs: [
          'Open each source file once and confirm it is the right document. Look at the first and last pages, check that scans are readable, and note page counts. This catches an empty file, a duplicate, or a page rotated sideways before those problems are buried inside a larger document.',
          'Password-protected files that require a password to open usually need to be unlocked in a PDF reader before they can be merged. Do not remove protection from a document unless you are allowed to do so. If the source files contain sensitive information, consider whether the computer and folder you use are appropriate for that material.',
          'If you have a signed PDF, keep a separate copy before changing it. Editing or assembling pages can affect digital signatures. When the signature is important, ask the sender or your organization how the final packet should be prepared and verified.',
        ],
      },
      {
        heading: 'Choose the order before you click merge',
        paragraphs: [
          'A common layout for a submission is a cover page, the main form, evidence or appendices, then any reference material. For a report, put the summary near the beginning and supporting tables after the section that introduces them. For a personal archive, chronological order may be easier to search later.',
          'Check file order and page order as separate things. A merger can place one whole PDF before another, but it may not offer page-by-page rearrangement inside each source file. If a source has pages in the wrong order, rotate, split, or reorganize those pages first with a PDF editor or a page tool, then merge the corrected files.',
          'A quick page-count estimate can help. If three PDFs contain 2, 8 and 4 pages, the combined file should have 14 pages. The count alone will not prove every page is present, but it can reveal a missing source or a failed operation.',
        ],
      },
      {
        heading: 'Merge and inspect the output',
        paragraphs: [
          'After creating the combined PDF, open it in a reader and scan from beginning to end. Confirm the cover is first, the sections follow the intended sequence and the last page is present. Check a few pages from the middle too. A file can open successfully and still contain a document in the wrong position.',
          'Try selecting a sentence or searching for a word if the source PDFs contain selectable text. For scanned documents, inspect the page images at a useful zoom level. Make sure forms, tables and small print remain readable. A merger that copies pages without recompressing them should not reduce visual quality, but it cannot improve a poor scan.',
          'Save the result with a name that tells you what it is and when it was made, such as `application-packet-2026-11.pdf`. If you will revise it, keep the separate source files too. They make it easier to replace one section without rebuilding the entire packet from memory.',
        ],
      },
      {
        heading: 'Know what may not carry over',
        paragraphs: [
          'The visible page content is usually the main thing people need, but PDFs can contain more than pages. Bookmarks, interactive form fields, comments, attachments and metadata may not behave the same way after documents are combined. Stayput’s PDF Merger notes that bookmarks and form fields from source files may not carry over, even though page content is copied.',
          'If the final document depends on a table of contents, fillable fields or embedded files, test those features after merging. You may need to recreate the bookmarks or use a desktop PDF application with more control over document structure. Do not assume that a clean-looking page preview proves every interactive feature survived.',
          'Page labels can also differ from the printed page numbers. A merged packet may show PDF page 12 while the document itself says page 4. If readers need reliable references, add a contents page or check whether your PDF editor can apply consistent page labels.',
        ],
      },
      {
        heading: 'Use a browser merger when it fits the job',
        paragraphs: [
          'For a straightforward packet, a browser-based PDF merger can avoid installing a separate application. Add the source files, reorder them, and download one combined PDF. Stayput shows page counts and flags password-protected files; the tool runs locally in the browser, and the pages are copied without intentional quality reduction.',
          'Local processing can be useful when the documents should not be sent to a conversion service. It still uses your computer’s memory, and large or complicated PDFs may take longer than they would in dedicated desktop software. The tool does not bypass a password or change the contents of a source file for you.',
          'Keep an eye on the browser tab until the download completes, especially with larger documents. Then check the result in a PDF reader and store it somewhere you can find again. If the tool reports an error, keep your source documents unchanged and try to identify which file caused it before repeating the task.',
        ],
      },
      {
        heading: 'A repeatable workflow for document packets',
        paragraphs: [
          'Make a working folder, copy in the source files, rename them in the intended order, and check each file before merging. After the operation, review the first page, a few middle pages and the final page. Confirm the page count, text readability and any interactive features that matter. Save the finished file separately from its sources.',
          'That workflow works for a two-file letter packet and a much larger archive. It keeps the original documents available, makes mistakes easier to spot and gives the final PDF a clear purpose. When the document will be submitted to a school, court, employer or government office, also check that organization’s file-size and naming requirements before you send it.',
        ],
      },
    ],
  },
  {
    slug: 'format-and-validate-json',
    title: 'How to format JSON, find syntax errors and read the result',
    seoTitle: 'JSON Formatter: Read, Fix, and Validate JSON | Stayput',
    seoDescription:
      'Learn how to format and validate JSON, understand common syntax errors, and distinguish valid syntax from data that is correct for your app.',
    excerpt:
      'A formatter can make a dense JSON response readable and point to syntax mistakes. Knowing what it checks, and what it cannot check, makes debugging much quicker.',
    image: '/blog/images/reading-json.webp',
    imageAlt: 'A laptop displaying source code in a dark editor',
    publishedAt: '2026-11-20',
    publishedLabel: 'November 20, 2026',
    toolSlug: 'json-formatter',
    toolCta: 'Format and validate JSON',
    sections: [
      {
        heading: 'What a JSON formatter does',
        paragraphs: [
          'JSON is a text format for exchanging structured data. It appears in API responses, configuration files, logs, exports and small databases. A compact response can be difficult to scan, especially when objects and arrays are nested several levels deep. A JSON formatter adds indentation and line breaks so the structure is easier to follow.',
          'Formatting does not change the meaning of valid JSON when the tool only changes whitespace. Minifying does the reverse: it removes unnecessary whitespace to make the text shorter. Validation checks whether the text follows JSON syntax rules. These actions help with different tasks, so decide whether you want a readable layout, a compact string or an error report before copying the output.',
          'A formatter is not a substitute for understanding the data. It can show that a document parses, but it cannot know whether an account ID is the right one, whether a date is allowed by your application or whether a required field is missing from a particular API contract.',
        ],
      },
      {
        heading: 'The rules that catch most JSON errors',
        paragraphs: [
          'Object keys and string values use double quotes. The colon separates each key from its value, and commas separate neighboring members. A comma after the final member is invalid in strict JSON. That trailing comma is easy to leave behind after deleting a field, but JavaScript object literals may allow it while JSON parsers do not.',
          'JSON has a small set of value types: strings, numbers, booleans, null, objects and arrays. Comments are not part of the format. A value such as `undefined` is also not a JSON value, and single-quoted strings do not meet the syntax rules. If a file came from a language-specific configuration format, it may look like JSON without being valid JSON.',
          'Pay attention to quotes and escaping. A quote inside a string must be escaped, and a backslash begins an escape sequence. A Windows path written inside JSON often needs doubled backslashes, such as `C:\\\\Users\\\\Sam`, because a single backslash can introduce an escape character.',
        ],
      },
      {
        heading: 'Use the error position as a starting point',
        paragraphs: [
          'When validation fails, the line and column tell you where the parser stopped understanding the input. The first visible location is not always the original mistake. A missing comma, quote or closing bracket earlier in the file can cause the parser to reach a later character in an unexpected state.',
          'Read the line in context, then inspect the line above it. Check whether each opening brace or bracket has a matching closer, each key has a colon, and neighboring values are separated by commas. If the error occurs near the end of the document, look for a trailing comma or an unfinished string. Fix one issue, validate again and repeat.',
          'If a large file is hard to inspect, copy a small section around the reported position into a scratch copy. Keep the original unchanged. Reducing the input can reveal whether the problem is local or whether an earlier unmatched bracket has changed how the rest of the text is interpreted.',
        ],
      },
      {
        heading: 'Formatting makes nested data easier to inspect',
        paragraphs: [
          'Pretty printing is most useful when the indentation reflects the object structure. Choose a consistent indentation size and scan the left edge of the output. Keys at the same depth should line up. If an array contains objects, each object should be visibly nested under that array, which helps you spot an item placed at the wrong level.',
          'Key sorting can help when two objects contain the same fields in different orders, but it changes the display order and may make a file harder to compare with the original source. Leave it off when order communicates something to your team or when you are reviewing a change that depends on the original sequence.',
          'For a diff, format both versions the same way before comparing them. The comparison becomes easier to read when whitespace is consistent. Be careful if your workflow relies on exact text output, signatures, or a hash of the original file: reformatting changes the bytes even when the parsed values stay the same.',
        ],
      },
      {
        heading: 'Valid JSON can still contain the wrong data',
        paragraphs: [
          'Syntax validation answers one narrow question: can a JSON parser read this text? It does not check the shape required by a program. For example, `{\"count\":\"3\"}` is valid JSON, but an application expecting a number may reject the string value. Both `{\"enabled\":true}` and `{\"enabled\":\"true\"}` parse; only one may match the API’s contract.',
          'For application-level checks, use a schema or the validation tools supplied by the service that consumes the data. Check required properties, allowed values, numeric ranges and relationships between fields. A generic formatter cannot infer those requirements from the JSON text alone.',
          'This distinction matters with configuration files too. A file can parse perfectly and still point to a missing folder or use an unsupported option. Treat the formatter as the first check, then run the application or its own validator to test what the data means in context.',
        ],
      },
      {
        heading: 'Handle sensitive data with care',
        paragraphs: [
          'API responses and configuration files sometimes contain tokens, personal details, internal host names or customer records. Before pasting data into any website, find out where the site processes it and whether the content leaves your device. A browser-based tool can be a better fit for inspection when it performs parsing locally.',
          'Stayput’s JSON Formatter uses the browser’s built-in JSON parser. It formats, minifies and validates the text in the page, reports a line and column for invalid input, and offers indentation and key-sorting options. The site does not upload the JSON. Your browser still holds the text in memory while the page is open, so close the tab when you have finished and follow your organization’s data-handling rules.',
          'Do not paste production secrets into a public issue, chat, or screenshot while asking for help. Replace values with harmless examples and keep the field names and structure that matter to the bug. That gives someone enough context to reason about the JSON without exposing the original data.',
        ],
      },
      {
        heading: 'A simple debugging routine',
        paragraphs: [
          'Start with the exact text that failed, then validate it before editing. Use the reported location to inspect nearby punctuation and matching brackets. Fix the smallest issue, validate again, and format the successful result so you can read the nesting. Compare values with the API or application contract rather than assuming that valid syntax means valid input.',
          'When the output looks right, copy it into the intended file or request and test it in the system that will use it. Keep the original until that test passes. This sequence separates syntax problems from application problems and makes it easier to undo an accidental change.',
        ],
      },
    ],
  },
]

export const blogPostBySlug = (slug: string): BlogPost | undefined => blogPosts.find((post) => post.slug === slug)

export const blogPostWordCount = (post: BlogPost): number =>
  post.sections
    .flatMap((section) => section.paragraphs)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

export const blogReadingTime = (post: BlogPost): number => Math.max(1, Math.ceil(blogPostWordCount(post) / 225))
