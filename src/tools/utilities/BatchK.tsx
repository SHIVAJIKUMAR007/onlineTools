import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Shuffle } from 'lucide-react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Switch, Textarea } from '@/components/ui/fields'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { cn } from '@/lib/utils/cn'
import {
  charStates,
  checkDigits,
  defaultTypingText,
  drawPrompt,
  emptyDeck,
  generateDigits,
  memoryShowMs,
  parseNames,
  pickWinners,
  randomTypingText,
  scoreTyping,
  splitTeams,
  teamCount,
  teamsToText,
  TYPING_DURATIONS,
  typingRating,
  typingSummary,
  winnersToText,
  type DeckState,
  type SplitMode,
} from '@/lib/utilities/batchK'
import { DARES, TRUTHS, WOULD_YOU_RATHER } from '@/lib/utilities/batchKPrompts'

// ───────────── Typing speed test ─────────────
type Duration = (typeof TYPING_DURATIONS)[number]

export function TypingSpeedTest() {
  const [seconds, setSeconds] = useState<Duration>(60)
  const [text, setText] = useState(() => defaultTypingText(60))
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t - startedAt >= seconds * 1000) setFinishedAt(startedAt + seconds * 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [startedAt, finishedAt, seconds])

  const done = finishedAt !== null
  const running = startedAt !== null && !done
  const elapsed = startedAt === null ? 0 : Math.min(seconds, ((finishedAt ?? Math.max(now, startedAt)) - startedAt) / 1000)
  const remaining = Math.max(0, seconds - Math.floor(elapsed))
  const score = scoreTyping(text, typed, Math.max(elapsed, 1))
  const states = charStates(text, typed)

  const reset = (secs: Duration, fresh: boolean) => {
    setSeconds(secs)
    setText(fresh ? randomTypingText(secs) : defaultTypingText(secs))
    setTyped('')
    setStartedAt(null)
    setFinishedAt(null)
    setNow(0)
    window.setTimeout(() => area.current?.focus(), 0)
  }

  const onChange = (value: string) => {
    if (done) return
    const v = value.slice(0, text.length)
    if (startedAt === null && v.length > 0) {
      const t = Date.now()
      setStartedAt(t)
      setNow(t)
    }
    setTyped(v)
    if (v.length >= text.length) setFinishedAt(Date.now())
  }

  const windowStart = Math.max(0, Math.floor((typed.length - 100) / 150) * 150)
  const windowEnd = Math.min(text.length, windowStart + 450)

  return (
    <div className="space-y-5">
      <Panel
        title="Typing test"
        actions={
          <Segmented
            label="Test length"
            value={seconds}
            onChange={(v) => reset(v, false)}
            options={TYPING_DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
          />
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="off">
          <Stat label="Time left" value={`${remaining}s`} />
          <Stat label="WPM" value={Math.round(typed ? score.wpm : 0)} />
          <Stat label="Accuracy" value={`${typed ? score.accuracy.toFixed(0) : 100}%`} />
          <Stat label="Errors" value={score.errors} />
        </div>
        <p
          className="rounded-xl bg-surface p-4 font-mono text-lg leading-relaxed text-muted"
          aria-label="Text to type"
          onClick={() => area.current?.focus()}
        >
          {states.slice(windowStart, windowEnd).map((s, k) => {
            const i = windowStart + k
            return (
              <span
                key={i}
                className={cn(
                  s === 'correct' && 'text-accent',
                  s === 'wrong' && 'rounded-sm bg-danger-tint text-danger underline',
                  i === typed.length && !done && 'rounded-sm bg-accent-tint text-ink',
                )}
              >
                {text[i]}
              </span>
            )
          })}
        </p>
        <div className="mt-4">
          <Field label={done ? 'Time is up' : running ? 'Keep typing' : 'Start typing to begin the timer'}>
            {(id) => (
              <Textarea
                id={id}
                ref={area}
                rows={3}
                value={typed}
                disabled={done}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onPaste={(e) => e.preventDefault()}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Type the text shown above"
              />
            )}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => reset(seconds, true)}>
            <RotateCcw className="size-4" aria-hidden />
            {done ? 'Try a new passage' : 'Restart with a new passage'}
          </Button>
          {typed.length > 0 && (
            <Button variant="ghost" onClick={() => reset(seconds, false)}>
              Restart same text
            </Button>
          )}
        </div>
      </Panel>
      {done && (
        <Panel title="Results" actions={<CopyButton text={typingSummary(score, seconds)} label="Copy results" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Speed (WPM)" value={Math.round(score.wpm)} sub={typingRating(score.wpm)} />
            <Stat label="Raw WPM" value={Math.round(score.rawWpm)} sub="All typed characters" />
            <Stat label="Accuracy" value={`${score.accuracy.toFixed(1)}%`} sub={`${score.correctChars} of ${score.typedChars} correct`} />
            <Stat label="Errors" value={score.errors} />
            <Stat label="Characters typed" value={score.typedChars} />
            <Stat label="Time" value={`${Math.round(elapsed)}s`} />
          </div>
        </Panel>
      )}
    </div>
  )
}

// ───────────── Random team picker ─────────────
type PickMode = 'winners' | 'teams'

export function RandomTeamPicker() {
  const [raw, setRaw] = useState('')
  const [dedupe, setDedupe] = useState(true)
  const [mode, setMode] = useState<PickMode>('winners')
  const [winnerCount, setWinnerCount] = useState('1')
  const [splitMode, setSplitMode] = useState<SplitMode>('teams')
  const [splitValue, setSplitValue] = useState('2')
  const [winners, setWinners] = useState<string[] | null>(null)
  const [teams, setTeams] = useState<string[][] | null>(null)

  const names = parseNames(raw, dedupe)
  const nWin = Math.floor(Number(winnerCount))
  const sVal = Math.floor(Number(splitValue))
  const winOk = Number.isFinite(nWin) && nWin >= 1 && nWin <= names.length
  const splitOk = teamCount(names.length, splitMode, sVal) > 0

  const run = () => {
    if (mode === 'winners') {
      if (winOk) setWinners(pickWinners(names, nWin))
    } else if (splitOk) setTeams(splitTeams(names, splitMode, sVal))
  }
  const shown = mode === 'winners' ? winners : teams
  const resultText = mode === 'winners' ? winnersToText(winners ?? []) : teamsToText(teams ?? [])

  return (
    <div className="space-y-5">
      <Panel title="Names">
        <Field label="One name per line" hint={`${names.length} name${names.length === 1 ? '' : 's'}`}>
          {(id) => <Textarea id={id} rows={8} value={raw} onChange={(e) => { setRaw(e.target.value); setWinners(null); setTeams(null) }} placeholder={'Asha\nBen\nChloe\nDev'} />}
        </Field>
        <div className="mt-3">
          <Switch checked={dedupe} onChange={setDedupe} label="Ignore duplicate names" />
        </div>
      </Panel>
      <Panel title="Pick">
        <div className="space-y-4">
          <Segmented
            label="What to do"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'winners', label: 'Pick winners' },
              { value: 'teams', label: 'Make teams' },
            ]}
          />
          {mode === 'winners' ? (
            <Field label="Number of winners" className="max-w-40">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={1} value={winnerCount} onChange={(e) => setWinnerCount(e.target.value)} />}
            </Field>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <Segmented
                label="Split by"
                value={splitMode}
                onChange={setSplitMode}
                options={[
                  { value: 'teams', label: 'Number of teams' },
                  { value: 'size', label: 'Team size' },
                ]}
              />
              <Field label={splitMode === 'teams' ? 'Teams' : 'People per team'} className="w-32">
                {(id) => <Input id={id} type="number" inputMode="numeric" min={1} value={splitValue} onChange={(e) => setSplitValue(e.target.value)} />}
              </Field>
            </div>
          )}
          {mode === 'winners' && names.length > 0 && !winOk && <Alert tone="warn">Enter a number from 1 to {names.length}.</Alert>}
          {mode === 'teams' && names.length > 0 && !splitOk && <Alert tone="warn">Enter a whole number of 1 or more.</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={run} disabled={mode === 'winners' ? !winOk : !splitOk}>
              <Shuffle className="size-4" aria-hidden />
              {shown ? 'Shuffle again' : mode === 'winners' ? 'Pick winners' : 'Make teams'}
            </Button>
          </div>
        </div>
      </Panel>
      {shown && shown.length > 0 && (
        <Panel title="Result" actions={<CopyButton text={resultText} label="Copy result" />}>
          {mode === 'winners' && winners ? (
            <ol className="list-inside list-decimal space-y-1 text-lg">
              {winners.map((w, i) => (
                <li key={i} className="font-medium">{w}</li>
              ))}
            </ol>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(teams ?? []).map((t, i) => (
                <div key={i} className="rounded-xl bg-surface p-4">
                  <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                    Team {i + 1} <Badge>{t.length}</Badge>
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {t.map((n, k) => (
                      <li key={k}>{n}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

// ───────────── Would you rather / truth or dare ─────────────
type PromptKind = 'wyr' | 'truth' | 'dare'
const LISTS: Record<PromptKind, readonly string[]> = { wyr: WOULD_YOU_RATHER, truth: TRUTHS, dare: DARES }
const KIND_LABEL: Record<PromptKind, string> = { wyr: 'Would you rather', truth: 'Truth', dare: 'Dare' }

export function WouldYouRatherGenerator() {
  const [kind, setKind] = useState<PromptKind>('wyr')
  const [decks, setDecks] = useState<Record<PromptKind, DeckState>>({ wyr: emptyDeck(), truth: emptyDeck(), dare: emptyDeck() })
  const [current, setCurrent] = useState<{ kind: PromptKind; text: string } | null>(null)
  const [left, setLeft] = useState<Record<PromptKind, number>>({ wyr: WOULD_YOU_RATHER.length, truth: TRUTHS.length, dare: DARES.length })
  const [note, setNote] = useState('')

  const draw = (k: PromptKind) => {
    const list = LISTS[k]
    const r = drawPrompt(decks[k], list.length)
    setDecks((d) => ({ ...d, [k]: r.deck }))
    setLeft((l) => ({ ...l, [k]: list.length - r.deck.pos }))
    setCurrent({ kind: k, text: list[r.index] })
    setNote(r.reshuffled ? 'You have seen every prompt in this set, so the deck was shuffled again.' : '')
  }

  const mixed = kind !== 'wyr'
  return (
    <div className="space-y-5">
      <Panel title="Prompt generator">
        <div className="space-y-4">
          <Segmented
            label="Game"
            value={mixed ? 'td' : 'wyr'}
            onChange={(v) => { setKind(v === 'wyr' ? 'wyr' : 'truth'); setCurrent(null); setNote('') }}
            options={[
              { value: 'wyr', label: 'Would you rather' },
              { value: 'td', label: 'Truth or dare' },
            ]}
          />
          <div
            className="flex min-h-40 items-center justify-center rounded-2xl bg-surface p-6 text-center"
            role="status"
            aria-live="polite"
          >
            {current ? (
              <div className="space-y-3">
                <Badge tone="accent">{KIND_LABEL[current.kind]}</Badge>
                <p className="text-xl font-semibold leading-snug sm:text-2xl">{current.text}</p>
              </div>
            ) : (
              <p className="text-muted">Press a button to get your first prompt.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mixed ? (
              <>
                <Button variant="primary" size="lg" onClick={() => { setKind('truth'); draw('truth') }}>Truth</Button>
                <Button variant="primary" size="lg" onClick={() => { setKind('dare'); draw('dare') }}>Dare</Button>
              </>
            ) : (
              <Button variant="primary" size="lg" onClick={() => draw('wyr')}>
                <Shuffle className="size-4" aria-hidden />
                {current ? 'Next question' : 'Get a question'}
              </Button>
            )}
            <CopyButton text={current?.text ?? ''} label="Copy prompt" disabled={!current} size="md" />
          </div>
          {note && <Alert tone="info">{note}</Alert>}
          <p className="text-xs text-muted">
            {mixed
              ? `Truths left: ${left.truth}. Dares left: ${left.dare}. Nothing repeats until a list runs out.`
              : `Questions left before a repeat: ${left.wyr}.`}
          </p>
        </div>
      </Panel>
    </div>
  )
}

// ───────────── Number memory game ─────────────
type MemPhase = 'idle' | 'show' | 'ask' | 'right' | 'wrong'

export function NumberMemoryGame() {
  const [phase, setPhase] = useState<MemPhase>('idle')
  const [level, setLevel] = useState(1)
  const [digits, setDigits] = useState('')
  const [answer, setAnswer] = useState('')
  const [best, setBest] = useState(0)
  const [shrunk, setShrunk] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const startLevel = (lv: number) => {
    const d = generateDigits(lv)
    setLevel(lv)
    setDigits(d)
    setAnswer('')
    setShrunk(false)
    setPhase('show')
    if (timer.current !== null) window.clearTimeout(timer.current)
    window.setTimeout(() => setShrunk(true), 50)
    timer.current = window.setTimeout(() => setPhase('ask'), memoryShowMs(lv))
  }

  const submit = () => {
    if (checkDigits(digits, answer)) {
      setBest((b) => Math.max(b, level))
      setPhase('right')
    } else setPhase('wrong')
  }

  return (
    <div className="space-y-5">
      <Panel title="Number memory" actions={<Badge tone="accent">Level {level}</Badge>}>
        <div className="space-y-4">
          <div className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-2xl bg-surface p-6 text-center" role="status" aria-live="polite">
            {phase === 'idle' && <p className="text-muted">Remember the number that appears. It gets one digit longer each time you get it right.</p>}
            {phase === 'show' && (
              <>
                <p className="tabular break-all text-5xl font-semibold tracking-widest sm:text-6xl" aria-label={`Number to remember: ${digits.split('').join(' ')}`}>{digits}</p>
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: shrunk ? '0%' : '100%', transition: `width ${memoryShowMs(level)}ms linear` }}
                  />
                </div>
              </>
            )}
            {phase === 'ask' && <p className="text-lg font-medium">What was the number?</p>}
            {phase === 'right' && <p className="text-lg font-medium text-accent">Correct. {digits} was the number.</p>}
            {phase === 'wrong' && (
              <div className="space-y-1">
                <p className="text-lg font-medium text-danger">Not quite.</p>
                <p className="tabular text-sm text-ink-2">The number was {digits}. You typed {answer.trim() || 'nothing'}.</p>
                <p className="text-sm text-muted">You reached level {level}.</p>
              </div>
            )}
          </div>
          {phase === 'ask' && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Field label="Your answer" className="w-64 max-w-full">
                {(id) => <Input id={id} autoFocus inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))} />}
              </Field>
              <Button type="submit" variant="primary" size="lg">Submit</Button>
            </form>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'idle' && <Button variant="primary" size="lg" onClick={() => startLevel(1)}>Start</Button>}
            {phase === 'right' && <Button variant="primary" size="lg" onClick={() => startLevel(level + 1)}>Next level</Button>}
            {phase === 'wrong' && <Button variant="primary" size="lg" onClick={() => startLevel(1)}>Play again</Button>}
            <span className="text-sm text-muted">Best this session: {best > 0 ? `level ${best}` : 'none yet'}</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
