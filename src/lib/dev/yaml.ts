// Hand-written JSON to YAML serializer. Pure logic.

const RESERVED = /^(true|false|null|yes|no|on|off|y|n|~)$/i
const NUMBERISH = /^[-+]?(\.?\d[\d_]*(\.[\d_]*)?([eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+|\.inf|\.nan)$/i
const TIMESTAMP = /^\d{4}-\d{1,2}-\d{1,2}([Tt ].*)?$/
/** Control characters (other than tab and newline, which are handled separately) and line separators. */
const CONTROL = {
  test: (v: string) => {
    for (let k = 0; k < v.length; k++) {
      const c = v.charCodeAt(k)
      if ((c < 32 && c !== 9 && c !== 10) || c === 127 || c === 0x85 || c === 0x2028 || c === 0x2029) return true
    }
    return false
  },
}

/** True when a string would be read as something other than a plain string if left bare. */
export function needsQuotes(s: string): boolean {
  if (s === '') return true
  if (RESERVED.test(s) || NUMBERISH.test(s) || TIMESTAMP.test(s)) return true
  if (s !== s.trim()) return true
  if (CONTROL.test(s) || s.includes('\n') || s.includes('\t')) return true
  if (s === '-' || s === '?' || s === ':') return true
  if (/^[,[\]{}#&*!|>'"%@`]/.test(s)) return true
  // "-x", "?x" and ":x" are plain scalars; "- x", "? x" and ": x" are not.
  if (/^[-?:]\s/.test(s)) return true
  if (s.includes(': ') || s.includes(' #') || s.endsWith(':')) return true
  if (s.startsWith('---') || s.startsWith('...')) return true
  return false
}

const quote = (s: string) => JSON.stringify(s)
const keyText = (k: string) => (needsQuotes(k) ? quote(k) : k)

function scalar(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return needsQuotes(v) ? quote(v) : v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  return String(v)
}

/** Header for a literal block scalar, or null when the string needs double quotes instead. */
function blockHeader(s: string): string | null {
  if (!s.includes('\n') || CONTROL.test(s) || s.includes('\t')) return null
  if (/^\s/.test(s) || s.trim() === '') return null
  const trailing = s.length - s.replace(/\n+$/, '').length
  return trailing === 0 ? '|-' : trailing === 1 ? '|' : '|+'
}

const isColl = (v: unknown): v is object => typeof v === 'object' && v !== null
const isEmpty = (v: object) => (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0)

export function jsonToYaml(value: unknown, indent: 2 | 4 = 2): string {
  const sp = ' '.repeat(indent)

  const blockLines = (s: string, pad: string): string[] => {
    const trailing = s.length - s.replace(/\n+$/, '').length
    const body = s.replace(/\n+$/, '').split('\n').map((l) => (l === '' ? '' : pad + l))
    // |+ keeps every trailing newline, so emit the extra empty lines.
    return trailing > 1 ? [...body, ...Array<string>(trailing - 1).fill('')] : body
  }

  const entry = (prefix: string, v: unknown, pad: string): string[] => {
    if (isColl(v)) {
      if (isEmpty(v)) return [`${pad}${prefix} ${Array.isArray(v) ? '[]' : '{}'}`]
      const child = node(v, pad + sp)
      if (prefix === '-') {
        // Keep the item's first line on the dash line, aligned with the rest of the block.
        child[0] = pad + '-' + ' '.repeat(indent - 1) + child[0].slice(pad.length + indent)
        return child
      }
      return [`${pad}${prefix}`, ...child]
    }
    if (typeof v === 'string') {
      const h = blockHeader(v)
      if (h) return [`${pad}${prefix} ${h}`, ...blockLines(v, pad + sp)]
    }
    return [`${pad}${prefix} ${scalar(v)}`]
  }

  const node = (v: object, pad: string): string[] =>
    Array.isArray(v) ? v.flatMap((x) => entry('-', x, pad)) : Object.entries(v).flatMap(([k, x]) => entry(`${keyText(k)}:`, x, pad))

  if (!isColl(value)) return scalar(value) + '\n'
  if (isEmpty(value)) return (Array.isArray(value) ? '[]' : '{}') + '\n'
  return node(value, '').join('\n') + '\n'
}
