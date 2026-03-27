const EXT_QUEUE_KEY = "wishpoolQueue"
const APP_QUEUE_KEY = "wishpool:extQueue"
const EXT_CATEGORIES_KEY = "wishpoolCategories"
const APP_STATE_KEY_BASE = "wishpool:v1"
const EXT_SESSION_KEY = "wishpoolExtSession"
const SUPABASE_AUTH_STORAGE_KEY = "sb-okpxxpjskegpohowqqry-auth-token"
const APP_QUEUE_SYNC_EVENT = "wishpool:extQueueUpdated"

let activeUserId = null
let lastSyncedCategories = ""
let lastSessionToken = ""
let syncInFlight = false

function readSupabaseSessionFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const accessToken = parsed?.access_token
    const refreshToken = parsed?.refresh_token ?? null
    const email = parsed?.user?.email
    const userId = parsed?.user?.id
    if (!accessToken || !email) return null
    return { email, accessToken, refreshToken, userId, provider: "supabase_web_session", loggedAt: new Date().toISOString() }
  } catch {
    return null
  }
}

function getAppStateKey(userId) {
  if (!userId) return null
  return `${APP_STATE_KEY_BASE}:${userId}`
}

function readAppState(userId) {
  const key = getAppStateKey(userId)
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readAppQueue() {
  try {
    const raw = window.localStorage.getItem(APP_QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAppQueue(queue) {
  window.localStorage.setItem(APP_QUEUE_KEY, JSON.stringify(queue))
}

async function syncToAppQueue() {
  const result = await chrome.storage.local.get([EXT_QUEUE_KEY])
  const extQueue = Array.isArray(result[EXT_QUEUE_KEY]) ? result[EXT_QUEUE_KEY] : []
  if (extQueue.length === 0) return false

  const appQueue = readAppQueue()
  const seen = new Set(appQueue.map((item) => item.queueId).filter(Boolean))
  const merged = [...appQueue]
  let changed = false

  extQueue.forEach((item) => {
    const queueId = item?.queueId
    if (queueId && seen.has(queueId)) return
    if (queueId) seen.add(queueId)
    merged.push(item)
    changed = true
  })

  if (!changed) {
    await chrome.storage.local.set({ [EXT_QUEUE_KEY]: [] })
    return false
  }

  writeAppQueue(merged)
  await chrome.storage.local.set({ [EXT_QUEUE_KEY]: [] })
  return true
}

async function syncFromAppState(userId) {
  const appState = readAppState(userId)
  if (!appState) {
    if (lastSyncedCategories !== "") {
      await chrome.storage.local.set({ [EXT_CATEGORIES_KEY]: [] })
      lastSyncedCategories = ""
    }
    return
  }

  const categories = Array.isArray(appState?.categories) ? appState.categories.filter(Boolean) : []
  const categoriesKey = categories.join("||")

  if (lastSyncedCategories === categoriesKey) {
    return
  }

  const updates = {
    [EXT_CATEGORIES_KEY]: categories,
  }

  await chrome.storage.local.set(updates)
  lastSyncedCategories = categoriesKey
}

async function syncExtensionSessionFromSupabaseStorage() {
  const session = readSupabaseSessionFromLocalStorage()
  if (!session) return null

  const { userId, ...sessionData } = session
  if (session.accessToken !== lastSessionToken) {
    await chrome.storage.local.set({
      [EXT_SESSION_KEY]: sessionData,
      [EXT_CATEGORIES_KEY]: [],
    })
    lastSessionToken = session.accessToken
    lastSyncedCategories = ""
  }

  return userId
}

function notifyQueueSync() {
  window.dispatchEvent(new CustomEvent(APP_QUEUE_SYNC_EVENT))
}

async function syncQueueAndNotify() {
  const changed = await syncToAppQueue()
  if (changed) notifyQueueSync()
}

async function syncAppToExtensionState() {
  if (syncInFlight) return
  syncInFlight = true
  try {
    const userIdFromSession = await syncExtensionSessionFromSupabaseStorage()
    if (userIdFromSession) {
      activeUserId = userIdFromSession
    }

    if (activeUserId) {
      await syncFromAppState(activeUserId)
    }
  } finally {
    syncInFlight = false
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return
  if (!changes[EXT_QUEUE_KEY]) return
  void syncQueueAndNotify()
})

Promise.all([
  syncQueueAndNotify(),
  syncAppToExtensionState(),
]).catch(() => {})

setInterval(() => {
  void syncAppToExtensionState()
}, 1500)
