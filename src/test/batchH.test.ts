import { describe, expect, it } from 'vitest'
import {
  addNote, addStroke, addTask, clearCompleted, countChars, countWords, deviceRows, deviceText, editTask, emptyHistory, exportTodos,
  filterNotes, filterTasks, isDateString, isOverdue, mergeTasks, moveTask, moveVisible, nextNoteTitle, noteFilename, parseNotes,
  parseTodoImport, parseTodos, pressureWidth, readDevice, redoStroke, removeNote, removeTask, renameNote, serializeNotes,
  serializeTodos, setNoteText, stepIndex, taskCounts, toggleTask, undoStroke, MAX_REDO, MAX_STROKES, TEST_COLORS,
  type Stroke, type Task,
} from '@/lib/utilities/batchH'

describe('notepad', () => {
  it('survives corrupt or odd storage', () => {
    expect(parseNotes(null)).toEqual([])
    expect(parseNotes('')).toEqual([])
    expect(parseNotes('{not json')).toEqual([])
    expect(parseNotes('42')).toEqual([])
    expect(parseNotes('{"notes":"x"}')).toEqual([])
  })
  it('drops invalid and duplicate notes and fixes titles', () => {
    const raw = JSON.stringify({ notes: [{ id: 'a', title: '  ', text: 'hi' }, { id: 'a', text: 'dup' }, { id: 'b' }, 5, { id: 'c', title: 'T', text: 'x', updated: 'bad' }] })
    const n = parseNotes(raw)
    expect(n.map((x) => x.id)).toEqual(['a', 'c'])
    expect(n[0].title).toBe('Untitled')
    expect(n[1].updated).toBe(0)
  })
  it('round-trips', () => {
    const notes = addNote([], 'a', 5)
    expect(parseNotes(serializeNotes(notes))).toEqual(notes)
  })
  it('names new notes uniquely and renames', () => {
    let n = addNote([], 'a', 1)
    n = addNote(n, 'b', 2)
    expect(n[0].title).toBe('Untitled note 2')
    expect(nextNoteTitle(n)).toBe('Untitled note 3')
    expect(renameNote(n, 'a', '  Shopping ')[1].title).toBe('Shopping')
    expect(renameNote(n, 'a', '   ')).toBe(n)
  })
  it('deletes and picks a neighbour', () => {
    let n = addNote([], 'a', 1)
    n = addNote(n, 'b', 2)
    n = addNote(n, 'c', 3) // c b a
    expect(removeNote(n, 'b').selected).toBe('a')
    expect(removeNote(n, 'a').selected).toBe('b')
    const one = addNote([], 'x', 1)
    expect(removeNote(one, 'x')).toEqual({ notes: [], selected: null })
  })
  it('edits text, searches, counts', () => {
    const n = setNoteText(addNote([], 'a', 1), 'a', 'Hello big world', 9)
    expect(n[0].updated).toBe(9)
    expect(filterNotes(n, 'BIG')).toHaveLength(1)
    expect(filterNotes(n, 'zzz')).toHaveLength(0)
    expect(filterNotes(n, '  ')).toBe(n)
    expect(countWords('')).toBe(0)
    expect(countWords('  a  b\nc ')).toBe(3)
    expect(countChars('a😀')).toBe(2)
  })
  it('builds safe filenames', () => {
    expect(noteFilename('My: note/1')).toBe('My-note1.txt')
    expect(noteFilename('???')).toBe('note.txt')
  })
})

const mk = (n: number): Task[] => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, text: `task ${i}`, done: false, due: null, created: i }))

describe('todo', () => {
  it('parses corrupt storage and cleans entries', () => {
    expect(parseTodos('garbage')).toEqual([])
    expect(parseTodos(null)).toEqual([])
    const t = parseTodos(JSON.stringify([{ id: 'a', text: ' x ', done: 'yes', due: '2024-13-40' }, { text: '' }, { id: 'a', text: 'dup id' }]))
    expect(t).toHaveLength(2)
    expect(t[0]).toMatchObject({ text: 'x', done: false, due: null })
    expect(new Set(t.map((x) => x.id)).size).toBe(2)
  })
  it('validates dates', () => {
    expect(isDateString('2024-02-29')).toBe(true)
    expect(isDateString('2023-02-29')).toBe(false)
    expect(isDateString('tomorrow')).toBe(false)
  })
  it('adds, edits, toggles, removes', () => {
    let t = addTask([], 'a', '  Buy milk ', '2025-01-02', 1)
    expect(addTask(t, 'b', '   ', null, 2)).toBe(t)
    t = editTask(t, 'a', { text: 'Buy oat milk', due: null })
    expect(t[0]).toMatchObject({ text: 'Buy oat milk', due: null })
    expect(editTask(t, 'a', { text: '  ' })[0].text).toBe('Buy oat milk')
    t = toggleTask(t, 'a')
    expect(t[0].done).toBe(true)
    expect(removeTask(t, 'a')).toEqual([])
  })
  it('filters, counts, clears', () => {
    const t = toggleTask(mk(3), 't1')
    expect(filterTasks(t, 'active').map((x) => x.id)).toEqual(['t0', 't2'])
    expect(filterTasks(t, 'done').map((x) => x.id)).toEqual(['t1'])
    expect(taskCounts(t)).toEqual({ total: 3, done: 1, active: 2 })
    expect(taskCounts([])).toEqual({ total: 0, done: 0, active: 0 })
    expect(clearCompleted(t)).toHaveLength(2)
  })
  it('moves tasks and respects bounds', () => {
    const t = mk(3)
    expect(moveTask(t, 't1', -1).map((x) => x.id)).toEqual(['t1', 't0', 't2'])
    expect(moveTask(t, 't0', -1)).toBe(t)
    expect(moveTask(t, 't2', 1)).toBe(t)
    expect(moveTask(t, 'nope', 1)).toBe(t)
  })
  it('moves within a filtered view', () => {
    let t = mk(4)
    t = toggleTask(t, 't1') // t0 active, t1 done, t2 active, t3 active
    expect(moveVisible(t, 'active', 't2', -1).map((x) => x.id)).toEqual(['t2', 't1', 't0', 't3'])
    expect(moveVisible(t, 'active', 't0', -1)).toBe(t)
  })
  it('flags overdue only for open dated tasks', () => {
    const base = { id: 'a', text: 'x', created: 0 }
    expect(isOverdue({ ...base, done: false, due: '2024-01-01' }, '2024-01-02')).toBe(true)
    expect(isOverdue({ ...base, done: false, due: '2024-01-02' }, '2024-01-02')).toBe(false)
    expect(isOverdue({ ...base, done: true, due: '2024-01-01' }, '2024-01-02')).toBe(false)
    expect(isOverdue({ ...base, done: false, due: null }, '2024-01-02')).toBe(false)
  })
  it('validates imports', () => {
    expect(parseTodoImport('nope')).toMatchObject({ ok: false })
    expect(parseTodoImport('{"a":1}')).toMatchObject({ ok: false })
    expect(parseTodoImport('[{"x":1}]')).toMatchObject({ ok: false })
    expect(parseTodoImport('[]')).toEqual({ ok: true, tasks: [] })
    const r = parseTodoImport(exportTodos(mk(2)))
    expect(r.ok && r.tasks).toHaveLength(2)
    expect(parseTodos(serializeTodos(mk(2)))).toHaveLength(2)
  })
  it('merges imports with unique ids', () => {
    const m = mergeTasks(mk(2), mk(2))
    expect(m).toHaveLength(4)
    expect(new Set(m.map((x) => x.id)).size).toBe(4)
  })
})

const stroke = (c = '#000000'): Stroke => ({ tool: 'brush', color: c, size: 4, points: [{ x: 1, y: 1, p: 0.5 }] })

describe('stroke history', () => {
  it('undoes and redoes within bounds', () => {
    let h = emptyHistory()
    expect(undoStroke(h)).toBe(h)
    expect(redoStroke(h)).toBe(h)
    h = addStroke(addStroke(h, stroke('#111111')), stroke('#222222'))
    h = undoStroke(h)
    expect(h.strokes).toHaveLength(1)
    expect(h.redo).toHaveLength(1)
    h = redoStroke(h)
    expect(h.strokes[1].color).toBe('#222222')
    h = undoStroke(h)
    h = addStroke(h, stroke())
    expect(h.redo).toEqual([])
  })
  it('ignores empty strokes and caps sizes', () => {
    const h = emptyHistory()
    expect(addStroke(h, { ...stroke(), points: [] })).toBe(h)
    let big = emptyHistory()
    for (let i = 0; i < MAX_STROKES + 5; i++) big = addStroke(big, stroke())
    expect(big.strokes).toHaveLength(MAX_STROKES)
    for (let i = 0; i < MAX_REDO + 5; i++) big = undoStroke(big)
    expect(big.redo).toHaveLength(MAX_REDO)
  })
  it('maps pen pressure', () => {
    expect(pressureWidth(10, 0.5, 'mouse')).toBe(10)
    expect(pressureWidth(10, 0, 'pen')).toBe(10)
    expect(pressureWidth(10, 1, 'pen')).toBeGreaterThan(pressureWidth(10, 0.2, 'pen'))
  })
})

describe('dead pixel colours', () => {
  it('wraps indexes', () => {
    expect(stepIndex(0, -1, 9)).toBe(8)
    expect(stepIndex(8, 1, 9)).toBe(0)
    expect(stepIndex(3, 1, 0)).toBe(0)
    expect(TEST_COLORS.slice(0, 5).map((c) => c.id)).toEqual(['black', 'white', 'red', 'green', 'blue'])
  })
})

describe('device info', () => {
  it('reads defensively from a bare window', () => {
    const i = readDevice({})
    expect(i.screenWidth).toBe(0)
    expect(i.cores).toBeNull()
    expect(i.languages).toEqual([])
    expect(deviceText(i)).toContain('Not available')
  })
  it('formats rows', () => {
    const i = readDevice({
      screen: { width: 1000, height: 500, availWidth: 1000, availHeight: 460, colorDepth: 24 },
      innerWidth: 900,
      innerHeight: 400,
      devicePixelRatio: 1.5,
      matchMedia: (q: string) => ({ matches: q.includes('dark') }),
    })
    const rows = deviceRows(i)
    expect(rows.find((r) => r.label === 'Approx. physical pixels')?.value).toBe('1500 x 750')
    expect(i.colorScheme).toBe('Dark')
    expect(i.orientation).toBe('landscape')
    expect(deviceText(i).split('\n')).toHaveLength(rows.length)
  })
})
