'use client'

import { useState } from 'react'
import { Send, Film, MessageCircle } from 'lucide-react'

interface RequestFormProps {
  query: string
}

const WHATSAPP_NUMBER = '56419775'

const typeLabels: Record<string, string> = {
  'series': 'Serie',
  'anime': 'Anime',
  'movie': 'Película',
  'anime-movie': 'Película Anime',
  'animated-movie': 'Película Animada',
}

export default function RequestForm({ query }: RequestFormProps) {
  const [title, setTitle] = useState(query || '')
  const [type, setType] = useState('')

  const handleSend = () => {
    if (!title.trim()) return
    const tipo = type ? typeLabels[type] || type : ''
    const mensaje = encodeURIComponent(
      `Hola! Me gustaría pedir: ${title.trim()}${tipo ? ` (${tipo})` : ''}`
    )
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`, '_blank')
  }

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-gray-900/50 border border-gray-800/50 max-w-lg w-full">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4">
          <Film className="h-7 w-7 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          ¿No encuentras lo que buscas?
        </h3>
        <p className="text-sm text-gray-500">
          Pídela por WhatsApp y la agregamos al catálogo
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Breaking Bad, Interestelar..."
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Tipo (opcional)</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(typeLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setType(value === type ? '' : value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  type === value
                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                    : 'bg-gray-800/30 text-gray-400 border-gray-700/30 hover:border-gray-600/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!title.trim()}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            title.trim()
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  )
}
