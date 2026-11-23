import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Alert, Badge } from '@/components/ui/misc'
import { Field, Input } from '@/components/ui/fields'
import {
  BIRTHSTONES,
  CNY_DATES,
  CNY_FIRST_YEAR,
  CNY_LAST_YEAR,
  FALLBACK_ZONES,
  MONTH_NAMES,
  SIGNS,
  animalOfYear,
  birthstone,
  chineseZodiac,
  dayDiffLabel,
  dayDifference,
  filterZones,
  formatDate,
  formatOffset,
  formatTime,
  isCuspDate,
  isValidDate,
  isValidZone,
  listZones,
  localZone,
  meetingGrid,
  parseLocalInput,
  toLocalInput,
  westernSign,
  zoneLabel,
  zonedParts,
  zonedToUtc,
} from '@/lib/utilities/batchG'

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">{children}</p>
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-1.5">
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

// ───────────── Time zone converter ─────────────
const DEFAULT_TARGETS = ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo']

function ZonePicker({ zones, now, onPick, exclude, label }: { zones: string[]; now: number; onPick: (z: string) => void; exclude: string[]; label: string }) {
  const [q, setQ] = useState('')
  const matches = useMemo(() => filterZones(zones, q, 40).filter((z) => !exclude.includes(z)).slice(0, 8), [zones, q, exclude])
  return (
    <div className="space-y-2">
      <Field label={label}>{(id) => <Input id={id} type="search" value={q} placeholder="Search, e.g. Paris, Kolkata, New York" onChange={(e) => setQ(e.target.value)} />}</Field>
      {matches.length > 0 ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {matches.map((z) => {
            const p = zonedParts(z, now)
            return (
              <li key={z}>
                <button type="button" onClick={() => { onPick(z); setQ('') }} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5 text-left text-sm hover:bg-surface">
                  <span className="truncate">{z.replace(/_/g, ' ')}</span>
                  <span className="tabular shrink-0 text-xs text-muted">{p ? formatOffset(p.offsetMin) : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">No matching time zone.</p>
      )}
    </div>
  )
}

export function TimeZoneConverter() {
  const [ready, setReady] = useState(false)
  const [zones, setZones] = useState<string[]>(FALLBACK_ZONES)
  const [now, setNow] = useState(0)
  const [source, setSource] = useState('UTC')
  const [dt, setDt] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [changingSource, setChangingSource] = useState(false)
  const [adding, setAdding] = useState(false)

  // Read the clock and the browser zone list only after mount, so prerendering stays deterministic.
  useEffect(() => {
    const list = listZones()
    const local = localZone()
    const t = Date.now()
    const p = zonedParts(local, t)
    setZones(list)
    setNow(t)
    setSource(local)
    if (p) setDt(toLocalInput(p))
    setTargets(DEFAULT_TARGETS.filter((z) => z !== local && list.includes(z)).slice(0, 3))
    setReady(true)
  }, [])

  // One tick per second, aligned to the next whole second of the clock so it does not drift.
  useEffect(() => {
    if (!ready) return
    let timer = 0
    const tick = () => {
      setNow(Date.now())
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    }
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    return () => window.clearTimeout(timer)
  }, [ready])

  const parsed = useMemo(() => parseLocalInput(dt), [dt])
  const resolved = useMemo(() => (parsed && isValidZone(source) ? zonedToUtc(source, parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute) : null), [parsed, source])
  const srcParts = resolved ? zonedParts(source, resolved.utcMs) : null
  const allZones = useMemo(() => [source, ...targets], [source, targets])
  const grid = useMemo(() => (parsed ? meetingGrid(source, allZones, parsed.year, parsed.month, parsed.day) : null), [parsed, source, allZones])
  const gridStart = parsed ? zonedToUtc(source, parsed.year, parsed.month, parsed.day, 0, 0) : null
  const selectedCell = resolved && gridStart ? Math.floor((resolved.utcMs - gridStart.utcMs) / 3600000) : -1

  const setNowInSource = () => {
    const t = Date.now()
    const p = zonedParts(source, t)
    if (p) setDt(toLocalInput(p))
  }

  const lines = resolved && srcParts
    ? targets.map((z) => {
        const p = zonedParts(z, resolved.utcMs)
        return p ? `${zoneLabel(z)}: ${formatDate(p)} ${formatTime(p)} (${formatOffset(p.offsetMin)}, ${dayDiffLabel(dayDifference(srcParts, p))})` : ''
      })
    : []
  const summary = srcParts ? [`${zoneLabel(source)}: ${formatDate(srcParts)} ${formatTime(srcParts)} (${formatOffset(srcParts.offsetMin)})`, ...lines].join('\n') : ''

  if (!ready) return <Empty>Loading your time zone...</Empty>

  return (
    <div className="space-y-5">
      <Panel title="World clock">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Current time in each zone">
          {allZones.map((z) => {
            const p = zonedParts(z, now)
            return (
              <li key={z} className="rounded-xl bg-surface px-3 py-2">
                <p className="truncate text-xs text-muted">{zoneLabel(z)}</p>
                <p className="tabular text-lg font-semibold tracking-tight">{p ? formatTime(p, true) : '--:--:--'}</p>
                <p className="tabular text-xs text-muted">{p ? `${formatDate(p)}, ${formatOffset(p.offsetMin)}` : ''}</p>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Convert a date and time">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={`Date and time in ${source.replace(/_/g, ' ')}`}>{(id) => <Input id={id} type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />}</Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={setNowInSource}>Now</Button>
            <Button variant="ghost" onClick={() => setChangingSource((v) => !v)}>{changingSource ? 'Close' : 'Change source zone'}</Button>
          </div>
        </div>
        {changingSource ? (
          <div className="mt-4">
            <ZonePicker zones={zones} now={now} exclude={[source]} label="Search source time zone" onPick={(z) => { setSource(z); setChangingSource(false) }} />
          </div>
        ) : null}
        {resolved?.status === 'gap' ? (
          <Alert tone="warn" className="mt-4" title="This time does not exist">
            Clocks in {source.replace(/_/g, ' ')} skip over it on that date for daylight saving. The conversion uses the time after the jump, shown as {srcParts ? formatTime(srcParts) : ''}.
          </Alert>
        ) : null}
        {resolved?.status === 'overlap' ? (
          <Alert tone="info" className="mt-4" title="This time happens twice">
            Clocks in {source.replace(/_/g, ' ')} repeat this hour when daylight saving ends. The conversion uses the first of the two.
          </Alert>
        ) : null}
      </Panel>

      <Panel
        title="Converted times"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : 'Add zone'}</Button>
            <CopyButton text={summary} label="Copy" disabled={!summary} />
          </>
        }
      >
        {adding ? (
          <div className="mb-4">
            <ZonePicker zones={zones} now={now} exclude={allZones} label="Search time zones to add" onPick={(z) => setTargets((t) => [...t, z])} />
          </div>
        ) : null}
        {!resolved || !srcParts ? (
          <Empty>Pick a valid date and time to see it in other zones.</Empty>
        ) : targets.length === 0 ? (
          <Empty>Add a time zone to compare.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {targets.map((z) => {
              const p = zonedParts(z, resolved.utcMs)
              if (!p) return null
              const diff = dayDifference(srcParts, p)
              return (
                <li key={z} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{zoneLabel(z)}</p>
                    <p className="text-xs text-muted">{z} · {formatOffset(p.offsetMin)}</p>
                  </div>
                  <div className="tabular text-right">
                    <p className="font-semibold">{formatTime(p)}</p>
                    <p className="text-xs text-muted">{formatDate(p)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={diff === 0 ? 'neutral' : 'accent'}>{dayDiffLabel(diff)}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setTargets((t) => t.filter((x) => x !== z))} aria-label={`Remove ${zoneLabel(z)}`}>Remove</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Meeting planner">
        {grid ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Hours of {parsed ? `${parsed.day}/${parsed.month}/${parsed.year}` : 'the chosen day'} in the source zone, with the local hour in every zone. Green cells are 9:00 to 18:00 local.{' '}
              {grid.sharedHours > 0 ? `${grid.sharedHours} hour${grid.sharedHours === 1 ? '' : 's'} work for everyone.` : 'No hour is inside working time for every zone.'}
            </p>
            <div className="overflow-x-auto">
              <table className="tabular border-separate border-spacing-0.5 text-center text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 bg-paper pr-2 text-left font-medium text-muted">Zone</th>
                    {Array.from({ length: 24 }, (_, i) => (
                      <th key={i} scope="col" className={`px-1 font-normal text-muted ${i === selectedCell ? 'text-ink' : ''}`}>{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((r) => (
                    <tr key={r.zone}>
                      <th scope="row" className="sticky left-0 whitespace-nowrap bg-paper pr-2 text-left font-medium">{zoneLabel(r.zone)}</th>
                      {r.cells.map((c, i) => (
                        <td
                          key={i}
                          title={`${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}${c.dayOffset !== 0 ? ` (${dayDiffLabel(c.dayOffset)})` : ''}${c.friendly ? ', meeting friendly' : ''}`}
                          className={`h-7 min-w-7 rounded px-1 ${c.friendly ? 'bg-accent-tint text-accent' : 'bg-surface-2 text-muted'} ${i === selectedCell ? 'outline-2 outline-ink' : ''}`}
                        >
                          {c.hour}
                          {c.minute ? <span className="text-[9px]">:{String(c.minute).padStart(2, '0')}</span> : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Column numbers are the hour in the source zone. An outlined cell is your chosen time.</p>
          </>
        ) : (
          <Empty>Pick a valid date to see the planner.</Empty>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Zodiac ─────────────
const pad2 = (n: number) => String(n).padStart(2, '0')

export function ZodiacSignFinder() {
  const [date, setDate] = useState('')
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const y = m ? Number(m[1]) : NaN
  const mo = m ? Number(m[2]) : NaN
  const d = m ? Number(m[3]) : NaN
  const valid = m !== null && isValidDate(y, mo, d)
  const sign = valid ? westernSign(mo, d) : null
  const stone = valid ? birthstone(mo) : null
  const cn = valid ? chineseZodiac(y, mo, d) : null

  return (
    <div className="space-y-5">
      <Alert title="For fun only">Zodiac signs, birthstones and Chinese zodiac animals are cultural traditions. They do not predict personality or events.</Alert>
      <Panel title="Your birth date">
        <div className="max-w-xs">
          <Field label="Date of birth">{(id) => <Input id={id} type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        {date !== '' && !valid ? <p className="mt-2 text-sm text-danger">That date is not valid.</p> : null}
      </Panel>

      {sign && stone && cn ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Western zodiac">
            <p className="text-3xl" aria-hidden>{sign.symbol}</p>
            <p className="text-xl font-semibold">{sign.name}</p>
            <p className="text-sm text-muted">{MONTH_NAMES[sign.start[0] - 1]} {sign.start[1]} to {MONTH_NAMES[sign.end[0] - 1]} {sign.end[1]}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted">Element</dt><dd className="font-medium">{sign.element}</dd></div>
              <div><dt className="text-xs text-muted">Modality</dt><dd className="font-medium">{sign.modality}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted">Ruling planet</dt><dd className="font-medium">{sign.ruler}{sign.traditionalRuler ? ` (traditional: ${sign.traditionalRuler})` : ''}</dd></div>
            </dl>
            {isCuspDate(mo, d) ? <p className="mt-3 text-xs text-muted">You were born on a boundary day. The sign can change by a day depending on the year and the source, so check an ephemeris for your exact birth time.</p> : null}
          </Panel>
          <Panel title={`Birthstone for ${MONTH_NAMES[mo - 1]}`}>
            <p className="text-xl font-semibold">{stone.modern}</p>
            <p className="text-sm text-muted">Modern list{stone.alternates ? `, also listed: ${stone.alternates}` : ''}</p>
            <p className="mt-3 text-sm">Traditional list: <span className="font-medium">{stone.traditional}</span></p>
            <p className="mt-3 text-xs text-muted">Birthstone lists vary by country, jeweller and century. This is one common US version.</p>
          </Panel>
          <Panel title="Chinese zodiac">
            <p className="text-xl font-semibold">{cn.element} {cn.animal}</p>
            <p className="text-sm text-muted">Chinese year {cn.chineseYear}</p>
            {cn.newYear ? <p className="mt-3 text-sm">Chinese New Year in {y}: {MONTH_NAMES[cn.newYear[0] - 1]} {cn.newYear[1]}.</p> : null}
            {cn.uncertain && cn.alternative ? (
              <p className="mt-3 text-sm">
                This date is close to Chinese New Year, which falls between late January and mid February. If you were born before it, your animal is {cn.alternative.element} {cn.alternative.animal} ({cn.alternative.chineseYear}). Look up the New Year date for {y}.
              </p>
            ) : null}
            {!cn.newYear && !cn.uncertain ? <p className="mt-3 text-xs text-muted">The built-in table covers {CNY_FIRST_YEAR} to {CNY_LAST_YEAR}. This date falls clearly before or after the New Year range for its year.</p> : null}
          </Panel>
        </div>
      ) : (
        <Empty>Pick your date of birth to see your signs.</Empty>
      )}

      <Panel title="Western zodiac date ranges">
        <p className="mb-3 text-sm text-muted">Common tropical dates. The Sun enters each sign at a slightly different moment each year, so cusp dates can shift by a day between years and sources.</p>
        <Table
          head={['Sign', 'Dates', 'Element', 'Modality', 'Ruling planet']}
          rows={SIGNS.map((s) => [`${s.symbol} ${s.name}`, `${MONTH_NAMES[s.start[0] - 1].slice(0, 3)} ${s.start[1]} to ${MONTH_NAMES[s.end[0] - 1].slice(0, 3)} ${s.end[1]}`, s.element, s.modality, s.traditionalRuler ? `${s.ruler} (${s.traditionalRuler})` : s.ruler])}
        />
      </Panel>

      <Panel title="Birthstones by month">
        <Table head={['Month', 'Modern', 'Traditional']} rows={BIRTHSTONES.map((b, i) => [MONTH_NAMES[i], b.alternates ? `${b.modern} (also ${b.alternates})` : b.modern, b.traditional])} />
      </Panel>

      <Panel title={`Chinese New Year dates, ${CNY_FIRST_YEAR} to ${CNY_LAST_YEAR}`}>
        <p className="mb-3 text-sm text-muted">If you were born before the New Year date in your birth year, your animal is the one from the previous year. The date is always between late January and mid February.</p>
        <Table
          head={['Year', 'New Year date', 'Animal']}
          rows={Object.keys(CNY_DATES).map(Number).map((yr) => [String(yr), `${MONTH_NAMES[CNY_DATES[yr][0] - 1]} ${pad2(CNY_DATES[yr][1])}`, animalOfYear(yr)])}
        />
      </Panel>
    </div>
  )
}
