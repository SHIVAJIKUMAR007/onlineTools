import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import {
  dateToTimestamp,
  generatePassword,
  guessUnit,
  passwordEntropy,
  passwordPoolSize,
  radixToText,
  RadixError,
  relativeTime,
  strengthLabel,
  testRegex,
  textToRadix,
  timestampToDate,
  type PasswordOptions,
  type Radix,
  type TimestampUnit,
} from '@/lib/dev/extra'
import { cn } from '@/lib/utils/cn'

// ───────────── Password generator ─────────────
export function PasswordGenerator() {
  const [o, setO] = useState<PasswordOptions>({ length: 16, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false })
  const [count, setCount] = useState(1)
  const [seed, setSeed] = useState(0)
  const set = <K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => Array.from({ length: count }, () => generatePassword(o)), [o, count, seed])
  const bits = passwordEntropy(o.length, passwordPoolSize(o))
  const none = !o.lower && !o.upper && !o.digits && !o.symbols
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="space-y-5">
          <Field label={`Length: ${o.length}`}>
            {(id) => <input id={id} type="range" min={6} max={64} value={o.length} onChange={(e) => set('length', Number(e.target.value))} className="w-full max-w-md accent-[var(--color-accent)]" />}
          </Field>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Switch checked={o.lower} onChange={(v) => set('lower', v)} label="Lowercase a-z" />
            <Switch checked={o.upper} onChange={(v) => set('upper', v)} label="Uppercase A-Z" />
            <Switch checked={o.digits} onChange={(v) => set('digits', v)} label="Numbers 0-9" />
            <Switch checked={o.symbols} onChange={(v) => set('symbols', v)} label="Symbols !@#$" />
            <Switch checked={o.excludeAmbiguous} onChange={(v) => set('excludeAmbiguous', v)} label="Avoid look-alikes (O, 0, l, 1)" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="How many" className="w-28">
              {(id) => <Input id={id} type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />}
            </Field>
            <Button variant="primary" onClick={() => setSeed((s) => s + 1)} disabled={none}>
              <RefreshCw className="size-4" aria-hidden /> Generate
            </Button>
          </div>
        </div>
      </Panel>
      {none ? (
        <Alert tone="warn">Turn on at least one character type.</Alert>
      ) : (
        <Panel title={count > 1 ? 'Passwords' : 'Password'} actions={<CopyButton text={list.join('\n')} />}>
          <ul className="space-y-2">
            {list.map((p, i) => (
              <li key={`${seed}-${i}`} className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[15px]">{p}</li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
            <Badge tone={bits >= 60 ? 'accent' : 'warn'}>{strengthLabel(bits)}</Badge>
            about {Math.round(bits)} bits of entropy. Generated with your browser's secure random generator and never sent anywhere.
          </p>
        </Panel>
      )}
    </div>
  )
}

// ───────────── Regex tester ─────────────
const FLAGS: { flag: string; label: string }[] = [
  { flag: 'g', label: 'g global' },
  { flag: 'i', label: 'i ignore case' },
  { flag: 'm', label: 'm multiline' },
  { flag: 's', label: 's dot matches newline' },
  { flag: 'u', label: 'u unicode' },
]

export function RegexTester() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('')
  const r = useMemo(() => testRegex(pattern, flags, text), [pattern, flags, text])
  const toggle = (f: string) => setFlags((p) => (p.includes(f) ? p.replace(f, '') : p + f))

  const highlighted = useMemo(() => {
    const parts: { text: string; hit: boolean }[] = []
    let pos = 0
    for (const m of r.matches) {
      if (m.text === '') continue
      if (m.index > pos) parts.push({ text: text.slice(pos, m.index), hit: false })
      parts.push({ text: m.text, hit: true })
      pos = m.index + m.text.length
    }
    if (pos < text.length) parts.push({ text: text.slice(pos), hit: false })
    return parts
  }, [r.matches, text])

  return (
    <div className="space-y-5">
      <Panel title="Pattern">
        <div className="space-y-4">
          <Field label="Regular expression">
            {(id) => (
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted">/</span>
                <Input id={id} value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="(\\d+)-(\\w+)" spellCheck={false} autoComplete="off" className="font-mono" aria-invalid={!!r.error} />
                <span className="text-muted">/{flags}</span>
              </div>
            )}
          </Field>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FLAGS.map((f) => (
              <Switch key={f.flag} checked={flags.includes(f.flag)} onChange={() => toggle(f.flag)} label={f.label} />
            ))}
          </div>
          {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
        </div>
      </Panel>
      <Panel><TextBox label="Test text" value={text} onChange={setText} rows={8} placeholder="Paste the text to search…" paste clear /></Panel>
      <Panel title="Matches" actions={<span className="text-sm text-ink-2" aria-live="polite">{r.matches.length}{r.truncated ? '+' : ''} found</span>}>
        {!pattern || !text ? (
          <p className="text-sm text-muted">Enter a pattern and some text to see matches.</p>
        ) : r.error ? null : r.matches.length === 0 ? (
          <p className="text-sm text-muted">No matches.</p>
        ) : (
          <div className="space-y-4">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-3 font-mono text-[13px] leading-6">
              {highlighted.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-add-strong">{p.text}</mark> : <span key={i}>{p.text}</span>))}
            </pre>
            <div className="max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Match</th><th className="px-3 py-2">Index</th><th className="px-3 py-2">Groups</th></tr>
                </thead>
                <tbody>
                  {r.matches.slice(0, 200).map((m, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="tabular px-3 py-1.5 text-muted">{i + 1}</td>
                      <td className="break-all px-3 py-1.5 font-mono">{m.text === '' ? <em className="text-muted">empty</em> : m.text}</td>
                      <td className="tabular px-3 py-1.5">{m.index}</td>
                      <td className="break-all px-3 py-1.5 font-mono text-xs">
                        {[...m.groups.map((g, gi) => `$${gi + 1} = ${g ?? 'undefined'}`), ...Object.entries(m.named).map(([k, v]) => `${k} = ${v}`)].join(', ') || <span className="text-muted">none</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.truncated && <p className="text-xs text-muted">Showing the first 1,000 matches.</p>}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Unix timestamp converter ─────────────
const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

export function TimestampConverter() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const [raw, setRaw] = useState('')
  const [unitChoice, setUnitChoice] = useState<'auto' | TimestampUnit>('auto')
  const num = raw.trim() === '' ? NaN : Number(raw.trim())
  const unit: TimestampUnit = unitChoice === 'auto' ? (Number.isFinite(num) ? guessUnit(num) : 'seconds') : unitChoice
  const date = Number.isFinite(num) ? timestampToDate(num, unit) : null

  const [local, setLocal] = useState('')
  const fromLocal = local ? new Date(local) : null
  const validLocal = fromLocal && !Number.isNaN(fromLocal.getTime()) ? fromLocal : null

  return (
    <div className="space-y-5">
      <Panel title="Current Unix time">
        <div className="grid gap-3 sm:grid-cols-2" aria-live="off">
          <Stat label="Seconds" value={String(Math.floor(now.getTime() / 1000))} />
          <Stat label="Milliseconds" value={String(now.getTime())} />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Timestamp to date">
          <div className="space-y-4">
            <Field label="Unix timestamp">
              {(id) => <Input id={id} inputMode="numeric" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="1700000000" spellCheck={false} className="font-mono" />}
            </Field>
            <Segmented label="Unit" value={unitChoice} onChange={setUnitChoice} options={[{ value: 'auto', label: 'Auto' }, { value: 'seconds', label: 'Seconds' }, { value: 'milliseconds', label: 'Milliseconds' }]} />
            {raw.trim() !== '' && !date && <Alert tone="danger" role="alert">That is not a valid timestamp.</Alert>}
            {date && (
              <dl className="space-y-2 text-sm">
                <Row label="Your time zone" value={date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })} />
                <Row label="UTC" value={date.toUTCString()} />
                <Row label="ISO 8601" value={date.toISOString()} />
                <Row label="Relative" value={relativeTime(date, now)} />
                <Row label="Read as" value={unit} />
              </dl>
            )}
          </div>
        </Panel>
        <Panel title="Date to timestamp">
          <div className="space-y-4">
            <Field label="Date and time (your time zone)">
              {(id) => (
                <div className="flex gap-2">
                  <Input id={id} type="datetime-local" step={1} value={local} onChange={(e) => setLocal(e.target.value)} />
                  <Button variant="secondary" onClick={() => setLocal(toLocalInput(new Date()))}>Now</Button>
                </div>
              )}
            </Field>
            {validLocal ? (
              <dl className="space-y-2 text-sm">
                <Row label="Seconds" value={String(dateToTimestamp(validLocal, 'seconds'))} copy />
                <Row label="Milliseconds" value={String(dateToTimestamp(validLocal, 'milliseconds'))} copy />
                <Row label="UTC" value={validLocal.toUTCString()} />
              </dl>
            ) : (
              <p className="text-sm text-muted">Pick a date to get its timestamp.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex items-center gap-2 break-all text-right font-medium">
        {value}
        {copy && <CopyButton text={value} label="Copy" />}
      </dd>
    </div>
  )
}

// ───────────── Hex / binary / ASCII ─────────────
const RADIXES: { value: Radix; label: string }[] = [
  { value: 'hex', label: 'Hex' },
  { value: 'binary', label: 'Binary' },
  { value: 'decimal', label: 'Decimal (ASCII)' },
  { value: 'octal', label: 'Octal' },
]

export function BaseConverter() {
  const [dir, setDir] = useState<'encode' | 'decode'>('encode')
  const [radix, setRadix] = useState<Radix>('hex')
  const [input, setInput] = useState('')
  const result = useMemo(() => {
    try {
      return { out: dir === 'encode' ? textToRadix(input, radix) : radixToText(input, radix), error: '' }
    } catch (e) {
      return { out: '', error: e instanceof RadixError ? e.message : 'Could not convert that input.' }
    }
  }, [dir, radix, input])
  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Text to code' }, { value: 'decode', label: 'Code to text' }]} />
          <Segmented label="Number base" value={radix} onChange={setRadix} options={RADIXES} />
        </div>
        <div className={cn('grid gap-5 lg:grid-cols-2')}>
          <TextBox label={dir === 'encode' ? 'Text' : `${radix[0].toUpperCase()}${radix.slice(1)} bytes`} value={input} onChange={setInput} rows={10} placeholder={dir === 'encode' ? 'Hello' : radix === 'hex' ? '48 65 6c 6c 6f' : ''} paste clear error={!!result.error} />
          <TextBox label={dir === 'encode' ? `${radix[0].toUpperCase()}${radix.slice(1)} bytes` : 'Text'} value={result.out} readOnly rows={10} copy />
        </div>
        {result.error && <Alert tone="danger" className="mt-4" role="alert">{result.error}</Alert>}
      </Panel>
    </div>
  )
}
