import { useState, useCallback, useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { StatsPanel } from './components/StatsPanel'
import { CategorySection } from './components/CategorySection'
import { LinkComposer } from './components/LinkComposer'
import { ItemModal } from './components/ItemModal'
import { useStore } from './lib/store'
import { EXT_QUEUE_KEY } from './lib/store'
import type { Item } from './lib/types'
import { useAuth, useRequiredUser } from './lib/auth'
import { profileFromAuthUser } from './lib/auth-profile'
import NumberFlow from '@number-flow/react'

type ModalState =
  | { open: false }
  | { open: true; mode: 'add'; url: string }
  | { open: true; mode: 'edit'; item: Item }

function faviconFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  } catch {
    return ''
  }
}

function sanitizeUrl(value: string): string {
  const base = value.trim()
  if (!base) return ''
  if (/^https?:\/\//i.test(base)) return base
  return `https://${base}`
}

function decodePayload(encoded: string) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

const EXT_QUEUE_SYNC_EVENT = 'wishpool:extQueueUpdated'

export default function App() {
  const { signOut } = useAuth()
  const user = useRequiredUser()
  const { state, setItems, addItem } = useStore(user.id, profileFromAuthUser(user))
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const { items, categories, profile } = state

  const processExtensionQueue = useCallback(() => {
    let importedCategory: string | null = null

    try {
      const raw = window.localStorage.getItem(EXT_QUEUE_KEY)
      if (!raw) return null

      const queue = JSON.parse(raw)
      if (!Array.isArray(queue) || queue.length === 0) {
        window.localStorage.removeItem(EXT_QUEUE_KEY)
        return null
      }

      queue.forEach((payload: unknown) => {
        if (!payload || typeof payload !== 'object') return

        const p = payload as Record<string, unknown>
        const finalUrl = sanitizeUrl(String(p.url || ''))
        if (!finalUrl) return

        const category = String(p.category || '').trim() || categories[0] || 'Todos'
        const price = Number(p.price || 0)
        const name = String(p.name || '').trim() || new URL(finalUrl).hostname
        const image = String(p.image || '').trim() || faviconFromUrl(finalUrl)

        if (!Number.isFinite(price) || price < 0) return

        addItem({ id: crypto.randomUUID(), name, category, price, url: finalUrl, image })
        importedCategory = category
      })

      window.localStorage.removeItem(EXT_QUEUE_KEY)
    } catch {
      window.localStorage.removeItem(EXT_QUEUE_KEY)
    }

    return importedCategory
  }, [addItem, categories])

  useEffect(() => {
    let importedCategory: string | null = null

    // Process URL import
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('import')
    if (encoded) {
      try {
        const payload = decodePayload(encoded)
        const finalUrl = sanitizeUrl(String(payload.url || ''))
        if (finalUrl) {
          const category =
            String(payload.category || '').trim() || state.categories[0] || 'Todos'
          const price = Number(payload.price || 0)
          const name = String(payload.name || '').trim() || new URL(finalUrl).hostname
          const image = String(payload.image || '').trim() || faviconFromUrl(finalUrl)
          if (Number.isFinite(price) && price >= 0) {
            addItem({ id: crypto.randomUUID(), name, category, price, url: finalUrl, image })
            importedCategory = category
          }
        }
      } catch {
        // ignore malformed imports
      } finally {
        params.delete('import')
        const next = params.toString()
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`,
        )
      }
    }

    if (importedCategory) {
      setActiveCategory(importedCategory)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const syncFromExtension = () => {
      const importedCategory = processExtensionQueue()
      if (importedCategory) {
        setActiveCategory(importedCategory)
      }
    }

    syncFromExtension()
    window.addEventListener(EXT_QUEUE_SYNC_EVENT, syncFromExtension)
    window.addEventListener('focus', syncFromExtension)

    return () => {
      window.removeEventListener(EXT_QUEUE_SYNC_EVENT, syncFromExtension)
      window.removeEventListener('focus', syncFromExtension)
    }
  }, [processExtensionQueue])

  const grouped = items.reduce<Record<string, Item[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const orderedCategories = categories.filter((name) => grouped[name]?.length)
  const filtered =
    activeCategory === 'Todos'
      ? orderedCategories
      : orderedCategories.filter((name) => name === activeCategory)

  const total = items.reduce((sum, item) => sum + item.price, 0)

  const currencyTotalsMap = items.reduce<Record<string, number>>((acc, item) => {
    const code = item.currency ?? 'BRL'
    acc[code] = (acc[code] ?? 0) + item.price
    return acc
  }, {})
  const currencyTotals = Object.entries(currencyTotalsMap).map(([code, total]) => ({ code, total }))
  const isMultiCurrency = currencyTotals.length > 1

  const handleDelete = useCallback(
    (id: string) => {
      const nextItems = items.filter((item) => item.id !== id)
      setItems(nextItems)
      const categoryStillExists = nextItems.some((item) => item.category === activeCategory)
      if (activeCategory !== 'Todos' && !categoryStillExists) {
        setActiveCategory('Todos')
      }
    },
    [items, setItems, activeCategory],
  )

  const handleEdit = useCallback((item: Item) => {
    setModal({ open: true, mode: 'edit', item })
  }, [])

  const handleComposerSubmit = useCallback(
    async ({ url, name, price, category, currency }: { url: string; name: string; price: number; category: string; currency: string }) => {
      const image = faviconFromUrl(url)
      addItem({ id: crypto.randomUUID(), name, category, price, currency, url, image })
    },
    [addItem],
  )

  const handleSave = useCallback(
    (saved: Item) => {
      if (modal.open && modal.mode === 'edit') {
        setItems(items.map((entry) => (entry.id === saved.id ? saved : entry)))
      } else {
        addItem(saved)
      }
      setModal({ open: false })
    },
    [modal, items, setItems, addItem],
  )

  return (
    <>
      <TopBar
        currentCategory={activeCategory}
        categories={categories}
        avatarName={profile.name}
        onCategoryChange={setActiveCategory}
        onLogout={signOut}
      />
      <main className={`px-4 ${orderedCategories.length > 0 ? 'pt-29' : 'pt-18'} md:pt-18`}>
        {/* Mobile: stats bar (desktop sidebar handles this on larger screens) */}
        <div className="md:hidden -mx-4 p-4 flex gap-4 bg-[#f9f9f9] border-b border-[#eee] mb-4">
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-sm font-semibold text-black">
              <NumberFlow
                value={total}
                locales="pt-BR"
                format={{
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }}
              />
            </span>
            <span className="text-sm font-medium text-[rgba(0,0,0,0.32)]">Total salvo</span>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-sm font-semibold text-black">
              <NumberFlow value={items.length} />
            </span>
            <span className="text-sm font-medium text-[rgba(0,0,0,0.32)]">Links</span>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-sm font-semibold text-black">
              <NumberFlow value={categories.length} />
            </span>
            <span className="text-sm font-medium text-[rgba(0,0,0,0.32)]">Categorias</span>
          </div>
        </div>

        <div className="md:grid md:grid-cols-12 md:gap-8 py-7 pb-30">
          {/* Left: sticky stats (desktop only) */}
          <div className="hidden md:block md:col-span-2">
            <div className="sticky top-18">
              <StatsPanel
                total={total}
                itemCount={items.length}
                categoryCount={categories.length}
                currencyTotals={currencyTotals}
                isMultiCurrency={isMultiCurrency}
              />
            </div>
          </div>
          {/* Center: 8-col on desktop, full-width on mobile */}
          <div className="md:col-span-8 section-list">
            {filtered.length === 0 ? (
              <p className="empty-state">Nenhum link encontrado nesta categoria.</p>
            ) : (
              filtered.map((category) => (
                <CategorySection
                  key={category}
                  name={category}
                  items={grouped[category]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isMultiCurrency={isMultiCurrency}
                />
              ))
            )}
          </div>
          {/* Right: empty balancing col (desktop only) */}
          <div className="hidden md:block md:col-span-2" />
        </div>
      </main>
      <LinkComposer categories={categories} onSubmit={handleComposerSubmit} />
      {modal.open && (
        <ItemModal
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          url={modal.mode === 'add' ? modal.url : undefined}
          categories={categories}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </>
  )
}
