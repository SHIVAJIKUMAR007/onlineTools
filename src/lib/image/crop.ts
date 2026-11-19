/** Pure geometry for the crop frame. No DOM, so it is unit tested. */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Largest rect with the given ratio (w/h) that fits in the bounds, centered. */
export function fitRatio(bounds: { w: number; h: number }, ratio: number): Rect {
  let w = bounds.w
  let h = w / ratio
  if (h > bounds.h) {
    h = bounds.h
    w = h * ratio
  }
  return { x: (bounds.w - w) / 2, y: (bounds.h - h) / 2, w, h }
}

export function clampRect(r: Rect, bounds: { w: number; h: number }, min = 8): Rect {
  const w = clamp(r.w, Math.min(min, bounds.w), bounds.w)
  const h = clamp(r.h, Math.min(min, bounds.h), bounds.h)
  return { x: clamp(r.x, 0, bounds.w - w), y: clamp(r.y, 0, bounds.h - h), w, h }
}

/**
 * Apply a pointer drag of (dx, dy) image pixels to a rect.
 * `ratio` is width / height when the aspect ratio is locked, otherwise null.
 */
export function applyDrag(start: Rect, handle: Handle, dx: number, dy: number, bounds: { w: number; h: number }, ratio: number | null, min = 16): Rect {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, bounds.w - start.w), y: clamp(start.y + dy, 0, bounds.h - start.h) }
  }
  const hasW = handle.includes('w')
  const hasE = handle.includes('e')
  const hasN = handle.includes('n')
  const hasS = handle.includes('s')
  const corner = (hasW || hasE) && (hasN || hasS)

  if (!ratio) {
    let l = start.x
    let t = start.y
    let r = start.x + start.w
    let b = start.y + start.h
    if (hasW) l = clamp(l + dx, 0, r - min)
    if (hasE) r = clamp(r + dx, l + min, bounds.w)
    if (hasN) t = clamp(t + dy, 0, b - min)
    if (hasS) b = clamp(b + dy, t + min, bounds.h)
    return { x: l, y: t, w: r - l, h: b - t }
  }

  // Aspect ratio locked: keep the opposite corner or edge-center fixed and size from the pointer.
  const cx = start.x + start.w / 2
  const cy = start.y + start.h / 2
  if (corner) {
    const sx = hasE ? 1 : -1
    const sy = hasS ? 1 : -1
    const ax = hasE ? start.x : start.x + start.w
    const ay = hasS ? start.y : start.y + start.h
    const px = (hasE ? start.x + start.w : start.x) + dx
    const py = (hasS ? start.y + start.h : start.y) + dy
    const dw = Math.max(0, (px - ax) * sx)
    const dh = Math.max(0, (py - ay) * sy)
    let w = Math.max(dw, dh * ratio, min)
    const maxW = Math.min(sx > 0 ? bounds.w - ax : ax, (sy > 0 ? bounds.h - ay : ay) * ratio)
    w = Math.min(w, maxW)
    const h = w / ratio
    return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h }
  }
  if (hasE || hasW) {
    const sx = hasE ? 1 : -1
    const ax = hasE ? start.x : start.x + start.w
    const px = (hasE ? start.x + start.w : start.x) + dx
    let w = Math.max((px - ax) * sx, min)
    const maxW = Math.min(sx > 0 ? bounds.w - ax : ax, 2 * Math.min(cy, bounds.h - cy) * ratio)
    w = Math.min(w, maxW)
    const h = w / ratio
    return { x: sx > 0 ? ax : ax - w, y: cy - h / 2, w, h }
  }
  const sy = hasS ? 1 : -1
  const ay = hasS ? start.y : start.y + start.h
  const py = (hasS ? start.y + start.h : start.y) + dy
  let h = Math.max((py - ay) * sy, min / ratio)
  const maxH = Math.min(sy > 0 ? bounds.h - ay : ay, (2 * Math.min(cx, bounds.w - cx)) / ratio)
  h = Math.min(h, maxH)
  const w = h * ratio
  return { x: cx - w / 2, y: sy > 0 ? ay : ay - h, w, h }
}

export const RATIO_PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' as const },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
] as const

/** Compute a centered crop that fills `target` ratio inside source dims. Used by "fill" resizing. */
export function centerCropForRatio(src: { w: number; h: number }, ratio: number): Rect {
  return fitRatio(src, ratio)
}

/** Fit inside a box, preserving ratio. Never returns a zero dimension. */
export function fitInside(src: { w: number; h: number }, box: { w: number; h: number }): { w: number; h: number } {
  const s = Math.min(box.w / src.w, box.h / src.h)
  return { w: Math.max(1, Math.round(src.w * s)), h: Math.max(1, Math.round(src.h * s)) }
}
