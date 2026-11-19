import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { CopyButton, DownloadButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import {
  base64DecodeText,
  base64EncodeText,
  contrastRatio,
  decodeHtmlEntities,
  decodeJwt,
  encodeHtmlEntities,
  formatJson,
  hashBytes,
  HASH_ALGORITHMS,
  hashText,
  hslToRgb,
  jsonToCsv,
  minifyCss,
  minifyJson,
  parseHex,
  parseJson,
  rgbToHex,
  rgbToHsl,
  urlDecode,
  urlEncode,
  uuidV4,
  type Delimiter,
  type HashAlgorithm,
  type Indent,
  type JsonError,
  type UrlMode,
} from '@/lib/dev'
import { downloadText } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

// ───────────── JSON formatter ─────────────
function ErrorExcerpt({ text, error }: { text: string; error: JsonError }) {
  const lines = text.split('\n')
  const from = Math.max(0, error.line - 3)
  const to = Math.min(lines.length, error.line + 2)
  return (
    <div className="overflow-x-auto rounded-xl border border-[#f0b8b2] bg-danger-tint font-mono text-[13px] leading-6" role="alert">
      <p className="border-b border-[#f0b8b2] px-3 py-2 font-sans text-sm font-medium text-[#7a1a12]">
        Invalid JSON at line {error.line}, column {error.column}
      </p>
      <p className="px-3 pt-2 font-sans text-xs text-[#7a1a12]">{error.message}</p>
      <pre className="px-3 py-2">
        {lines.slice(from, to).map((l, i) => {
          const no = from + i + 1
          const hit = no === error.line
          const col = Math.min(error.column - 1, l.length)
          return (
            <div key={no} className={cn(hit && 'bg-danger/10')}>
              <span className="tabular mr-3 inline-block w-8 select-none text-right text-muted">{no}</span>
              {hit ? (
                <>
                  {l.slice(0, col)}
                  <mark className="rounded-sm bg-danger px-0.5 text-white">{l.slice(col, col + 1) || '⏎'}</mark>
                  {l.slice(col + 1)}
                </>
              ) : (
                l
              )}
            </div>
          )
        })}
      </pre>
    </div>
  )
}

export function JsonFormatter() {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState<Indent>(2)
  const [sortKeys, setSortKeys] = useState(false)
  const [mode, setMode] = useState<'format' | 'minify'>('format')
  const parsed = useMemo(() => (input.trim() ? parseJson(input) : null), [input])
  const output = useMemo(() => {
    if (!parsed || !parsed.ok) return ''
    return mode === 'format' ? formatJson(parsed.value, indent, sortKeys) : minifyJson(sortKeys ? JSON.parse(formatJson(parsed.value, 2, true)) : parsed.value)
  }, [parsed, mode, indent, sortKeys])

  return (
    <div className="space-y-5">
      <Panel
        title="Input"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Action" value={mode} onChange={setMode} options={[{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify' }]} />
            {mode === 'format' && (
              <Select aria-label="Indentation" value={String(indent)} onChange={(e) => setIndent(e.target.value === 'tab' ? 'tab' : (Number(e.target.value) as 2 | 4))} className="h-8 w-32">
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
                <option value="tab">Tab</option>
              </Select>
            )}
            <Switch checked={sortKeys} onChange={setSortKeys} label="Sort keys" />
          </div>
        }
      >
        <TextBox label="JSON" value={input} onChange={setInput} rows={14} placeholder='{"name": "Ada", "languages": ["en", "fr"]}' paste clear error={parsed ? !parsed.ok : false} />
        <div className="mt-3" aria-live="polite">
          {parsed?.ok === false && <ErrorExcerpt text={input} error={parsed.error} />}
          {parsed?.ok && <Alert tone="success" title="Valid JSON">{Array.isArray(parsed.value) ? `An array with ${parsed.value.length} item${parsed.value.length === 1 ? '' : 's'}.` : typeof parsed.value === 'object' && parsed.value ? `An object with ${Object.keys(parsed.value).length} key${Object.keys(parsed.value).length === 1 ? '' : 's'}.` : `A ${typeof parsed.value} value.`}</Alert>}
        </div>
      </Panel>
      {output && (
        <Panel title={mode === 'format' ? 'Formatted' : 'Minified'} actions={<div className="flex items-center gap-2"><Badge>{formatBytes(new Blob([output]).size)}</Badge><CopyButton text={output} /></div>}>
          <TextBox label="Output" value={output} readOnly rows={14} />
        </Panel>
      )}
    </div>
  )
}

// ───────────── JSON → CSV ─────────────
export function JsonToCsv() {
  const [input, setInput] = useState('')
  const [delimiter, setDelimiter] = useState<Delimiter>(',')
  const [bom, setBom] = useState(false)
  const parsed = useMemo(() => (input.trim() ? parseJson(input) : null), [input])
  const csv = useMemo(() => {
    if (!parsed?.ok) return ''
    try {
      return jsonToCsv(parsed.value, delimiter)
    } catch {
      return ''
    }
  }, [parsed, delimiter])
  const rows = useMemo(() => (csv ? csv.split('\r\n').length - 1 : 0), [csv])
  const scalar = parsed?.ok && (typeof parsed.value !== 'object' || parsed.value === null)

  return (
    <div className="space-y-5">
      <Panel
        title="JSON input"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select aria-label="Delimiter" value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)} className="h-8 w-40">
              <option value=",">Comma</option>
              <option value=";">Semicolon</option>
              <option value={'\t'}>Tab</option>
              <option value="|">Pipe</option>
            </Select>
            <Switch checked={bom} onChange={setBom} label="Add BOM for Excel" />
          </div>
        }
      >
        <TextBox label="JSON array of objects" value={input} onChange={setInput} rows={12} placeholder='[{"id": 1, "name": "Ada"}, {"id": 2, "name": "Grace"}]' paste clear error={parsed ? !parsed.ok : false} />
        <div className="mt-3" aria-live="polite">
          {parsed?.ok === false && <ErrorExcerpt text={input} error={parsed.error} />}
          {scalar && <Alert tone="warn">CSV needs an array of objects or a single object. This input is a single value.</Alert>}
        </div>
      </Panel>
      {csv && (
        <Panel
          title="CSV output"
          actions={
            <div className="flex gap-2">
              <CopyButton text={csv} />
              <DownloadButton size="sm" onClick={() => downloadText((bom ? '﻿' : '') + csv, 'data.csv', 'text/csv;charset=utf-8')}>Download .csv</DownloadButton>
            </div>
          }
        >
          <p className="mb-2 text-sm text-muted">{rows.toLocaleString()} data row{rows === 1 ? '' : 's'}</p>
          <TextBox label="CSV" value={csv} readOnly rows={12} />
        </Panel>
      )}
    </div>
  )
}

// ───────────── Base64 ─────────────
export function Base64Tool() {
  const [dir, setDir] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const [urlSafe, setUrlSafe] = useState(false)
  const result = useMemo(() => {
    if (!input) return { out: '', err: null as string | null }
    try {
      return { out: dir === 'encode' ? base64EncodeText(input, urlSafe) : base64DecodeText(input), err: null }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : 'Could not convert this input.' }
    }
  }, [input, dir, urlSafe])
  return (
    <div className="space-y-5">
      <Panel
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
            {dir === 'encode' && <Switch checked={urlSafe} onChange={setUrlSafe} label="URL-safe" />}
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          <TextBox label={dir === 'encode' ? 'Text' : 'Base64'} value={input} onChange={setInput} rows={10} paste clear error={!!result.err} placeholder={dir === 'encode' ? 'Hello, world' : 'SGVsbG8sIHdvcmxk'} />
          <div className="flex justify-center pt-8">
            <Button size="icon" variant="secondary" aria-label="Swap input and output" disabled={!result.out} onClick={() => { setInput(result.out); setDir(dir === 'encode' ? 'decode' : 'encode') }}>
              <ArrowLeftRight className="size-4" aria-hidden />
            </Button>
          </div>
          <TextBox label={dir === 'encode' ? 'Base64' : 'Text'} value={result.out} readOnly rows={10} copy />
        </div>
        {result.err && <Alert tone="danger" className="mt-4" title="Could not decode">{result.err}</Alert>}
      </Panel>
    </div>
  )
}

// ───────────── URL ─────────────
export function UrlTool() {
  const [dir, setDir] = useState<'encode' | 'decode'>('encode')
  const [mode, setMode] = useState<UrlMode>('component')
  const [input, setInput] = useState('')
  const result = useMemo(() => {
    if (!input) return { out: '', err: null as string | null }
    try {
      return { out: dir === 'encode' ? urlEncode(input, mode) : urlDecode(input, mode), err: null }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : 'Could not convert this input.' }
    }
  }, [input, dir, mode])
  return (
    <div className="space-y-5">
      <Panel
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
            <Segmented label="Scope" value={mode} onChange={setMode} options={[{ value: 'component', label: 'Component', title: 'Encodes everything except letters, digits and - _ . ! ~ * \' ( )' }, { value: 'full', label: 'Full URL', title: 'Keeps : / ? # & = intact' }]} />
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <TextBox label="Input" value={input} onChange={setInput} rows={9} paste clear error={!!result.err} placeholder={dir === 'encode' ? 'hello world & more' : 'hello%20world%20%26%20more'} />
          <TextBox label="Result" value={result.out} readOnly rows={9} copy />
        </div>
        {result.err && <Alert tone="danger" className="mt-4" title="Could not decode">{result.err}</Alert>}
      </Panel>
    </div>
  )
}

// ───────────── UUID ─────────────
export function UuidGenerator() {
  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [seed, setSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const raw = useMemo(() => Array.from({ length: count }, () => uuidV4()), [count, seed])
  const list = raw.map((u) => {
    let v = hyphens ? u : u.replace(/-/g, '')
    if (upper) v = v.toUpperCase()
    return v
  })
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="How many (1 to 1000)" className="w-44">
            {(id) => <Input id={id} type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Switch checked={upper} onChange={setUpper} label="Uppercase" />
          <Switch checked={hyphens} onChange={setHyphens} label="Hyphens" />
          <Button variant="primary" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-4" aria-hidden /> Generate new
          </Button>
        </div>
      </Panel>
      <Panel title={`${list.length} UUID${list.length === 1 ? '' : 's'} (version 4)`} actions={<div className="flex gap-2"><CopyButton text={list.join('\n')} label="Copy all" /><DownloadButton size="sm" variant="secondary" onClick={() => downloadText(list.join('\n') + '\n', 'uuids.txt')}>Download</DownloadButton></div>}>
        <ul className="max-h-[28rem] divide-y divide-line overflow-auto rounded-xl border border-line">
          {list.map((u, i) => (
            <li key={`${u}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <code className="tabular break-all font-mono text-sm">{u}</code>
              <CopyButton text={u} size="sm" variant="ghost" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

// ───────────── Hash ─────────────
export function HashGenerator() {
  const [source, setSource] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [upper, setUpper] = useState(false)
  const [hashes, setHashes] = useState<Record<HashAlgorithm, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expected, setExpected] = useState('')
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: ['*/*'], multiple: false, maxSizeMB: 2048, usePending: false })
  const file = files[0]
  const token = useRef(0)

  const compute = useCallback(async () => {
    const t = ++token.current
    setError(null)
    try {
      if (source === 'text') {
        if (!text) return setHashes(null)
        const entries = await Promise.all(HASH_ALGORITHMS.map(async (a) => [a, await hashText(text, a)] as const))
        if (t === token.current) setHashes(Object.fromEntries(entries) as Record<HashAlgorithm, string>)
      } else {
        if (!file) return setHashes(null)
        setBusy(true)
        const buf = await file.file.arrayBuffer()
        const entries = await Promise.all(HASH_ALGORITHMS.map(async (a) => [a, await hashBytes(buf, a)] as const))
        if (t === token.current) setHashes(Object.fromEntries(entries) as Record<HashAlgorithm, string>)
      }
    } catch (e) {
      if (t === token.current) setError(e instanceof Error ? e.message : 'Hashing failed. The file may be too large for this device.')
    } finally {
      if (t === token.current) setBusy(false)
    }
  }, [source, text, file])

  useEffect(() => {
    void compute()
  }, [compute])

  const fmt = (h: string) => (upper ? h.toUpperCase() : h)
  const exp = expected.trim().toLowerCase().replace(/\s+/g, '')
  const matched = hashes && exp ? HASH_ALGORITHMS.find((a) => hashes[a] === exp) : undefined

  return (
    <div className="space-y-5">
      <Panel
        title="Input"
        actions={<Segmented label="Hash source" value={source} onChange={setSource} options={[{ value: 'text', label: 'Text' }, { value: 'file', label: 'File' }]} />}
      >
        {source === 'text' ? (
          <TextBox label="Text to hash" value={text} onChange={setText} rows={7} placeholder="Type or paste text" paste clear />
        ) : file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="tabular text-xs text-muted">{formatBytes(file.size)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={clear}>Choose another</Button>
          </div>
        ) : (
          <FileDropzone accept={['*/*']} rejected={rejected} loading={loading} onFiles={(f) => void addFiles(f)} compact hint="Any file type. It is read on your device and never uploaded." />
        )}
      </Panel>
      <Panel title="Digests" actions={<Switch checked={upper} onChange={setUpper} label="Uppercase" />}>
        {error && <Alert tone="danger" title="Hashing failed">{error}</Alert>}
        {!hashes && !error && <p className="text-sm text-muted">{busy ? 'Hashing…' : 'Enter text or choose a file to see its hashes.'}</p>}
        {hashes && (
          <div className="space-y-3">
            {HASH_ALGORITHMS.map((a) => (
              <div key={a} className={cn('rounded-xl border p-3', matched === a ? 'border-accent bg-accent-tint' : 'border-line')}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{a}{matched === a && <Badge tone="accent" className="ml-2">Matches</Badge>}</span>
                  <CopyButton text={fmt(hashes[a])} size="sm" variant="ghost" />
                </div>
                <code className="tabular block break-all font-mono text-[13px]">{fmt(hashes[a])}</code>
              </div>
            ))}
            <Field label="Compare with an expected hash" hint={exp ? (matched ? `Matches ${matched}.` : 'Does not match any of the hashes above.') : 'Paste a hash to check which algorithm it matches.'}>
              {(id) => <Input id={id} value={expected} onChange={(e) => setExpected(e.target.value)} className="font-mono text-[13px]" spellCheck={false} />}
            </Field>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── CSS minifier ─────────────
export function CssMinifier() {
  const [css, setCss] = useState('')
  const out = useMemo(() => minifyCss(css), [css])
  const before = new Blob([css]).size
  const after = new Blob([out]).size
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="CSS" value={css} onChange={setCss} rows={16} placeholder={'.card {\n  color: #333;\n  /* comment */\n}'} paste clear /></Panel>
        <Panel><TextBox label="Minified" value={out} readOnly rows={16} copy /></Panel>
      </div>
      {css && (
        <div className="grid grid-cols-3 gap-3 sm:max-w-xl" aria-live="polite">
          <Stat label="Before" value={formatBytes(before)} />
          <Stat label="After" value={formatBytes(after)} />
          <Stat label="Saved" value={`${before ? Math.round(((before - after) / before) * 100) : 0}%`} />
        </div>
      )}
    </div>
  )
}

// ───────────── HTML entities ─────────────
export function HtmlEntities() {
  const [dir, setDir] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const [nonAscii, setNonAscii] = useState(false)
  const out = useMemo(() => (dir === 'encode' ? encodeHtmlEntities(input, nonAscii) : decodeHtmlEntities(input)), [dir, input, nonAscii])
  return (
    <div className="space-y-5">
      <Panel
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
            {dir === 'encode' && <Switch checked={nonAscii} onChange={setNonAscii} label="Also encode non-ASCII" />}
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <TextBox label="Input" value={input} onChange={setInput} rows={10} paste clear placeholder={dir === 'encode' ? '<p class="note">Fish & chips</p>' : '&lt;p&gt;Fish &amp; chips&lt;/p&gt;'} />
          <TextBox label="Result" value={out} readOnly rows={10} copy />
        </div>
      </Panel>
    </div>
  )
}

// ───────────── JWT ─────────────
export function JwtDecoder() {
  const [token, setToken] = useState('')
  const result = useMemo(() => {
    if (!token.trim()) return null
    try {
      return { ok: true as const, d: decodeJwt(token) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Could not decode this token.' }
    }
  }, [token])
  return (
    <div className="space-y-5">
      <Alert tone="warn" title="Decoding is not verifying">This tool only reads the token. It does not check the signature, so it cannot tell you whether a token is genuine or has been tampered with.</Alert>
      <Panel>
        <TextBox label="JWT" value={token} onChange={setToken} rows={5} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…" paste clear error={result?.ok === false} />
        {result?.ok === false && <Alert tone="danger" className="mt-3" title="Could not decode">{result.error}</Alert>}
      </Panel>
      {result?.ok && (
        <>
          {result.d.times.length > 0 && (
            <Panel title="Time claims">
              <ul className="grid gap-3 sm:grid-cols-3">
                {result.d.times.map((t) => (
                  <li key={t.claim} className="rounded-xl bg-surface px-4 py-3">
                    <p className="text-xs text-muted">{t.label} ({t.claim})</p>
                    <p className="tabular text-sm font-medium">{t.date.toLocaleString()}</p>
                    {t.claim === 'exp' && <Badge className="mt-1" tone={result.d.expired ? 'danger' : 'accent'}>{result.d.expired ? 'Expired' : 'Not expired yet'}</Badge>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Header" actions={<CopyButton text={JSON.stringify(result.d.header, null, 2)} />}>
              <pre className="max-h-96 overflow-auto rounded-xl bg-surface p-3 font-mono text-[13px] leading-6">{JSON.stringify(result.d.header, null, 2)}</pre>
            </Panel>
            <Panel title="Payload" actions={<CopyButton text={JSON.stringify(result.d.payload, null, 2)} />}>
              <pre className="max-h-96 overflow-auto rounded-xl bg-surface p-3 font-mono text-[13px] leading-6">{JSON.stringify(result.d.payload, null, 2)}</pre>
            </Panel>
          </div>
          <Panel title="Signature">
            <code className="block break-all rounded-xl bg-surface p-3 font-mono text-[13px]">{result.d.signature || '(empty. This token is unsigned.)'}</code>
            {!result.d.signature && <Alert tone="warn" className="mt-3">This token has no signature. Servers should reject unsigned tokens.</Alert>}
          </Panel>
        </>
      )}
    </div>
  )
}

// ───────────── Color converter ─────────────
export function ColorConverter() {
  const [hex, setHex] = useState('#0b7a5e')
  const [rgb, setRgb] = useState({ r: 11, g: 122, b: 94 })
  const [hsl, setHsl] = useState(() => rgbToHsl({ r: 11, g: 122, b: 94 }))
  const [hexText, setHexText] = useState('#0b7a5e')

  const applyRgb = (c: { r: number; g: number; b: number }) => {
    const clean = { r: clamp(c.r, 255), g: clamp(c.g, 255), b: clamp(c.b, 255) }
    setRgb(clean)
    const h = rgbToHex(clean)
    setHex(h)
    setHexText(h)
    setHsl(rgbToHsl(clean))
  }
  const applyHsl = (c: { h: number; s: number; l: number }) => {
    const clean = { h: clamp(c.h, 360), s: clamp(c.s, 100), l: clamp(c.l, 100) }
    setHsl(clean)
    const r = hslToRgb(clean)
    setRgb(r)
    const h = rgbToHex(r)
    setHex(h)
    setHexText(h)
  }
  const onHexText = (v: string) => {
    setHexText(v)
    const p = parseHex(v)
    if (p) {
      setRgb(p)
      setHex(rgbToHex(p))
      setHsl(rgbToHsl(p))
    }
  }
  const validHex = !!parseHex(hexText)
  const cssHex = hex.toUpperCase()
  const cssRgb = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  const cssHsl = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  const onWhite = contrastRatio(rgb, { r: 255, g: 255, b: 255 })
  const onBlack = contrastRatio(rgb, { r: 0, g: 0, b: 0 })

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Panel title="Preview">
        <div className="h-40 rounded-xl border border-line" style={{ background: hex }} role="img" aria-label={`Color ${cssHex}`} />
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-ink-2">
          Pick a color
          <input type="color" value={hex} onChange={(e) => onHexText(e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border border-line-strong bg-paper p-1" />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: hex, color: '#fff' }}>White text<br /><span className="tabular text-xs opacity-90">{onWhite.toFixed(2)}:1</span></div>
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: hex, color: '#000' }}>Black text<br /><span className="tabular text-xs opacity-90">{onBlack.toFixed(2)}:1</span></div>
        </div>
        <p className="mt-2 text-xs text-muted">WCAG contrast. 4.5:1 or more is fine for body text.</p>
      </Panel>
      <div className="space-y-5">
        <Panel title="HEX" actions={<CopyButton text={cssHex} />}>
          <Field label="HEX value" hint={validHex ? undefined : 'Enter 3 or 6 hex digits, for example #1a2b3c.'}>
            {(id) => <Input id={id} value={hexText} onChange={(e) => onHexText(e.target.value)} aria-invalid={!validHex} className={cn('max-w-xs font-mono', !validHex && 'border-danger')} />}
          </Field>
        </Panel>
        <Panel title="RGB" actions={<CopyButton text={cssRgb} />}>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            {(['r', 'g', 'b'] as const).map((k) => (
              <Field key={k} label={k.toUpperCase()}>
                {(id) => <Input id={id} type="number" min={0} max={255} value={rgb[k]} onChange={(e) => applyRgb({ ...rgb, [k]: Number(e.target.value) })} />}
              </Field>
            ))}
          </div>
          <p className="tabular mt-2 text-xs text-muted">{cssRgb}</p>
        </Panel>
        <Panel title="HSL" actions={<CopyButton text={cssHsl} />}>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <Field label="H (0–360)">{(id) => <Input id={id} type="number" min={0} max={360} value={hsl.h} onChange={(e) => applyHsl({ ...hsl, h: Number(e.target.value) })} />}</Field>
            <Field label="S (%)">{(id) => <Input id={id} type="number" min={0} max={100} value={hsl.s} onChange={(e) => applyHsl({ ...hsl, s: Number(e.target.value) })} />}</Field>
            <Field label="L (%)">{(id) => <Input id={id} type="number" min={0} max={100} value={hsl.l} onChange={(e) => applyHsl({ ...hsl, l: Number(e.target.value) })} />}</Field>
          </div>
          <p className="tabular mt-2 text-xs text-muted">{cssHsl}</p>
        </Panel>
      </div>
    </div>
  )
}

const clamp = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0)
