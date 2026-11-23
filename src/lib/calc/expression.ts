// Hand-built expression evaluator: tokenizer plus recursive descent. No eval, no Function.

export class CalcError extends Error {}

export type AngleMode = 'deg' | 'rad'
export interface EvalOptions {
  angle?: AngleMode
  ans?: number
}
export type EvalResult = { ok: true; value: number } | { ok: false; error: string }

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

const OPS = '+-*/^%!()'

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, ' pi ')
    .replace(/√/g, ' sqrt ')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i))
      if (!m) throw new CalcError(`Invalid number near "${s.slice(i, i + 4)}"`)
      out.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
    } else if (/[a-z]/i.test(c)) {
      let j = i
      while (j < s.length && /[a-z]/i.test(s[j]!)) j++
      let name = s.slice(i, j).toLowerCase()
      if (name === 'log' && s.slice(j, j + 2) === '10') {
        name = 'log10'
        j += 2
      }
      out.push({ t: 'id', v: name })
      i = j
    } else if (OPS.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
    } else {
      throw new CalcError(`Unexpected character "${c}"`)
    }
  }
  return out
}

const CONSTS = new Set(['pi', 'e', 'ans'])
const FUNCS = new Set(['sqrt', 'cbrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'log10', 'exp', 'abs', 'fact'])

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new CalcError('Factorial needs a whole number from 0 to 170')
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

const tidy = (x: number) => (Math.abs(x) < 1e-15 ? 0 : x)

function applyFn(name: string, x: number, angle: AngleMode): number {
  const toRad = (v: number) => (angle === 'deg' ? (v * Math.PI) / 180 : v)
  const fromRad = (v: number) => (angle === 'deg' ? (v * 180) / Math.PI : v)
  switch (name) {
    case 'sqrt':
      if (x < 0) throw new CalcError('Square root of a negative number is not real')
      return Math.sqrt(x)
    case 'cbrt':
      return Math.cbrt(x)
    case 'sin':
      return tidy(Math.sin(toRad(x)))
    case 'cos':
      return tidy(Math.cos(toRad(x)))
    case 'tan': {
      const r = toRad(x)
      if (Math.abs(Math.cos(r)) < 1e-14) throw new CalcError('tan is undefined at this angle')
      return tidy(Math.tan(r))
    }
    case 'asin':
    case 'acos':
      if (x < -1 || x > 1) throw new CalcError(`${name} needs a value between -1 and 1`)
      return fromRad(name === 'asin' ? Math.asin(x) : Math.acos(x))
    case 'atan':
      return fromRad(Math.atan(x))
    case 'ln':
      if (x <= 0) throw new CalcError('ln needs a number above zero')
      return Math.log(x)
    case 'log':
    case 'log10':
      if (x <= 0) throw new CalcError('log needs a number above zero')
      return Math.log10(x)
    case 'exp':
      return Math.exp(x)
    case 'abs':
      return Math.abs(x)
    case 'fact':
      return factorial(x)
  }
  throw new CalcError(`Unknown function "${name}"`)
}

class Parser {
  pos = 0
  constructor(
    private toks: Tok[],
    private angle: AngleMode,
    private ans: number,
  ) {}

  private peekOp(v: string) {
    const t = this.toks[this.pos]
    return t !== undefined && t.t === 'op' && t.v === v
  }
  private startsOperand(i: number) {
    const t = this.toks[i]
    return t !== undefined && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))
  }

  parse(): number {
    if (this.toks.length === 0) throw new CalcError('Enter an expression')
    const v = this.expr()
    const t = this.toks[this.pos]
    if (t) {
      if (t.t === 'op' && t.v === ')') throw new CalcError('Unexpected closing parenthesis')
      throw new CalcError(`Unexpected "${t.v}"`)
    }
    return v
  }

  private expr(): number {
    let v = this.term()
    while (this.peekOp('+') || this.peekOp('-')) {
      const op = (this.toks[this.pos++] as { v: string }).v
      const r = this.term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  private term(): number {
    let v = this.unary()
    for (;;) {
      if (this.peekOp('*')) {
        this.pos++
        v *= this.unary()
      } else if (this.peekOp('/')) {
        this.pos++
        const r = this.unary()
        if (r === 0) throw new CalcError('Cannot divide by zero')
        v /= r
      } else if (this.peekOp('%') && this.startsOperand(this.pos + 1)) {
        this.pos++
        const r = this.unary()
        if (r === 0) throw new CalcError('Cannot divide by zero')
        v %= r
      } else if (this.implicit()) {
        v *= this.unary()
      } else break
    }
    return v
  }

  /** Implicit multiplication: 2(3), 2pi, (1+2)(3+4), pi(2), 2sin(30). */
  private implicit() {
    const t = this.toks[this.pos]
    if (!t) return false
    if (t.t === 'op') return t.v === '('
    if (t.t === 'id') return true
    const prev = this.toks[this.pos - 1]
    return prev !== undefined && ((prev.t === 'op' && prev.v === ')') || (prev.t === 'id' && CONSTS.has(prev.v)))
  }

  private unary(): number {
    if (this.peekOp('-')) {
      this.pos++
      return -this.unary()
    }
    if (this.peekOp('+')) {
      this.pos++
      return this.unary()
    }
    return this.power()
  }

  private power(): number {
    const base = this.postfix()
    if (this.peekOp('^')) {
      this.pos++
      const ex = this.unary()
      if (base === 0 && ex < 0) throw new CalcError('Cannot divide by zero')
      if (base < 0 && !Number.isInteger(ex)) throw new CalcError('A negative number to a fractional power is not real')
      const r = Math.pow(base, ex)
      if (!Number.isFinite(r)) throw new CalcError('Result is too large')
      return r
    }
    return base
  }

  private postfix(): number {
    let v = this.primary()
    for (;;) {
      if (this.peekOp('!')) {
        this.pos++
        v = factorial(v)
      } else if (this.peekOp('%') && !this.startsOperand(this.pos + 1)) {
        this.pos++
        v /= 100
      } else break
    }
    return v
  }

  private primary(): number {
    const t = this.toks[this.pos++]
    if (!t) throw new CalcError('The expression ends unexpectedly')
    if (t.t === 'num') return t.v
    if (t.t === 'id') {
      if (t.v === 'pi') return Math.PI
      if (t.v === 'e') return Math.E
      if (t.v === 'ans') return this.ans
      if (FUNCS.has(t.v)) {
        if (!this.peekOp('(')) throw new CalcError(`Put the input of ${t.v} in parentheses, like ${t.v}(5)`)
        this.pos++
        const arg = this.expr()
        this.close()
        return applyFn(t.v, arg, this.angle)
      }
      throw new CalcError(`Unknown name "${t.v}"`)
    }
    if (t.v === '(') {
      const v = this.expr()
      this.close()
      return v
    }
    if (t.v === ')') throw new CalcError('Unexpected closing parenthesis')
    throw new CalcError(`Unexpected "${t.v}"`)
  }

  private close() {
    if (this.pos >= this.toks.length) throw new CalcError('Missing closing parenthesis')
    if (!this.peekOp(')')) {
      const t = this.toks[this.pos]!
      throw new CalcError(`Unexpected "${t.v}"`)
    }
    this.pos++
  }
}

export function evaluate(src: string, opts: EvalOptions = {}): EvalResult {
  try {
    const value = new Parser(tokenize(src), opts.angle ?? 'deg', opts.ans ?? 0).parse()
    if (Number.isNaN(value)) return { ok: false, error: 'Not a number' }
    if (!Number.isFinite(value)) return { ok: false, error: 'Result is too large' }
    return { ok: true, value }
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message }
    return { ok: false, error: 'Could not read this expression' }
  }
}

/** Trim floating-point noise: 0.1+0.2 shows 0.3. Very large or tiny values use exponent form. */
export function formatNumber(x: number): string {
  if (!Number.isFinite(x)) return String(x)
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (Number.isInteger(x) && a < 1e15) return String(x)
  if (a >= 1e15 || a < 1e-9) return x.toExponential(10).replace(/\.?0+e/, 'e').replace('e+', 'e')
  return String(Number(x.toPrecision(12)))
}
