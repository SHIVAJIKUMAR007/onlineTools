import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import {
  computeHmac,
  formatDigest,
  HMAC_ALGOS,
  parseKey,
  verifyHmac,
  type HmacAlgo,
  type KeyEncoding,
  type OutputEncoding,
  type VerifyResult,
} from '@/lib/security/hmac'
import { analyzePassword, ATTACK_RATES, crackSeconds, formatDuration } from '@/lib/security/strength'
import { cryptoBytes, generatePassphrase, passphraseEntropy, WORDLIST, type PassphraseOptions, type Separator } from '@/lib/security/passphrase'
import { cn } from '@/lib/utils/cn'

// ───────────── HMAC generator ─────────────
export function HmacGenerator() {
  const [message, setMessage] = useState('')
  const [key, setKey] = useState('')
  const [keyEnc, setKeyEnc] = useState<KeyEncoding>('text')
  const [algo, setAlgo] = useState<HmacAlgo>('SHA-256')
  const [outEnc, setOutEnc] = useState<OutputEncoding>('hex')
  const [upper, setUpper] = useState(false)
  const [expected, setExpected] = useState('')
  const [digest, setDigest] = useState<Uint8Array | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const k = parseKey(key, keyEnc)
        const d = await computeHmac(algo, k, message)
        if (!cancelled) {
          setDigest(d)
          setError('')
        }
      } catch (e) {
        if (!cancelled) {
          setDigest(null)
          setError(e instanceof Error ? e.message : 'Could not compute the HMAC.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [message, key, keyEnc, algo])

  const output = digest ? formatDigest(digest, outEnc, upper) : ''
  const verify: VerifyResult | null = digest && expected.trim() ? verifyHmac(expected, digest) : null

  return (
    <div className="space-y-5">
      <Panel title="Message and key">
        <div className="space-y-4">
          <TextBox label="Message" value={message} onChange={setMessage} rows={5} placeholder="Text to sign" paste clear />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Secret key" hint="Keys stay in this page. Nothing is sent anywhere.">
              {(id) => <Input id={id} value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} autoComplete="off" className="font-mono" placeholder="Secret key" />}
            </Field>
            <Segmented
              label="Key format"
              value={keyEnc}
              onChange={setKeyEnc}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'hex', label: 'Hex' },
                { value: 'base64', label: 'Base64' },
              ]}
            />
          </div>
        </div>
      </Panel>
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field label="Algorithm" className="w-40">
            {(id) => (
              <Select id={id} value={algo} onChange={(e) => setAlgo(e.target.value as HmacAlgo)}>
                {HMAC_ALGOS.map((a) => (
                  <option key={a} value={a}>HMAC-{a}</option>
                ))}
              </Select>
            )}
          </Field>
          <Segmented
            label="Output format"
            value={outEnc}
            onChange={setOutEnc}
            options={[
              { value: 'hex', label: 'Hex' },
              { value: 'base64', label: 'Base64' },
            ]}
          />
          {outEnc === 'hex' && <Switch checked={upper} onChange={setUpper} label="Uppercase hex" />}
        </div>
      </Panel>
      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : (
        <Panel title={`HMAC-${algo}`} actions={<CopyButton text={output} disabled={!output} />}>
          <p className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[14px]" aria-live="polite">{output}</p>
          {algo === 'SHA-1' && <p className="mt-3 text-xs text-muted">HMAC-SHA-1 is still considered safe as a MAC, but prefer SHA-256 or higher for new work.</p>}
        </Panel>
      )}
      <Panel title="Verify an HMAC">
        <div className="space-y-3">
          <Field label="Expected HMAC" hint="Paste a hex or Base64 value. The comparison does not stop at the first differing character.">
            {(id) => <Input id={id} value={expected} onChange={(e) => setExpected(e.target.value)} spellCheck={false} autoComplete="off" className="font-mono" placeholder="Paste the HMAC to check" />}
          </Field>
          {verify && (
            <Alert tone={verify.match ? 'success' : 'danger'} role="status">
              {verify.match ? `Match. The ${verify.format} value equals the computed HMAC.` : verify.format === 'unknown' ? 'That does not look like hex or Base64.' : 'No match. Check the message, key, algorithm and key format.'}
            </Alert>
          )}
        </div>
      </Panel>
    </div>
  )
}

// ───────────── Password strength checker ─────────────
const BAR = ['bg-danger', 'bg-danger', 'bg-warn', 'bg-accent', 'bg-accent']

export function PasswordStrengthChecker() {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const a = useMemo(() => analyzePassword(pw), [pw])
  const has = pw.length > 0
  return (
    <div className="space-y-5">
      <Panel title="Password">
        <div className="space-y-3">
          <Field label="Type or paste a password" hint="Checked in your browser only. Nothing is sent or stored.">
            {(id) => (
              <div className="flex items-center gap-2">
                <Input id={id} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" placeholder="Enter a password" />
                <Button variant="secondary" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  {show ? 'Hide' : 'Show'}
                </Button>
              </div>
            )}
          </Field>
          <Alert tone="info">This is an estimate, not a guarantee. If you are unsure, test a similar password instead of one you rely on. This page never sends what you type anywhere.</Alert>
        </div>
      </Panel>
      {has && (
        <>
          <Panel title="Result">
            <div className="space-y-4">
              <div className="flex items-center gap-3" aria-live="polite">
                <Badge tone={a.score >= 3 ? 'accent' : a.score === 2 ? 'warn' : 'danger'}>{a.label}</Badge>
                <span className="text-sm text-ink-2">about {Math.round(a.bits)} bits (up to {Math.round(a.naiveBits)} if fully random)</span>
              </div>
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={cn('h-2 flex-1 rounded-full', i <= a.score ? BAR[a.score] : 'bg-surface-2')} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Length" value={a.length} />
                <Stat label="Character pool" value={a.poolSize} />
                <Stat label="Estimated entropy" value={`${Math.round(a.bits)} bits`} />
                <Stat label="Character types" value={Object.values(a.classes).filter(Boolean).length} sub="of 4" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(['lower', 'upper', 'digits', 'symbols'] as const).map((k) => (
                  <Badge key={k} tone={a.classes[k] ? 'accent' : 'neutral'}>{{ lower: 'a-z', upper: 'A-Z', digits: '0-9', symbols: 'symbols' }[k]}</Badge>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Estimated time to guess">
            <ul className="divide-y divide-line text-sm">
              {ATTACK_RATES.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-ink-2">{r.label}</span>
                  <span className="tabular font-medium">{formatDuration(crackSeconds(a.bits, r.perSecond))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Average time to find the password, assuming the attacker guesses in the most likely order. Real attackers vary a lot, so treat these figures as rough.</p>
          </Panel>
          {a.segments.length > 0 && (
            <Panel title="Patterns found">
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                {a.segments.map((s, i) => (
                  <li key={i}>{s.note}</li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Suggestions">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {a.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}

// ───────────── Passphrase generator ─────────────
export function PassphraseGenerator() {
  const [o, setO] = useState<PassphraseOptions>({ words: 5, separator: 'hyphen', capitalize: false, appendNumber: false })
  const [seed, setSeed] = useState(0)
  const [list, setList] = useState<string[]>([])
  const [count, setCount] = useState(1)
  const set = <K extends keyof PassphraseOptions>(k: K, v: PassphraseOptions[K]) => setO((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    try {
      setList(Array.from({ length: count }, () => generatePassphrase(o, cryptoBytes)))
    } catch {
      setList([])
    }
  }, [o, seed, count])

  const bits = passphraseEntropy(o.words, o.appendNumber)
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="space-y-5">
          <Field label={`Words: ${o.words}`}>
            {(id) => <input id={id} type="range" min={3} max={12} value={o.words} onChange={(e) => set('words', Number(e.target.value))} className="w-full max-w-md accent-[var(--color-accent)]" />}
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Separator" className="w-40">
              {(id) => (
                <Select id={id} value={o.separator} onChange={(e) => set('separator', e.target.value as Separator)}>
                  <option value="hyphen">Hyphen (-)</option>
                  <option value="space">Space</option>
                  <option value="dot">Dot (.)</option>
                  <option value="underscore">Underscore (_)</option>
                  <option value="none">None</option>
                </Select>
              )}
            </Field>
            <Field label="How many" className="w-28">
              {(id) => <Input id={id} type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />}
            </Field>
            <Switch checked={o.capitalize} onChange={(v) => set('capitalize', v)} label="Capitalize words" />
            <Switch checked={o.appendNumber} onChange={(v) => set('appendNumber', v)} label="Add a number" />
            <Button variant="primary" onClick={() => setSeed((s) => s + 1)}>
              <RefreshCw className="size-4" aria-hidden /> Generate
            </Button>
          </div>
        </div>
      </Panel>
      <Panel title={count > 1 ? 'Passphrases' : 'Passphrase'} actions={<CopyButton text={list.join('\n')} disabled={!list.length} />}>
        <ul className="space-y-2" aria-live="polite">
          {list.map((p, i) => (
            <li key={`${seed}-${i}`} className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-[15px]">{p}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-2">
          <Badge tone={bits >= 64 ? 'accent' : 'warn'}>{Math.round(bits)} bits</Badge>{' '}
          {o.words} words from a list of {WORDLIST.length} gives {o.words} x 8 = {o.words * 8} bits{o.appendNumber ? ', plus about 3 bits for the number' : ''}.
        </p>
        <p className="mt-2 text-xs text-muted">The list is small (256 words), so each word adds only 8 bits. Use 8 or more words for anything important. Words are picked with your browser's secure random generator and never leave this page.</p>
      </Panel>
    </div>
  )
}
