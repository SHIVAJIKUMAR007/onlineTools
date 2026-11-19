/** Human-readable file size. */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${units[i]}`
}

/** Percentage saved from original to result. Negative means the result is larger. */
export function savedPercent(original: number, result: number): number {
  if (original <= 0) return 0
  return Math.round(((original - result) / original) * 1000) / 10
}

export function formatSaving(original: number, result: number): string {
  const p = savedPercent(original, result)
  if (p > 0) return `${p}% smaller`
  if (p < 0) return `${Math.abs(p)}% larger`
  return 'Same size'
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}
