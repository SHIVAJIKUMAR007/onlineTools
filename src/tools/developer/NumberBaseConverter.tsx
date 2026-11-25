import { useMemo, useState } from 'react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Field, Input, Select, Switch } from '@/components/ui/fields'
import { Alert } from '@/components/ui/misc'
import { MAX_BASE, MIN_BASE, formatInBase, groupDigits, parseInBase } from '@/lib/dev/baseConvert'

const COMMON = [
  { base: 2, name: 'Binary', group: 4 },
  { base: 8, name: 'Octal', group: 3 },
  { base: 10, name: 'Decimal', group: 3 },
  { base: 16, name: 'Hexadecimal', group: 4 },
]

export default function NumberBaseConverter() {
  const [text, setText] = useState('255')
  const [from, setFrom] = useState(10)
  const [custom, setCustom] = useState(36)
  const [grouped, setGrouped] = useState(false)
  const parsed = useMemo(() => parseInBase(text, from), [text, from])
  const fmt = (v: bigint, base: number, group: number) => {
    const s = formatInBase(v, base).toUpperCase()
    return grouped ? groupDigits(s, group) : s
  }
  const rows = parsed.ok
    ? [...COMMON.map((c) => ({ ...c, out: fmt(parsed.value, c.base, c.group) })), { base: custom, name: `Base ${custom}`, group: 4, out: fmt(parsed.value, custom, 4) }]
    : []

  return (
    <Panel title="Number base converter">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Number" hint="Spaces and underscores are ignored. A leading minus and a 0x, 0b or 0o prefix are accepted.">
            {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} className="font-mono" spellCheck={false} />}
          </Field>
          <Field label="Convert from">
            {(id) => (
              <Select id={id} value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {Array.from({ length: MAX_BASE - MIN_BASE + 1 }, (_, i) => i + MIN_BASE).map((b) => (
                  <option key={b} value={b}>{b === 2 ? 'Binary (2)' : b === 8 ? 'Octal (8)' : b === 10 ? 'Decimal (10)' : b === 16 ? 'Hexadecimal (16)' : `Base ${b}`}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Custom output base" className="w-44">
            {(id) => (
              <Select id={id} value={custom} onChange={(e) => setCustom(Number(e.target.value))}>
                {Array.from({ length: MAX_BASE - MIN_BASE + 1 }, (_, i) => i + MIN_BASE).map((b) => <option key={b} value={b}>Base {b}</option>)}
              </Select>
            )}
          </Field>
          <Switch checked={grouped} onChange={setGrouped} label="Group digits" />
        </div>
        {!parsed.ok && text.trim() !== '' && <Alert tone="danger">{parsed.error}</Alert>}
        {rows.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{r.name}</p>
                  <p className="break-all font-mono text-sm">{r.out}</p>
                </div>
                <CopyButton text={r.out} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Whole numbers only. Letters A to Z stand for digits 10 to 35. Values are exact, however large.</p>
      </div>
    </Panel>
  )
}
