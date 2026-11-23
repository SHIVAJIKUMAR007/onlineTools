// XML pretty-printer and minifier built on DOMParser.
// DOMParser is only touched inside functions so the module is safe to import during prerender.

export interface XmlOptions {
  mode: 'pretty' | 'minify'
  indent: 2 | 4 | 'tab'
}

export type XmlResult = { ok: true; output: string } | { ok: false; error: string }

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;')

function parseError(doc: Document): string | null {
  const err = doc.getElementsByTagName('parsererror')[0]
  if (!err) return null
  const raw = (err.textContent ?? '').replace(/\s+/g, ' ').trim()
  const msg = raw.replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering of the page up to the first error\.?/i, '').trim()
  return msg || 'The XML is not well-formed.'
}

/** Pull the leading `<?xml ... ?>` declaration and any DOCTYPE out of the source, since DOMParser drops them. */
function leadingParts(text: string): { decl: string; doctype: string } {
  const decl = /^\s*(<\?xml\s[^?]*\?>)/.exec(text)?.[1] ?? ''
  const rest = decl ? text.slice(text.indexOf(decl) + decl.length) : text
  const dt = /^(?:\s|<!--[\s\S]*?-->|<\?[\s\S]*?\?>)*(<!DOCTYPE\b(?:[^[>]|\[[\s\S]*?\])*>)/i.exec(rest)?.[1] ?? ''
  return { decl, doctype: dt.replace(/\s+/g, ' ') }
}

export function formatXml(text: string, opts: XmlOptions): XmlResult {
  if (!text.trim()) return { ok: true, output: '' }
  if (typeof DOMParser === 'undefined') return { ok: false, error: 'XML parsing is not available in this environment.' }
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text.replace(/^﻿/, ''), 'application/xml')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The XML is not well-formed.' }
  }
  const err = parseError(doc)
  if (err) return { ok: false, error: err }

  const unit = opts.indent === 'tab' ? '\t' : ' '.repeat(opts.indent)
  const pretty = opts.mode === 'pretty'
  const nl = pretty ? '\n' : ''
  const { decl, doctype } = leadingParts(text)

  const open = (el: Element) => {
    let s = '<' + el.nodeName
    for (const a of Array.from(el.attributes)) s += ` ${a.name}="${escAttr(a.value)}"`
    return s
  }

  const inlineOnly = (el: Element) =>
    Array.from(el.childNodes).every((c) => c.nodeType === 3 || c.nodeType === 4) &&
    !Array.from(el.childNodes).some((c) => c.nodeType === 3 && /[\r\n]/.test(c.nodeValue ?? '') && (c.nodeValue ?? '').trim() !== '')

  const node = (n: Node, depth: number): string => {
    const pad = pretty ? unit.repeat(depth) : ''
    switch (n.nodeType) {
      case 1: {
        const el = n as Element
        const kids = Array.from(el.childNodes).filter((c) => !(c.nodeType === 3 && (c.nodeValue ?? '').trim() === '' ))
        if (!kids.length) return `${pad}${open(el)}/>`
        if (!pretty) return `${open(el)}>${kids.map((c) => node(c, 0)).join('')}</${el.nodeName}>`
        if (inlineOnly(el)) {
          const inner = Array.from(el.childNodes).map((c) => (c.nodeType === 4 ? `<![CDATA[${c.nodeValue}]]>` : escText(c.nodeValue ?? ''))).join('')
          return `${pad}${open(el)}>${inner}</${el.nodeName}>`
        }
        return `${pad}${open(el)}>\n${kids.map((c) => node(c, depth + 1)).join('\n')}\n${pad}</${el.nodeName}>`
      }
      case 3: {
        const v = n.nodeValue ?? ''
        return pad + escText(pretty ? v.trim() : v)
      }
      case 4:
        return `${pad}<![CDATA[${n.nodeValue}]]>`
      case 8:
        return `${pad}<!--${n.nodeValue}-->`
      case 7:
        return `${pad}<?${(n as ProcessingInstruction).target} ${(n as ProcessingInstruction).data}?>`.replace(/ \?>$/, '?>')
      default:
        return ''
    }
  }

  const out: string[] = []
  if (decl) out.push(decl.replace(/\s+/g, ' '))
  if (doctype) out.push(doctype)
  for (const c of Array.from(doc.childNodes)) {
    if (c.nodeType === 10) continue
    if (c.nodeType === 3 && (c.nodeValue ?? '').trim() === '') continue
    out.push(node(c, 0))
  }
  return { ok: true, output: out.join(nl) + (pretty ? '\n' : '') }
}
