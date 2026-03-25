import { ipcMain, BrowserWindow } from 'electron'
import {
  getAllTabs, createTab, createManyTabs, updateTab, deleteTab, searchTabs,
  getAllCollections, createCollection, updateCollection, deleteCollection
} from './database'
import { getChromeTabs, getChromeProfiles, openInChromeProfile, closeChromeTabs } from './chrome-tabs'
import { captureThumbnail, captureAllThumbnails, getThumbnailBasePath } from './thumbnail-capture'
import { getCachedFaviconPath, downloadFavicon, downloadFavicons, getFaviconCacheDir, isFaviconFailed } from './favicon-cache'
import { isUsingICloud } from './storage'
import type { CreateTabInput, CreateCollectionInput, Tab, Collection } from '../shared/types'

export function registerIpcHandlers(): void {
  // ─── Tabs ──────────────────────────────────────────────
  ipcMain.handle('tabs:get-all', (_event, filter?: { collectionId?: number; search?: string }) => {
    return getAllTabs(filter)
  })

  ipcMain.handle('tabs:create', (_event, input: CreateTabInput) => {
    return createTab(input)
  })

  ipcMain.handle('tabs:create-many', (_event, tabs: CreateTabInput[], collectionId?: number | null) => {
    return createManyTabs(tabs, collectionId)
  })

  ipcMain.handle('tabs:update', (_event, id: number, fields: Partial<Tab>) => {
    return updateTab(id, fields)
  })

  ipcMain.handle('tabs:delete', (_event, id: number) => {
    return deleteTab(id)
  })

  ipcMain.handle('tabs:search', (_event, query: string) => {
    return searchTabs(query)
  })

  ipcMain.handle('tabs:open-in-chrome', async (_event, url: string, profileDir?: string | null) => {
    await openInChromeProfile(url, profileDir)
  })

  ipcMain.handle('tabs:capture-thumbnail', async (_event, tabId: number) => {
    const tabs = getAllTabs()
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) throw new Error(`Tab ${tabId} not found`)
    const thumbnailPath = await captureThumbnail(tabId, tab.url)
    return { thumbnailPath }
  })

  ipcMain.handle('tabs:capture-all-thumbnails', async (event, tabIds: number[]) => {
    const allTabs = getAllTabs()
    const toCapture = allTabs
      .filter(t => tabIds.includes(t.id))
      .map(t => ({ id: t.id, url: t.url }))

    const win = BrowserWindow.fromWebContents(event.sender)
    await captureAllThumbnails(toCapture, (tabId, completed, total) => {
      win?.webContents.send('thumbnail:progress', { tabId, completed, total })
    })
  })

  ipcMain.handle('tabs:get-thumbnail-path', () => {
    return getThumbnailBasePath()
  })

  // ─── Collections ───────────────────────────────────────
  ipcMain.handle('collections:get-all', () => {
    return getAllCollections()
  })

  ipcMain.handle('collections:create', (_event, input: CreateCollectionInput) => {
    return createCollection(input)
  })

  ipcMain.handle('collections:update', (_event, id: number, fields: Partial<Collection>) => {
    return updateCollection(id, fields)
  })

  ipcMain.handle('collections:delete', (_event, id: number) => {
    return deleteCollection(id)
  })

  // ─── Chrome ────────────────────────────────────────────
  ipcMain.handle('chrome:import-tabs', async () => {
    return await getChromeTabs()
  })

  ipcMain.handle('chrome:get-profiles', () => {
    return getChromeProfiles()
  })

  ipcMain.handle('chrome:close-tabs', async (_event, urls: string[]) => {
    return await closeChromeTabs(urls)
  })

  // ─── Favicons ──────────────────────────────────────────
  ipcMain.handle('favicon:get-cached', (_event, domain: string) => {
    return getCachedFaviconPath(domain)
  })

  ipcMain.handle('favicon:is-failed', (_event, domain: string) => {
    return isFaviconFailed(domain)
  })

  ipcMain.handle('favicon:download', async (_event, domain: string) => {
    return await downloadFavicon(domain)
  })

  ipcMain.handle('favicon:download-batch', async (_event, domains: string[]) => {
    const results = await downloadFavicons(domains)
    return Object.fromEntries(results)
  })

  ipcMain.handle('favicon:get-cache-dir', () => {
    return getFaviconCacheDir()
  })

  // ─── Storage ───────────────────────────────────────────
  ipcMain.handle('storage:is-icloud', () => {
    return isUsingICloud()
  })
}
