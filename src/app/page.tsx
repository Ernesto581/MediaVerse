'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { allMedia, searchMedia } from '@/lib/data'
import { MediaItem } from '@/lib/types'
import SearchBar from '@/components/SearchBar'
import MediaCard from '@/components/MediaCard'
import MediaDetail from '@/components/MediaDetail'
import FilterBar from '@/components/FilterBar'
import RequestForm from '@/components/RequestForm'
import { Zap, LayoutGrid, List, Loader2 } from 'lucide-react'
import { SelectionProvider } from '@/context/SelectionContext'
import SelectionDrawer from '@/components/SelectionDrawer'

const ITEMS_PER_PAGE = 24

function HomeContent() {
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const observerRef = useRef<HTMLDivElement | null>(null)

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    setDisplayCount(ITEMS_PER_PAGE)
  }, [])

  const handleTypeChange = useCallback((t: string) => {
    setSelectedType(t)
    setDisplayCount(ITEMS_PER_PAGE)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => { setDisplayCount(ITEMS_PER_PAGE) }, [query, selectedType])

  const filtered = useMemo(() => {
    let items = query ? searchMedia(query) : allMedia
    if (selectedType) {
      items = items.filter((m) => m.type === selectedType)
    }
    return items
  }, [query, selectedType])

  const displayed = useMemo(() => {
    return filtered.slice(0, displayCount)
  }, [filtered, displayCount])

  const hasMore = displayCount < filtered.length

  useEffect(() => {
    const el = observerRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filtered.length])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-[#09090b]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-7 w-7 text-indigo-500" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                <span className="gradient-text">MediaVerse</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 bg-gray-800/50 rounded-lg p-0.5 border border-gray-700/30">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-500/30 text-indigo-400' : 'text-gray-500 hover:text-gray-400'}`}
                  title="Vista en cuadrícula"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-500/30 text-indigo-400' : 'text-gray-500 hover:text-gray-400'}`}
                  title="Vista en lista"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-xs text-gray-600">
                {filtered.length} de {allMedia.length} títulos
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-400/70 text-center mb-1 -mt-1">
            Más de <span className="text-indigo-400 font-semibold">4 TB</span> en tus series y películas favoritas
          </p>
          <p className="text-xs text-gray-500/70 text-center mb-3">
            📍Felix Huergo #133 / Obdulio Morales y Nelson Vilariño
          </p>
          <SearchBar onSearch={handleSearch} />
          <div className="mt-4">
            <FilterBar selectedType={selectedType} onTypeChange={handleTypeChange} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {query || selectedType ? (
              <RequestForm query={query} />
            ) : (
              <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                <Zap className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Sin resultados</h3>
                <p className="text-sm text-gray-600 max-w-md">
                  Intenta con otra búsqueda o ajusta los filtros.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              {query && (
                <span className="text-sm text-gray-600">
                  Resultados para &quot;<span className="text-white">{query}</span>&quot;
                </span>
              )}
              <span className="text-xs text-gray-600 ml-auto">
                {displayed.length} de {filtered.length} mostrados
              </span>
            </div>
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-2'
            }>
              {displayed.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                  compact={viewMode === 'list'}
                />
              ))}
            </div>

            <div ref={observerRef} className="flex justify-center py-8">
              {hasMore && (
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-800/50 py-4">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 text-center text-xs text-gray-600">
          &copy; 2026 MediaVerse &middot; Hecho por{' '}
          <a
            href="https://github.com/Ernesto581"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Ernesto
          </a>
        </div>
      </footer>

      {selectedItem && (
        <MediaDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <SelectionProvider>
      <HomeContent />
      <SelectionDrawer />
    </SelectionProvider>
  )
}
