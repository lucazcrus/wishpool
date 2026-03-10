import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import logoSrc from './assets/images/Logo.svg'
import mockupSrc from './assets/images/mockup.png'
import googleIconSrc from './assets/images/icon-google.png'
import { SupabaseConfigErrorScreen } from './components/SupabaseConfigErrorScreen'
import { useAuth } from './lib/auth'

const SLIDE_DURATION = 4500

const slides = [
  { num: '01', label: 'Acompanhe o valor total dos produtos' },
  { num: '02', label: 'Organize seus links em abas editáveis' },
  { num: '03', label: 'Edite ou delete cada link como quiser' },
]

const BASE_MOCKUP_WIDTH_RATIO = 1
const TOP_OFFSET_RATIO = 0.05
const TOP_OFFSET_MIN = 36

const SLIDE_POSES = [
  { zoom: 4, anchor: 'left', offsetRatio: 0.35 },
  { zoom: 0.9, anchor: 'left', offsetRatio: 0.15 },
  { zoom: 1, anchor: 'right', offsetRatio: 0.1 },
] as const

export default function LandingApp() {
  const { user, isLoading, configError, signInWithPassword, signUpWithPassword, signInWithOAuth } =
    useAuth()

  const [active, setActive] = useState(0)
  const [barKey, setBarKey] = useState(0)
  const [tab, setTab] = useState<'login' | 'register'>('register')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measure carousel inner width for responsive scaling
  const navRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const [carouselW, setCarouselW] = useState(0)
  const [navH, setNavH] = useState(0)

  useEffect(() => {
    const carousel = carouselRef.current
    const nav = navRef.current
    if (!carousel || !nav) return

    const update = () => {
      setCarouselW(carousel.clientWidth)
      setNavH(nav.offsetHeight)
    }
    update()

    const ro = new ResizeObserver(update)
    ro.observe(carousel)
    return () => ro.disconnect()
  }, [])

  const goTo = (i: number) => {
    setActive(i)
    setBarKey((k) => k + 1)
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => goTo((active + 1) % 3), SLIDE_DURATION)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active, barKey])

  useEffect(() => {
    if (user) {
      window.location.replace('/')
    }
  }, [user])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    try {
      if (!email.trim() || !password) {
        throw new Error('Preencha email e senha.')
      }

      if (tab === 'register') {
        if (!fullName.trim()) {
          throw new Error('Preencha seu nome para criar a conta.')
        }
        const result = await signUpWithPassword(email.trim(), password, fullName.trim())
        setMessage(
          result.requiresEmailConfirmation
            ? 'Conta criada. Enviamos um email de confirmação. Verifique caixa de entrada e spam.'
            : 'Conta criada e autenticada com sucesso.',
        )
      } else {
        await signInWithPassword(email.trim(), password)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleAuth = async () => {
    setMessage(null)
    setIsSubmitting(true)
    try {
      await signInWithOAuth('google')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha no login com Google.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getMockupStyle = (): CSSProperties => {
    if (carouselW <= 0) return {}

    const pose = SLIDE_POSES[active]
    const baseWidth = carouselW * BASE_MOCKUP_WIDTH_RATIO
    const width = baseWidth * pose.zoom
    const top = navH + Math.max(TOP_OFFSET_MIN, carouselW * TOP_OFFSET_RATIO)
    const edgeOffset = carouselW * pose.offsetRatio
    const left = pose.anchor === 'left' ? edgeOffset : carouselW - edgeOffset - width

    return {
      position: 'absolute',
      left,
      top,
      width,
      height: 'auto',
      transition:
        'left 0.72s cubic-bezier(0.4,0,0.2,1), top 0.72s cubic-bezier(0.4,0,0.2,1), width 0.72s cubic-bezier(0.4,0,0.2,1)',
    }
  }

  if (configError) {
    return <SupabaseConfigErrorScreen message={configError} />
  }

  return (
    <div
      className="min-h-screen bg-[#f9f9f9] flex flex-col md:flex-row"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* ── Sidebar ── */}
      <aside className="w-full md:w-89 md:shrink-0 flex flex-col justify-between gap-10 p-4 md:py-4 md:pl-4 md:pr-3 md:min-h-screen">
        <img src={logoSrc} alt="Wishpool" className="w-9 h-8 shrink-0" />

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold text-black leading-snug">
              Sua wishlist universal.
            </h1>
            <p className="text-2xl font-semibold text-[#aaa] leading-snug">
              Salve e acompanhe seus produtos da internet num único lugar.
            </p>
          </div>

          <div className="bg-white border border-[#eee] rounded-lg flex flex-col gap-6 pb-4">
            {/* Tabs */}
            <div className="flex">
              <button
                onClick={() => setTab('login')}
                disabled={isSubmitting || isLoading}
                className={`flex-1 py-2.5 text-sm font-medium border-b transition-colors cursor-pointer ${
                  tab === 'login' ? 'border-black text-black' : 'border-[#eee] text-[#999]'
                }`}
              >
                Já tenho cadastro
              </button>
              <button
                onClick={() => setTab('register')}
                disabled={isSubmitting || isLoading}
                className={`flex-1 py-2.5 text-sm font-medium border-b transition-colors cursor-pointer ${
                  tab === 'register' ? 'border-black text-black' : 'border-[#eee] text-[#999]'
                }`}
              >
                Novo usuário
              </button>
            </div>

            {/* Form */}
            <form className="flex flex-col gap-4 px-4" onSubmit={handleAuthSubmit}>
              {tab === 'register' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#020617]">Nome</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nome e sobrenome"
                    className="border border-[#eee] rounded-md px-3 py-2 text-base placeholder:text-[#aaa] outline-none focus:border-[#ccc]"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#020617]">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  className="border border-[#eee] rounded-md px-3 py-2 text-base placeholder:text-[#aaa] outline-none focus:border-[#ccc]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#020617]">Senha</label>
                <input
                  type="password"
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border border-[#eee] rounded-md px-3 py-2 text-base outline-none focus:border-[#ccc]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="bg-[#0f172a] disabled:opacity-70 text-[#f8fafc] text-sm font-medium h-10 rounded-md w-full hover:bg-[#1e293b] transition-colors cursor-pointer"
                >
                  {isLoading
                    ? 'Carregando...'
                    : isSubmitting
                      ? 'Processando...'
                      : tab === 'register'
                        ? 'Cadastrar'
                        : 'Entrar'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || isLoading}
                  onClick={() => void handleGoogleAuth()}
                  className="flex items-center justify-center gap-2.5 h-9 border border-[#e2e8f0] rounded-md text-sm font-medium text-[#020617] w-full hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-70"
                >
                  <img src={googleIconSrc} alt="Google" className="w-4 h-4 object-contain" />
                  {tab === 'register' ? 'Cadastrar com Google' : 'Entrar com Google'}
                </button>
              </div>

              {message && <p className="text-sm text-[#475569]">{message}</p>}
            </form>
          </div>
        </div>
      </aside>

      {/* ── Carousel ── */}
      <div className="flex-1 p-4 md:pl-0 min-h-125 md:min-h-0">
        <div
          ref={carouselRef}
          className="relative h-full min-h-125 md:min-h-0 rounded-lg overflow-hidden bg-[#f7bd07]"
        >
          {/* Nav bar */}
          <div ref={navRef} className="relative flex border-b border-[#e2ac05]">
            {slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`flex-1 flex items-center gap-4 px-4 py-6 text-sm font-semibold text-left transition-colors cursor-pointer ${
                  i === active ? 'text-black' : 'text-[#a67e00]'
                }`}
              >
                <span className="shrink-0">{slide.num}</span>
                <span className="hidden sm:block">{slide.label}</span>
              </button>
            ))}

            {/* Completed bars */}
            {slides.map((_, i) =>
              i < active ? (
                <div
                  key={`done-${i}`}
                  className="absolute -bottom-px h-px bg-black"
                  style={{ left: `${(i * 100) / 3}%`, width: '33.3334%' }}
                />
              ) : null,
            )}

            {/* Active animated bar */}
            <div
              key={`active-${barKey}`}
              className="progress-bar-animate absolute -bottom-px h-px bg-black"
              style={
                {
                  left: `${(active * 100) / 3}%`,
                  '--slide-duration': `${SLIDE_DURATION}ms`,
                } as CSSProperties
              }
            />
          </div>

          {/* Mockup — positioned and scaled per slide */}
          {carouselW > 0 && (
            <img
              src={mockupSrc}
              alt="App mockup"
              className="absolute max-w-none rounded-lg pointer-events-none"
              style={getMockupStyle()}
            />
          )}
        </div>
      </div>
    </div>
  )
}
