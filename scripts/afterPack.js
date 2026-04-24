const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Prepare the built app for re-signing:
// 1. Strip xattrs / resource forks that codesign rejects as "detritus"
// 2. Remove linker-embedded signatures from arm64 Electron helper binaries —
//    linker-signed binaries on Apple Silicon produce "resource fork … detritus
//    not allowed" when codesign tries to replace their signature.
// 3. Inject NSCameraUsageDescription + NSMicrophoneUsageDescription into the
//    Renderer helper's Info.plist — macOS checks the RENDERER process bundle
//    (not just the main app) before allowing getUserMedia camera access.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productName}.app`)

  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'pipe' })
    // -n removes ._* AppleDouble files WITHOUT merging resource forks into binaries
    // (-m merges them in, which is what causes "detritus not allowed" in codesign)
    execSync(`dot_clean -n "${appPath}"`, { stdio: 'pipe' })
    console.log(`  • stripped xattrs + removed AppleDouble files`)
  } catch (e) {
    console.warn('  • xattr/dot_clean failed (non-fatal):', e.message)
  }

  // Inject camera/mic usage descriptions into ALL helper Info.plists.
  // Audio capture in Chromium can run in any helper process (Renderer, GPU, Plugin,
  // or the base Helper). macOS TCC checks the REQUESTING PROCESS for
  // NS*UsageDescription before showing a permission prompt — without these keys
  // the OS silently creates a "denied" TCC entry with no dialog, so the app never
  // appears in System Settings → Microphone and the user cannot grant access.
  const productName = context.packager.appInfo.productName
  const helperNames = [
    `${productName} Helper.app`,
    `${productName} Helper (Renderer).app`,
    `${productName} Helper (GPU).app`,
    `${productName} Helper (Plugin).app`,
  ]
  const keysToInject = [
    ['NSCameraUsageDescription', 'LexCommons Multimedia Mentor uses your camera for webcam practice sessions.'],
    ['NSMicrophoneUsageDescription', 'LexCommons Multimedia Mentor uses your microphone for real-time pitch and volume analysis.'],
  ]
  for (const helperName of helperNames) {
    const helperPlist = path.join(appPath, 'Contents/Frameworks', helperName, 'Contents/Info.plist')
    if (!fs.existsSync(helperPlist)) {
      console.warn(`  • ${helperName}: plist not found — skipping`)
      continue
    }
    try {
      let plist = fs.readFileSync(helperPlist, 'utf-8')
      let injected = 0
      for (const [key, value] of keysToInject) {
        if (!plist.includes(key)) {
          plist = plist.replace(
            /(\s*<\/dict>\s*<\/plist>\s*)$/,
            `\n\t<key>${key}</key>\n\t<string>${value}</string>$1`
          )
          injected++
        }
      }
      fs.writeFileSync(helperPlist, plist, 'utf-8')
      const verify = fs.readFileSync(helperPlist, 'utf-8')
      const ok = keysToInject.every(([k]) => verify.includes(k))
      console.log(`  • ${helperName}: injected ${injected} key(s), verified=${ok}`)
      if (!ok) console.warn(`  • WARNING: injection verification failed for ${helperName}`)
    } catch (e) {
      console.warn(`  • failed to patch ${helperName}:`, e.message)
    }
  }

  // Remove existing (linker) signatures from all executables so codesign
  // can sign them cleanly with our identity.
  try {
    const out = execSync(
      `find "${appPath}" -type f \\( -name "*.dylib" -o -perm +0111 \\)`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const files = out.split('\n').filter(Boolean)
    let removed = 0
    for (const f of files) {
      try {
        execSync(`codesign --remove-signature "${f}"`, { stdio: 'pipe' })
        removed++
      } catch { /* binary may not have a signature — fine */ }
    }
    console.log(`  • removed existing signatures from ${removed} binaries`)
  } catch (e) {
    console.warn('  • signature removal failed (non-fatal):', e.message)
  }
}
