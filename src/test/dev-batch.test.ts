import { describe, expect, it } from 'vitest'
import { diffJson, formatDiffReport, summarizeDiff } from '@/lib/dev/jsonDiff'
import { jsonToTypeScript } from '@/lib/dev/jsonToTs'
import { csvToJson, detectDelimiter, parseDelimited } from '@/lib/dev/csv'
import { jsonToYaml } from '@/lib/dev/yaml'
import { formatXml } from '@/lib/dev/xml'
import { formatSql, minifySql } from '@/lib/dev/sql'
import { buildCron, explainCron, nextRuns, parseCron, type ParsedCron } from '@/lib/dev/cron'
import { generateRows, mulberry32, rowsToCsv, rowsToSql, seedFromText } from '@/lib/dev/fake'

describe('json diff', () => {
  it('reports added, removed and changed with paths', () => {
    const d = diffJson({ a: 1, b: { c: [1, 2] }, x: 1 }, { a: 2, b: { c: [1, 2, 3] }, y: 1 })
    expect(d).toEqual([
      { path: '$.a', kind: 'changed', before: 1, after: 2 },
      { path: '$.b.c[2]', kind: 'added', after: 3 },
      { path: '$.x', kind: 'removed', before: 1 },
      { path: '$.y', kind: 'added', after: 1 },
    ])
    expect(summarizeDiff(d)).toMatchObject({ added: 2, removed: 1, changed: 1, total: 4 })
  })
  it('ignores key order by default and reports it when asked', () => {
    expect(diffJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([])
    expect(diffJson({ a: 1, b: 2 }, { b: 2, a: 1 }, { ignoreKeyOrder: false })[0].kind).toBe('reordered')
  })
  it('handles type changes, null and quoted keys', () => {
    const d = diffJson({ 'a b': null }, { 'a b': 0 })
    expect(d[0].path).toBe('$["a b"]')
    expect(diffJson([1], { 0: 1 })[0].path).toBe('$')
    expect(formatDiffReport([])).toBe('No differences found.')
    expect(formatDiffReport(d)).toContain('~ $["a b"]: null -> 0')
  })
})

describe('json to typescript', () => {
  it('builds nested interfaces', () => {
    const out = jsonToTypeScript({ id: 1, tags: ['a'], owner: { name: 'x', age: null } })
    expect(out).toContain('export interface Root {')
    expect(out).toContain('tags: string[]')
    expect(out).toContain('owner: Owner')
    expect(out).toContain('age: null')
  })
  it('merges array objects with optional fields and unions', () => {
    const out = jsonToTypeScript({ items: [{ a: 1, b: 'x' }, { a: 2 }], mixed: [1, 'a', null] })
    expect(out).toContain('b?: string')
    expect(out).toContain('items: Item[]')
    expect(out).toContain('mixed: (number | string | null)[]')
  })
  it('supports type style, no export, root name and quoted keys', () => {
    const out = jsonToTypeScript({ 'first-name': 'a' }, { style: 'type', exportTypes: false, rootName: 'user profile' })
    expect(out).toBe('type UserProfile = {\n  "first-name": string;\n}\n')
  })
  it('handles non-object roots and empty arrays', () => {
    expect(jsonToTypeScript([{ a: 1 }, { a: 2 }])).toContain('export type Root = RootItem[]')
    expect(jsonToTypeScript('x')).toBe('export type Root = string\n')
    expect(jsonToTypeScript({ a: [] })).toContain('a: unknown[]')
  })
})

describe('csv', () => {
  it('parses quotes, escaped quotes and embedded newlines', () => {
    const r = parseDelimited('a,b\r\n"x,1","he said ""hi"""\n"line1\nline2",z\n', ',')
    expect(r.rows).toEqual([['a', 'b'], ['x,1', 'he said "hi"'], ['line1\nline2', 'z']])
  })
  it('reports an unterminated quote', () => {
    expect(parseDelimited('a,"b', ',').error).toBeTruthy()
  })
  it('detects delimiters', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('"a,b",c\n1,2')).toBe(',')
  })
  it('converts to objects with inference, duplicates and ragged rows', () => {
    const r = csvToJson('n,n,ok,v\n1,2.5,true\n,x', { delimiter: 'auto', header: true, shape: 'objects', infer: true })
    expect(r.columns).toEqual(['n', 'n_2', 'ok', 'v'])
    expect(r.value).toEqual([
      { n: 1, n_2: 2.5, ok: true, v: null },
      { n: '', n_2: 'x', ok: null, v: null },
    ])
  })
  it('keeps strings without inference and handles arrays and no header', () => {
    expect(csvToJson('a,b\n1,2', { delimiter: ',', header: true, shape: 'objects', infer: false }).value).toEqual([{ a: '1', b: '2' }])
    expect(csvToJson('a,b\n1,2', { delimiter: ',', header: false, shape: 'objects', infer: false }).value[0]).toEqual({ column_1: 'a', column_2: 'b' })
    expect(csvToJson('a,b\n1,2', { delimiter: ',', header: true, shape: 'arrays', infer: true }).value).toEqual([['a', 'b'], [1, 2]])
    expect(csvToJson('', { delimiter: 'auto', header: true, shape: 'objects', infer: false }).value).toEqual([])
  })
  it('does not turn leading zeros or huge ints into numbers', () => {
    const r = csvToJson('a\n007\n12345678901234567890', { delimiter: ',', header: true, shape: 'objects', infer: true })
    expect(r.value).toEqual([{ a: '007' }, { a: '12345678901234567890' }])
  })
  it('handles unicode', () => {
    expect(csvToJson('名前\n太郎', { delimiter: ',', header: true, shape: 'objects', infer: false }).value).toEqual([{ 名前: '太郎' }])
  })
})

describe('json to yaml', () => {
  it('writes nested structures', () => {
    expect(jsonToYaml({ a: 1, b: [1, { c: 2, d: [] }], e: {} })).toBe('a: 1\nb:\n  - 1\n  - c: 2\n    d: []\ne: {}\n')
  })
  it('quotes ambiguous scalars', () => {
    const y = jsonToYaml({ a: 'true', b: 'null', c: '123', d: 'a: b', e: '- x', f: '', g: ' pad', h: '#c', i: 'plain text', j: '1e3', k: '2020-01-01', l: 'no' })
    expect(y).toContain('a: "true"')
    expect(y).toContain('b: "null"')
    expect(y).toContain('c: "123"')
    expect(y).toContain('d: "a: b"')
    expect(y).toContain('e: "- x"')
    expect(y).toContain('f: ""')
    expect(y).toContain('g: " pad"')
    expect(y).toContain('h: "#c"')
    expect(y).toContain('i: plain text')
    expect(y).toContain('j: "1e3"')
    expect(y).toContain('k: "2020-01-01"')
    expect(y).toContain('l: "no"')
    expect(jsonToYaml({ z: null, t: true, x: 1.5 })).toBe('z: null\nt: true\nx: 1.5\n')
  })
  it('uses block style for multi-line strings', () => {
    expect(jsonToYaml({ s: 'a\nb' })).toBe('s: |-\n  a\n  b\n')
    expect(jsonToYaml({ s: 'a\nb\n' })).toBe('s: |\n  a\n  b\n')
    expect(jsonToYaml({ s: ' a\nb' })).toBe('s: " a\\nb"\n')
  })
  it('supports indent 4, nested arrays and quoted keys', () => {
    expect(jsonToYaml({ a: [[1, 2], { b: 1, c: 2 }] }, 4)).toBe('a:\n    -   - 1\n        - 2\n    -   b: 1\n        c: 2\n')
    expect(jsonToYaml({ 'a: b': 1, true: 2 })).toBe('"a: b": 1\n"true": 2\n')
  })
  it('handles roots', () => {
    expect(jsonToYaml([])).toBe('[]\n')
    expect(jsonToYaml({})).toBe('{}\n')
    expect(jsonToYaml('hi')).toBe('hi\n')
    expect(jsonToYaml('é ünï')).toBe('é ünï\n')
  })
})

describe('xml formatter', () => {
  const src = '<?xml version="1.0"?><root a="1"><!-- c --><item>x</item><item><![CDATA[<b>]]></item><empty></empty></root>'
  it('pretty prints and keeps declaration, comments, CDATA and attributes', () => {
    const r = formatXml(src, { mode: 'pretty', indent: 2 })
    expect(r.ok && r.output).toBe('<?xml version="1.0"?>\n<root a="1">\n  <!-- c -->\n  <item>x</item>\n  <item><![CDATA[<b>]]></item>\n  <empty/>\n</root>\n')
  })
  it('supports tabs and 4 spaces', () => {
    const r = formatXml('<a><b/></a>', { mode: 'pretty', indent: 'tab' })
    expect(r.ok && r.output).toBe('<a>\n\t<b/>\n</a>\n')
    const r4 = formatXml('<a><b/></a>', { mode: 'pretty', indent: 4 })
    expect(r4.ok && r4.output).toBe('<a>\n    <b/>\n</a>\n')
  })
  it('minifies', () => {
    const r = formatXml('<?xml version="1.0"?>\n<a>\n  <b>t</b>\n  <c x="1"/>\n</a>', { mode: 'minify', indent: 2 })
    expect(r.ok && r.output).toBe('<?xml version="1.0"?><a><b>t</b><c x="1"/></a>')
  })
  it('reports malformed XML and handles empty input', () => {
    const r = formatXml('<a><b></a>', { mode: 'pretty', indent: 2 })
    expect(r.ok).toBe(false)
    expect(formatXml('  ', { mode: 'pretty', indent: 2 })).toEqual({ ok: true, output: '' })
  })
  it('escapes text and attribute values', () => {
    const r = formatXml('<a t="x &amp; &quot;y&quot;">1 &lt; 2</a>', { mode: 'pretty', indent: 2 })
    expect(r.ok && r.output).toBe('<a t="x &amp; &quot;y&quot;">1 &lt; 2</a>\n')
  })
})

describe('sql formatter', () => {
  it('formats a select with joins and conditions', () => {
    const out = formatSql("select a, b from t join u on t.id = u.id where x = 1 and y in (1,2) or z between 1 and 5 group by a order by b desc limit 10", { keywordCase: 'upper', indent: 2 })
    expect(out).toBe(
      'SELECT\n  a,\n  b\nFROM t\n  JOIN u ON t.id = u.id\nWHERE x = 1\n  AND y IN (1, 2)\n  OR z BETWEEN 1 AND 5\nGROUP BY a\nORDER BY b DESC\nLIMIT 10\n',
    )
  })
  it('keeps strings, comments and quoted identifiers intact', () => {
    const out = formatSql(`select 'it''s select', "Select Me", \`from\` from t -- trailing\nwhere a = 1 /* hi */`, { keywordCase: 'upper', indent: 2 })
    expect(out).toContain("'it''s select'")
    expect(out).toContain('"Select Me"')
    expect(out).toContain('`from`')
    expect(out).toContain('-- trailing')
    expect(out).toContain('/* hi */')
  })
  it('indents subqueries and honors case options', () => {
    const out = formatSql('SELECT * FROM (SELECT id FROM t) x', { keywordCase: 'lower', indent: 4 })
    expect(out).toBe('select\n    *\nfrom (\n    select\n        id\n    from t\n) x\n')
    expect(formatSql('Select a From b', { keywordCase: 'keep', indent: 2 })).toBe('Select\n  a\nFrom b\n')
  })
  it('formats insert, update, delete and function calls', () => {
    expect(formatSql("insert into t (a,b) values (1,'x'),(2,'y');", { keywordCase: 'upper', indent: 2 })).toBe("INSERT INTO t (a, b)\nVALUES (1, 'x'),\n  (2, 'y');\n")
    expect(formatSql('update t set a=1,b=-2 where id=3', { keywordCase: 'upper', indent: 2 })).toBe('UPDATE t\nSET a = 1,\n  b = -2\nWHERE id = 3\n')
    expect(formatSql('delete from t where id=3', { keywordCase: 'upper', indent: 2 })).toBe('DELETE FROM t\nWHERE id = 3\n')
    expect(formatSql('select count(*), max(a) from t', { keywordCase: 'upper', indent: 2 })).toContain('COUNT(*),\n  MAX(a)')
  })
  it('formats create table and handles empty input', () => {
    expect(formatSql('create table t (id int primary key, name text)', { keywordCase: 'upper', indent: 2 })).toBe('CREATE TABLE t (\n  id int PRIMARY KEY,\n  name text\n)\n')
    expect(formatSql('   ', { keywordCase: 'upper', indent: 2 })).toBe('')
  })
  it('minifies and drops comments', () => {
    expect(minifySql("SELECT  a ,\n b -- note\nFROM t /* x */ WHERE a = 'x  y'")).toBe("SELECT a,b FROM t WHERE a='x  y'")
  })
})

const cron = (e: string): ParsedCron => {
  const r = parseCron(e)
  if (!r.ok) throw new Error(r.error)
  return r.cron
}

describe('cron', () => {
  it('validates', () => {
    expect(parseCron('').ok).toBe(false)
    expect(parseCron('* * * *').ok).toBe(false)
    expect(parseCron('60 * * * *').ok).toBe(false)
    expect(parseCron('* * 0 * *').ok).toBe(false)
    expect(parseCron('5-1 * * * *').ok).toBe(false)
    expect(parseCron('*/0 * * * *').ok).toBe(false)
    expect(parseCron('@reboot').ok).toBe(false)
    expect(parseCron('* * * FOO *').ok).toBe(false)
  })
  it('parses lists, ranges, steps, names and 7 for Sunday', () => {
    expect(cron('0,30 9-11 * jan-mar mon-fri').minute.values).toEqual([0, 30])
    expect(cron('*/20 * * * *').minute.values).toEqual([0, 20, 40])
    expect(cron('10-30/10 * * * *').minute.values).toEqual([10, 20, 30])
    expect(cron('5/20 * * * *').minute.values).toEqual([5, 25, 45])
    expect(cron('* * * JAN-MAR *').month.values).toEqual([1, 2, 3])
    expect(cron('* * * * 7').dow.values).toEqual([0])
    expect(cron('* * * * SAT,SUN').dow.values).toEqual([0, 6])
    expect(cron('@daily').expression).toBe('0 0 * * *')
    expect(cron('15 30 10 * * *').hasSeconds).toBe(true)
  })
  it('explains in English', () => {
    expect(explainCron(cron('0 9 * * 1-5'))).toBe('At 09:00, Monday through Friday.')
    expect(explainCron(cron('*/15 * * * *'))).toBe('Every 15 minutes, every day.')
    expect(explainCron(cron('0 0 1 * *'))).toBe('At 00:00, on the 1st of the month.')
    expect(explainCron(cron('30 8 * 6 *'))).toBe('At 08:30, in June.')
    expect(explainCron(cron('0 0 13 * 5'))).toContain('either day matches')
    expect(explainCron(cron('*/10 * * * * *'))).toBe('Every 10 seconds, every day.')
  })
  it('computes next runs in local time with DOM/DOW OR semantics', () => {
    const from = new Date(2025, 0, 1, 0, 0, 0)
    const runs = nextRuns(cron('0 12 15 * 1'), from, 5).map((d) => `${d.getMonth() + 1}/${d.getDate()}`)
    // Mondays (6, 13, 20, 27) or the 15th, whichever comes first.
    expect(runs).toEqual(['1/6', '1/13', '1/15', '1/20', '1/27'])
    const and = nextRuns(cron('0 12 15 * *'), from, 2).map((d) => d.getDate())
    expect(and).toEqual([15, 15])
  })
  it('handles leap days, strictly-after and step lists', () => {
    const feb29 = nextRuns(cron('0 0 29 2 *'), new Date(2025, 0, 1), 2)
    expect(feb29.map((d) => d.getFullYear())).toEqual([2028, 2032])
    const t = new Date(2025, 5, 1, 10, 0, 0)
    expect(nextRuns(cron('0 10 * * *'), t, 1)[0].getDate()).toBe(2)
    expect(nextRuns(cron('*/30 * * * * *'), new Date(2025, 5, 1, 10, 0, 0), 3).map((d) => d.getSeconds())).toEqual([30, 0, 30])
    expect(nextRuns(cron('0 0 31 2 *'), new Date(2025, 0, 1), 3)).toEqual([])
  })
  it('builds expressions', () => {
    expect(buildCron({ minute: '0', hour: '9', dom: '', month: '*', dow: '1-5' })).toBe('0 9 * * 1-5')
  })
})

describe('fake data', () => {
  const fields = [
    { name: 'id', type: 'id' as const },
    { name: 'uuid', type: 'uuid' as const },
    { name: 'name', type: 'fullName' as const },
    { name: 'email', type: 'email' as const },
    { name: 'price', type: 'price' as const },
    { name: 'note', type: 'sentence' as const },
    { name: 'color', type: 'avatarColor' as const },
    { name: 'when', type: 'date' as const },
    { name: 'ok', type: 'boolean' as const },
  ]
  it('is deterministic for a seed and differs across seeds', () => {
    expect(generateRows(20, fields, 42)).toEqual(generateRows(20, fields, 42))
    expect(generateRows(20, fields, 42)).not.toEqual(generateRows(20, fields, 43))
    const r = mulberry32(1)
    const v = r()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
    expect(seedFromText('42')).toBe(42)
    expect(seedFromText('hello')).toBe(seedFromText('hello'))
  })
  it('produces well-formed values and clamps rows', () => {
    const rows = generateRows(5000, fields, 7)
    expect(rows).toHaveLength(1000)
    const x = rows[3]
    expect(x.id).toBe(4)
    expect(x.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(String(x.email)).toMatch(/^[a-z]+\.[a-z]+\d+@example\.(com|org|net)$/)
    expect(String(x.color)).toMatch(/^#[0-9a-f]{6}$/)
    expect(String(x.when)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(generateRows(0, fields, 1)).toEqual([])
  })
  it('keeps first, last and full name consistent in a row', () => {
    const [row] = generateRows(1, [{ name: 'f', type: 'firstName' }, { name: 'l', type: 'lastName' }, { name: 'n', type: 'fullName' }], 9)
    expect(row.n).toBe(`${row.f} ${row.l}`)
  })
  it('renders CSV and SQL with escaping and unique names', () => {
    const f = [{ name: 'a b', type: 'city' as const }, { name: '', type: 'company' as const }, { name: 'a b', type: 'id' as const }]
    const rows = generateRows(2, f, 3)
    const csv = rowsToCsv(rows, f)
    expect(csv.split('\n')[0]).toBe('a b,field_2,a b_2')
    const sql = rowsToSql(rows, f, 'my table')
    expect(sql.split('\n')[0]).toMatch(/^INSERT INTO "my table" \("a b", field_2, "a b_2"\) VALUES \('.+', '.+', 1\);$/)
    expect(rowsToSql([], f, 't')).toBe('')
    expect(rowsToCsv([{ x: 'a,"b"\nc' }], [{ name: 'x', type: 'city' }])).toBe('x\n"a,""b""\nc"\n')
  })
})
