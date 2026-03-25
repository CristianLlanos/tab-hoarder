import { app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync, writeFileSync } from 'fs'

const ICLOUD_BASE = join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
const ICLOUD_APP_DIR = join(ICLOUD_BASE, 'TabHoarder')
const MARKER_FILE = '_icloud_enabled'

let dataDir: string | null = null
let usingICloud = false

export function initStorage(): void {
  const localDir = app.getPath('userData')

  // Check if iCloud Drive is available
  if (existsSync(ICLOUD_BASE)) {
    mkdirSync(ICLOUD_APP_DIR, { recursive: true })
    mkdirSync(join(ICLOUD_APP_DIR, 'thumbnails'), { recursive: true })
    mkdirSync(join(ICLOUD_APP_DIR, 'favicons'), { recursive: true })

    // Migrate from local to iCloud if needed
    const iCloudHasDb = existsSync(join(ICLOUD_APP_DIR, 'tab-hoarder.db'))
    const localHasDb = existsSync(join(localDir, 'tab-hoarder.db'))

    if (!iCloudHasDb && localHasDb) {
      console.log('[storage] Migrating data from local to iCloud...')
      migrateToICloud(localDir, ICLOUD_APP_DIR)
      console.log('[storage] Migration complete')
    }

    // Write marker
    writeFileSync(join(ICLOUD_APP_DIR, MARKER_FILE), new Date().toISOString())

    dataDir = ICLOUD_APP_DIR
    usingICloud = true
    console.log(`[storage] Using iCloud: ${dataDir}`)
  } else {
    // Fallback to local
    mkdirSync(localDir, { recursive: true })
    mkdirSync(join(localDir, 'thumbnails'), { recursive: true })
    mkdirSync(join(localDir, 'favicons'), { recursive: true })

    dataDir = localDir
    usingICloud = false
    console.log(`[storage] Using local: ${dataDir}`)
  }
}

function migrateToICloud(fromDir: string, toDir: string): void {
  // Copy database files
  const dbFiles = ['tab-hoarder.db', 'tab-hoarder.db-wal', 'tab-hoarder.db-shm']
  for (const file of dbFiles) {
    const src = join(fromDir, file)
    if (existsSync(src)) {
      copyFileSync(src, join(toDir, file))
      console.log(`[storage] Copied ${file}`)
    }
  }

  // Copy thumbnails
  copyDirContents(join(fromDir, 'thumbnails'), join(toDir, 'thumbnails'))

  // Copy favicons
  copyDirContents(join(fromDir, 'favicons'), join(toDir, 'favicons'))
}

function copyDirContents(fromDir: string, toDir: string): void {
  if (!existsSync(fromDir)) return
  mkdirSync(toDir, { recursive: true })

  const files = readdirSync(fromDir)
  let count = 0
  for (const file of files) {
    const srcPath = join(fromDir, file)
    const destPath = join(toDir, file)
    if (statSync(srcPath).isFile() && !existsSync(destPath)) {
      copyFileSync(srcPath, destPath)
      count++
    }
  }
  if (count > 0) {
    console.log(`[storage] Copied ${count} files from ${fromDir}`)
  }
}

export function getDataDir(): string {
  if (!dataDir) throw new Error('Storage not initialized. Call initStorage() first.')
  return dataDir
}

export function getDbPath(): string {
  return join(getDataDir(), 'tab-hoarder.db')
}

export function getThumbnailDir(): string {
  const dir = join(getDataDir(), 'thumbnails')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getFaviconDir(): string {
  const dir = join(getDataDir(), 'favicons')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function isUsingICloud(): boolean {
  return usingICloud
}
