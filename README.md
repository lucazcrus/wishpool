# Wishpool

Aplicação web para organizar links de compras, agora com autenticação de usuários via Supabase.

## Stack atual

- Vite + React + TypeScript
- Tailwind CSS (v4)
- Supabase Auth (`@supabase/supabase-js`)
- Persistência local por usuário autenticado (`localStorage` escopado por `user_id`)

## Rodar localmente

```bash
npm install
cp .env.example .env
# preencha as variáveis do Supabase no .env
npm run dev
```

## Variáveis de ambiente

Arquivo `.env`:

```bash
VITE_APP_URL=https://bagapp.io
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
```

## Setup no Supabase

1. Crie um projeto no Supabase.
2. Em **Project Settings > API**, copie:
   - `Project URL` -> `VITE_SUPABASE_URL`
   - `anon public key` -> `VITE_SUPABASE_ANON_KEY`
3. Defina `VITE_APP_URL` com a URL canônica da app web em produção.
4. Em **SQL Editor**, execute o arquivo [`supabase/schema.sql`](./supabase/schema.sql).
5. Em **Authentication > Providers**, habilite os provedores sociais desejados (ex.: Google e GitHub).
6. Em **Authentication > URL Configuration**, adicione as URLs de redirecionamento:
   - `http://localhost:5173`
   - `http://localhost:5173/profile.html`
   - `https://bagapp.io`
   - `https://bagapp.io/profile.html`
7. Em **Authentication > SMTP Settings**, configure a Resend:
   - `Host`: `smtp.resend.com`
   - `Port`: `465`
   - `Username`: `resend`
   - `Password`: `re_...` da sua conta Resend
   - `Sender email`: um remetente do seu domínio validado, por exemplo `noreply@bagapp.io`
8. Em **Authentication > Templates**, personalize o template de confirmação de cadastro apontando para a URL final da app.

## O que já está implementado

- Login com email/senha
- Cadastro com email/senha
- Login social (Google/GitHub)
- Logout
- Criação automática de `profiles` e `user_preferences` no primeiro login
- RLS por usuário para todas as tabelas de domínio (`profiles`, `user_preferences`, `categories`, `links`)

## Estrutura de tabelas

Veja o SQL completo em [`supabase/schema.sql`](./supabase/schema.sql).

Tabelas criadas:

- `profiles`
- `user_preferences`
- `categories`
- `links`

## Observações

- A aplicação mantém o comportamento atual de links/categorias, com dados locais separados por usuário autenticado.
- O schema já está pronto para a próxima etapa: sincronizar `items` e `categories` diretamente no Supabase.

## Deploy em produção

Com a Vercel CLI instalada, o fluxo recomendado é:

```bash
vercel
vercel --prod
```

Configure no projeto da Vercel as variáveis:

- `VITE_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois, conecte o domínio no painel da Vercel e use o mesmo domínio em:

- `VITE_APP_URL`
- Supabase `Authentication > URL Configuration`
- empacotamento da extensão com `WISHPOOL_APP_ORIGIN`
