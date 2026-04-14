import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net, desktopCapturer, systemPreferences } from 'electron'
import { join, resolve, normalize } from 'path'
import { homedir } from 'os'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipcHandlers'

// Holds the source ID the user selected in the renderer so the
// displayMediaRequestHandler can grant it when getDisplayMedia() fires.
let pendingCaptureSourceId: string | null = null

// Register the custom 'media' protocol before app is ready so it is
// treated as secure and supports streaming (range requests).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'LexCommons Multimedia Mentor',
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  // Allow the renderer to use camera and microphone via getUserMedia
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']
    callback(allowed.includes(permission))
  })

  // Grant the source the user already picked — no OS picker shown
  win.webContents.session.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sourceId = pendingCaptureSourceId
    pendingCaptureSourceId = null
    if (!sourceId) { callback({}); return }
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
    const source = sources.find(s => s.id === sourceId)
    callback(source ? { video: source, audio: 'loopback' } : {})
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

registerIpcHandlers(ipcMain, dialog)

// Store the user-selected source ID before getDisplayMedia() is called
ipcMain.handle('desktop:prepareCapture', (_event, sourceId: string) => {
  pendingCaptureSourceId = sourceId
})

app.whenReady().then(() => {
  // Serve local files via media:// so the renderer can load them regardless
  // of whether it is running from localhost (dev) or a file:// origin (prod).
  protocol.handle('media', async (request) => {
    // URL format: media://local/absolute/path/to/file
    const rawPath = decodeURIComponent(request.url.slice('media://local'.length))
    // Prevent path traversal — only serve files inside the user's home directory
    const filePath = resolve(normalize(rawPath))
    const home = homedir()
    if (!filePath.startsWith(home + '/') && filePath !== home) {
      return new Response('Forbidden', { status: 403 })
    }

    // Forward all headers (critically: the Range header for video chunk buffering)
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => { headers[key] = value })

    const response = await net.fetch(`file://${filePath}`, { headers })

    // Add CORS headers so the renderer can use the media element with Web Audio API
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })
  })

  // On macOS, proactively request system-level camera and mic access so the
  // OS permission dialog appears the first time the user clicks Webcam.
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('camera').catch(() => {})
    systemPreferences.askForMediaAccess('microphone').catch(() => {})
  }

  createWindow()

  // Check for updates a few seconds after launch (only in production)
  if (!process.env['ELECTRON_RENDERER_URL']) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 5000)
  }

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'It will be downloaded in the background and installed when you restart the app.',
      buttons: ['OK']
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded.',
      detail: 'Restart the app to apply the update.',
      buttons: ['Restart Now', 'Later']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
