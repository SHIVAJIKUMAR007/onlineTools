import { useMemo, useState, type ReactNode } from 'react'
import { Panel } from '@/components/tools/controls'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import { DEFAULT_INPUT, calcSalary, type RegimeResult, type SalaryInput } from '@/lib/calc/india'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const money = (n: number) => inr.format(Math.round(n))

function Num({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}
const num = (s: string) => (s.trim() === '' ? 0 : Number(s))

type Form = Record<'ctc' | 'basicPct' | 'hraPct' | 'benefits' | 'pt' | 'rent' | 'd80c' | 'd80d' | 'nps' | 'loan' | 'other', string>

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">{label}</th>
      <td className="py-1.5 text-right">{value}</td>
    </tr>
  )
}

function RegimeCard({ title, r, best }: { title: string; r: RegimeResult; best: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${best ? 'border-accent bg-accent/5' : 'border-line'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {best && <Badge tone="accent">Higher take-home</Badge>}
      </div>
      <p className="text-xs text-muted">Monthly take-home</p>
      <p className="tabular text-2xl font-semibold" aria-live="polite">{money(r.monthlyInHand)}</p>
      <table className="tabular mt-3 w-full text-sm">
        <tbody>
          <Row label="Taxable income" value={money(r.taxable)} />
          <Row label="Income tax a year" value={money(r.tax)} />
          <Row label="Income tax a month" value={money(r.monthlyTax)} />
          <Row label="Take-home a year" value={money(r.annualInHand)} />
        </tbody>
      </table>
    </div>
  )
}

export function CtcToTakeHome() {
  const [f, setF] = useState<Form>({ ctc: '1200000', basicPct: '40', hraPct: '50', benefits: '0', pt: '200', rent: '0', d80c: '0', d80d: '0', nps: '0', loan: '0', other: '0' })
  const [pfCap, setPfCap] = useState(false)
  const [gratuity, setGratuity] = useState(true)
  const [metro, setMetro] = useState(true)
  const [unit, setUnit] = useState<'annual' | 'lakh'>('annual')
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const ctcValue = f.ctc.trim() === '' ? NaN : unit === 'lakh' ? Number(f.ctc) * 100_000 : Number(f.ctc)
  const input: SalaryInput = useMemo(
    () => ({
      ...DEFAULT_INPUT,
      ctc: ctcValue,
      basicPct: num(f.basicPct),
      hraPctOfBasic: num(f.hraPct),
      pfCap,
      includeGratuity: gratuity,
      employerBenefits: num(f.benefits),
      professionalTaxMonthly: num(f.pt),
      rentAnnual: num(f.rent),
      metro,
      ded80C: num(f.d80c),
      ded80D: num(f.d80d),
      nps: num(f.nps),
      homeLoanInterest: num(f.loan),
      otherDeductions: num(f.other),
    }),
    [f, pfCap, gratuity, metro, ctcValue],
  )
  const r = useMemo(() => calcSalary(input), [input])

  return (
    <div className="space-y-5">
      <Panel title="Your salary">
        <div className="mb-4">
          <Segmented label="CTC unit" value={unit} onChange={setUnit} options={[{ value: 'annual', label: 'Rupees a year' }, { value: 'lakh', label: 'Lakhs a year' }]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label={unit === 'lakh' ? 'Annual CTC (lakhs)' : 'Annual CTC (₹)'} value={f.ctc} onChange={set('ctc')} />
          <Num label="Basic as % of CTC" value={f.basicPct} onChange={set('basicPct')} hint="Often 40 to 50." />
          <Num label="HRA as % of basic" value={f.hraPct} onChange={set('hraPct')} hint="Often 50 in metros, 40 elsewhere." />
          <Num label="Employer benefits in CTC (₹ a year)" value={f.benefits} onChange={set('benefits')} hint="Insurance or other items paid by the employer." />
          <Num label="Professional tax (₹ a month)" value={f.pt} onChange={set('pt')} hint="Varies by state. Many states charge up to 200." />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={pfCap} onChange={setPfCap} label="Limit PF to the ₹15,000 wage ceiling" />
          <Switch checked={gratuity} onChange={setGratuity} label="Gratuity is part of CTC" />
        </div>
      </Panel>

      <Panel title="Old regime deductions" actions={<span className="text-xs text-muted">Used only for the old regime</span>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Rent paid (₹ a year)" value={f.rent} onChange={set('rent')} hint="For the HRA exemption." />
          <Num label="80C investments (₹)" value={f.d80c} onChange={set('d80c')} hint="Your PF share is added automatically. Limit 1.5 lakh in total." />
          <Num label="80D health insurance (₹)" value={f.d80d} onChange={set('d80d')} />
          <Num label="NPS 80CCD(1B) (₹)" value={f.nps} onChange={set('nps')} hint="Up to 50,000." />
          <Num label="Home loan interest (₹)" value={f.loan} onChange={set('loan')} hint="Up to 2 lakh on a self-occupied home." />
          <Num label="Other deductions (₹)" value={f.other} onChange={set('other')} />
        </div>
        <div className="mt-4"><Switch checked={metro} onChange={setMetro} label="I live in Delhi, Mumbai, Kolkata or Chennai (50% HRA limit)" /></div>
      </Panel>

      {!r ? (
        <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">Enter your annual CTC to see the take-home estimate.</p>
      ) : (
        <>
          {r.negativeSpecial && (
            <Alert tone="warn">Basic, HRA, PF and gratuity add up to more than your CTC. Lower the basic or HRA percentage.</Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Gross salary a year" value={money(r.gross)} sub="CTC minus employer PF, gratuity and benefits" />
            <Stat label="Best monthly take-home" value={money(Math.max(r.newRegime.monthlyInHand, r.oldRegime.monthlyInHand))} sub={r.better === 'same' ? 'Both regimes match' : r.better === 'new' ? 'New regime' : 'Old regime'} />
            <Stat label="Employee PF a month" value={money(r.employeePf / 12)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RegimeCard title="New tax regime" r={r.newRegime} best={r.better === 'new'} />
            <RegimeCard title="Old tax regime" r={r.oldRegime} best={r.better === 'old'} />
          </div>
          <Panel title="Salary breakup">
            <table className="tabular w-full text-sm">
              <thead className="text-xs text-muted">
                <tr><th scope="col" className="py-2 text-left font-medium">Component</th><th scope="col" className="py-2 text-right font-medium">Monthly</th><th scope="col" className="py-2 text-right font-medium">Yearly</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(
                  [
                    ['Basic', r.basic],
                    ['HRA', r.hra],
                    ['Special allowance', r.special],
                    ['Gross salary', r.gross],
                    ['Employee PF (deducted)', -r.employeePf],
                    ['Professional tax (deducted)', -r.professionalTax],
                    ['Employer PF (in CTC)', r.employerPf],
                    ['Gratuity (in CTC)', r.gratuity],
                    ['Employer benefits (in CTC)', r.employerBenefits],
                  ] as [string, number][]
                ).map(([label, v]) => (
                  <tr key={label}>
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-2">{label}</th>
                    <td className="py-1.5 text-right">{money(v / 12)}</td>
                    <td className="py-1.5 text-right">{money(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.hraExemption > 0 && <p className="mt-3 text-xs text-muted">Old regime HRA exemption: {money(r.hraExemption)} a year.</p>}
          </Panel>
          <p className="text-xs text-muted">
            Estimate only. Tax uses FY 2025-26 slabs, the 4% cess, the section 87A rebate and surcharge without marginal relief. Your payslip can differ because employers set their own salary structure and tax deduction method.
          </p>
        </>
      )}
    </div>
  )
}
