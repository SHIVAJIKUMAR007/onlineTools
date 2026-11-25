import { useMemo, useState } from 'react'
import { Panel } from '@/components/tools/controls'
import { Field, Input, Switch } from '@/components/ui/fields'
import { Alert, Stat } from '@/components/ui/misc'
import { checkAnagram, defaultAnagramOptions, type AnagramOptions } from '@/lib/text/anagram'

const show = (pairs: Array<[string, number]>) => pairs.map(([c, n]) => (n > 1 ? `${c === ' ' ? '(space)' : c} ×${n}` : c === ' ' ? '(space)' : c)).join(', ')

export default function AnagramChecker() {
  const [a, setA] = useState('Listen')
  const [b, setB] = useState('Silent')
  const [opts, setOpts] = useState<AnagramOptions>(defaultAnagramOptions)
  const set = (k: keyof AnagramOptions) => (v: boolean) => setOpts((o) => ({ ...o, [k]: v }))
  const r = useMemo(() => checkAnagram(a, b, opts), [a, b, opts])
  const empty = r.lengthA === 0 && r.lengthB === 0

  return (
    <Panel title="Anagram checker">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First word or phrase">{(id) => <Input id={id} value={a} onChange={(e) => setA(e.target.value)} />}</Field>
          <Field label="Second word or phrase">{(id) => <Input id={id} value={b} onChange={(e) => setB(e.target.value)} />}</Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Switch checked={opts.ignoreCase} onChange={set('ignoreCase')} label="Ignore case" />
          <Switch checked={opts.lettersOnly} onChange={set('lettersOnly')} label="Ignore spaces and punctuation" />
          <Switch checked={opts.stripAccents} onChange={set('stripAccents')} label="Ignore accents" />
        </div>
        {empty ? (
          <Alert>Type two words or phrases to compare them.</Alert>
        ) : r.isAnagram && r.identical ? (
          <Alert tone="warn" title="Same letters in the same order">These are identical once the options are applied. They match, but a word is not usually called an anagram of itself.</Alert>
        ) : r.isAnagram ? (
          <Alert tone="success" title="Yes, these are anagrams">Both use exactly the same {r.lengthA} characters.</Alert>
        ) : (
          <Alert tone="danger" title="No, these are not anagrams">
            {r.onlyInA.length > 0 && <p>Only in the first: {show(r.onlyInA)}</p>}
            {r.onlyInB.length > 0 && <p>Only in the second: {show(r.onlyInB)}</p>}
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Characters compared (first)" value={r.lengthA} />
          <Stat label="Characters compared (second)" value={r.lengthB} />
        </div>
      </div>
    </Panel>
  )
}
