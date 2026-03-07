# Publicação da extensão (Chrome Web Store)

## 1) Gerar build de produção

Defina o origin da app web em produção e gere o pacote:

```bash
WISHPOOL_APP_ORIGIN="https://app.seudominio.com" npm run package:extension
```

Isso gera:

- `extension-release/manifest.json` (host/content scripts apontando para o origin informado)
- `extension-release/popup.html`
- `extension-release/popup.js`
- `extension-release/popup.css`
- `extension-release/sync-app.js`
- `extension-release/wishpool-extension-vX.Y.Z.zip`

## 2) OAuth do Google + Supabase

No Supabase Auth, adicione como Redirect URI o callback da extensão:

- `https://<SEU_EXTENSION_ID>.chromiumapp.org/supabase-auth`

## 3) Checklist da Chrome Web Store

- Atualizar `version` no `manifest.json` (ou usar `EXTENSION_VERSION` no empacotamento).
- Subir o `.zip` gerado em `extension-release/`.
- Garantir que política de privacidade e descrição da extensão estejam prontas no painel da Web Store.
- Publicar o item.

