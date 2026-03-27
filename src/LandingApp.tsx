import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import logoSrc from './assets/images/Logo-Landing.svg'
import slideOneSrc from './assets/images/img-slide-1.png'
import slideTwoSrc from './assets/images/img-slide-2.png'
import slideThreeSrc from './assets/images/img-slide-2-1.png'
import googleIconSrc from './assets/images/icon-google.png'
import { SupabaseConfigErrorScreen } from './components/SupabaseConfigErrorScreen'
import { useAuth } from './lib/auth'

const SLIDE_DURATION = 4500

const slides = [
  {
    num: '01',
    label: 'Acompanhe o valor total dos produtos',
    imageSrc: slideOneSrc,
    imageClassName: 'object-cover object-top',
  },
  {
    num: '02',
    label: 'Organize seus links em abas editáveis',
    imageSrc: slideTwoSrc,
    imageClassName: 'object-cover object-top',
  },
  {
    num: '03',
    label: 'Edite ou delete cada link como quiser',
    imageSrc: slideThreeSrc,
    imageClassName: 'object-cover object-top',
  },
]

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

  const goTo = (index: number) => {
    setActive(index)
    setBarKey((current) => current + 1)
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => goTo((active + 1) % slides.length), SLIDE_DURATION)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
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

  if (configError) {
    return <SupabaseConfigErrorScreen message={configError} />
  }

  return (
    <div
      className="min-h-screen bg-[#f9f9f9] flex flex-col md:flex-row"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <aside className="w-full md:w-89 md:shrink-0 flex flex-col justify-between gap-10 p-4 md:py-4 md:pl-4 md:pr-3 md:min-h-screen">
        <img src={logoSrc} alt="Bag" className="w-9 h-8 shrink-0" />

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
                  className="bg-[#FC4E23] disabled:opacity-70 text-white text-sm font-medium h-10 rounded-md w-full hover:bg-[#e6461f] transition-colors cursor-pointer"
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

            <div className="px-4">
              <a
                href="./privacy.html"
                className="inline-flex text-sm font-medium text-[#666] underline-offset-4 transition-colors hover:text-black hover:underline"
              >
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 p-4 md:pl-0 min-h-125 md:min-h-0">
        <div className="relative h-full min-h-125 md:min-h-0 rounded-lg overflow-hidden bg-[#FBE7A2]">
          <div className="relative z-10 flex border-b border-[#ead58f] bg-[#FBE7A2]">
            {slides.map((slide, i) => (
              <button
                key={slide.num}
                onClick={() => goTo(i)}
                className={`flex-1 flex items-center gap-4 px-4 py-6 text-sm font-semibold text-left transition-colors cursor-pointer ${
                  i === active ? 'text-black' : 'text-[#A68B2E]'
                }`}
              >
                <span className="shrink-0">{slide.num}</span>
                <span className="hidden sm:block">{slide.label}</span>
              </button>
            ))}

            {slides.map((_, i) =>
              i < active ? (
                <div
                  key={`done-${i}`}
                  className="absolute -bottom-px h-px bg-black"
                  style={{
                    left: `${(i * 100) / slides.length}%`,
                    width: `${100 / slides.length}%`,
                  }}
                />
              ) : null,
            )}

            <div
              key={`active-${barKey}`}
              className="progress-bar-animate absolute -bottom-px h-px bg-black"
              style={
                {
                  left: `${(active * 100) / slides.length}%`,
                  width: `${100 / slides.length}%`,
                  '--slide-duration': `${SLIDE_DURATION}ms`,
                } as CSSProperties
              }
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 top-[73px] overflow-hidden bg-[#FBE7A2]">
            {slides.map((slide, index) => (
              <img
                key={slide.num}
                src={slide.imageSrc}
                alt={`Preview do slide ${slide.num}`}
                className={`absolute inset-0 h-full w-full ${slide.imageClassName} transition-opacity duration-700 ease-out ${
                  index === active ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
