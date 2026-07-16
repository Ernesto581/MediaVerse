import { MediaItem } from './types'
import { animeSeries } from '@/data/anime-series'
import { animeMovies } from '@/data/anime-movies'
import { movies } from '@/data/movies'
import { series } from '@/data/series'

export const allMedia: MediaItem[] = [
  ...animeSeries,
  ...animeMovies,
  ...movies,
  ...series,
]

export function getMediaById(id: string): MediaItem | undefined {
  return allMedia.find((m) => m.id === id)
}

export function getMediaByType(type: string): MediaItem[] {
  return allMedia.filter((m) => m.type === type)
}

export function searchMedia(query: string): MediaItem[] {
  const q = query.toLowerCase()
  return allMedia.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.studio && m.studio.toLowerCase().includes(q)) ||
      (m.genres && m.genres.some((g) => g.toLowerCase().includes(q)))
  )
}

export function getCategories(): { label: string; value: string; count: number }[] {
  const cats = new Map<string, number>()
  allMedia.forEach((m) => {
    cats.set(m.category, (cats.get(m.category) || 0) + 1)
  })
  return Array.from(cats.entries())
    .map(([value, count]) => ({ label: formatCategory(value), value, count }))
    .sort((a, b) => b.count - a.count)
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    'anime-series': 'Anime Series',
    'anime-series-new': 'Anime Series (Nuevos)',
    'anime-movie': 'Películas Anime',
    'anime-movie-ghibli': 'Studio Ghibli',
    'anime-movie-shinkai': 'Makoto Shinkai',
    'movie': 'Películas',
    'movie-saga': 'Sagas de Películas',
    'movie-animated': 'Películas Animadas',
    'live-series': 'Series Live-Action',
    'animated-series': 'Series Animadas',
    'kdrama': 'K-Dramas',
    'incomplete': 'Pendientes / Incompletas',
  }
  return map[cat] || cat
}

export function getStats() {
  const counts: Record<string, number> = {}
  let totalEpisodes = 0
  let totalSeasons = 0

  allMedia.forEach((m) => {
    counts[m.type] = (counts[m.type] || 0) + 1
    if (m.seasons) {
      totalSeasons += m.seasons.length
      m.seasons.forEach((s) => {
        totalEpisodes += s.episodes
      })
    }
    if (m.episodes) {
      totalEpisodes += m.episodes
    }
  })

  return {
    totalItems: allMedia.length,
    totalEpisodes,
    totalSeasons,
    counts,
  }
}
