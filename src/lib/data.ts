import { MediaItem } from './types'
import { animeSeries } from '@/data/anime-series'
import { animeMovies } from '@/data/anime-movies'
import { animatedMovies } from '@/data/animated-movies'
import { movies } from '@/data/movies'
import { series } from '@/data/series'

const availableMovieFolders = new Set([
  '! Ciclo de Sagas de Filmes Clasicos [ Step Up ]',
  '10 Things I Hate About You (1999)', '13 going on 30 (2004)', '13.13.13 (2014) +++',
  '2013_The Conjuring', '2014 - Interstellar', '2016_Sully', '2016_The Conjuring 2',
  '20th Century Women (2016)', '31 Días 2013', '50 Sombras de Grey', 'A walk to remember (2002)',
  'About Time (2013)', 'Aloha 2015', 'American Pie', 'Amor de Media Noche [2018]',
  'Annihilation [2018]', 'Ant-Man and the Wasp Quantumania [2023]', 'Argylle',
  'Asterix and Obelix The Middle Kingdom 2023', 'Avatar The Way of Water', 'Before Sunrise',
  'Bird Box 2018', 'Black Swan', 'Blindness', 'Bohemian Rhapsody [2018]', 'Call me by Your Name',
  'Canary Black', 'Candyman 2021', 'Chicas Rubias - Shawn Wayans & Marlon Wayans',
  'Crazy Rich Asians [Locamente Millonarios] [2018] [1,1 Gb]', 'Culpa Mìa',
  'Deadpool [2016] [1080p] [Dual Audio] [1,66 Gb]', 'Django Unchained [2012]',
  'Doctor Strange In The Multiverse Of Madness [2022] [1080p] [Dual Audio] [2,75 Gb]',
  'Dog Days [2018]', 'Dog Gone', 'Don_t Breathe 2', 'dONT lOOK uP',
  'Downrange [Blanco Perfecto] [2017] [853,38 Mb]', 'Dune (2021) (1080p)',
  'Dungeons and Dragons Honor Among Thieves [2023] [1080p] [2,59 Gb]',
  'El Diario de Carlota (España)', 'Enola Holmes', 'Eternals [2021] [1080p] [Dual Audio]',
  'Everything, Everything 2017', 'Everything, Everywhere, All At Once',
  'Fast and Furious', 'Fear Street', 'Final Destination', 'Five Feet Apart [A Dos Metros de Ti] [2019]',
  'Forrest Gump [1994] [720p] [2,01 Gb]', 'Ghosted [2023] [1080p] [Dual Audio]',
  'Godzilla vs Kong  2021   1080p   2 16 Gb', 'Guardians of the Galaxy Vol  3 (2023) [4K] [17,16 Gb]',
  'Happy Death Day [2017] [HD]', 'Hasta Que El Cuerpo Aguante [2017] [943 Mb]', 'HellBoy',
  "Hitman's Wife's Bodyguard", 'How I Became a Superhero [2020]', 'If I Stay (2014)',
  'In Time [2011]', 'Inception', 'Indiana Jones', 'Joker 2019', 'Jugada Salvaje [2015]',
  'Jumanji Welcome to the Jungle [2017]', 'Jungle Cruise 2021 @TVAdictosS3', 'Jupiter Ascending [2015]',
  'King Arthur - Legend of the Sword', 'La Maldicion de La Llorona [2019]', 'Lady Bird 2017',
  'Legacy [El Legado] [2020]', 'Liberal Arts (2012)', 'Life (2017)', 'Little Women (2019)',
  'Love and Monsters [2020]', 'Love and Other Drugs', 'Love Rosie', 'Love, Simon  [2018]',
  'Madame Web', 'Mainstream (2021)', 'Materialists', 'Maze Runner', 'Me Before You (2016) Sub Español',
  'Mentes Poderosas [2018]', 'Miamor perdido (2018) [Esp]', 'Misterio a Bordo [2019]', 'Moonshot 2022',
  'Muere, Hart  [2023] [1,09 Gb]', 'Mujer Maravilla 1984  [2020]', 'Murder Mystery 2 [2023] [1080p]',
  'Murder On The Orient Express [2017]', 'Never Goin’ Back [2018]', 'New York I Love You [2008]',
  'new', 'Ni de Coña [2021]', 'Not OK', 'One Day 2011', 'Parasite 2019',
  'Peliculas [ Sagas [HD]  Hannibal Lecter]', 'Peliculas [ Sagas [HD]  Harry Potter]',
  'Peliculas [ Sagas [HD]  Jeepers Creepers]', 'Peliculas [ Sagas [HD]  John Wick]',
  'Peliculas [ Sagas [HD]  Piratas del Caribe]', 'Peliculas [ Sagas [HD]  Resident Evil]',
  'Peliculas [ Sagas [HD]  The Exorcist]', 'Peliculas [ Sagas [HD]  The Hobbit]',
  'Peliculas [ Sagas [HD]  Viernes 13]', 'Peliculas [ Sagas [HD] [ Percy Jackson ]',
  'Peliculas [ Sagas [HD] The Lord of the Rings Extended - Trilogy]', 'Peter Pan and Wendy [2023] [1080p]',
  'Pitch Perfect', 'Ready Player One HD Dual Audio (2.29 GB) [2018]', 'Reality Bites (1994)',
  'Recovery', 'Renfield [2023] [1080p] [1,79 Gb]', 'Run, Lola, Run', 'Saga de Marvel', 'Saga Fear Street',
  'Saw  Game', 'Scape Room', "Schindler's List", 'Smosh - The Movie (2015)', 'Space Sweepers [2021]',
  'Spiderman viejo', 'STAR WARS COMBO COMPLETO', 'Step Up', 'Sundown', 'Taxi Driver', 'Th3 Gorg3',
  'The Boy in the Striped Pyjamas (2008)', 'The Circle [2017] [1080p] [6,82 Gb]', 'The Cured [2017]',
  'The Da Vinci Code', 'The Duff (2015)', 'The Edge of Seventeen (2016)', 'The Fault in Our Stars 2014',
  'The Glass Castle [El Castillo de Cristal] [2017] [1,16 Gb]', 'The Honor List [2018]',
  'The Hunger Games', 'The Karate Kid [2010]', 'The Kissing Booth', 'The Long Walk',
  'The Mountain Between Us [2017]', 'The Spy Who Dumped Me [2018]', 'The Suicide Squad',
  'The Tomorrow War', 'The Whale', 'The_Protégé', 'To All the Boys I_ve Loved Before',
  'To The Bone [2017]', 'Transformers Completo', 'Trece Fantasmas', 'Troya (High Definition)',
  'Un lugar en silencio II [2021]', 'Uncharted', 'Venom Let There Be Carnage [2021] [1080p] [Dual Audio] [2,29 Gb]',
  'Venom', 'Way Down (2021)', 'Whiplash', 'You Get Me [2017]',
])

function isCurrentMovie(item: MediaItem): boolean {
  if (item.category === 'movie-animated') return false
  if (!item.path.startsWith('D://')) return true
  const rootFolder = item.path.slice(4).split('//')[0]
  return availableMovieFolders.has(rootFolder)
}

export const allMedia: MediaItem[] = [
  ...animeSeries,
  ...animeMovies,
  ...animatedMovies,
  // The old file still contains the pre-move animated section. Exclude it
  // while the source is kept for historical reference.
  ...movies.filter(isCurrentMovie),
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
  return allMedia.filter((m) => {
    if (m.title.toLowerCase().includes(q)) return true
    if (m.category.toLowerCase().includes(q)) return true
    if (m.studio && m.studio.toLowerCase().includes(q)) return true
    if (m.genres && m.genres.some((g) => g.toLowerCase().includes(q))) return true
    if (m.notes && m.notes.toLowerCase().includes(q)) return true
    if (m.seasons) {
      for (const s of m.seasons) {
        if (s.notes && s.notes.toLowerCase().includes(q)) return true
        if (s.episodesList) {
          for (const ep of s.episodesList) {
            if (ep.name.toLowerCase().includes(q)) return true
          }
        }
      }
    }
    return false
  })
}

export function getTotalEpisodes(item: MediaItem): number {
  if (item.seasons) return item.seasons.reduce((t, s) => t + s.episodes, 0)
  return item.episodes || 0
}

export function calculateCost(item: MediaItem): number {
  const isMovie = item.type === 'movie' || item.type === 'anime-movie' || item.type === 'animated-movie'
  if (isMovie) {
    if (item.seasons) return item.seasons.length * 20
    return 20
  }
  return getTotalEpisodes(item) * 5
}

export function formatCost(cup: number): string {
  return cup.toLocaleString('es-ES') + ' CUP'
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
    'animated-movie': 'Películas Animadas',
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
