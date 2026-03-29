import { app, BrowserWindow, net } from 'electron'
import { join } from 'path'
import { initStorage } from './storage'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { getThumbnailBasePath } from './thumbnail-capture'
import { getFaviconCacheDir } from './favicon-cache'

let mainWindow: BrowserWindow | null = null

function getIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png')
  }
  return join(__dirname, '../../resources/icon.png')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: getIconPath(),
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    transparent: false,
    backgroundColor: '#FF1a1a2e',
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Vibrancy works in both dev and packaged
  mainWindow.setVibrancy('under-window')

  // Register custom protocols for thumbnails and favicons
  mainWindow.webContents.session.protocol.handle('thumb', (request) => {
    const filePath = request.url.replace('thumb://', '')
    const fullPath = join(getThumbnailBasePath(), filePath)
    return net.fetch(`file://${fullPath}`)
  })

  mainWindow.webContents.session.protocol.handle('fav', (request) => {
    const filePath = request.url.replace('fav://', '')
    const fullPath = join(getFaviconCacheDir(), filePath)
    return net.fetch(`file://${fullPath}`)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.setName('Tab Hoarder')

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    try { app.dock.setIcon(getIconPath()) } catch {}
  }

  initStorage()
  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
