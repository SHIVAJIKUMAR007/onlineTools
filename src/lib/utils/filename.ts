/**
 * File names come from the user's disk and are shown in the UI and used for
 * downloads. React escapes text, but we still strip control characters and
 * path separators so names are safe for display and for use inside a ZIP.
 */
export function sanitizeFilename(name: string, fallback = 'file'): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*‪-‮⁦-⁩]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const limited = cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned
  return limited || fallback
}

export function baseName(name: string): string {
  const safe = sanitizeFilename(name)
  const dot = safe.lastIndexOf('.')
  return dot > 0 ? safe.slice(0, dot) : safe
}

export function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'image/svg+xml':
      return 'svg'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'bin'
  }
}

/** Returns a name that does not collide with any in `used`, and records it. */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let i = 2
  while (used.has(`${stem} (${i})${ext}`)) i++
  const result = `${stem} (${i})${ext}`
  used.add(result)
  return result
}
