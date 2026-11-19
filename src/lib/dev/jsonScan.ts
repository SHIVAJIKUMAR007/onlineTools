/**
 * Strict JSON scanner used only to find WHERE a document is invalid. Browsers word
 * their JSON.parse errors differently and newer ones omit the position, so we find
 * it ourselves. Valid input never reaches this code.
 */
class JsonScanError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message)
  }
}

const NEWLINE = String.fromCharCode(10)
const BACKSLASH = String.fromCharCode(92)

function describe(text: string, i: number): string {
  if (i >= text.length) return 'end of input'
  return text[i] === NEWLINE ? 'a line break' : `"${text[i]}"`
}

const isWs = (c: string | undefined) => c === ' ' || c === '\t' || c === NEWLINE || c === '\r'
const NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/

export function locateJsonError(text: string): { position: number; message: string } | null {
  let i = 0
  const fail = (message: string, at = i): never => {
    throw new JsonScanError(message, at)
  }
  const ws = () => {
    while (i < text.length && isWs(text[i])) i++
  }
  const string = () => {
    const open = i
    i++
    while (i < text.length) {
      const c = text[i]
      if (c === '"') {
        i++
        return
      }
      if (c === BACKSLASH) {
        const n = text[i + 1]
        if (n === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('Invalid unicode escape in string')
          i += 6
        } else if (n !== undefined && '"/bfnrt'.includes(n) || n === BACKSLASH) i += 2
        else fail(`Invalid escape sequence in string`)
      } else if (c < ' ') fail('Line break or control character inside a string. Use an escape such as \\n')
      else i++
    }
    fail('Unterminated string', open)
  }
  const value = (): void => {
    ws()
    const c = text[i]
    if (c === '{') {
      i++
      ws()
      if (text[i] === '}') {
        i++
        return
      }
      for (;;) {
        ws()
        if (text[i] !== '"') fail(`Expected a property name in double quotes but found ${describe(text, i)}`)
        string()
        ws()
        if (text[i] !== ':') fail(`Expected ":" after the property name but found ${describe(text, i)}`)
        i++
        value()
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === '}') {
          i++
          return
        }
        fail(`Expected "," or "}" but found ${describe(text, i)}`)
      }
    } else if (c === '[') {
      i++
      ws()
      if (text[i] === ']') {
        i++
        return
      }
      for (;;) {
        value()
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === ']') {
          i++
          return
        }
        fail(`Expected "," or "]" but found ${describe(text, i)}`)
      }
    } else if (c === '"') {
      string()
    } else if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) {
      const m = NUMBER.exec(text.slice(i))
      if (!m) fail('Invalid number')
      i += m![0].length
    } else if (text.startsWith('true', i)) i += 4
    else if (text.startsWith('false', i)) i += 5
    else if (text.startsWith('null', i)) i += 4
    else fail(i >= text.length ? 'Unexpected end of input' : `Unexpected ${describe(text, i)}. Expected a value`)
  }

  try {
    value()
    ws()
    if (i < text.length) fail(`Unexpected ${describe(text, i)} after the end of the JSON value`)
    return null
  } catch (e) {
    if (e instanceof JsonScanError) return { position: e.position, message: e.message }
    throw e
  }
}
