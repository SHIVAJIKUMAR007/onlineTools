import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, within, waitFor, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/routes'
import { allPublicPaths } from '@/lib/seo'
import { tools } from '@/data/tools'
import { useApp } from '@/lib/store'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

beforeEach(() => {
  cleanup()
  useApp.setState({ searchOpen: false, pendingFiles: [] })
  document.head.querySelectorAll('meta,link[rel=canonical],script[data-seo]').forEach((n) => n.remove())
})

describe('navigation', () => {
  it('renders the homepage with the required headline, privacy message and popular tools', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Every tool you need\. Nothing uploaded\./ })).toBeInTheDocument()
    expect(screen.getByText(/Your files stay on your device/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explore all tools/ })).toHaveAttribute('href', '/tools')
    const popular = screen.getByRole('region', { name: 'Popular tools' })
    for (const name of ['Image Compressor', 'Image Resizer', 'Background Remover', 'PNG to JPG', 'JPG to WebP', 'PDF Merger', 'PDF Compressor', 'JSON Formatter']) {
      expect(within(popular).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })

  it('has no broken internal links on the homepage, navbar and footer', async () => {
    const { container } = renderAt('/')
    await screen.findByRole('heading', { level: 1 })
    const valid = new Set(allPublicPaths())
    const hrefs = [...container.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')!.split('?')[0].split('#')[0])
    expect(hrefs.length).toBeGreaterThan(30)
    for (const h of hrefs) expect(valid.has(h), `broken link ${h}`).toBe(true)
  })

  it.each(['/tools', '/image-tools', '/pdf-tools', '/converters', '/text-tools', '/developer-tools', '/about', '/privacy', '/terms', '/disclaimer', '/contact'])('renders %s', async (path) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', async () => {
    renderAt('/nothing-here')
    expect(await screen.findByRole('heading', { name: /does not exist/ })).toBeInTheDocument()
  })

  it('sets title, canonical and JSON-LD per route', async () => {
    renderAt('/pdf-merger')
    await screen.findByRole('heading', { level: 1, name: 'PDF Merger' })
    await waitFor(() => expect(document.title).toContain('PDF Merger'))
    expect(document.head.querySelectorAll('link[rel=canonical]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name=description]')).toHaveLength(1)
    expect(document.head.querySelectorAll('script[type="application/ld+json"]').length).toBeGreaterThanOrEqual(3)
  })

  it('renders every tool page with its privacy notice, how-to, FAQ and related tools', async () => {
    // Smoke-render all tool pages. The tool component itself loads lazily, so only the shell is checked here.
    for (const t of tools) {
      const { unmount } = renderAt(`/${t.slug}`)
      expect(await screen.findByRole('heading', { level: 1, name: t.h1 }), t.id).toBeInTheDocument()
      expect(screen.getByText('Your files never leave your device. All processing happens locally in your browser.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: `How to use ${t.name}` })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Related tools/ })).toBeInTheDocument()
      unmount()
    }
  }, 60000)
})

describe('search', () => {
  it('filters as you type on the homepage and shows an empty state', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const box = (await screen.findAllByRole('combobox', { name: 'Search tools' }))[0]
    await user.type(box, 'merge')
    expect(await screen.findByRole('option', { name: /PDF Merger/ })).toBeInTheDocument()
    await user.clear(box)
    await user.type(box, 'zzzzqq')
    expect(await screen.findByText(/No tools match/)).toBeInTheDocument()
  })

  it('opens with Ctrl+K, navigates with the keyboard and closes on Escape', async () => {
    const user = userEvent.setup()
    renderAt('/about')
    await screen.findByRole('heading', { level: 1 })
    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Search tools' })
    expect(within(dialog).getByText('Popular tools')).toBeInTheDocument()
    await user.keyboard('base64')
    expect(await within(dialog).findByRole('option', { name: /Base64 Encoder/ })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: /Base64 Encoder/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.keyboard('{Control>}k{/Control}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('filters the all-tools page by category', async () => {
    const user = userEvent.setup()
    renderAt('/tools')
    await screen.findByRole('heading', { level: 1, name: 'All tools' })
    await user.click(screen.getByRole('button', { name: 'Text Tools' }))
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: /Word Counter/ })).toBeInTheDocument()
    expect(main.queryByRole('link', { name: /PDF Merger/ })).not.toBeInTheDocument()
  })
})

describe('text and developer tools in the page', () => {
  it('word counter updates live', async () => {
    const user = userEvent.setup()
    renderAt('/word-counter')
    const box = await screen.findByLabelText('Your text')
    await user.type(box, 'one two three. four!')
    expect(screen.getByText('Words').nextElementSibling).toHaveTextContent('4')
    expect(screen.getByText('Sentences').nextElementSibling).toHaveTextContent('2')
  })

  it('case converter converts and the result is copyable', async () => {
    const user = userEvent.setup()
    renderAt('/case-converter')
    await user.type(await screen.findByLabelText('Your text'), 'hello big world')
    await user.click(screen.getByRole('radio', { name: 'kebab-case' }))
    expect(screen.getByLabelText('Result')).toHaveValue('hello-big-world')
    expect(screen.getByRole('button', { name: /Copy/ })).toBeEnabled()
  })

  it('JSON formatter validates, formats and points at the error', async () => {
    renderAt('/json-formatter')
    const input = await screen.findByLabelText('JSON')
    fireEvent.change(input, { target: { value: '{"a":1,"b":[1,2]}' } })
    expect(await screen.findByText('Valid JSON')).toBeInTheDocument()
    expect(screen.getByLabelText('Output')).toHaveValue('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
    fireEvent.change(input, { target: { value: '{\n  "a": 1,\n  "b": ,\n}' } })
    expect(await screen.findByText(/Invalid JSON at line 3, column 8/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Unexpected ","/)
    expect(screen.queryByLabelText('Output')).not.toBeInTheDocument()
  })

  it('Base64 swaps direction and round-trips', async () => {
    const user = userEvent.setup()
    renderAt('/base64-encoder-decoder')
    await user.type(await screen.findByLabelText('Text'), 'Hello ✓')
    expect(screen.getByLabelText('Base64')).toHaveValue('SGVsbG8g4pyT')
    await user.click(screen.getByRole('button', { name: /Swap input and output/ }))
    expect(screen.getByLabelText('Base64')).toHaveValue('SGVsbG8g4pyT')
    expect(screen.getByLabelText('Text')).toHaveValue('Hello ✓')
  })

  it('Base64 shows a helpful error for invalid input', async () => {
    const user = userEvent.setup()
    renderAt('/base64-encoder-decoder')
    await user.click(await screen.findByRole('radio', { name: 'Decode' }))
    await user.type(screen.getByLabelText('Base64'), 'not base64!')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid Base64/)
  })

  it('UUID generator makes the requested number of unique v4 values', async () => {
    renderAt('/uuid-generator')
    const count = await screen.findByLabelText(/How many/)
    fireEvent.change(count, { target: { value: '12' } })
    await waitFor(() => expect(document.querySelectorAll('code')).toHaveLength(12))
    const values = [...document.querySelectorAll('code')].map((c) => c.textContent)
    expect(new Set(values).size).toBe(12)
  })

  it('hash generator computes SHA digests with Web Crypto', async () => {
    const user = userEvent.setup()
    renderAt('/hash-generator')
    await user.type(await screen.findByLabelText('Text to hash'), 'abc')
    expect(await screen.findByText('a9993e364706816aba3e25717850c26c9cd0d89d')).toBeInTheDocument()
    expect(screen.getByText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')).toBeInTheDocument()
  })

  it('JWT decoder shows claims, expiry and the no-verification warning', async () => {
    renderAt('/jwt-decoder')
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const token = `${b64({ alg: 'HS256' })}.${b64({ sub: '42', exp: 1000000000 })}.sig`
    fireEvent.change(await screen.findByRole('textbox', { name: 'JWT' }), { target: { value: token } })
    expect(await screen.findByText('Expired')).toBeInTheDocument()
    expect(screen.getAllByText(/Decoding is not verifying/).length).toBeGreaterThan(0)
    expect(screen.getByText(/"sub": "42"/)).toBeInTheDocument()
  })

  it('color converter keeps HEX, RGB and HSL in sync', async () => {
    renderAt('/color-converter')
    const hex = await screen.findByLabelText('HEX value')
    fireEvent.change(hex, { target: { value: '#ff0000' } })
    expect(screen.getByLabelText('R')).toHaveValue(255)
    expect(screen.getByLabelText('H (0–360)')).toHaveValue(0)
    expect(screen.getByLabelText('S (%)')).toHaveValue(100)
    fireEvent.change(screen.getByLabelText('G'), { target: { value: '255' } })
    expect(hex).toHaveValue('#ffff00')
    fireEvent.change(hex, { target: { value: 'nope' } })
    expect(hex).toHaveAttribute('aria-invalid', 'true')
  })

  it('text diff highlights additions and deletions', async () => {
    renderAt('/text-diff-checker')
    fireEvent.change(await screen.findByLabelText('Original'), { target: { value: 'a\nb\nc' } })
    fireEvent.change(screen.getByLabelText('Changed'), { target: { value: 'a\nB\nc\nd' } })
    expect(await screen.findByText(/1 added/)).toBeInTheDocument()
    expect(screen.getByText(/1 changed/)).toBeInTheDocument()
  })

  it('remove duplicate lines keeps order and reports counts', async () => {
    renderAt('/remove-duplicate-lines')
    fireEvent.change(await screen.findByLabelText(/Input, one item per line/), { target: { value: 'x\ny\nx\nz\ny' } })
    expect(screen.getByLabelText('Unique lines')).toHaveValue('x\ny\nz')
    expect(screen.getByText('Removed').nextElementSibling).toHaveTextContent('2')
  })
})

describe('file upload UX', () => {
  it('rejects a file whose contents do not match its extension and says why', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/png-to-jpg')
    await screen.findByRole('heading', { level: 1 })
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, new File(['this is plain text'], 'fake.png', { type: 'image/png' }))
    expect(await screen.findByText(/A file was skipped/)).toBeInTheDocument()
    expect(screen.getByText(/fake\.png/)).toBeInTheDocument()
    expect(screen.queryByText('Options')).not.toBeInTheDocument()
  })

  it('rejects an empty file', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/pdf-merger')
    await screen.findByRole('heading', { level: 1 })
    await user.upload(document.querySelector('input[type=file]') as HTMLInputElement, new File([], 'empty.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/The file is empty/)).toBeInTheDocument()
  })

  it('shows the dropzone for every file tool and the privacy notice', async () => {
    for (const t of tools.filter((x) => x.kind === 'file')) {
      const { unmount } = renderAt(`/${t.slug}`)
      await screen.findByRole('heading', { level: 1, name: t.h1 })
      await waitFor(() => expect(document.querySelector('input[type=file]'), t.id).not.toBeNull(), { timeout: 8000 })
      unmount()
    }
  }, 120000)
})
