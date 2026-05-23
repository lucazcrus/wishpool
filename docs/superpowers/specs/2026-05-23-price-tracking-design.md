# Price Tracking — Design

**Data:** 2026-05-23
**Status:** Aprovado para implementação
**Custo financeiro adicional:** R$ 0 (tudo no free tier Supabase + extensão)

## Objetivo

Permitir que o usuário acompanhe o preço dos itens que ele salvou no Bag. Quando o preço cair, o card do item exibe um badge com a queda; ao abrir o modal do item, o usuário vê um mini-gráfico com o histórico de preços.

## Não-objetivos (out of scope nesta entrega)

- Notificações por email ou push web
- Preço-alvo definido pelo usuário
- Alerta de subida de preço
- Conversão entre moedas

## Arquitetura

A feature se divide em três camadas independentes que se comunicam via Postgres como ponto de verdade.

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Extensão       │         │  pg_cron diário  │         │  App (front)    │
│  (on-visit)     │         │  Edge Function   │         │  React          │
└────────┬────────┘         └────────┬─────────┘         └────────┬────────┘
         │ INSERT                     │ INSERT                    │ SELECT
         │ link_price_history         │ link_price_history        │ links / history / alerts
         ▼                            ▼                           │
   ┌─────────────────────────────────────────────────────┐        │
   │              Postgres (Supabase)                    │◄───────┘
   │  - trigger: cria price_alert quando preço cai       │
   │  - trigger: atualiza links.price (cache)            │
   └─────────────────────────────────────────────────────┘
```

### Camada 1 — Coleta

#### 1a. Extensão (caminho quente, alta confiança)

A extensão atual já roda content scripts. Vamos adicionar um script que executa em qualquer URL (`<all_urls>`) e:

1. Mantém em `chrome.storage.local` um índice de URLs salvas pelo usuário (`{ url -> { itemId, currency, lastPrice } }`), sincronizado do Supabase a cada vez que o popup é aberto ou periodicamente (`chrome.alarms` 1x/h).
2. Em `document_idle`, verifica se a URL atual bate com alguma URL do índice. Se não, encerra silenciosamente (zero custo de execução nas demais páginas).
3. Se bate, roda o **extractor** (ver abaixo) na ordem JSON-LD → og:price → product:price:amount.
4. Se conseguiu extrair preço **e** o preço é diferente do `lastPrice` em cache **e** a moeda detectada é igual à `currency` salva, dispara uma RPC `record_price_snapshot(link_id, price, source='extension')`.
5. Atualiza o `lastPrice` no cache local.

**Por que index em `chrome.storage`:** evita 1 round-trip ao Supabase em cada navegação do usuário. O custo da extensão fica O(1) por página visitada.

#### 1b. Cron + Edge Function (caminho de cobertura)

- **pg_cron**: cria um job que roda `select cron.schedule('refresh-stale-prices', '0 4 * * *', $$ ... $$)` 1x/dia às 4h UTC.
- O job chama via `pg_net` uma **Supabase Edge Function** `refresh-stale-prices`.
- A função:
  1. Faz `select id, url, currency from links where updated_at < now() - interval '7 days' or last_check_at is null limit 50`.
  2. Para cada item: `fetch(url, { timeout: 5s, headers: { 'User-Agent': '<realista>' } })`, roda o mesmo extractor.
  3. Se sucesso e preço mudou e moeda confere: chama `record_price_snapshot(link_id, price, source='cron')`.
  4. Em qualquer resultado (sucesso ou falha): atualiza `links.last_check_at = now()` e `links.last_check_status` (`ok`, `parse_fail`, `fetch_fail`).
- Batch size 50 mantém a execução abaixo de 30s (timeout default do Edge Function free tier). Não precisa paginar — itens que sobrarem voltam no dia seguinte.

#### Extractor (compartilhado entre extensão e Edge Function)

Função pura `extractPrice(html | document) -> { amount, currency } | null`. Tenta em ordem:

1. **JSON-LD `schema.org/Product`**: `<script type="application/ld+json">` com `@type: Product` → `offers.price` + `offers.priceCurrency`. Cobre Magalu, Amazon BR (às vezes), Mercado Livre, Shopify stores, Nuvemshop, etc.
2. **Open Graph**: `meta[property="og:price:amount"]` + `meta[property="og:price:currency"]`.
3. **Product meta**: `meta[property="product:price:amount"]` + `meta[property="product:price:currency"]`.
4. **Microdata**: `[itemtype="https://schema.org/Product"]` com `[itemprop="price"]`.

Sem seletores por domínio na v1 — adicionamos só se a cobertura real ficar baixa.

### Camada 2 — Armazenamento

Schema já existe em `supabase/schema.sql`. Vamos **estender** o que precisar:

```sql
-- links: persistir moeda + telemetria do cron
alter table public.links
  add column if not exists currency text not null default 'BRL',
  add column if not exists last_check_at timestamptz,
  add column if not exists last_check_status text;

-- link_price_history: adicionar currency (preço só faz sentido com moeda)
alter table public.link_price_history
  add column if not exists currency text not null default 'BRL';
```

> Nota: hoje o tipo `Item.currency` existe no front mas a coluna não existe em `links`. Esta migration normaliza isso — backfill aplica `'BRL'` para registros antigos, que é o default da app.

#### RPC `record_price_snapshot`

```sql
create or replace function public.record_price_snapshot(
  p_link_id uuid,
  p_price numeric,
  p_currency text,
  p_source text default 'manual'
) returns void
language plpgsql
security invoker
as $$
declare
  v_last_price numeric;
  v_user_id uuid;
  v_link_currency text;
begin
  select price, user_id, currency into v_last_price, v_user_id, v_link_currency
  from public.links
  where id = p_link_id and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'link not found or not owned';
  end if;

  -- ignora silenciosamente se a moeda detectada não bate com a salva
  if v_link_currency is distinct from p_currency then
    return;
  end if;

  -- dedup: só insere se o preço mudou
  if v_last_price is distinct from p_price then
    insert into public.link_price_history (link_id, user_id, price, currency, source)
    values (p_link_id, v_user_id, p_price, p_currency, p_source);
  end if;
end;
$$;
```

#### Trigger de alerta + cache

```sql
create or replace function public.handle_price_snapshot()
returns trigger
language plpgsql
as $$
declare
  v_previous numeric;
begin
  -- pega o snapshot anterior na mesma moeda
  select price into v_previous
  from public.link_price_history
  where link_id = new.link_id
    and currency = new.currency
    and id <> new.id
  order by captured_at desc
  limit 1;

  if v_previous is not null and new.price < v_previous then
    insert into public.price_alerts
      (link_id, user_id, previous_price, current_price, drop_amount)
    values
      (new.link_id, new.user_id, v_previous, new.price, v_previous - new.price);
  end if;

  -- atualiza cache de preço atual no link
  update public.links
  set price = new.price
  where id = new.link_id;

  return new;
end;
$$;

drop trigger if exists on_link_price_snapshot on public.link_price_history;
create trigger on_link_price_snapshot
after insert on public.link_price_history
for each row execute function public.handle_price_snapshot();
```

### Camada 3 — Apresentação

#### `CardLink`

- Hook `usePriceAlert(itemId)` retorna `{ dropAmount, dropPct } | null`. Faz `select * from price_alerts where link_id = ? and read_at is null order by created_at desc limit 1`.
- Se houver alerta, renderiza badge embaixo do preço: `↓ R$ 20,00 (-12%)` em verde.
- A query é leve (RLS + index `idx_price_alerts_link_id`).

#### `ItemModal`

- Ao abrir, lazy fetch `select price, captured_at from link_price_history where link_id = ? order by captured_at asc`.
- Renderiza **sparkline SVG** (path + dots) — sem lib, ~80 linhas. Tooltip em hover mostra valor + data.
- Se há menos de 2 pontos, esconde o gráfico e mostra "Ainda não temos histórico de preço".
- Quando o modal fecha: `update price_alerts set read_at = now() where link_id = ? and read_at is null`.

#### Sincronização extensão ↔ app

- Quando o popup da extensão abre **ou** quando `chrome.alarms` dispara: extensão chama Supabase `select id, url, currency, price from links where user_id = auth.uid()` e atualiza `chrome.storage.local`.
- Como a extensão já tem auth (`SESSION_KEY`), não precisamos de nada novo.

## Multi-currency

- Cada snapshot de preço grava sua moeda própria.
- Trigger de alerta **só compara snapshots da mesma moeda**.
- Se a página passa a vender em moeda diferente da que o item foi salvo, o snapshot é ignorado (não cria histórico).

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Fetch falha (timeout, 5xx) | `last_check_status = 'fetch_fail'`. Sem histórico. Item volta pro pool no dia seguinte. |
| Página renderizada sem preço extraível | `last_check_status = 'parse_fail'`. Sem histórico. Item volta pro pool. |
| Anti-bot (403/429) | Mesmo tratamento de `fetch_fail`. Extensão fica como única via. |
| Extensão sem permissão na URL | Conteúdo do script simplesmente não roda. Sem erro pro usuário. |
| RPC falha (preço inválido) | Extensão e função logam internamente; sem feedback visual ao usuário (silencioso). |

## Performance e custo

- **DB writes**: ~1 insert/item/dia no pior caso (cron) + N inserts (extensão), todos com dedup. Para 10k itens ativos: 10k linhas/dia = ~300k linhas/mês. Dentro do free tier 500MB com folga (cada linha ~100 bytes = 30MB/mês).
- **Edge Function**: 1 invocação/dia consumindo 50 itens → 30 invocações/mês. Free tier dá 500k.
- **pg_cron**: nativo, sem custo.
- **Extensão**: zero custo de servidor; o trabalho é no browser do usuário.
- **Fronteira do free tier**: o gargalo real seria CDN egress do Supabase em leituras pesadas do histórico. Como o gráfico é lazy load, fica controlado.

## Cobertura realista

| Tipo de loja | Cron pega? | Extensão pega? |
|---|---|---|
| Shopify / Nuvemshop / Magento (JSON-LD limpo) | ✅ | ✅ |
| Mercado Livre, Magalu, Americanas | Maioria ✅ | ✅ |
| Amazon BR | ❌ (anti-bot) | ✅ |
| Nike, Adidas (SPA pesado) | ❌ | ✅ |
| Sites com checkout protegido por login | ❌ | ✅ se logado |

## Plano de entrega

1. **Migration SQL**: novos campos + RPC + trigger
2. **Edge Function** `refresh-stale-prices` + extractor compartilhado
3. **pg_cron job**
4. **Extensão**: índice em storage, content script de captura, sincronização
5. **App**: hook de alerta, badge no `CardLink`, sparkline no `ItemModal`
6. **QA manual**: 5 lojas diferentes (Shopify, ML, Magalu, Amazon, loja gringa) — verificar captura por extensão e cron

Cada etapa entrega valor independente; a feature começa a "funcionar visualmente" só na etapa 5, mas as anteriores são testáveis isoladamente via SQL e logs.
