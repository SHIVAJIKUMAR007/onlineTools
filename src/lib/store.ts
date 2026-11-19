import { create } from 'zustand'

interface AppState {
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  /** Files handed from the homepage drop zone to the tool the user picks. */
  pendingFiles: File[]
  setPendingFiles: (files: File[]) => void
  takePendingFiles: () => File[]
}

export const useApp = create<AppState>((set, get) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  pendingFiles: [],
  setPendingFiles: (pendingFiles) => set({ pendingFiles }),
  takePendingFiles: () => {
    const files = get().pendingFiles
    if (files.length) set({ pendingFiles: [] })
    return files
  },
}))
