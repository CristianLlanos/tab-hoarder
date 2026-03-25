import type { Tab, Collection, CreateTabInput, CreateCollectionInput, ChromeTab, ChromeProfile, ThumbnailProgress } from '../../shared/types'

const api = window.electronAPI

// ─── Tabs ────────────────────────────────────────────────

export function getTabs(filter?: { collectionId?: number; search?: string }): Promise<Tab[]> {
  return api.tabs.getAll(filter)
}

export function createTab(input: CreateTabInput): Promise<Tab> {
  return api.tabs.create(input)
}

export function createManyTabs(tabs: CreateTabInput[], collectionId?: number | null): Promise<Tab[]> {
  return api.tabs.createMany(tabs, collectionId)
}

export function updateTab(id: number, fields: Partial<Tab>): Promise<Tab> {
  return api.tabs.update(id, fields)
}

export function deleteTab(id: number): Promise<void> {
  return api.tabs.delete(id)
}

export function searchTabs(query: string): Promise<Tab[]> {
  return api.tabs.search(query)
}

export function openInChrome(url: string, profileDir?: string | null): Promise<void> {
  return api.tabs.openInChrome(url, profileDir)
}

export function captureThumbnail(tabId: number): Promise<{ thumbnailPath: string }> {
  return api.tabs.captureThumbnail(tabId)
}

export function captureAllThumbnails(tabIds: number[]): Promise<void> {
  return api.tabs.captureAllThumbnails(tabIds)
}

// ─── Collections ─────────────────────────────────────────

export function getCollections(): Promise<Collection[]> {
  return api.collections.getAll()
}

export function createCollection(input: CreateCollectionInput): Promise<Collection> {
  return api.collections.create(input)
}

export function updateCollection(id: number, fields: Partial<Collection>): Promise<Collection> {
  return api.collections.update(id, fields)
}

export function deleteCollection(id: number): Promise<void> {
  return api.collections.delete(id)
}

// ─── Chrome ──────────────────────────────────────────────

export function importChromeTabs(): Promise<ChromeTab[]> {
  return api.chrome.importTabs()
}

export function getChromeProfiles(): Promise<ChromeProfile[]> {
  return api.chrome.getProfiles()
}

export function closeChromeTabs(urls: string[]): Promise<number> {
  return api.chrome.closeTabs(urls)
}

// ─── Events ──────────────────────────────────────────────

export function onThumbnailProgress(callback: (progress: ThumbnailProgress) => void): () => void {
  return api.on('thumbnail:progress', callback as (...args: unknown[]) => void)
}

// ─── Helpers ─────────────────────────────────────────────

export function getThumbnailUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath) return null
  return window.electronAPI.getThumbnailPath(thumbnailPath)
}

// ─── Favicon Cache ───────────────────────────────────────

const DEFAULT_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="24" fill="#1a1a2e"/>
    <circle cx="64" cy="64" r="28" fill="none" stroke="#444" stroke-width="4"/>
    <circle cx="64" cy="64" r="8" fill="#444"/>
  </svg>`
)

// In-memory cache: domain → resolved URL (fav:// or default)
const faviconUrlCache = new Map<string, string>()

export function getFaviconUrl(domain: string): string {
  // Return from memory cache instantly
  if (faviconUrlCache.has(domain)) return faviconUrlCache.get(domain)!

  // Kick off async resolution, return default for now
  resolveFavicon(domain)
  return DEFAULT_FAVICON
}

async function resolveFavicon(domain: string): Promise<void> {
  if (faviconUrlCache.has(domain)) return

  // Check if already cached on disk
  const cached = await api.favicon.getCached(domain)
  if (cached) {
    faviconUrlCache.set(domain, window.electronAPI.getFaviconPath(cached))
    return
  }

  // Check if previously failed
  const failed = await api.favicon.isFailed(domain)
  if (failed) {
    faviconUrlCache.set(domain, DEFAULT_FAVICON)
    return
  }

  // Download
  const result = await api.favicon.download(domain)
  if (result) {
    faviconUrlCache.set(domain, window.electronAPI.getFaviconPath(result))
  } else {
    faviconUrlCache.set(domain, DEFAULT_FAVICON)
  }
}

export async function prefetchFavicons(domains: string[]): Promise<void> {
  const uncached = domains.filter(d => !faviconUrlCache.has(d))
  if (uncached.length === 0) return

  const results = await api.favicon.downloadBatch(uncached)
  for (const [domain, filename] of Object.entries(results)) {
    if (filename) {
      faviconUrlCache.set(domain, window.electronAPI.getFaviconPath(filename))
    } else {
      faviconUrlCache.set(domain, DEFAULT_FAVICON)
    }
  }
}
