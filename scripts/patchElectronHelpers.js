/**
 * Patches ALL Electron Helper Info.plists BEFORE packaging.
 * Injects NSCameraUsageDescription and NSMicrophoneUsageDescription into every
 * helper bundle template that electron-builder uses when building the app.
 *
 * macOS checks the REQUESTING PROCESS for these keys before showing a TCC
 * permission prompt. Audio capture in Chromium can run in any of the helper
 * processes (not just the Renderer). Without the usage strings, macOS silently
 * creates a "denied" TCC entry with no dialog — the app never appears in
 * System Settings → Microphone and the user has no way to grant access.
 *
 * Run automatically via "postinstall" in package.json after npm install.
 */

const fs = require('fs')
const path = require('path')

// Helper plists only exist in the macOS Electron.app bundle.
if (process.platform !== 'darwin') {
  console.log('[patchElectronHelpers] Not macOS — skipping')
  process.exit(0)
}

const frameworksDir = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Frameworks'
)

const helpers = [
  'Electron Helper.app',
  'Electron Helper (Renderer).app',
  'Electron Helper (GPU).app',
  'Electron Helper (Plugin).app',
]

const keysToInject = [
  ['NSCameraUsageDescription',     'LexCommons Multimedia Mentor uses your camera for webcam practice sessions.'],
  ['NSMicrophoneUsageDescription', 'LexCommons Multimedia Mentor uses your microphone for real-time pitch and volume analysis.'],
]

let anyFound = false
for (const helper of helpers) {
  const plistPath = path.join(frameworksDir, helper, 'Contents', 'Info.plist')
  if (!fs.existsSync(plistPath)) {
    console.warn(`[patchElectronHelpers] Not found — skipping: ${helper}`)
    continue
  }
  anyFound = true

  let plist = fs.readFileSync(plistPath, 'utf-8')
  let patched = 0

  for (const [key, value] of keysToInject) {
    if (!plist.includes(key)) {
      plist = plist.replace(
        /(\s*<\/dict>\s*<\/plist>\s*)$/,
        `\n\t<key>${key}</key>\n\t<string>${value}</string>$1`
      )
      patched++
    }
  }

  fs.writeFileSync(plistPath, plist, 'utf-8')
  console.log(`[patchElectronHelpers] ${helper}: injected ${patched} key(s)${patched === 0 ? ' (already patched)' : ''}`)
}

if (!anyFound) {
  console.warn('[patchElectronHelpers] No Electron helpers found — is electron installed?')
  process.exit(1)
}
