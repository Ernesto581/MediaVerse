'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { MediaItem } from '@/lib/types'

function getItemBytes(item: MediaItem): number {
  return item.sizeBytes
    || (item.seasons ? item.seasons.reduce((sum, s) => sum + (s.sizeBytes || 0), 0) : 0)
    || 0
}

interface SelectionContextType {
  selected: MediaItem[]
  totalBytes: number
  totalFormatted: string
  isSelected: (id: string) => boolean
  toggle: (item: MediaItem) => void
  remove: (id: string) => void
  clear: () => void
}

const SelectionContext = createContext<SelectionContextType | null>(null)

function formatGB(bytes: number): string {
  if (bytes < 1) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb < 1) return gb.toFixed(2) + ' GB'
  if (gb < 1000) return gb.toFixed(1) + ' GB'
  return (gb / 1000).toFixed(2) + ' TB'
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<MediaItem[]>([])

  const isSelected = useCallback((id: string) => {
    return selected.some((item) => item.id === id)
  }, [selected])

  const toggle = useCallback((item: MediaItem) => {
    setSelected((prev) => {
      const exists = prev.find((i) => i.id === item.id)
      if (exists) {
        return prev.filter((i) => i.id !== item.id)
      }
      return [...prev, item]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setSelected((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clear = useCallback(() => {
    setSelected([])
  }, [])

  const totalBytes = useMemo(() => {
    return selected.reduce((sum, item) => sum + getItemBytes(item), 0)
  }, [selected])

  const totalFormatted = useMemo(() => formatGB(totalBytes), [totalBytes])

  return (
    <SelectionContext.Provider value={{ selected, totalBytes, totalFormatted, isSelected, toggle, remove, clear }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider')
  return ctx
}
