import { useState } from 'react'
import { useStore } from './lib/store'
import type { Profile } from './lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth, useRequiredUser } from '@/lib/auth'
import { profileFromAuthUser } from '@/lib/auth-profile'

function CategoryEditModal({
  name,
  onSave,
  onDelete,
  onClose,
}: {
  name: string
  onSave: (next: string) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(name)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = draft.trim()
    if (!next) return
    onSave(next)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-2 !justify-between">
            <Button type="button" variant="destructive" onClick={onDelete}>
              Deletar
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProfileApp() {
  const { signOut, syncProfile } = useAuth()
  const user = useRequiredUser()

  const { state, setProfile, setCategories, setItems } = useStore(
    user.id,
    profileFromAuthUser(user),
  )
  const { profile, categories, items } = state

  const [formData, setFormData] = useState<Profile>(profile)
  const [newCategory, setNewCategory] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaveMessage(null)
    setProfile(formData)
    try {
      await syncProfile(formData)
      setSaveMessage('Perfil salvo com sucesso.')
    } catch {
      setSaveMessage('Perfil salvo localmente. Falha ao sincronizar com Supabase.')
    }
  }

  function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name || categories.includes(name)) return
    setCategories([...categories, name])
    setNewCategory('')
  }

  function handleCategoryRename(idx: number, nextName: string) {
    const prevName = categories[idx]
    if (!prevName || prevName === nextName || categories.includes(nextName)) return
    const nextCategories = [...categories]
    nextCategories[idx] = nextName
    const nextItems = items.map((item) =>
      item.category === prevName ? { ...item, category: nextName } : item,
    )
    setItems(nextItems)
    setCategories(nextCategories)
    setEditingIdx(null)
  }

  function handleCategoryDelete(idx: number) {
    const name = categories[idx]
    const nextCategories = categories.filter((_, i) => i !== idx)
    const fallback = nextCategories[0] ?? 'Todos'
    const nextItems = items.map((item) =>
      item.category === name ? { ...item, category: fallback } : item,
    )
    setItems(nextItems)
    setCategories(nextCategories)
    setEditingIdx(null)
  }

  const initial = (profile.name || 'U').trim().charAt(0).toUpperCase()
  const editingCategory = editingIdx !== null ? categories[editingIdx] : null

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif]">
      {/* Full-width header */}
      <header className="w-full px-4 pt-6 pb-0">
        <Button variant="secondary" asChild>
          <a href="./index.html">Voltar</a>
        </Button>
      </header>

      {/* Centered container */}
      <div className="mx-auto max-w-5xl px-4">
        <h1 className="mt-8 mb-8 text-2xl font-semibold text-black">
          Perfil &amp; Configurações
        </h1>

        {/* Layout: single column on mobile, two columns on desktop */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Profile card: full-width on mobile, fixed width on desktop */}
          <aside className="w-full md:w-55.25 md:shrink-0">
            <div className="flex flex-col items-center gap-[17px] rounded-2xl border border-[#eee] p-6 shadow-[0px_8px_12px_0px_rgba(0,0,0,0.08)]">
              <div className="bg-[#f7bd07] rounded-full size-20 flex items-center justify-center">
                <span className="text-[32px] font-semibold text-black leading-none">
                  {initial}
                </span>
              </div>
              <p className="text-base font-semibold text-black text-center">{profile.name}</p>
            </div>
          </aside>

          {/* Settings sections */}
          <div className="flex-1 flex flex-col gap-12 pb-12 w-full min-w-0">
            {/* Account settings */}
            <section className="flex flex-col gap-6">
              <p className="text-sm font-semibold text-black">Configurações da conta</p>
              {/* Stacked on mobile, side-by-side on desktop */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label>Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            {/* Categories */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-black">Categorias</p>
                <form onSubmit={handleAddCategory}>
                  <div className="border border-input rounded-md flex items-center px-3 py-1 focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:border-ring transition-all">
                    <Input
                      className="h-7 border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 px-0"
                      placeholder="Nova categoria"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <Button type="submit" variant="ghost" size="sm" className="ml-1 h-7 px-2">
                      Adicionar
                    </Button>
                  </div>
                </form>
              </div>
              <div className="border border-[#eee] rounded-lg overflow-hidden">
                {categories.map((cat, idx) => {
                  const count = items.filter((i) => i.category === cat).length
                  return (
                    <div
                      key={cat}
                      className={`flex gap-2 items-center px-4 py-2.5 ${idx < categories.length - 1 ? 'border-b border-[#eee]' : ''}`}
                    >
                      <p className="flex-1 text-sm text-black">
                        <span className="font-medium">{cat}</span>
                        <span className="text-[#999]">{`  •  ${count} ${count === 1 ? 'Link' : 'Links'}`}</span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        onClick={() => setEditingIdx(idx)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </Button>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Save button */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => void signOut()}>
                Sair
              </Button>
              <Button type="button" onClick={() => void handleSave()}>
                Salvar
              </Button>
            </div>
            {saveMessage && <p className="text-sm text-[#555] -mt-8">{saveMessage}</p>}
          </div>
        </div>
      </div>

      {/* Category edit modal */}
      {editingCategory !== null && editingIdx !== null && (
        <CategoryEditModal
          name={editingCategory}
          onSave={(next) => handleCategoryRename(editingIdx, next)}
          onDelete={() => handleCategoryDelete(editingIdx)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  )
}
