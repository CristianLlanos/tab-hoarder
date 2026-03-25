import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  tabs: {
    getAll: (filter) => ipcRenderer.invoke('tabs:get-all', filter),
    create: (tab) => ipcRenderer.invoke('tabs:create', tab),
    createMany: (tabs, collectionId) => ipcRenderer.invoke('tabs:create-many', tabs, collectionId),
    update: (id, fields) => ipcRenderer.invoke('tabs:update', id, fields),
    delete: (id) => ipcRenderer.invoke('tabs:delete', id),
    search: (query) => ipcRenderer.invoke('tabs:search', query),
    openInChrome: (url, profileDir) => ipcRenderer.invoke('tabs:open-in-chrome', url, profileDir),
    captureThumbnail: (tabId) => ipcRenderer.invoke('tabs:capture-thumbnail', tabId),
    captureAllThumbnails: (tabIds) => ipcRenderer.invoke('tabs:capture-all-thumbnails', tabIds),
  },
  collections: {
    getAll: () => ipcRenderer.invoke('collections:get-all'),
    create: (input) => ipcRenderer.invoke('collections:create', input),
    update: (id, fields) => ipcRenderer.invoke('collections:update', id, fields),
    delete: (id) => ipcRenderer.invoke('collections:delete', id),
  },
  chrome: {
    importTabs: () => ipcRenderer.invoke('chrome:import-tabs'),
    getProfiles: () => ipcRenderer.invoke('chrome:get-profiles'),
    closeTabs: (urls) => ipcRenderer.invoke('chrome:close-tabs', urls),
  },
  favicon: {
    getCached: (domain) => ipcRenderer.invoke('favicon:get-cached', domain),
    isFailed: (domain) => ipcRenderer.invoke('favicon:is-failed', domain),
    download: (domain) => ipcRenderer.invoke('favicon:download', domain),
    downloadBatch: (domains) => ipcRenderer.invoke('favicon:download-batch', domains),
  },
  storage: {
    isICloud: () => ipcRenderer.invoke('storage:is-icloud'),
  },
  on: (channel, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  getThumbnailPath: (relativePath: string) => `thumb://${relativePath}`,
  getFaviconPath: (relativePath: string) => `fav://${relativePath}`,
}

contextBridge.exposeInMainWorld('electronAPI', api)
