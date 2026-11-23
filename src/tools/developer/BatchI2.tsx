import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff, FileUp, Lock, Unlock } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, DownloadButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Stat } from '@/components/ui/misc'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/fields'
import { downloadBlob, downloadText } from '@/lib/utils/download'
import { beautifyHtml, minifyHtml } from '@/lib/dev/html'
import {
  AesError,
  DEFAULT_ITERATIONS,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
} from '@/lib/dev/aes'
import {
  analyzeChars,
  decodeNumericEntities,
  graphemeCount,
  parseCodePoints,
  parseUtf8Hex,
  toCodePoints,
  toCssEscapes,
  toHtmlEntities,
  toJsEscapes,
  toUtf16Units,
  toUtf8Hex,
  unescapeCss,
  unescapeJs,
  utf8ByteLength,
  hex,
  type DecodeResult,
  type Scope,
} from '@/lib/dev/unicode'

const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`)

// ───────────── HTML formatter ─────────────
const HTML_SAMPLE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Demo</title><style>body{margin:0}</style></head><body><!-- main --><div class="card"><h1>Hello <em>world</em></h1><p>Some <b>bold</b> text and a <a href="https://example.com/some/long/link" class="link link-primary" target="_blank" rel="noopener">link</a>.</p><ul><li>One</li><li>Two</li></ul><pre>  keep
    this   spacing</pre><img src="a.png" alt="A"><br><script>window.x = 1;</script></div></body></html>`

export function HtmlFormatter() {
  const [src, setSrc] = useState('')
  const [mode, setMode] = useState<'beautify' | 'minify'>('beautify')
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2')
  const [indentScripts, setIndentScripts] = useState(false)
  const [wrapAttributes, setWrapAttributes] = useState(false)
  const [removeComments, setRemoveComments] = useState(true)
  const deferred = useDeferredValue(src)

  const result = useMemo(() => {
    if (!deferred.trim()) return { out: '', error: '' }
    try {
      const out = mode === 'beautify' ? beautifyHtml(deferred, { indent: indent === 'tab' ? 'tab' : Number(indent), indentScripts, wrapAttributes, wrapWidth: 80 }) : minifyHtml(deferred, { removeComments })
      return { out, error: '' }
    } catch {
      return { out: '', error: 'Could not process this markup.' }
    }
  }, [deferred, mode, indent, indentScripts, wrapAttributes, removeComments])

  const inLen = new Blob([deferred]).size
  const outLen = new Blob([result.out]).size
  const saved = inLen ? Math.round((1 - outLen / inLen) * 100) : 0

  return (
    <div className="space-y-5">
      <Panel
        title="HTML"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setSrc(HTML_SAMPLE)}>
            Load sample
          </Button>
        }
      >
        <TextBox label="Paste HTML" value={src} onChange={setSrc} rows={10} paste clear placeholder="<div><p>Paste markup here</p></div>" />
      </Panel>
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'beautify', label: 'Beautify' },
              { value: 'minify', label: 'Minify' },
            ]}
          />
          {mode === 'beautify' ? (
            <>
              <Segmented
                label="Indent"
                value={indent}
                onChange={setIndent}
                options={[
                  { value: '2', label: '2 spaces' },
                  { value: '4', label: '4 spaces' },
                  { value: 'tab', label: 'Tab' },
                ]}
              />
              <Switch checked={wrapAttributes} onChange={setWrapAttributes} label="Wrap long attribute lists" />
              <Switch checked={indentScripts} onChange={setIndentScripts} label="Indent script and style bodies" />
            </>
          ) : (
            <Switch checked={removeComments} onChange={setRemoveComments} label="Remove comments" />
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Content of pre, textarea, script and style is kept exactly as written
          {mode === 'beautify' ? ', unless you turn on script and style indenting, which re-indents those lines (this can change multi-line template strings).' : '.'} This tool does not validate or fix invalid HTML.
        </p>
      </Panel>
      {result.error ? (
        <Alert tone="danger">{result.error}</Alert>
      ) : (
        <Panel
          title={mode === 'beautify' ? 'Formatted HTML' : 'Minified HTML'}
          actions={
            <div className="flex gap-2">
              <CopyButton text={result.out} disabled={!result.out} />
              <DownloadButton size="sm" variant="secondary" disabled={!result.out} onClick={() => downloadText(result.out, mode === 'beautify' ? 'formatted.html' : 'minified.html', 'text/html;charset=utf-8')}>
                Download
              </DownloadButton>
            </div>
          }
        >
          {result.out && (
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Input" value={kb(inLen)} />
              <Stat label="Output" value={kb(outLen)} />
              <Stat label={saved >= 0 ? 'Smaller by' : 'Larger by'} value={`${Math.abs(saved)}%`} />
            </div>
          )}
          <TextBox label="Result" value={result.out} readOnly rows={12} />
        </Panel>
      )}
    </div>
  )
}

// ───────────── AES encrypt / decrypt ─────────────
interface FileResult {
  bytes: Uint8Array
  name: string
}
const MAX_FILE = 256 * 1024 * 1024

export function AesEncryptDecrypt() {
  const [kind, setKind] = useState<'text' | 'file'>('text')
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [iterations, setIterations] = useState(String(DEFAULT_ITERATIONS))
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileOut, setFileOut] = useState<FileResult | null>(null)
  const [outName, setOutName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const iterNum = Number(iterations)
  const iterOk = Number.isInteger(iterNum) && iterNum >= MIN_ITERATIONS && iterNum <= MAX_ITERATIONS
  const encrypting = action === 'encrypt'
  const mismatch = encrypting && confirm !== password
  const ready = !!password && !mismatch && !busy && (kind === 'text' ? !!input.trim() || encrypting : !!file) && (!encrypting || iterOk)

  const reset = () => {
    setOutput('')
    setFileOut(null)
    setError('')
    setDone('')
  }

  const run = async () => {
    reset()
    setBusy(true)
    try {
      if (kind === 'text') {
        setOutput(encrypting ? await encryptText(input, password, iterNum) : await decryptText(input, password))
        setDone(encrypting ? 'Encrypted. Keep the password: it cannot be recovered.' : 'Decrypted.')
      } else if (file) {
        if (file.size > MAX_FILE) throw new AesError('That file is over 256 MB. Files this large can run the browser out of memory.')
        const data = new Uint8Array(await file.arrayBuffer())
        if (encrypting) {
          setFileOut({ bytes: await encryptBytes(data, password, iterNum), name: `${file.name}.enc` })
          setDone('Encrypted. Download the .enc file and keep the password: it cannot be recovered.')
        } else {
          const plain = await decryptBytes(data, password)
          const name = outName.trim() || file.name.replace(/\.enc$/i, '') || 'decrypted'
          setFileOut({ bytes: plain, name })
          setDone('Decrypted. Check the file name, then download it.')
        }
      }
    } catch (e) {
      setError(e instanceof AesError ? e.message : 'Something went wrong while processing. Try again, and make sure the browser supports Web Crypto.')
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'

  return (
    <div className="space-y-5">
      <Panel title="Mode">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Segmented label="Action" value={action} onChange={(v) => { setAction(v); reset() }} options={[{ value: 'encrypt', label: 'Encrypt' }, { value: 'decrypt', label: 'Decrypt' }]} />
          <Segmented label="Input" value={kind} onChange={(v) => { setKind(v); reset() }} options={[{ value: 'text', label: 'Text' }, { value: 'file', label: 'File' }]} />
        </div>
      </Panel>

      <Panel title={kind === 'text' ? (encrypting ? 'Text to encrypt' : 'Text to decrypt') : encrypting ? 'File to encrypt' : 'File to decrypt'}>
        {kind === 'text' ? (
          <TextBox
            label={encrypting ? 'Plain text' : 'Encrypted text (Base64)'}
            value={input}
            onChange={(v) => { setInput(v); reset() }}
            rows={7}
            paste
            clear
            placeholder={encrypting ? 'Type or paste the text to protect' : 'Paste the Base64 text produced by this tool'}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-4" aria-hidden /> Choose file
              </Button>
              <input ref={fileRef} type="file" className="sr-only" aria-label={encrypting ? 'File to encrypt' : 'File to decrypt'} onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); setOutName(''); e.target.value = '' }} />
              <span className="text-sm text-ink-2">{file ? `${file.name} (${kb(file.size)})` : 'No file chosen'}</span>
            </div>
            {!encrypting && (
              <Field label="Name for the decrypted file" hint="The original name is not stored in the encrypted file. Leave blank to drop .enc from the name.">
                {(id) => <Input id={id} value={outName} onChange={(e) => setOutName(e.target.value)} placeholder="report.pdf" />}
              </Field>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Password">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" hint="Never leaves this page.">
              {(id) => (
                <div className="flex gap-2">
                  <Input id={id} type={type} value={password} onChange={(e) => { setPassword(e.target.value); reset() }} autoComplete={encrypting ? 'new-password' : 'current-password'} spellCheck={false} />
                  <Button variant="secondary" size="icon" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((s) => !s)}>
                    {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </Button>
                </div>
              )}
            </Field>
            {encrypting && (
              <Field label="Confirm password" hint={mismatch && confirm ? 'The passwords do not match.' : 'Type it again. A typo here would lock the data for good.'}>
                {(id) => <Input id={id} type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" spellCheck={false} aria-invalid={(mismatch && !!confirm) || undefined} />}
              </Field>
            )}
          </div>
          {encrypting && (
            <Field label="PBKDF2 iterations" hint={`Higher is slower for anyone guessing passwords, and for you. Default ${DEFAULT_ITERATIONS.toLocaleString('en-US')}. The count is stored in the output, so decrypting needs no setting.`} className="max-w-xs">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={MIN_ITERATIONS} max={MAX_ITERATIONS} step={1000} value={iterations} onChange={(e) => setIterations(e.target.value)} aria-invalid={!iterOk || undefined} />}
            </Field>
          )}
          {encrypting && !iterOk && <p className="text-xs text-danger">Use a whole number from {MIN_ITERATIONS.toLocaleString('en-US')} to {MAX_ITERATIONS.toLocaleString('en-US')}.</p>}
          <Button variant="primary" disabled={!ready} onClick={() => void run()}>
            {encrypting ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />}
            {busy ? 'Working...' : encrypting ? 'Encrypt' : 'Decrypt'}
          </Button>
        </div>
      </Panel>

      {error && <Alert tone="danger">{error}</Alert>}
      {done && !error && <Alert tone="success" role="status">{done}</Alert>}

      {output && (
        <Panel title={encrypting ? 'Encrypted text (Base64)' : 'Decrypted text'} actions={<CopyButton text={output} />}>
          <TextBox label="Result" value={output} readOnly rows={7} />
        </Panel>
      )}
      {fileOut && (
        <Panel title="Result file">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-2">
              {fileOut.name} ({kb(fileOut.bytes.length)})
            </span>
            <DownloadButton onClick={() => downloadBlob(new Blob([fileOut.bytes as unknown as BlobPart], { type: 'application/octet-stream' }), fileOut.name)}>Download</DownloadButton>
          </div>
        </Panel>
      )}

      <Panel title="How this works and what it cannot do">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>The key comes from your password with PBKDF2 (SHA-256), then the data is encrypted with AES-256-GCM. Everything runs in your browser through Web Crypto.</li>
          <li>The result is one Base64 string (or a binary .enc file) laid out as: 1 version byte, 4 bytes of iteration count, 16 bytes of random salt, 12 bytes of random IV, then the ciphertext with its 16-byte tag.</li>
          <li>This format is specific to this tool. Other programs will not open it, and this tool will not open files from other programs.</li>
          <li>It is only as strong as the password. A short or common password can be guessed offline, whatever the iteration count.</li>
          <li>There is no password recovery. Nobody, including this site, can open the data without the password.</li>
          <li>Passwords are normalised to Unicode NFKC before use, so look-alike forms of the same text give the same key.</li>
        </ul>
      </Panel>
    </div>
  )
}

// ───────────── Unicode converter ─────────────
type Reverse = 'cp' | 'js' | 'html' | 'css' | 'utf8'

function visibleChar(ch: string, cat: string): ReactNode {
  const cp = ch.codePointAt(0) as number
  if (cp < 0x20) return String.fromCodePoint(0x2400 + cp)
  if (cp === 0x20) return '␠'
  if (cp === 0x7f) return '␡'
  if (['Cc', 'Zs', 'Zl', 'Zp', 'Cf', 'Cs', 'Co', 'Cn'].includes(cat)) return <span className="text-xs text-muted">(invisible)</span>
  if (cat.startsWith('M')) return '◌' + ch
  return ch
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-2">{label}</p>
        <CopyButton text={value} disabled={!value} size="sm" variant="ghost" />
      </div>
      <p className="max-h-32 overflow-auto break-all font-mono text-[13px]">{value || ' '}</p>
    </div>
  )
}

export function UnicodeConverter() {
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward')
  const [text, setText] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [rev, setRev] = useState('')
  const [revFormat, setRevFormat] = useState<Reverse>('cp')
  const dText = useDeferredValue(text)

  const forward = useMemo(() => {
    const t = dText
    const info = analyzeChars(t, 200)
    return {
      cp: toCodePoints(t),
      utf8: toUtf8Hex(t),
      utf16: toUtf16Units(t),
      dec: toHtmlEntities(t, 'dec', scope),
      hexEnt: toHtmlEntities(t, 'hex', scope),
      js: toJsEscapes(t, 'js', scope),
      es6: toJsEscapes(t, 'es6', scope),
      css: toCssEscapes(t, scope),
      info,
      units: t.length,
      bytes: utf8ByteLength(t),
      graphemes: graphemeCount(t),
    }
  }, [dText, scope])

  const reversed: DecodeResult = useMemo(() => {
    if (!rev) return { text: '', errors: [] }
    switch (revFormat) {
      case 'cp':
        return parseCodePoints(rev)
      case 'js':
        return unescapeJs(rev)
      case 'html':
        return decodeNumericEntities(rev)
      case 'css':
        return unescapeCss(rev)
      default:
        return parseUtf8Hex(rev)
    }
  }, [rev, revFormat])

  const placeholders: Record<Reverse, string> = {
    cp: 'U+0048 U+1F600',
    js: '\\u0048\\uD83D\\uDE00 or \\u{1F600}',
    html: '&#72;&#x1F600;',
    css: '\\48 \\1F600',
    utf8: '48 F0 9F 98 80',
  }

  return (
    <div className="space-y-5">
      <Segmented label="Direction" value={mode} onChange={setMode} options={[{ value: 'forward', label: 'Text to codes' }, { value: 'reverse', label: 'Codes to text' }]} />

      {mode === 'forward' ? (
        <>
          <Panel title="Text">
            <TextBox label="Type or paste text" value={text} onChange={setText} rows={4} paste clear placeholder="Hello, wörld 😀" />
            <div className="mt-4">
              <Segmented label="Escape which characters (HTML, JavaScript, CSS)" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Every character' }, { value: 'nonAscii', label: 'Non-ASCII only' }]} />
            </div>
          </Panel>
          {text && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Code points" value={forward.info.total} />
                <Stat label="UTF-16 units" value={forward.units} />
                <Stat label="UTF-8 bytes" value={forward.bytes} />
                <Stat label="Graphemes" value={forward.graphemes ?? 'n/a'} sub={forward.graphemes === null ? 'Not supported by this browser' : 'What a reader sees as one character'} />
              </div>
              <Panel title="Converted output">
                <div className="grid gap-3 md:grid-cols-2">
                  <OutputRow label="Code points" value={forward.cp} />
                  <OutputRow label="UTF-8 bytes (hex)" value={forward.utf8} />
                  <OutputRow label="UTF-16 code units (hex)" value={forward.utf16} />
                  <OutputRow label="HTML entities (decimal)" value={forward.dec} />
                  <OutputRow label="HTML entities (hex)" value={forward.hexEnt} />
                  <OutputRow label="JavaScript / JSON escapes (\uXXXX)" value={forward.js} />
                  <OutputRow label="JavaScript escapes (\u{...})" value={forward.es6} />
                  <OutputRow label="CSS escapes" value={forward.css} />
                </div>
                <p className="mt-3 text-xs text-muted">Unpaired surrogates have no valid UTF-8 form, so the UTF-8 bytes show them as EF BF BD (the replacement character).</p>
              </Panel>
              <Panel title="Character table">
                <div className="max-h-96 overflow-auto rounded-lg border border-line">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Each character with its code point, category and size</caption>
                    <thead className="sticky top-0 bg-surface-2 text-xs text-ink-2">
                      <tr>
                        <th scope="col" className="px-3 py-2">Character</th>
                        <th scope="col" className="px-3 py-2">Code point</th>
                        <th scope="col" className="px-3 py-2">Category</th>
                        <th scope="col" className="px-3 py-2">UTF-8 bytes</th>
                        <th scope="col" className="px-3 py-2">UTF-16 units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forward.info.rows.map((r, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="px-3 py-1.5 font-mono text-base">{visibleChar(r.char, r.category)}</td>
                          <td className="px-3 py-1.5 font-mono">U+{hex(r.cp)}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-mono">{r.category}</span> <span className="text-muted">{r.categoryLabel}</span>
                          </td>
                          <td className="px-3 py-1.5 tabular">{r.utf8}</td>
                          <td className="px-3 py-1.5 tabular">{r.utf16}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {forward.info.total > forward.info.rows.length && <p className="mt-2 text-xs text-muted">Showing the first {forward.info.rows.length} of {forward.info.total} characters.</p>}
              </Panel>
            </>
          )}
        </>
      ) : (
        <>
          <Panel title="Codes">
            <div className="space-y-4">
              <Field label="Input format">
                {(id) => (
                  <Select id={id} value={revFormat} onChange={(e) => setRevFormat(e.target.value as Reverse)} className="max-w-sm">
                    <option value="cp">Code points (U+1F600)</option>
                    <option value="js">JavaScript or JSON escapes {'(\\uXXXX, \\u{...})'}</option>
                    <option value="html">HTML numeric entities (&amp;#128512; &amp;#x1F600;)</option>
                    <option value="css">CSS escapes (\1F600)</option>
                    <option value="utf8">UTF-8 bytes (hex)</option>
                  </Select>
                )}
              </Field>
              <TextBox label="Codes" value={rev} onChange={setRev} rows={4} paste clear placeholder={placeholders[revFormat]} />
            </div>
          </Panel>
          {rev && (
            <>
              {reversed.errors.length > 0 && (
                <Alert tone="warn" title={`${reversed.errors.length} problem${reversed.errors.length === 1 ? '' : 's'} found`}>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {reversed.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {reversed.errors.length > 20 && <p className="mt-1">...and {reversed.errors.length - 20} more.</p>}
                </Alert>
              )}
              <Panel title="Text" actions={<CopyButton text={reversed.text} disabled={!reversed.text} />}>
                <TextBox label="Decoded text" value={reversed.text} readOnly rows={4} />
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  )
}
