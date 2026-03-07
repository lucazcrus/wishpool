import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckIcon, ChevronsUpDown, LoaderCircle, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface LinkComposerProps {
  categories: string[]
  onSubmit: (payload: { url: string; name: string; price: number; category: string }) => Promise<void> | void
}

const DEFAULT_CATEGORY = 'Todos'

const LOGO_DATA_URI =
  "data:image/svg+xml,%3csvg%20width='36'%20height='32'%20viewBox='0%200%2036%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M9.9292%2017.474V4.70983C9.9292%203.31388%2011.2146%202.2722%2012.5802%202.5614L32.2589%206.72864C33.2739%206.94358%2034%207.83955%2034%208.87707V21.4097C34%2022.7955%2032.7321%2023.8349%2031.3732%2023.5631L11.6946%2019.6274C10.6681%2019.4221%209.9292%2018.5208%209.9292%2017.474Z'%20fill='%23F7BD07'/%3e%3cpath%20d='M6.2478%2020.589V7.82487C6.2478%206.42892%207.53318%205.38724%208.89885%205.67644L28.5775%209.84368C29.5925%2010.0586%2030.3186%2010.9546%2030.3186%2011.9921V24.5247C30.3186%2025.9106%2029.0507%2026.95%2027.6918%2026.6782L8.0132%2022.7424C6.98669%2022.5371%206.2478%2021.6358%206.2478%2020.589Z'%20fill='%23DA6ED4'/%3e%3cpath%20d='M6.2478%2020.589V7.82487C6.2478%206.42892%207.53318%205.38724%208.89885%205.67644L28.5775%209.84368C29.5925%2010.0586%2030.3186%2010.9546%2030.3186%2011.9921V24.5247C30.3186%2025.9106%2029.0507%2026.95%2027.6918%2026.6782L8.0132%2022.7424C6.98669%2022.5371%206.2478%2021.6358%206.2478%2020.589Z'%20fill='%23D22C00'/%3e%3cpath%20d='M2%2024.2704V11.5063C2%2010.1103%203.28538%209.06864%204.65105%209.35784L24.3297%2013.5251C25.3447%2013.74%2026.0708%2014.636%2026.0708%2015.6735V28.2061C26.0708%2029.592%2024.8029%2030.6314%2023.444%2030.3596L3.76539%2026.4239C2.73889%2026.2186%202%2025.3172%202%2024.2704Z'%20fill='%2343A2ED'/%3e%3cpath%20d='M2%2024.2704V11.5063C2%2010.1103%203.28538%209.06864%204.65105%209.35784L24.3297%2013.5251C25.3447%2013.74%2026.0708%2014.636%2026.0708%2015.6735V28.2061C26.0708%2029.592%2024.8029%2030.6314%2023.444%2030.3596L3.76539%2026.4239C2.73889%2026.2186%202%2025.3172%202%2024.2704Z'%20fill='%23002ED2'/%3e%3c/svg%3e"

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
  const [error, setError] = useState('')

  const [feedbackUrl, setFeedbackUrl] = useState('')
  const [feedbackFavicon, setFeedbackFavicon] = useState('')

  const [freezeCursorBlink, setFreezeCursorBlink] = useState(false)
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

  useEffect(() => {
    if (!hasUrl) return
    setFreezeCursorBlink(true)
    const timer = window.setTimeout(() => setFreezeCursorBlink(false), 500)
    return () => window.clearTimeout(timer)
  }, [url, hasUrl])

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
  }, [visualState, rowUrl, name, price, selectedCategory, error, isSubmitting, categoryPopoverOpen])

  function resetComposer() {
    setUrl('')
    setName('')
    setPrice('')
    setSelectedCategory(DEFAULT_CATEGORY)
    setCategorySearch('')
    setCategoryPopoverOpen(false)
    setError('')
    setIsFocused(false)
    setIsLoading(false)
    setIsOpened(false)
    setIsFeedback(false)
    setFeedbackUrl('')
    setFeedbackFavicon('')
    setFreezeCursorBlink(false)
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
                src={LOGO_DATA_URI}
                alt="Wishpool"
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
                  {!hasUrl && (
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-lg leading-none text-black transition-opacity duration-150',
                        freezeCursorBlink
                          ? 'opacity-100'
                          : 'animate-[linkComposerBlink_1s_step-end_infinite]',
                      )}
                    >
                      |
                    </span>
                  )}
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
                <Label htmlFor="composer-price" className="text-sm font-medium text-black">
                  Preço
                </Label>
                <Input
                  id="composer-price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="R$ 0.00"
                  className="h-10 rounded-md border-[#e2e8f0] px-3 text-sm text-slate-950 focus-visible:border-black"
                />
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
                  className="h-10 rounded-lg bg-black px-3 text-sm text-white transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#222] active:scale-[0.97]"
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
                  className="h-10 rounded-lg bg-black px-3 text-sm text-white opacity-0 animate-[linkComposerFadeUp_200ms_ease-out_forwards]"
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
