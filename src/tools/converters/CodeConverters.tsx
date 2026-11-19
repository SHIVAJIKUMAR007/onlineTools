import { useMemo, useState } from 'react'
import { TextBox } from '@/components/tools/TextBox'
import { Panel } from '@/components/tools/controls'
import { Alert } from '@/components/ui/misc'
import { Field, Input, Segmented } from '@/components/ui/fields'
import { morseToText, numberToRoman, romanToNumber, ROMAN_MAX, textToMorse } from '@/lib/conversion/codes'

// ───────────── Morse code ─────────────
export function MorseConverter() {
  const [dir, setDir] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const r = useMemo(() => (dir === 'encode' ? textToMorse(input) : morseToText(input)), [dir, input])
  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4">
          <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Text to Morse' }, { value: 'decode', label: 'Morse to text' }]} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <TextBox label={dir === 'encode' ? 'Text' : 'Morse code'} value={input} onChange={setInput} rows={9} placeholder={dir === 'encode' ? 'SOS' : '... --- ...'} paste clear />
          <TextBox label={dir === 'encode' ? 'Morse code' : 'Text'} value={r.output} readOnly rows={9} copy />
        </div>
        <p className="mt-3 text-sm text-ink-2">Separate letters with a space and words with “/”.</p>
        {r.skipped.length > 0 && (
          <Alert tone="warn" className="mt-4">
            {dir === 'encode' ? 'No Morse code exists for' : 'Not recognised:'} {r.skipped.map((s) => `“${s}”`).join(', ')}. {dir === 'encode' ? 'These were left out.' : 'They show as “?”.'}
          </Alert>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Roman numerals ─────────────
const EXAMPLES = [4, 9, 14, 40, 90, 400, 1994, 2026, 3999]

export function RomanNumerals() {
  const [number, setNumber] = useState('')
  const [roman, setRoman] = useState('')

  const fromNumber = useMemo(() => {
    if (number.trim() === '') return { value: '', error: '' }
    try {
      return { value: numberToRoman(Number(number)), error: '' }
    } catch (e) {
      return { value: '', error: e instanceof Error ? e.message : 'Invalid number' }
    }
  }, [number])

  const fromRoman = useMemo(() => {
    if (roman.trim() === '') return { value: '', error: '' }
    try {
      return { value: String(romanToNumber(roman)), error: '' }
    } catch (e) {
      return { value: '', error: e instanceof Error ? e.message : 'Invalid numeral' }
    }
  }, [roman])

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Number to Roman numeral">
          <Field label={`Number (1 to ${ROMAN_MAX})`}>
            {(id) => <Input id={id} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="2026" aria-invalid={!!fromNumber.error} />}
          </Field>
          {fromNumber.error ? (
            <Alert tone="danger" className="mt-4" role="alert">{fromNumber.error}</Alert>
          ) : (
            <p className="mt-4 min-h-12 break-all text-3xl font-semibold tracking-wide" aria-live="polite">{fromNumber.value || <span className="text-base font-normal text-muted">The result appears here.</span>}</p>
          )}
        </Panel>
        <Panel title="Roman numeral to number">
          <Field label="Roman numeral">
            {(id) => <Input id={id} value={roman} onChange={(e) => setRoman(e.target.value)} placeholder="MMXXVI" spellCheck={false} autoCapitalize="characters" aria-invalid={!!fromRoman.error} />}
          </Field>
          {fromRoman.error ? (
            <Alert tone="danger" className="mt-4" role="alert">{fromRoman.error}</Alert>
          ) : (
            <p className="mt-4 min-h-12 text-3xl font-semibold" aria-live="polite">{fromRoman.value || <span className="text-base font-normal text-muted">The result appears here.</span>}</p>
          )}
        </Panel>
      </div>
      <Panel title="Quick examples">
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 md:grid-cols-5">
          {EXAMPLES.map((n) => (
            <li key={n} className="rounded-lg bg-surface-2 px-3 py-2"><span className="tabular text-muted">{n}</span> = <span className="font-medium">{numberToRoman(n)}</span></li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
