import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net, systemPreferences, desktopCapturer } from 'electron'
import { join, resolve, normalize } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
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

const HELPER_BUNDLES = [
  'org.lexcommons.multimedia-mentor',
  'org.lexcommons.multimedia-mentor.helper',
  'org.lexcommons.multimedia-mentor.helper.Renderer',
  'org.lexcommons.multimedia-mentor.helper.GPU',
  'org.lexcommons.multimedia-mentor.helper.Plugin',
]

// Request camera or microphone access, auto-resetting stale denied TCC entries.
// macOS silently denies helpers when Electron binaries change between DMG builds —
// the entry shows as "denied" but never appeared in System Settings. Detecting this
// and resetting automatically means users never need terminal commands.
async function grantMediaAccess(type: 'camera' | 'microphone'): Promise<void> {
  const granted = await systemPreferences.askForMediaAccess(type).catch(() => false)
  if (!granted && systemPreferences.getMediaAccessStatus(type) === 'denied') {
    const service = type === 'camera' ? 'Camera' : 'Microphone'
    for (const id of HELPER_BUNDLES) {
      try { execSync(`tccutil reset ${service} "${id}"`, { stdio: 'pipe' }) } catch { /* ok */ }
    }
    await systemPreferences.askForMediaAccess(type).catch(() => {})
  }
}

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

  win.on('ready-to-show', async () => {
    win.show()
    if (process.platform === 'darwin') {
      await grantMediaAccess('camera')
      await grantMediaAccess('microphone')
    }
  })

  // Allow the renderer to use camera and microphone via getUserMedia
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']
    callback(allowed.includes(permission))
  })

  // Chromium uses the *check* handler (not the request handler) to decide whether
  // navigator.mediaDevices.enumerateDevices() may expose stable deviceIds and
  // labels. file:// origins (production renderer) are treated as ephemeral and
  // get blank deviceIds without this — which makes
  // getUserMedia({ deviceId: { exact: id } }) impossible for the user-picked
  // camera and silently falls back to the built-in. Dev mode (localhost) has
  // persistent permission storage and works without it.
  win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']
    return allowed.includes(permission)
  })

  // Electron 30+ requires setDisplayMediaRequestHandler to be registered or
  // getDisplayMedia() is silently rejected in the renderer.
  // useSystemPicker: true shows the native macOS screen picker. After the user
  // picks a source, Electron calls this handler with request.video set to the
  // selected DesktopCapturerSource — we must pass it through the callback or
  // the request is denied (callback({}) = deny).
  win.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    // Electron 30+ adds request.video/audio after the system picker resolves, but
    // the .d.ts hasn't caught up — cast to read those fields without ts errors.
    const r = request as unknown as { video?: unknown; audio?: unknown }
    if (r.video && typeof r.video === 'object') {
      callback({ video: r.video as Electron.DesktopCapturerSource, audio: r.audio as 'loopback' | 'loopbackWithMute' | undefined })
      return
    }
    // request.video is null/undefined or boolean true — fall back to desktopCapturer screen source
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
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

  // Trigger the macOS screen recording TCC prompt on first launch.
  // desktopCapturer.getSources() returns empty but causes macOS to show the
  // "LexCommons wants to record your screen" banner — so permission is in place
  // by the time the user clicks Record Screen.
  if (process.platform === 'darwin') {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen')
    if (screenStatus === 'not-determined') {
      desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } }).catch(() => {})
    }
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
