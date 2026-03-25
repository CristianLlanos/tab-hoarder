import { BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { updateTab } from './database'
import { getThumbnailDir } from './storage'

const MAX_CONCURRENT = 3
let activeCaptures = 0
const queue: Array<{ tabId: number; url: string; resolve: (path: string) => void; reject: (err: Error) => void }> = []

export function getThumbnailBasePath(): string {
  return getThumbnailDir()
}

async function processQueue(): Promise<void> {
  while (queue.length > 0 && activeCaptures < MAX_CONCURRENT) {
    const item = queue.shift()
    if (!item) break
    activeCaptures++

    captureOne(item.tabId, item.url)
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        activeCaptures--
        processQueue()
      })
  }
}

async function captureOne(tabId: number, url: string): Promise<string> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  try {
    await win.loadURL(url)
    // Wait for page to render
    await new Promise(resolve => setTimeout(resolve, 3000))

    const image = await win.webContents.capturePage()
    const resized = image.resize({ width: 640, quality: 'good' })
    const buffer = resized.toJPEG(80)

    const fileName = `${tabId}.jpg`
    const filePath = join(getThumbnailDir(), fileName)
    writeFileSync(filePath, buffer)

    // Update database
    updateTab(tabId, { thumbnail_path: fileName })

    return fileName
  } catch (error) {
    console.error(`Thumbnail capture failed for tab ${tabId} (${url}):`, error)
    throw error
  } finally {
    win.destroy()
  }
}

export function captureThumbnail(tabId: number, url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ tabId, url, resolve, reject })
    processQueue()
  })
}

export async function captureAllThumbnails(
  tabs: Array<{ id: number; url: string }>,
  onProgress?: (tabId: number, completed: number, total: number) => void
): Promise<void> {
  let completed = 0
  const total = tabs.length

  const promises = tabs.map(tab =>
    captureThumbnail(tab.id, tab.url)
      .then(() => {
        completed++
        onProgress?.(tab.id, completed, total)
      })
      .catch(() => {
        completed++
        onProgress?.(tab.id, completed, total)
      })
  )

  await Promise.all(promises)
}
