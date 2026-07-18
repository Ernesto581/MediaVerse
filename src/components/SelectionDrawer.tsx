'use client'

import { useSelection } from '@/context/SelectionContext'
import { Minus, HardDrive, Trash2, ChevronUp, ChevronDown, DollarSign } from 'lucide-react'
import { useState, useCallback } from 'react'

export default function SelectionDrawer() {
  const { selected, totalFormatted, totalCostFormatted, remove, clear } = useSelection()
  const [expanded, setExpanded] = useState(false)
  const toggleExpand = useCallback(() => setExpanded((p) => !p), [])

  if (selected.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-gray-800/50 shadow-2xl shadow-black/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 py-2.5">
            <button
              onClick={toggleExpand}
              className="p-1 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
              <HardDrive className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="text-sm text-gray-300 font-medium">
                {selected.length} {selected.length === 1 ? 'título' : 'títulos'}
              </span>
              <span className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                {totalFormatted}
              </span>
              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {totalCostFormatted}
              </span>
            </div>

            <button
              onClick={clear}
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>

          {expanded && (
            <div className="border-t border-gray-800/30 py-2 max-h-64 overflow-y-auto">
              <div className="flex flex-col gap-1">
                {selected.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-800/30">
                    <button
                      onClick={() => remove(item.id)}
                      className="p-0.5 rounded-md text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      aria-label={`Quitar ${item.title}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-300 truncate flex-1">{item.title}</span>
                    <span className="text-[11px] text-gray-600 font-mono shrink-0">
                      {item.sizeFormatted || (item.sizeBytes ? (item.sizeBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : '—')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
