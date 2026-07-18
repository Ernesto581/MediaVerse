export type MediaType = 'anime' | 'anime-movie' | 'movie' | 'series' | 'animated-series' | 'kdrama'

export interface EpisodeFile {
  name: string
  format: string
  sizeBytes?: number
  sizeFormatted?: string
}

export interface Season {
  number: number
  episodes: number
  formats: string[]
  episodesList?: EpisodeFile[]
  subtitles?: boolean
  notes?: string
  sizeBytes?: number
  sizeFormatted?: string
}

export interface MediaItem {
  id: string
  title: string
  type: MediaType
  category: string
  year?: number
  seasons?: Season[]
  episodes?: number
  format?: string
  resolution?: string
  audio?: string
  path: string
  notes?: string
  studio?: string
  genres?: string[]
  sizeBytes?: number
  sizeFormatted?: string
  poster?: string
}
