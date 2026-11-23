import { describe, expect, it } from 'vitest'
import { markdownToHtml, safeLinkUrl } from '@/lib/dev/markdownHtml'
import { jsonToXml, sanitizeName, xmlToJson } from '@/lib/dev/jsonXml'
import { TOKEN_ALPHABETS, clampInt, entropyBits, generateTokens, randomFromAlphabet } from '@/lib/dev/randomToken'
import { convertBulk, convertLine, rowsToCsv } from '@/lib/dev/bulkTimestamp'
import { EMOJIS, EMOJI_CATEGORIES, searchEmojis } from '@/lib/emoji/emojiData'

describe('markdown to html', () => {
  it('renders headings, emphasis, code and links', () => {
    const html = markdownToHtml('# Title\n\nHello **bold** and *em* and `code` and [x](https://a.com "T").')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<a href="https://a.com" title="T">x</a>')
  })
  it('handles setext headings and hr', () => {
    expect(markdownToHtml('Title\n=====')).toBe('<h1>Title</h1>')
    expect(markdownToHtml('Sub\n---')).toBe('<h2>Sub</h2>')
    expect(markdownToHtml('***')).toBe('<hr>')
  })
  it('renders nested and ordered lists', () => {
    const html = markdownToHtml('- a\n  - b\n  - c\n- d\n\n3. x\n4. y')
    expect(html).toContain('<li>a\n<ul>\n<li>b</li>\n<li>c</li>\n</ul>\n</li>')
    expect(html).toContain('<li>d</li>')
    expect(html).toContain('<ol start="3">')
  })
  it('makes loose lists with paragraphs', () => {
    expect(markdownToHtml('- a\n\n- b')).toContain('<li><p>a</p></li>')
  })
  it('renders fenced code with escaping and language', () => {
    const html = markdownToHtml('```js\nif (a < b) {}\n```')
    expect(html).toBe('<pre><code class="language-js">if (a &lt; b) {}\n</code></pre>')
  })
  it('renders blockquotes and tables', () => {
    expect(markdownToHtml('> quote\n> more')).toContain('<blockquote>\n<p>quote\nmore</p>\n</blockquote>')
    const t = markdownToHtml('| A | B |\n| :-- | --: |\n| 1 | 2 |')
    expect(t).toContain('<th style="text-align:left">A</th>')
    expect(t).toContain('<td style="text-align:right">2</td>')
  })
  it('escapes raw html and blocks javascript urls', () => {
    const html = markdownToHtml('<script>alert(1)</script> & <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(markdownToHtml('[x](javascript:alert(1))')).not.toContain('href')
    expect(markdownToHtml('[x](  JaVa\tScRiPt:alert(1))')).not.toContain('href')
    expect(markdownToHtml('![a](data:text/html;base64,AAAA)')).not.toContain('<img')
    expect(markdownToHtml('[x](https://a.com/"onmouseover="x)')).not.toContain('onmouseover="')
    expect(safeLinkUrl('/docs#a')).toBe('/docs#a')
    expect(safeLinkUrl('vbscript:x')).toBe('')
  })
  it('renders images and escapes attributes', () => {
    expect(markdownToHtml('![A "cat"](https://x.com/c.png)')).toContain('<img src="https://x.com/c.png" alt="A &quot;cat&quot;">')
  })
  it('keeps underscores inside words', () => {
    expect(markdownToHtml('snake_case_name and _em_')).toBe('<p>snake_case_name and <em>em</em></p>')
  })
  it('supports hard breaks and strikethrough', () => {
    expect(markdownToHtml('a  \nb ~~x~~')).toBe('<p>a<br>\nb <del>x</del></p>')
  })
})

describe('json to xml', () => {
  const opts = { root: 'root', indent: 2 as const, declaration: false }
  it('converts attributes, arrays and nulls', () => {
    const r = jsonToXml('{"lib":{"@name":"A","book":[{"@id":1,"t":"x"},{"@id":2,"t":"y"}],"n":null}}', opts)
    expect(r.ok && r.output).toBe('<lib name="A">\n  <book id="1">\n    <t>x</t>\n  </book>\n  <book id="2">\n    <t>y</t>\n  </book>\n  <n/>\n</lib>\n')
  })
  it('wraps multiple top-level keys and arrays in the root name', () => {
    const a = jsonToXml('{"a":1,"b":"two"}', { ...opts, root: 'data', indent: 0 })
    expect(a.ok && a.output).toBe('<data><a>1</a><b>two</b></data>')
    const b = jsonToXml('[1,2]', { ...opts, indent: 0 })
    expect(b.ok && b.output).toBe('<root><item>1</item><item>2</item></root>')
  })
  it('escapes and handles #text', () => {
    const r = jsonToXml('{"p":{"@a":"x\\"<y","#text":"1 < 2 & 3"}}', { ...opts, indent: 0 })
    expect(r.ok && r.output).toBe('<p a="x&quot;&lt;y">1 &lt; 2 &amp; 3</p>')
  })
  it('adds declaration, fixes bad names and reports bad JSON', () => {
    const r = jsonToXml('{"my key":{"1x":1,"b":2}}', { ...opts, declaration: true, indent: 0 })
    expect(r.ok && r.output).toBe('<?xml version="1.0" encoding="UTF-8"?><my_key><_1x>1</_1x><b>2</b></my_key>')
    expect(r.ok && r.warnings.length).toBe(1)
    expect(sanitizeName('xmlfoo')).toBe('_xmlfoo')
    expect(jsonToXml('{bad', opts).ok).toBe(false)
  })
})

describe('xml to json', () => {
  const o = { indent: 0 as const, inferTypes: true }
  it('converts attributes, repeated elements and text', () => {
    const r = xmlToJson('<l n="A"><b id="1">x</b><b id="2">y</b><c/><d>5</d><e k="v">t</e></l>', o)
    expect(r.ok && JSON.parse(r.output)).toEqual({ l: { '@n': 'A', b: [{ '@id': 1, '#text': 'x' }, { '@id': 2, '#text': 'y' }], c: null, d: 5, e: { '@k': 'v', '#text': 't' } } })
  })
  it('keeps strings when type conversion is off or lossy', () => {
    const a = xmlToJson('<a><v>007</v><w>1.50</w><x>true</x></a>', o)
    expect(a.ok && JSON.parse(a.output)).toEqual({ a: { v: '007', w: '1.50', x: true } })
    const b = xmlToJson('<a><x>5</x></a>', { indent: 0, inferTypes: false })
    expect(b.ok && JSON.parse(b.output)).toEqual({ a: { x: '5' } })
  })
  it('reports malformed xml', () => {
    expect(xmlToJson('<a><b></a>', o).ok).toBe(false)
  })
  it('round trips', () => {
    const j = '{"r":{"@id":"1","i":["a","b"]}}'
    const x = jsonToXml(j, { root: 'root', indent: 0, declaration: false })
    const back = x.ok && xmlToJson(x.output, { indent: 0, inferTypes: false })
    expect(back && back.ok && JSON.parse(back.output)).toEqual(JSON.parse(j))
  })
})

describe('random tokens', () => {
  it('generates the requested shape', () => {
    const t = generateTokens({ format: 'hex', length: 40, count: 3, prefix: 'sk_ ' })
    expect(t).toHaveLength(3)
    for (const s of t) expect(s).toMatch(/^sk_[0-9a-f]{40}$/)
    expect(generateTokens({ format: 'base64url', length: 64, count: 1, prefix: '' })[0]).toMatch(/^[A-Za-z0-9_-]{64}$/)
    expect(generateTokens({ format: 'alphanumeric', length: 20, count: 1, prefix: '' })[0]).toMatch(/^[a-z0-9]{20}$/)
  })
  it('clamps length and count', () => {
    expect(generateTokens({ format: 'hex', length: 1, count: 0, prefix: '' })[0]).toHaveLength(4)
    expect(generateTokens({ format: 'hex', length: 9999, count: 9999, prefix: '' })).toHaveLength(100)
    expect(clampInt(NaN, 1, 5)).toBe(1)
  })
  it('rejects biased bytes', () => {
    // 62 symbols: limit is 248, so bytes 248..255 must be skipped.
    const seq = [255, 250, 248, 0, 1, 61, 62]
    let pos = 0
    const out = randomFromAlphabet(TOKEN_ALPHABETS.base62, 4, (b) => {
      for (let i = 0; i < b.length; i++) b[i] = seq[pos++ % seq.length]
    })
    expect(out).toBe(TOKEN_ALPHABETS.base62[0] + TOKEN_ALPHABETS.base62[1] + TOKEN_ALPHABETS.base62[61] + TOKEN_ALPHABETS.base62[0])
  })
  it('is roughly uniform', () => {
    const s = randomFromAlphabet(TOKEN_ALPHABETS.base62, 62000)
    const counts = new Map<string, number>()
    for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1)
    expect(counts.size).toBe(62)
    for (const n of counts.values()) expect(n).toBeGreaterThan(800)
  })
  it('computes entropy', () => {
    expect(entropyBits('hex', 32)).toBe(128)
    expect(entropyBits('base64url', 32)).toBe(192)
    expect(entropyBits('base62', 32)).toBeCloseTo(190.5, 1)
  })
})

describe('bulk timestamp converter', () => {
  it('detects units', () => {
    expect(convertLine('1700000000', 'utc', 'auto')).toMatchObject({ unit: 's', iso: '2023-11-14T22:13:20.000Z', seconds: 1700000000 })
    expect(convertLine('1700000000123', 'utc', 'auto')).toMatchObject({ unit: 'ms', iso: '2023-11-14T22:13:20.123Z' })
    expect(convertLine('1700000000123456', 'utc', 'auto')).toMatchObject({ unit: 'us' })
    expect(convertLine('1700000000', 'utc', 'ms')).toMatchObject({ unit: 'ms', iso: '1970-01-20T16:13:20.000Z' })
    expect(convertLine('-86400', 'utc', 'auto').iso).toBe('1969-12-31T00:00:00.000Z')
  })
  it('formats in UTC', () => {
    expect(convertLine('0', 'utc', 'auto').formatted).toBe('1970-01-01 00:00:00 UTC')
  })
  it('parses dates in the chosen zone', () => {
    const r = convertLine('2024-02-29 12:30:00', 'utc', 'auto')
    expect(r).toMatchObject({ kind: 'date', iso: '2024-02-29T12:30:00.000Z', seconds: 1709209800 })
    const local = convertLine('2024-02-29 12:30:00', 'local', 'auto')
    expect(local.ms).toBe(new Date(2024, 1, 29, 12, 30, 0).getTime())
    expect(local.formatted).toMatch(/^2024-02-29 12:30:00 UTC[+-]\d\d:\d\d$/)
    expect(convertLine('2025-01-01T00:00:00Z', 'local', 'auto').iso).toBe('2025-01-01T00:00:00.000Z')
    expect(convertLine('2024-01-15', 'utc', 'auto').iso).toBe('2024-01-15T00:00:00.000Z')
  })
  it('flags bad input', () => {
    expect(convertLine('hello', 'utc', 'auto').kind).toBe('error')
    expect(convertLine('2024-02-31', 'utc', 'auto').kind).toBe('error')
    expect(convertLine('9999999999999999999999999', 'utc', 'auto').kind).toBe('error')
  })
  it('converts many lines and builds CSV', () => {
    const { rows, truncated } = convertBulk('1\n\n2024-01-01\nbad, "x"', 'utc', 'auto')
    expect(rows).toHaveLength(3)
    expect(truncated).toBe(false)
    const csv = rowsToCsv(rows)
    expect(csv.split('\n')[0]).toBe('input,type,unit,unix_seconds,unix_ms,iso_utc,formatted,error')
    expect(csv).toContain('"bad, ""x"""')
    expect(convertBulk('1\n2\n3', 'utc', 'auto', 2).truncated).toBe(true)
  })
})

describe('emoji data', () => {
  it('has a few hundred unique entries in every category', () => {
    expect(EMOJIS.length).toBeGreaterThan(300)
    expect(new Set(EMOJIS.map((e) => e.char)).size).toBe(EMOJIS.length)
    for (const c of EMOJI_CATEGORIES) expect(EMOJIS.some((e) => e.category === c)).toBe(true)
    for (const e of EMOJIS) {
      expect(e.char.length).toBeGreaterThan(0)
      expect(e.name).toBeTruthy()
    }
  })
  it('searches by name, keyword and emoji', () => {
    expect(searchEmojis('fire')[0].char).toBe('🔥')
    expect(searchEmojis('birthday').map((e) => e.char)).toContain('🎂')
    expect(searchEmojis('love heart').length).toBeGreaterThan(3)
    expect(searchEmojis('zzzzqq')).toHaveLength(0)
    expect(searchEmojis('')).toHaveLength(EMOJIS.length)
  })
})
