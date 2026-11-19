import { describe, expect, it } from 'vitest'
import {
  base64DecodeText,
  base64EncodeText,
  contrastRatio,
  csvEscape,
  decodeHtmlEntities,
  decodeJwt,
  encodeHtmlEntities,
  flattenObject,
  formatJson,
  hashText,
  hslToRgb,
  jsonToCsv,
  minifyCss,
  minifyJson,
  parseHex,
  parseJson,
  rgbToHex,
  rgbToHsl,
  sortKeysDeep,
  urlDecode,
  urlEncode,
  uuidV4,
} from '@/lib/dev'
import { locateJsonError } from '@/lib/dev/jsonScan'

describe('JSON', () => {
  it('formats with chosen indentation', () => {
    expect(formatJson({ a: [1, 2] }, 2)).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}')
    expect(formatJson({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}')
  })
  it('minifies', () => {
    expect(minifyJson({ a: [1, 2], b: 'x' })).toBe('{"a":[1,2],"b":"x"}')
  })
  it('sorts keys deeply', () => {
    expect(JSON.stringify(sortKeysDeep({ b: 1, a: { d: 1, c: 2 } }))).toBe('{"a":{"c":2,"d":1},"b":1}')
  })
  it('parses valid JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  })
  it('locates errors with line and column regardless of the browser message', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": ,\n}')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.line).toBe(3)
      expect(r.error.column).toBe(8)
      expect(r.error.message).toMatch(/Unexpected ","/)
    }
  })
  it.each([
    ['{"a":1,}', 'property name'],
    ["{'a':1}", 'property name'],
    ['[1,2', 'Expected'],
    ['{"a":1} x', 'after the end'],
    ['"abc', 'Unterminated'],
    ['', 'end of input'],
    ['{"a":01}', 'Expected'],
    ['[1 2]', 'Expected'],
    ['{"a" 1}', 'Expected ":"'],
    ['{"a":"\\x"}', 'escape'],
  ])('flags %j', (input, fragment) => {
    const e = locateJsonError(input)
    expect(e).not.toBeNull()
    expect(e!.message).toContain(fragment)
  })
  it('accepts every valid form', () => {
    for (const ok of ['null', 'true', '0', '-1.5e+10', '"a\\u00e9\\n"', '[]', '{}', '[1,[2,{"a":null}]]', ' \n{"a" : 1 }\t']) {
      expect(locateJsonError(ok)).toBeNull()
      expect(() => JSON.parse(ok)).not.toThrow()
    }
  })
})

describe('JSON to CSV', () => {
  it('builds headers from the union of keys and flattens nested objects', () => {
    const csv = jsonToCsv([{ id: 1, user: { name: 'Ada' } }, { id: 2, extra: true }])
    expect(csv.split('\r\n')).toEqual(['id,user.name,extra', '1,Ada,', '2,,true'])
  })
  it('quotes commas, quotes and newlines', () => {
    expect(csvEscape('a,b', ',')).toBe('"a,b"')
    expect(csvEscape('say "hi"', ',')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2', ',')).toBe('"line1\nline2"')
  })
  it('writes arrays as JSON text', () => {
    expect(jsonToCsv([{ tags: ['a', 'b'] }])).toBe('tags\r\n"[""a"",""b""]"')
  })
  it('respects the delimiter', () => {
    expect(jsonToCsv([{ a: 'x;y', b: 1 }], ';')).toBe('a;b\r\n"x;y";1')
  })
  it('neutralizes spreadsheet formulas', () => {
    expect(csvEscape('=SUM(A1:A2)', ',')).toBe("'=SUM(A1:A2)")
    expect(csvEscape('-5', ',')).toBe('-5')
  })
  it('accepts a single object', () => {
    expect(jsonToCsv({ a: 1 })).toBe('a\r\n1')
  })
  it('flattens empty objects without losing the key', () => {
    expect(flattenObject({ a: {} })).toEqual({ a: '' })
  })
})

describe('Base64', () => {
  it('round-trips unicode', () => {
    const text = 'Héllo ✓ 世界 😀'
    expect(base64DecodeText(base64EncodeText(text))).toBe(text)
  })
  it('matches known values', () => {
    expect(base64EncodeText('Hello')).toBe('SGVsbG8=')
    expect(base64DecodeText('SGVsbG8=')).toBe('Hello')
  })
  it('supports URL-safe output and input', () => {
    const s = '??>>~~'
    const safe = base64EncodeText(s, true)
    expect(safe).not.toMatch(/[+/=]/)
    expect(base64DecodeText(safe)).toBe(s)
  })
  it('tolerates whitespace and missing padding', () => {
    expect(base64DecodeText('SGVs\nbG8')).toBe('Hello')
  })
  it('rejects invalid input with a clear message', () => {
    expect(() => base64DecodeText('not base64!')).toThrow(/not valid Base64/)
    expect(() => base64DecodeText('/w==')).toThrow(/UTF-8/)
  })
})

describe('URL encoding', () => {
  it('encodes components and full URLs differently', () => {
    expect(urlEncode('a b&c=d/é', 'component')).toBe('a%20b%26c%3Dd%2F%C3%A9')
    expect(urlEncode('https://x.com/a b?q=é', 'full')).toBe('https://x.com/a%20b?q=%C3%A9')
  })
  it('decodes and rejects malformed input', () => {
    expect(urlDecode('a%20b', 'component')).toBe('a b')
    expect(() => urlDecode('100%', 'component')).toThrow(/Malformed/)
  })
})

describe('uuidV4', () => {
  it('produces valid, unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, uuidV4))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('hashText (Web Crypto)', () => {
  it('matches published test vectors for "abc"', async () => {
    expect(await hashText('abc', 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(await hashText('abc', 'SHA-256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await hashText('abc', 'SHA-384')).toBe('cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7')
    expect(await hashText('abc', 'SHA-512')).toMatch(/^ddaf35a193617aba/)
  })
  it('hashes the empty string', async () => {
    expect(await hashText('', 'SHA-256')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('minifyCss', () => {
  it('removes comments, whitespace and the last semicolon', () => {
    expect(minifyCss('/* c */\n.a { color: red ; margin: 0 auto; }\n.b > .c { top: 0 }')).toBe('.a{color:red;margin:0 auto}.b>.c{top:0}')
  })
  it('leaves strings and url() untouched', () => {
    expect(minifyCss('.a { content: "a  b"; background: url( "x y.png" ) }')).toBe('.a{content:"a  b";background:url("x y.png")}')
    expect(minifyCss('.a{background:url( data:image/svg+xml;utf8,<svg a  b/> )}')).toContain('url(data:image/svg+xml;utf8,<svg a  b/>)')
  })
  it('keeps the descendant combinator before a pseudo-class', () => {
    expect(minifyCss('.a :hover { color: red }')).toBe('.a :hover{color:red}')
  })
  it('keeps !important compact', () => {
    expect(minifyCss('a { color: red ! important; }')).toBe('a{color:red!important}')
  })
})

describe('HTML entities', () => {
  it('encodes the five special characters', () => {
    expect(encodeHtmlEntities(`<a href="x">T&C's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;T&amp;C&#39;s&lt;/a&gt;')
  })
  it('can encode non-ASCII as numeric entities', () => {
    expect(encodeHtmlEntities('é😀', true)).toBe('&#233;&#128512;')
  })
  it('decodes named, decimal and hex entities', () => {
    expect(decodeHtmlEntities('&lt;p&gt; &amp; &#233; &#x1F600; &copy;')).toBe('<p> & é 😀 ©')
  })
  it('does not interpret markup while decoding', () => {
    expect(decodeHtmlEntities('<img src=x onerror=alert(1)>&amp;')).toBe('<img src=x onerror=alert(1)>&')
  })
})

describe('decodeJwt', () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = (payload: unknown) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
  it('decodes header and payload', () => {
    const d = decodeJwt(token({ sub: '42' }))
    expect(d.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(d.payload).toEqual({ sub: '42' })
    expect(d.expired).toBeNull()
  })
  it('reads time claims and expiry', () => {
    const now = new Date('2024-01-01T00:00:00Z')
    const past = decodeJwt(token({ exp: 1700000000, iat: 1690000000 }), now)
    expect(past.expired).toBe(true)
    expect(past.times.map((t) => t.claim)).toEqual(['iat', 'exp'])
    const future = decodeJwt(token({ exp: 1800000000 }), now)
    expect(future.expired).toBe(false)
  })
  it('accepts a Bearer prefix', () => {
    expect(decodeJwt(`Bearer ${token({ a: 1 })}`).payload).toEqual({ a: 1 })
  })
  it('explains what is wrong with bad tokens', () => {
    expect(() => decodeJwt('abc')).toThrow(/three parts/)
    expect(() => decodeJwt('###.###.###')).toThrow(/header/)
    expect(() => decodeJwt(`${b64({})}.###.x`)).toThrow(/payload/)
  })
  it('handles unicode payloads', () => {
    expect(decodeJwt(token({ name: 'Zoë 世界' })).payload).toEqual({ name: 'Zoë 世界' })
  })
})

describe('color conversion', () => {
  it('parses 3 and 6 digit hex, with or without #', () => {
    expect(parseHex('#f80')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseHex('0b7a5e')).toEqual({ r: 11, g: 122, b: 94 })
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#gggggg')).toBeNull()
  })
  it('converts RGB to HEX', () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe('#ff8800')
    expect(rgbToHex({ r: 300, g: -5, b: 0 })).toBe('#ff0000')
  })
  it('converts RGB to HSL for known colors', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 })
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 })
    expect(rgbToHsl({ r: 255, g: 136, b: 0 })).toEqual({ h: 32, s: 100, l: 50 })
  })
  it('converts HSL back to RGB', () => {
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 })
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 })
    expect(hslToRgb({ h: 0, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 })
  })
  it('round-trips within rounding error', () => {
    for (const rgb of [{ r: 11, g: 122, b: 94 }, { r: 200, g: 30, b: 90 }, { r: 5, g: 5, b: 250 }]) {
      const back = hslToRgb(rgbToHsl(rgb))
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(3)
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(3)
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(3)
    }
  })
  it('computes WCAG contrast', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0)
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
  })
})

describe('minifyCss edge cases', () => {
  it('ignores quotes inside comments and comment markers inside strings', () => {
    expect(minifyCss(`/* it's a comment */ .a { content: "/* not a comment */"; }`)).toBe('.a{content:"/* not a comment */"}')
  })
  it('keeps media queries valid', () => {
    expect(minifyCss('@media (min-width: 600px) and (max-width: 900px) { .a { top: calc( 1px + 2px ) } }')).toBe(
      '@media (min-width:600px) and (max-width:900px){.a{top:calc(1px + 2px)}}',
    )
  })
})
