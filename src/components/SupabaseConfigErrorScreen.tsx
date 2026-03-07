import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SupabaseConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Configuração do Supabase pendente</CardTitle>
          <CardDescription>
            O app não conseguiu iniciar o cliente do Supabase porque faltam variáveis de ambiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Erro:</p>
          <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto">{message}</pre>
          <p className="text-sm text-muted-foreground">
            Crie um arquivo <code>.env</code> na raiz do projeto com:
          </p>
          <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto">{`VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co\nVITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON`}</pre>
          <p className="text-sm text-muted-foreground">
            Depois reinicie o servidor do Vite (<code>npm run dev</code>).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
