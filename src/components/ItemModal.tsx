import { useState } from 'react'
import type { Item } from '../lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ItemModalProps {
  mode: 'add' | 'edit'
  item?: Item
  url?: string
  categories: string[]
  onSave: (item: Item) => void
  onClose: () => void
}

function faviconFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  } catch {
    return ''
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function ItemModal({ mode, item, url = '', categories, onSave, onClose }: ItemModalProps) {
  const safeUrl = url || item?.url || ''
  const hostname = safeUrl ? hostnameFromUrl(safeUrl) : ''
  const favicon = item?.image || (safeUrl ? faviconFromUrl(safeUrl) : '')

  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '')
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? 'Todos')

  const title = mode === 'edit' ? 'Editar link' : 'Novo link'
  const submitLabel = mode === 'edit' ? 'Salvar alterações' : 'Salvar link'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedPrice = Number(price)
    if (!name.trim() || !category.trim() || !safeUrl || Number.isNaN(parsedPrice)) return
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category: category.trim(),
      price: parsedPrice,
      url: safeUrl,
      image: favicon,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-135 p-0 overflow-hidden">
        <div className="p-4">
          <DialogHeader className="mb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {safeUrl && (
            <div className="link-preview">
              {favicon && <img src={favicon} alt="Favicon" width={28} height={28} />}
              <div>
                <p className="preview-host">{hostname}</p>
                <p className="preview-url">{safeUrl}</p>
              </div>
            </div>
          )}
          <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-name">Nome</Label>
              <Input
                id="modal-name"
                name="name"
                required
                placeholder="Ex: Cadeira Office X"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-price">Preço</Label>
                <Input
                  id="modal-price"
                  type="number"
                  min="0"
                  step="0.01"
                  name="price"
                  required
                  placeholder="0,00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-category">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="modal-category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Todos">Todos</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-1">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">{submitLabel}</Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
