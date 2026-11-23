import { useMemo, useState } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, DownloadButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import { parseJson } from '@/lib/dev'
import { diffJson, formatDiffReport, summarizeDiff, type DiffEntry } from '@/lib/dev/jsonDiff'
import { jsonToTypeScript } from '@/lib/dev/jsonToTs'
import { csvToJson, type CsvDelimiter } from '@/lib/dev/csv'
import { jsonToYaml } from '@/lib/dev/yaml'
import { formatXml } from '@/lib/dev/xml'
import { formatSql, minifySql, type KeywordCase } from '@/lib/dev/sql'
import { buildCron, CRON_PRESETS, explainCron, nextRuns, parseCron } from '@/lib/dev/cron'
import { FIELD_TYPES, generateRows, MAX_ROWS, rowsToCsv, rowsToJson, rowsToSql, seedFromText, type FieldSpec, type FieldType } from '@/lib/dev/fake'
import { downloadText } from '@/lib/utils/download'

const SAMPLE_A = '{\n  "name": "Ada",\n  "age": 36,\n  "tags": ["math", "code"],\n  "address": { "city": "London" }\n}'
const SAMPLE_B = '{\n  "name": "Ada",\n  "age": 37,\n  "tags": ["math", "code", "poetry"],\n  "address": { "city": "Paris", "zip": "75001" }\n}'

// ───────────── JSON diff checker ─────────────
const KIND_TONE = { added: 'accent', removed: 'danger', changed: 'warn', reordered: 'neutral' } as const
const KIND_SIGN = { added: '+', removed: '-', changed: '~', reordered: '^' } as const
const brief = (v: unknown) => {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 120 ? s.slice(0, 117) + '...' : s
}

export function JsonDiffChecker() {
  const [left, setLeft] = useState(SAMPLE_A)
  const [right, setRight] = useState(SAMPLE_B)
  const [ignoreOrder, setIgnoreOrder] = useState(true)
  const r = useMemo(() => {
    if (!left.trim() || !right.trim()) return { entries: null as DiffEntry[] | null, error: '' }
    const a = parseJson(left)
    if (!a.ok) return { entries: null, error: `The left JSON is invalid: ${a.error.message} (line ${a.error.line}, column ${a.error.column}).` }
    const b = parseJson(right)
    if (!b.ok) return { entries: null, error: `The right JSON is invalid: ${b.error.message} (line ${b.error.line}, column ${b.error.column}).` }
    return { entries: diffJson(a.value, b.value, { ignoreKeyOrder: ignoreOrder }), error: '' }
  }, [left, right, ignoreOrder])
  const s = r.entries ? summarizeDiff(r.entries) : null
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <Switch checked={ignoreOrder} onChange={setIgnoreOrder} label="Ignore key order" />
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Original JSON (left)" value={left} onChange={setLeft} rows={12} paste clear error={r.error.startsWith('The left')} /></Panel>
        <Panel><TextBox label="Changed JSON (right)" value={right} onChange={setRight} rows={12} paste clear error={r.error.startsWith('The right')} /></Panel>
      </div>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
      {r.entries && s && (
        <Panel title="Differences" actions={<CopyButton text={() => formatDiffReport(r.entries!)} label="Copy report" />}>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Added" value={s.added} />
            <Stat label="Removed" value={s.removed} />
            <Stat label="Changed" value={s.changed} />
            <Stat label="Total" value={s.total} />
          </div>
          {r.entries.length === 0 ? (
            <Alert tone="success" role="status">The two documents hold the same data.</Alert>
          ) : (
            <ul className="space-y-2 text-sm">
              {r.entries.slice(0, 500).map((e, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-line px-3 py-2">
                  <Badge tone={KIND_TONE[e.kind]}>{KIND_SIGN[e.kind]} {e.kind}</Badge>
                  <code className="break-all font-mono text-ink">{e.path}</code>
                  <span className="break-all font-mono text-xs text-muted">
                    {e.kind === 'added' && brief(e.after)}
                    {e.kind === 'removed' && brief(e.before)}
                    {e.kind === 'changed' && `${brief(e.before)} → ${brief(e.after)}`}
                    {e.kind === 'reordered' && 'keys appear in a different order'}
                  </span>
                </li>
              ))}
              {r.entries.length > 500 && <li className="text-muted">Showing the first 500 of {r.entries.length}. Copy the report for the full list.</li>}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}

// ───────────── JSON to TypeScript ─────────────
export function JsonToTypeScript() {
  const [input, setInput] = useState('{\n  "id": 1,\n  "name": "Ada",\n  "email": null,\n  "roles": ["admin", "dev"],\n  "projects": [\n    { "title": "Engine", "stars": 12 },\n    { "title": "Notes" }\n  ]\n}')
  const [rootName, setRootName] = useState('Root')
  const [style, setStyle] = useState<'interface' | 'type'>('interface')
  const [exp, setExp] = useState(true)
  const r = useMemo(() => {
    if (!input.trim()) return { out: '', error: '' }
    const p = parseJson(input)
    if (!p.ok) return { out: '', error: `Invalid JSON: ${p.error.message} (line ${p.error.line}, column ${p.error.column}).` }
    return { out: jsonToTypeScript(p.value, { rootName, style, exportTypes: exp }), error: '' }
  }, [input, rootName, style, exp])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Field label="Root name" className="w-44">{(id) => <Input id={id} value={rootName} onChange={(e) => setRootName(e.target.value)} />}</Field>
          <Segmented label="Declare with" value={style} onChange={setStyle} options={[{ value: 'interface', label: 'interface' }, { value: 'type', label: 'type' }]} />
          <Switch checked={exp} onChange={setExp} label="Add export" />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="JSON sample" value={input} onChange={setInput} rows={16} paste clear error={!!r.error} /></Panel>
        <Panel><TextBox label="TypeScript" value={r.out} readOnly rows={16} copy /></Panel>
      </div>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
    </div>
  )
}

// ───────────── CSV to JSON ─────────────
export function CsvToJson() {
  const [input, setInput] = useState('name,age,city,active\nAda,36,London,true\n"Smith, John",41,"New\nYork",false')
  const [delimiter, setDelimiter] = useState<'auto' | CsvDelimiter>('auto')
  const [header, setHeader] = useState(true)
  const [shape, setShape] = useState<'objects' | 'arrays'>('objects')
  const [infer, setInfer] = useState(false)
  const [pretty, setPretty] = useState(true)
  const r = useMemo(() => csvToJson(input, { delimiter, header, shape, infer }), [input, delimiter, header, shape, infer])
  const out = input.trim() && !r.error ? JSON.stringify(r.value, null, pretty ? 2 : 0) : ''
  const names: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' }
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Field label="Delimiter" className="w-44">
            {(id) => (
              <Select id={id} value={delimiter} onChange={(e) => setDelimiter(e.target.value as 'auto' | CsvDelimiter)}>
                <option value="auto">Auto-detect</option>
                <option value=",">Comma</option>
                <option value=";">Semicolon</option>
                <option value={'\t'}>Tab</option>
                <option value="|">Pipe</option>
              </Select>
            )}
          </Field>
          <Segmented label="Output" value={shape} onChange={setShape} options={[{ value: 'objects', label: 'Objects' }, { value: 'arrays', label: 'Arrays' }]} />
          <Switch checked={header} onChange={setHeader} label="First row is a header" />
          <Switch checked={infer} onChange={setInfer} label="Detect numbers and booleans" />
          <Switch checked={pretty} onChange={setPretty} label="Pretty print" />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="CSV, TSV or similar" value={input} onChange={setInput} rows={14} paste clear error={!!r.error} /></Panel>
        <Panel actions={<DownloadButton size="sm" variant="secondary" disabled={!out} onClick={() => downloadText(out + '\n', 'data.json', 'application/json')}>Download .json</DownloadButton>}>
          <TextBox label="JSON" value={out} readOnly rows={14} copy hint={input.trim() && !r.error ? `${r.rowCount} row${r.rowCount === 1 ? '' : 's'}, ${names[r.delimiter]} delimiter` : undefined} />
        </Panel>
      </div>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
    </div>
  )
}

// ───────────── JSON to YAML ─────────────
export function JsonToYaml() {
  const [input, setInput] = useState('{\n  "name": "stayput",\n  "version": "1.0",\n  "debug": false,\n  "ports": [80, 443],\n  "motd": "Welcome\\nback",\n  "env": { "MODE": "true", "EMPTY": [] }\n}')
  const [indent, setIndent] = useState<2 | 4>(2)
  const r = useMemo(() => {
    if (!input.trim()) return { out: '', error: '' }
    const p = parseJson(input)
    if (!p.ok) return { out: '', error: `Invalid JSON: ${p.error.message} (line ${p.error.line}, column ${p.error.column}).` }
    return { out: jsonToYaml(p.value, indent), error: '' }
  }, [input, indent])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <Segmented label="Indent" value={indent} onChange={setIndent} options={[{ value: 2, label: '2 spaces' }, { value: 4, label: '4 spaces' }]} />
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="JSON" value={input} onChange={setInput} rows={14} paste clear error={!!r.error} /></Panel>
        <Panel actions={<DownloadButton size="sm" variant="secondary" disabled={!r.out} onClick={() => downloadText(r.out, 'data.yaml', 'text/yaml')}>Download .yaml</DownloadButton>}>
          <TextBox label="YAML" value={r.out} readOnly rows={14} copy />
        </Panel>
      </div>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
    </div>
  )
}

// ───────────── XML formatter ─────────────
export function XmlFormatter() {
  const [input, setInput] = useState('<?xml version="1.0" encoding="UTF-8"?><catalog><!-- books --><book id="1"><title>Dune</title><note><![CDATA[a < b]]></note></book><book id="2"/></catalog>')
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty')
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2')
  const r = useMemo(() => formatXml(input, { mode, indent: indent === 'tab' ? 'tab' : indent === '4' ? 4 : 2 }), [input, mode, indent])
  const out = r.ok ? r.output : ''
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'pretty', label: 'Format' }, { value: 'minify', label: 'Minify' }]} />
          {mode === 'pretty' && <Segmented label="Indent" value={indent} onChange={setIndent} options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tab' }]} />}
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="XML" value={input} onChange={setInput} rows={14} paste clear error={!r.ok} /></Panel>
        <Panel actions={<DownloadButton size="sm" variant="secondary" disabled={!out} onClick={() => downloadText(out, 'formatted.xml', 'application/xml')}>Download .xml</DownloadButton>}>
          <TextBox label={mode === 'pretty' ? 'Formatted XML' : 'Minified XML'} value={out} readOnly rows={14} copy />
        </Panel>
      </div>
      {!r.ok && <Alert tone="danger" role="alert" title="The XML is not well-formed">{r.error}</Alert>}
    </div>
  )
}

// ───────────── SQL formatter ─────────────
export function SqlFormatter() {
  const [input, setInput] = useState("select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = 1 and o.created_at > '2024-01-01' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 20;")
  const [mode, setMode] = useState<'format' | 'minify'>('format')
  const [kcase, setKcase] = useState<KeywordCase>('upper')
  const [indent, setIndent] = useState<2 | 4>(2)
  const out = useMemo(() => {
    try {
      return mode === 'format' ? formatSql(input, { keywordCase: kcase, indent }) : minifySql(input)
    } catch {
      return ''
    }
  }, [input, mode, kcase, indent])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify' }]} />
          {mode === 'format' && (
            <>
              <Segmented label="Keywords" value={kcase} onChange={setKcase} options={[{ value: 'upper', label: 'UPPER' }, { value: 'lower', label: 'lower' }, { value: 'keep', label: 'Keep' }]} />
              <Segmented label="Indent" value={indent} onChange={setIndent} options={[{ value: 2, label: '2 spaces' }, { value: 4, label: '4 spaces' }]} />
            </>
          )}
        </div>
      </Panel>
      <Alert tone="info">This is a general-purpose formatter. It rearranges text and does not check your SQL against any database dialect, so a query can look tidy and still be invalid.</Alert>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="SQL" value={input} onChange={setInput} rows={14} paste clear /></Panel>
        <Panel actions={<DownloadButton size="sm" variant="secondary" disabled={!out} onClick={() => downloadText(out, 'query.sql', 'application/sql')}>Download .sql</DownloadButton>}>
          <TextBox label={mode === 'format' ? 'Formatted SQL' : 'Minified SQL'} value={out} readOnly rows={14} copy />
        </Panel>
      </div>
    </div>
  )
}

// ───────────── Cron expression explainer ─────────────
const BUILDER_OPTIONS = {
  minute: [['*', 'Every minute'], ['*/5', 'Every 5 minutes'], ['*/10', 'Every 10 minutes'], ['*/15', 'Every 15 minutes'], ['*/30', 'Every 30 minutes'], ['0', 'At minute 0'], ['15', 'At minute 15'], ['30', 'At minute 30'], ['45', 'At minute 45']],
  hour: [['*', 'Every hour'], ['*/2', 'Every 2 hours'], ['*/6', 'Every 6 hours'], ['*/12', 'Every 12 hours'], ['0', 'At 00'], ['6', 'At 06'], ['9', 'At 09'], ['12', 'At 12'], ['18', 'At 18'], ['9-17', '09 to 17']],
  dom: [['*', 'Every day'], ['1', 'Day 1'], ['15', 'Day 15'], ['1,15', 'Days 1 and 15'], ['*/2', 'Every 2nd day']],
  month: [['*', 'Every month'], ['*/3', 'Every 3 months'], ['1', 'January'], ['6', 'June'], ['12', 'December'], ['1-6', 'January to June']],
  dow: [['*', 'Every weekday'], ['1-5', 'Monday to Friday'], ['0,6', 'Weekends'], ['1', 'Monday'], ['5', 'Friday'], ['0', 'Sunday']],
} as const

export function CronExplainer() {
  const [expr, setExpr] = useState('*/15 9-17 * * 1-5')
  const [now, setNow] = useState(() => new Date())
  const [b, setB] = useState({ minute: '*/15', hour: '9-17', dom: '*', month: '*', dow: '1-5' })
  const parsed = useMemo(() => parseCron(expr), [expr])
  const runs = useMemo(() => (parsed.ok ? nextRuns(parsed.cron, now, 10) : []), [parsed, now])
  const tz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'local time' }
  }, [])
  const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: parsed.ok && parsed.cron.hasSeconds ? '2-digit' : undefined })
  const set = (k: keyof typeof b, v: string) => {
    const next = { ...b, [k]: v }
    setB(next)
    setExpr(buildCron(next))
  }
  return (
    <div className="space-y-5">
      <Panel title="Cron expression">
        <div className="space-y-4">
          <Field label="Expression" hint="5 fields (minute hour day-of-month month day-of-week), or 6 with seconds first. Macros such as @daily work too.">
            {(id) => <Input id={id} value={expr} onChange={(e) => setExpr(e.target.value)} className="font-mono" spellCheck={false} aria-invalid={!parsed.ok} />}
          </Field>
          <Field label="Presets">
            {(id) => (
              <Select id={id} value="" onChange={(e) => e.target.value && setExpr(e.target.value)}>
                <option value="">Choose a preset...</option>
                {CRON_PRESETS.map((p) => <option key={p.expression} value={p.expression}>{p.label} ({p.expression})</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Panel>
      {!parsed.ok ? (
        <Alert tone="danger" role="alert">{parsed.error}</Alert>
      ) : (
        <Panel title="In plain English" actions={<CopyButton text={parsed.cron.expression} label="Copy expression" />}>
          <p className="text-lg text-ink">{explainCron(parsed.cron)}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-ink-2">Next 10 runs ({tz})</h3>
            <Button size="sm" variant="ghost" onClick={() => setNow(new Date())}><RefreshCw className="size-4" aria-hidden /> Refresh</Button>
          </div>
          {runs.length ? (
            <ol className="mt-2 space-y-1 text-sm">
              {runs.map((d, i) => <li key={i} className="font-mono text-ink">{fmt(d)}</li>)}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">This expression does not match any date in the next ten years, for example 31 February.</p>
          )}
        </Panel>
      )}
      <Panel title="Builder">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([['minute', 'Minute'], ['hour', 'Hour'], ['dom', 'Day of month'], ['month', 'Month'], ['dow', 'Day of week']] as const).map(([k, label]) => (
            <Field key={k} label={label}>
              {(id) => (
                <Select id={id} value={b[k]} onChange={(e) => set(k, e.target.value)}>
                  {BUILDER_OPTIONS[k].map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}
                </Select>
              )}
            </Field>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Picking a value updates the expression above. You can also type any list, range or step by hand.</p>
      </Panel>
    </div>
  )
}

// ───────────── Fake data generator ─────────────
interface FieldRow extends FieldSpec { key: number }

export function FakeDataGenerator() {
  const [fields, setFields] = useState<FieldRow[]>([
    { key: 1, name: 'id', type: 'id' },
    { key: 2, name: 'name', type: 'fullName' },
    { key: 3, name: 'email', type: 'email' },
    { key: 4, name: 'city', type: 'city' },
    { key: 5, name: 'signed_up', type: 'date' },
  ])
  const [nextKey, setNextKey] = useState(6)
  const [rows, setRows] = useState(10)
  const [format, setFormat] = useState<'json' | 'csv' | 'sql'>('json')
  const [table, setTable] = useState('users')
  const [seedText, setSeedText] = useState('')
  const [auto, setAuto] = useState(() => Math.floor(Math.random() * 2 ** 32))
  const seed = seedText.trim() ? seedFromText(seedText) : auto
  const out = useMemo(() => {
    const specs = fields.map(({ name, type }) => ({ name, type }))
    const data = generateRows(rows, specs, seed)
    if (!data.length || !specs.length) return ''
    return format === 'json' ? rowsToJson(data) : format === 'csv' ? rowsToCsv(data, specs) : rowsToSql(data, specs, table)
  }, [fields, rows, format, table, seed])
  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'sql'
  const update = (key: number, patch: Partial<FieldSpec>) => setFields((f) => f.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  return (
    <div className="space-y-5">
      <Panel title="Fields" actions={<Button size="sm" variant="secondary" onClick={() => { setFields((f) => [...f, { key: nextKey, name: `field_${nextKey}`, type: 'firstName' }]); setNextKey(nextKey + 1) }}><Plus className="size-4" aria-hidden /> Add field</Button>}>
        <ul className="space-y-2">
          {fields.map((f) => (
            <li key={f.key} className="flex flex-wrap items-center gap-2">
              <Input aria-label="Field name" className="w-44" value={f.name} onChange={(e) => update(f.key, { name: e.target.value })} />
              <Select aria-label="Field type" className="w-52" value={f.type} onChange={(e) => update(f.key, { type: e.target.value as FieldType })}>
                {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </Select>
              <Button size="sm" variant="ghost" aria-label={`Remove ${f.name || 'field'}`} onClick={() => setFields((x) => x.filter((y) => y.key !== f.key))}><X className="size-4" aria-hidden /></Button>
            </li>
          ))}
        </ul>
        {fields.length === 0 && <p className="text-sm text-muted">Add at least one field.</p>}
      </Panel>
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Field label={`Rows (1 to ${MAX_ROWS})`} className="w-32">
            {(id) => <Input id={id} type="number" min={1} max={MAX_ROWS} value={rows} onChange={(e) => setRows(Math.min(MAX_ROWS, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} />}
          </Field>
          <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }, { value: 'sql', label: 'SQL INSERT' }]} />
          {format === 'sql' && <Field label="Table name" className="w-40">{(id) => <Input id={id} value={table} onChange={(e) => setTable(e.target.value)} />}</Field>}
          <Field label="Seed (optional)" hint="Same seed, same data." className="w-44">{(id) => <Input id={id} value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="Random" />}</Field>
          <Button variant="secondary" onClick={() => setAuto(Math.floor(Math.random() * 2 ** 32))} disabled={!!seedText.trim()}><RefreshCw className="size-4" aria-hidden /> Regenerate</Button>
        </div>
      </Panel>
      <Alert tone="info">All values are made up from small built-in word lists. Emails use example domains and phone numbers use the reserved 555-01xx range, so none point at real people.</Alert>
      <Panel actions={<DownloadButton size="sm" variant="secondary" disabled={!out} onClick={() => downloadText(out, `mock-data.${ext}`, format === 'json' ? 'application/json' : 'text/plain')}>Download .{ext}</DownloadButton>}>
        <TextBox label="Output" value={out} readOnly rows={16} copy />
      </Panel>
    </div>
  )
}
