import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const SUPABASE_HOST_PERMISSION = 'https://okpxxpjskegpohowqqry.supabase.co/*'
const EXTENSION_DIR = 'extension'
const RELEASE_DIR = 'extension-release'
const BUILD_SCRIPT = 'scripts/build-extension.mjs'

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`))
    })
  })
}

async function copyIfExists(from, to) {
  try {
    await fs.access(from)
    await fs.cp(from, to, { recursive: true })
  } catch {
    // optional asset
  }
}

async function main() {
  const rawOrigin = process.env.WISHPOOL_APP_ORIGIN
  if (!rawOrigin) {
    throw new Error(
      'Defina WISHPOOL_APP_ORIGIN (ex: https://app.seudominio.com) antes de empacotar.',
    )
  }

  const appOrigin = new URL(rawOrigin).origin

  await run('node', [BUILD_SCRIPT], {
    env: { ...process.env, WISHPOOL_APP_ORIGIN: appOrigin },
  })

  const manifestPath = path.join(EXTENSION_DIR, 'manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

  manifest.host_permissions = [`${appOrigin}/*`, SUPABASE_HOST_PERMISSION]
  manifest.content_scripts = [
    {
      matches: [`${appOrigin}/*`],
      js: ['sync-app.js'],
      run_at: 'document_idle',
    },
  ]

  if (process.env.EXTENSION_VERSION) {
    manifest.version = process.env.EXTENSION_VERSION
  }

  await fs.rm(RELEASE_DIR, { recursive: true, force: true })
  await fs.mkdir(RELEASE_DIR, { recursive: true })

  const filesToCopy = ['popup.html', 'popup.js', 'popup.css', 'sync-app.js']
  await Promise.all(
    filesToCopy.map((file) =>
      fs.copyFile(path.join(EXTENSION_DIR, file), path.join(RELEASE_DIR, file)),
    ),
  )

  await copyIfExists(path.join(EXTENSION_DIR, 'icons'), path.join(RELEASE_DIR, 'icons'))
  await fs.writeFile(
    path.join(RELEASE_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )

  const zipName = `wishpool-extension-v${manifest.version}.zip`
  const zipPath = path.resolve(RELEASE_DIR, zipName)
  await fs.rm(zipPath, { force: true })

  await run('zip', ['-r', zipPath, '.'], { cwd: RELEASE_DIR })

  console.log(`\nPacote pronto: ${zipPath}`)
  console.log(`Manifest de produção usando origin: ${appOrigin}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
