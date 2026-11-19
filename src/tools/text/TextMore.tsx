import { useMemo, useState } from 'react'
import { TextBox } from '@/components/tools/TextBox'
import { Panel } from '@/components/tools/controls'
import { Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import {
  caesar,
  checkPalindrome,
  easeLabel,
  keywordDensity,
  linesToList,
  listToLines,
  readability,
  repeatText,
  REPEAT_MAX_CHARS,
} from '@/lib/text/more'

// ───────────── Caesar cipher / ROT13 ─────────────
export function CaesarCipher() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [shift, setShift] = useState(13)
  const [all, setAll] = useState(false)
  const out = useMemo(() => caesar(text, mode === 'encode' ? shift : -shift), [text, mode, shift])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Segmented label="Direction" value={mode} onChange={setMode} options={[{ value: 'encode', label: 'Encrypt' }, { value: 'decode', label: 'Decrypt' }]} />
          <Field label={`Shift: ${shift}`}>
            {(id) => <input id={id} type="range" min={1} max={25} value={shift} onChange={(e) => setShift(Number(e.target.value))} className="w-56 accent-[var(--color-accent)]" />}
          </Field>
          <button type="button" className="h-9 cursor-pointer rounded-lg bg-surface-2 px-3 text-sm font-medium hover:text-accent" onClick={() => setShift(13)}>ROT13</button>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label={mode === 'encode' ? 'Plain text' : 'Cipher text'} value={text} onChange={setText} rows={9} placeholder="Hello, World!" paste clear /></Panel>
        <Panel><TextBox label="Result" value={out} readOnly rows={9} copy /></Panel>
      </div>
      <Panel title="All 25 shifts" actions={<Switch checked={all} onChange={setAll} label="Show" />}>
        {all ? (
          <ul className="max-h-80 space-y-1 overflow-auto font-mono text-[13px]">
            {Array.from({ length: 25 }, (_, i) => i + 1).map((s) => (
              <li key={s} className="flex gap-3 rounded-md bg-surface-2 px-3 py-1.5"><span className="tabular w-6 shrink-0 text-muted">{s}</span><span className="break-all">{caesar(text, s) || '…'}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Useful for cracking a message when you do not know the shift.</p>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Text repeater ─────────────
const SEPARATORS = { none: '', space: ' ', newline: '\n', comma: ', ' } as const

export function TextRepeater() {
  const [text, setText] = useState('')
  const [count, setCount] = useState(5)
  const [sep, setSep] = useState<keyof typeof SEPARATORS>('newline')
  const r = useMemo(() => repeatText(text, count, SEPARATORS[sep]), [text, count, sep])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Repeat times" className="w-32">
            {(id) => <Input id={id} type="number" min={1} max={100000} value={count} onChange={(e) => setCount(Math.min(100000, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Field label="Separator">
            {() => <Segmented label="Separator" value={sep} onChange={setSep} options={[{ value: 'newline', label: 'New line' }, { value: 'space', label: 'Space' }, { value: 'comma', label: 'Comma' }, { value: 'none', label: 'None' }]} />}
          </Field>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Text to repeat" value={text} onChange={setText} rows={8} placeholder="Type a word or sentence" paste clear /></Panel>
        <Panel><TextBox label="Result" value={r.output} readOnly rows={8} copy hint={r.truncated ? `Output was cut at ${REPEAT_MAX_CHARS.toLocaleString()} characters.` : undefined} /></Panel>
      </div>
    </div>
  )
}

// ───────────── List ⇄ comma-separated ─────────────
const DELIMS = { comma: ', ', semicolon: '; ', pipe: ' | ', space: ' ', tab: '\t' } as const

export function ListConverter() {
  const [dir, setDir] = useState<'join' | 'split'>('join')
  const [text, setText] = useState('')
  const [delim, setDelim] = useState<keyof typeof DELIMS>('comma')
  const [quote, setQuote] = useState<'' | "'" | '"'>('')
  const [trim, setTrim] = useState(true)
  const [removeEmpty, setRemoveEmpty] = useState(true)
  const [unique, setUnique] = useState(false)
  const out = useMemo(
    () =>
      dir === 'join'
        ? linesToList(text, { separator: DELIMS[delim], quote, trim, removeEmpty, unique })
        : listToLines(text, DELIMS[delim].trim() === '' ? DELIMS[delim] : DELIMS[delim].trim(), { trim, removeEmpty, unique, unquote: true }),
    [dir, text, delim, quote, trim, removeEmpty, unique],
  )
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'join', label: 'List to comma-separated' }, { value: 'split', label: 'Comma-separated to list' }]} />
          <Segmented label="Delimiter" value={delim} onChange={setDelim} options={[{ value: 'comma', label: 'Comma' }, { value: 'semicolon', label: 'Semicolon' }, { value: 'pipe', label: 'Pipe' }, { value: 'space', label: 'Space' }, { value: 'tab', label: 'Tab' }]} />
          {dir === 'join' && (
            <Segmented label="Wrap items in" value={quote} onChange={setQuote} options={[{ value: '', label: 'No quotes' }, { value: "'", label: "'single'" }, { value: '"', label: '"double"' }]} />
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={trim} onChange={setTrim} label="Trim spaces" />
          <Switch checked={removeEmpty} onChange={setRemoveEmpty} label="Skip empty items" />
          <Switch checked={unique} onChange={setUnique} label="Remove duplicates" />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label={dir === 'join' ? 'List, one item per line' : 'Delimited text'} value={text} onChange={setText} rows={12} paste clear /></Panel>
        <Panel><TextBox label={dir === 'join' ? 'Delimited text' : 'One item per line'} value={out} readOnly rows={12} copy /></Panel>
      </div>
    </div>
  )
}

// ───────────── Palindrome checker ─────────────
export function PalindromeChecker() {
  const [text, setText] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(true)
  const [ignoreSpacesPunctuation, setIgnore] = useState(true)
  const r = useMemo(() => checkPalindrome(text, { ignoreCase, ignoreSpacesPunctuation }), [text, ignoreCase, ignoreSpacesPunctuation])
  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={ignoreCase} onChange={setIgnoreCase} label="Ignore case" />
          <Switch checked={ignoreSpacesPunctuation} onChange={setIgnore} label="Ignore spaces and punctuation" />
        </div>
        <TextBox label="Word or phrase" value={text} onChange={setText} rows={4} placeholder="A man, a plan, a canal: Panama" paste clear />
      </Panel>
      <Panel title="Result">
        {!text.trim() ? (
          <p className="text-sm text-muted">Enter a word or phrase to check it.</p>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <Badge tone={r.isPalindrome ? 'accent' : 'danger'}>{r.isPalindrome ? 'Yes, it is a palindrome' : 'No, it is not a palindrome'}</Badge>
            <p className="text-sm text-ink-2">Compared as: <span className="break-all font-mono">{r.normalized || '(nothing left to compare)'}</span></p>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Readability ─────────────
export function ReadabilityChecker() {
  const [text, setText] = useState('')
  const r = useMemo(() => readability(text), [text])
  return (
    <div className="space-y-5">
      <Panel><TextBox label="Your text" value={text} onChange={setText} rows={12} placeholder="Paste at least a few sentences for a reliable score…" paste clear /></Panel>
      {r ? (
        <div className="space-y-4" aria-live="polite">
          <Panel title="Flesch reading ease">
            <p className="tabular text-4xl font-semibold">{r.fleschEase.toFixed(1)}</p>
            <p className="mt-1 text-ink-2">{easeLabel(r.fleschEase)}</p>
            {r.words < 100 && <p className="mt-3 text-xs text-muted">Scores are most reliable with 100 words or more.</p>}
          </Panel>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Flesch-Kincaid grade" value={r.fleschKincaid.toFixed(1)} />
            <Stat label="Gunning fog" value={r.gunningFog.toFixed(1)} />
            <Stat label="Coleman-Liau" value={r.colemanLiau.toFixed(1)} />
            <Stat label="Automated readability" value={r.ari.toFixed(1)} />
            <Stat label="Average grade" value={r.averageGrade.toFixed(1)} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Words" value={r.words.toLocaleString()} />
            <Stat label="Sentences" value={r.sentences.toLocaleString()} />
            <Stat label="Syllables" value={r.syllables.toLocaleString()} />
            <Stat label="Words per sentence" value={(r.words / r.sentences).toFixed(1)} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Paste some text to see its reading level.</p>
      )}
    </div>
  )
}

// ───────────── Keyword density ─────────────
export function KeywordDensity() {
  const [text, setText] = useState('')
  const [size, setSize] = useState<1 | 2 | 3>(1)
  const [skip, setSkip] = useState(true)
  const [minCount, setMinCount] = useState(2)
  const { rows, totalWords } = useMemo(() => keywordDensity(text, { size, skipStopWords: skip, minCount }), [text, size, skip, minCount])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Segmented label="Phrase length" value={size} onChange={setSize} options={[{ value: 1, label: '1 word' }, { value: 2, label: '2 words' }, { value: 3, label: '3 words' }]} />
          <Field label="Minimum count" className="w-32">
            {(id) => <Input id={id} type="number" min={1} max={100} value={minCount} onChange={(e) => setMinCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Switch checked={skip} onChange={setSkip} label="Skip common words (the, and, of…)" />
        </div>
      </Panel>
      <Panel><TextBox label="Your text" value={text} onChange={setText} rows={10} placeholder="Paste your article or page copy…" paste clear /></Panel>
      <Panel title="Keywords" actions={<span className="text-sm text-ink-2" aria-live="polite">{totalWords.toLocaleString()} words</span>}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{text.trim() ? 'No phrase appears often enough. Lower the minimum count.' : 'Paste text to see which phrases you use most.'}</p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted"><tr><th className="px-3 py-2">Phrase</th><th className="px-3 py-2">Count</th><th className="px-3 py-2">Density</th></tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.phrase} className="border-t border-line"><td className="px-3 py-1.5 font-medium">{r.phrase}</td><td className="tabular px-3 py-1.5">{r.count}</td><td className="tabular px-3 py-1.5">{r.percent.toFixed(2)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
