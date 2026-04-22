import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net, systemPreferences, desktopCapturer } from 'electron'
import { join, resolve, normalize } from 'path'
import { homedir } from 'os'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipcHandlers'

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

  // Electron 30+ requires setDisplayMediaRequestHandler to be registered or
  // getDisplayMedia() is silently rejected in the renderer.
  // useSystemPicker: true shows the native macOS screen picker. After the user
  // picks a source, Electron calls this handler with request.video set to the
  // selected DesktopCapturerSource — we must pass it through the callback or
  // the request is denied (callback({}) = deny).
  win.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('[displayMedia] request.video:', request.video, '| type:', typeof request.video)
    if (request.video && typeof request.video === 'object') {
      console.log('[displayMedia] passing through source id:', (request.video as { id?: string }).id)
      callback({ video: request.video, audio: request.audio })
      return
    }
    // request.video is null/undefined or boolean true — fall back to desktopCapturer screen source
    console.log('[displayMedia] falling back to desktopCapturer screen source')
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
    console.log('[displayMedia] screen sources found:', sources.map(s => s.name))
    callback(sources[0] ? { video: sources[0] } : {})
  }, { useSystemPicker: true })

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

app.whenReady().then(async () => {
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

  createWindow()

  if (process.platform === 'darwin') {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen')
    console.log('[permissions] screen recording status at startup:', screenStatus)
  }

  // Request camera and microphone access after the window is visible so macOS
  // attaches the TCC prompt to a real window. Must happen after createWindow()
  // so the app has a frontmost window when the system dialog appears.
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('camera').catch(() => {})
    systemPreferences.askForMediaAccess('microphone').catch(() => {})
  }

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
