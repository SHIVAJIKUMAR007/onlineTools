import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { Field, Input, Select, Segmented, Switch } from '@/components/ui/fields'
import { CHARSETS, jsonEscape, jsonUnescape, randomString, UnescapeError, type Charset } from '@/lib/dev/more'

// ───────────── JSON escape / unescape ─────────────
export function JsonEscape() {
  const [dir, setDir] = useState<'escape' | 'unescape'>('escape')
  const [input, setInput] = useState('')
  const [quotes, setQuotes] = useState(false)
  const [asciiOnly, setAsciiOnly] = useState(false)
  const r = useMemo(() => {
    try {
      return { out: dir === 'escape' ? jsonEscape(input, { quotes, asciiOnly }) : jsonUnescape(input), error: '' }
    } catch (e) {
      return { out: '', error: e instanceof UnescapeError ? e.message : 'Could not convert that text.' }
    }
  }, [dir, input, quotes, asciiOnly])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'escape', label: 'Escape' }, { value: 'unescape', label: 'Unescape' }]} />
          {dir === 'escape' && (
            <>
              <Switch checked={quotes} onChange={setQuotes} label="Include surrounding quotes" />
              <Switch checked={asciiOnly} onChange={setAsciiOnly} label="Escape non-ASCII as \uXXXX" />
            </>
          )}
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label={dir === 'escape' ? 'Plain text' : 'Escaped string'} value={input} onChange={setInput} rows={12} placeholder={dir === 'escape' ? 'Line one\nHe said "hi"' : 'Line one\\nHe said \\"hi\\"'} paste clear error={!!r.error} /></Panel>
        <Panel><TextBox label={dir === 'escape' ? 'Escaped string' : 'Plain text'} value={r.out} readOnly rows={12} copy /></Panel>
      </div>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
    </div>
  )
}

// ───────────── Random string generator ─────────────
const CHARSET_LABELS: Record<Charset, string> = {
  alnum: 'Letters and numbers',
  letters: 'Letters only',
  lower: 'Lowercase letters',
  upper: 'Uppercase letters',
  digits: 'Numbers only',
  hex: 'Hexadecimal',
  base64url: 'URL-safe (A-Z a-z 0-9 - _)',
  custom: 'Custom characters',
}

export function RandomStringGenerator() {
  const [length, setLength] = useState(24)
  const [count, setCount] = useState(5)
  const [set, setSet] = useState<Charset>('alnum')
  const [custom, setCustom] = useState('')
  const [seed, setSeed] = useState(0)
  const chars = set === 'custom' ? custom : CHARSETS[set]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => Array.from({ length: count }, () => randomString(length, chars)), [length, count, chars, seed])
  const unique = new Set([...chars]).size
  const bits = unique > 1 ? length * Math.log2(unique) : 0
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Length" className="w-28">
            {(id) => <Input id={id} type="number" min={1} max={4096} value={length} onChange={(e) => setLength(Math.min(4096, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Field label="How many" className="w-28">
            {(id) => <Input id={id} type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Field label="Characters" className="min-w-56">
            {(id) => (
              <Select id={id} value={set} onChange={(e) => setSet(e.target.value as Charset)}>
                {(Object.keys(CHARSET_LABELS) as Charset[]).map((k) => <option key={k} value={k}>{CHARSET_LABELS[k]}</option>)}
              </Select>
            )}
          </Field>
          {set === 'custom' && (
            <Field label="Allowed characters" className="min-w-56">
              {(id) => <Input id={id} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="abc123!?" spellCheck={false} className="font-mono" />}
            </Field>
          )}
          <Button variant="primary" onClick={() => setSeed((s) => s + 1)} disabled={unique === 0}>
            <RefreshCw className="size-4" aria-hidden /> Generate
          </Button>
        </div>
      </Panel>
      {unique === 0 ? (
        <Alert tone="warn">Enter at least one allowed character.</Alert>
      ) : (
        <Panel title="Results" actions={<CopyButton text={list.join('\n')} label="Copy all" />}>
          <ul className="space-y-2">
            {list.map((s, i) => <li key={`${seed}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"><span className="break-all font-mono text-[14px]">{s}</span><CopyButton text={s} /></li>)}
          </ul>
          <p className="mt-4 text-sm text-ink-2">About {Math.round(bits)} bits of randomness per string. Made with your browser's secure random generator.</p>
        </Panel>
      )}
    </div>
  )
}
