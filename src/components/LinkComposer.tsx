import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckIcon, ChevronsUpDown, LoaderCircle, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import appLogoSrc from '../assets/images/Logo-App.svg'
import ReactCountryFlag from 'react-country-flag'
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies'
import type { Currency } from '@/lib/currencies'

interface LinkComposerProps {
  categories: string[]
  onSubmit: (payload: { url: string; name: string; price: number; category: string; currency: string }) => Promise<void> | void
}

const DEFAULT_CATEGORY = 'Todos'

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

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

type ComposerVisualState = 'default' | 'active' | 'loading' | 'opened' | 'feedback'

export function LinkComposer({ categories, onSubmit }: LinkComposerProps) {
  const [url, setUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpened, setIsOpened] = useState(false)
  const [isFeedback, setIsFeedback] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(DEFAULT_CURRENCY)
  const [currencySearch, setCurrencySearch] = useState('')
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false)
  const [error, setError] = useState('')

  const [feedbackUrl, setFeedbackUrl] = useState('')
  const [feedbackFavicon, setFeedbackFavicon] = useState('')

  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined)

  const formRef = useRef<HTMLFormElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const normalizedCategories = useMemo(() => {
    const cleaned = Array.from(new Set(categories.map((cat) => cat.trim()).filter(Boolean)))
    if (cleaned.some((cat) => cat.toLowerCase() === DEFAULT_CATEGORY.toLowerCase())) {
      return cleaned
    }
    return [DEFAULT_CATEGORY, ...cleaned]
  }, [categories])

  const canCreateCategory =
    categorySearch.trim().length > 0 &&
    !normalizedCategories.some(
      (cat) => cat.toLowerCase() === categorySearch.trim().toLowerCase(),
    )

  const hasUrl = url.trim().length > 0
  const normalizedUrl = sanitizeUrl(url)
  const rowUrl = isFeedback ? feedbackUrl : normalizedUrl || url.trim()
  const rowFavicon = isFeedback ? feedbackFavicon : faviconFromUrl(normalizedUrl)

  const visualState: ComposerVisualState = isFeedback
    ? 'feedback'
    : isOpened
      ? 'opened'
      : isLoading
        ? 'loading'
        : isFocused || hasUrl
          ? 'active'
          : 'default'

  useEffect(() => {
    if (!hasUrl || isFeedback) {
      setIsLoading(false)
      setIsOpened(false)
      return
    }

    setIsLoading(false)
    setIsOpened(false)

    const loadingStart = window.setTimeout(() => setIsLoading(true), 280)
    const loadingDone = window.setTimeout(() => {
      setIsLoading(false)
      setIsOpened(true)
      setName((prev) => prev || hostnameFromUrl(sanitizeUrl(url)))
    }, 900)

    return () => {
      window.clearTimeout(loadingStart)
      window.clearTimeout(loadingDone)
    }
  }, [hasUrl, isFeedback, url])

  useLayoutEffect(() => {
    const formNode = formRef.current
    const node = contentRef.current
    if (!formNode || !node) return

    const updateHeight = () => {
      const styles = window.getComputedStyle(formNode)
      const paddingTop = parseFloat(styles.paddingTop) || 0
      const paddingBottom = parseFloat(styles.paddingBottom) || 0
      const contentHeight = node.getBoundingClientRect().height
      setPanelHeight(Math.ceil(contentHeight + paddingTop + paddingBottom))
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [visualState, rowUrl, name, price, selectedCategory, selectedCurrency, error, isSubmitting, categoryPopoverOpen, currencyPopoverOpen])

  function resetComposer() {
    setUrl('')
    setName('')
    setPrice('')
    setSelectedCategory(DEFAULT_CATEGORY)
    setCategorySearch('')
    setCategoryPopoverOpen(false)
    setSelectedCurrency(DEFAULT_CURRENCY)
    setCurrencySearch('')
    setCurrencyPopoverOpen(false)
    setError('')
    setIsFocused(false)
    setIsLoading(false)
    setIsOpened(false)
    setIsFeedback(false)
    setFeedbackUrl('')
    setFeedbackFavicon('')
  }

  function handleSelectCategory(category: string) {
    setSelectedCategory(category)
    setCategorySearch('')
    setCategoryPopoverOpen(false)
    setError('')
  }

  function handleCreateCategory() {
    const nextCategory = categorySearch.trim()
    if (!nextCategory) return
    setSelectedCategory(nextCategory)
    setCategorySearch('')
    setCategoryPopoverOpen(false)
    setError('')
  }

  function handleSelectCurrency(currency: Currency) {
    setSelectedCurrency(currency)
    setCurrencySearch('')
    setCurrencyPopoverOpen(false)
  }

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    )
  }, [currencySearch])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!isOpened || isFeedback || isLoading || isSubmitting) return

    const finalUrl = sanitizeUrl(url)
    if (!finalUrl) {
      setError('Cole uma URL válida para continuar.')
      return
    }

    if (!selectedCategory.trim() || selectedCategory === DEFAULT_CATEGORY) {
      setError('Selecione uma categoria existente ou crie uma nova.')
      return
    }

    const parsedPrice = parseFloat(price.replace(',', '.')) || 0
    const finalName = name.trim() || hostnameFromUrl(finalUrl)

    try {
      setIsSubmitting(true)
      await Promise.resolve(
        onSubmit({
          url: finalUrl,
          name: finalName,
          price: parsedPrice,
          category: selectedCategory.trim(),
          currency: selectedCurrency.code,
        }),
      )

      setFeedbackUrl(finalUrl)
      setFeedbackFavicon(faviconFromUrl(finalUrl))
      setIsOpened(false)
      setIsLoading(false)
      setIsFeedback(true)
      setName('')
      setPrice('')
      setCategorySearch('')
      setCategoryPopoverOpen(false)
      setCurrencySearch('')
      setCurrencyPopoverOpen(false)
      setError('')
    } catch {
      setError('Não foi possível adicionar o link. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showInputRow = visualState === 'default' || visualState === 'active'
  const showLoadingRow = visualState === 'loading'
  const showOpenedFields = visualState === 'opened'
  const showFeedbackActions = visualState === 'feedback'
  const isCompactState =
    visualState === 'default' || visualState === 'active' || visualState === 'loading'

  return (
    <div className="link-composer-wrap">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={cn(
          'link-composer-panel w-[min(458px,100%-32px)] rounded-2xl border border-[#eee] bg-white shadow-[0_8px_16px_rgba(0,0,0,0.08)]',
          isCompactState ? 'px-4 py-2' : 'p-6',
          (showOpenedFields || showFeedbackActions) && 'space-y-4',
        )}
        style={{
          height: panelHeight ? `${panelHeight}px` : undefined,
          overflow: 'hidden',
          transition:
            'height 350ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 200ms ease-out, box-shadow 150ms ease-out',
        }}
      >
        <div ref={contentRef} className="space-y-4">
          <div className="flex w-full items-center gap-4">
            <div
              className={cn(
                'relative size-8 shrink-0 overflow-hidden transition-all duration-200',
                showLoadingRow ? 'rounded-lg border border-[#eee]' : 'rounded-[8px]',
                showFeedbackActions && 'rounded-lg bg-[#289717]',
              )}
            >
              <img
                src={appLogoSrc}
                alt="Bag"
                className={cn(
                  'absolute inset-0 m-auto size-7 transition-all duration-200',
                  visualState === 'default' || visualState === 'active'
                    ? 'scale-100 opacity-100'
                    : 'scale-75 opacity-0',
                )}
              />
              <LoaderCircle
                className={cn(
                  'absolute inset-0 m-auto size-6 animate-[linkComposerSpin_700ms_linear_infinite] transition-all duration-200',
                  showLoadingRow ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                )}
              />
              {rowFavicon && (
                <img
                  src={rowFavicon}
                  alt=""
                  className={cn(
                    'absolute inset-0 m-auto size-8 rounded-[8px] transition-all duration-200',
                    showOpenedFields ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                  )}
                />
              )}
              <Check
                className={cn(
                  'absolute inset-0 m-auto size-5 text-white transition-all duration-200',
                  showFeedbackActions
                    ? 'scale-100 opacity-100 animate-[linkComposerCheckPop_400ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]'
                    : 'scale-50 opacity-0',
                )}
              />
            </div>

            <div className="relative min-w-0 flex-1">
              {showInputRow ? (
                <div className="relative min-h-9">
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={(event) => {
                      setUrl(event.target.value)
                      setError('')
                      setIsFeedback(false)
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    spellCheck={false}
                    className={cn(
                      'h-9 w-full border-0 bg-transparent pl-2 text-base leading-6 font-medium text-black outline-none placeholder:font-medium placeholder:text-[#ccc]',
                    )}
                    placeholder="Cole a URL"
                    aria-label="Cole a URL"
                  />
                </div>
              ) : (
                <p
                  className={cn(
                    'truncate whitespace-nowrap text-[15px] text-black',
                    showLoadingRow && 'animate-[linkComposerPulse_1.5s_ease-in-out_infinite] opacity-60',
                    showFeedbackActions && 'text-sm text-[#aaa]',
                  )}
                >
                  {rowUrl}
                </p>
              )}
            </div>
          </div>

          {showOpenedFields && (
            <div className="space-y-4 border-t border-[#eee] pt-4">
              <div
                className="space-y-1.5 opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
                style={{ animationDelay: '150ms' }}
              >
                <Label htmlFor="composer-title" className="text-sm font-medium text-black">
                  Título
                </Label>
                <Input
                  id="composer-title"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome do produto"
                  className="h-10 rounded-md border-[#e2e8f0] px-3 text-sm text-slate-950 focus-visible:border-black"
                />
              </div>

              <div
                className="space-y-1.5 opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
                style={{ animationDelay: '220ms' }}
              >
                <Label className="text-sm font-medium text-black">Preço</Label>
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
                        <ReactCountryFlag
                          countryCode={selectedCurrency.countryCode}
                          style={{ fontSize: '1.1em', lineHeight: '1em' }}
                        />
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
                                <ReactCountryFlag
                                  countryCode={currency.countryCode}
                                  style={{ fontSize: '1.1em', lineHeight: '1em', marginRight: '0.5rem' }}
                                />
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
                    id="composer-price"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="0.00"
                    className="h-10 min-w-0 flex-1 rounded-md border-[#e2e8f0] px-3 text-sm text-slate-950 focus-visible:border-black"
                  />
                </div>
              </div>

              <div
                className="space-y-1.5 opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
                style={{ animationDelay: '290ms' }}
              >
                <Label className="text-sm font-medium text-black">Categoria</Label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryPopoverOpen}
                      className="h-10 w-full justify-between rounded-md border-[#e2e8f0] px-3 text-sm font-normal text-slate-950 hover:bg-white"
                    >
                      {selectedCategory || DEFAULT_CATEGORY}
                      <ChevronsUpDown className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Pesquisar categoria..."
                        value={categorySearch}
                        onValueChange={setCategorySearch}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                        <CommandGroup>
                          {normalizedCategories.map((cat) => (
                            <CommandItem key={cat} value={cat} onSelect={() => handleSelectCategory(cat)}>
                              <CheckIcon
                                className={cn(
                                  'mr-2 size-4',
                                  selectedCategory === cat ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {cat}
                            </CommandItem>
                          ))}
                          {canCreateCategory && (
                            <CommandItem
                              value={`create-${categorySearch}`}
                              onSelect={handleCreateCategory}
                            >
                              <PlusCircle className="mr-2 size-4" />
                              Criar categoria "{categorySearch.trim()}"
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {error && (
                <p className="text-xs text-red-700 opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]">
                  {error}
                </p>
              )}

              <div
                className="flex items-center justify-end gap-2 opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
                style={{ animationDelay: '360ms' }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetComposer}
                  className="h-10 rounded-lg border-[#eee] px-3 text-sm hover:bg-black/[0.04]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-lg bg-[#FC4E23] px-3 text-sm text-white transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#e6461f] active:scale-[0.97]"
                >
                  {isSubmitting ? 'Adicionando...' : 'Adicionar link'}
                </Button>
              </div>
            </div>
          )}

          {showFeedbackActions && (
            <div className="space-y-4 border-t border-[#eee] pt-4">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetComposer}
                  className="h-10 rounded-lg border-[#eee] px-3 text-sm opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
                  style={{ animationDelay: '350ms' }}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    resetComposer()
                    setIsFocused(true)
                    window.requestAnimationFrame(() => urlInputRef.current?.focus())
                  }}
                  className="h-10 rounded-lg bg-[#FC4E23] px-3 text-sm text-white opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards] hover:bg-[#e6461f]"
                  style={{ animationDelay: '410ms' }}
                >
                  Novo Link
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
