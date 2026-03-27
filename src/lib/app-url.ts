const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim()
const DEFAULT_APP_ORIGIN = 'https://bagapp.io'

function getConfiguredUrl() {
  if (!configuredAppUrl) return null

  try {
    return new URL(configuredAppUrl)
  } catch {
    console.warn('Invalid VITE_APP_URL. Falling back to current window origin.')
    return null
  }
}

export function getAppOrigin() {
  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  if (isLocalHost) return window.location.origin

  const configuredOrigin = getConfiguredUrl()?.origin
  return configuredOrigin ?? DEFAULT_APP_ORIGIN
}

export function getPostAuthPath() {
  return window.location.pathname.endsWith('/landing.html') ? '/' : window.location.pathname
}

export function getAppUrl(pathname = getPostAuthPath()) {
  return new URL(pathname, `${getAppOrigin()}/`).toString()
}
