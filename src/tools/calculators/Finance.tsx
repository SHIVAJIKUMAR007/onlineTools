import { useMemo, useState, type ReactNode } from 'react'
import { Panel } from '@/components/tools/controls'
import { Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import {
  calcCompound,
  calcDiscount,
  calcEmi,
  calcGst,
  calcMargin,
  calcSip,
  calcTip,
  emiByYear,
  priceFromMargin,
  priceFromMarkup,
  salaryFromAnnual,
  salaryFromHourly,
} from '@/lib/calc/finance'

// ───────────── shared bits ─────────────
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
          {Object.keys(CURRENCIES).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      )}
    </Field>
  )
  return { money: (n: number) => fmt.format(n), money0: (n: number) => fmt0.format(n), picker }
}

/** Number field that keeps its text while typing; empty or invalid text gives NaN. */
function Num({ label, value, onChange, min = 0, step = 'any', hint, className, suffix }: { label: string; value: string; onChange: (v: string) => void; min?: number; step?: string; hint?: ReactNode; className?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint} className={className}>
      {(id) => <Input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}
const n = (s: string) => (s.trim() === '' ? NaN : Number(s))
const n0 = (s: string) => (s.trim() === '' ? 0 : Number(s))

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">{children}</p>
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

const EMPTY_MSG = 'Enter valid values above to see the result.'

// ───────────── EMI ─────────────
export function EmiCalculator() {
  const { money, money0, picker } = useMoney()
  const [p, setP] = useState('1000000')
  const [rate, setRate] = useState('9')
  const [tenure, setTenure] = useState('10')
  const [unit, setUnit] = useState<'years' | 'months'>('years')
  const [view, setView] = useState<'year' | 'month'>('year')
  const months = unit === 'years' ? n(tenure) * 12 : n(tenure)
  const r = useMemo(() => calcEmi(n(p), n(rate), months), [p, rate, months])
  const years = useMemo(() => (r ? emiByYear(r.schedule) : []), [r])
  return (
    <div className="space-y-5">
      <Panel title="Loan details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Loan amount" value={p} onChange={setP} />
          <Num label="Interest rate per year" suffix="%" value={rate} onChange={setRate} />
          <Num label="Tenure" value={tenure} onChange={setTenure} step="1" />
          <div className="flex flex-wrap items-end gap-3">
            <Segmented label="Tenure unit" value={unit} onChange={setUnit} options={[{ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' }]} />
            {picker}
          </div>
        </div>
      </Panel>
      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Monthly EMI" value={money(r.emi)} />
            <Stat label="Total interest" value={money0(r.totalInterest)} />
            <Stat label="Total payment" value={money0(r.totalPayment)} />
          </div>
          <Panel title="Principal and interest"><SplitBar aLabel="Principal" a={n(p)} bLabel="Interest" b={r.totalInterest} /></Panel>
          <Panel title="Amortization schedule" actions={<Segmented label="Schedule view" value={view} onChange={setView} options={[{ value: 'year', label: 'By year' }, { value: 'month', label: 'By month' }]} />}>
            {view === 'year' ? (
              <Table head={['Year', 'Principal paid', 'Interest paid', 'Balance']} rows={years.map((y) => [y.year, money0(y.principal), money0(y.interest), money0(y.balance)])} />
            ) : (
              <Table head={['Month', 'Payment', 'Principal', 'Interest', 'Balance']} rows={r.schedule.map((x) => [x.month, money(x.payment), money(x.principal), money(x.interest), money(x.balance)])} />
            )}
          </Panel>
        </>
      ) : (
        <Empty>{EMPTY_MSG} Amount must be above zero, the rate cannot be negative, and the tenure must be 1 to 1200 months.</Empty>
      )}
    </div>
  )
}

// ───────────── SIP ─────────────
export function SipCalculator() {
  const { money0, picker } = useMoney()
  const [m, setM] = useState('10000')
  const [rate, setRate] = useState('12')
  const [years, setYears] = useState('10')
  const [step, setStep] = useState(false)
  const [stepPct, setStepPct] = useState('10')
  const r = useMemo(() => calcSip(n(m), n(rate), n(years), step ? n0(stepPct) : 0), [m, rate, years, step, stepPct])
  return (
    <div className="space-y-5">
      <Panel title="Investment details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Monthly investment" value={m} onChange={setM} />
          <Num label="Expected return per year" suffix="%" value={rate} onChange={setRate} />
          <Num label="Years" value={years} onChange={setYears} step="1" min={1} />
          <div className="flex items-end">{picker}</div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-5">
          <Switch checked={step} onChange={setStep} label="Increase the SIP every year" />
          {step ? <Num label="Annual step-up" suffix="%" value={stepPct} onChange={setStepPct} className="w-40" /> : null}
        </div>
      </Panel>
      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Amount invested" value={money0(r.invested)} />
            <Stat label="Estimated returns" value={money0(r.gain)} />
            <Stat label="Future value" value={money0(r.futureValue)} />
          </div>
          <Panel title="Invested and returns"><SplitBar aLabel="Invested" a={r.invested} bLabel="Returns" b={Math.max(0, r.gain)} /></Panel>
          <Panel title="Year by year">
            <Table head={['Year', 'Invested', 'Value']} rows={r.rows.map((x) => [x.year, money0(x.invested), money0(x.value)])} />
          </Panel>
        </>
      ) : (
        <Empty>{EMPTY_MSG} Years must be a whole number from 1 to 60.</Empty>
      )}
    </div>
  )
}

// ───────────── Compound interest ─────────────
const FREQ = [
  { v: 1, l: 'Yearly' },
  { v: 2, l: 'Half-yearly' },
  { v: 4, l: 'Quarterly' },
  { v: 12, l: 'Monthly' },
  { v: 365, l: 'Daily' },
]
export function CompoundInterestCalculator() {
  const { money0, picker } = useMoney()
  const [p, setP] = useState('100000')
  const [rate, setRate] = useState('7')
  const [years, setYears] = useState('10')
  const [freq, setFreq] = useState(12)
  const [contrib, setContrib] = useState('0')
  const r = useMemo(() => calcCompound(n0(p), n(rate), n(years), freq, n0(contrib)), [p, rate, years, freq, contrib])
  return (
    <div className="space-y-5">
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Starting amount" value={p} onChange={setP} />
          <Num label="Interest rate per year" suffix="%" value={rate} onChange={setRate} />
          <Num label="Years" value={years} onChange={setYears} step="1" min={1} />
          <Field label="Compounding">
            {(id) => (
              <Select id={id} value={freq} onChange={(e) => setFreq(Number(e.target.value))}>
                {FREQ.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
              </Select>
            )}
          </Field>
          <Num label="Monthly contribution (optional)" value={contrib} onChange={setContrib} hint="Added at the end of each month." />
          <div className="flex items-end">{picker}</div>
        </div>
      </Panel>
      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Final balance" value={money0(r.finalBalance)} />
            <Stat label="Total contributed" value={money0(r.contributed)} />
            <Stat label="Interest earned" value={money0(r.interest)} />
          </div>
          <Panel title="Contributed and interest"><SplitBar aLabel="Contributed" a={r.contributed} bLabel="Interest" b={Math.max(0, r.interest)} /></Panel>
          <Panel title="Year by year">
            <Table head={['Year', 'Contributed', 'Interest', 'Balance']} rows={r.rows.map((x) => [x.year, money0(x.contributed), money0(x.interest), money0(x.balance)])} />
          </Panel>
        </>
      ) : (
        <Empty>{EMPTY_MSG} Enter a starting amount or a monthly contribution, and years from 1 to 100.</Empty>
      )}
    </div>
  )
}

// ───────────── GST ─────────────
const GST_PRESETS = ['5', '12', '18', '28']
export function GstCalculator() {
  const { money, picker } = useMoney()
  const [amt, setAmt] = useState('1000')
  const [rate, setRate] = useState('18')
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const r = useMemo(() => calcGst(n(amt), n(rate), mode), [amt, rate, mode])
  return (
    <div className="space-y-5">
      <Panel title="Amount and rate">
        <div className="flex flex-wrap items-end gap-5">
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'add', label: 'Add GST' }, { value: 'remove', label: 'Remove GST' }]} />
          <Num label={mode === 'add' ? 'Price without tax' : 'Price including tax'} value={amt} onChange={setAmt} className="w-48" />
          <Num label="Tax rate" suffix="%" value={rate} onChange={setRate} className="w-32" />
          {picker}
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Rate presets">
          {GST_PRESETS.map((x) => (
            <button key={x} type="button" aria-pressed={rate === x} onClick={() => setRate(x)} className={`h-8 cursor-pointer rounded-lg px-3 text-sm font-medium ${rate === x ? 'bg-accent text-white' : 'bg-surface-2 hover:text-accent'}`}>{x}%</button>
          ))}
        </div>
      </Panel>
      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Net (before tax)" value={money(r.net)} />
            <Stat label="Tax amount" value={money(r.tax)} />
            <Stat label="Gross (with tax)" value={money(r.gross)} />
          </div>
          <Panel title="Split for in-state sales">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label={`CGST (${(n(rate) / 2).toString()}%)`} value={money(r.half)} />
              <Stat label={`SGST (${(n(rate) / 2).toString()}%)`} value={money(r.half)} />
            </div>
            <p className="mt-3 text-xs text-muted">For sales between states, the full tax is charged as IGST.</p>
          </Panel>
        </>
      ) : (
        <Empty>{EMPTY_MSG}</Empty>
      )}
    </div>
  )
}

// ───────────── Discount ─────────────
export function DiscountCalculator() {
  const { money, picker } = useMoney()
  const [price, setPrice] = useState('2000')
  const [d1, setD1] = useState('25')
  const [second, setSecond] = useState(false)
  const [d2, setD2] = useState('10')
  const [tax, setTax] = useState(false)
  const [taxPct, setTaxPct] = useState('18')
  const r = useMemo(() => calcDiscount(n(price), n(d1), second ? n0(d2) : 0, tax ? n0(taxPct) : 0), [price, d1, second, d2, tax, taxPct])
  return (
    <div className="space-y-5">
      <Panel title="Price and discount">
        <div className="flex flex-wrap items-end gap-5">
          <Num label="Original price" value={price} onChange={setPrice} className="w-44" />
          <Num label="Discount" suffix="%" value={d1} onChange={setD1} className="w-32" />
          {picker}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-5">
          <Switch checked={second} onChange={setSecond} label="Second discount" />
          {second ? <Num label="Extra discount" suffix="%" value={d2} onChange={setD2} className="w-32" /> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-5">
          <Switch checked={tax} onChange={setTax} label="Add sales tax" />
          {tax ? <Num label="Tax rate" suffix="%" value={taxPct} onChange={setTaxPct} className="w-32" /> : null}
        </div>
      </Panel>
      {r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="You pay" value={money(r.finalPrice)} />
          <Stat label="You save" value={money(r.saved)} sub={`${r.effectivePct.toFixed(2)}% off in total`} />
          <Stat label="Price after discounts" value={money(r.afterSecond)} />
          {tax ? <Stat label="Tax" value={money(r.taxAmount)} /> : null}
        </div>
      ) : (
        <Empty>{EMPTY_MSG} Discounts must be between 0 and 100.</Empty>
      )}
    </div>
  )
}

// ───────────── Tip ─────────────
export function TipCalculator() {
  const { money, picker } = useMoney()
  const [bill, setBill] = useState('1500')
  const [tip, setTip] = useState('10')
  const [people, setPeople] = useState('1')
  const [round, setRound] = useState(false)
  const r = useMemo(() => calcTip(n(bill), n(tip), n(people), round), [bill, tip, people, round])
  return (
    <div className="space-y-5">
      <Panel title="Bill">
        <div className="flex flex-wrap items-end gap-5">
          <Num label="Bill amount" value={bill} onChange={setBill} className="w-44" />
          <Num label="Tip" suffix="%" value={tip} onChange={setTip} className="w-28" />
          <Num label="People" value={people} onChange={setPeople} step="1" min={1} className="w-28" />
          {picker}
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Tip presets">
          {['0', '5', '10', '15', '18', '20'].map((x) => (
            <button key={x} type="button" aria-pressed={tip === x} onClick={() => setTip(x)} className={`h-8 cursor-pointer rounded-lg px-3 text-sm font-medium ${tip === x ? 'bg-accent text-white' : 'bg-surface-2 hover:text-accent'}`}>{x}%</button>
          ))}
        </div>
        <div className="mt-4"><Switch checked={round} onChange={setRound} label="Round each share up to a whole number" /></div>
      </Panel>
      {r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Each person pays" value={money(r.perPerson)} />
          <Stat label="Total tip" value={money(r.tip)} sub={`${money(r.tipPerPerson)} per person`} />
          <Stat label="Total with tip" value={money(r.total)} />
          <Stat label="Bill" value={money(n(bill))} />
        </div>
      ) : (
        <Empty>{EMPTY_MSG} You need at least 1 person.</Empty>
      )}
    </div>
  )
}

// ───────────── Profit margin ─────────────
export function ProfitMarginCalculator() {
  const { money, picker } = useMoney()
  const [cost, setCost] = useState('600')
  const [price, setPrice] = useState('1000')
  const [mode, setMode] = useState<'margin' | 'markup'>('margin')
  const [target, setTarget] = useState('30')
  const r = useMemo(() => calcMargin(n(cost), n(price)), [cost, price])
  const solved = useMemo(() => (mode === 'margin' ? priceFromMargin(n(cost), n(target)) : priceFromMarkup(n(cost), n(target))), [cost, target, mode])
  const pct = (x: number) => (Number.isFinite(x) ? `${x.toFixed(2)}%` : 'n/a')
  return (
    <div className="space-y-5">
      <Panel title="Margin from cost and price">
        <div className="flex flex-wrap items-end gap-5">
          <Num label="Cost" value={cost} onChange={setCost} className="w-44" />
          <Num label="Selling price" value={price} onChange={setPrice} className="w-44" />
          {picker}
        </div>
        <div className="mt-4">
          {r ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Profit" value={money(r.profit)} />
              <Stat label="Profit margin" value={pct(r.marginPct)} sub="profit / price" />
              <Stat label="Markup" value={pct(r.markupPct)} sub="profit / cost" />
            </div>
          ) : (
            <Empty>{EMPTY_MSG} Price must be above zero.</Empty>
          )}
        </div>
      </Panel>
      <Panel title="Find the price for a target">
        <div className="flex flex-wrap items-end gap-5">
          <Segmented label="Target type" value={mode} onChange={setMode} options={[{ value: 'margin', label: 'Margin' }, { value: 'markup', label: 'Markup' }]} />
          <Num label={mode === 'margin' ? 'Desired margin' : 'Desired markup'} suffix="%" value={target} onChange={setTarget} className="w-40" />
        </div>
        <div className="mt-4">
          {solved !== null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Selling price needed" value={money(solved)} />
              <Stat label="Profit per unit" value={money(solved - n(cost))} />
            </div>
          ) : (
            <Empty>Enter a cost and a target. A margin must be below 100%.</Empty>
          )}
        </div>
      </Panel>
    </div>
  )
}

// ───────────── Hourly to annual salary ─────────────
export function HourlyToAnnualSalaryCalculator() {
  const { money, money0, picker } = useMoney()
  const [dir, setDir] = useState<'hourly' | 'annual'>('hourly')
  const [val, setVal] = useState('25')
  const [hpw, setHpw] = useState('40')
  const [wpy, setWpy] = useState('52')
  const r = useMemo(() => (dir === 'hourly' ? salaryFromHourly(n(val), n(hpw), n(wpy)) : salaryFromAnnual(n(val), n(hpw), n(wpy))), [dir, val, hpw, wpy])
  return (
    <div className="space-y-5">
      <Panel title="Pay and schedule">
        <div className="flex flex-wrap items-end gap-5">
          <Segmented label="Convert from" value={dir} onChange={(d) => { setDir(d); setVal(d === 'hourly' ? '25' : '52000') }} options={[{ value: 'hourly', label: 'Hourly pay' }, { value: 'annual', label: 'Annual salary' }]} />
          <Num label={dir === 'hourly' ? 'Hourly rate' : 'Annual salary'} value={val} onChange={setVal} className="w-44" />
          <Num label="Hours per week" value={hpw} onChange={setHpw} className="w-32" />
          <Num label="Weeks per year" value={wpy} onChange={setWpy} className="w-32" hint="Use 50 to leave out 2 unpaid weeks." />
          {picker}
        </div>
      </Panel>
      {r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Hourly" value={money(r.hourly)} />
          <Stat label="Daily (5 days)" value={money(r.daily)} />
          <Stat label="Weekly" value={money(r.weekly)} />
          <Stat label="Every two weeks" value={money(r.biweekly)} />
          <Stat label="Monthly" value={money0(r.monthly)} />
          <Stat label="Annual" value={money0(r.annual)} />
        </div>
      ) : (
        <Empty>{EMPTY_MSG} Hours per week must be 1 to 168 and weeks per year 1 to 53.</Empty>
      )}
    </div>
  )
}
