'use client'

import { useState } from 'react'
import { MediaItem, Season, EpisodeFile } from '@/lib/types'
import { X, Play, Tv, FileText, HardDrive, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'

interface MediaDetailProps {
  item: MediaItem
  onClose: () => void
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
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function isMovieType(item: MediaItem): boolean {
  return item.type === 'movie' || item.type === 'anime-movie'
}

export default function MediaDetail({ item, onClose }: MediaDetailProps) {
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)

  const totalEpisodes = item.seasons
    ? item.seasons.reduce((sum, s) => sum + s.episodes, 0)
    : item.episodes || 0
  const seasonCount = item.seasons?.length || 0
  const allFormats = item.seasons
    ? [...new Set(item.seasons.flatMap((s) => s.formats))]
    : item.format ? [item.format] : []

  const totalSize = item.sizeBytes
    || (item.seasons ? item.seasons.reduce((sum, s) => sum + (s.sizeBytes || 0), 0) : undefined)

  const movieLike = isMovieType(item)
  const showMovieList = movieLike && item.seasons && item.seasons.length > 0

  const hasEpisodeFiles = item.seasons?.some((s) => s.episodesList && s.episodesList.length > 0)

  const toggleSeason = (idx: number) => {
    setExpandedSeason(expandedSeason === idx ? null : idx)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors z-10"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {typeLabels[item.type] || item.type}
            </span>
            {item.year && (
              <span className="text-sm font-mono text-gray-500">{item.year}</span>
            )}
            {item.studio && (
              <span className="text-xs text-gray-500">{item.studio}</span>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">{item.title}</h2>

          <div className="flex flex-wrap gap-4 mt-4 mb-6">
            {!movieLike && seasonCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Tv className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-white">{seasonCount}</span> temporadas
              </div>
            )}
            {!movieLike && totalEpisodes > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Play className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-white">{totalEpisodes}</span> episodios
              </div>
            )}
            {totalSize && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <HardDrive className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-white">{formatBytes(totalSize)}</span>
              </div>
            )}
            {movieLike && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span className="text-gray-400">Película</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {allFormats.length > 0 && allFormats.map((f) => (
              <span key={f} className="text-xs px-2 py-1 rounded-lg bg-gray-800/60 font-mono uppercase text-gray-400">
                {f}
              </span>
            ))}
            {item.resolution && (
              <span className="text-xs px-2 py-1 rounded-lg bg-indigo-900/30 text-indigo-300 border border-indigo-500/20">
                {item.resolution}
              </span>
            )}
            {item.audio && (
              <span className="text-xs px-2 py-1 rounded-lg bg-emerald-900/30 text-emerald-300 border border-emerald-500/20">
                {item.audio}
              </span>
            )}
          </div>

          {item.notes && (
            <div className="mb-6 p-3 rounded-xl bg-amber-900/10 border border-amber-500/20 text-sm text-amber-300/80">
              {item.notes}
            </div>
          )}

          {/* MOVIE SAGA: List of movies */}
          {showMovieList && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Películas
              </h3>
              <div className="space-y-2">
                {item.seasons!.map((s: Season) => (
                  <div
                    key={s.number}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold shrink-0">
                        {s.number}
                      </span>
                      <span className="text-sm text-white truncate">
                        {s.notes || `Película ${s.number}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {s.formats.map((fmt) => (
                        <span key={fmt} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 font-mono uppercase">
                          {fmt}
                        </span>
                      ))}
                      {s.sizeBytes && (
                        <span className="text-[10px] text-gray-600">{formatBytes(s.sizeBytes)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANIME/SERIES: Seasons with expandable episode lists */}
          {!movieLike && item.seasons && item.seasons.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Temporadas
              </h3>
              <div className="space-y-2">
                {item.seasons.map((season: Season, idx: number) => (
                  <div key={idx}>
                    <button
                      onClick={() => toggleSeason(idx)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${season.number === 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                          {season.number === 0 ? <Play className="h-4 w-4" /> : season.number}
                        </span>
                        <div>
                          {season.number === 0 ? (
                            <span className="text-sm text-white">{season.notes || 'Película'}</span>
                          ) : (
                            <span className="text-sm text-white">
                              Temporada {season.number}
                            </span>
                          )}
                          {season.number !== 0 && season.notes && (
                            <span className="block text-xs text-gray-500">{season.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">{season.episodes} ep</span>
                        <div className="hidden sm:flex gap-1">
                          {season.formats.map((fmt) => (
                            <span key={fmt} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 font-mono uppercase">
                              {fmt}
                            </span>
                          ))}
                        </div>
                        {season.subtitles && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400">SUB</span>
                        )}
                        {season.sizeBytes && (
                          <span className="text-xs text-gray-600 hidden sm:inline">{formatBytes(season.sizeBytes)}</span>
                        )}
                        {expandedSeason === idx ? (
                          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                      </div>
                    </button>

                    {expandedSeason === idx && (
                      <div className="mt-1 ml-11 border-l-2 border-gray-800 pl-4 py-2 space-y-1">
                        {season.episodesList && season.episodesList.length > 0 ? (
                          season.episodesList.map((ep: EpisodeFile, idx: number) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <Play className="h-3 w-3 text-gray-600 shrink-0" />
                                <span className="text-sm text-gray-300 truncate">{ep.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 font-mono uppercase">
                                  {ep.format}
                                </span>
                                {ep.sizeBytes && (
                                  <span className="text-[10px] text-gray-600">{formatBytes(ep.sizeBytes)}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-600 py-2 px-2">
                            {season.episodes} episodios en formato{season.formats.length > 1 ? 's' : ''} {season.formats.join(', ').toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standalone movie/episode (no seasons) */}
          {movieLike && !showMovieList && (
            <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
              <div className="flex items-center gap-3">
                <Play className="h-5 w-5 text-indigo-400" />
                <div>
                  <span className="text-sm text-white">
                    {item.format || 'Archivo'} {item.resolution && `· ${item.resolution}`}
                  </span>
                  {item.audio && (
                    <span className="block text-xs text-gray-500">{item.audio}</span>
                  )}
                </div>
                {totalSize && (
                  <span className="ml-auto text-sm text-gray-400">{formatBytes(totalSize)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
