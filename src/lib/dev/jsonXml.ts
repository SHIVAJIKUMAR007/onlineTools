// JSON <-> XML conversion. "@name" keys are attributes and "#text" holds element text.
// DOMParser is only used inside xmlToJson so the module is safe to import during prerender.

export type IndentChoice = 0 | 2 | 4 | 'tab'

export interface JsonToXmlOptions {
  root: string
  indent: IndentChoice
  declaration: boolean
}

export type ConvertResult = { ok: true; output: string; warnings: string[] } | { ok: false; error: string }

const TEXT_KEY = '#text'

// eslint-disable-next-line no-control-regex
const BAD_XML_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g
const escText = (s: string) => s.replace(BAD_XML_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) =>
  s.replace(BAD_XML_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;')

export function sanitizeName(name: string): string {
  let n = name.replace(/[^A-Za-z0-9_.\-·À-￿]/g, '_')
  if (!n) n = '_'
  if (!/^[A-Za-z_À-￿]/.test(n)) n = '_' + n
  if (/^xml/i.test(n)) n = '_' + n
  return n
}

function scalarText(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function jsonToXml(text: string, opts: JsonToXmlOptions): ConvertResult {
  if (!text.trim()) return { ok: true, output: '', warnings: [] }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON.' }
  }
  const unit = opts.indent === 'tab' ? '\t' : opts.indent === 0 ? '' : ' '.repeat(opts.indent)
  const pretty = opts.indent !== 0
  const nl = pretty ? '\n' : ''
  const warnings: string[] = []
  const renamed = new Set<string>()

  const name = (raw: string): string => {
    const n = sanitizeName(raw)
    if (n !== raw) renamed.add(raw === '' ? '(empty key)' : raw)
    return n
  }

  const element = (rawName: string, value: unknown, depth: number): string => {
    const pad = pretty ? unit.repeat(depth) : ''
    const tag = name(rawName)
    if (Array.isArray(value)) return value.map((v) => element(rawName, v, depth)).join(nl)
    if (!isPlain(value)) {
      const s = scalarText(value)
      return s === '' ? `${pad}<${tag}/>` : `${pad}<${tag}>${escText(s)}</${tag}>`
    }
    let attrs = ''
    let textPart = ''
    const kids: string[] = []
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('@') && k.length > 1) {
        if (isPlain(v) || Array.isArray(v)) {
          warnings.push(`Attribute "${k}" holds an object or array, so it was written as a child element.`)
          kids.push(element(k.slice(1), v, depth + 1))
        } else attrs += ` ${name(k.slice(1))}="${escAttr(scalarText(v))}"`
      } else if (k === TEXT_KEY) {
        textPart = scalarText(Array.isArray(v) ? v.join('') : v)
      } else kids.push(element(k, v, depth + 1))
    }
    const kidsOut = kids.filter((k) => k !== '')
    if (!kidsOut.length) return textPart === '' ? `${pad}<${tag}${attrs}/>` : `${pad}<${tag}${attrs}>${escText(textPart)}</${tag}>`
    const inner = (textPart === '' ? '' : (pretty ? unit.repeat(depth + 1) : '') + escText(textPart) + nl) + kidsOut.join(nl)
    return `${pad}<${tag}${attrs}>${nl}${inner}${nl}${pad}</${tag}>`
  }

  let body: string
  const wrapName = opts.root.trim() || 'root'
  if (isPlain(data)) {
    const keys = Object.keys(data)
    const only = keys.length === 1 && !keys[0].startsWith('@') && keys[0] !== TEXT_KEY && !Array.isArray(data[keys[0]]) ? keys[0] : null
    body = only !== null ? element(only, data[only], 0) : element(wrapName, data, 0)
  } else if (Array.isArray(data)) {
    body = element(wrapName, { item: data }, 0)
  } else {
    body = element(wrapName, data, 0)
  }
  if (renamed.size) {
    const list = [...renamed].slice(0, 5).map((r) => `"${r}"`).join(', ')
    warnings.push(`${renamed.size} name${renamed.size === 1 ? '' : 's'} were not valid XML names and were adjusted: ${list}${renamed.size > 5 ? ', ...' : ''}.`)
  }
  const decl = opts.declaration ? `<?xml version="1.0" encoding="UTF-8"?>${nl}` : ''
  return { ok: true, output: decl + body + nl, warnings }
}

// ───────────── XML -> JSON ─────────────
export interface XmlToJsonOptions {
  indent: IndentChoice
  inferTypes: boolean
}

function infer(s: string, on: boolean): string | number | boolean {
  if (!on) return s
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n) && String(n) === s) return n
  }
  return s
}

function parseError(doc: Document): string | null {
  const err = doc.getElementsByTagName('parsererror')[0]
  if (!err) return null
  const raw = (err.textContent ?? '').replace(/\s+/g, ' ').trim()
  const msg = raw.replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering of the page up to the first error\.?/i, '').trim()
  return msg || 'The XML is not well-formed.'
}

function elementToValue(el: Element, inferTypes: boolean): unknown {
  const obj: Record<string, unknown> = {}
  for (const a of Array.from(el.attributes)) obj['@' + a.name] = infer(a.value, inferTypes)
  let text = ''
  const kids = Array.from(el.childNodes)
  for (const c of kids) {
    if (c.nodeType === 3 || c.nodeType === 4) text += c.nodeValue ?? ''
    else if (c.nodeType === 1) {
      const child = c as Element
      const v = elementToValue(child, inferTypes)
      const key = child.nodeName
      if (key in obj) {
        const cur = obj[key]
        if (Array.isArray(cur)) cur.push(v)
        else obj[key] = [cur, v]
      } else obj[key] = v
    }
  }
  const hasKeys = Object.keys(obj).length > 0
  const trimmed = text.trim()
  if (!hasKeys) return trimmed === '' ? null : infer(trimmed, inferTypes)
  if (trimmed !== '') obj[TEXT_KEY] = infer(trimmed, inferTypes)
  return obj
}

export function xmlToJson(text: string, opts: XmlToJsonOptions): ConvertResult {
  if (!text.trim()) return { ok: true, output: '', warnings: [] }
  if (typeof DOMParser === 'undefined') return { ok: false, error: 'XML parsing is not available in this environment.' }
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text.replace(/^﻿/, ''), 'application/xml')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The XML is not well-formed.' }
  }
  const err = parseError(doc)
  if (err) return { ok: false, error: err }
  const rootEl = doc.documentElement
  const result = { [rootEl.nodeName]: elementToValue(rootEl, opts.inferTypes) }
  const space = opts.indent === 'tab' ? '\t' : opts.indent === 0 ? undefined : opts.indent
  return { ok: true, output: JSON.stringify(result, null, space), warnings: [] }
}
