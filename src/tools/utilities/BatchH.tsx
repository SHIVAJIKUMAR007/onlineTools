import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Upload, Download as DownloadIcon } from 'lucide-react'
import { Panel, CopyButton, DownloadButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Badge, Alert } from '@/components/ui/misc'
import { Input, Textarea, Segmented } from '@/components/ui/fields'
import { downloadText } from '@/lib/utils/download'
import { cn } from '@/lib/utils/cn'
import {
  NOTES_KEY, TODO_KEY, addNote, addTask, clearCompleted, countChars, countWords, editTask, exportTodos, filterNotes, filterTasks,
  isOverdue, localDateString, mergeTasks, moveVisible, noteFilename, parseNotes, parseTodoImport, parseTodos, removeNote, removeTask,
  renameNote, serializeNotes, serializeTodos, setNoteText, taskCounts, toggleTask, type Note, type Task, type TaskFilter,
} from '@/lib/utilities/batchH'

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Debounced localStorage writer. Reports failure so the UI can say "not saving". */
function usePersist(key: string, ready: boolean, value: string, onFail: (failed: boolean) => void) {
  const latest = useRef(value)
  const pending = useRef(false)
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  })
  useEffect(() => {
    latest.current = value
  }, [value])

  const write = () => {
    pending.current = false
    try {
      window.localStorage.setItem(key, latest.current)
      failRef.current(false)
    } catch {
      failRef.current(true)
    }
  }

  useEffect(() => {
    if (!ready) return
    pending.current = true
    const id = window.setTimeout(write, 400)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready, key])

  // Flush a pending save when leaving the page or unmounting.
  useEffect(() => {
    const flush = () => {
      if (pending.current) write()
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

// ───────────── Online notepad ─────────────
export function OnlineNotepad() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let loaded: Note[] = []
    try {
      loaded = parseNotes(window.localStorage.getItem(NOTES_KEY))
    } catch {
      setFailed(true)
    }
    if (loaded.length === 0) loaded = addNote([], newId(), Date.now())
    setNotes(loaded)
    setSelected(loaded[0].id)
    setReady(true)
  }, [])

  usePersist(NOTES_KEY, ready, useMemo(() => serializeNotes(notes), [notes]), setFailed)

  const current = notes.find((n) => n.id === selected) ?? null
  const shown = useMemo(() => filterNotes(notes, query), [notes, query])
  const text = current?.text ?? ''

  const create = () => {
    const id = newId()
    setNotes((n) => addNote(n, id, Date.now()))
    setSelected(id)
    setQuery('')
    setConfirmDelete(null)
  }
  const doDelete = (id: string) => {
    const r = removeNote(notes, id)
    if (r.notes.length === 0) {
      const nid = newId()
      setNotes(addNote([], nid, Date.now()))
      setSelected(nid)
    } else {
      setNotes(r.notes)
      setSelected(r.selected)
    }
    setConfirmDelete(null)
  }
  const commitRename = () => {
    if (renaming) setNotes((n) => renameNote(n, renaming, draft))
    setRenaming(null)
  }

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Notes stay in this browser on this device">
        Your notes are saved in this browser&apos;s local storage. They are not uploaded, not backed up and not encrypted. Clearing site data or switching browser or device loses them, so download anything important.
      </Alert>
      {failed && (
        <Alert tone="warn" title="Not saving" role="alert">
          This browser is blocking storage, so your notes will be lost when you close or reload the page. You can still write, copy and download.
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
        <Panel
          title="Notes"
          actions={
            <Button size="sm" variant="primary" onClick={create} disabled={!ready}>
              <Plus className="size-4" aria-hidden /> New note
            </Button>
          }
        >
          <label htmlFor="note-search" className="sr-only">Search notes</label>
          <Input id="note-search" type="search" placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto md:max-h-[28rem]" aria-label="Your notes">
            {shown.map((n) => (
              <li key={n.id}>
                {renaming === n.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      commitRename()
                    }}
                    className="flex gap-1"
                  >
                    <Input aria-label="Note name" autoFocus value={draft} maxLength={100} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} />
                    <Button size="sm" variant="primary" type="submit">Save</Button>
                  </form>
                ) : confirmDelete === n.id ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm">
                    <span>Delete this note?</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="danger" onClick={() => doDelete(n.id)}>Delete</Button>
                      <Button size="sm" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    </span>
                  </div>
                ) : (
                  <div className={cn('flex items-center gap-1 rounded-lg', n.id === selected && 'bg-accent-tint')}>
                    <button type="button" aria-current={n.id === selected} onClick={() => setSelected(n.id)} className="min-w-0 flex-1 cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <span className="block truncate font-medium">{n.title}</span>
                      <span className="block truncate text-xs text-muted">{n.text.trim().slice(0, 40) || 'Empty'}</span>
                    </button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Rename ${n.title}`} onClick={() => { setRenaming(n.id); setDraft(n.title) }}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${n.title}`} onClick={() => setConfirmDelete(n.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            ))}
            {ready && shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">No notes match.</li>}
          </ul>
        </Panel>
        <Panel
          title={current?.title ?? 'Note'}
          actions={
            <div className="flex flex-wrap gap-2">
              <CopyButton text={text} disabled={!text} />
              <DownloadButton size="sm" variant="secondary" disabled={!current} onClick={() => { if (current) downloadText(current.text, noteFilename(current.title)) }}>
                Download .txt
              </DownloadButton>
            </div>
          }
        >
          <label htmlFor="note-text" className="sr-only">Note text</label>
          <Textarea
            id="note-text"
            spellCheck
            className="min-h-72 font-sans text-sm md:min-h-96"
            placeholder="Start typing. Changes save automatically in this browser."
            disabled={!current}
            value={text}
            onChange={(e) => current && setNotes((n) => setNoteText(n, current.id, e.target.value, Date.now()))}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
            <Badge>{countWords(text)} words</Badge>
            <Badge>{countChars(text)} characters</Badge>
            <span>{failed ? 'Not saving' : ready ? 'Saved in this browser' : 'Loading'}</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ───────────── To-do list ─────────────
export function TodoList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [today, setToday] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDue, setEditDue] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      setTasks(parseTodos(window.localStorage.getItem(TODO_KEY)))
    } catch {
      setFailed(true)
    }
    setToday(localDateString(new Date()))
    setReady(true)
  }, [])

  usePersist(TODO_KEY, ready, useMemo(() => serializeTodos(tasks), [tasks]), setFailed)

  const counts = taskCounts(tasks)
  const visible = filterTasks(tasks, filter)

  const add = () => {
    if (!text.trim()) return
    setTasks((t) => addTask(t, newId(), text, due || null, Date.now()))
    setText('')
    setDue('')
  }
  const saveEdit = () => {
    if (editing) setTasks((t) => editTask(t, editing, { text: editText, due: editDue || null }))
    setEditing(null)
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const r = parseTodoImport(await file.text())
      if (r.ok) {
        setTasks((t) => mergeTasks(t, r.tasks))
        setMessage({ tone: 'success', text: `Imported ${r.tasks.length} task${r.tasks.length === 1 ? '' : 's'}.` })
      } else setMessage({ tone: 'danger', text: r.error })
    } catch {
      setMessage({ tone: 'danger', text: 'Could not read that file.' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Tasks stay in this browser on this device">
        Your list is saved in local storage here. It is not uploaded or backed up, and clearing site data removes it. Use Export to keep a copy.
      </Alert>
      {failed && (
        <Alert tone="warn" title="Not saving" role="alert">
          This browser is blocking storage, so the list will be lost when you leave. Use Export to keep a copy.
        </Alert>
      )}
      <Panel>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label htmlFor="todo-new" className="sr-only">New task</label>
          <Input id="todo-new" className="flex-1" placeholder="Add a task" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          <label htmlFor="todo-due" className="sr-only">Due date (optional)</label>
          <Input id="todo-due" type="date" className="sm:w-44" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </form>
      </Panel>
      <Panel
        title="Tasks"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Filter tasks"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All (${counts.total})` },
                { value: 'active', label: `Active (${counts.active})` },
                { value: 'done', label: `Done (${counts.done})` },
              ]}
            />
          </div>
        }
      >
        {visible.length === 0 ? (
          <p className="text-sm text-muted">{counts.total === 0 ? 'No tasks yet. Add your first one above.' : 'Nothing in this view.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((t, i) => {
              const overdue = today ? isOverdue(t, today) : false
              return (
                <li key={t.id} className="py-2">
                  {editing === t.id ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveEdit()
                      }}
                    >
                      <Input aria-label="Task text" autoFocus className="flex-1" value={editText} maxLength={500} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                      <Input aria-label="Due date" type="date" className="sm:w-44" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                      <Button type="submit" variant="primary">Save</Button>
                      <Button onClick={() => setEditing(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="size-5 shrink-0 cursor-pointer" aria-label={`Mark done: ${t.text}`} checked={t.done} onChange={() => setTasks((l) => toggleTask(l, t.id))} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('break-words text-sm', t.done && 'text-muted line-through')}>{t.text}</p>
                        {t.due && (
                          <Badge tone={overdue ? 'danger' : 'neutral'} className="mt-1">
                            {overdue ? 'Overdue: ' : 'Due '}
                            {t.due}
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button size="icon-sm" variant="ghost" aria-label={`Move up: ${t.text}`} disabled={i === 0} onClick={() => setTasks((l) => moveVisible(l, filter, t.id, -1))}>
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Move down: ${t.text}`} disabled={i === visible.length - 1} onClick={() => setTasks((l) => moveVisible(l, filter, t.id, 1))}>
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit: ${t.text}`} onClick={() => { setEditing(t.id); setEditText(t.text); setEditDue(t.due ?? '') }}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete: ${t.text}`} onClick={() => setTasks((l) => removeTask(l, t.id))}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-auto text-sm text-muted" aria-live="polite">
            {counts.active} left, {counts.done} done
          </span>
          <Button size="sm" disabled={counts.done === 0} onClick={() => setTasks((l) => clearCompleted(l))}>Clear completed</Button>
          <Button size="sm" disabled={tasks.length === 0} onClick={() => downloadText(exportTodos(tasks), 'todo-list.json', 'application/json')}>
            <DownloadIcon className="size-4" aria-hidden /> Export JSON
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden /> Import JSON
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Import tasks from a JSON file" onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
        {message && <Alert tone={message.tone} className="mt-3">{message.text}</Alert>}
      </Panel>
    </div>
  )
}
