/** Pure helpers for the calorie, fuel cost and electricity bill calculators. Invalid input returns null. */

const ok = (...n: number[]) => n.every((x) => Number.isFinite(x))

// ───────────── Calories ─────────────
export type Sex = 'male' | 'female'
export type ActivityId = 'sedentary' | 'light' | 'moderate' | 'active' | 'very'
export const ACTIVITY_LEVELS: { id: ActivityId; label: string; factor: number; hint: string }[] = [
  { id: 'sedentary', label: 'Sedentary', factor: 1.2, hint: 'Desk job, little or no exercise' },
  { id: 'light', label: 'Lightly active', factor: 1.375, hint: 'Light exercise 1 to 3 days a week' },
  { id: 'moderate', label: 'Moderately active', factor: 1.55, hint: 'Moderate exercise 3 to 5 days a week' },
  { id: 'active', label: 'Very active', factor: 1.725, hint: 'Hard exercise 6 to 7 days a week' },
  { id: 'very', label: 'Extra active', factor: 1.9, hint: 'Physical job plus hard training' },
]
export const KCAL_PER_KG = 7700
export const LB_TO_KG = 0.45359237
export const IN_TO_CM = 2.54
export const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 }

export type MacroPresetId = 'balanced' | 'highProtein' | 'lowCarb' | 'lowFat'
export const MACRO_PRESETS: { id: MacroPresetId; label: string; p: number; c: number; f: number }[] = [
  { id: 'balanced', label: 'Balanced (30 / 40 / 30)', p: 30, c: 40, f: 30 },
  { id: 'highProtein', label: 'High protein (40 / 30 / 30)', p: 40, c: 30, f: 30 },
  { id: 'lowCarb', label: 'Lower carb (35 / 25 / 40)', p: 35, c: 25, f: 40 },
  { id: 'lowFat', label: 'Lower fat (25 / 55 / 20)', p: 25, c: 55, f: 20 },
]

export const lbToKg = (lb: number) => lb * LB_TO_KG
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * IN_TO_CM

/** Mifflin-St Jeor resting energy in kcal per day, or null when input is out of range. */
export function bmrMifflin(sex: Sex, age: number, heightCm: number, weightKg: number): number | null {
  if (!ok(age, heightCm, weightKg) || age < 18 || age > 100 || heightCm < 100 || heightCm > 250 || weightKg < 30 || weightKg > 300) return null
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export interface Macros {
  proteinG: number
  carbsG: number
  fatG: number
}
export function macroGrams(calories: number, presetId: MacroPresetId): Macros | null {
  const p = MACRO_PRESETS.find((x) => x.id === presetId)
  if (!p || !ok(calories) || calories <= 0) return null
  return { proteinG: (calories * p.p) / 100 / 4, carbsG: (calories * p.c) / 100 / 4, fatG: (calories * p.f) / 100 / 9 }
}

export interface CalorieGoal {
  label: 'Lose' | 'Maintain' | 'Gain'
  calories: number
  dailyChange: number
  belowMinimum: boolean
  bigDeficit: boolean
}
export interface CalorieResult {
  bmr: number
  tdee: number
  minimum: number
  goals: CalorieGoal[]
}

/** weeklyRateKg is the size of the weekly change (0 or more); the sign comes from each goal. */
export function calcCalories(sex: Sex, age: number, heightCm: number, weightKg: number, activity: ActivityId, weeklyRateKg: number): CalorieResult | null {
  const bmr = bmrMifflin(sex, age, heightCm, weightKg)
  const level = ACTIVITY_LEVELS.find((a) => a.id === activity)
  if (bmr === null || !level || !ok(weeklyRateKg) || weeklyRateKg < 0 || weeklyRateKg > 2) return null
  const tdee = bmr * level.factor
  const delta = (weeklyRateKg * KCAL_PER_KG) / 7
  const minimum = MIN_CALORIES[sex]
  const mk = (label: CalorieGoal['label'], change: number): CalorieGoal => {
    const calories = tdee + change
    return { label, calories, dailyChange: change, belowMinimum: change < 0 && calories < minimum, bigDeficit: change < 0 && -change > 1000 }
  }
  return { bmr, tdee, minimum, goals: [mk('Lose', -delta), mk('Maintain', 0), mk('Gain', delta)] }
}

// ───────────── Fuel ─────────────
export type DistanceUnit = 'km' | 'mi'
export type EfficiencyUnit = 'kmpl' | 'l100km' | 'mpgUS' | 'mpgUK'
export type VolumeUnit = 'l' | 'galUS' | 'galUK'
export const KM_PER_MILE = 1.609344
export const L_PER_GAL_US = 3.785411784
export const L_PER_GAL_UK = 4.54609

export const distanceToKm = (v: number, u: DistanceUnit) => (u === 'km' ? v : v * KM_PER_MILE)
export const volumeToLitres = (v: number, u: VolumeUnit) => (u === 'l' ? v : v * (u === 'galUS' ? L_PER_GAL_US : L_PER_GAL_UK))
/** Price per chosen volume unit to price per litre. */
export const pricePerLitre = (price: number, u: VolumeUnit) => (u === 'l' ? price : price / (u === 'galUS' ? L_PER_GAL_US : L_PER_GAL_UK))

export function toKmPerLitre(value: number, u: EfficiencyUnit): number | null {
  if (!ok(value) || value <= 0) return null
  switch (u) {
    case 'kmpl':
      return value
    case 'l100km':
      return 100 / value
    case 'mpgUS':
      return (value * KM_PER_MILE) / L_PER_GAL_US
    case 'mpgUK':
      return (value * KM_PER_MILE) / L_PER_GAL_UK
  }
}
export function fromKmPerLitre(kmpl: number, u: EfficiencyUnit): number {
  switch (u) {
    case 'kmpl':
      return kmpl
    case 'l100km':
      return 100 / kmpl
    case 'mpgUS':
      return (kmpl * L_PER_GAL_US) / KM_PER_MILE
    case 'mpgUK':
      return (kmpl * L_PER_GAL_UK) / KM_PER_MILE
  }
}

export interface FuelTrip {
  km: number
  litres: number
  cost: number
  costPerKm: number
  costPerMile: number
  perPerson: number
}
export function calcFuelTrip(
  distance: number,
  distUnit: DistanceUnit,
  efficiency: number,
  effUnit: EfficiencyUnit,
  price: number,
  priceUnit: VolumeUnit,
  people = 1,
  roundTrip = false,
): FuelTrip | null {
  const kmpl = toKmPerLitre(efficiency, effUnit)
  if (kmpl === null || !ok(distance, price, people) || distance <= 0 || price < 0 || people < 1) return null
  const km = distanceToKm(distance, distUnit) * (roundTrip ? 2 : 1)
  const litres = km / kmpl
  const cost = litres * pricePerLitre(price, priceUnit)
  return { km, litres, cost, costPerKm: cost / km, costPerMile: (cost / km) * KM_PER_MILE, perPerson: cost / Math.floor(people) }
}

export interface FuelEfficiency {
  kmpl: number
  l100km: number
  mpgUS: number
  mpgUK: number
}
export function calcEfficiency(distance: number, distUnit: DistanceUnit, fuel: number, fuelUnit: VolumeUnit): FuelEfficiency | null {
  if (!ok(distance, fuel) || distance <= 0 || fuel <= 0) return null
  const kmpl = distanceToKm(distance, distUnit) / volumeToLitres(fuel, fuelUnit)
  return { kmpl, l100km: fromKmPerLitre(kmpl, 'l100km'), mpgUS: fromKmPerLitre(kmpl, 'mpgUS'), mpgUK: fromKmPerLitre(kmpl, 'mpgUK') }
}

// ───────────── Electricity ─────────────
/** upTo null means "above the previous limit" and must be the last slab. */
export interface Slab {
  upTo: number | null
  rate: number
}
export interface SlabLine {
  from: number
  to: number | null
  units: number
  rate: number
  amount: number
}
export interface BillInput {
  units: number
  slabs: Slab[]
  fixedCharge?: number
  surchargePerUnit?: number
  dutyPercent?: number
}
export interface BillResult {
  lines: SlabLine[]
  energyCharge: number
  fixedCharge: number
  surcharge: number
  subtotal: number
  duty: number
  total: number
  averagePerUnit: number
}

/** Returns an error message, or null when the slab list is usable. */
export function validateSlabs(slabs: Slab[]): string | null {
  if (slabs.length === 0) return 'Add at least one slab.'
  let prev = 0
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i]
    if (!ok(s.rate) || s.rate < 0) return `Slab ${i + 1} needs a rate of 0 or more.`
    const last = i === slabs.length - 1
    if (s.upTo === null) {
      if (!last) return `Only the last slab can be "above". Slab ${i + 1} needs an upper limit.`
    } else {
      if (!ok(s.upTo) || s.upTo <= prev) return `Slab ${i + 1} limit must be higher than ${prev}.`
      if (last) return 'The last slab should be the "above" row with no upper limit.'
      prev = s.upTo
    }
  }
  return null
}

export function calcElectricityBill(input: BillInput): BillResult | null {
  const { units, slabs } = input
  const fixed = input.fixedCharge ?? 0
  const sur = input.surchargePerUnit ?? 0
  const dutyPct = input.dutyPercent ?? 0
  if (!ok(units, fixed, sur, dutyPct) || units < 0 || fixed < 0 || sur < 0 || dutyPct < 0 || validateSlabs(slabs) !== null) return null
  const lines: SlabLine[] = []
  let prev = 0
  for (const s of slabs) {
    const cap = s.upTo ?? Infinity
    const used = Math.max(0, Math.min(units, cap) - prev)
    lines.push({ from: prev, to: s.upTo, units: used, rate: s.rate, amount: used * s.rate })
    prev = cap
  }
  const energyCharge = lines.reduce((a, l) => a + l.amount, 0)
  const surcharge = units * sur
  const subtotal = energyCharge + fixed + surcharge
  const duty = (subtotal * dutyPct) / 100
  const total = subtotal + duty
  return { lines, energyCharge, fixedCharge: fixed, surcharge, subtotal, duty, total, averagePerUnit: units > 0 ? total / units : 0 }
}

export interface ApplianceCost {
  kwh: number
  cost: number
}
export function applianceCost(watts: number, hoursPerDay: number, days: number, rate: number, quantity = 1): ApplianceCost | null {
  if (!ok(watts, hoursPerDay, days, rate, quantity) || watts < 0 || hoursPerDay < 0 || hoursPerDay > 24 || days < 0 || rate < 0 || quantity < 0) return null
  const kwh = (watts * hoursPerDay * days * quantity) / 1000
  return { kwh, cost: kwh * rate }
}
