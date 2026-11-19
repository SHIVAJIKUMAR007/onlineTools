import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { Field, Input, Segmented, Select } from '@/components/ui/fields'
import { amountToWords, categoryOf, convertUnit, formatUnitValue, numberToWords, UNIT_CATEGORIES, type UnitCategoryId } from '@/lib/conversion/units'

// ───────────── Unit converter ─────────────
export function UnitConverter() {
  const [cat, setCat] = useState<UnitCategoryId>('length')
  const units = categoryOf(cat).units
  const [from, setFrom] = useState('cm')
  const [to, setTo] = useState('in')
  const [raw, setRaw] = useState('1')

  const pick = (c: UnitCategoryId) => {
    setCat(c)
    const u = categoryOf(c).units
    setFrom(u[0].id)
    setTo(u[Math.min(1, u.length - 1)].id)
  }
  const value = raw.trim() === '' ? NaN : Number(raw)
  const result = Number.isFinite(value) ? convertUnit(value, cat, from, to) : NaN
  const table = useMemo(() => (Number.isFinite(value) ? units.map((u) => ({ u, v: convertUnit(value, cat, from, u.id) })) : []), [value, units, cat, from])

  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-5 overflow-x-auto">
          <Segmented label="Category" value={cat} onChange={pick} options={UNIT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        </div>
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto_1fr]">
          <Field label="Value">{(id) => <Input id={id} inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} aria-invalid={raw.trim() !== '' && !Number.isFinite(value)} />}</Field>
          <Field label="From">{(id) => <Select id={id} value={from} onChange={(e) => setFrom(e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>}</Field>
          <Button variant="secondary" onClick={() => { setFrom(to); setTo(from) }} aria-label="Swap units"><ArrowLeftRight className="size-4" aria-hidden /></Button>
          <Field label="To">{(id) => <Select id={id} value={to} onChange={(e) => setTo(e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>}</Field>
        </div>
        <p className="mt-6 text-3xl font-semibold tracking-tight" aria-live="polite">
          {Number.isFinite(result) ? <>{formatUnitValue(value)} <span className="text-ink-2">=</span> {formatUnitValue(result)}</> : <span className="text-base font-normal text-muted">Enter a number to convert.</span>}
        </p>
        {raw.trim() !== '' && !Number.isFinite(value) && <Alert tone="danger" className="mt-4" role="alert">That is not a number.</Alert>}
      </Panel>
      {table.length > 0 && (
        <Panel title={`${formatUnitValue(value)} ${units.find((u) => u.id === from)?.label} in every unit`}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {table.map(({ u, v }) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">{u.label}</span><span className="tabular font-medium">{formatUnitValue(v)}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

// ───────────── Number to words ─────────────
export function NumberToWords() {
  const [mode, setMode] = useState<'number' | 'amount'>('number')
  const [input, setInput] = useState('')
  const [currency, setCurrency] = useState('dollar')
  const r = useMemo(() => {
    if (input.trim() === '') return { out: '', error: '' }
    try {
      if (mode === 'amount') {
        const [major, minor] = currency.split('/')
        return { out: amountToWords(input, major, minor), error: '' }
      }
      return { out: numberToWords(input), error: '' }
    } catch (e) {
      return { out: '', error: e instanceof Error ? e.message : 'Could not convert that number.' }
    }
  }, [input, mode, currency])
  const cap = r.out ? r.out[0].toUpperCase() + r.out.slice(1) : ''
  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-5">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'number', label: 'Plain number' }, { value: 'amount', label: 'Money amount' }]} />
          {mode === 'amount' && (
            <Field label="Currency" className="w-48">
              {(id) => (
                <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="dollar/cent">Dollars and cents</option>
                  <option value="euro/cent">Euros and cents</option>
                  <option value="pound/pence">Pounds and pence</option>
                  <option value="rupee/paise">Rupees and paise</option>
                </Select>
              )}
            </Field>
          )}
        </div>
        <Field label={mode === 'amount' ? 'Amount' : 'Number'} hint="Commas and spaces are ignored.">
          {(id) => <Input id={id} inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === 'amount' ? '1,204.50' : '1204'} aria-invalid={!!r.error} />}
        </Field>
      </Panel>
      {r.error && <Alert tone="danger" role="alert">{r.error}</Alert>}
      <Panel><TextBox label="In words" value={cap} readOnly rows={4} copy placeholder="The words appear here." /></Panel>
    </div>
  )
}
