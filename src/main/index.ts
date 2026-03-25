import { app, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { initStorage, isUsingICloud } from './storage'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { getThumbnailBasePath } from './thumbnail-capture'
import { getFaviconCacheDir } from './favicon-cache'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: join(__dirname, '../../resources/icon.png'),
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

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

// Set app name (shows in dock and menu bar)
app.setName('Tab Hoarder')

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(join(__dirname, '../../resources/icon.png'))
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
