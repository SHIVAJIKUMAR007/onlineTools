import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import {
  ACTIVITY_LEVELS,
  MACRO_PRESETS,
  applianceCost,
  calcCalories,
  calcEfficiency,
  calcElectricityBill,
  calcFuelTrip,
  ftInToCm,
  lbToKg,
  macroGrams,
  validateSlabs,
  type ActivityId,
  type DistanceUnit,
  type EfficiencyUnit,
  type MacroPresetId,
  type Sex,
  type Slab,
  type VolumeUnit,
} from '@/lib/calc/batchG'

/** Number field that keeps its text while typing; empty or invalid text gives NaN. */
function Num({ label, value, onChange, min = 0, step = 'any', hint, className }: { label: string; value: string; onChange: (v: string) => void; min?: number; step?: string; hint?: ReactNode; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <Input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}
const n = (s: string) => (s.trim() === '' ? NaN : Number(s))
const n0 = (s: string) => (s.trim() === '' ? 0 : Number(s))

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">{children}</p>
}

const fmt = (x: number, digits = 2) => x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const kcal = (x: number) => `${Math.round(x).toLocaleString('en-US')} kcal`

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-auto rounded-xl border border-line">
      <table className="tabular w-full text-right text-sm">
        <thead className="bg-surface text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-left' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────────── Calories ─────────────
export function CalorieCalculator() {
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('30')
  const [cm, setCm] = useState('175')
  const [kg, setKg] = useState('75')
  const [ft, setFt] = useState('5')
  const [inch, setInch] = useState('9')
  const [lb, setLb] = useState('165')
  const [activity, setActivity] = useState<ActivityId>('light')
  const [rate, setRate] = useState('0.5')
  const [preset, setPreset] = useState<MacroPresetId>('balanced')
  const [macroGoal, setMacroGoal] = useState<'Lose' | 'Maintain' | 'Gain'>('Maintain')

  const metric = units === 'metric'
  const heightCm = metric ? n(cm) : ftInToCm(n(ft), n0(inch))
  const weightKg = metric ? n(kg) : lbToKg(n(lb))
  const rateKg = metric ? n(rate) : lbToKg(n(rate))
  const r = useMemo(() => calcCalories(sex, n(age), heightCm, weightKg, activity, rateKg), [sex, age, heightCm, weightKg, activity, rateKg])
  const goal = r?.goals.find((g) => g.label === macroGoal)
  const macros = goal ? macroGrams(goal.calories, preset) : null

  const switchUnits = (u: 'metric' | 'imperial') => {
    setUnits(u)
    setRate(u === 'metric' ? '0.5' : '1')
  }
  const rateUnit = metric ? 'kg' : 'lb'

  return (
    <div className="space-y-5">
      <Alert tone="warn" title="For adults only. Not medical advice.">
        These numbers are estimates from a population formula. They do not replace advice from a doctor or registered dietitian, and they are not for anyone under 18, pregnant, or managing a medical condition.
      </Alert>
      <Panel title="About you">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented label="Units" value={units} onChange={switchUnits} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} />
          <Segmented label="Sex used in the formula" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Age (years, 18 to 100)" value={age} onChange={setAge} min={18} step="1" />
          {metric ? (
            <>
              <Num label="Height (cm)" value={cm} onChange={setCm} />
              <Num label="Weight (kg)" value={kg} onChange={setKg} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Num label="Height (ft)" value={ft} onChange={setFt} step="1" />
                <Num label="(in)" value={inch} onChange={setInch} />
              </div>
              <Num label="Weight (lb)" value={lb} onChange={setLb} />
            </>
          )}
          <Field label="Activity level" hint={ACTIVITY_LEVELS.find((a) => a.id === activity)?.hint}>
            {(id) => (
              <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value as ActivityId)}>
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} (x{a.factor})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Num label={`Weekly change (${rateUnit} per week)`} value={rate} onChange={setRate} hint="Used for both the lose and gain rows." />
        </div>
      </Panel>

      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="BMR (Mifflin-St Jeor)" value={kcal(r.bmr)} sub="Energy used at complete rest" />
            <Stat label="Maintenance (TDEE)" value={kcal(r.tdee)} sub="BMR times your activity factor" />
          </div>
          <Panel title="Daily calories by goal">
            <Table
              head={['Goal', 'Calories per day', 'Change per day']}
              rows={r.goals.map((g) => [
                g.label,
                <span key="c" className="font-medium">{kcal(g.calories)}</span>,
                g.dailyChange === 0 ? '0' : `${g.dailyChange > 0 ? '+' : '-'}${Math.round(Math.abs(g.dailyChange))} kcal`,
              ])}
            />
            <p className="mt-3 text-xs text-muted">Rough rule: about 7,700 kcal is one kilogram of body weight change. Real changes vary from person to person and slow down over time.</p>
            {r.goals[0].belowMinimum ? (
              <Alert tone="danger" className="mt-3" title="Below commonly cited minimums">
                The lose target is under {r.minimum.toLocaleString('en-US')} kcal per day, a level often quoted as the lowest to follow without medical supervision. Pick a slower weekly change and talk to a doctor or dietitian.
              </Alert>
            ) : null}
            {r.goals[0].bigDeficit ? (
              <Alert tone="warn" className="mt-3" title="Large daily deficit">
                A deficit of more than 1,000 kcal per day is aggressive. Check with a health professional before trying it.
              </Alert>
            ) : null}
          </Panel>
          <Panel title="Protein, carbs and fat">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Segmented label="Macros for goal" value={macroGoal} onChange={setMacroGoal} options={r.goals.map((g) => ({ value: g.label, label: g.label }))} />
              <Field label="Split (protein / carbs / fat, % of calories)" className="min-w-56">
                {(id) => (
                  <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as MacroPresetId)}>
                    {MACRO_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {macros ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Protein" value={`${Math.round(macros.proteinG)} g`} sub="4 kcal per gram" />
                <Stat label="Carbohydrate" value={`${Math.round(macros.carbsG)} g`} sub="4 kcal per gram" />
                <Stat label="Fat" value={`${Math.round(macros.fatG)} g`} sub="9 kcal per gram" />
              </div>
            ) : null}
          </Panel>
        </>
      ) : (
        <Empty>Enter an age from 18 to 100, a height and a weight to see your estimate.</Empty>
      )}
    </div>
  )
}

// ───────────── Fuel cost ─────────────
const EFF_UNITS: { value: EfficiencyUnit; label: string }[] = [
  { value: 'kmpl', label: 'km/l' },
  { value: 'l100km', label: 'l/100 km' },
  { value: 'mpgUS', label: 'mpg (US)' },
  { value: 'mpgUK', label: 'mpg (UK)' },
]
const VOL_UNITS: { value: VolumeUnit; label: string }[] = [
  { value: 'l', label: 'per litre' },
  { value: 'galUS', label: 'per US gallon' },
  { value: 'galUK', label: 'per UK gallon' },
]

function UnitSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )}
    </Field>
  )
}

export function FuelCostCalculator() {
  const [mode, setMode] = useState<'trip' | 'eff'>('trip')
  const [dist, setDist] = useState('250')
  const [distUnit, setDistUnit] = useState<DistanceUnit>('km')
  const [eff, setEff] = useState('15')
  const [effUnit, setEffUnit] = useState<EfficiencyUnit>('kmpl')
  const [price, setPrice] = useState('100')
  const [priceUnit, setPriceUnit] = useState<VolumeUnit>('l')
  const [people, setPeople] = useState('1')
  const [round, setRound] = useState(false)
  const [fuel, setFuel] = useState('')
  const [fuelUnit, setFuelUnit] = useState<VolumeUnit>('l')

  const trip = useMemo(() => calcFuelTrip(n(dist), distUnit, n(eff), effUnit, n(price), priceUnit, n0(people) || 1, round), [dist, distUnit, eff, effUnit, price, priceUnit, people, round])
  const actual = useMemo(() => calcEfficiency(n(dist), distUnit, n(fuel), fuelUnit), [dist, distUnit, fuel, fuelUnit])
  const distOptions = [{ value: 'km' as DistanceUnit, label: 'km' }, { value: 'mi' as DistanceUnit, label: 'miles' }]
  const fuelOptions = [{ value: 'l' as VolumeUnit, label: 'litres' }, { value: 'galUS' as VolumeUnit, label: 'US gallons' }, { value: 'galUK' as VolumeUnit, label: 'UK gallons' }]

  return (
    <div className="space-y-5">
      <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'trip', label: 'Trip cost' }, { value: 'eff', label: 'My fuel efficiency' }]} />
      {mode === 'trip' ? (
        <>
          <Panel title="Trip details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Num label="Distance" value={dist} onChange={setDist} />
                <UnitSelect label="Unit" value={distUnit} onChange={setDistUnit} options={distOptions} />
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-2">
                <Num label="Fuel efficiency" value={eff} onChange={setEff} />
                <UnitSelect label="Unit" value={effUnit} onChange={setEffUnit} options={EFF_UNITS} />
              </div>
              <div className="grid grid-cols-[1fr_9rem] gap-2">
                <Num label="Fuel price" value={price} onChange={setPrice} />
                <UnitSelect label="Per" value={priceUnit} onChange={setPriceUnit} options={VOL_UNITS} />
              </div>
              <Num label="People sharing the cost" value={people} onChange={setPeople} min={1} step="1" />
              <div className="flex items-end pb-2">
                <Switch checked={round} onChange={setRound} label="Round trip (double the distance)" />
              </div>
            </div>
          </Panel>
          {trip ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Fuel cost" value={fmt(trip.cost)} sub="In your price currency" />
              <Stat label="Fuel needed" value={`${fmt(trip.litres)} L`} sub={`${fmt(trip.litres / 3.785411784)} US gal`} />
              <Stat label="Cost per km" value={fmt(trip.costPerKm)} sub={`${fmt(trip.costPerMile)} per mile`} />
              <Stat label={Math.floor(n0(people) || 1) > 1 ? 'Cost per person' : 'Total distance'} value={Math.floor(n0(people) || 1) > 1 ? fmt(trip.perPerson) : `${fmt(trip.km, 1)} km`} sub={`${fmt(trip.km, 1)} km driven`} />
            </div>
          ) : (
            <Empty>Enter a distance, a fuel efficiency above zero and a fuel price to see the trip cost.</Empty>
          )}
          <p className="text-xs text-muted">Real consumption changes with speed, load, traffic and air conditioning. Use your own recent average for the best estimate.</p>
        </>
      ) : (
        <>
          <Panel title="Distance driven and fuel filled">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Num label="Distance driven" value={dist} onChange={setDist} />
                <UnitSelect label="Unit" value={distUnit} onChange={setDistUnit} options={distOptions} />
              </div>
              <div className="grid grid-cols-[1fr_9rem] gap-2">
                <Num label="Fuel filled" value={fuel} onChange={setFuel} />
                <UnitSelect label="Unit" value={fuelUnit} onChange={setFuelUnit} options={fuelOptions} />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Fill the tank, drive, then fill it again. The fuel added at the second fill is what you used over the distance between the fills.</p>
          </Panel>
          {actual ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="km per litre" value={fmt(actual.kmpl)} />
              <Stat label="Litres per 100 km" value={fmt(actual.l100km)} />
              <Stat label="mpg (US)" value={fmt(actual.mpgUS)} />
              <Stat label="mpg (UK)" value={fmt(actual.mpgUK)} />
            </div>
          ) : (
            <Empty>Enter the distance driven and the fuel added to see your actual efficiency.</Empty>
          )}
        </>
      )}
    </div>
  )
}

// ───────────── Electricity ─────────────
interface SlabRow {
  id: number
  upTo: string
  rate: string
}
interface Appliance {
  id: number
  name: string
  watts: string
  hours: string
  days: string
  qty: string
}

export function ElectricityBillCalculator() {
  const nextId = useRef(10)
  const [mode, setMode] = useState<'bill' | 'appliance'>('bill')
  const [rows, setRows] = useState<SlabRow[]>([
    { id: 1, upTo: '100', rate: '3' },
    { id: 2, upTo: '200', rate: '5' },
    { id: 3, upTo: '', rate: '7' },
  ])
  const [units, setUnits] = useState('250')
  const [fixed, setFixed] = useState('50')
  const [surcharge, setSurcharge] = useState('0')
  const [duty, setDuty] = useState('5')
  const [appliances, setAppliances] = useState<Appliance[]>([
    { id: 1, name: 'Ceiling fan', watts: '75', hours: '8', days: '30', qty: '2' },
    { id: 2, name: 'Refrigerator', watts: '150', hours: '24', days: '30', qty: '1' },
  ])
  const [rate, setRate] = useState('6')

  const slabs: Slab[] = rows.map((r, i) => ({ upTo: i === rows.length - 1 ? null : n(r.upTo), rate: n(r.rate) }))
  const slabError = validateSlabs(slabs)
  const bill = useMemo(
    () => calcElectricityBill({ units: n(units), slabs, fixedCharge: n0(fixed), surchargePerUnit: n0(surcharge), dutyPercent: n0(duty) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, units, fixed, surcharge, duty],
  )

  const updateRow = (id: number, patch: Partial<SlabRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const addSlab = () => setRows((rs) => [...rs.slice(0, -1), { id: nextId.current++, upTo: '', rate: '' }, rs[rs.length - 1]])
  const removeSlab = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id))

  const costs = appliances.map((a) => applianceCost(n(a.watts), n(a.hours), n(a.days), n(rate), n0(a.qty)))
  const totalKwh = costs.reduce((s, c) => s + (c?.kwh ?? 0), 0)
  const totalCost = costs.reduce((s, c) => s + (c?.cost ?? 0), 0)
  const updateApp = (id: number, patch: Partial<Appliance>) => setAppliances((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const summary = bill ? `Units ${n(units)}\nEnergy charge ${fmt(bill.energyCharge)}\nFixed charge ${fmt(bill.fixedCharge)}\nSurcharge ${fmt(bill.surcharge)}\nDuty ${fmt(bill.duty)}\nTotal ${fmt(bill.total)}\nAverage per unit ${fmt(bill.averagePerUnit)}` : ''

  return (
    <div className="space-y-5">
      <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'bill', label: 'Bill from slabs' }, { value: 'appliance', label: 'Appliance cost' }]} />
      {mode === 'bill' ? (
        <>
          <Alert tone="warn" title="Example slabs only">
            The slab table below is an EXAMPLE and is not any state or company tariff. Replace it with the slabs, fixed charge and taxes printed on your own bill or on your supplier&apos;s tariff page.
          </Alert>
          <Panel title="Tariff slabs" actions={<Button size="sm" variant="secondary" onClick={addSlab}>Add slab</Button>}>
            <div className="space-y-2">
              {rows.map((r, i) => {
                const last = i === rows.length - 1
                const prev = i === 0 ? '0' : rows[i - 1].upTo || '?'
                return (
                  <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    {last ? (
                      <Field label={`Slab ${i + 1}: units`}>{(id) => <Input id={id} value={`Above ${prev}`} readOnly aria-readonly />}</Field>
                    ) : (
                      <Num label={`Slab ${i + 1}: up to (units)`} value={r.upTo} onChange={(v) => updateRow(r.id, { upTo: v })} />
                    )}
                    <Num label="Rate per unit" value={r.rate} onChange={(v) => updateRow(r.id, { rate: v })} />
                    <Button size="sm" variant="ghost" onClick={() => removeSlab(r.id)} disabled={last} aria-label={`Remove slab ${i + 1}`}>Remove</Button>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Each slab prices only the units that fall inside it. Some suppliers price all units at the rate of the highest slab reached. If yours does, use one &quot;above&quot; row with that single rate.</p>
          </Panel>
          <Panel title="Your bill">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Num label="Units consumed (kWh)" value={units} onChange={setUnits} />
              <Num label="Fixed charge" value={fixed} onChange={setFixed} hint="Per bill, leave empty for none" />
              <Num label="Fuel surcharge per unit" value={surcharge} onChange={setSurcharge} hint="Optional" />
              <Num label="Duty / tax (%)" value={duty} onChange={setDuty} hint="Applied to energy + fixed + surcharge" />
            </div>
          </Panel>
          {slabError ? (
            <Alert tone="danger">{slabError}</Alert>
          ) : bill ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Energy charge" value={fmt(bill.energyCharge)} />
                <Stat label="Total bill" value={fmt(bill.total)} sub={`Duty ${fmt(bill.duty)}`} />
                <Stat label="Average cost per unit" value={fmt(bill.averagePerUnit)} sub="Total bill divided by units" />
              </div>
              <Panel title="Slab breakdown" actions={<CopyButton text={summary} label="Copy summary" />}>
                <Table
                  head={['Slab (units)', 'Units used', 'Rate', 'Amount']}
                  rows={[
                    ...bill.lines.map((l) => [l.to === null ? `Above ${l.from}` : `${l.from} to ${l.to}`, fmt(l.units, 0 === l.units % 1 ? 0 : 2), fmt(l.rate), fmt(l.amount)]),
                    ['Fixed charge', '', '', fmt(bill.fixedCharge)],
                    ['Fuel surcharge', '', '', fmt(bill.surcharge)],
                    ['Duty / tax', '', '', fmt(bill.duty)],
                    [<strong key="t">Total</strong>, '', '', <strong key="v">{fmt(bill.total)}</strong>],
                  ]}
                />
              </Panel>
            </>
          ) : (
            <Empty>Enter the units consumed and a rate for every slab to see the bill.</Empty>
          )}
        </>
      ) : (
        <>
          <Panel title="Appliances" actions={<Button size="sm" variant="secondary" onClick={() => setAppliances((as) => [...as, { id: nextId.current++, name: '', watts: '', hours: '', days: '30', qty: '1' }])}>Add appliance</Button>}>
            <div className="mb-4 max-w-xs">
              <Num label="Rate per kWh (unit)" value={rate} onChange={setRate} hint="Use the average rate from your bill. The 6 shown is a placeholder." />
            </div>
            <div className="space-y-4">
              {appliances.map((a, i) => {
                const c = costs[i]
                return (
                  <div key={a.id} className="rounded-xl border border-line p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Field label="Name">{(id) => <Input id={id} value={a.name} placeholder="e.g. Air conditioner" onChange={(e) => updateApp(a.id, { name: e.target.value })} />}</Field>
                      <Num label="Power (watts)" value={a.watts} onChange={(v) => updateApp(a.id, { watts: v })} />
                      <Num label="Hours per day" value={a.hours} onChange={(v) => updateApp(a.id, { hours: v })} />
                      <Num label="Days" value={a.days} onChange={(v) => updateApp(a.id, { days: v })} />
                      <Num label="Quantity" value={a.qty} onChange={(v) => updateApp(a.id, { qty: v })} step="1" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="tabular text-muted">{c ? `${fmt(c.kwh)} kWh, cost ${fmt(c.cost)}` : 'Enter watts and hours (0 to 24) to see the cost.'}</span>
                      <Button size="sm" variant="ghost" onClick={() => setAppliances((as) => as.filter((x) => x.id !== a.id))} aria-label={`Remove appliance ${i + 1}`}>Remove</Button>
                    </div>
                  </div>
                )
              })}
              {appliances.length === 0 ? <Empty>Add an appliance to start.</Empty> : null}
            </div>
          </Panel>
          {appliances.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Total energy" value={`${fmt(totalKwh)} kWh`} />
              <Stat label="Total cost" value={fmt(totalCost)} sub={<Badge>flat rate, no slabs</Badge>} />
            </div>
          ) : null}
          <p className="text-xs text-muted">Wattage is on the appliance label. Devices such as fridges and air conditioners cycle on and off, so use the hours they actually draw power.</p>
        </>
      )}
    </div>
  )
}
