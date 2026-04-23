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

  // Inject camera/mic usage descriptions into the Renderer helper Info.plist.
  // getUserMedia runs inside the Renderer helper process. macOS TCC checks that
  // process's Info.plist for NS*UsageDescription before showing a permission prompt —
  // without these keys the OS silently returns NotAllowedError regardless of main-app TCC.
  // Use Node.js string injection (not PlistBuddy) so it works in all CI environments.
  const helperRendererPlist = path.join(
    appPath,
    'Contents/Frameworks',
    `${context.packager.appInfo.productName} Helper (Renderer).app`,
    'Contents/Info.plist'
  )
  if (fs.existsSync(helperRendererPlist)) {
    try {
      let plist = fs.readFileSync(helperRendererPlist, 'utf-8')
      const keysToInject = [
        ['NSCameraUsageDescription', 'LexCommons Multimedia Mentor uses your camera for webcam practice sessions.'],
        ['NSMicrophoneUsageDescription', 'LexCommons Multimedia Mentor uses your microphone for real-time pitch and volume analysis.'],
      ]
      let injected = 0
      for (const [key, value] of keysToInject) {
        if (!plist.includes(key)) {
          // Match the closing </dict> regardless of leading whitespace
          plist = plist.replace(
            /(\s*<\/dict>\s*<\/plist>\s*)$/,
            `\n\t<key>${key}</key>\n\t<string>${value}</string>$1`
          )
          injected++
        }
      }
      fs.writeFileSync(helperRendererPlist, plist, 'utf-8')
      // Verify the injection actually happened
      const verify = fs.readFileSync(helperRendererPlist, 'utf-8')
      const ok = keysToInject.every(([k]) => verify.includes(k))
      console.log(`  • Renderer helper Info.plist: injected ${injected} key(s), verified=${ok}`)
      if (!ok) console.warn('  • WARNING: injection verification failed — check plist format')
    } catch (e) {
      console.warn('  • failed to inject usage descriptions:', e.message)
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
