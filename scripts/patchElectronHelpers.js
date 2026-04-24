/**
 * Patches the Electron Renderer Helper Info.plist BEFORE packaging.
 * Injects NSCameraUsageDescription and NSMicrophoneUsageDescription into the
 * template that electron-builder uses when building the Renderer helper bundle.
 *
 * macOS checks the REQUESTING PROCESS (the Renderer helper) for these keys
 * before showing a TCC permission prompt. Without them, getUserMedia for
 * camera/mic is silently denied regardless of the main app's TCC status.
 *
 * Run automatically via "postinstall" in package.json after npm install.
 */

const fs = require('fs')
const path = require('path')

const helperPlist = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Frameworks',
  'Electron Helper (Renderer).app', 'Contents', 'Info.plist'
)

const keysToInject = [
  ['NSCameraUsageDescription',     'LexCommons Multimedia Mentor uses your camera for webcam practice sessions.'],
  ['NSMicrophoneUsageDescription', 'LexCommons Multimedia Mentor uses your microphone for real-time pitch and volume analysis.'],
]

if (!fs.existsSync(helperPlist)) {
  console.warn('[patchElectronHelpers] Renderer helper plist not found — skipping:', helperPlist)
  process.exit(0)
}

let plist = fs.readFileSync(helperPlist, 'utf-8')
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

if (patched > 0) {
  fs.writeFileSync(helperPlist, plist, 'utf-8')
  console.log(`[patchElectronHelpers] Injected ${patched} key(s) into Renderer helper Info.plist`)
} else {
  console.log('[patchElectronHelpers] Renderer helper Info.plist already patched — nothing to do')
}
