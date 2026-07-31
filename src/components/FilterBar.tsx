'use client'

import { getStats } from '@/lib/data'
import { Film, Tv, Clapperboard, Play } from 'lucide-react'

interface FilterBarProps {
  selectedType: string
  onTypeChange: (type: string) => void
}

const typeConfig: Record<string, { label: string; icon: typeof Tv; color: string }> = {
  'anime': { label: 'Anime', icon: Tv, color: 'text-pink-400' },
  'anime-movie': { label: 'Películas Anime', icon: Clapperboard, color: 'text-purple-400' },
  'movie': { label: 'Películas', icon: Film, color: 'text-blue-400' },
  'animated-movie': { label: 'Películas Animadas', icon: Clapperboard, color: 'text-orange-400' },
  'series': { label: 'Series', icon: Play, color: 'text-emerald-400' },
  'animated-series': { label: 'S. Animadas', icon: Tv, color: 'text-orange-400' },
  'kdrama': { label: 'K-Dramas', icon: Play, color: 'text-rose-400' },
}

export default function FilterBar({ selectedType, onTypeChange }: FilterBarProps) {
  const stats = getStats()

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 min-w-max justify-center w-full">
        <button
          onClick={() => onTypeChange('')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
            selectedType === ''
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-gray-900/60 text-gray-400 border-gray-700/30 hover:border-gray-600/50'
          }`}
        >
          Todos
          <span className={`text-xs ${selectedType === '' ? 'text-indigo-200' : 'text-gray-600'}`}>
            {stats.totalItems}
          </span>
        </button>

        {Object.entries(typeConfig).map(([key, cfg]) => {
          const count = stats.counts[key] || 0
          if (count === 0) return null
          const Icon = cfg.icon
          return (
            <button
              key={key}
              onClick={() => onTypeChange(selectedType === key ? '' : key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedType === key
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-gray-900/60 text-gray-400 border-gray-700/30 hover:border-gray-600/50'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              {cfg.label}
              <span className={`text-xs ${selectedType === key ? 'text-indigo-200' : 'text-gray-600'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
