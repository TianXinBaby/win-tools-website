import { readonly, ref } from 'vue'

export const FAVORITES_KEY = 'win-tools:favorites'
export const RECENT_KEY = 'win-tools:recent'
const MAX_RECENT = 10
const validSlug = (slug) => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)

const favorites = ref([])
const recent = ref([])
let initialized = false

function readSlugs(key, limit = Infinity) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(stored) ? [...new Set(stored.filter(validSlug))].slice(0, limit) : []
  } catch {
    return []
  }
}

export function refreshToolPreferences() {
  favorites.value = readSlugs(FAVORITES_KEY)
  recent.value = readSlugs(RECENT_KEY, MAX_RECENT)
}

function initialize() {
  if (initialized) return
  refreshToolPreferences()
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === FAVORITES_KEY || event.key === RECENT_KEY)
      refreshToolPreferences()
  })
  initialized = true
}

function save(key, slugs) {
  try {
    localStorage.setItem(key, JSON.stringify(slugs))
  } catch {
    // Keep the current tab usable if persistent storage is unavailable.
  }
}

export function toggleFavorite(slug) {
  initialize()
  if (!validSlug(slug)) return
  favorites.value = favorites.value.includes(slug)
    ? favorites.value.filter((value) => value !== slug)
    : [...favorites.value, slug]
  save(FAVORITES_KEY, favorites.value)
}

export function recordRecentTool(slug) {
  initialize()
  if (!validSlug(slug)) return
  recent.value = [slug, ...recent.value.filter((value) => value !== slug)].slice(0, MAX_RECENT)
  save(RECENT_KEY, recent.value)
}

export function useToolPreferences() {
  initialize()
  return { favorites: readonly(favorites), recent: readonly(recent) }
}
