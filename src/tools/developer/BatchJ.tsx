import { Fragment, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, DownloadButton, OptionRow, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import {
  blocksToHtml,
  parseMarkdown,
  safeImageUrl,
  safeLang,
  safeLinkUrl,
  type Block,
  type Inline,
} from '@/lib/dev/markdownHtml'
import { jsonToXml, xmlToJson, type IndentChoice } from '@/lib/dev/jsonXml'
import {
  TOKEN_ALPHABETS,
  TOKEN_LIMITS,
  cleanPrefix,
  clampInt,
  entropyBits,
  formatEntropy,
  generateTokens,
  type TokenFormat,
} from '@/lib/dev/randomToken'
import { downloadText } from '@/lib/utils/download'
import { convertBulk, rowsToCsv, type UnitMode, type Zone } from '@/lib/dev/bulkTimestamp'

// ───────────── Markdown to HTML ─────────────
const MD_SAMPLE = `# Release notes

Version **2.1** adds *dark mode* and fixes \`parseConfig()\`. Read the [docs](https://example.com/docs).

## Changes

- Faster startup
- New settings page
  - Remember the last tab
  - Reset button
- Bug fixes

1. Install
2. Configure
3. Run

> Tip: keep the config file in version control.

| Option | Default | Notes |
| :----- | :-----: | ----: |
| port   | 8080    | TCP   |
| debug  | false   | slow  |

\`\`\`js
const answer = 6 * 7
\`\`\`

---

Raw HTML such as <script>alert(1)</script> is escaped, not run.
`

function InlineView({ nodes }: { nodes: Inline[] }): ReactNode {
  return (
    <>
      {nodes.map((n, i): ReactNode => {
        switch (n.t) {
          case 'text':
            return <Fragment key={i}>{n.v}</Fragment>
          case 'code':
            return (
              <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
                {n.v}
              </code>
            )
          case 'em':
            return (
              <em key={i}>
                <InlineView nodes={n.c} />
              </em>
            )
          case 'strong':
            return (
              <strong key={i}>
                <InlineView nodes={n.c} />
              </strong>
            )
          case 'del':
            return (
              <del key={i}>
                <InlineView nodes={n.c} />
              </del>
            )
          case 'br':
            return <br key={i} />
          case 'link': {
            const href = safeLinkUrl(n.href)
            if (!href) return <InlineView key={i} nodes={n.c} />
            return (
              <a key={i} href={href} title={n.title || undefined} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                <InlineView nodes={n.c} />
              </a>
            )
          }
          case 'image': {
            const src = safeImageUrl(n.src)
            // Remote images are not loaded in the preview, so the page never contacts third-party hosts for you.
            return (
              <span key={i} className="inline-block rounded border border-dashed border-line-strong px-1.5 py-0.5 text-xs text-muted">
                {src ? `Image: ${n.alt || 'no alt text'}` : n.alt}
              </span>
            )
          }
        }
      })}
    </>
  )
}

function BlockView({ b, tight }: { b: Block; tight?: boolean }): ReactNode {
  switch (b.t) {
    case 'heading': {
      const cls = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'][b.level - 1]
      const content = <InlineView nodes={b.c} />
      return b.level === 1 ? (
        <h3 className={`mt-4 font-semibold ${cls}`}>{content}</h3>
      ) : (
        <h4 className={`mt-4 font-semibold ${cls}`}>{content}</h4>
      )
    }
    case 'p':
      return tight ? <InlineView nodes={b.c} /> : <p className="mt-3 leading-relaxed"><InlineView nodes={b.c} /></p>
    case 'hr':
      return <hr className="my-4 border-line" />
    case 'code':
      return (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px]" data-lang={safeLang(b.lang) || undefined}>
          <code>{b.v}</code>
        </pre>
      )
    case 'quote':
      return (
        <blockquote className="mt-3 border-l-4 border-line-strong pl-3 text-ink-2">
          <BlocksView blocks={b.c} />
        </blockquote>
      )
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return (
        <Tag className={`mt-3 ml-6 ${b.ordered ? 'list-decimal' : 'list-disc'}`} start={b.ordered ? b.start : undefined}>
          {b.items.map((it, i) => (
            <li key={i} className="mt-1">
              <BlocksView blocks={it} tight={b.tight} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'table':
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {b.head.map((c, k) => (
                  <th key={k} style={{ textAlign: b.align[k] ?? undefined }} className="border border-line bg-surface px-2 py-1 font-semibold">
                    <InlineView nodes={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k} style={{ textAlign: b.align[k] ?? undefined }} className="border border-line px-2 py-1">
                      <InlineView nodes={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function BlocksView({ blocks, tight }: { blocks: Block[]; tight?: boolean }): ReactNode {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} tight={tight} />
      ))}
    </>
  )
}

export function MarkdownToHtml() {
  const [text, setText] = useState(MD_SAMPLE)
  const [view, setView] = useState<'html' | 'preview'>('html')
  const deferred = useDeferredValue(text)
  const blocks = useMemo(() => parseMarkdown(deferred), [deferred])
  const html = useMemo(() => blocksToHtml(blocks), [blocks])
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Markdown">
          <TextBox label="Markdown" value={text} onChange={setText} rows={18} paste clear placeholder="# Heading&#10;&#10;Write **Markdown** here." />
        </Panel>
        <Panel
          title="Result"
          actions={
            <Segmented
              label="Result view"
              value={view}
              onChange={setView}
              options={[
                { value: 'html', label: 'HTML' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
          }
        >
          {view === 'html' ? (
            <TextBox label="HTML" value={html} readOnly rows={18} copy extra={<DownloadButton size="sm" variant="secondary" disabled={!html} onClick={() => downloadText(html, 'converted.html', 'text/html;charset=utf-8')}>Download .html</DownloadButton>} />
          ) : (
            <div className="min-h-64 rounded-lg border border-line bg-paper p-4 text-sm" aria-label="Preview">
              {blocks.length ? <BlocksView blocks={blocks} /> : <p className="text-muted">Nothing to preview yet.</p>}
            </div>
          )}
        </Panel>
      </div>
      <Alert>
        Raw HTML in your Markdown is escaped, links that use javascript: or similar schemes are removed, and the preview never loads remote images. The converter covers common
        Markdown, not every CommonMark edge case.
      </Alert>
    </div>
  )
}

// ───────────── JSON <-> XML ─────────────
const JSON_SAMPLE = `{
  "library": {
    "@name": "City Library",
    "book": [
      { "@id": 1, "title": "Dune", "author": "Frank Herbert", "tags": ["scifi", "classic"] },
      { "@id": 2, "title": "Emma", "author": "Jane Austen", "available": false }
    ],
    "note": { "@lang": "en", "#text": "Open daily" },
    "closed": null
  }
}`

const XML_SAMPLE = `<?xml version="1.0"?>
<library name="City Library">
  <book id="1"><title>Dune</title><author>Frank Herbert</author></book>
  <book id="2"><title>Emma</title><author>Jane Austen</author></book>
  <note lang="en">Open daily</note>
  <closed/>
</library>`

export function JsonToXml() {
  const [dir, setDir] = useState<'j2x' | 'x2j'>('j2x')
  const [jsonText, setJsonText] = useState(JSON_SAMPLE)
  const [xmlText, setXmlText] = useState(XML_SAMPLE)
  const [root, setRoot] = useState('root')
  const [indent, setIndent] = useState<IndentChoice>(2)
  const [decl, setDecl] = useState(true)
  const [infer, setInfer] = useState(true)

  const result = useMemo(
    () => (dir === 'j2x' ? jsonToXml(jsonText, { root, indent, declaration: decl }) : xmlToJson(xmlText, { indent, inferTypes: infer })),
    [dir, jsonText, xmlText, root, indent, decl, infer],
  )
  const output = result.ok ? result.output : ''
  const input = dir === 'j2x' ? jsonText : xmlText
  const setInput = dir === 'j2x' ? setJsonText : setXmlText

  return (
    <div className="grid gap-4">
      <Panel title="Options">
        <div className="mb-4">
          <Segmented
            label="Direction"
            value={dir}
            onChange={setDir}
            options={[
              { value: 'j2x', label: 'JSON to XML' },
              { value: 'x2j', label: 'XML to JSON' },
            ]}
          />
        </div>
        <OptionRow>
          <Field label="Indent">
            {() => (
              <Segmented
                label="Indent"
                value={String(indent)}
                onChange={(v) => setIndent(v === 'tab' ? 'tab' : (Number(v) as IndentChoice))}
                options={[
                  { value: '2', label: '2 spaces' },
                  { value: '4', label: '4 spaces' },
                  { value: 'tab', label: 'Tab' },
                  { value: '0', label: 'Minified' },
                ]}
              />
            )}
          </Field>
          {dir === 'j2x' ? (
            <>
              <Field label="Root element name" hint="Used when the JSON has more than one top-level key, or is an array or a plain value.">
                {(id) => <Input id={id} value={root} onChange={(e) => setRoot(e.target.value)} placeholder="root" maxLength={60} />}
              </Field>
              <div className="flex items-end">
                <Switch checked={decl} onChange={setDecl} label="Add XML declaration" />
              </div>
            </>
          ) : (
            <div className="flex items-end">
              <Switch checked={infer} onChange={setInfer} label="Convert numbers and true/false" />
            </div>
          )}
        </OptionRow>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={dir === 'j2x' ? 'JSON input' : 'XML input'}>
          <TextBox label={dir === 'j2x' ? 'JSON' : 'XML'} value={input} onChange={setInput} rows={16} paste clear error={!result.ok} />
        </Panel>
        <Panel title={dir === 'j2x' ? 'XML output' : 'JSON output'}>
          {result.ok ? (
            <TextBox
              label={dir === 'j2x' ? 'XML' : 'JSON'}
              value={output}
              readOnly
              rows={16}
              copy
              extra={<DownloadButton size="sm" variant="secondary" disabled={!output} onClick={() => downloadText(output, dir === 'j2x' ? 'converted.xml' : 'converted.json', dir === 'j2x' ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8')}>Download</DownloadButton>}
            />
          ) : (
            <Alert tone="danger" title={dir === 'j2x' ? 'Invalid JSON' : 'Invalid XML'}>
              {result.error}
            </Alert>
          )}
          {result.ok && result.warnings.length ? (
            <Alert tone="warn" className="mt-3">
              {result.warnings.join(' ')}
            </Alert>
          ) : null}
        </Panel>
      </div>
      <Alert>
        Attributes use the @name convention and element text next to attributes or children uses #text. Repeated elements become arrays. XML comments, processing instructions and
        namespaces beyond the plain prefixed name are not carried over.
      </Alert>
    </div>
  )
}

// ───────────── Random token generator ─────────────
const FORMAT_LABEL: Record<TokenFormat, string> = {
  hex: 'Hex (0-9, a-f)',
  base64url: 'Base64url (A-Z, a-z, 0-9, - _)',
  base62: 'Base62 (A-Z, a-z, 0-9)',
  alphanumeric: 'Lowercase + digits (a-z, 0-9)',
}

export function RandomTokenGenerator() {
  const [format, setFormat] = useState<TokenFormat>('base62')
  const [length, setLength] = useState(32)
  const [count, setCount] = useState(5)
  const [prefix, setPrefix] = useState('sk_')
  const [tokens, setTokens] = useState<string[]>([])
  const [error, setError] = useState('')

  const len = clampInt(length, TOKEN_LIMITS.minLength, TOKEN_LIMITS.maxLength)
  const bits = entropyBits(format, len)

  const run = () => {
    try {
      setTokens(generateTokens({ format, length, count, prefix }))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate tokens.')
    }
  }

  useEffect(() => {
    run()
    // Generate once on mount and again whenever the options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, length, count, prefix])

  const joined = tokens.join('\n')
  return (
    <div className="grid gap-4">
      <Panel title="Options">
        <OptionRow>
          <Field label="Format">
            {(id) => (
              <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as TokenFormat)}>
                {(Object.keys(TOKEN_ALPHABETS) as TokenFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Random characters" hint={`${TOKEN_LIMITS.minLength} to ${TOKEN_LIMITS.maxLength}, not counting the prefix.`}>
            {(id) => <Input id={id} type="number" min={TOKEN_LIMITS.minLength} max={TOKEN_LIMITS.maxLength} value={length} onChange={(e) => setLength(Number(e.target.value))} />}
          </Field>
          <Field label="How many" hint={`Up to ${TOKEN_LIMITS.maxCount}.`}>
            {(id) => <Input id={id} type="number" min={1} max={TOKEN_LIMITS.maxCount} value={count} onChange={(e) => setCount(Number(e.target.value))} />}
          </Field>
          <Field label="Prefix (optional)" hint="Such as sk_, pk_live_ or ghp_. Whitespace is removed.">
            {(id) => <Input id={id} value={prefix} onChange={(e) => setPrefix(cleanPrefix(e.target.value))} maxLength={TOKEN_LIMITS.maxPrefix} placeholder="sk_" />}
          </Field>
        </OptionRow>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Entropy" value={`${formatEntropy(bits)} bits`} sub="of randomness per token" />
          <Stat label="Alphabet size" value={TOKEN_ALPHABETS[format].length} />
          <Stat label="Token length" value={len + cleanPrefix(prefix).length} sub="characters with prefix" />
        </div>
      </Panel>
      <Panel
        title="Tokens"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={run}>
              <RefreshCw className="size-4" aria-hidden />
              Generate again
            </Button>
            <CopyButton text={joined} label="Copy all" disabled={!tokens.length} />
          </div>
        }
      >
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : (
          <ul className="grid gap-2">
            {tokens.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <code className="min-w-0 break-all font-mono text-sm">{t}</code>
                <CopyButton text={t} size="sm" variant="ghost" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Alert>
        Tokens come from your browser&apos;s secure random number generator and are never sent anywhere or stored. 128 bits or more is a common target for secrets that must resist
        guessing. This tool creates the string only; your service still has to store it safely, for example as a hash.
      </Alert>
    </div>
  )
}

// ───────────── Bulk timestamp converter ─────────────
const TS_SAMPLE = `1700000000
1700000000123
2024-02-29 12:30:00
2025-01-01T00:00:00Z
not a date`

export function BulkTimestampConverter() {
  const [text, setText] = useState(TS_SAMPLE)
  const [zone, setZone] = useState<Zone>('utc')
  const [mode, setMode] = useState<UnitMode>('auto')
  const deferred = useDeferredValue(text)
  const { rows, truncated } = useMemo(() => convertBulk(deferred, zone, mode), [deferred, zone, mode])
  const csv = useMemo(() => rowsToCsv(rows), [rows])
  const errors = rows.filter((r) => r.kind === 'error').length
  const tsv = rows.map((r) => (r.kind === 'error' ? '' : r.kind === 'unix' ? (r.formatted ?? '') : String(r.seconds))).join('\n')

  return (
    <div className="grid gap-4">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Time zone for dates">{() => <Segmented label="Time zone" value={zone} onChange={setZone} options={[{ value: 'utc', label: 'UTC' }, { value: 'local', label: 'My time zone' }]} />}</Field>
          <Field label="Number unit" hint="Auto reads 10 digits as seconds and 13 as milliseconds.">
            {() => (
              <Segmented
                label="Number unit"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 's', label: 'Seconds' },
                  { value: 'ms', label: 'Milliseconds' },
                ]}
              />
            )}
          </Field>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Input, one per line"
          actions={
            <Button size="sm" onClick={() => setText((t) => (t.trim() ? t.replace(/\s+$/, '') + '\n' : '') + String(Math.floor(Date.now() / 1000)))}>
              Add current time
            </Button>
          }
        >
          <TextBox label="Timestamps or dates" value={text} onChange={setText} rows={14} paste clear placeholder="1700000000&#10;2024-02-29 12:30:00" />
        </Panel>
        <Panel title="Results" actions={<CopyButton text={csv} label="Copy CSV" disabled={!rows.length} />}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Enter at least one timestamp or date.</p>
          ) : (
            <div className="max-h-[26rem] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Input</th>
                    <th className="px-2 py-1.5 font-semibold">Unix (s)</th>
                    <th className="px-2 py-1.5 font-semibold">Date</th>
                    <th className="px-2 py-1.5 font-semibold">ISO (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-2 py-1.5 font-mono text-xs break-all">
                        {r.input}
                        {r.unit ? <span className="ml-1 text-muted">({r.unit})</span> : null}
                      </td>
                      {r.kind === 'error' ? (
                        <td colSpan={3} className="px-2 py-1.5 text-danger">
                          {r.error}
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 font-mono text-xs">{r.seconds}</td>
                          <td className="px-2 py-1.5 font-mono text-xs">{r.formatted}</td>
                          <td className="px-2 py-1.5 font-mono text-xs">{r.iso}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              {rows.length} line{rows.length === 1 ? '' : 's'}, {errors} not recognised
            </span>
            <CopyButton text={tsv} label="Copy converted column" variant="ghost" disabled={!rows.length} />
          </div>
          {truncated ? <Alert tone="warn" className="mt-3">Only the first 5,000 lines are converted.</Alert> : null}
        </Panel>
      </div>
    </div>
  )
}
