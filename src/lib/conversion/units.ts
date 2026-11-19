/** Unit conversion tables and number-to-words. */

export type UnitCategoryId = 'length' | 'mass' | 'temperature' | 'volume' | 'area' | 'speed' | 'time' | 'data'

export interface Unit {
  id: string
  label: string
  /** Multiply by this to get the category's base unit. Unused for temperature. */
  factor: number
}

export interface UnitCategory {
  id: UnitCategoryId
  label: string
  units: Unit[]
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'mm', label: 'Millimeters (mm)', factor: 0.001 },
      { id: 'cm', label: 'Centimeters (cm)', factor: 0.01 },
      { id: 'm', label: 'Meters (m)', factor: 1 },
      { id: 'km', label: 'Kilometers (km)', factor: 1000 },
      { id: 'in', label: 'Inches (in)', factor: 0.0254 },
      { id: 'ft', label: 'Feet (ft)', factor: 0.3048 },
      { id: 'yd', label: 'Yards (yd)', factor: 0.9144 },
      { id: 'mi', label: 'Miles (mi)', factor: 1609.344 },
      { id: 'nmi', label: 'Nautical miles', factor: 1852 },
    ],
  },
  {
    id: 'mass',
    label: 'Weight and mass',
    units: [
      { id: 'mg', label: 'Milligrams (mg)', factor: 0.000001 },
      { id: 'g', label: 'Grams (g)', factor: 0.001 },
      { id: 'kg', label: 'Kilograms (kg)', factor: 1 },
      { id: 't', label: 'Metric tons (t)', factor: 1000 },
      { id: 'oz', label: 'Ounces (oz)', factor: 0.028349523125 },
      { id: 'lb', label: 'Pounds (lb)', factor: 0.45359237 },
      { id: 'st', label: 'Stone (st)', factor: 6.35029318 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'c', label: 'Celsius (°C)', factor: 1 },
      { id: 'f', label: 'Fahrenheit (°F)', factor: 1 },
      { id: 'k', label: 'Kelvin (K)', factor: 1 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { id: 'ml', label: 'Milliliters (ml)', factor: 0.001 },
      { id: 'l', label: 'Liters (l)', factor: 1 },
      { id: 'm3', label: 'Cubic meters (m³)', factor: 1000 },
      { id: 'tsp', label: 'Teaspoons (US)', factor: 0.00492892159375 },
      { id: 'tbsp', label: 'Tablespoons (US)', factor: 0.01478676478125 },
      { id: 'floz', label: 'Fluid ounces (US)', factor: 0.0295735295625 },
      { id: 'cup', label: 'Cups (US)', factor: 0.2365882365 },
      { id: 'pt', label: 'Pints (US)', factor: 0.473176473 },
      { id: 'gal', label: 'Gallons (US)', factor: 3.785411784 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    units: [
      { id: 'cm2', label: 'Square centimeters', factor: 0.0001 },
      { id: 'm2', label: 'Square meters', factor: 1 },
      { id: 'ha', label: 'Hectares', factor: 10000 },
      { id: 'km2', label: 'Square kilometers', factor: 1_000_000 },
      { id: 'in2', label: 'Square inches', factor: 0.00064516 },
      { id: 'ft2', label: 'Square feet', factor: 0.09290304 },
      { id: 'ac', label: 'Acres', factor: 4046.8564224 },
      { id: 'mi2', label: 'Square miles', factor: 2_589_988.110336 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'ms', label: 'Meters per second', factor: 1 },
      { id: 'kmh', label: 'Kilometers per hour', factor: 1 / 3.6 },
      { id: 'mph', label: 'Miles per hour', factor: 0.44704 },
      { id: 'kn', label: 'Knots', factor: 1852 / 3600 },
      { id: 'fts', label: 'Feet per second', factor: 0.3048 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 'ms', label: 'Milliseconds', factor: 0.001 },
      { id: 's', label: 'Seconds', factor: 1 },
      { id: 'min', label: 'Minutes', factor: 60 },
      { id: 'h', label: 'Hours', factor: 3600 },
      { id: 'd', label: 'Days', factor: 86400 },
      { id: 'w', label: 'Weeks', factor: 604800 },
      { id: 'y', label: 'Years (365 days)', factor: 31_536_000 },
    ],
  },
  {
    id: 'data',
    label: 'Digital storage',
    units: [
      { id: 'bit', label: 'Bits', factor: 1 / 8 },
      { id: 'B', label: 'Bytes (B)', factor: 1 },
      { id: 'KB', label: 'Kilobytes (KB, 1000)', factor: 1e3 },
      { id: 'MB', label: 'Megabytes (MB, 1000²)', factor: 1e6 },
      { id: 'GB', label: 'Gigabytes (GB, 1000³)', factor: 1e9 },
      { id: 'TB', label: 'Terabytes (TB, 1000⁴)', factor: 1e12 },
      { id: 'KiB', label: 'Kibibytes (KiB, 1024)', factor: 1024 },
      { id: 'MiB', label: 'Mebibytes (MiB, 1024²)', factor: 1024 ** 2 },
      { id: 'GiB', label: 'Gibibytes (GiB, 1024³)', factor: 1024 ** 3 },
      { id: 'TiB', label: 'Tebibytes (TiB, 1024⁴)', factor: 1024 ** 4 },
    ],
  },
]

export const categoryOf = (id: UnitCategoryId): UnitCategory => UNIT_CATEGORIES.find((c) => c.id === id)!

function toCelsius(v: number, u: string): number {
  return u === 'f' ? ((v - 32) * 5) / 9 : u === 'k' ? v - 273.15 : v
}
function fromCelsius(c: number, u: string): number {
  return u === 'f' ? (c * 9) / 5 + 32 : u === 'k' ? c + 273.15 : c
}

export function convertUnit(value: number, category: UnitCategoryId, from: string, to: string): number {
  if (category === 'temperature') return fromCelsius(toCelsius(value, from), to)
  const cat = categoryOf(category)
  const f = cat.units.find((u) => u.id === from)
  const t = cat.units.find((u) => u.id === to)
  if (!f || !t) return Number.NaN
  return (value * f.factor) / t.factor
}

/** Up to 8 significant digits, no trailing zeros, and exponent form only for extreme values. */
export function formatUnitValue(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e15 || abs < 1e-7) return n.toExponential(6).replace(/\.?0+e/, 'e')
  return String(Number(n.toPrecision(8)))
}

// ───────────── Number to words ─────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`)
    n %= 100
  }
  if (n >= 20) {
    const t = TENS[Math.floor(n / 10)]
    parts.push(n % 10 ? `${t}-${ONES[n % 10]}` : t)
  } else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

export function bigIntToWords(n: bigint): string {
  if (n === 0n) return 'zero'
  const neg = n < 0n
  if (neg) n = -n
  const groups: string[] = []
  let i = 0
  while (n > 0n) {
    const chunk = Number(n % 1000n)
    if (chunk) groups.unshift([below1000(chunk), SCALES[i]].filter(Boolean).join(' '))
    n /= 1000n
    i++
    if (i >= SCALES.length && n > 0n) throw new RangeError('That number is too large.')
  }
  return (neg ? 'minus ' : '') + groups.join(' ')
}

/** Accepts integers and decimals, such as "-1,204.05". Decimal digits are read one by one. */
export function numberToWords(input: string): string {
  const s = input.trim().replace(/[,\s_]/g, '')
  if (!/^[-+]?\d+(\.\d+)?$/.test(s) && !/^[-+]?\.\d+$/.test(s)) throw new SyntaxError('Enter a number such as 1204 or -3.14.')
  const neg = s.startsWith('-')
  const [intRaw, frac] = s.replace(/^[-+]/, '').split('.')
  if (intRaw.length > 36) throw new RangeError('That number is too large. The limit is 36 digits.')
  let words = bigIntToWords(BigInt(intRaw || '0'))
  if (frac) words += ` point ${[...frac].map((d) => ONES[Number(d)]).join(' ')}`
  return neg && /[1-9]/.test(s) ? `minus ${words}` : words
}

/** Cheque-style amount, for example "one hundred twenty-three dollars and forty-five cents". */
export function amountToWords(input: string, major = 'dollar', minor = 'cent'): string {
  const s = input.trim().replace(/[,\s_]/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new SyntaxError('Enter an amount with at most two decimals, such as 123.45.')
  const neg = s.startsWith('-')
  const [i, f = ''] = s.replace('-', '').split('.')
  const whole = BigInt(i)
  const cents = Number(f.padEnd(2, '0'))
  const plural = (n: bigint | number, w: string) => (n === 1n || n === 1 ? w : `${w}s`)
  const parts = [`${bigIntToWords(whole)} ${plural(whole, major)}`]
  if (cents) parts.push(`${below1000(cents)} ${plural(cents, minor)}`)
  return (neg ? 'minus ' : '') + parts.join(' and ')
}
