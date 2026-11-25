import { useState } from 'react'
import { Panel } from '@/components/tools/controls'
import { Field, Input } from '@/components/ui/fields'
import { Alert, Stat } from '@/components/ui/misc'
import { planRetirement, validateRetirement, type RetirementInput } from '@/lib/calc/retirement'

const fields: Array<{ key: keyof RetirementInput; label: string; hint?: string }> = [
  { key: 'currentAge', label: 'Current age' },
  { key: 'retirementAge', label: 'Retirement age' },
  { key: 'lifeExpectancy', label: 'Plan until age' },
  { key: 'currentSavings', label: 'Savings today' },
  { key: 'monthlyContribution', label: 'Monthly saving' },
  { key: 'monthlyExpense', label: 'Monthly spending wanted', hint: "In today's money" },
  { key: 'returnBefore', label: 'Return before retirement (% a year)' },
  { key: 'returnAfter', label: 'Return after retirement (% a year)' },
  { key: 'inflation', label: 'Inflation (% a year)' },
]

const money = (n: number) => Math.round(n).toLocaleString('en-US')

export default function RetirementCalculator() {
  const [v, setV] = useState<Record<keyof RetirementInput, string>>({
    currentAge: '30', retirementAge: '60', lifeExpectancy: '85', currentSavings: '500000', monthlyContribution: '20000',
    monthlyExpense: '50000', returnBefore: '10', returnAfter: '7', inflation: '6',
  })
  const input = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, s.trim() === '' ? NaN : Number(s)])) as unknown as RetirementInput
  const error = validateRetirement(input)
  const r = error ? null : planRetirement(input)

  return (
    <div className="space-y-5">
      <Panel title="Retirement calculator">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {(id) => <Input id={id} inputMode="decimal" value={v[f.key]} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} />}
            </Field>
          ))}
        </div>
      </Panel>
      {error && <Alert tone="warn">{error}</Alert>}
      {r && (
        <Panel title="Result">
          <div className="space-y-4">
            {r.onTrack ? (
              <Alert tone="success" title="On track">Your projected savings cover the spending you want until age {input.lifeExpectancy}, with about {money(-r.gap)} to spare.</Alert>
            ) : (
              <Alert tone="warn" title="Short of the target">Save about {money(r.extraMonthly)} more each month to close the gap of {money(r.gap)}.</Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Projected savings at retirement" value={money(r.projectedCorpus)} />
              <Stat label="Savings needed" value={money(r.requiredCorpus)} />
              <Stat label="First month's spending then" value={money(r.expenseAtRetirement)} sub={`${r.yearsToRetire} years from now`} />
              <Stat label="Years in retirement" value={r.yearsInRetirement} />
            </div>
            <p className="text-xs text-muted">An estimate with fixed rates. Real returns and inflation vary, and tax and fees are not included. Amounts are in whatever currency you entered.</p>
          </div>
        </Panel>
      )}
    </div>
  )
}
