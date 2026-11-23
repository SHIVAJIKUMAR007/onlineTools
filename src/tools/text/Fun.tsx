import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Field, Segmented, Select, Switch } from '@/components/ui/fields'
import {
  chunkSentences,
  convertSmall,
  fromPigLatin,
  FANCY_STYLES,
  removeDuplicateWords,
  SMALL_STYLES,
  toPigLatin,
  type DedupeOptions,
  type VowelSuffix,
} from '@/lib/text/fun'

// ───────────── Remove duplicate words ─────────────
export function RemoveDuplicateWords() {
  const [text, setText] = useState('')
  const [o, setO] = useState<DedupeOptions>({ caseSensitive: false, ignorePunctuation: true, keepLineBreaks: true, consecutiveOnly: false })
  const set = <K extends keyof DedupeOptions>(k: K, v: DedupeOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const r = useMemo(() => removeDuplicateWords(text, o), [text, o])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Switch checked={o.caseSensitive} onChange={(v) => set('caseSensitive', v)} label="Case sensitive" />
          <Switch checked={o.ignorePunctuation} onChange={(v) => set('ignorePunctuation', v)} label="Ignore punctuation around words" />
          <Switch checked={o.keepLineBreaks} onChange={(v) => set('keepLineBreaks', v)} label="Keep line breaks" />
          <Switch checked={o.consecutiveOnly} onChange={(v) => set('consecutiveOnly', v)} label="Only remove back-to-back repeats" />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label="Your text" value={text} onChange={setText} rows={10} placeholder="Paste text with repeated words..." paste clear /></Panel>
        <Panel><TextBox label="Result" value={r.text} readOnly rows={10} copy /></Panel>
      </div>
      {text.trim() && (
        <Panel title="Removed words">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Words removed" value={r.removedTotal} />
            <Stat label="Words kept" value={r.keptTotal} />
            <Stat label="Different words removed" value={r.removed.length} />
          </div>
          {r.removed.length === 0 ? (
            <p className="text-sm text-muted">No repeated words found.</p>
          ) : (
            <ul className="flex max-h-60 flex-wrap gap-2 overflow-auto text-sm">
              {r.removed.map((x) => (
                <li key={x.word} className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono">
                  {x.word} <span className="text-muted">x{x.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}

// ───────────── Fancy text generator ─────────────
export function FancyTextGenerator() {
  const [text, setText] = useState('Hello World')
  return (
    <div className="space-y-5">
      <Panel><TextBox label="Your text" value={text} onChange={setText} rows={3} placeholder="Type something..." clear /></Panel>
      <Alert tone="info">These are Unicode characters, not fonts. Some apps and fonts show boxes for them, and screen readers may read them letter by letter or skip them. Avoid them for anything that must be accessible.</Alert>
      <Panel title="Styles">
        <ul className="divide-y divide-line">
          {FANCY_STYLES.map((s) => {
            const out = s.convert(text)
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{s.name}</p>
                  <p className="break-words text-lg" aria-label={`${s.name} version of your text`}>{out || ' '}</p>
                </div>
                <CopyButton text={out} disabled={!out} />
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

// ───────────── Small text generator ─────────────
export function SmallTextGenerator() {
  const [text, setText] = useState('Hello World 2024')
  return (
    <div className="space-y-5">
      <Panel><TextBox label="Your text" value={text} onChange={setText} rows={3} placeholder="Type something..." clear /></Panel>
      <Panel title="Small text styles">
        <ul className="divide-y divide-line">
          {SMALL_STYLES.map((s) => {
            const r = convertSmall(text, s.id)
            return (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{s.name}</p>
                    <p className="break-words text-lg">{r.text || ' '}</p>
                  </div>
                  <CopyButton text={r.text} disabled={!r.text} />
                </div>
                {r.missing.length > 0 && (
                  <p className="mt-1.5 text-xs text-warn">
                    No Unicode {s.name.toLowerCase()} for: <span className="font-mono">{r.missing.join(' ')}</span>. These stay as normal characters.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>
      <p className="text-xs text-muted">Unicode only has some small letters, so a few characters will not change. Fonts and apps differ in how they draw them, and screen readers may not read them well.</p>
    </div>
  )
}

// ───────────── Pig Latin translator ─────────────
export function PigLatinTranslator() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [suffix, setSuffix] = useState<VowelSuffix>('way')
  const [text, setText] = useState('')
  const out = useMemo(() => (mode === 'encode' ? toPigLatin(text, suffix) : fromPigLatin(text, suffix)), [mode, suffix, text])
  return (
    <div className="space-y-5">
      <Panel title="Options">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Segmented
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'encode', label: 'English to Pig Latin' },
              { value: 'decode', label: 'Pig Latin to English' },
            ]}
          />
          <Segmented
            label="Words starting with a vowel"
            value={suffix}
            onChange={setSuffix}
            options={[
              { value: 'way', label: 'add "way"' },
              { value: 'yay', label: 'add "yay"' },
              { value: 'ay', label: 'add "ay"' },
            ]}
          />
        </div>
      </Panel>
      {mode === 'decode' && <Alert tone="info">Decoding is a best guess. Different English words can give the same Pig Latin, and the original spelling of a consonant cluster is not always clear.</Alert>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><TextBox label={mode === 'encode' ? 'English' : 'Pig Latin'} value={text} onChange={setText} rows={9} placeholder="Type or paste text..." paste clear /></Panel>
        <Panel><TextBox label={mode === 'encode' ? 'Pig Latin' : 'English'} value={out} readOnly rows={9} copy /></Panel>
      </div>
    </div>
  )
}

// ───────────── Text to speech ─────────────
type Status = 'idle' | 'speaking' | 'paused'

export function TextToSpeech() {
  const [supported, setSupported] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [text, setText] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const run = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSupported(false)
      return
    }
    const synth = window.speechSynthesis
    const load = () => {
      const v = synth.getVoices()
      setVoices(v)
      setVoiceURI((cur) => cur || v.find((x) => x.default)?.voiceURI || v[0]?.voiceURI || '')
    }
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      run.current++
      synth.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    run.current++
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setStatus('idle')
    setProgress(0)
  }, [])

  const speak = () => {
    if (!supported || !text.trim()) return
    const synth = window.speechSynthesis
    run.current++
    const id = run.current
    synth.cancel()
    setError('')
    const chunks = chunkSentences(text)
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1
    const voice = voices.find((v) => v.voiceURI === voiceURI)
    let done = 0
    const next = (i: number) => {
      if (id !== run.current) return
      if (i >= chunks.length) {
        setStatus('idle')
        setProgress(1)
        return
      }
      const u = new SpeechSynthesisUtterance(chunks[i])
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      }
      u.rate = rate
      u.pitch = pitch
      u.volume = volume
      u.onend = () => {
        done += chunks[i].length
        setProgress(done / total)
        next(i + 1)
      }
      u.onerror = (e) => {
        if (id !== run.current) return
        if (e.error !== 'canceled' && e.error !== 'interrupted') setError(`Speech failed (${e.error}). Try another voice.`)
        setStatus('idle')
      }
      synth.speak(u)
    }
    setProgress(0)
    setStatus('speaking')
    next(0)
  }

  const pause = () => {
    window.speechSynthesis.pause()
    setStatus('paused')
  }
  const resume = () => {
    window.speechSynthesis.resume()
    setStatus('speaking')
  }

  if (!supported) {
    return <Alert tone="warn" title="Speech is not available">This browser does not support the Web Speech API. Try a current version of Chrome, Edge, Safari or Firefox on a device with speech voices installed.</Alert>
  }

  const selected = voices.find((v) => v.voiceURI === voiceURI)
  return (
    <div className="space-y-5">
      <Panel><TextBox label="Text to read aloud" value={text} onChange={setText} rows={9} placeholder="Type or paste text..." paste clear /></Panel>
      <Panel title="Voice and speed">
        <div className="space-y-5">
          <Field label="Voice" hint={voices.length === 0 ? 'No voices found yet. Some browsers load them after a moment, and some devices have none installed.' : undefined}>
            {(id) => (
              <Select id={id} value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} disabled={voices.length === 0}>
                {voices.length === 0 && <option value="">Default voice</option>}
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}){v.localService ? '' : ' - online'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {selected && !selected.localService && (
            <Alert tone="warn">This voice may be processed by an online speech service run by your browser or device vendor, which could receive the text. Choose a voice without "online" for sensitive text.</Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={`Speed: ${rate.toFixed(1)}x`}>
              {(id) => <input id={id} type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />}
            </Field>
            <Field label={`Pitch: ${pitch.toFixed(1)}`}>
              {(id) => <input id={id} type="range" min={0.5} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />}
            </Field>
            <Field label={`Volume: ${Math.round(volume * 100)}%`}>
              {(id) => <input id={id} type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />}
            </Field>
          </div>
          <p className="text-xs text-muted">Speed, pitch and volume apply to the next time you press Speak.</p>
        </div>
      </Panel>
      <Panel title="Playback">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={speak} disabled={!text.trim()}>
              <Play className="size-4" aria-hidden /> Speak
            </Button>
            {status === 'paused' ? (
              <Button variant="secondary" onClick={resume}>
                <Play className="size-4" aria-hidden /> Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={pause} disabled={status !== 'speaking'}>
                <Pause className="size-4" aria-hidden /> Pause
              </Button>
            )}
            <Button variant="secondary" onClick={stop} disabled={status === 'idle'}>
              <Square className="size-4" aria-hidden /> Stop
            </Button>
          </div>
          {status !== 'idle' && <ProgressBar value={progress} label="Reading progress" />}
          {error && <Alert tone="danger">{error}</Alert>}
          <p className="text-xs text-muted">Audio comes from your browser and operating system. Pause may not work in every browser.</p>
        </div>
      </Panel>
    </div>
  )
}
