import { net } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { getFaviconDir } from './storage'

let cacheDir: string
let failedSet: Set<string>
let failedPath: string

function init(): void {
  if (cacheDir) return
  cacheDir = getFaviconDir()
  failedPath = join(cacheDir, '_failed.json')
  try {
    failedSet = new Set(JSON.parse(readFileSync(failedPath, 'utf-8')))
  } catch {
    failedSet = new Set()
  }
}

function saveFailed(): void {
  writeFileSync(failedPath, JSON.stringify([...failedSet]))
}

function domainToFilename(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.png'
}

export function getFaviconCacheDir(): string {
  init()
  return cacheDir
}

export function getCachedFaviconPath(domain: string): string | null {
  init()
  const filePath = join(cacheDir, domainToFilename(domain))
  if (existsSync(filePath)) return domainToFilename(domain)
  return null
}

export function isFaviconFailed(domain: string): boolean {
  init()
  return failedSet.has(domain)
}

export async function downloadFavicon(domain: string): Promise<string | null> {
  init()

  // Already cached
  const existing = getCachedFaviconPath(domain)
  if (existing) return existing

  // Previously failed
  if (failedSet.has(domain)) return null

  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

  try {
    const response = await net.fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())

    // Check if we got a valid image (not a tiny default/error icon)
    if (buffer.length < 100) {
      failedSet.add(domain)
      saveFailed()
      return null
    }

    const filename = domainToFilename(domain)
    writeFileSync(join(cacheDir, filename), buffer)
    return filename
  } catch {
    failedSet.add(domain)
    saveFailed()
    return null
  }
}

export async function downloadFavicons(domains: string[]): Promise<Map<string, string | null>> {
  init()
  const results = new Map<string, string | null>()
  const toDownload = domains.filter(d => !getCachedFaviconPath(d) && !failedSet.has(d))

  // Process in batches of 5
  for (let i = 0; i < toDownload.length; i += 5) {
    const batch = toDownload.slice(i, i + 5)
    const promises = batch.map(async domain => {
      const result = await downloadFavicon(domain)
      results.set(domain, result)
    })
    await Promise.all(promises)
  }

  // Fill in already cached/failed ones
  for (const domain of domains) {
    if (!results.has(domain)) {
      results.set(domain, getCachedFaviconPath(domain))
    }
  }

  return results
}
