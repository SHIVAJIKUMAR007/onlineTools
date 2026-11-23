// General-purpose SQL formatter. It tokenizes and lays out text; it does not validate any dialect.

export type KeywordCase = 'upper' | 'lower' | 'keep'

export interface SqlOptions {
  keywordCase: KeywordCase
  indent: number
}

type Kind = 'str' | 'qid' | 'num' | 'word' | 'op' | 'punct' | 'lc' | 'bc'
interface Tok {
  kind: Kind
  text: string
  unary?: boolean
}

const OPS = ['<=>', '->>', '<=', '>=', '<>', '!=', '||', '::', '->', ':=', '==', '<<', '>>']

export function tokenizeSql(sql: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = sql.length
  while (i < n) {
    const c = sql[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '-' && sql[i + 1] === '-') {
      let j = i
      while (j < n && sql[j] !== '\n') j++
      toks.push({ kind: 'lc', text: sql.slice(i, j).trimEnd() })
      i = j
      continue
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const j = end === -1 ? n : end + 2
      toks.push({ kind: 'bc', text: sql.slice(i, j) })
      i = j
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < n) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j += 2
            continue
          }
          j++
          break
        }
        if (sql[j] === '\\' && c === "'") j++
        j++
      }
      toks.push({ kind: c === "'" ? 'str' : 'qid', text: sql.slice(i, Math.min(j, n)) })
      i = j
      continue
    }
    if (c === '[' && /^\[[^\]\n]*\]/.test(sql.slice(i, i + 80)) && /[A-Za-z_]/.test(sql[i + 1] ?? '')) {
      const j = sql.indexOf(']', i) + 1
      toks.push({ kind: 'qid', text: sql.slice(i, j) })
      i = j
      continue
    }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(sql.slice(i, i + 40))
    if (num && /\d/.test(num[0])) {
      toks.push({ kind: 'num', text: num[0] })
      i += num[0].length
      continue
    }
    const w = /^[A-Za-z_@#$\u0080-￿][\w@#$\u0080-￿]*/.exec(sql.slice(i))
    if (w) {
      toks.push({ kind: 'word', text: w[0] })
      i += w[0].length
      continue
    }
    if (c === ':' && /[A-Za-z_]/.test(sql[i + 1] ?? '') && sql[i - 1] !== ':') {
      const m = /^:\w+/.exec(sql.slice(i))!
      toks.push({ kind: 'word', text: m[0] })
      i += m[0].length
      continue
    }
    if (c === '$' || c === '?') {
      const m = /^[$?]\w*/.exec(sql.slice(i))!
      toks.push({ kind: 'word', text: m[0] })
      i += m[0].length
      continue
    }
    const op = OPS.find((o) => sql.startsWith(o, i))
    if (op) {
      toks.push({ kind: 'op', text: op })
      i += op.length
      continue
    }
    if ('(),;.'.includes(c)) toks.push({ kind: 'punct', text: c })
    else toks.push({ kind: 'op', text: c })
    i++
  }
  return toks
}

const KEYWORDS = new Set(
  `ADD ALL ALTER AND ANY AS ASC BETWEEN BY CASE CAST CHECK COLUMN CONSTRAINT CREATE CROSS DATABASE DEFAULT DELETE DESC DISTINCT DROP ELSE END EXCEPT EXISTS FALSE FETCH FOREIGN FROM FULL GROUP HAVING IF ILIKE IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY LEFT LIKE LIMIT NATURAL NOT NULL OFFSET ON OR ORDER OUTER OVER PARTITION PRIMARY REFERENCES REPLACE RETURNING RIGHT SELECT SET TABLE THEN TRUE TRUNCATE UNION UNIQUE UPDATE USING VALUES VIEW WHEN WHERE WITH COUNT SUM AVG MIN MAX`.split(/\s+/),
)
// Words after which an opening parenthesis is separated by a space.
const SPACE_BEFORE_PAREN = new Set(
  `ALL AND ANY AS BETWEEN BY CASE CROSS DISTINCT ELSE EXISTS FROM FULL HAVING IN INNER INTO IS JOIN LEFT LIKE NOT ON OR OUTER OVER PARTITION RIGHT SELECT SET THEN UNION USING VALUES WHEN WHERE WITH`.split(/\s+/),
)
const JOIN_MODS = new Set(['NATURAL', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER'])
const LISTY = new Set(['SELECT', 'FROM', 'GROUP BY', 'ORDER BY', 'SET', 'VALUES', 'WITH'])

const up = (t: Tok | undefined) => (t && t.kind === 'word' ? t.text.toUpperCase() : '')

interface Frame {
  sub: boolean
  defs: boolean
  base: number
  clause: string
  between: boolean
  caseDepth: number
  createTable: boolean
}

const frame = (sub: boolean, base: number, defs = false): Frame => ({ sub, defs, base, clause: '', between: false, caseDepth: 0, createTable: false })

export function formatSql(sql: string, o: SqlOptions): string {
  const toks = tokenizeSql(sql)
  if (!toks.length) return ''
  const unit = ' '.repeat(Math.max(1, Math.min(8, o.indent)))
  const kw = (w: string) => (o.keywordCase === 'keep' || !KEYWORDS.has(w.toUpperCase()) ? w : o.keywordCase === 'upper' ? w.toUpperCase() : w.toLowerCase())
  const cased = (w: string) => (o.keywordCase === 'lower' ? w.toLowerCase() : o.keywordCase === 'upper' ? w.toUpperCase() : w)

  let out = ''
  let curIndent = 0
  let pending: number | null = null
  let blank = false
  let prev: Tok | null = null
  const frames: Frame[] = [frame(true, 0)]
  const top = () => frames[frames.length - 1]

  const nl = (level: number) => {
    pending = Math.max(0, level)
  }
  const needSpace = (a: Tok, b: Tok, spaceParen: boolean): boolean => {
    if (a.text === '(' || b.text === ')' || b.text === ',' || b.text === ';') return false
    if (a.text === '.' || b.text === '.' || a.text === '::' || b.text === '::') return false
    if (a.unary) return false
    if (b.text === '(' && b.kind === 'punct') {
      if (a.kind === 'word') return spaceParen || SPACE_BEFORE_PAREN.has(a.text.toUpperCase())
      if (a.kind === 'qid') return spaceParen
      return true
    }
    return true
  }
  const put = (text: string, tok: Tok, spaceParen = false) => {
    if (pending !== null && out) {
      out = out.trimEnd() + '\n' + (blank ? '\n' : '') + unit.repeat(pending)
      curIndent = pending
    } else if (prev && out && needSpace(prev, tok, spaceParen)) out += ' '
    pending = null
    blank = false
    out += text
    prev = { ...tok, text: tok.text }
  }

  const peekWord = (i: number, ...words: string[]) => words.every((w, k) => up(toks[i + k]) === w)

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const f = top()
    if (t.kind === 'lc') {
      put(t.text, t)
      nl(curIndent)
      continue
    }
    if (t.kind === 'bc') {
      put(t.text, t)
      continue
    }
    if (t.kind === 'punct') {
      if (t.text === '(') {
        const nextW = up(toks[i + 1])
        const spaceParen = /^(INSERT|CREATE)/.test(f.clause)
        if (nextW === 'SELECT' || nextW === 'WITH') {
          put('(', t, spaceParen)
          frames.push(frame(true, curIndent + 1))
        } else if (f.sub && f.clause === 'CREATE' && f.createTable) {
          put('(', t, true)
          frames.push(frame(false, curIndent + 1, true))
          nl(curIndent + 1)
        } else {
          put('(', t, spaceParen)
          frames.push(frame(false, curIndent + 1))
        }
        continue
      }
      if (t.text === ')') {
        if (frames.length > 1) {
          const closed = frames.pop()!
          if (closed.sub || closed.defs) nl(closed.base - 1)
        }
        put(')', t)
        continue
      }
      if (t.text === ',') {
        put(',', t)
        if (f.defs) nl(f.base)
        else if (f.sub && LISTY.has(f.clause)) nl(f.base + 1)
        continue
      }
      if (t.text === ';') {
        put(';', t)
        while (frames.length > 1) frames.pop()
        frames[0] = frame(true, 0)
        nl(0)
        blank = true
        continue
      }
      put(t.text, t)
      continue
    }
    if (t.kind === 'op') {
      let unary = false
      if ((t.text === '-' || t.text === '+') && (!prev || prev.kind === 'op' || prev.text === '(' || prev.text === ',' || (prev.kind === 'word' && KEYWORDS.has(prev.text.toUpperCase()) && !['END', 'NULL', 'TRUE', 'FALSE'].includes(prev.text.toUpperCase())))) unary = true
      put(t.text, { ...t, unary })
      if (unary) prev = { ...t, unary: true }
      continue
    }
    if (t.kind !== 'word') {
      put(t.text, t)
      continue
    }

    const w = t.text.toUpperCase()
    const prevW = up(prev ?? undefined)
    const clauseOK = f.sub

    const clause = (words: string[], text: string) => {
      if (out) nl(f.base)
      put(text, t)
      f.clause = words.join(' ')
      i += words.length - 1
    }

    if (clauseOK) {
      if (w === 'SELECT') {
        clause(['SELECT'], cased(t.text))
        if (up(toks[i + 1]) === 'DISTINCT' || up(toks[i + 1]) === 'ALL') {
          i++
          put(cased(toks[i].text), toks[i])
        }
        nl(f.base + 1)
        continue
      }
      if (w === 'FROM' && prevW !== 'DISTINCT') {
        clause(['FROM'], cased(t.text))
        continue
      }
      if (w === 'WHERE' || w === 'HAVING' || w === 'LIMIT' || w === 'OFFSET' || w === 'RETURNING' || w === 'WITH') {
        clause([w], cased(t.text))
        if (w === 'WITH' && up(toks[i + 1]) === 'RECURSIVE') {
          i++
          put(cased(toks[i].text), toks[i])
        }
        continue
      }
      if ((w === 'GROUP' || w === 'ORDER') && peekWord(i, w, 'BY')) {
        clause([w, 'BY'], `${cased(t.text)} ${cased(toks[i + 1].text)}`)
        continue
      }
      if (w === 'INSERT' && peekWord(i, 'INSERT', 'INTO')) {
        clause(['INSERT', 'INTO'], `${cased(t.text)} ${cased(toks[i + 1].text)}`)
        continue
      }
      if (w === 'DELETE' && peekWord(i, 'DELETE', 'FROM')) {
        clause(['DELETE', 'FROM'], `${cased(t.text)} ${cased(toks[i + 1].text)}`)
        continue
      }
      if (w === 'UPDATE' && !['FOR', 'ON', 'KEY'].includes(prevW)) {
        clause(['UPDATE'], cased(t.text))
        continue
      }
      if (w === 'SET' && f.clause === 'UPDATE') {
        clause(['SET'], cased(t.text))
        continue
      }
      if (w === 'VALUES') {
        clause(['VALUES'], cased(t.text))
        continue
      }
      if (w === 'CREATE') {
        clause(['CREATE'], cased(t.text))
        continue
      }
      if (w === 'UNION' || w === 'INTERSECT' || w === 'EXCEPT' || w === 'MINUS') {
        if (out) nl(f.base)
        put(cased(t.text), t)
        f.clause = w
        if (w === 'UNION' && up(toks[i + 1]) === 'ALL') {
          i++
          put(cased(toks[i].text), toks[i])
        }
        nl(f.base)
        continue
      }
      if (JOIN_MODS.has(w) || w === 'JOIN') {
        let j = i
        const words: string[] = []
        while (JOIN_MODS.has(up(toks[j]))) words.push(toks[j++].text)
        if (up(toks[j]) === 'JOIN') {
          words.push(toks[j].text)
          nl(f.base + 1)
          put(words.map(cased).join(' '), t)
          f.clause = 'JOIN'
          i = j
          continue
        }
      }
      if (w === 'ON' && f.clause === 'JOIN') {
        put(cased(t.text), t)
        f.clause = 'ON'
        continue
      }
      if ((w === 'AND' || w === 'OR') && (f.clause === 'WHERE' || f.clause === 'HAVING' || f.clause === 'ON') && f.caseDepth === 0) {
        if (w === 'AND' && f.between) {
          f.between = false
        } else {
          nl(f.base + (f.clause === 'ON' ? 2 : 1))
        }
        put(cased(t.text), t)
        continue
      }
    }
    if (w === 'BETWEEN') f.between = true
    if (w === 'CASE') f.caseDepth++
    if (w === 'END' && f.caseDepth > 0) f.caseDepth--
    if (w === 'TABLE' && f.clause === 'CREATE') f.createTable = true
    put(kw(t.text), t)
  }
  return out.trim() + '\n'
}

export function minifySql(sql: string): string {
  const toks = tokenizeSql(sql).filter((t) => t.kind !== 'lc' && t.kind !== 'bc')
  let out = ''
  let prev = ''
  for (const t of toks) {
    const a = prev.slice(-1)
    const b = t.text[0]
    const word = /[\w$@#'"`?\u0080-￿]/
    const need = (word.test(a) && word.test(b)) || (a === '-' && b === '-') || (a === '/' && b === '*') || (a === '<' && b === '>') || (a === '-' && b === '>')
    if (out && need) out += ' '
    out += t.text
    prev = t.text
  }
  return out
}
