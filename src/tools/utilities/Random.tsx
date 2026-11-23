import { useState } from 'react'
import { Dices, RotateCcw } from 'lucide-react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import { DICE_SIDES, flipCoin, formatDice, generateNumbers, parseDice, rollDice, RNG_LIMIT, RNG_MAX_COUNT, type DiceRoll } from '@/lib/utilities/random'

type Tab = 'numbers' | 'dice' | 'coin'

function NumbersTab() {
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('100')
  const [count, setCount] = useState('1')
  const [decimals, setDecimals] = useState('int')
  const [unique, setUnique] = useState(false)
  const [sorted, setSorted] = useState(false)
  const [result, setResult] = useState<{ values: number[] } | { error: string } | null>(null)

  const generate = () => {
    const r = generateNumbers({
      min: min.trim() === '' ? NaN : Number(min),
      max: max.trim() === '' ? NaN : Number(max),
      count: count.trim() === '' ? NaN : Number(count),
      unique,
      sorted,
      decimals: decimals === 'int' ? null : Number(decimals),
    })
    setResult(r.ok ? { values: r.values } : { error: r.error })
  }
  const values = result && 'values' in result ? result.values : null
  const text = values ? values.map((v) => (decimals === 'int' ? String(v) : v.toFixed(Number(decimals)))).join(', ') : ''

  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Minimum">{(id) => <Input id={id} type="number" value={min} min={-RNG_LIMIT} max={RNG_LIMIT} onChange={(e) => setMin(e.target.value)} />}</Field>
          <Field label="Maximum">{(id) => <Input id={id} type="number" value={max} min={-RNG_LIMIT} max={RNG_LIMIT} onChange={(e) => setMax(e.target.value)} />}</Field>
          <Field label="How many">{(id) => <Input id={id} type="number" value={count} min={1} max={RNG_MAX_COUNT} onChange={(e) => setCount(e.target.value)} />}</Field>
          <Field label="Number type">
            {(id) => (
              <Select id={id} value={decimals} onChange={(e) => setDecimals(e.target.value)}>
                <option value="int">Whole numbers</option>
                <option value="1">1 decimal place</option>
                <option value="2">2 decimal places</option>
                <option value="3">3 decimal places</option>
                <option value="4">4 decimal places</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={unique} onChange={setUnique} label="No repeats" />
          <Switch checked={sorted} onChange={setSorted} label="Sort low to high" />
        </div>
        <div className="mt-5">
          <Button variant="primary" size="lg" onClick={generate}><Dices className="size-4" aria-hidden />Generate</Button>
        </div>
      </Panel>
      <Panel title="Result" actions={<CopyButton text={text} disabled={!values} />}>
        <div aria-live="polite">
          {result && 'error' in result ? (
            <Alert tone="danger">{result.error}</Alert>
          ) : values ? (
            values.length === 1 ? (
              <p className="tabular text-center text-5xl font-semibold">{text}</p>
            ) : (
              <p className="tabular max-h-72 overflow-auto break-words font-mono text-sm leading-relaxed">{text}</p>
            )
          ) : (
            <p className="text-sm text-muted">Press Generate to get your numbers.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}

function DiceTab() {
  const [sides, setSides] = useState('6')
  const [count, setCount] = useState('2')
  const [mod, setMod] = useState('0')
  const [notation, setNotation] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ label: string; roll: DiceRoll }[]>([])
  const last = history[0]

  const roll = (c: number, s: number, m: number) => {
    const r = rollDice(c, s, m)
    setHistory((h) => [{ label: formatDice(Math.min(100, Math.max(1, Math.floor(c) || 1)), s, r.modifier), roll: r }, ...h].slice(0, 12))
  }
  const rollForm = () => {
    setError('')
    roll(Number(count), Number(sides), Number(mod))
  }
  const rollNotation = () => {
    const p = parseDice(notation)
    if (!p) return setError('Use notation like 2d6+3, d20 or 4d8-1 (up to 100 dice, 2 to 1000 sides).')
    setError('')
    roll(p.count, p.sides, p.modifier)
  }

  return (
    <div className="space-y-5">
      <Panel title="Roll dice">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Number of dice">{(id) => <Input id={id} type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} />}</Field>
          <Field label="Die type">
            {(id) => (
              <Select id={id} value={sides} onChange={(e) => setSides(e.target.value)}>
                {DICE_SIDES.map((d) => <option key={d} value={d}>d{d}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Modifier (+ or -)">{(id) => <Input id={id} type="number" value={mod} onChange={(e) => setMod(e.target.value)} />}</Field>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button variant="primary" size="lg" onClick={rollForm}><Dices className="size-4" aria-hidden />Roll</Button>
          <Field label="Or type notation" className="w-48">
            {(id) => <Input id={id} placeholder="2d6+3" value={notation} onChange={(e) => setNotation(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rollNotation()} />}
          </Field>
          <Button onClick={rollNotation} disabled={!notation.trim()}>Roll notation</Button>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </Panel>
      <Panel title="Result" actions={<Button size="sm" variant="ghost" onClick={() => setHistory([])} disabled={!history.length}>Clear</Button>}>
        <div aria-live="polite">
          {last ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <Stat label={`Total (${last.label})`} value={last.roll.total} />
                <p className="tabular font-mono text-sm text-ink-2">
                  {last.roll.rolls.join(' + ')}
                  {last.roll.modifier ? ` ${last.roll.modifier > 0 ? '+' : '-'} ${Math.abs(last.roll.modifier)}` : ''}
                </p>
              </div>
              {history.length > 1 && (
                <ul className="space-y-1 text-sm text-muted">
                  {history.slice(1).map((h, i) => (
                    <li key={i} className="tabular">{h.label}: <span className="text-ink-2">{h.roll.total}</span> ({h.roll.rolls.join(', ')})</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Roll to see the result.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}

function CoinTab() {
  const [last, setLast] = useState<'heads' | 'tails' | null>(null)
  const [tally, setTally] = useState({ heads: 0, tails: 0 })
  const flip = () => {
    const r = flipCoin()
    setLast(r)
    setTally((t) => ({ ...t, [r]: t[r] + 1 }))
  }
  const total = tally.heads + tally.tails
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '-')
  return (
    <Panel title="Flip a coin">
      <div className="space-y-5">
        <p aria-live="polite" className="text-center text-5xl font-semibold capitalize">{last ?? 'Ready'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="lg" onClick={flip}>Flip</Button>
          <Button size="lg" onClick={() => { setLast(null); setTally({ heads: 0, tails: 0 }) }} disabled={total === 0}><RotateCcw className="size-4" aria-hidden />Reset tally</Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Heads" value={tally.heads} sub={pct(tally.heads)} />
          <Stat label="Tails" value={tally.tails} sub={pct(tally.tails)} />
          <Stat label="Flips" value={total} />
        </div>
      </div>
    </Panel>
  )
}

export function RandomNumberGenerator() {
  const [tab, setTab] = useState<Tab>('numbers')
  return (
    <div className="space-y-5">
      <Segmented label="Mode" value={tab} onChange={setTab} options={[{ value: 'numbers', label: 'Random numbers' }, { value: 'dice', label: 'Dice roller' }, { value: 'coin', label: 'Coin flip' }]} />
      {tab === 'numbers' ? <NumbersTab /> : tab === 'dice' ? <DiceTab /> : <CoinTab />}
    </div>
  )
}
