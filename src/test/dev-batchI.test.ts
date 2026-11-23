import { describe, expect, it } from 'vitest'
import { expandedPaths, formatPath, parseJson, searchJson, splitMatches } from '@/lib/dev/jsonViewer'
import { evaluateJsonPath } from '@/lib/dev/jsonPath'
import { beautifyHtml, minifyHtml } from '@/lib/dev/html'
import { AesError, HEADER_LEN, bytesToBase64, base64ToBytes, decryptBytes, decryptText, encryptBytes, encryptText } from '@/lib/dev/aes'
import {
  analyzeChars,
  decodeNumericEntities,
  decodeUtf8Strict,
  graphemeCount,
  parseCodePoints,
  parseUtf8Hex,
  toCodePoints,
  toCssEscapes,
  toHtmlEntities,
  toJsEscapes,
  toUtf16Units,
  toUtf8Hex,
  unescapeCss,
  unescapeJs,
} from '@/lib/dev/unicode'

describe('json viewer helpers', () => {
  it('formats paths', () => {
    expect(formatPath(['a', 0, 'first name', "it's"])).toBe("$.a[0]['first name']['it\\'s']")
    expect(formatPath([])).toBe('$')
  })
  it('reports line and column for invalid JSON', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": }')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.line).toBe(3)
      expect(r.column).toBeGreaterThan(0)
    }
  })
  it('accepts valid JSON and rejects empty input', () => {
    expect(parseJson('[1,2]')).toEqual({ ok: true, value: [1, 2] })
    expect(parseJson('  ').ok).toBe(false)
  })
  it('searches keys and values and lists ancestors', () => {
    const r = searchJson({ users: [{ name: 'Ada', age: 3 }, { name: 'Bob' }], note: 'ada lovelace' }, 'ada')
    expect(r.count).toBe(2)
    expect(r.matches.has('$.users[0].name')).toBe(true)
    expect(r.ancestors.has('$.users[0]')).toBe(true)
    expect(r.ancestors.has('$')).toBe(true)
    expect(searchJson({ a: 1 }, '').count).toBe(0)
  })
  it('splits text into highlight pieces', () => {
    expect(splitMatches('Foo bar foo', 'foo')).toEqual([
      { text: 'Foo', hit: true },
      { text: ' bar ', hit: false },
      { text: 'foo', hit: true },
    ])
  })
  it('limits how many nodes expand', () => {
    const big = Array.from({ length: 1000 }, () => ({ a: { b: {} } }))
    const { paths, truncated } = expandedPaths(big, 5, 50)
    expect(paths.size).toBeLessThanOrEqual(50)
    expect(truncated).toBe(true)
    expect(expandedPaths({ a: { b: 1 } }, 0).paths.size).toBe(1)
  })
})

const store = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553', price: 8.99 },
      { category: 'fiction', author: 'Tolkien', title: 'Rings', isbn: '0-395', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
}
const vals = (expr: string, data: unknown = store) => {
  const r = evaluateJsonPath(data, expr)
  if (!r.ok) throw new Error(r.error)
  return r.nodes.map((n) => n.value)
}

describe('json path', () => {
  it('handles names, brackets, wildcards', () => {
    expect(vals('$.store.bicycle.color')).toEqual(['red'])
    expect(vals("$['store']['bicycle']['color']")).toEqual(['red'])
    expect(vals('$.store.book[*].author')).toHaveLength(4)
    expect(vals('$')).toEqual([store])
  })
  it('handles indexes including negative', () => {
    expect(vals('$.store.book[0].title')).toEqual(['Sayings'])
    expect(vals('$.store.book[-1].title')).toEqual(['Rings'])
    expect(vals('$.store.book[9]')).toEqual([])
  })
  it('handles slices with steps', () => {
    const d = [0, 1, 2, 3, 4, 5]
    expect(vals('$[1:3]', d)).toEqual([1, 2])
    expect(vals('$[:2]', d)).toEqual([0, 1])
    expect(vals('$[-2:]', d)).toEqual([4, 5])
    expect(vals('$[::2]', d)).toEqual([0, 2, 4])
    expect(vals('$[::-1]', d)).toEqual([5, 4, 3, 2, 1, 0])
    expect(vals('$[4:1:-2]', d)).toEqual([4, 2])
    expect(vals('$[::0]', d)).toEqual([])
  })
  it('handles unions', () => {
    expect(vals('$.store.book[0,2].title')).toEqual(['Sayings', 'Moby Dick'])
    expect(vals("$.store.bicycle['price','color']")).toEqual([19.95, 'red'])
  })
  it('handles recursive descent in document order', () => {
    expect(vals('$..price')).toEqual([8.95, 12.99, 8.99, 22.99, 19.95])
    expect(vals('$..name', { name: 'top', a: { name: 'inner' } })).toEqual(['top', 'inner'])
    expect(vals('$..[0]', [[1, 2], [3]])).toEqual([[1, 2], 1, 3])
  })
  it('handles filters', () => {
    expect(vals('$.store.book[?(@.price < 10)].title')).toEqual(['Sayings', 'Moby Dick'])
    expect(vals("$.store.book[?(@.price < 10 && @.category == 'fiction')].title")).toEqual(['Moby Dick'])
    expect(vals('$.store.book[?(@.isbn)].title')).toEqual(['Moby Dick', 'Rings'])
    expect(vals('$.store.book[?(!@.isbn)].title')).toEqual(['Sayings', 'Sword'])
    expect(vals("$.store.book[?(@.category == 'reference' || @.price > 20)].title")).toEqual(['Sayings', 'Rings'])
    expect(vals('$.store.book[?@.price >= 22.99].title')).toEqual(['Rings'])
    expect(vals('$[?(@.ok == true)].id', [{ id: 1, ok: true }, { id: 2, ok: false }, { id: 3, ok: null }])).toEqual([1])
    expect(vals('$[?(@.v == null)].id', [{ id: 1, v: null }, { id: 2 }])).toEqual([1])
    expect(vals('$[?(@.price < 10)]', { a: { price: '5' } })).toEqual([])
  })
  it('supports absolute paths and length in filters', () => {
    expect(vals('$.items[?(@.n > $.min)].n', { min: 2, items: [{ n: 1 }, { n: 3 }] })).toEqual([3])
    expect(vals('$[?(@.tags.length > 1)].id', [{ id: 1, tags: ['a'] }, { id: 2, tags: ['a', 'b'] }])).toEqual([2])
  })
  it('returns normalised paths', () => {
    const r = evaluateJsonPath(store, "$.store.book[?(@.isbn)].title")
    expect(r.ok && r.paths).toEqual(["$['store']['book'][2]['title']", "$['store']['book'][3]['title']"])
  })
  it('reports errors instead of throwing', () => {
    for (const bad of ['', 'store.book', '$.store.[', "$['a'", '$.a[?(@.b ==)]', '$.a[?(@.b = 1)]', '$.a[?(@.b < 1', "$['abc", '$..', '$[1:2:3:4]', '$.a b']) {
      const r = evaluateJsonPath(store, bad)
      expect(r.ok, bad).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5)
    }
  })
  it('does not execute code in filters', () => {
    const r = evaluateJsonPath({ a: [1] }, '$.a[?(alert(1))]')
    expect(r.ok).toBe(false)
    expect(evaluateJsonPath({ a: [1] }, "$.a[?(@.constructor == 'x')]").ok).toBe(true)
  })
  it('does not read prototype properties', () => {
    expect(vals('$.constructor', {})).toEqual([])
    expect(vals('$.toString', {})).toEqual([])
  })
})

describe('html formatter', () => {
  it('indents nested blocks and keeps inline elements inline', () => {
    const out = beautifyHtml('<div><p>Hello <b>big</b> world</p><ul><li>a</li><li>b</li></ul></div>')
    expect(out).toBe('<div>\n  <p>Hello <b>big</b> world</p>\n  <ul>\n    <li>a</li>\n    <li>b</li>\n  </ul>\n</div>')
  })
  it('supports tabs and void elements', () => {
    const out = beautifyHtml('<div><img src="a.png"><br><input type=text><p>x</p></div>', { indent: 'tab' })
    expect(out).toBe('<div>\n\t<img src="a.png"><br><input type=text>\n\t<p>x</p>\n</div>')
  })
  it('keeps pre, textarea, script and style verbatim', () => {
    const src = '<div><pre>  a\n   b  <b>x</b>\n</pre><textarea>\n  t  </textarea><script>if (a < b) {\n   x()\n}</script><style>a  {color:red}</style></div>'
    const out = beautifyHtml(src)
    expect(out).toContain('<pre>  a\n   b  <b>x</b>\n</pre>')
    expect(out).toContain('<textarea>\n  t  </textarea>')
    expect(out).toContain('<script>if (a < b) {\n   x()\n}</script>')
    expect(out).toContain('<style>a  {color:red}</style>')
  })
  it('can indent script bodies', () => {
    const out = beautifyHtml('<body><script>\n  var a = 1;\n    var b = 2;\n</script></body>', { indentScripts: true })
    expect(out).toBe('<body>\n  <script>\n    var a = 1;\n      var b = 2;\n  </script>\n</body>')
  })
  it('keeps comments and doctype', () => {
    const out = beautifyHtml('<!DOCTYPE html><html><head><!-- hi --><title>T</title></head><body></body></html>')
    expect(out.split('\n')[0]).toBe('<!DOCTYPE html>')
    expect(out).toContain('  <!-- hi -->')
    expect(out).toContain('<body></body>')
  })
  it('wraps long attribute lists when asked', () => {
    const src = '<form action="https://example.com/a/very/long/path" class="button button-primary" id="main-link" data-x="1"><p>Go</p></form>'
    const wrapped = beautifyHtml(`<div>${src}</div>`, { wrapAttributes: true, wrapWidth: 60 })
    const plain = beautifyHtml(`<div>${src}</div>`, { wrapAttributes: false })
    expect(wrapped).toContain('\n    class="button button-primary"')
    expect(wrapped).toContain('data-x="1">\n')
    expect(plain.split('\n').length).toBeLessThan(wrapped.split('\n').length)
  })
  it('is idempotent', () => {
    const src = '<!DOCTYPE html><html><head><title>x</title><style>\n a{b:c}\n</style></head><body><div class="a"><p>Some <em>long</em> text with <a href="#">a link</a>, and more text that goes on and on and on until it passes the width limit of the line.</p><pre>\n  keep\n</pre><ul><li>one<li>two</ul><script>\n  x()\n</script></div></body></html>'
    for (const opts of [{}, { indentScripts: true }, { indent: 4 as const, wrapAttributes: true }]) {
      const once = beautifyHtml(src, opts)
      expect(beautifyHtml(once, opts)).toBe(once)
    }
  })
  it('does not fix invalid HTML', () => {
    const out = beautifyHtml('<div><span>open</div>')
    expect(out).toContain('<span>')
    expect(out).not.toContain('</span>')
    expect(beautifyHtml('</p>stray')).toContain('</p>')
  })
  it('treats a literal < as text', () => {
    expect(beautifyHtml('<p>1 < 2</p>')).toBe('<p>1 < 2</p>')
  })
  it('minifies whitespace and comments', () => {
    const src = '<div>\n  <!-- note -->\n  <p>Hello   <b>there</b>\n   friend</p>\n  <p> a </p>\n</div>'
    expect(minifyHtml(src)).toBe('<div><p>Hello <b>there</b> friend</p><p>a</p></div>')
    expect(minifyHtml(src, { removeComments: false })).toContain('<!-- note -->')
  })
  it('minify keeps pre, textarea, script, style and inline spaces', () => {
    const src = '<p><b>a</b> <i>b</i></p>\n<pre>\n  x  \n</pre>\n<script>\n  var a  =  1;\n</script><style> a { } </style><textarea> t </textarea>'
    const out = minifyHtml(src)
    expect(out).toContain('<b>a</b> <i>b</i>')
    expect(out).toContain('<pre>\n  x  \n</pre>')
    expect(out).toContain('<script>\n  var a  =  1;\n</script>')
    expect(out).toContain('<style> a { } </style>')
    expect(out).toContain('<textarea> t </textarea>')
    expect(minifyHtml('<!--[if IE]><p>x</p><![endif]-->')).toContain('[if IE]')
  })
})

describe('aes tool', () => {
  const IT = 1000
  it('round-trips text', async () => {
    const c = await encryptText('héllo 😀 wörld', 'correct horse', IT)
    expect(await decryptText(c, 'correct horse')).toBe('héllo 😀 wörld')
  })
  it('round-trips empty text and binary data', async () => {
    expect(await decryptText(await encryptText('', 'pw', IT), 'pw')).toBe('')
    const data = Uint8Array.from({ length: 5000 }, (_, i) => i % 256)
    const enc = await encryptBytes(data, 'pw', IT)
    expect(Array.from(await decryptBytes(enc, 'pw'))).toEqual(Array.from(data))
  })
  it('lays out the bytes as documented', async () => {
    const enc = await encryptBytes(new Uint8Array(10), 'pw', 4321)
    expect(enc.length).toBe(HEADER_LEN + 10 + 16)
    expect(HEADER_LEN).toBe(33)
    expect(enc[0]).toBe(1)
    expect(new DataView(enc.buffer).getUint32(1, false)).toBe(4321)
  })
  it('uses fresh salt and IV each time', async () => {
    const a = await encryptBytes(new Uint8Array(4), 'pw', IT)
    const b = await encryptBytes(new Uint8Array(4), 'pw', IT)
    expect(Array.from(a.slice(5, 33))).not.toEqual(Array.from(b.slice(5, 33)))
    expect(bytesToBase64(a)).not.toBe(bytesToBase64(b))
  })
  it('fails with a wrong password', async () => {
    const enc = await encryptBytes(new Uint8Array([1, 2, 3]), 'right', IT)
    await expect(decryptBytes(enc, 'wrong')).rejects.toThrow(/wrong password or corrupted/i)
  })
  it('detects tampering in the header, ciphertext and tag', async () => {
    const enc = await encryptBytes(new TextEncoder().encode('secret'), 'pw', IT)
    for (const at of [5, 25, HEADER_LEN, enc.length - 1]) {
      const bad = enc.slice()
      bad[at] ^= 1
      await expect(decryptBytes(bad, 'pw')).rejects.toBeInstanceOf(AesError)
    }
    const iter = enc.slice()
    iter[4] ^= 1 // changes the iteration count to another in-range value
    await expect(decryptBytes(iter, 'pw')).rejects.toBeInstanceOf(AesError)
  })
  it('rejects bad input clearly', async () => {
    await expect(decryptBytes(new Uint8Array(10), 'pw')).rejects.toThrow(/too short/)
    const enc = await encryptBytes(new Uint8Array(1), 'pw', IT)
    enc[0] = 9
    await expect(decryptBytes(enc, 'pw')).rejects.toThrow(/version/)
    await expect(encryptBytes(new Uint8Array(1), '', IT)).rejects.toThrow(/password/)
    await expect(encryptBytes(new Uint8Array(1), 'pw', 5)).rejects.toThrow(/Iterations/)
    expect(() => base64ToBytes('!!!')).toThrow(AesError)
  })
  it('says when decrypted data is not text', async () => {
    const enc = bytesToBase64(await encryptBytes(Uint8Array.from([0xff, 0xfe, 0xfd]), 'pw', IT))
    await expect(decryptText(enc, 'pw')).rejects.toThrow(/not text/)
  })
})

describe('unicode converter', () => {
  const s = 'A😀é'
  it('writes code points, UTF-8 and UTF-16', () => {
    expect(toCodePoints(s)).toBe('U+0041 U+1F600 U+00E9')
    expect(toUtf8Hex(s)).toBe('41 F0 9F 98 80 C3 A9')
    expect(toUtf16Units(s)).toBe('0041 D83D DE00 00E9')
  })
  it('writes entities and escapes', () => {
    expect(toHtmlEntities(s, 'dec')).toBe('&#65;&#128512;&#233;')
    expect(toHtmlEntities(s, 'hex', 'nonAscii')).toBe('A&#x1F600;&#xE9;')
    expect(toJsEscapes(s)).toBe('\\u0041\\uD83D\\uDE00\\u00E9')
    expect(toJsEscapes(s, 'es6', 'nonAscii')).toBe('A\\u{1F600}\\u00E9')
    expect(toCssEscapes(s, 'nonAscii')).toBe('A\\1F600 \\E9')
    expect(toCssEscapes('éa', 'nonAscii')).toBe('\\E9 a') // a is a hex digit, so a space is required
    expect(toCssEscapes('éx', 'nonAscii')).toBe('\\E9x')
  })
  it('parses code points', () => {
    expect(parseCodePoints('U+41 1F600, 0xE9').text).toBe('A😀é')
    const r = parseCodePoints('U+110000 zz 41')
    expect(r.text).toBe('A')
    expect(r.errors).toHaveLength(2)
  })
  it('unescapes JavaScript escapes with surrogate pairs', () => {
    expect(unescapeJs('\\uD83D\\uDE00 \\u{1F600} \\x41\\n').text).toBe('😀 😀 A\n')
    expect(unescapeJs('\\u12').errors).toHaveLength(1)
    expect(unescapeJs('\\u{110000}').errors).toHaveLength(1)
    expect(unescapeJs('end\\').errors).toHaveLength(1)
  })
  it('decodes numeric entities and CSS escapes', () => {
    expect(decodeNumericEntities('&#128512; &#x1F600; &#65; &amp;').text).toBe('😀 😀 A &amp;')
    expect(decodeNumericEntities('&#0; &#xD800;').errors).toHaveLength(2)
    expect(unescapeCss('\\1F600 x\\E9 a').text).toBe('😀xéa')
  })
  it('decodes UTF-8 and reports invalid sequences', () => {
    expect(parseUtf8Hex('41 F0 9F 98 80 C3 A9').text).toBe('A😀é')
    expect(parseUtf8Hex('0x41,0xC3,0xA9').text).toBe('Aé')
    expect(parseUtf8Hex('zz').errors).toHaveLength(1)
    const lone = decodeUtf8Strict(Uint8Array.from([0x80]))
    expect(lone.errors[0]).toMatch(/continuation/)
    expect(decodeUtf8Strict(Uint8Array.from([0xc0, 0xaf])).errors[0]).toMatch(/lead byte/)
    expect(decodeUtf8Strict(Uint8Array.from([0xe0, 0x80, 0xaf])).errors[0]).toMatch(/overlong/)
    expect(decodeUtf8Strict(Uint8Array.from([0xed, 0xa0, 0x80])).errors[0]).toMatch(/surrogate/)
    expect(decodeUtf8Strict(Uint8Array.from([0xf0, 0x9f])).errors[0]).toMatch(/cut off/)
    const cut = decodeUtf8Strict(Uint8Array.from([0xe2, 0x41]))
    expect(cut.text).toBe('�A')
    expect(decodeUtf8Strict(Uint8Array.from([0xf5])).errors).toHaveLength(1)
  })
  it('analyses characters', () => {
    const { rows, total } = analyzeChars('A😀é1 ')
    expect(total).toBe(5)
    expect(rows.map((r) => r.category)).toEqual(['Lu', 'So', 'Ll', 'Nd', 'Zs'])
    expect(rows[1]).toMatchObject({ cp: 0x1f600, utf8: 4, utf16: 2 })
    expect(analyzeChars('\uD800')[ 'rows' ][0].category).toBe('Cs')
    expect(analyzeChars('abcdef', 3).rows).toHaveLength(3)
  })
  it('counts graphemes when supported', () => {
    const n = graphemeCount('👨‍👩‍👧é')
    if (n !== null) expect(n).toBe(2)
  })
})
