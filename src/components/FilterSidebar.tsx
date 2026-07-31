'use client'

import { Filter, X } from 'lucide-react'

interface FilterSidebarProps {
  selectedType: string
  onTypeChange: (type: string) => void
  isOpen: boolean
  onToggle: () => void
}

const typeFilters = [
  { value: '', label: 'Todos' },
  { value: 'anime', label: 'Anime' },
  { value: 'anime-movie', label: 'Películas Anime' },
  { value: 'movie', label: 'Películas' },
  { value: 'animated-movie', label: 'Películas Animadas' },
  { value: 'series', label: 'Series' },
  { value: 'animated-series', label: 'Series Animadas' },
  { value: 'kdrama', label: 'K-Dramas' },
]

export default function FilterSidebar({
  selectedType,
  onTypeChange,
  isOpen,
  onToggle,
}: FilterSidebarProps) {
  return (
    <>
      <button
        onClick={onToggle}
        className={`lg:hidden fixed bottom-6 right-6 z-40 p-3.5 rounded-full shadow-lg transition-all ${
          isOpen
            ? 'bg-indigo-600 text-white rotate-90'
            : 'bg-gray-900 text-gray-300 border border-gray-700/50'
        }`}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Filter className="h-5 w-5" />}
        {selectedType && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
            1
          </span>
        )}
      </button>

      <aside
        className={`fixed lg:sticky top-0 lg:top-24 left-0 z-30 w-56 h-full lg:h-auto
          bg-gray-900/95 backdrop-blur-md border-r lg:border border-gray-700/30 lg:rounded-2xl
          transition-transform duration-300 overflow-y-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:block`}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-400" />
              Tipos
            </h3>
            {selectedType && (
              <button
                onClick={() => onTypeChange('')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="space-y-1">
            {typeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => onTypeChange(f.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedType === f.value
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}
