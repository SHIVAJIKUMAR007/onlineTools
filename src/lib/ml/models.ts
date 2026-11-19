export interface BgModel {
  id: string
  label: string
  repo: string
  dtype: 'fp32' | 'fp16' | 'q8'
  sizeMB: number
  license: string
  /** 'pipeline' uses the stock background-removal pipeline; 'rmbg' loads the model with its own preprocessing. */
  runtime: 'pipeline' | 'rmbg'
  /** Shown as a warning in the UI when set. */
  licenseNote?: string
  description: string
}

export const BG_MODELS: BgModel[] = [
  {
    id: 'modnet',
    label: 'Portraits',
    repo: 'Xenova/modnet',
    runtime: 'pipeline',
    dtype: 'fp32',
    sizeMB: 26,
    license: 'Apache-2.0',
    description: 'MODNet. Small and fast, trained for people. Best for portraits and head-and-shoulders photos.',
  },
  {
    id: 'rmbg',
    label: 'Any subject',
    repo: 'briaai/RMBG-1.4',
    runtime: 'rmbg',
    dtype: 'q8',
    sizeMB: 44,
    license: 'Non-commercial',
    licenseNote: 'RMBG-1.4 by BRIA AI is free for non-commercial use only. Commercial use needs a licence from BRIA.',
    description: 'RMBG-1.4. A general model for products, animals and objects with cleaner edges.',
  },
]

export const modelById = (id: string): BgModel => BG_MODELS.find((m) => m.id === id) ?? BG_MODELS[0]
