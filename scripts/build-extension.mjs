import fs from 'node:fs/promises'
import path from 'node:path'
import { build as esbuild } from 'esbuild'
import { compile as compileTailwind } from '@tailwindcss/node'

const EXTENSION_POPUP_HTML = 'extension/popup.html'
const EXTENSION_POPUP_SOURCE = 'extension/popup.jsx'
const EXTENSION_POPUP_SCRIPT = 'extension/popup.js'
const EXTENSION_POPUP_CSS = 'extension/popup.css'
const EXTENSION_TAILWIND_ENTRY = `
@import "tailwindcss";
@import "shadcn/tailwind.css";

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

:root {
  --radius: 0.75rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: #FC4E23;
  --primary-foreground: #ffffff;
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
`

async function buildPopupScript() {
  const appOrigin = process.env.WISHPOOL_APP_ORIGIN || ''

  await esbuild({
    entryPoints: [EXTENSION_POPUP_SOURCE],
    outfile: EXTENSION_POPUP_SCRIPT,
    bundle: true,
    format: 'esm',
    target: ['chrome109'],
    jsx: 'automatic',
    minify: false,
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
    loader: {
      '.svg': 'dataurl',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      __WISHPOOL_APP_ORIGIN__: JSON.stringify(appOrigin),
    },
  })
}

function addClassNamesFrom(content, pattern, classNames) {
  for (const match of content.matchAll(pattern)) {
    const raw = match[1]
    if (!raw) continue

    raw
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        if (!token.includes('${')) {
          classNames.add(token)
        }
      })
  }
}

function addClassLikeTokens(content, classNames) {
  for (const match of content.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g)) {
    const raw = match[2]
    if (!raw) continue

    raw.split(/\s+/).forEach((token) => {
      if (!token) return
      if (token.includes('${')) return
      if (token.length > 120) return
      if (/^[A-Za-z0-9!:[\]().,%/_\-'"*=+@?&|<>~]+$/.test(token)) {
        classNames.add(token)
      }
    })
  }
}

const FLAG_COUNTRY_CODES = [
  'br',
  'us',
  'eu',
  'gb',
  'ar',
  'mx',
  'cl',
  'co',
  'pe',
  'uy',
  'ca',
  'au',
  'jp',
  'cn',
  'kr',
  'in',
  'ch',
  'se',
  'no',
  'dk',
  'za',
  'ru',
]

async function buildFlagIconsCss() {
  const base = `.fi {
  background-size: contain;
  background-position: 50%;
  background-repeat: no-repeat;
  position: relative;
  display: inline-block;
  width: 1.333333em;
  line-height: 1em;
}
.fi::before { content: " "; }
`
  const rules = await Promise.all(
    FLAG_COUNTRY_CODES.map(async (code) => {
      const svgPath = path.resolve(process.cwd(), `node_modules/flag-icons/flags/4x3/${code}.svg`)
      try {
        const svg = await fs.readFile(svgPath)
        const b64 = svg.toString('base64')
        return `.fi-${code} { background-image: url("data:image/svg+xml;base64,${b64}"); }`
      } catch {
        return ''
      }
    }),
  )
  return base + rules.filter(Boolean).join('\n')
}

async function buildPopupCss() {
  const [html, popupSource, popupBundle] = await Promise.all([
    fs.readFile(EXTENSION_POPUP_HTML, 'utf8'),
    fs.readFile(EXTENSION_POPUP_SOURCE, 'utf8'),
    fs.readFile(EXTENSION_POPUP_SCRIPT, 'utf8'),
  ])

  const classNames = new Set()

  addClassNamesFrom(html, /class\s*=\s*"([^"]+)"/g, classNames)
  addClassNamesFrom(html, /class\s*=\s*'([^']+)'/g, classNames)
  addClassNamesFrom(popupSource, /className\s*=\s*"([^"]+)"/g, classNames)
  addClassNamesFrom(popupSource, /className\s*=\s*'([^']+)'/g, classNames)
  addClassNamesFrom(popupSource, /className\s*=\s*\{`([^`]+)`\}/g, classNames)
  addClassLikeTokens(popupSource, classNames)
  addClassLikeTokens(popupBundle, classNames)

  for (const runtimeClass of [
    'min-h-4',
    'text-xs',
    'text-emerald-700',
    'text-slate-600',
    'text-red-700',
    'hidden',
    'size-4',
    'size-8',
    'size-9',
    'w-44',
  ]) {
    classNames.add(runtimeClass)
  }

  const compiler = await compileTailwind(EXTENSION_TAILWIND_ENTRY, {
    base: process.cwd(),
    onDependency() {},
  })

  const [tailwindCss, flagCss] = await Promise.all([
    Promise.resolve(compiler.build([...classNames])),
    buildFlagIconsCss(),
  ])

  await fs.writeFile(EXTENSION_POPUP_CSS, tailwindCss + '\n' + flagCss)
}

async function main() {
  await buildPopupScript()
  await buildPopupCss()
  console.log('Extension popup built: popup.js + popup.css')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
