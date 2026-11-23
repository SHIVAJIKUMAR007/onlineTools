import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select } from '@/components/ui/fields'
import { evaluate, formatNumber, type AngleMode } from '@/lib/calc/expression'
import {
  PPF_MAX_PER_YEAR,
  calcBreakEven,
  calcFd,
  calcPpf,
  calcRd,
  decimalToFraction,
  fmtFrac,
  fractionOp,
  mixedForm,
  parseFraction,
  simplifyFraction,
  toDecimal,
  type FdFreq,
  type FracOp,
} from '@/lib/calc/batchF'

// ───────────── shared bits ─────────────
const n = (s: string) => (s.trim() === '' ? NaN : Number(s))

/** Number field that keeps its text while typing; empty or invalid text gives NaN. */
function Num({ label, value, onChange, min = 0, step = 'any', hint, className, suffix }: { label: string; value: string; onChange: (v: string) => void; min?: number; step?: string; hint?: ReactNode; className?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint} className={className}>
      {(id) => <Input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">{children}</p>
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-line">
      <table className="tabular w-full text-right text-sm">
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr>{head.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-left' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SplitBar({ aLabel, a, bLabel, b }: { aLabel: string; a: number; bLabel: string; b: number }) {
  const total = a + b
  const pa = total > 0 ? (a / total) * 100 : 0
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${aLabel} ${pa.toFixed(1)} percent, ${bLabel} ${(100 - pa).toFixed(1)} percent`}>
        <div className="bg-accent" style={{ width: `${pa}%` }} />
        <div className="bg-warn" style={{ width: `${100 - pa}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" />{aLabel} {pa.toFixed(1)}%</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warn" />{bLabel} {(100 - pa).toFixed(1)}%</span>
      </div>
    </div>
  )
}

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

const CURRENCIES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' } as const
type Cur = keyof typeof CURRENCIES

function useMoney() {
  const [cur, setCur] = useState<Cur>('INR')
  const fmt = useMemo(() => new Intl.NumberFormat(CURRENCIES[cur], { style: 'currency', currency: cur, maximumFractionDigits: 2 }), [cur])
  const fmt0 = useMemo(() => new Intl.NumberFormat(CURRENCIES[cur], { style: 'currency', currency: cur, maximumFractionDigits: 0 }), [cur])
  const picker = (
    <Field label="Currency" className="w-28">
      {(id) => (
        <Select id={id} value={cur} onChange={(e) => setCur(e.target.value as Cur)}>
          {Object.keys(CURRENCIES).map((c) => <option key={c}>{c}</option>)}
        </Select>
      )}
    </Field>
  )
  return { money: (x: number) => fmt.format(x), money0: (x: number) => fmt0.format(x), picker }
}

const keyCls = 'h-10 cursor-pointer rounded-lg px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent'

// ───────────── scientific calculator ─────────────
interface HistoryItem {
  expr: string
  result: string
  value: number
}

const FN_KEYS: { label: string; text: string }[] = [
  { label: 'sin', text: 'sin(' }, { label: 'cos', text: 'cos(' }, { label: 'tan', text: 'tan(' },
  { label: 'sin⁻¹', text: 'asin(' }, { label: 'cos⁻¹', text: 'acos(' }, { label: 'tan⁻¹', text: 'atan(' },
  { label: 'ln', text: 'ln(' }, { label: 'log', text: 'log10(' }, { label: 'eˣ', text: 'exp(' },
  { label: '√', text: 'sqrt(' }, { label: '∛', text: 'cbrt(' }, { label: '|x|', text: 'abs(' },
  { label: 'xʸ', text: '^' }, { label: 'x!', text: '!' }, { label: '%', text: '%' },
  { label: 'π', text: 'pi' }, { label: 'e', text: 'e' }, { label: 'ANS', text: 'ans' },
]

export function ScientificCalculator() {
  const [expr, setExpr] = useState('')
  const [angle, setAngle] = useState<AngleMode>('deg')
  const [ans, setAns] = useState(0)
  const [mem, setMem] = useState(0)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [submitErr, setSubmitErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const live = useMemo(() => (expr.trim() === '' ? null : evaluate(expr, { angle, ans })), [expr, angle, ans])

  const change = (v: string) => {
    setExpr(v)
    setSubmitErr('')
  }
  const insert = (text: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? expr.length
    const end = el?.selectionEnd ?? expr.length
    change(expr.slice(0, start) + text + expr.slice(end))
    const pos = start + text.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }
  const backspace = () => {
    const el = ref.current
    const start = el?.selectionStart ?? expr.length
    const end = el?.selectionEnd ?? expr.length
    const from = start === end ? Math.max(0, start - 1) : start
    change(expr.slice(0, from) + expr.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(from, from)
    })
  }
  const commit = () => {
    if (expr.trim() === '') return
    if (live && live.ok) {
      const item = { expr: expr.trim(), result: formatNumber(live.value), value: live.value }
      setHistory((h) => (h[0] && h[0].expr === item.expr && h[0].result === item.result ? h : [item, ...h].slice(0, 30)))
      setAns(live.value)
      setSubmitErr('')
    } else if (live && !live.ok) setSubmitErr(live.error)
  }
  const current = live && live.ok ? live.value : ans
  const memAdd = (sign: 1 | -1) => setMem((m) => m + sign * current)

  return (
    <div className="space-y-5">
      <Panel
        title="Calculator"
        actions={<Segmented label="Angle unit" value={angle} onChange={setAngle} options={[{ value: 'deg', label: 'Degrees' }, { value: 'rad', label: 'Radians' }]} />}
      >
        <div className="space-y-3">
          <Field label="Expression" hint="Type with your keyboard or use the buttons. Press Enter for =, Escape to clear. Examples: 2(3+4)^2, sin(30), 5!, 2pi, 50% of 80 is 80*50%.">
            {(id) => (
              <Input
                id={id}
                ref={ref}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="h-12 font-mono text-lg"
                placeholder="0"
                value={expr}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commit()
                  } else if (e.key === 'Escape') change('')
                }}
              />
            )}
          </Field>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-2" aria-live="polite">
            {live === null ? (
              <span className="text-sm text-muted">Result appears here</span>
            ) : live.ok ? (
              <span className="tabular break-all text-2xl font-semibold tracking-tight">= {formatNumber(live.value)}</span>
            ) : (
              <span className="text-sm text-muted">{live.error}</span>
            )}
            <span className="flex items-center gap-2">
              {mem !== 0 ? <Badge tone="accent">M = {formatNumber(mem)}</Badge> : null}
              <CopyButton text={() => (live && live.ok ? formatNumber(live.value) : '')} label="Copy result" disabled={!(live && live.ok)} />
            </span>
          </div>
          {submitErr ? <Alert tone="danger" title="Cannot calculate">{submitErr}</Alert> : null}

          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {FN_KEYS.map((k) => (
              <button key={k.label} type="button" onClick={() => insert(k.text)} className={`${keyCls} bg-surface-2 text-ink-2 hover:bg-line`} aria-label={k.text.replace(/\($/, '')}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {['MC', 'MR', 'M+', 'M-'].map((m) => (
              <button
                key={m}
                type="button"
                className={`${keyCls} bg-surface text-muted hover:bg-line`}
                onClick={() => {
                  if (m === 'MC') setMem(0)
                  else if (m === 'MR') insert(mem < 0 ? `(${formatNumber(mem)})` : formatNumber(mem))
                  else memAdd(m === 'M+' ? 1 : -1)
                }}
                aria-label={{ MC: 'Memory clear', MR: 'Memory recall', 'M+': 'Add to memory', 'M-': 'Subtract from memory' }[m]}
              >
                {m}
              </button>
            ))}
            <button type="button" onClick={backspace} className={`${keyCls} bg-surface-2 hover:bg-line`} aria-label="Backspace">⌫</button>
            {[
              ['7', '8', '9', '÷', '('],
              ['4', '5', '6', '×', ')'],
              ['1', '2', '3', '-', 'AC'],
              ['0', '.', '=', '+', ''],
            ].flat().map((k, i) =>
              k === '' ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => (k === 'AC' ? change('') : k === '=' ? commit() : insert(k === '×' ? '*' : k === '÷' ? '/' : k))}
                  className={`${keyCls} ${k === '=' ? 'bg-accent text-white hover:opacity-90' : /\d|\./.test(k) ? 'bg-paper border border-line hover:bg-surface' : 'bg-surface-2 hover:bg-line'}`}
                  aria-label={k === '=' ? 'Equals' : k === 'AC' ? 'Clear all' : k}
                >
                  {k}
                </button>
              ),
            )}
          </div>
        </div>
      </Panel>

      <Panel title="History" actions={history.length ? <button type="button" className="cursor-pointer text-sm text-muted hover:text-ink" onClick={() => setHistory([])}>Clear history</button> : undefined}>
        {history.length === 0 ? (
          <Empty>Press Enter or = to save a calculation here. Click an entry to reuse it.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {history.map((h, i) => (
              <li key={`${h.expr}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <button type="button" onClick={() => change(h.expr)} className="min-w-0 flex-1 cursor-pointer truncate text-left font-mono text-sm hover:text-accent" title="Use this expression again">
                  {h.expr}
                </button>
                <button type="button" onClick={() => insert(h.result)} className="tabular shrink-0 cursor-pointer rounded-md bg-surface px-2 py-1 text-sm font-semibold hover:bg-surface-2" title="Insert this result">
                  = {h.result}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ───────────── fraction calculator ─────────────
type FracMode = 'calc' | 'toDecimal' | 'fromDecimal' | 'simplify'
const OPS: { value: FracOp; label: string }[] = [
  { value: 'add', label: '+' },
  { value: 'sub', label: '−' },
  { value: 'mul', label: '×' },
  { value: 'div', label: '÷' },
]

function ErrText({ msg }: { msg: string }) {
  return <span className="text-danger">{msg}</span>
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
      {steps.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  )
}

function FracResult({ r, label = 'Result' }: { r: { n: bigint; d: bigint }; label?: string }) {
  const dec = toDecimal(r)
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label={`${label} (simplified)`} value={fmtFrac(r)} />
      <Stat label="Mixed number" value={mixedForm(r)} />
      <Stat label="Decimal" value={`${dec.rounded ? '≈ ' : ''}${dec.text}`} sub={dec.repeating ? `Repeating: ${dec.repeating}` : undefined} />
    </div>
  )
}

export function FractionCalculator() {
  const [mode, setMode] = useState<FracMode>('calc')
  const [a, setA] = useState('1 1/2')
  const [b, setB] = useState('2/3')
  const [op, setOp] = useState<FracOp>('add')
  const [dec, setDec] = useState('0.333...')
  const [maxDen, setMaxDen] = useState('1000')

  const pa = useMemo(() => parseFraction(a), [a])
  const pb = useMemo(() => parseFraction(b), [b])
  const calc = useMemo(() => (pa.ok && pb.ok ? fractionOp(pa.value, pb.value, op) : null), [pa, pb, op])
  const simp = useMemo(() => (pa.ok ? simplifyFraction(pa.value) : null), [pa])
  const fromDec = useMemo(() => {
    const m = Number(maxDen)
    const md = Number.isInteger(m) && m >= 1 && m <= 1_000_000_000 ? BigInt(m) : null
    return md === null ? null : decimalToFraction(dec, md)
  }, [dec, maxDen])

  const fracInput = (label: string, v: string, set: (s: string) => void, p: typeof pa) => (
    <Field label={label} hint={v.trim() === '' || p.ok ? 'Like 3/4, 1 1/2, -2/5, 7 or 2.5' : <ErrText msg={p.ok ? '' : p.error} />}>
      {(id) => <Input id={id} type="text" inputMode="text" autoComplete="off" spellCheck={false} value={v} onChange={(e) => set(e.target.value)} aria-invalid={!p.ok} />}
    </Field>
  )

  return (
    <div className="space-y-5">
      <Panel
        title="Fraction tools"
        actions={
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'calc', label: 'Calculate' },
              { value: 'simplify', label: 'Simplify' },
              { value: 'toDecimal', label: 'To decimal' },
              { value: 'fromDecimal', label: 'From decimal' },
            ]}
          />
        }
      >
        {mode === 'calc' && (
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
            {fracInput('First fraction', a, setA, pa)}
            <Segmented label="Operation" value={op} onChange={setOp} options={OPS} className="sm:mt-7" />
            {fracInput('Second fraction', b, setB, pb)}
          </div>
        )}
        {(mode === 'simplify' || mode === 'toDecimal') && <div className="max-w-sm">{fracInput('Fraction', a, setA, pa)}</div>}
        {mode === 'fromDecimal' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Decimal" hint="Use 0.(3) or 0.333... for repeating decimals, or a long decimal like 3.14159.">
              {(id) => <Input id={id} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={dec} onChange={(e) => setDec(e.target.value)} />}
            </Field>
            <Num label="Largest denominator allowed" value={maxDen} onChange={setMaxDen} min={1} step="1" hint="Long decimals are matched to the closest fraction within this limit." />
          </div>
        )}
      </Panel>

      {mode === 'calc' &&
        (calc === null ? (
          <Empty>Enter two valid fractions to see the result and the working.</Empty>
        ) : !calc.ok ? (
          <Alert tone="danger" title="Cannot calculate">{calc.error}</Alert>
        ) : (
          <>
            <FracResult r={calc.value.result} />
            <Panel title="Working"><Steps steps={calc.value.steps} /></Panel>
          </>
        ))}

      {mode === 'simplify' &&
        (simp === null ? (
          <Empty>Enter a valid fraction to simplify it.</Empty>
        ) : (
          <>
            <FracResult r={simp.result} label="Simplified" />
            <Panel title="Working"><Steps steps={simp.steps} /></Panel>
          </>
        ))}

      {mode === 'toDecimal' &&
        (pa.ok ? (
          <>
            <FracResult r={pa.value} label="Fraction" />
            <Panel title="Working">
              <Steps steps={[`Divide the numerator by the denominator: ${pa.value.n} ÷ ${pa.value.d}`, toDecimal(pa.value).repeating ? `The digits repeat, so it is written ${toDecimal(pa.value).repeating}` : 'The division ends, so the decimal terminates']} />
            </Panel>
          </>
        ) : (
          <Empty>Enter a valid fraction to convert it.</Empty>
        ))}

      {mode === 'fromDecimal' &&
        (fromDec === null ? (
          <Empty>The largest denominator must be a whole number from 1 to 1,000,000,000.</Empty>
        ) : !fromDec.ok ? (
          <Empty>{fromDec.error}</Empty>
        ) : (
          <>
            <FracResult r={fromDec.value.fraction} label="Fraction" />
            <Alert tone={fromDec.value.exact ? 'success' : 'info'} title={fromDec.value.exact ? 'Exact match' : 'Closest fraction within the limit'}>
              {fromDec.value.exact ? 'This fraction equals the decimal you entered.' : `${fromDec.value.note}. Raise the largest denominator for a closer match.`}
            </Alert>
          </>
        ))}
    </div>
  )
}

// ───────────── break-even ─────────────
function BreakEvenChart({ fixed, variable, price, units, expected, money0 }: { fixed: number; variable: number; price: number; units: number; expected: number; money0: (x: number) => string }) {
  const W = 560
  const H = 300
  const L = 64
  const R = 16
  const T = 14
  const B = 36
  const xmax = Math.max(units * 2, Number.isFinite(expected) ? expected * 1.2 : 0, 10)
  const ymax = Math.max(price * xmax, fixed + variable * xmax) || 1
  const sx = (x: number) => L + (x / xmax) * (W - L - R)
  const sy = (y: number) => H - B - (y / ymax) * (H - T - B)
  const rev = (x: number) => price * x
  const cost = (x: number) => fixed + variable * x
  const yv = units * price
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Revenue and total cost lines cross at ${Math.ceil(units)} units`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(ymax * t)} y2={sy(ymax * t)} className="stroke-line" strokeWidth={1} />
            <text x={L - 6} y={sy(ymax * t) + 4} textAnchor="end" className="fill-muted" fontSize={10}>{money0(ymax * t)}</text>
            <text x={sx(xmax * t)} y={H - B + 16} textAnchor="middle" className="fill-muted" fontSize={10}>{Math.round(xmax * t)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="fill-muted" fontSize={11}>Units sold</text>
        <line x1={sx(0)} y1={sy(fixed)} x2={sx(xmax)} y2={sy(fixed)} className="stroke-muted" strokeWidth={1} strokeDasharray="4 4" />
        <line x1={sx(0)} y1={sy(cost(0))} x2={sx(xmax)} y2={sy(cost(xmax))} className="stroke-warn" strokeWidth={2.5} />
        <line x1={sx(0)} y1={sy(0)} x2={sx(xmax)} y2={sy(rev(xmax))} className="stroke-accent" strokeWidth={2.5} />
        {Number.isFinite(expected) && expected > 0 && (
          <line x1={sx(expected)} x2={sx(expected)} y1={T} y2={H - B} className="stroke-ink-2" strokeWidth={1} strokeDasharray="2 3" />
        )}
        <line x1={sx(units)} x2={sx(units)} y1={sy(yv)} y2={H - B} className="stroke-ink-2" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={sx(units)} cy={sy(yv)} r={6} className="fill-paper stroke-ink" strokeWidth={2} />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" />Revenue</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-warn" />Total cost</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-ink" />Break-even point</span>
        {Number.isFinite(expected) && expected > 0 && <span>Dotted vertical line: expected sales</span>}
      </figcaption>
    </figure>
  )
}

export function BreakEvenCalculator() {
  const { money, money0, picker } = useMoney()
  const [fixed, setFixed] = useState('50000')
  const [variable, setVariable] = useState('30')
  const [price, setPrice] = useState('80')
  const [target, setTarget] = useState('')
  const [expected, setExpected] = useState('')
  const r = useMemo(() => calcBreakEven({ fixed: n(fixed), variable: n(variable), price: n(price), target: n(target), expected: n(expected) }), [fixed, variable, price, target, expected])
  const num = (x: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(x)
  return (
    <div className="space-y-5">
      <Panel title="Costs and price">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Total fixed costs" value={fixed} onChange={setFixed} hint="Rent, salaries and other costs that do not change with sales" />
          <Num label="Variable cost per unit" value={variable} onChange={setVariable} hint="Materials, packaging and anything you pay per item sold" />
          <Num label="Selling price per unit" value={price} onChange={setPrice} />
          <Num label="Target profit (optional)" value={target} onChange={setTarget} hint="Leave empty to skip" />
          <Num label="Expected sales in units (optional)" value={expected} onChange={setExpected} step="1" hint="Used for the margin of safety" />
          <div className="flex items-end">{picker}</div>
        </div>
      </Panel>
      {r === null ? (
        <Empty>Enter fixed costs, variable cost and a selling price above zero to see the break-even point.</Empty>
      ) : !r.viable ? (
        <Alert tone="warn" title="This price cannot break even">
          Each unit sells for {money(n(price))} and costs {money(n(variable))} to make, so every sale adds {money(r.contribution)} toward fixed costs. With nothing left over after variable costs, more sales never cover the {money(n(fixed))} of fixed costs. Raise the price or lower the variable cost per unit.
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Break-even units" value={r.unitsCeil.toLocaleString()} sub={r.units === r.unitsCeil ? undefined : `Exactly ${num(r.units)}, rounded up`} />
            <Stat label="Break-even revenue" value={money0(r.revenue)} />
            <Stat label="Contribution per unit" value={money(r.contribution)} />
            <Stat label="Contribution margin ratio" value={`${(r.ratio * 100).toFixed(1)}%`} />
          </div>
          {(r.targetUnits !== null || r.safetyUnits !== null) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {r.targetUnits !== null && <Stat label={`Units for ${money0(n(target))} profit`} value={r.targetUnits.toLocaleString()} sub={`Revenue ${money0(r.targetRevenue!)}`} />}
              {r.safetyUnits !== null && (
                <>
                  <Stat label="Margin of safety (units)" value={num(r.safetyUnits)} sub={r.safetyUnits < 0 ? 'Below break-even' : 'Above break-even'} />
                  <Stat label="Margin of safety (%)" value={`${r.safetyPct!.toFixed(1)}%`} sub={`Revenue ${money0(r.safetyRevenue!)}`} />
                  <Stat label="Profit at expected sales" value={money0(n(expected) * r.contribution - n(fixed))} />
                </>
              )}
            </div>
          )}
          <Panel title="Revenue against total cost">
            <BreakEvenChart fixed={n(fixed)} variable={n(variable)} price={n(price)} units={r.units} expected={n(expected)} money0={money0} />
          </Panel>
        </>
      )}
    </div>
  )
}

// ───────────── FD / RD ─────────────
const FREQ_OPTIONS: { value: FdFreq; label: string }[] = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'halfyearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'simple', label: 'At maturity (simple interest)' },
]

export function FdRdCalculator() {
  const [mode, setMode] = useState<'fd' | 'rd'>('fd')
  const [amount, setAmount] = useState('100000')
  const [rate, setRate] = useState('7')
  const [tenure, setTenure] = useState('5')
  const [unit, setUnit] = useState<'years' | 'months'>('years')
  const [freq, setFreq] = useState<FdFreq>('quarterly')
  const months = unit === 'years' ? n(tenure) * 12 : n(tenure)
  const fd = useMemo(() => (mode === 'fd' ? calcFd(n(amount), n(rate), months, freq) : null), [mode, amount, rate, months, freq])
  const rd = useMemo(() => (mode === 'rd' ? calcRd(n(amount), n(rate), months) : null), [mode, amount, rate, months])
  const r = mode === 'fd' ? fd : rd
  const invested = mode === 'fd' ? n(amount) : rd ? rd.deposited : 0
  return (
    <div className="space-y-5">
      <Panel title="Deposit details" actions={<Segmented label="Deposit type" value={mode} onChange={setMode} options={[{ value: 'fd', label: 'Fixed deposit' }, { value: 'rd', label: 'Recurring deposit' }]} />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Num label={mode === 'fd' ? 'Deposit amount' : 'Monthly deposit'} value={amount} onChange={setAmount} />
          <Num label="Interest rate per year" suffix="%" value={rate} onChange={setRate} />
          <Num label="Tenure" value={tenure} onChange={setTenure} step="1" />
          <div className="flex items-end">
            <Segmented label="Tenure unit" value={unit} onChange={setUnit} options={[{ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' }]} />
          </div>
          {mode === 'fd' ? (
            <Field label="Interest compounding" className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={freq} onChange={(e) => setFreq(e.target.value as FdFreq)}>
                  {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
            </Field>
          ) : (
            <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Recurring deposits use quarterly compounding, as most Indian banks do. Each monthly instalment is assumed to be paid at the start of the month and earns interest from its own deposit date.</p>
          )}
        </div>
      </Panel>
      {r === null ? (
        <Empty>Enter an amount above zero, a rate from 0 to 100 and a tenure in whole months (up to {mode === 'fd' ? '1200' : '600'}) to see the maturity amount.</Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Maturity amount" value={inr0.format(r.maturity)} />
            <Stat label={mode === 'fd' ? 'Amount invested' : 'Total deposited'} value={inr0.format(invested)} />
            <Stat label="Interest earned" value={inr0.format(r.interest)} />
            {fd && <Stat label="Effective annual yield" value={`${fd.effectiveYield.toFixed(2)}%`} sub={freq === 'simple' ? 'Annualised from simple interest' : 'After compounding'} />}
          </div>
          <Panel title="Invested and interest"><SplitBar aLabel={mode === 'fd' ? 'Invested' : 'Deposited'} a={invested} bLabel="Interest" b={Math.max(0, r.interest)} /></Panel>
          <Panel title="Year-wise growth">
            {fd ? (
              <Table head={['Year', 'Interest in year', 'Balance']} rows={fd.rows.map((y) => [y.months < 12 ? `${y.year} (${y.months} mo)` : y.year, inr0.format(y.interest), inr0.format(y.balance)])} />
            ) : rd ? (
              <Table head={['Year', 'Deposited so far', 'Balance']} rows={rd.rows.map((y) => [y.months < 12 ? `${y.year} (${y.months} mo)` : y.year, inr0.format(y.deposited), inr0.format(y.balance)])} />
            ) : null}
          </Panel>
          <Alert title="About tax">Banks may deduct TDS on interest above a yearly limit, and the limit and rates change. Interest is also added to your taxable income. Check current rules with your bank or a tax adviser. The figures here are before any tax.</Alert>
        </>
      )}
    </div>
  )
}

// ───────────── PPF ─────────────
export function PpfCalculator() {
  const [mode, setMode] = useState<'yearly' | 'monthly'>('yearly')
  const [deposit, setDeposit] = useState('150000')
  const [rate, setRate] = useState('7.1')
  const [years, setYears] = useState('15')
  const res = useMemo(() => calcPpf(n(deposit), mode, n(rate), Number(years)), [deposit, mode, rate, years])
  const r = res.ok ? res.value : null
  return (
    <div className="space-y-5">
      <Alert tone="warn" title="Check the current rate">
        The government revises the PPF rate every quarter, so 7.1% may not be the rate today. Look up the current rate and type it into the rate field.
      </Alert>
      <Panel title="PPF details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-end">
            <Segmented label="Deposit frequency" value={mode} onChange={setMode} options={[{ value: 'yearly', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }]} />
          </div>
          <Num label={mode === 'yearly' ? 'Yearly deposit' : 'Monthly deposit'} value={deposit} onChange={setDeposit} hint={`Minimum 500 a year, maximum ${PPF_MAX_PER_YEAR.toLocaleString('en-IN')} a year`} />
          <Num label="Interest rate per year" suffix="%" value={rate} onChange={setRate} hint="Editable. Revised quarterly by the government." />
          <Field label="Tenure" hint="15 years to start, then extensions in blocks of 5 years">
            {(id) => (
              <Select id={id} value={years} onChange={(e) => setYears(e.target.value)}>
                {[15, 20, 25, 30, 35, 40, 45, 50].map((y) => <option key={y} value={y}>{y} years{y === 15 ? ' (initial term)' : ` (${(y - 15) / 5} extension${y === 20 ? '' : 's'})`}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Panel>
      {!res.ok ? (
        <Empty>{res.error}</Empty>
      ) : r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Maturity value" value={inr0.format(r.maturity)} />
            <Stat label="Total invested" value={inr0.format(r.invested)} sub={`${inr0.format(r.yearlyDeposit)} a year`} />
            <Stat label="Interest earned" value={inr0.format(r.interest)} />
            <Stat label="Interest share" value={`${((r.interest / r.maturity) * 100).toFixed(1)}%`} />
          </div>
          <Panel title="Invested and interest"><SplitBar aLabel="Invested" a={r.invested} bLabel="Interest" b={r.interest} /></Panel>
          <Panel title="Year-by-year">
            <Table head={['Year', 'Deposited', 'Interest credited', 'Closing balance']} rows={r.rows.map((y) => [y.year, inr0.format(y.deposit), inr0.format(y.interest), inr0.format(y.balance)])} />
          </Panel>
          <Alert title="How this is worked out">
            Deposits are assumed to be made before the 5th of each month. Each month earns one twelfth of the yearly rate on the lowest balance between the 5th and the month end, and the total is credited at the end of the financial year. Extensions assume you keep depositing the same amount.
          </Alert>
          <Alert title="Tax">PPF has historically been exempt at the deposit, interest and withdrawal stages (often called EEE), but tax rules change. Check current rules before relying on this.</Alert>
        </>
      ) : null}
    </div>
  )
}
