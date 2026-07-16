'use client'

import { getStats } from '@/lib/data'
import { Film, Tv, Clapperboard, Play, Layers, Database, HardDrive } from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export default function StatsBar() {
  const stats = getStats()

  const items = [
    { label: 'Total', value: stats.totalItems, icon: Database, color: 'text-indigo-400' },
    { label: 'Anime', value: stats.counts['anime'] || 0, icon: Tv, color: 'text-pink-400' },
    { label: 'Películas Anime', value: stats.counts['anime-movie'] || 0, icon: Clapperboard, color: 'text-purple-400' },
    { label: 'Películas', value: stats.counts['movie'] || 0, icon: Film, color: 'text-blue-400' },
    { label: 'Series', value: stats.counts['series'] || 0, icon: Play, color: 'text-emerald-400' },
    { label: 'S. Animadas', value: stats.counts['animated-series'] || 0, icon: Tv, color: 'text-orange-400' },
    { label: 'K-Dramas', value: stats.counts['kdrama'] || 0, icon: Play, color: 'text-rose-400' },
    { label: 'Temporadas', value: stats.totalSeasons, icon: Layers, color: 'text-cyan-400' },
    { label: 'Episodios', value: stats.totalEpisodes, icon: Play, color: 'text-amber-400' },
  ]

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-3 min-w-max px-1">
        {items.filter(i => i.value > 0).map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-700/30 backdrop-blur-sm whitespace-nowrap"
          >
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-xs text-gray-500">{item.label}</span>
            <span className="text-sm font-bold text-white">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
