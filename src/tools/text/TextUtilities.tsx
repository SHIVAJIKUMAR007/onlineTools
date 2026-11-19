import { useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import { Alert, Stat } from '@/components/ui/misc'
import { cleanWhitespace, findReplace, slugify, sortLines, type SortMode } from '@/lib/text/transform'

// ───────────── Sort lines ─────────────
const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: 'az', label: 'A to Z' },
  { value: 'za', label: 'Z to A' },
  { value: 'numeric', label: 'Numbers up' },
  { value: 'numeric-desc', label: 'Numbers down' },
  { value: 'length', label: 'By length' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'shuffle', label: 'Shuffle' },
]

export function SortLines() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SortMode>('az')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [removeEmpty, setRemoveEmpty] = useState(false)
  const [seed, setSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const out = useMemo(() => sortLines(text, { mode, caseSensitive, removeEmpty }), [text, mode, caseSensitive, removeEmpty, seed])
  return (
    <div className="space-y-5">
      <Panel title="Sort order">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Segmented label="Sort order" value={mode} onChange={setMode} options={SORT_MODES} />
          <Switch checked={caseSensitive} onChange={setCaseSensitive} label="Case sensitive" />
          <Switch checked={removeEmpty} onChange={setRemoveEmpty} label="Remove empty lines" />
          {mode === 'shuffle' && (
            <Button size="sm" variant="secondary" onClick={() => setSeed((s) => s + 1)}>
              <Shuffle className="size-4" aria-hidden /> Shuffle again
            </Button>
          )}
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Input, one item per line" value={text} onChange={setText} rows={14} placeholder={'pear\napple\nbanana'} paste clear /></Panel>
        <Panel><TextBox label="Sorted lines" value={out} readOnly rows={14} copy /></Panel>
      </div>
    </div>
  )
}

// ───────────── Find and replace ─────────────
export function FindReplace() {
  const [text, setText] = useState('')
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const r = useMemo(() => findReplace(text, find, replace, { caseSensitive, wholeWord, regex }), [text, find, replace, caseSensitive, wholeWord, regex])
  return (
    <div className="space-y-5">
      <Panel title="Find and replace">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Find">{(id) => <Input id={id} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Text to find" spellCheck={false} />}</Field>
          <Field label="Replace with">{(id) => <Input id={id} value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Leave empty to delete matches" spellCheck={false} />}</Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={caseSensitive} onChange={setCaseSensitive} label="Match case" />
          <Switch checked={wholeWord} onChange={setWholeWord} label="Whole word" />
          <Switch checked={regex} onChange={setRegex} label="Regular expression" />
        </div>
        {r.error && <Alert tone="danger" className="mt-4" role="alert">{r.error}</Alert>}
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Your text" value={text} onChange={setText} rows={12} placeholder="Paste text here…" paste clear /></Panel>
        <Panel><TextBox label="Result" value={r.output} readOnly rows={12} copy /></Panel>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-xs" aria-live="polite">
        <Stat label="Replacements" value={r.count.toLocaleString()} />
      </div>
    </div>
  )
}

// ───────────── Text to slug ─────────────
export function TextToSlug() {
  const [text, setText] = useState('')
  const [separator, setSeparator] = useState<'-' | '_'>('-')
  const [max, setMax] = useState(0)
  const lines = useMemo(() => text.split('\n').filter((l) => l.trim()), [text])
  const out = useMemo(() => lines.map((l) => slugify(l, { separator, maxLength: max || undefined })).join('\n'), [lines, separator, max])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Separator">{() => <Segmented label="Separator" value={separator} onChange={setSeparator} options={[{ value: '-', label: 'Hyphen -' }, { value: '_', label: 'Underscore _' }]} />}</Field>
          <Field label="Max length" hint="0 means no limit" className="w-32">
            {(id) => <Input id={id} type="number" min={0} max={200} value={max} onChange={(e) => setMax(Math.min(200, Math.max(0, Number(e.target.value) || 0)))} />}
          </Field>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Titles, one per line" value={text} onChange={setText} rows={8} placeholder="10 Best Résumé Tips & Tricks" paste clear /></Panel>
        <Panel><TextBox label="Slugs" value={out} readOnly rows={8} copy /></Panel>
      </div>
    </div>
  )
}

// ───────────── Remove extra spaces and line breaks ─────────────
export function CleanWhitespace() {
  const [text, setText] = useState('')
  const [collapseSpaces, setCollapseSpaces] = useState(true)
  const [trimLines, setTrimLines] = useState(true)
  const [empty, setEmpty] = useState<'keep' | 'collapse' | 'remove'>('collapse')
  const [oneLine, setOneLine] = useState(false)
  const out = useMemo(
    () => cleanWhitespace(text, { collapseSpaces, trimLines, removeEmptyLines: empty === 'remove', collapseEmptyLines: empty === 'collapse', removeLineBreaks: oneLine }),
    [text, collapseSpaces, trimLines, empty, oneLine],
  )
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Switch checked={collapseSpaces} onChange={setCollapseSpaces} label="Collapse repeated spaces" />
          <Switch checked={trimLines} onChange={setTrimLines} label="Trim each line" />
          <Switch checked={oneLine} onChange={setOneLine} label="Join into one paragraph" />
          {!oneLine && (
            <Segmented label="Blank lines" value={empty} onChange={setEmpty} options={[{ value: 'keep', label: 'Keep blank lines' }, { value: 'collapse', label: 'Limit to one' }, { value: 'remove', label: 'Remove all' }]} />
          )}
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Your text" value={text} onChange={setText} rows={12} placeholder="Paste messy text here…" paste clear /></Panel>
        <Panel><TextBox label="Cleaned text" value={out} readOnly rows={12} copy /></Panel>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md" aria-live="polite">
        <Stat label="Characters before" value={text.length.toLocaleString()} />
        <Stat label="Characters after" value={out.length.toLocaleString()} />
      </div>
    </div>
  )
}
