import { useMemo, useState } from 'react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { CheckIcon, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURRENCIES, CURRENCIES_BY_CODE, DEFAULT_CURRENCY, flagClass, parseMaskedPrice } from '@/lib/currencies'
import type { Currency } from '@/lib/currencies'

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

function toMaskedPrice(price: number, currencyCode: string): string {
  if (!price) return ''
  const locale = currencyCode === 'BRL' ? 'pt-BR' : 'en-US'
  return price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ItemModal({ mode, item, url = '', categories, onSave, onClose }: ItemModalProps) {
  const safeUrl = url || item?.url || ''
  const hostname = safeUrl ? hostnameFromUrl(safeUrl) : ''
  const favicon = item?.image || (safeUrl ? faviconFromUrl(safeUrl) : '')

  const initialCurrency = CURRENCIES_BY_CODE[item?.currency ?? ''] ?? DEFAULT_CURRENCY

  const [name, setName] = useState(item?.name ?? '')
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [price, setPrice] = useState(item?.price != null ? toMaskedPrice(item.price, initialCurrency.code) : '')
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? 'Todos')
  const [currencySearch, setCurrencySearch] = useState('')
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false)

  const title = mode === 'edit' ? 'Editar link' : 'Novo link'
  const submitLabel = mode === 'edit' ? 'Salvar alterações' : 'Salvar link'

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    )
  }, [currencySearch])

  function handleSelectCurrency(currency: Currency) {
    setSelectedCurrency(currency)
    setCurrencySearch('')
    setCurrencyPopoverOpen(false)
    // reformat existing price value for new currency locale
    const parsed = parseMaskedPrice(price, selectedCurrency.code)
    if (parsed) setPrice(toMaskedPrice(parsed, currency.code))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedPrice = parseMaskedPrice(price, selectedCurrency.code)
    if (!name.trim() || !category.trim() || !safeUrl) return
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category: category.trim(),
      price: parsedPrice,
      currency: selectedCurrency.code,
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
              <div className="min-w-0 flex-1">
                <p className="preview-host">{hostname}</p>
                <p className="preview-url truncate">{safeUrl}</p>
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

            <div className="flex flex-col gap-1.5">
              <Label>Preço</Label>
              <div className="flex items-center gap-2">
                <Popover open={currencyPopoverOpen} onOpenChange={setCurrencyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={currencyPopoverOpen}
                      className="h-10 shrink-0 gap-1.5 rounded-md border-[#e2e8f0] px-2.5 text-sm font-normal text-slate-950 hover:bg-white"
                    >
                      <span className={flagClass(selectedCurrency.countryCode)} style={{ fontSize: '1.1em' }} />
                      <span>{selectedCurrency.code}</span>
                      <ChevronsUpDown className="size-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-0">
                    <Command>
                      <CommandInput
                        placeholder="Buscar moeda..."
                        value={currencySearch}
                        onValueChange={setCurrencySearch}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhuma moeda encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredCurrencies.map((currency) => (
                            <CommandItem
                              key={currency.code}
                              value={`${currency.code} ${currency.name}`}
                              onSelect={() => handleSelectCurrency(currency)}
                            >
                              <span className={cn(flagClass(currency.countryCode), 'mr-2')} style={{ fontSize: '1.1em' }} />
                              <span className="mr-1 font-medium">{currency.code}</span>
                              <span className="truncate text-slate-500">{currency.name}</span>
                              <CheckIcon
                                className={cn(
                                  'ml-auto size-4',
                                  selectedCurrency.code === currency.code ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input
                  id="modal-price"
                  name="price"
                  inputMode="numeric"
                  placeholder={selectedCurrency.code === 'BRL' ? '0,00' : '0.00'}
                  value={price}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    if (!digits) { setPrice(''); return }
                    const amount = parseInt(digits, 10) / 100
                    const locale = selectedCurrency.code === 'BRL' ? 'pt-BR' : 'en-US'
                    setPrice(amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                  }}
                  className="h-10 flex-1 min-w-0 rounded-md border-[#e2e8f0] px-3 text-sm text-slate-950 focus-visible:border-black"
                />
              </div>
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
