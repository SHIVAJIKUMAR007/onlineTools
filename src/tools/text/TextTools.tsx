import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import { Stat } from '@/components/ui/misc'
import {
  convertCase,
  formatMinutes,
  generateLorem,
  removeDuplicateLines,
  reverseText,
  textStats,
  type CaseKind,
  type LoremUnit,
  type ReverseMode,
} from '@/lib/text'
import { buildSideBySide, type DiffGranularity } from '@/lib/text/diff'
import { cn } from '@/lib/utils/cn'

// ───────────── Word counter ─────────────
export function WordCounter() {
  const [text, setText] = useState('')
  const s = useMemo(() => textStats(text), [text])
  return (
    <div className="space-y-5">
      <Panel>
        <TextBox label="Your text" value={text} onChange={setText} rows={12} placeholder="Type or paste text here…" paste clear />
      </Panel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-live="polite">
        <Stat label="Words" value={s.words.toLocaleString()} />
        <Stat label="Characters" value={s.characters.toLocaleString()} />
        <Stat label="Characters, no spaces" value={s.charactersNoSpaces.toLocaleString()} />
        <Stat label="Sentences" value={s.sentences.toLocaleString()} />
        <Stat label="Paragraphs" value={s.paragraphs.toLocaleString()} />
        <Stat label="Lines" value={s.lines.toLocaleString()} />
        <Stat label="Reading time" value={formatMinutes(s.readingMinutes)} sub="at 238 words per minute" />
        <Stat label="Speaking time" value={formatMinutes(s.speakingMinutes)} sub="at 150 words per minute" />
      </div>
    </div>
  )
}

// ───────────── Case converter ─────────────
const CASES: { kind: CaseKind; label: string }[] = [
  { kind: 'upper', label: 'UPPERCASE' },
  { kind: 'lower', label: 'lowercase' },
  { kind: 'title', label: 'Title Case' },
  { kind: 'sentence', label: 'Sentence case' },
  { kind: 'camel', label: 'camelCase' },
  { kind: 'pascal', label: 'PascalCase' },
  { kind: 'snake', label: 'snake_case' },
  { kind: 'kebab', label: 'kebab-case' },
  { kind: 'constant', label: 'CONSTANT_CASE' },
]

export function CaseConverter() {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CaseKind>('title')
  const out = useMemo(() => convertCase(text, kind), [text, kind])
  return (
    <div className="space-y-5">
      <Panel>
        <TextBox label="Your text" value={text} onChange={setText} rows={7} placeholder="Type or paste text here…" paste clear />
      </Panel>
      <Panel title="Convert to">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Case style">
          {CASES.map((c) => (
            <Button key={c.kind} role="radio" aria-checked={kind === c.kind} variant={kind === c.kind ? 'primary' : 'secondary'} size="sm" onClick={() => setKind(c.kind)}>
              {c.label}
            </Button>
          ))}
        </div>
        <TextBox label="Result" value={out} readOnly rows={7} copy />
      </Panel>
    </div>
  )
}

// ───────────── Remove duplicate lines ─────────────
export function DuplicateLines() {
  const [text, setText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(true)
  const [trim, setTrim] = useState(true)
  const [removeEmpty, setRemoveEmpty] = useState(false)
  const r = useMemo(() => removeDuplicateLines(text, { caseSensitive, trim, removeEmpty }), [text, caseSensitive, trim, removeEmpty])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={caseSensitive} onChange={setCaseSensitive} label="Case sensitive" />
          <Switch checked={trim} onChange={setTrim} label="Trim spaces around lines" />
          <Switch checked={removeEmpty} onChange={setRemoveEmpty} label="Remove empty lines" />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <TextBox label="Input, one item per line" value={text} onChange={setText} rows={14} placeholder={'apple\nbanana\napple'} paste clear />
        </Panel>
        <Panel>
          <TextBox label="Unique lines" value={r.output} readOnly rows={14} copy />
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md" aria-live="polite">
        <Stat label="Kept" value={r.kept.toLocaleString()} />
        <Stat label="Removed" value={r.removed.toLocaleString()} />
      </div>
    </div>
  )
}

// ───────────── Text diff ─────────────
export function TextDiff() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [granularity, setGranularity] = useState<DiffGranularity>('words')
  const [ignoreWs, setIgnoreWs] = useState(false)
  const diff = useMemo(() => buildSideBySide(a, b, { granularity, ignoreWhitespace: ignoreWs }), [a, b, granularity, ignoreWs])
  const empty = !a && !b

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Original" value={a} onChange={setA} rows={10} placeholder="Paste the original text" paste clear /></Panel>
        <Panel><TextBox label="Changed" value={b} onChange={setB} rows={10} placeholder="Paste the new text" paste clear /></Panel>
      </div>
      <Panel
        title="Differences"
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Highlight" value={granularity} onChange={setGranularity} options={[{ value: 'lines', label: 'Lines' }, { value: 'words', label: 'Words' }, { value: 'chars', label: 'Characters' }]} />
            <Switch checked={ignoreWs} onChange={setIgnoreWs} label="Ignore whitespace" />
          </div>
        }
      >
        {empty ? (
          <p className="text-sm text-muted">Paste text on both sides to compare.</p>
        ) : diff.identical ? (
          <p className="text-sm font-medium text-accent">The two texts are identical.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2" aria-live="polite">
              <span className="font-medium text-[#1a7f3c]">{diff.added} added</span> · <span className="font-medium text-danger">{diff.removed} removed</span> · <span className="font-medium">{diff.changed} changed</span>
            </p>
            <div className="max-h-[32rem] overflow-auto rounded-xl border border-line font-mono text-[13px] leading-6">
              <table className="w-full min-w-[40rem] table-fixed border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col />
                  <col className="w-10" />
                  <col />
                </colgroup>
                <tbody>
                  {diff.rows.map((row, i) => (
                    <tr key={i} className="align-top">
                      <Cell side={row.left} kind={row.type} left />
                      <Cell side={row.right} kind={row.type} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}

function Cell({ side, kind, left }: { side?: { no: number; segs: { text: string; changed?: boolean }[] }; kind: string; left?: boolean }) {
  const isDel = left && (kind === 'removed' || kind === 'changed')
  const isAdd = !left && (kind === 'added' || kind === 'changed')
  const bg = !side ? 'bg-surface' : isDel ? 'bg-del' : isAdd ? 'bg-add' : ''
  return (
    <>
      <td className={cn('tabular select-none border-r border-line px-2 text-right text-xs text-muted', bg)}>{side?.no}</td>
      <td className={cn('whitespace-pre-wrap break-words px-2', bg, !left && 'border-l border-line')}>
        {side?.segs.map((s, i) => (
          <span key={i} className={cn(s.changed && kind === 'changed' && (left ? 'rounded-sm bg-del-strong' : 'rounded-sm bg-add-strong'))}>
            {s.text}
          </span>
        ))}
        {side && side.segs.every((s) => s.text === '') ? ' ' : null}
      </td>
    </>
  )
}

// ───────────── Lorem ipsum ─────────────
export function LoremIpsum() {
  const [unit, setUnit] = useState<LoremUnit>('paragraphs')
  const [count, setCount] = useState(3)
  const [classic, setClassic] = useState(true)
  const [seed, setSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const out = useMemo(() => generateLorem(unit, count, { classic }), [unit, count, classic, seed])
  const max = unit === 'words' ? 2000 : unit === 'sentences' ? 200 : 50
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Generate">
            {() => <Segmented label="Unit" value={unit} onChange={(u) => { setUnit(u); setCount(u === 'words' ? 50 : u === 'sentences' ? 5 : 3) }} options={[{ value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' }, { value: 'words', label: 'Words' }]} />}
          </Field>
          <Field label="Amount" className="w-28">
            {(id) => <Input id={id} type="number" min={1} max={max} value={count} onChange={(e) => setCount(Math.min(max, Math.max(1, Number(e.target.value) || 1)))} />}
          </Field>
          <Switch checked={classic} onChange={setClassic} label="Start with “Lorem ipsum dolor sit amet”" />
          <Button variant="primary" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-4" aria-hidden /> Generate again
          </Button>
        </div>
      </Panel>
      <Panel title="Placeholder text" actions={<CopyButton text={out} />}>
        <div className="prose-plain max-h-[28rem] overflow-auto whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2" tabIndex={0} aria-label="Generated text">{out}</div>
      </Panel>
    </div>
  )
}

// ───────────── Text reverser ─────────────
export function TextReverser() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<ReverseMode>('characters')
  const out = useMemo(() => reverseText(text, mode), [text, mode])
  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4">
          <Segmented label="Reverse by" value={mode} onChange={setMode} options={[{ value: 'characters', label: 'Characters' }, { value: 'words', label: 'Word order' }, { value: 'lines', label: 'Line order' }]} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <TextBox label="Your text" value={text} onChange={setText} rows={10} placeholder="Type or paste text here…" paste clear />
          <TextBox label="Reversed" value={out} readOnly rows={10} copy />
        </div>
      </Panel>
    </div>
  )
}

