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
  // process's Info.plist for NSCameraUsageDescription before showing a prompt —
  // without it, the OS silently returns NotAllowedError regardless of main-app TCC.
  const helperRendererPlist = path.join(
    appPath,
    'Contents/Frameworks',
    `${context.packager.appInfo.productName} Helper (Renderer).app`,
    'Contents/Info.plist'
  )
  if (fs.existsSync(helperRendererPlist)) {
    try {
      const cameraDesc = 'LexCommons Multimedia Mentor uses your camera for webcam practice sessions.'
      const micDesc = 'LexCommons Multimedia Mentor uses your microphone for real-time pitch and volume analysis.'
      execSync(`/usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string '${cameraDesc}'" "${helperRendererPlist}"`, { stdio: 'pipe' })
      execSync(`/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string '${micDesc}'" "${helperRendererPlist}"`, { stdio: 'pipe' })
      console.log(`  • injected camera/mic usage descriptions into Renderer helper Info.plist`)
    } catch (e) {
      console.warn('  • failed to inject usage descriptions (non-fatal):', e.message)
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
