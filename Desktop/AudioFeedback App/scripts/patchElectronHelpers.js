/**
 * Patches ALL Electron Helper Info.plists and re-signs them for dev mode.
 * Injects NSCameraUsageDescription and NSMicrophoneUsageDescription into every
 * helper bundle template that electron-builder uses when building the app.
 *
 * macOS checks the REQUESTING PROCESS for these keys before showing a TCC
 * permission prompt. Audio capture in Chromium can run in any of the helper
 * processes (not just the Renderer). Without the usage strings, macOS silently
 * creates a "denied" TCC entry with no dialog — the app never appears in
 * System Settings → Microphone and the user has no way to grant access.
 *
 * IMPORTANT: modifying Info.plist breaks the Electron binary's code signature.
 * macOS will silently deny TCC requests from a process with a broken signature
 * even if NSMicrophoneUsageDescription is present. After patching we re-sign
 * each helper with an ad-hoc signature so macOS accepts the TCC request and
 * shows a proper permission dialog in development.
 *
 * Run automatically via "postinstall" in package.json after npm install.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Helper plists only exist in the macOS Electron.app bundle.
if (process.platform !== 'darwin') {
  console.log('[patchElectronHelpers] Not macOS — skipping')
  process.exit(0)
}

const electronAppDir = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app'
)
const frameworksDir = path.join(electronAppDir, 'Contents', 'Frameworks')

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
  const helperPath = path.join(frameworksDir, helper)
  const plistPath = path.join(helperPath, 'Contents', 'Info.plist')
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

  // Re-sign after plist modification.
  // Patching Info.plist breaks the original Electron code signature; macOS will
  // silently deny TCC permission requests from a process with an invalid or
  // ad-hoc signature (no TeamIdentifier) even when NSMicrophoneUsageDescription
  // is present. Sign with the Developer ID so macOS can identify the app in TCC.
  // Strip resource forks / xattrs first — codesign fails with "detritus not allowed"
  // if any extended attributes remain on files unpacked from npm's tarball.
  const SIGNING_IDENTITY = 'Developer ID Application: Joshua Jones (8CNHM3Q67S)'
  try {
    execSync(`xattr -cr "${helperPath}"`, { stdio: 'pipe' })
    execSync(`codesign -f -s "${SIGNING_IDENTITY}" "${helperPath}"`, { stdio: 'pipe' })
    console.log(`[patchElectronHelpers] ${helper}: re-signed (Developer ID)`)
  } catch (e) {
    // Fall back to ad-hoc if the Developer ID cert is unavailable
    try {
      execSync(`codesign -f -s - "${helperPath}"`, { stdio: 'pipe' })
      console.warn(`[patchElectronHelpers] ${helper}: Developer ID unavailable, re-signed ad-hoc`)
    } catch (e2) {
      console.warn(`[patchElectronHelpers] ${helper}: re-sign failed — ${e2.message}`)
    }
  }
}

if (!anyFound) {
  console.warn('[patchElectronHelpers] No Electron helpers found — is electron installed?')
  process.exit(1)
}

// Re-sign the parent Electron.app after all helpers are patched + signed.
const SIGNING_IDENTITY = 'Developer ID Application: Joshua Jones (8CNHM3Q67S)'
try {
  execSync(`xattr -cr "${electronAppDir}"`, { stdio: 'pipe' })
  execSync(`codesign -f -s "${SIGNING_IDENTITY}" "${electronAppDir}"`, { stdio: 'pipe' })
  console.log('[patchElectronHelpers] Electron.app: re-signed (Developer ID)')
} catch (e) {
  try {
    execSync(`codesign -f -s - "${electronAppDir}"`, { stdio: 'pipe' })
    console.warn('[patchElectronHelpers] Electron.app: Developer ID unavailable, re-signed ad-hoc')
  } catch (e2) {
    console.warn(`[patchElectronHelpers] Electron.app: re-sign failed — ${e2.message}`)
  }
}
