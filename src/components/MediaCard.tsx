'use client'

import { MediaItem } from '@/lib/types'
import { Film, Tv, Clapperboard, Play, HardDrive } from 'lucide-react'

interface MediaCardProps {
  item: MediaItem
  onClick: (item: MediaItem) => void
}

const typeIcons: Record<string, typeof Film> = {
  'anime': Tv,
  'anime-movie': Clapperboard,
  'movie': Film,
  'series': Tv,
  'animated-series': Tv,
  'kdrama': Tv,
}

const typeColors: Record<string, string> = {
  'anime': 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
  'anime-movie': 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
  'movie': 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  'series': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
  'animated-series': 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
  'kdrama': 'from-rose-500/20 to-red-500/20 border-rose-500/30',
}

const typeLabels: Record<string, string> = {
  'anime': 'Anime',
  'anime-movie': 'Película Anime',
  'movie': 'Película',
  'series': 'Serie',
  'animated-series': 'Serie Animada',
  'kdrama': 'K-Drama',
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function isMovieType(item: MediaItem): boolean {
  return item.type === 'movie' || item.type === 'anime-movie'
}

export default function MediaCard({ item, onClick }: MediaCardProps) {
  const Icon = typeIcons[item.type] || Film
  const gradient = typeColors[item.type] || typeColors.movie
  const movieLike = isMovieType(item)

  const totalEpisodes = item.seasons
    ? item.seasons.reduce((sum, s) => sum + s.episodes, 0)
    : item.episodes || 0

  const seasonCount = item.seasons?.length || 0
  const formats = item.seasons
    ? [...new Set(item.seasons.flatMap((s) => s.formats))]
    : item.format ? [item.format] : []

  const totalSize = item.sizeBytes
    || (item.seasons ? item.seasons.reduce((sum, s) => sum + (s.sizeBytes || 0), 0) : undefined)

  return (
    <button
      onClick={() => onClick(item)}
      className="text-left group relative"
    >
      <div className={`relative bg-gradient-to-br ${gradient} border rounded-2xl p-5 
        hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300
        backdrop-blur-sm bg-gray-900/60 cursor-pointer`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-gray-800/50 group-hover:bg-gray-800/80 transition-colors">
            <Icon className="h-5 w-5 text-gray-300" />
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800/60 text-gray-400 border border-gray-700/30">
            {typeLabels[item.type] || item.type}
          </span>
        </div>

        <h3 className="font-semibold text-white text-base mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {item.title}
        </h3>

        {item.year && (
          <span className="text-xs text-gray-500 font-mono">{item.year}</span>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {movieLike && seasonCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-gray-800/60 text-indigo-300">
              {seasonCount} películas
            </span>
          )}
          {!movieLike && seasonCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-gray-800/60 text-gray-300">
              {seasonCount} {seasonCount === 1 ? 'temp' : 'temps'}
            </span>
          )}
          {totalEpisodes > 0 && !movieLike && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-gray-800/60 text-gray-300">
              <Play className="h-3 w-3" /> {totalEpisodes} ep
            </span>
          )}
          {item.resolution && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-gray-800/60 text-indigo-300">
              {item.resolution}
            </span>
          )}
        </div>

        {formats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {formats.slice(0, 3).map((fmt) => (
              <span key={fmt} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/40 text-gray-500 font-mono uppercase">
                {fmt}
              </span>
            ))}
            {formats.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/40 text-gray-500">
                +{formats.length - 3}
              </span>
            )}
          </div>
        )}

        {totalSize && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-600">
            <HardDrive className="h-3 w-3" />
            {formatBytes(totalSize)}
          </div>
        )}
      </div>
    </button>
  )
}
