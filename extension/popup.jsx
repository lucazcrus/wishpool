import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Globe, LogOut, Plus, Settings } from 'lucide-react'
import appLogoSrc from '../src/assets/images/Logo-App.svg'

import { Avatar, AvatarFallback, AvatarImage } from '../src/components/ui/avatar'
import { Button } from '../src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../src/components/ui/dropdown-menu'
import { Input } from '../src/components/ui/input'
import { Label } from '../src/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/components/ui/select'

const CATEGORIES_KEY = 'wishpoolCategories'
const QUEUE_KEY = 'wishpoolQueue'
const SESSION_KEY = 'wishpoolExtSession'
const DEFAULT_CATEGORIES = ['Todos']

const CURRENCIES = [
  { code: 'BRL', name: 'Real', countryCode: 'BR' },
  { code: 'USD', name: 'Dólar Americano', countryCode: 'US' },
  { code: 'EUR', name: 'Euro', countryCode: 'EU' },
  { code: 'GBP', name: 'Libra Esterlina', countryCode: 'GB' },
  { code: 'ARS', name: 'Peso Argentino', countryCode: 'AR' },
  { code: 'MXN', name: 'Peso Mexicano', countryCode: 'MX' },
  { code: 'CLP', name: 'Peso Chileno', countryCode: 'CL' },
  { code: 'COP', name: 'Peso Colombiano', countryCode: 'CO' },
  { code: 'PEN', name: 'Sol Peruano', countryCode: 'PE' },
  { code: 'UYU', name: 'Peso Uruguaio', countryCode: 'UY' },
  { code: 'CAD', name: 'Dólar Canadense', countryCode: 'CA' },
  { code: 'AUD', name: 'Dólar Australiano', countryCode: 'AU' },
  { code: 'JPY', name: 'Iene Japonês', countryCode: 'JP' },
  { code: 'CNY', name: 'Yuan Chinês', countryCode: 'CN' },
  { code: 'KRW', name: 'Won Sul-Coreano', countryCode: 'KR' },
  { code: 'INR', name: 'Rúpia Indiana', countryCode: 'IN' },
  { code: 'CHF', name: 'Franco Suíço', countryCode: 'CH' },
]
const DEFAULT_CURRENCY = CURRENCIES[0]
const CONFIGURED_APP_ORIGIN = __WISHPOOL_APP_ORIGIN__
const DEFAULT_APP_ORIGIN = 'https://bagapp.io'
const SUPABASE_URL = 'https://okpxxpjskegpohowqqry.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_i_N5por1Imv5eL20Y7VwRw_stIIpGCa'
const NEW_CATEGORY_VALUE = '__new__'
const COMPOSER_INPUT_CLASS =
  'h-10 rounded-md border-[#e2e8f0] px-3 text-sm text-slate-950 focus-visible:border-black'
const COMPOSER_SELECT_TRIGGER_CLASS =
  'h-10 rounded-md border-[#e2e8f0] px-3 text-sm font-normal text-slate-950 focus-visible:border-black hover:bg-white'

function normalizeCategories(value) {
  const raw = Array.isArray(value) ? value : []
  return Array.from(new Set([...DEFAULT_CATEGORIES, ...raw].map((item) => String(item).trim()).filter(Boolean)))
}


function getFaviconFromUrl(url) {
  try {
    const parsed = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`
  } catch {
    return ''
  }
}

function resolveAppOrigin(tabUrl) {
  try {
    if (CONFIGURED_APP_ORIGIN) {
      return new URL(CONFIGURED_APP_ORIGIN).origin
    }
  } catch {
    // noop
  }
  return DEFAULT_APP_ORIGIN
}

function statusClass(type) {
  if (type === 'success') return 'min-h-4 text-xs text-emerald-700'
  if (type === 'info') return 'min-h-4 text-xs text-slate-600'
  return 'min-h-4 text-xs text-red-700'
}

async function fetchSupabaseUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Não foi possível carregar usuário autenticado.')
  }

  return response.json()
}

async function signInWithPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error_description || payload.msg || 'Credenciais inválidas.')
  }

  return response.json()
}

async function signInWithGoogle() {
  if (typeof chrome.identity?.launchWebAuthFlow !== 'function') {
    throw new Error(
      'API de identidade indisponível. Recarregue a extensão em chrome://extensions e tente novamente.',
    )
  }

  const redirectUrl = chrome.identity.getRedirectURL('supabase-auth')
  console.log('[Bag] Google OAuth redirect URL (adicione no Supabase):', redirectUrl)

  const authUrl =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectUrl)}`

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(new Error(chrome.runtime.lastError?.message || 'Login cancelado.'))
        return
      }

      try {
        const url = new URL(responseUrl)
        const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : ''
        const params = new URLSearchParams(fragment)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (!accessToken) {
          reject(
            new Error(
              'Token não encontrado. Adicione o Redirect URI no Supabase (veja o console).',
            ),
          )
          return
        }

        resolve({ access_token: accessToken, refresh_token: refreshToken })
      } catch {
        reject(new Error('Erro ao processar resposta do login.'))
      }
    })
  })
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] || null
}

async function queueItem(payload) {
  const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get([QUEUE_KEY])
  const nextQueue = [...queue, payload]
  await chrome.storage.local.set({ [QUEUE_KEY]: nextQueue })
}

function PopupApp() {
  const [session, setSession] = useState(null)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORIES[0])
  const [newCategory, setNewCategory] = useState('')

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY)
  const [activeTab, setActiveTab] = useState(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [isLoginBusy, setIsLoginBusy] = useState(false)
  const [isCaptureBusy, setIsCaptureBusy] = useState(false)
  const [isAddedFeedback, setIsAddedFeedback] = useState(false)
  const [feedbackLink, setFeedbackLink] = useState(null)
  const [frameHeight, setFrameHeight] = useState(undefined)
  const [previewFaviconSrc, setPreviewFaviconSrc] = useState('')

  const [loginStatus, setLoginStatus] = useState({ message: '', type: 'info' })
  const [captureStatus, setCaptureStatus] = useState({ message: '', type: 'info' })
  const frameRef = useRef(null)
  const frameContentRef = useRef(null)

  const isLogged = Boolean(session?.email)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const stored = await chrome.storage.local.get([CATEGORIES_KEY, SESSION_KEY])
      if (cancelled) return

      const normalized = normalizeCategories(stored[CATEGORIES_KEY])
      setCategories(normalized)
      setSelectedCategory((prev) =>
        prev === NEW_CATEGORY_VALUE || normalized.includes(prev) ? prev : normalized[0] ?? 'Todos',
      )

      const nextSession = stored[SESSION_KEY] || null
      setSession(nextSession)


      const tab = await getActiveTab()
      if (cancelled) return

      if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
        setCaptureStatus({ message: 'Abra a extensão em uma aba com URL http/https.', type: 'error' })
        setActiveTab(null)
        return
      }

      setActiveTab(tab)
      setTitle(tab.title || '')
    }

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== 'local') return


      if (changes[CATEGORIES_KEY]) {
        const normalized = normalizeCategories(changes[CATEGORIES_KEY].newValue)
        setCategories(normalized)
        setSelectedCategory((prev) =>
          prev === NEW_CATEGORY_VALUE || normalized.includes(prev) ? prev : normalized[0] ?? 'Todos',
        )
      }

      if (changes[SESSION_KEY]) {
        setSession(changes[SESSION_KEY].newValue || null)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    void bootstrap().catch(() => {
      setCaptureStatus({ message: 'Falha ao inicializar extensão.', type: 'error' })
    })

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const avatarInitial = useMemo(() => {
    return (session?.email || 'L').trim().charAt(0).toUpperCase() || 'L'
  }, [session?.email])
  const appOrigin = useMemo(() => resolveAppOrigin(activeTab?.url), [activeTab?.url])
  const appUrl = `${appOrigin}/`
  const profileUrl = `${appOrigin}/profile.html`

  useLayoutEffect(() => {
    const panelNode = frameRef.current
    const contentNode = frameContentRef.current
    if (!panelNode || !contentNode || !isLogged) return

    const updateHeight = () => {
      setFrameHeight(Math.ceil(contentNode.getBoundingClientRect().height))
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateHeight)
    observer.observe(contentNode)
    return () => observer.disconnect()
  }, [isLogged, isAddedFeedback, isCaptureBusy, title, price, selectedCategory, newCategory, captureStatus.message, activeTab?.url, feedbackLink?.url])

  async function handleCreateCategory() {
    const candidate = newCategory.trim()
    if (!candidate) return null

    if (categories.includes(candidate)) {
      setSelectedCategory(candidate)
      return candidate
    }

    const nextCategories = [...categories, candidate]
    await chrome.storage.local.set({ [CATEGORIES_KEY]: nextCategories })
    setCategories(nextCategories)
    setSelectedCategory(candidate)
    setNewCategory('')
    return candidate
  }

  async function handlePasswordLogin(event) {
    event.preventDefault()

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginStatus({ message: 'Preencha email e senha.', type: 'error' })
      return
    }

    setIsLoginBusy(true)
    setLoginStatus({ message: '', type: 'info' })

    try {
      const auth = await signInWithPassword(loginEmail.trim(), loginPassword.trim())
      const user = await fetchSupabaseUser(auth.access_token)
      const sessionData = {
        email: user.email || loginEmail.trim(),
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token || null,
        provider: 'password',
        loggedAt: new Date().toISOString(),
      }
      await chrome.storage.local.set({ [SESSION_KEY]: sessionData })
      setSession(sessionData)
      setLoginStatus({ message: '', type: 'success' })
    } catch (error) {
      setLoginStatus({
        message: error instanceof Error ? error.message : 'Falha no login.',
        type: 'error',
      })
    } finally {
      setIsLoginBusy(false)
    }
  }

  async function handleGoogleLogin() {
    setIsLoginBusy(true)
    setLoginStatus({ message: '', type: 'info' })

    try {
      const auth = await signInWithGoogle()
      const user = await fetchSupabaseUser(auth.access_token)
      const sessionData = {
        email: user.email || 'usuario@google.com',
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token || null,
        provider: 'google',
        loggedAt: new Date().toISOString(),
      }
      await chrome.storage.local.set({ [SESSION_KEY]: sessionData })
      setSession(sessionData)
    } catch (error) {
      setLoginStatus({
        message: error instanceof Error ? error.message : 'Falha no login com Google.',
        type: 'error',
      })
    } finally {
      setIsLoginBusy(false)
    }
  }

  async function handleLogout() {
    try {
      if (session?.accessToken) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }).catch(() => {})
      }
    } finally {
      await chrome.storage.local.remove([SESSION_KEY])
      setSession(null)
      setLoginPassword('')
      setLoginStatus({ message: '', type: 'info' })
    }
  }

  async function handleCaptureSubmit(event) {
    event.preventDefault()
    setIsAddedFeedback(false)
    setFeedbackLink(null)
    setCaptureStatus({ message: '', type: 'info' })
    setIsCaptureBusy(true)

    try {
      if (!activeTab?.url || !/^https?:\/\//i.test(activeTab.url)) {
        setCaptureStatus({ message: 'Abra a extensão em uma aba com URL http/https.', type: 'error' })
        return
      }

      const parsedPrice = selectedCurrency.code === 'BRL'
        ? parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0
        : parseFloat(price.replace(/,/g, '')) || 0
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        setCaptureStatus({ message: 'Preço inválido.', type: 'error' })
        return
      }

      let finalCategory = selectedCategory
      if (selectedCategory === NEW_CATEGORY_VALUE) {
        const created = await handleCreateCategory()
        if (!created) {
          setCaptureStatus({ message: 'Digite o nome da nova categoria.', type: 'error' })
          return
        }
        finalCategory = created
      }

      const fallbackFavicon = getFaviconFromUrl(activeTab.url)
      const payload = {
        queueId: crypto.randomUUID(),
        name: title.trim(),
        price: parsedPrice,
        currency: selectedCurrency.code,
        category: finalCategory,
        url: activeTab.url,
        image: activeTab.favIconUrl || fallbackFavicon,
        capturedAt: new Date().toISOString(),
      }

      if (!payload.name || !payload.category) {
        setCaptureStatus({ message: 'Preencha título e categoria.', type: 'error' })
        return
      }

      await queueItem(payload)


      setPrice('')
      setSelectedCurrency(DEFAULT_CURRENCY)
      setCaptureStatus({ message: '', type: 'success' })
      setFeedbackLink({
        url: payload.url,
        image: payload.image,
      })
      setIsAddedFeedback(true)
    } finally {
      setIsCaptureBusy(false)
    }
  }

  function handleCreateNewLink() {
    setIsAddedFeedback(false)
    setFeedbackLink(null)
    setCaptureStatus({ message: '', type: 'info' })
    setPrice('')
    setTitle(activeTab?.title || '')
  }

  const fallbackPreviewFavicon = activeTab?.url ? getFaviconFromUrl(activeTab.url) : ''
  const rawTabFavicon = activeTab?.favIconUrl || ''
  const currentRowUrl = isAddedFeedback
    ? feedbackLink?.url || activeTab?.url || '-'
    : activeTab?.url || '-'

  useEffect(() => {
    setPreviewFaviconSrc(rawTabFavicon || fallbackPreviewFavicon || '')
  }, [rawTabFavicon, fallbackPreviewFavicon])

  return (
    <main
      ref={frameRef}
      className="w-[350px] overflow-hidden rounded-2xl"
      style={{
        height: isLogged && frameHeight ? `${frameHeight}px` : undefined,
        overflow: 'hidden',
        transition:
          'height 350ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 200ms ease-out, box-shadow 150ms ease-out',
      }}
    >
      {!isLogged ? (
        <section aria-label="Login" className="min-h-[580px]">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <img src={appLogoSrc} alt="Bag" className="h-8 w-auto shrink-0" />
          </header>

          <div className="px-5 pb-5 pt-6">
            <h1 className="m-0 text-4xl font-bold tracking-tight">Fazer login</h1>
            <p className="mt-2 text-sm text-slate-600">Entre na sua conta para salvar seus links.</p>

            <form onSubmit={handlePasswordLogin} className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={isLoginBusy}>
                  Fazer login
                </Button>
                <Button type="button" variant="outline" onClick={handleGoogleLogin} disabled={isLoginBusy}>
                  Continuar com Google
                </Button>
              </div>
              <p className={statusClass(loginStatus.type)}>{loginStatus.message}</p>
            </form>
          </div>
        </section>
      ) : (
        <section ref={frameContentRef} aria-label="Adicionar link">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <img src={appLogoSrc} alt="Bag" className="h-8 w-auto shrink-0" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarImage src="" alt={session?.email || 'Usuário'} />
                    <AvatarFallback className="bg-amber-400 text-slate-950">
                      {avatarInitial}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => void chrome.tabs.create({ url: profileUrl })}>
                    <Settings className="size-4" />
                    Configurações
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout()}>
                    <LogOut className="size-4" />
                    Deslogar
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="px-5 pb-5 pt-4">
            <div className="mb-4 flex items-center gap-3">
              {isAddedFeedback ? (
                <span className="inline-flex size-8 min-w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#289717] text-white">
                  <Check className="size-5 stroke-[2.5]" />
                </span>
              ) : (
                <span className="inline-flex size-8 min-w-8 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-white">
                  {previewFaviconSrc ? (
                    <img
                      alt="Favicon"
                      width="20"
                      height="20"
                      className="h-5 w-5 rounded-sm"
                      src={previewFaviconSrc}
                      onError={() => {
                        if (fallbackPreviewFavicon && previewFaviconSrc !== fallbackPreviewFavicon) {
                          setPreviewFaviconSrc(fallbackPreviewFavicon)
                          return
                        }
                        setPreviewFaviconSrc('')
                      }}
                    />
                  ) : (
                    <Globe className="size-4 text-slate-500" />
                  )}
                </span>
              )}
              <p className="m-0 min-w-0 flex-1 truncate text-sm text-[#aaa]">{currentRowUrl}</p>
            </div>

            {isAddedFeedback ? (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" onClick={handleCreateNewLink}>
                    Novo Link
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void chrome.tabs.create({ url: appUrl })}>
                    Abrir app
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCaptureSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="capture-title">Título</Label>
                  <Input
                    id="capture-title"
                    name="title"
                    className={COMPOSER_INPUT_CLASS}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="capture-price">Preço</Label>
                  <div className="flex items-center gap-2">
                    <Select value={selectedCurrency.code} onValueChange={(code) => {
                      const c = CURRENCIES.find((c) => c.code === code) ?? DEFAULT_CURRENCY
                      setSelectedCurrency(c)
                      setPrice('')
                    }}>
                      <SelectTrigger className="h-10 w-auto shrink-0 gap-1.5 rounded-md border-[#e2e8f0] px-2.5 text-sm font-normal text-slate-950 hover:bg-white focus-visible:border-black">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            <span className={`fi fi-${selectedCurrency.countryCode.toLowerCase()}`} style={{ fontSize: '1.1em' }} />
                            <span>{selectedCurrency.code}</span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span className={`fi fi-${c.countryCode.toLowerCase()}`} style={{ fontSize: '1.1em' }} />
                              <span className="font-medium">{c.code}</span>
                              <span className="text-slate-500">{c.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="capture-price"
                      name="price"
                      className={`${COMPOSER_INPUT_CLASS} flex-1 min-w-0`}
                      placeholder={selectedCurrency.code === 'BRL' ? '0,00' : '0.00'}
                      value={price}
                      inputMode="numeric"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '')
                        if (!digits) { setPrice(''); return }
                        const amount = parseInt(digits, 10) / 100
                        const locale = selectedCurrency.code === 'BRL' ? 'pt-BR' : 'en-US'
                        setPrice(amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className={COMPOSER_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_CATEGORY_VALUE}>+ Nova categoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory === NEW_CATEGORY_VALUE && (
                  <div className="grid gap-2">
                    <Label htmlFor="capture-new-category">Nova categoria</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="capture-new-category"
                        name="newCategory"
                        className={COMPOSER_INPUT_CLASS}
                        placeholder="Ex: Tênis"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        required
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => void handleCreateCategory()}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={isCaptureBusy}>
                    {isCaptureBusy ? 'Adicionando...' : 'Adicionar link'}
                  </Button>
                </div>
              </form>
            )}

            {!isAddedFeedback && (
              <div className="mt-3">
                <p className={statusClass(captureStatus.type)}>{captureStatus.message}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<PopupApp />)
}
