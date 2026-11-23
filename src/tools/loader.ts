import type { ComponentType } from 'react'

export type Loader = () => Promise<{ default: ComponentType }>

/**
 * Maps a tool id (see data/tools.ts) to its component. Every tool is lazy, and
 * tools in the same category share a chunk, so a visitor only downloads the code
 * for the tool they open.
 */
export const named =
  <T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): Loader =>
  () =>
    load().then((m) => ({ default: m[key] as ComponentType }))
