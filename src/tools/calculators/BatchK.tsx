import { useState } from 'react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Field, Input, Segmented, Textarea } from '@/components/ui/fields'
import { Alert, Stat } from '@/components/ui/misc'
import {
  describeNumbers,
  fmtNum,
  parseNumberList,
  parseWeightedList,
  scaleRatio,
  shareTotal,
  simplifyRatio,
  solveProportion,
  weightedAverage,
  type Unknown,
} from '@/lib/calc/batchK'

type Section = 'simplify' | 'solve' | 'average'

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

function Simplify() {
  const [text, setText] = useState('12:18:30')
  const [factor, setFactor] = useState('2')
  const [total, setTotal] = useState('')
  const terms = text.split(/[:\s,/]+/).filter(Boolean).map(Number)
  const simple = simplifyRatio(terms)
  const f = num(factor)
  const t = num(total)
  const shares = simple && Number.isFinite(t) ? shareTotal(t, simple) : null
  const out = simple ? simple.join(' : ') : ''
  return (
    <Panel title="Simplify and scale a ratio" actions={out ? <CopyButton text={out} label="Copy ratio" /> : undefined}>
      <div className="space-y-4">
        <Field label="Ratio" hint="Two to six terms, separated by colons, commas or spaces. Decimals are fine.">
          {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        {!simple && text.trim() !== '' && <Alert tone="warn">Enter at least two non-negative numbers, and at least one above zero.</Alert>}
        {simple && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Simplest form" value={out} />
              <Stat label="As fractions of the whole" value={simple.map((v) => `${v}/${simple.reduce((a, b) => a + b, 0)}`).join(', ')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Multiply every term by">
                {(id) => <Input id={id} type="number" inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} />}
              </Field>
              <Field label="Split a total in this ratio (optional)">
                {(id) => <Input id={id} type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="e.g. 500" />}
              </Field>
            </div>
            {Number.isFinite(f) && <Stat label={`Scaled by ${fmtNum(f)}`} value={scaleRatio(simple, f).map((v) => fmtNum(v)).join(' : ')} />}
            {shares && <Stat label={`Shares of ${fmtNum(t)}`} value={shares.map((v) => fmtNum(v)).join(' , ')} />}
          </>
        )}
      </div>
    </Panel>
  )
}

function Solve() {
  const [unknown, setUnknown] = useState<Unknown>('d')
  const [v, setV] = useState({ a: '3', b: '4', c: '9', d: '' })
  const nums = { a: num(v.a), b: num(v.b), c: num(v.c), d: num(v.d) }
  const others = (['a', 'b', 'c', 'd'] as const).filter((k) => k !== unknown)
  const ready = others.every((k) => Number.isFinite(nums[k]))
  const answer = ready ? solveProportion({ ...nums, [unknown]: 0 } as { a: number; b: number; c: number; d: number }, unknown) : null
  const show = (k: Unknown) => (k === unknown ? (answer !== null ? fmtNum(answer) : '?') : v[k] || '?')
  const cell = (k: Unknown) =>
    k === unknown ? (
      <div className="flex h-10 items-center justify-center rounded-lg bg-accent-tint text-lg font-semibold text-accent" aria-label={`${k.toUpperCase()} is the unknown`}>
        {answer !== null ? fmtNum(answer) : '?'}
      </div>
    ) : (
      <Input aria-label={`Term ${k.toUpperCase()}`} type="number" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    )
  return (
    <Panel title="Solve a proportion">
      <div className="space-y-4">
        <Segmented
          label="Unknown term"
          value={unknown}
          onChange={setUnknown}
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
            { value: 'd', label: 'D' },
          ]}
        />
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-2 sm:max-w-xl">
          {cell('a')}
          <span aria-hidden>:</span>
          {cell('b')}
          <span aria-hidden className="px-1">=</span>
          {cell('c')}
          <span aria-hidden>:</span>
          {cell('d')}
        </div>
        <p className="text-sm text-muted">Choose which term is missing and fill in the other three.</p>
        {ready && answer === null && <Alert tone="warn">That cannot be solved because it would divide by zero.</Alert>}
        {answer !== null && (
          <div className="flex flex-wrap items-center gap-3">
            <Stat label="Result" value={`${show('a')} : ${show('b')} = ${show('c')} : ${show('d')}`} />
            <CopyButton text={fmtNum(answer)} label="Copy value" />
          </div>
        )}
      </div>
    </Panel>
  )
}

function Average() {
  const [text, setText] = useState('4, 8, 8, 15, 16, 23, 42')
  const [wtext, setWtext] = useState('90 40\n78 30\n85 30')
  const { values, invalid } = parseNumberList(text)
  const stats = describeNumbers(values)
  const { pairs, invalid: winvalid } = parseWeightedList(wtext)
  const wavg = weightedAverage(pairs)
  const summary = stats
    ? `Count ${stats.count}, sum ${fmtNum(stats.sum)}, mean ${fmtNum(stats.mean)}, median ${fmtNum(stats.median)}, mode ${stats.mode.length ? stats.mode.map((m) => fmtNum(m)).join(', ') : 'none'}, range ${fmtNum(stats.range)}`
    : ''
  return (
    <div className="space-y-5">
      <Panel title="Mean, median, mode and range" actions={summary ? <CopyButton text={summary} label="Copy" /> : undefined}>
        <div className="space-y-4">
          <Field label="Numbers" hint="Separate with commas, spaces or new lines.">
            {(id) => <Textarea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          {invalid.length > 0 && <Alert tone="warn">Ignored: {invalid.slice(0, 8).join(', ')}{invalid.length > 8 ? '...' : ''}</Alert>}
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Mean" value={fmtNum(stats.mean)} />
              <Stat label="Median" value={fmtNum(stats.median)} />
              <Stat label={stats.mode.length > 1 ? 'Modes' : 'Mode'} value={stats.mode.length ? stats.mode.map((m) => fmtNum(m)).join(', ') : 'None'} />
              <Stat label="Range" value={fmtNum(stats.range)} sub={`${fmtNum(stats.min)} to ${fmtNum(stats.max)}`} />
              <Stat label="Count" value={stats.count} />
              <Stat label="Sum" value={fmtNum(stats.sum)} />
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Weighted average">
        <div className="space-y-4">
          <Field label="Value and weight, one pair per line" hint="For example, a score of 90 that counts for 40: type 90 40.">
            {(id) => <Textarea id={id} rows={4} value={wtext} onChange={(e) => setWtext(e.target.value)} />}
          </Field>
          {winvalid.length > 0 && <Alert tone="warn">Could not read: {winvalid.slice(0, 5).join(' | ')}</Alert>}
          {wavg !== null && <Stat label="Weighted average" value={fmtNum(wavg)} sub={`${pairs.length} pairs, total weight ${fmtNum(pairs.reduce((a, p) => a + p.weight, 0))}`} />}
          {pairs.length > 0 && wavg === null && <Alert tone="warn">The weights must add up to more than zero.</Alert>}
        </div>
      </Panel>
    </div>
  )
}

export function RatioAverageCalculator() {
  const [section, setSection] = useState<Section>('simplify')
  return (
    <div className="space-y-5">
      <Segmented
        label="Calculator"
        value={section}
        onChange={setSection}
        options={[
          { value: 'simplify', label: 'Simplify ratio' },
          { value: 'solve', label: 'Solve a : b = c : x' },
          { value: 'average', label: 'Averages' },
        ]}
      />
      {section === 'simplify' && <Simplify />}
      {section === 'solve' && <Solve />}
      {section === 'average' && <Average />}
    </div>
  )
}
