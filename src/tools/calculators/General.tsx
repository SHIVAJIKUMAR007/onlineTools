import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/tools/controls'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch, Textarea } from '@/components/ui/fields'
import {
  addMonths,
  addPercent,
  addWorkingDays,
  ageInfo,
  calcBmi,
  calcCgpa,
  calcGpa,
  CM_PER_INCH,
  compareDates,
  countWorkingDays,
  dayOfYear,
  diffDays,
  formatDate,
  formatNumber,
  GRADES,
  isLeapYear,
  isoWeek,
  isoWeekRange,
  isoWeeksInYear,
  LB_PER_KG,
  leapReason,
  leapYearsInRange,
  MONTHS,
  nextLeapYear,
  parseDate,
  parseHolidays,
  percentChange,
  percentOf,
  percentToGpa,
  previousLeapYear,
  quarter,
  shiftDate,
  subtractPercent,
  weekday,
  WEEKDAYS,
  whatPercent,
  ymdDiff,
} from '@/lib/calc/general'

// ───────────── helpers ─────────────
const num = (s: string): number => (s.trim() === '' ? NaN : Number(s))
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`
const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'

function todayIso(): string {
  const n = new Date()
  return `${String(n.getFullYear()).padStart(4, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** A date field that starts empty (so prerendered HTML matches) and fills with today's date after mount. */
function useTodayState(): [string, (v: string) => void] {
  const [v, setV] = useState('')
  useEffect(() => setV(todayIso()), [])
  return [v, setV]
}

function DateField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode }) {
  return <Field label={label} hint={hint}>{(id) => <Input id={id} type="date" value={value} min="0001-01-01" max="9999-12-31" onChange={(e) => onChange(e.target.value)} />}</Field>
}

function NumField({ label, value, onChange, placeholder, hint, className, step = 'any', min }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; className?: string; step?: string; min?: number }) {
  return <Field label={label} hint={hint} className={className}>{(id) => <Input id={id} type="number" inputMode="decimal" step={step} min={min} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}</Field>
}

const shortDate = (p: { y: number; m: number; d: number }) => `${formatDate(p).slice(0, 3)} ${p.d} ${MONTHS[p.m - 1].slice(0, 3)}`

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>

// ───────────── Age / date difference ─────────────
export function AgeCalculator() {
  const [mode, setMode] = useState<'age' | 'diff'>('age')
  const [birth, setBirth] = useState('')
  const [asOf, setAsOf] = useTodayState()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const age = useMemo(() => {
    const b = parseDate(birth)
    const a = parseDate(asOf)
    return b && a ? { info: ageInfo(b, a), b, a } : null
  }, [birth, asOf])

  const diff = useMemo(() => {
    const a = parseDate(from)
    const b = parseDate(to)
    if (!a || !b) return null
    const swapped = compareDates(a, b) > 0
    const [x, y] = swapped ? [b, a] : [a, b]
    return { ymd: ymdDiff(x, y), days: diffDays(x, y), swapped }
  }, [from, to])

  return (
    <div className="space-y-5">
      <Panel title="Calculate">
        <div className="space-y-4">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'age', label: 'Age' }, { value: 'diff', label: 'Date difference' }]} />
          {mode === 'age' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="Date of birth" value={birth} onChange={setBirth} />
              <DateField label="Age at the date of" value={asOf} onChange={setAsOf} hint="Defaults to today. Change it to see an age on any other day." />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="From date" value={from} onChange={setFrom} />
              <DateField label="To date" value={to} onChange={setTo} />
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Result">
        {mode === 'age' ? (
          !age ? <Empty>Enter a date of birth to see the exact age.</Empty>
          : !age.info ? <Alert tone="warn">The date of birth is after the chosen date, so there is no age to show yet.</Alert>
          : (
            <div className="space-y-4">
              <p className="text-2xl font-semibold tracking-tight">{plural(age.info.ymd.years, 'year')}, {plural(age.info.ymd.months, 'month')}, {plural(age.info.ymd.days, 'day')}</p>
              <div className={grid}>
                <Stat label="Next birthday" value={formatDate(age.info.nextBirthday)} sub={age.info.daysUntilBirthday === 0 ? 'Today. Happy birthday!' : `In ${plural(age.info.daysUntilBirthday, 'day')}, turning ${age.info.turning}`} />
                <Stat label="Total months" value={age.info.totalMonths.toLocaleString('en-US')} />
                <Stat label="Total weeks" value={age.info.totalWeeks.toLocaleString('en-US')} sub={`and ${age.info.totalDays % 7} days`} />
                <Stat label="Total days" value={age.info.totalDays.toLocaleString('en-US')} />
                <Stat label="Total hours" value={age.info.totalHours.toLocaleString('en-US')} />
                <Stat label="Born on a" value={WEEKDAYS[weekday(age.b)]} />
              </div>
            </div>
          )
        ) : !diff ? (
          <Empty>Pick two dates to count the days between them.</Empty>
        ) : (
          <div className="space-y-4">
            <p className="text-2xl font-semibold tracking-tight">{plural(diff.ymd.years, 'year')}, {plural(diff.ymd.months, 'month')}, {plural(diff.ymd.days, 'day')}</p>
            <div className={grid}>
              <Stat label="Total days" value={diff.days.toLocaleString('en-US')} sub="Start date counted, end date not" />
              <Stat label="Total weeks" value={Math.floor(diff.days / 7).toLocaleString('en-US')} sub={`and ${diff.days % 7} days`} />
              <Stat label="Total hours" value={(diff.days * 24).toLocaleString('en-US')} />
            </div>
            {diff.swapped ? <p className="text-xs text-muted">The From date was later than the To date, so the two were swapped.</p> : null}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Percentage ─────────────
type PctMode = 'of' | 'what' | 'change' | 'add' | 'sub'
const PCT_MODES: { value: PctMode; label: string; a: string; b: string; title: string }[] = [
  { value: 'of', label: 'X% of Y', a: 'Percent (X)', b: 'Number (Y)', title: 'What is X% of Y?' },
  { value: 'what', label: 'X is what % of Y', a: 'Part (X)', b: 'Whole (Y)', title: 'X is what percent of Y?' },
  { value: 'change', label: '% change', a: 'Old value', b: 'New value', title: 'Percentage change from old to new' },
  { value: 'add', label: 'Add %', a: 'Number', b: 'Percent to add', title: 'Increase a number by a percentage' },
  { value: 'sub', label: 'Subtract %', a: 'Number', b: 'Percent to subtract', title: 'Reduce a number by a percentage' },
]

export function PercentageCalculator() {
  const [mode, setMode] = useState<PctMode>('of')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const m = PCT_MODES.find((x) => x.value === mode)!
  const x = num(a)
  const y = num(b)
  const f = (n: number) => formatNumber(n, 6)

  const out = useMemo<{ result: string; working: string } | 'zero' | null>(() => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    switch (mode) {
      case 'of': return { result: f(percentOf(x, y)), working: `${f(x)} ÷ 100 × ${f(y)} = ${f(percentOf(x, y))}` }
      case 'what': { const r = whatPercent(x, y); return r === null ? 'zero' : { result: `${f(r)}%`, working: `${f(x)} ÷ ${f(y)} × 100 = ${f(r)}%` } }
      case 'change': {
        const r = percentChange(x, y)
        if (r === null) return 'zero'
        return { result: `${r >= 0 ? '+' : ''}${f(r)}%`, working: `(${f(y)} − ${f(x)}) ÷ ${f(Math.abs(x))} × 100 = ${f(r)}%  (${r >= 0 ? 'increase' : 'decrease'} of ${f(Math.abs(y - x))})` }
      }
      case 'add': return { result: f(addPercent(x, y)), working: `${f(x)} × (1 + ${f(y)} ÷ 100) = ${f(addPercent(x, y))}  (change of ${f(addPercent(x, y) - x)})` }
      case 'sub': return { result: f(subtractPercent(x, y)), working: `${f(x)} × (1 − ${f(y)} ÷ 100) = ${f(subtractPercent(x, y))}  (change of ${f(subtractPercent(x, y) - x)})` }
    }
  }, [mode, x, y])

  return (
    <div className="space-y-5">
      <Panel title={m.title}>
        <div className="space-y-4">
          <Segmented label="Calculation" value={mode} onChange={(v) => { setMode(v); setA(''); setB('') }} options={PCT_MODES.map((o) => ({ value: o.value, label: o.label }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField label={m.a} value={a} onChange={setA} placeholder="0" />
            <NumField label={m.b} value={b} onChange={setB} placeholder="0" />
          </div>
        </div>
      </Panel>
      <Panel title="Result">
        {out === null ? <Empty>Enter both numbers to see the answer and the working.</Empty>
        : out === 'zero' ? <Alert tone="warn">{mode === 'what' ? 'The whole (Y) cannot be zero.' : 'The old value cannot be zero, so a percentage change is undefined.'}</Alert>
        : (
          <div className="space-y-3">
            <p className="tabular text-3xl font-semibold tracking-tight">{out.result}</p>
            <p className="tabular rounded-lg bg-surface px-3 py-2 font-mono text-[13px] break-words">{out.working}</p>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── BMI ─────────────
export function BmiCalculator() {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')
  const [kg, setKg] = useState('')
  const [cm, setCm] = useState('')
  const [lb, setLb] = useState('')
  const [ft, setFt] = useState('')
  const [inch, setInch] = useState('')

  const res = useMemo(() => {
    const weightKg = unit === 'metric' ? num(kg) : num(lb) / LB_PER_KG
    const heightCm = unit === 'metric' ? num(cm) : (num(ft) * 12 + (inch.trim() === '' ? 0 : num(inch))) * CM_PER_INCH
    if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null
    return calcBmi(weightKg, heightCm) ?? 'invalid'
  }, [unit, kg, cm, lb, ft, inch])

  const weightText = (w: number) => (unit === 'metric' ? `${w.toFixed(1)} kg` : `${(w * LB_PER_KG).toFixed(1)} lb`)

  return (
    <div className="space-y-5">
      <Panel title="Your measurements">
        <div className="space-y-4">
          <Segmented label="Units" value={unit} onChange={setUnit} options={[{ value: 'metric', label: 'Metric (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, ft, in)' }]} />
          {unit === 'metric' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField label="Weight (kg)" value={kg} onChange={setKg} placeholder="70" />
              <NumField label="Height (cm)" value={cm} onChange={setCm} placeholder="175" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField label="Weight (lb)" value={lb} onChange={setLb} placeholder="154" />
              <NumField label="Height (ft)" value={ft} onChange={setFt} placeholder="5" step="1" min={0} />
              <NumField label="Height (in)" value={inch} onChange={setInch} placeholder="9" />
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Result">
        {res === null ? <Empty>Enter your weight and height to see your BMI.</Empty>
        : res === 'invalid' ? <Alert tone="warn">Those values are outside a realistic range. Check the weight and height.</Alert>
        : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="tabular text-3xl font-semibold tracking-tight">{res.bmi.toFixed(1)}</p>
              <Badge tone={res.tone}>{res.category}</Badge>
            </div>
            <div className={grid}>
              <Stat label="Healthy weight for this height" value={`${weightText(res.healthyMinKg)} to ${weightText(res.healthyMaxKg)}`} sub="BMI 18.5 to 24.9" />
            </div>
            <ul className="space-y-1 text-sm text-ink-2">
              <li>Under 18.5: underweight</li><li>18.5 to 24.9: normal weight</li><li>25 to 29.9: overweight</li><li>30 and above: obesity</li>
            </ul>
          </div>
        )}
      </Panel>
      <Alert tone="info" title="A screening number, not a diagnosis">
        BMI does not measure body fat, muscle, age, sex or where weight sits on the body. It is for adults only and is not valid for children and teenagers. Talk to a doctor about your health.
      </Alert>
    </div>
  )
}

// ───────────── GPA ─────────────
let rowId = 3

export function GpaCalculator() {
  const [rows, setRows] = useState<{ id: number; name: string; credits: string; grade: string }[]>([
    { id: 1, name: '', credits: '3', grade: 'A' },
    { id: 2, name: '', credits: '3', grade: 'B+' },
    { id: 3, name: '', credits: '', grade: 'A-' },
  ])
  const [prevCredits, setPrevCredits] = useState('')
  const [prevGpa, setPrevGpa] = useState('')
  const [pct, setPct] = useState('')

  const update = (id: number, patch: Partial<{ name: string; credits: string; grade: string }>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const sem = useMemo(() => calcGpa(rows.map((r) => ({ credits: num(r.credits), grade: r.grade }))), [rows])
  const cum = useMemo(() => {
    if (!sem || prevCredits.trim() === '' || prevGpa.trim() === '') return null
    return calcCgpa(num(prevCredits), num(prevGpa), sem.credits, sem.gpa)
  }, [sem, prevCredits, prevGpa])
  const hint = percentToGpa(num(pct))

  return (
    <div className="space-y-5">
      <Panel
        title="Courses"
        actions={<button type="button" onClick={() => setRows((rs) => [...rs, { id: ++rowId, name: '', credits: '', grade: 'A' }])} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-sm font-medium hover:text-accent"><Plus className="size-4" aria-hidden />Add course</button>}
      >
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[1fr_5rem_5.5rem_auto] items-end gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
              <Field label={`Course ${i + 1}`}>{(id) => <Input id={id} value={r.name} placeholder="Name (optional)" onChange={(e) => update(r.id, { name: e.target.value })} />}</Field>
              <NumField label="Credits" value={r.credits} onChange={(v) => update(r.id, { credits: v })} placeholder="3" min={0} />
              <Field label="Grade">{(id) => <Select id={id} value={r.grade} onChange={(e) => update(r.id, { grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</Select>}</Field>
              <button type="button" aria-label={`Remove course ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="grid size-10 cursor-pointer place-items-center rounded-lg text-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-4" aria-hidden /></button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Scale: A+ and A = 4.0, A- = 3.7, B+ = 3.3, B = 3.0, down to D- = 0.7 and F = 0. Rows without credits are ignored.</p>
      </Panel>
      <Panel title="Previous record (optional)">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Credits completed so far" value={prevCredits} onChange={setPrevCredits} placeholder="60" min={0} />
          <NumField label="Previous cumulative GPA" value={prevGpa} onChange={setPrevGpa} placeholder="3.2" min={0} />
        </div>
      </Panel>
      <Panel title="Result">
        {!sem ? <Empty>Add credits and a grade for at least one course.</Empty> : (
          <div className={grid}>
            <Stat label="Semester GPA" value={sem.gpa.toFixed(2)} sub={`${formatNumber(sem.credits)} credits, ${formatNumber(sem.points, 2)} grade points`} />
            {cum !== null ? <Stat label="Cumulative GPA (CGPA)" value={cum.toFixed(2)} sub={`${formatNumber(num(prevCredits) + sem.credits)} credits in total`} /> : null}
          </div>
        )}
        {sem && prevCredits.trim() !== '' && prevGpa.trim() !== '' && cum === null ? <p className="mt-3 text-sm text-danger">The previous GPA must be between 0 and 4.0 and credits cannot be negative.</p> : null}
      </Panel>
      <Panel title="Percentage to GPA hint (optional)">
        <div className="flex flex-wrap items-end gap-4">
          <NumField label="Percentage score" value={pct} onChange={setPct} placeholder="86" className="w-40" />
          {hint ? <p className="pb-2 text-sm">About <strong>{hint.letter}</strong> ({hint.gpa.toFixed(1)}) on a common US scale. Your school may use a different table.</p> : <p className="pb-2 text-sm text-muted">Enter 0 to 100.</p>}
        </div>
      </Panel>
    </div>
  )
}

// ───────────── Add / subtract from a date ─────────────
export function DateAddSubtractCalculator() {
  const [start, setStart] = useTodayState()
  const [op, setOp] = useState<'add' | 'sub'>('add')
  const [v, setV] = useState({ years: '', months: '', weeks: '', days: '' })
  const set = (k: keyof typeof v) => (s: string) => setV((o) => ({ ...o, [k]: s }))

  const res = useMemo(() => {
    const p = parseDate(start)
    if (!p) return null
    const o = { years: num(v.years) || 0, months: num(v.months) || 0, weeks: num(v.weeks) || 0, days: num(v.days) || 0 }
    if (Object.values(o).some((n) => !Number.isInteger(n) || n < 0)) return 'bad' as const
    const sign = op === 'add' ? 1 : -1
    const r = shiftDate(p, o, sign)
    if (!r) return 'range' as const
    const clamped = o.years * 12 + o.months !== 0 && addMonths(p, sign * (o.years * 12 + o.months)).d < p.d
    return { r, clamped, total: diffDays(p, r) }
  }, [start, op, v])

  return (
    <div className="space-y-5">
      <Panel title="Date and amount">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateField label="Start date" value={start} onChange={setStart} />
            <Segmented label="Operation" value={op} onChange={setOp} options={[{ value: 'add', label: 'Add' }, { value: 'sub', label: 'Subtract' }]} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumField label="Years" value={v.years} onChange={set('years')} placeholder="0" step="1" min={0} />
            <NumField label="Months" value={v.months} onChange={set('months')} placeholder="0" step="1" min={0} />
            <NumField label="Weeks" value={v.weeks} onChange={set('weeks')} placeholder="0" step="1" min={0} />
            <NumField label="Days" value={v.days} onChange={set('days')} placeholder="0" step="1" min={0} />
          </div>
        </div>
      </Panel>
      <Panel title="Result">
        {res === null ? <Empty>Pick a start date.</Empty>
        : res === 'bad' ? <Alert tone="warn">Use whole numbers of zero or more.</Alert>
        : res === 'range' ? <Alert tone="warn">The result falls outside the supported years (1 to 9999).</Alert>
        : (
          <div className="space-y-4">
            <p className="text-2xl font-semibold tracking-tight">{formatDate(res.r)}</p>
            <div className={grid}>
              <Stat label="Day of the year" value={dayOfYear(res.r)} />
              <Stat label="ISO week" value={`Week ${isoWeek(res.r).week}`} sub={`of ${isoWeek(res.r).year}`} />
              <Stat label="Days from start date" value={`${res.total >= 0 ? '+' : ''}${res.total.toLocaleString('en-US')}`} />
            </div>
            {res.clamped ? <p className="text-xs text-muted">The target month is shorter than the start day, so the date moved back to that month's last day.</p> : null}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Working days ─────────────
export function WorkingDaysCalculator() {
  const [mode, setMode] = useState<'between' | 'add'>('between')
  const [from, setFrom] = useTodayState()
  const [to, setTo] = useState('')
  const [inclusive, setInclusive] = useState(true)
  const [count, setCount] = useState('10')
  const [weekend, setWeekend] = useState<number[]>([0, 6])
  const [holidayText, setHolidayText] = useState('')

  const hol = useMemo(() => parseHolidays(holidayText), [holidayText])
  const opts = useMemo(() => ({ weekend, holidays: hol.dates }), [weekend, hol])

  const between = useMemo(() => {
    const a = parseDate(from)
    const b = parseDate(to)
    if (!a || !b) return null
    const days = Math.abs(diffDays(a, b)) + (inclusive ? 1 : 0)
    return { working: countWorkingDays(a, b, inclusive, opts), calendar: Math.max(0, days) }
  }, [from, to, inclusive, opts])

  const added = useMemo(() => {
    const a = parseDate(from)
    const n = num(count)
    if (!a || !Number.isInteger(n) || Math.abs(n) > 100000) return null
    const r = addWorkingDays(a, n, opts)
    return r ? { r, n } : 'none'
  }, [from, count, opts])

  const toggle = (d: number) => setWeekend((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div className="space-y-5">
      <Panel title="Dates">
        <div className="space-y-4">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'between', label: 'Working days between dates' }, { value: 'add', label: 'Add working days' }]} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label={mode === 'between' ? 'Start date' : 'Start from'} value={from} onChange={setFrom} />
            {mode === 'between' ? <DateField label="End date" value={to} onChange={setTo} /> : <NumField label="Working days to add" value={count} onChange={setCount} step="1" hint="Use a negative number to go back." />}
          </div>
          {mode === 'between' ? <Switch checked={inclusive} onChange={setInclusive} label="Count the end date too" /> : null}
        </div>
      </Panel>
      <Panel title="Weekend and holidays">
        <div className="space-y-4">
          <div role="group" aria-label="Weekend days" className="flex flex-wrap gap-2">
            {order.map((d) => (
              <button key={d} type="button" aria-pressed={weekend.includes(d)} onClick={() => toggle(d)} className={`h-9 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors ${weekend.includes(d) ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2 hover:text-ink'}`}>{WEEKDAYS[d].slice(0, 3)}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Highlighted days are treated as days off.</p>
          <Field label="Holidays to skip (optional)" hint="One date per line as YYYY-MM-DD. Public holidays differ by country, so only the dates you list are skipped.">
            {(id) => <Textarea id={id} rows={4} value={holidayText} placeholder={'2025-12-25\n2026-01-01'} onChange={(e) => setHolidayText(e.target.value)} />}
          </Field>
          {hol.invalid.length ? <p className="text-sm text-danger">Ignored (not a valid date): {hol.invalid.join(', ')}</p> : null}
        </div>
      </Panel>
      <Panel title="Result">
        {weekend.length >= 7 ? <Alert tone="warn">Every weekday is marked as a day off, so there are no working days.</Alert>
        : mode === 'between' ? (
          between ? (
            <div className={grid}>
              <Stat label="Working days" value={between.working.toLocaleString('en-US')} />
              <Stat label="Calendar days" value={between.calendar.toLocaleString('en-US')} sub={inclusive ? 'Both ends counted' : 'End date not counted'} />
              <Stat label="Holidays listed" value={hol.dates.size} />
            </div>
          ) : <Empty>Pick a start and end date.</Empty>
        ) : added === null ? <Empty>Pick a start date and enter a whole number of days.</Empty>
        : added === 'none' ? <Alert tone="warn">That result is outside the supported years.</Alert>
        : (
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight">{formatDate(added.r)}</p>
            <p className="text-sm text-muted">{plural(Math.abs(added.n), 'working day')} {added.n < 0 ? 'before' : 'after'} the start date, which is not counted itself.</p>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── ISO week number ─────────────
export function WeekNumberCalculator() {
  const [date, setDate] = useTodayState()
  const p = parseDate(date)
  const iw = p ? isoWeek(p) : null
  const range = p ? isoWeekRange(p) : null
  return (
    <div className="space-y-5">
      <Panel title="Date">
        <div className="max-w-xs"><DateField label="Pick a date" value={date} onChange={setDate} /></div>
      </Panel>
      <Panel title="Result">
        {!p || !iw || !range ? <Empty>Pick a date to see its ISO week number.</Empty> : (
          <div className="space-y-4">
            <p className="text-2xl font-semibold tracking-tight">Week {iw.week} of {iw.year}</p>
            <div className={grid}>
              <Stat label="Week runs" value={`${shortDate(range.monday)} to ${shortDate(range.sunday)}`} sub="Monday to Sunday" />
              <Stat label="Weekday" value={WEEKDAYS[weekday(p)]} />
              <Stat label="Day of the year" value={dayOfYear(p)} />
              <Stat label={`Weeks in ${iw.year}`} value={isoWeeksInYear(iw.year)} />
              <Stat label="Quarter" value={`Q${quarter(p)}`} />
              <Stat label="Week-year" value={iw.year} sub={iw.year !== p.y ? `Differs from the calendar year ${p.y}` : 'Same as the calendar year'} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Leap year ─────────────
export function LeapYearChecker() {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [from, setFrom] = useState('2000')
  const [to, setTo] = useState('2040')
  const y = Number(year)
  const valid = year.trim() !== '' && Number.isInteger(y) && y >= 1 && y <= 9999
  const fa = Number(from)
  const ta = Number(to)
  const rangeOk = from.trim() !== '' && to.trim() !== '' && Number.isInteger(fa) && Number.isInteger(ta) && fa >= 1 && ta <= 9999 && ta >= 1 && fa <= 9999
  const list = useMemo(() => (rangeOk ? leapYearsInRange(fa, ta) : null), [rangeOk, fa, ta])
  const leap = valid && isLeapYear(y)

  return (
    <div className="space-y-5">
      <Panel title="Check a year">
        <div className="max-w-xs"><NumField label="Year (1 to 9999)" value={year} onChange={setYear} step="1" min={1} /></div>
        <div className="mt-4">
          {!valid ? <Empty>Enter a year between 1 and 9999.</Empty> : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-semibold tracking-tight">{y} {leap ? 'is' : 'is not'} a leap year</p>
                <Badge tone={leap ? 'accent' : 'neutral'}>{leap ? '366 days' : '365 days'}</Badge>
              </div>
              <p className="text-sm text-ink-2">{leapReason(y)}</p>
              <div className={grid}>
                <Stat label="Previous leap year" value={previousLeapYear(y) ?? 'None'} />
                <Stat label="Next leap year" value={nextLeapYear(y)} />
                <Stat label="February has" value={`${leap ? 29 : 28} days`} />
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">The rule is the Gregorian calendar rule, applied to every year shown, including years before the calendar was adopted.</p>
      </Panel>
      <Panel title="Leap years in a range">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="From year" value={from} onChange={setFrom} step="1" min={1} />
          <NumField label="To year" value={to} onChange={setTo} step="1" min={1} />
        </div>
        <div className="mt-4">
          {!list ? <Empty>Enter two years between 1 and 9999.</Empty> : (
            <div className="space-y-3">
              <p className="text-sm"><strong>{list.total.toLocaleString('en-US')}</strong> leap {list.total === 1 ? 'year' : 'years'} found{list.years.length < list.total ? `, showing the first ${list.years.length}` : ''}.</p>
              <p className="tabular flex flex-wrap gap-1.5">{list.years.map((l) => <span key={l} className="rounded-md bg-surface-2 px-2 py-0.5 text-sm">{l}</span>)}</p>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
