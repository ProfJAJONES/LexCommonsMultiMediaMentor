const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Custom sign function — replaces electron-builder's default codesign invocation.
//
// Why this approach:
// 1. --deep --timestamp=none avoids the "resource fork / detritus not allowed" error
//    that occurs when codesign tries to sign arm64 linker-signed Electron helpers
//    with --timestamp (hitting Apple's timestamp server conflicts with the adhoc sig).
//
// 2. We copy the .app to /tmp before signing because the build output lives on the
//    Desktop, which is iCloud Drive-synced. The FileProvider daemon re-adds
//    com.apple.FinderInfo and com.apple.fileprovider.fpfs#P xattrs asynchronously —
//    even milliseconds after xattr -cr — causing "detritus not allowed". /tmp is not
//    iCloud-synced so the strip holds through the codesign call.
exports.default = async function sign(configuration) {
  const { app: appPath, identity } = configuration

  if (!identity) {
    console.log('  • no signing identity — skipping')
    return
  }

  // Build a deterministic tmp path based on the app name
  const appName = path.basename(appPath)
  const tmpDir = path.join(os.tmpdir(), 'eb-sign-' + process.pid)
  const tmpApp = path.join(tmpDir, appName)

  // Copy to /tmp, strip xattrs there, sign, then move back
  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    execSync(`cp -pR "${appPath}" "${tmpDir}/"`, { stdio: 'pipe' })
    console.log(`  • copied to ${tmpDir}`)
  } catch (e) {
    throw new Error(`copy to tmp failed: ${e.message}`)
  }

  try {
    execSync(`xattr -cr "${tmpApp}"`, { stdio: 'pipe' })
    console.log('  • stripped xattrs in tmp')
  } catch { /* non-fatal */ }

  // Step 1: sign all individual executables and dylibs first (--deep misses
  // loose binaries in app.asar.unpacked which are required for notarization)
  console.log('  • signing individual binaries...')
  try {
    const out = execSync(
      `find "${tmpApp}" -type f \\( -name "*.dylib" -o -name "*.so" -o -name "*.node" -o -perm +0111 \\)`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const files = out.split('\n').filter(Boolean)
    let signed = 0
    for (const f of files) {
      // Skip the .app itself and any nested .app bundles — signed as bundles below
      if (f.endsWith('.app') || f.includes('.app/Contents/MacOS/') === false && f.endsWith('.app')) continue
      try {
        execSync(`codesign --sign "${identity}" --force --options runtime --timestamp "${f}"`, { stdio: 'pipe' })
        signed++
      } catch { /* binary may not need signing */ }
    }
    console.log(`  • signed ${signed} individual binaries`)
  } catch (e) {
    console.warn('  • individual binary signing failed (non-fatal):', e.message)
  }

  // Step 2: sign the whole .app bundle (catches nested .frameworks and .apps)
  const cmd = [
    'codesign',
    '--sign', `"${identity}"`,
    '--force',
    '--deep',
    '--options', 'runtime',
    '--timestamp',
    `"${tmpApp}"`
  ].join(' ')

  console.log(`  • signing bundle: ${tmpApp}`)
  try {
    execSync(cmd, { stdio: 'pipe' })
    console.log('  • signed successfully')
  } catch (e) {
    const msg = e.stderr?.toString() || e.message
    // Clean up tmp before throwing
    try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' }) } catch { /* ok */ }
    throw new Error(`codesign failed: ${msg}`)
  }

  // Move the signed app back, replacing the original
  try {
    execSync(`rm -rf "${appPath}"`, { stdio: 'pipe' })
    execSync(`mv "${tmpApp}" "${path.dirname(appPath)}/"`, { stdio: 'pipe' })
    console.log(`  • moved signed app back to ${path.dirname(appPath)}`)
  } catch (e) {
    throw new Error(`move back failed: ${e.message}`)
  } finally {
    try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' }) } catch { /* ok */ }
  }
}
