// Synthetic mock-data generator with a seedable PRNG. All values are made up.

export type FieldType =
  | 'id'
  | 'uuid'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'country'
  | 'company'
  | 'jobTitle'
  | 'date'
  | 'boolean'
  | 'integer'
  | 'price'
  | 'sentence'
  | 'avatarColor'

export const FIELD_TYPES: { type: FieldType; label: string; defaultName: string }[] = [
  { type: 'id', label: 'Row number', defaultName: 'id' },
  { type: 'uuid', label: 'UUID', defaultName: 'uuid' },
  { type: 'firstName', label: 'First name', defaultName: 'first_name' },
  { type: 'lastName', label: 'Last name', defaultName: 'last_name' },
  { type: 'fullName', label: 'Full name', defaultName: 'name' },
  { type: 'email', label: 'Email', defaultName: 'email' },
  { type: 'phone', label: 'Phone', defaultName: 'phone' },
  { type: 'address', label: 'Street address', defaultName: 'address' },
  { type: 'city', label: 'City', defaultName: 'city' },
  { type: 'country', label: 'Country', defaultName: 'country' },
  { type: 'company', label: 'Company', defaultName: 'company' },
  { type: 'jobTitle', label: 'Job title', defaultName: 'job_title' },
  { type: 'date', label: 'Date', defaultName: 'date' },
  { type: 'boolean', label: 'Boolean', defaultName: 'active' },
  { type: 'integer', label: 'Integer (1 to 10000)', defaultName: 'quantity' },
  { type: 'price', label: 'Price', defaultName: 'price' },
  { type: 'sentence', label: 'Lorem sentence', defaultName: 'note' },
  { type: 'avatarColor', label: 'Avatar color', defaultName: 'avatar_color' },
]

export interface FieldSpec {
  name: string
  type: FieldType
}

export type Rng = () => number

/** Small, fast seeded generator. Same seed gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Turn any seed text into a 32-bit number. Numeric text is used as is. */
export function seedFromText(text: string): number {
  const s = text.trim()
  if (/^\d{1,10}$/.test(s) && Number(s) < 2 ** 32) return Number(s)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const FIRST = ['Ava', 'Noah', 'Mira', 'Leo', 'Zoe', 'Ravi', 'Lena', 'Omar', 'Ines', 'Kai', 'Tara', 'Milo', 'Nina', 'Arjun', 'Elsa', 'Hugo', 'Sana', 'Theo', 'Yuki', 'Priya', 'Luca', 'Maya', 'Felix', 'Dara', 'Ezra']
const LAST = ['Ashford', 'Banerjee', 'Castillo', 'Dubois', 'Eriksen', 'Fontaine', 'Garrett', 'Hollis', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quinn', 'Reyes', 'Sato', 'Thornton', 'Umar', 'Varga', 'Whitlock', 'Yilmaz', 'Zhang']
const STREETS = ['Maple', 'Cedar', 'Willow', 'Harbor', 'Summit', 'Meadow', 'Lantern', 'Orchard', 'River', 'Stone', 'Birch', 'Sunset']
const SUFFIX = ['Street', 'Avenue', 'Lane', 'Road', 'Court', 'Way']
const CITIES = ['Springfield', 'Riverton', 'Lakeview', 'Fairmont', 'Brookfield', 'Oakdale', 'Westport', 'Hillcrest', 'Ashland', 'Greenville', 'Stonebridge', 'Northgate']
const COUNTRIES = ['Canada', 'Brazil', 'Norway', 'India', 'Kenya', 'Japan', 'Spain', 'Chile', 'Poland', 'Vietnam', 'Ireland', 'Australia', 'Mexico', 'Egypt', 'Sweden']
const COMPANY_A = ['Bright', 'Nimbus', 'Cobalt', 'Juniper', 'Atlas', 'Pioneer', 'Ember', 'Quartz', 'Harbor', 'Vertex']
const COMPANY_B = ['Labs', 'Works', 'Systems', 'Partners', 'Group', 'Dynamics', 'Studio', 'Logistics']
const JOBS = ['Software Engineer', 'Product Manager', 'Data Analyst', 'Designer', 'Accountant', 'Support Specialist', 'Project Coordinator', 'Marketing Lead', 'Operations Manager', 'QA Tester', 'Technical Writer', 'Sales Associate']
const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'minim', 'veniam']
const DOMAINS = ['example.com', 'example.org', 'example.net']

const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)]
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const hex = (n: number, w: number) => n.toString(16).padStart(w, '0')
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export const MAX_ROWS = 1000

export function sanitizeFields(fields: FieldSpec[]): FieldSpec[] {
  const seen = new Map<string, number>()
  return fields.map((f, i) => {
    const base = f.name.trim() || `field_${i + 1}`
    const c = (seen.get(base) ?? 0) + 1
    seen.set(base, c)
    return { type: f.type, name: c === 1 ? base : `${base}_${c}` }
  })
}

export type Row = Record<string, string | number | boolean>

export function generateRows(count: number, fields: FieldSpec[], seed: number): Row[] {
  const n = Math.max(0, Math.min(MAX_ROWS, Math.floor(count) || 0))
  const specs = sanitizeFields(fields)
  const r = mulberry32(seed)
  const rows: Row[] = []
  for (let i = 0; i < n; i++) {
    const first = pick(r, FIRST)
    const last = pick(r, LAST)
    const row: Row = {}
    for (const f of specs) {
      switch (f.type) {
        case 'id': row[f.name] = i + 1; break
        case 'uuid': {
          const h = Array.from({ length: 4 }, () => hex(Math.floor(r() * 2 ** 32), 8)).join('')
          const v = h.slice(0, 12) + '4' + h.slice(13, 16) + '89ab'[Math.floor(r() * 4)] + h.slice(17, 20) + h.slice(20)
          row[f.name] = `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`
          break
        }
        case 'firstName': row[f.name] = first; break
        case 'lastName': row[f.name] = last; break
        case 'fullName': row[f.name] = `${first} ${last}`; break
        case 'email': row[f.name] = `${slug(first)}.${slug(last)}${int(r, 1, 99)}@${pick(r, DOMAINS)}`; break
        case 'phone': row[f.name] = `+1-555-01${String(int(r, 0, 99)).padStart(2, '0')}`; break
        case 'address': row[f.name] = `${int(r, 1, 9999)} ${pick(r, STREETS)} ${pick(r, SUFFIX)}`; break
        case 'city': row[f.name] = pick(r, CITIES); break
        case 'country': row[f.name] = pick(r, COUNTRIES); break
        case 'company': row[f.name] = `${pick(r, COMPANY_A)} ${pick(r, COMPANY_B)}`; break
        case 'jobTitle': row[f.name] = pick(r, JOBS); break
        case 'date': {
          const y = int(r, 2015, 2025)
          const m = int(r, 1, 12)
          const d = int(r, 1, 28)
          row[f.name] = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          break
        }
        case 'boolean': row[f.name] = r() < 0.5; break
        case 'integer': row[f.name] = int(r, 1, 10000); break
        case 'price': row[f.name] = Number((int(r, 100, 99999) / 100).toFixed(2)); break
        case 'sentence': {
          const words = Array.from({ length: int(r, 6, 12) }, () => pick(r, WORDS))
          row[f.name] = words[0][0].toUpperCase() + words[0].slice(1) + ' ' + words.slice(1).join(' ') + '.'
          break
        }
        case 'avatarColor': row[f.name] = '#' + hex(int(r, 0, 0xffffff), 6); break
      }
    }
    rows.push(row)
  }
  return rows
}

const csvCell = (v: string | number | boolean): string => {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(rows: Row[], fields: FieldSpec[]): string {
  const names = sanitizeFields(fields).map((f) => f.name)
  return [names.map(csvCell).join(','), ...rows.map((r) => names.map((n) => csvCell(r[n])).join(','))].join('\n') + '\n'
}

const sqlIdent = (s: string) => (/^[A-Za-z_]\w*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)
const sqlValue = (v: string | number | boolean) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v))

export function rowsToSql(rows: Row[], fields: FieldSpec[], table: string): string {
  const names = sanitizeFields(fields).map((f) => f.name)
  if (!rows.length || !names.length) return ''
  const cols = names.map(sqlIdent).join(', ')
  return rows.map((r) => `INSERT INTO ${sqlIdent(table.trim() || 'mock_data')} (${cols}) VALUES (${names.map((n) => sqlValue(r[n])).join(', ')});`).join('\n') + '\n'
}

export function rowsToJson(rows: Row[]): string {
  return JSON.stringify(rows, null, 2) + '\n'
}
