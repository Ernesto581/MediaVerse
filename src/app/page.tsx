'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { allMedia, searchMedia } from '@/lib/data'
import { MediaItem } from '@/lib/types'
import SearchBar from '@/components/SearchBar'
import MediaCard from '@/components/MediaCard'
import MediaDetail from '@/components/MediaDetail'
import FilterBar from '@/components/FilterBar'
import Pagination from '@/components/Pagination'
import RequestForm from '@/components/RequestForm'
import { Zap } from 'lucide-react'

const ITEMS_PER_PAGE = 24

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [page, setPage] = useState(1)

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    setPage(1)
  }, [])

  const handleTypeChange = useCallback((t: string) => {
    setSelectedType(t)
    setPage(1)
  }, [])

  useEffect(() => { setPage(1) }, [query, selectedType])

  const filtered = useMemo(() => {
    let items = query ? searchMedia(query) : allMedia
    if (selectedType) {
      items = items.filter((m) => m.type === selectedType)
    }
    return items
  }, [query, selectedType])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, page])

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
            <span className="text-xs text-gray-600">
              {filtered.length} de {allMedia.length} títulos
            </span>
          </div>
          <p className="text-sm text-gray-400/70 text-center mb-3 -mt-1">
            Más de <span className="text-indigo-400 font-semibold">4 TB</span> en tus series y películas favoritas
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
              {totalPages > 1 && (
                <span className="text-xs text-gray-600 ml-auto">
                  Pág {page} de {totalPages}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
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
