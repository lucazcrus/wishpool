import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { signInWithPassword, signUpWithPassword, signInWithOAuth } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData(event.currentTarget)
      const email = String(formData.get('email') || '').trim()
      const password = String(formData.get('password') || '')
      const fullName = String(formData.get('fullName') || '').trim()

      if (!email || !password) {
        throw new Error('Preencha email e senha.')
      }

      if (mode === 'signup') {
        if (!fullName) {
          throw new Error('Preencha seu nome para criar a conta.')
        }
        await signUpWithPassword(email, password, fullName)
        setMessage('Conta criada. Verifique seu email para confirmar o cadastro, se necessário.')
      } else {
        await signInWithPassword(email, password)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setMessage(null)
    try {
      await signInWithOAuth('google')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha no login com Google.')
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar no Wishpool</CardTitle>
          <CardDescription>
            Entre com email e senha ou continue com Google.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="grid gap-1.5">
                <Label htmlFor="fullName">Nome</Label>
                <Input id="fullName" name="fullName" placeholder="Seu nome" autoComplete="name" />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="voce@exemplo.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Sua senha"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Processando...'
                : mode === 'signin'
                  ? 'Entrar com email'
                  : 'Criar conta'}
            </Button>

            <Button type="button" variant="outline" onClick={() => void handleGoogleLogin()}>
              Continuar com Google
            </Button>
          </form>

          {message && <p className="mt-4 text-sm text-[#444]">{message}</p>}

          <div className="mt-5 text-sm text-[#444]">
            {mode === 'signin' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 underline font-medium"
              onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
            >
              {mode === 'signin' ? 'Criar conta' : 'Entrar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
