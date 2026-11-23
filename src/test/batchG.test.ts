import { describe, expect, it } from 'vitest'
import {
  applianceCost,
  bmrMifflin,
  calcCalories,
  calcEfficiency,
  calcElectricityBill,
  calcFuelTrip,
  fromKmPerLitre,
  ftInToCm,
  lbToKg,
  macroGrams,
  toKmPerLitre,
  validateSlabs,
} from '@/lib/calc/batchG'
import {
  CNY_DATES,
  FALLBACK_ZONES,
  animalOfYear,
  birthstone,
  chineseZodiac,
  dayDiffLabel,
  dayDifference,
  elementOfYear,
  filterZones,
  formatOffset,
  isValidDate,
  isValidZone,
  listZones,
  meetingGrid,
  parseLocalInput,
  westernSign,
  zonedParts,
  zonedToUtc,
} from '@/lib/utilities/batchG'

describe('calories', () => {
  it('computes Mifflin-St Jeor by hand', () => {
    expect(bmrMifflin('male', 30, 180, 80)).toBe(1780)
    expect(bmrMifflin('female', 25, 165, 60)).toBeCloseTo(1345.25, 5)
  })
  it('rejects out of range input, including minors', () => {
    expect(bmrMifflin('male', 17, 180, 80)).toBeNull()
    expect(bmrMifflin('male', 30, 50, 80)).toBeNull()
    expect(bmrMifflin('male', 30, 180, NaN)).toBeNull()
  })
  it('applies activity factor and weekly rate', () => {
    const r = calcCalories('male', 30, 180, 80, 'moderate', 0.5)!
    expect(r.tdee).toBeCloseTo(2759, 5)
    expect(r.goals[0].calories).toBeCloseTo(2759 - 550, 5)
    expect(r.goals[1].calories).toBeCloseTo(2759, 5)
    expect(r.goals[2].dailyChange).toBeCloseTo(550, 5)
    expect(r.goals[0].belowMinimum).toBe(false)
  })
  it('flags targets below the minimum and large deficits', () => {
    const r = calcCalories('female', 60, 150, 50, 'sedentary', 1.5)!
    expect(r.goals[0].belowMinimum).toBe(true)
    expect(r.goals[0].bigDeficit).toBe(true)
    expect(calcCalories('female', 60, 150, 50, 'sedentary', -1)).toBeNull()
  })
  it('splits macros into grams', () => {
    const m = macroGrams(2000, 'balanced')!
    expect(m.proteinG).toBeCloseTo(150, 5)
    expect(m.carbsG).toBeCloseTo(200, 5)
    expect(m.fatG).toBeCloseTo(66.667, 2)
    expect(macroGrams(0, 'balanced')).toBeNull()
  })
  it('converts imperial input', () => {
    expect(lbToKg(100)).toBeCloseTo(45.359237, 6)
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 6)
  })
})

describe('fuel', () => {
  it('converts efficiency units', () => {
    expect(toKmPerLitre(8, 'l100km')).toBeCloseTo(12.5, 6)
    expect(toKmPerLitre(30, 'mpgUS')).toBeCloseTo(12.754, 2)
    expect(toKmPerLitre(40, 'mpgUK')).toBeCloseTo(14.16, 2)
    expect(toKmPerLitre(0, 'kmpl')).toBeNull()
    expect(fromKmPerLitre(toKmPerLitre(30, 'mpgUS')!, 'l100km')).toBeCloseTo(7.8405, 3)
    expect(fromKmPerLitre(toKmPerLitre(33.5, 'mpgUK')!, 'mpgUK')).toBeCloseTo(33.5, 9)
  })
  it('computes trip cost, round trip and split', () => {
    const t = calcFuelTrip(100, 'km', 8, 'l100km', 100, 'l', 4, false)!
    expect(t.litres).toBeCloseTo(8, 9)
    expect(t.cost).toBeCloseTo(800, 9)
    expect(t.costPerKm).toBeCloseTo(8, 9)
    expect(t.perPerson).toBeCloseTo(200, 9)
    const r = calcFuelTrip(100, 'km', 8, 'l100km', 100, 'l', 4, true)!
    expect(r.cost).toBeCloseTo(1600, 9)
    expect(r.perPerson).toBeCloseTo(400, 9)
  })
  it('handles miles and gallon prices', () => {
    // 60 miles at 30 mpg (US) = 2 US gallons; at 4 per gallon = 8
    const t = calcFuelTrip(60, 'mi', 30, 'mpgUS', 4, 'galUS')!
    expect(t.cost).toBeCloseTo(8, 6)
    expect(t.litres).toBeCloseTo(2 * 3.785411784, 6)
  })
  it('returns null for invalid input', () => {
    expect(calcFuelTrip(NaN, 'km', 8, 'l100km', 100, 'l')).toBeNull()
    expect(calcFuelTrip(100, 'km', 0, 'l100km', 100, 'l')).toBeNull()
    expect(calcFuelTrip(100, 'km', 8, 'l100km', 100, 'l', 0)).toBeNull()
  })
  it('computes actual efficiency', () => {
    const e = calcEfficiency(500, 'km', 40, 'l')!
    expect(e.kmpl).toBeCloseTo(12.5, 9)
    expect(e.l100km).toBeCloseTo(8, 9)
    expect(e.mpgUS).toBeCloseTo(29.4, 1)
    expect(calcEfficiency(500, 'km', 0, 'l')).toBeNull()
    const miles = calcEfficiency(300, 'mi', 10, 'galUS')!
    expect(miles.mpgUS).toBeCloseTo(30, 9)
  })
})

describe('electricity', () => {
  const slabs = [
    { upTo: 100, rate: 3 },
    { upTo: 200, rate: 5 },
    { upTo: null, rate: 7 },
  ]
  it('bills slab by slab', () => {
    const b = calcElectricityBill({ units: 250, slabs, fixedCharge: 50, surchargePerUnit: 0.5, dutyPercent: 5 })!
    expect(b.lines.map((l) => l.units)).toEqual([100, 100, 50])
    expect(b.energyCharge).toBe(1150)
    expect(b.surcharge).toBe(125)
    expect(b.subtotal).toBe(1325)
    expect(b.duty).toBeCloseTo(66.25, 9)
    expect(b.total).toBeCloseTo(1391.25, 9)
    expect(b.averagePerUnit).toBeCloseTo(5.565, 9)
  })
  it('handles units inside the first slab and exactly on a limit', () => {
    expect(calcElectricityBill({ units: 80, slabs })!.energyCharge).toBe(240)
    const edge = calcElectricityBill({ units: 100, slabs })!
    expect(edge.energyCharge).toBe(300)
    expect(edge.lines[1].units).toBe(0)
  })
  it('handles zero units without dividing by zero', () => {
    const b = calcElectricityBill({ units: 0, slabs, fixedCharge: 40 })!
    expect(b.total).toBe(40)
    expect(b.averagePerUnit).toBe(0)
  })
  it('validates slabs', () => {
    expect(validateSlabs(slabs)).toBeNull()
    expect(validateSlabs([])).not.toBeNull()
    expect(validateSlabs([{ upTo: 100, rate: 3 }])).not.toBeNull()
    expect(validateSlabs([{ upTo: 100, rate: 3 }, { upTo: 50, rate: 4 }, { upTo: null, rate: 5 }])).not.toBeNull()
    expect(validateSlabs([{ upTo: null, rate: 3 }, { upTo: null, rate: 5 }])).not.toBeNull()
    expect(calcElectricityBill({ units: 10, slabs: [{ upTo: 100, rate: 3 }] })).toBeNull()
    expect(calcElectricityBill({ units: NaN, slabs })).toBeNull()
  })
  it('prices appliances', () => {
    // 1500 W, 2 h a day, 30 days = 90 kWh, at 8 per kWh = 720
    const a = applianceCost(1500, 2, 30, 8)!
    expect(a.kwh).toBeCloseTo(90, 9)
    expect(a.cost).toBeCloseTo(720, 9)
    expect(applianceCost(100, 25, 1, 1)).toBeNull()
    expect(applianceCost(NaN, 1, 1, 1)).toBeNull()
    expect(applianceCost(100, 10, 10, 5, 2)!.kwh).toBeCloseTo(20, 9)
  })
})

describe('time zones', () => {
  it('reads offsets including half-hour zones', () => {
    const t = Date.UTC(2025, 5, 1, 6, 30)
    expect(zonedParts('Asia/Kolkata', t)).toMatchObject({ hour: 12, minute: 0, offsetMin: 330 })
    expect(zonedParts('America/New_York', Date.UTC(2025, 6, 1, 16, 0))).toMatchObject({ hour: 12, offsetMin: -240 })
    expect(zonedParts('America/New_York', Date.UTC(2025, 0, 1, 17, 0))).toMatchObject({ hour: 12, offsetMin: -300 })
    expect(zonedParts('Bad/Zone', t)).toBeNull()
    expect(zonedParts('UTC', NaN)).toBeNull()
  })
  it('does not report hour 24 at midnight', () => {
    expect(zonedParts('UTC', Date.UTC(2025, 0, 1, 0, 0))!.hour).toBe(0)
  })
  it('converts Kolkata wall time to UTC', () => {
    const r = zonedToUtc('Asia/Kolkata', 2025, 6, 1, 12, 0)!
    expect(r.status).toBe('ok')
    expect(r.utcMs).toBe(Date.UTC(2025, 5, 1, 6, 30))
  })
  it('moves a spring-forward gap time ahead', () => {
    const r = zonedToUtc('America/New_York', 2025, 3, 9, 2, 30)!
    expect(r.status).toBe('gap')
    expect(r.utcMs).toBe(Date.UTC(2025, 2, 9, 7, 30))
    expect(zonedParts('America/New_York', r.utcMs)).toMatchObject({ hour: 3, minute: 30 })
  })
  it('takes the first occurrence in a fall-back overlap', () => {
    const r = zonedToUtc('America/New_York', 2025, 11, 2, 1, 30)!
    expect(r.status).toBe('overlap')
    expect(r.utcMs).toBe(Date.UTC(2025, 10, 2, 5, 30))
  })
  it('is plain around the transition days', () => {
    expect(zonedToUtc('America/New_York', 2025, 3, 9, 1, 59)!.status).toBe('ok')
    expect(zonedToUtc('America/New_York', 2025, 3, 9, 3, 0)!.utcMs).toBe(Date.UTC(2025, 2, 9, 7, 0))
    expect(zonedToUtc('America/New_York', 2025, 11, 2, 2, 0)!.utcMs).toBe(Date.UTC(2025, 10, 2, 7, 0))
  })
  it('handles Southern Hemisphere DST and UTC', () => {
    expect(zonedToUtc('Australia/Sydney', 2025, 1, 15, 12, 0)!.utcMs).toBe(Date.UTC(2025, 0, 15, 1, 0))
    expect(zonedToUtc('UTC', 2025, 1, 15, 12, 0)!.utcMs).toBe(Date.UTC(2025, 0, 15, 12, 0))
  })
  it('round-trips wall time through zones', () => {
    for (const z of ['Asia/Kolkata', 'Asia/Kathmandu', 'Europe/London', 'America/Los_Angeles', 'Pacific/Auckland']) {
      const r = zonedToUtc(z, 2025, 8, 20, 10, 15)!
      expect(zonedParts(z, r.utcMs)).toMatchObject({ year: 2025, month: 8, day: 20, hour: 10, minute: 15 })
    }
  })
  it('computes day difference and labels', () => {
    const utc = Date.UTC(2025, 0, 1, 22, 0)
    const src = zonedParts('UTC', utc)!
    expect(dayDifference(src, zonedParts('Asia/Tokyo', utc)!)).toBe(1)
    expect(dayDifference(src, zonedParts('Pacific/Honolulu', utc)!)).toBe(0)
    expect(dayDifference(src, zonedParts('Pacific/Honolulu', Date.UTC(2025, 0, 1, 5, 0))!)).toBe(-1)
    expect(dayDiffLabel(0)).toBe('Same day')
    expect(dayDiffLabel(1)).toBe('+1 day')
    expect(dayDiffLabel(-2)).toBe('-2 days')
  })
  it('formats offsets and parses inputs', () => {
    expect(formatOffset(330)).toBe('UTC+5:30')
    expect(formatOffset(-300)).toBe('UTC-5')
    expect(formatOffset(0)).toBe('UTC+0')
    expect(formatOffset(-210)).toBe('UTC-3:30')
    expect(parseLocalInput('2025-03-09T02:30')).toEqual({ year: 2025, month: 3, day: 9, hour: 2, minute: 30 })
    expect(parseLocalInput('')).toBeNull()
    expect(parseLocalInput('2025-13-09T02:30')).toBeNull()
  })
  it('lists and filters zones', () => {
    expect(listZones().length).toBeGreaterThan(10)
    expect(FALLBACK_ZONES.every(isValidZone)).toBe(true)
    expect(isValidZone('Nope/Nowhere')).toBe(false)
    expect(filterZones(FALLBACK_ZONES, 'new york')).toEqual(['America/New_York'])
    expect(filterZones(FALLBACK_ZONES, 'zzzz')).toEqual([])
    expect(filterZones(FALLBACK_ZONES, '', 3)).toHaveLength(3)
  })
  it('builds a meeting grid', () => {
    const g = meetingGrid('UTC', ['UTC', 'Asia/Kolkata'], 2025, 1, 15)!
    expect(g.rows).toHaveLength(2)
    expect(g.rows[0].cells.filter((c) => c.friendly)).toHaveLength(9)
    expect(g.rows[1].cells[4]).toMatchObject({ hour: 9, minute: 30, friendly: true, dayOffset: 0 })
    expect(g.rows[1].cells[3].friendly).toBe(false)
    expect(g.rows[1].cells[20]).toMatchObject({ hour: 1, minute: 30, dayOffset: 1 })
    expect(g.sharedHours).toBe(4)
    expect(meetingGrid('Bad/Zone', ['UTC'], 2025, 1, 15)).toBeNull()
  })
})

describe('zodiac', () => {
  it('finds signs at the boundaries', () => {
    expect(westernSign(3, 21)!.name).toBe('Aries')
    expect(westernSign(3, 20)!.name).toBe('Pisces')
    expect(westernSign(12, 31)!.name).toBe('Capricorn')
    expect(westernSign(1, 1)!.name).toBe('Capricorn')
    expect(westernSign(1, 19)!.name).toBe('Capricorn')
    expect(westernSign(1, 20)!.name).toBe('Aquarius')
    expect(westernSign(2, 29)!.name).toBe('Pisces')
    expect(westernSign(7, 23)!.name).toBe('Leo')
    expect(westernSign(13, 1)).toBeNull()
  })
  it('gives every day of a leap year exactly one sign', () => {
    for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(Date.UTC(2024, m, 0)).getUTCDate(); d++) expect(westernSign(m, d)).not.toBeNull()
  })
  it('returns element, modality and ruler', () => {
    expect(westernSign(8, 1)).toMatchObject({ name: 'Leo', element: 'Fire', modality: 'Fixed', ruler: 'Sun' })
    expect(westernSign(11, 1)).toMatchObject({ name: 'Scorpio', ruler: 'Pluto', traditionalRuler: 'Mars' })
  })
  it('validates dates', () => {
    expect(isValidDate(2024, 2, 29)).toBe(true)
    expect(isValidDate(2023, 2, 29)).toBe(false)
    expect(isValidDate(2024, 4, 31)).toBe(false)
    expect(isValidDate(2024, 0, 1)).toBe(false)
    expect(isValidDate(2024.5, 1, 1)).toBe(false)
  })
  it('gives birthstones', () => {
    expect(birthstone(1)!.modern).toBe('Garnet')
    expect(birthstone(8)).toMatchObject({ modern: 'Peridot', traditional: 'Sardonyx' })
    expect(birthstone(0)).toBeNull()
  })
  it('computes animals and elements', () => {
    expect(animalOfYear(2024)).toBe('Dragon')
    expect(animalOfYear(1999)).toBe('Rabbit')
    expect(animalOfYear(1984)).toBe('Rat')
    expect(animalOfYear(4)).toBe('Rat')
    expect(elementOfYear(2024)).toBe('Wood')
    expect(elementOfYear(1990)).toBe('Metal')
    expect(elementOfYear(2021)).toBe('Metal')
  })
  it('uses Chinese New Year dates', () => {
    expect(chineseZodiac(2000, 2, 4)!.animal).toBe('Rabbit')
    expect(chineseZodiac(2000, 2, 5)!.animal).toBe('Dragon')
    expect(chineseZodiac(2024, 1, 15)!.animal).toBe('Rabbit')
    expect(chineseZodiac(2024, 2, 10)!.animal).toBe('Dragon')
    expect(chineseZodiac(2024, 12, 31)!.animal).toBe('Dragon')
    expect(chineseZodiac(2025, 1, 28)!.animal).toBe('Dragon')
    expect(chineseZodiac(2025, 1, 29)!.animal).toBe('Snake')
  })
  it('flags years without a known date when the birth is near New Year', () => {
    const early = chineseZodiac(1985, 2, 1)!
    expect(early.uncertain).toBe(true)
    expect(early.animal).toBe('Ox')
    expect(early.alternative!.animal).toBe('Rat')
    expect(chineseZodiac(1985, 6, 1)!.uncertain).toBe(false)
    expect(chineseZodiac(1985, 1, 10)!.animal).toBe('Rat')
    expect(chineseZodiac(2031, 2, 22)!.animal).toBe('Pig')
    expect(chineseZodiac(2023, 2, 30)).toBeNull()
  })
  it('keeps every table date inside the possible range', () => {
    const years = Object.keys(CNY_DATES).map(Number)
    expect(years).toHaveLength(37)
    for (const y of years) {
      const [m, d] = CNY_DATES[y]
      const md = m * 100 + d
      expect(md).toBeGreaterThanOrEqual(121)
      expect(md).toBeLessThanOrEqual(220)
    }
  })
  it('matches the browser Chinese calendar when available', () => {
    let f: Intl.DateTimeFormat
    try {
      f = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' })
    } catch {
      return
    }
    for (const y of Object.keys(CNY_DATES).map(Number)) {
      const [m, d] = CNY_DATES[y]
      const parts = Object.fromEntries(f.formatToParts(new Date(Date.UTC(y, m - 1, d, 4))).map((p) => [p.type, p.value]))
      // Skip silently if this runtime has no Chinese calendar data
      if (parts.month === String(m)) return
      expect(parts.month).toBe('1')
      expect(parts.day).toBe('1')
    }
  })
})
