import { IpcMain, Dialog, shell, desktopCapturer, app, BrowserWindow, systemPreferences } from 'electron'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join, basename, extname, resolve, normalize } from 'path'
import { homedir } from 'os'
import { tmpdir } from 'os'
import ffmpegStatic from 'ffmpeg-static'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType
} from 'docx'
import ffmpeg from 'fluent-ffmpeg'

// Resolve ffmpeg binary — outside asar when packaged
function getFfmpegPath(): string {
  if (app.isPackaged) {
    // process.resourcesPath is always the Resources/ directory of the app bundle.
    // ffmpeg-static is in asarUnpack so it lives under app.asar.unpacked/ on disk.
    return join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  }
  const raw = ffmpegStatic as string
  if (!raw) throw new Error('ffmpeg-static binary not found')
  return raw
}

export function registerIpcHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  // List available screens and windows for screen recording
  ipcMain.handle('desktop:getSources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 200 },
      fetchWindowIcons: true
    })
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon?.toDataURL() ?? null
    }))
  })

  // Save a recording — always writes WebM immediately so a file always exists,
  // then converts to the chosen format with ffmpeg (replaces WebM when done).
  ipcMain.handle('desktop:saveRecording', async (_event, buffer: Uint8Array | ArrayBuffer, suggestedName: string) => {
    const defaultName = suggestedName.replace(/\.webm$/i, '.mp4')

    const result = await dialog.showSaveDialog({
      title: 'Save Recording',
      defaultPath: defaultName,
      filters: [
        { name: 'MP4 Video — recommended, plays everywhere',  extensions: ['mp4']  },
        { name: 'QuickTime Movie (MOV) — Mac & iOS native',   extensions: ['mov']  },
        { name: 'WebM Video — original, no conversion needed', extensions: ['webm'] },
        { name: 'MKV Video — high quality',                   extensions: ['mkv']  },
        { name: 'MP3 Audio — audio track only',               extensions: ['mp3']  },
        { name: 'M4A Audio — high quality audio only',        extensions: ['m4a']  },
        { name: 'WAV Audio — uncompressed',                   extensions: ['wav']  },
      ]
    })

    if (result.canceled || !result.filePath) return null

    const chosenPath = result.filePath
    const ext = extname(chosenPath).toLowerCase().slice(1)

    // Convert buffer to Node Buffer — check it's non-empty
    let rawBuf: Buffer
    try {
      rawBuf = Buffer.from(buffer)
    } catch (e) {
      dialog.showErrorBox('Save failed', `Could not read recording data: ${e}`)
      return null
    }

    if (rawBuf.byteLength === 0) {
      dialog.showErrorBox('Save failed', 'Recording is empty — no data was captured. Try recording again.')
      return null
    }

    // Step 1: always write the raw WebM immediately so a file always exists
    const webmPath = ext === 'webm' ? chosenPath : chosenPath.replace(/\.[^.]+$/, '.webm')
    try {
      writeFileSync(webmPath, rawBuf)
    } catch (e) {
      dialog.showErrorBox('Save failed', `Could not write file to ${webmPath}:\n${e}`)
      return null
    }

    // If user chose WebM, we're done
    if (ext === 'webm') return webmPath

    // Step 2: convert WebM → chosen format with ffmpeg
    try {
      const ffmpegPath = getFfmpegPath()
      ffmpeg.setFfmpegPath(ffmpegPath)

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg(webmPath)

        switch (ext) {
          case 'mp4':
          case 'mov':
            cmd = cmd
              .videoCodec('libx264').videoBitrate('2000k')
              .audioCodec('aac').audioBitrate('192k')
              .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
            break
          case 'mkv':
            cmd = cmd.videoCodec('libx264').videoBitrate('2000k').audioCodec('aac').audioBitrate('192k')
            break
          case 'mp3':
            cmd = cmd.noVideo().audioCodec('libmp3lame').audioBitrate('192k')
            break
          case 'm4a':
            cmd = cmd.noVideo().audioCodec('aac').audioBitrate('192k').outputOptions(['-movflags', 'faststart'])
            break
          case 'wav':
            cmd = cmd.noVideo().audioCodec('pcm_s16le').audioFrequency(44100)
            break
          default:
            cmd = cmd.videoCodec('libx264').audioCodec('aac')
        }

        cmd.save(chosenPath).on('end', resolve).on('error', reject)
      })

      // Conversion succeeded — remove the intermediate WebM
      try { unlinkSync(webmPath) } catch { /* ignore */ }
      return chosenPath

    } catch {
      // FFmpeg failed — the WebM file still exists at webmPath
      // Return a structured object so the renderer can show the right message
      return { fallback: true, webmPath }
    }
  })

  // Open a video/audio file picker
  ipcMain.handle('dialog:openMedia', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Video or Audio',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'ogg']
        }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return {
      filePath,
      fileName: basename(filePath)
    }
  })

  // Save feedback/annotations as JSON (legacy — kept for round-trip import)
  ipcMain.handle('dialog:saveFeedback', async (_event, data: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Feedback',
      defaultPath: 'feedback.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, data, 'utf-8')
    return true
  })

  // Save notes in a user-chosen format
  ipcMain.handle('dialog:saveNotesAs', async (_event, data: string, format: 'json' | 'csv' | 'md' | 'txt') => {
    const filterMap = {
      json: { name: 'JSON (re-importable)',          extensions: ['json'] },
      csv:  { name: 'CSV Spreadsheet (Excel, Numbers)', extensions: ['csv']  },
      md:   { name: 'Markdown Document',              extensions: ['md']   },
      txt:  { name: 'Plain Text',                     extensions: ['txt']  },
    }
    const defaultNames = { json: 'session-notes.json', csv: 'session-notes.csv', md: 'session-notes.md', txt: 'session-notes.txt' }
    const result = await dialog.showSaveDialog({
      title: 'Export Notes',
      defaultPath: defaultNames[format],
      filters: [filterMap[format]]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, data, 'utf-8')
    return result.filePath
  })

  // Load previously saved feedback (JSON or CSV)
  ipcMain.handle('dialog:loadFeedback', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Notes',
      properties: ['openFile'],
      filters: [
        { name: 'All Supported Formats', extensions: ['json', 'csv'] },
        { name: 'JSON Session File (re-importable)', extensions: ['json'] },
        { name: 'CSV Spreadsheet', extensions: ['csv'] },
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    const ext = extname(filePath).toLowerCase().slice(1)
    if (ext === 'csv') {
      // Parse CSV back into comments array
      const lines = content.split('\n').filter(l => l.trim())
      if (lines.length < 2) return null
      const comments = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g) ?? []
        const unquote = (s: string) => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        const [tsRaw, , author, tag, text] = cols.map(unquote)
        const parts = tsRaw.split(':')
        const sec = parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0
        if (text !== undefined) {
          comments.push({ id: Math.random().toString(36).slice(2) + Date.now().toString(36), timestamp: sec, author: author || '', tag: tag || 'general', text: text || '', createdAt: Date.now() })
        }
      }
      return { comments, annotations: [] }
    }
    return JSON.parse(content)
  })

  // Save a session report as PDF or HTML
  ipcMain.handle('desktop:saveReport', async (_event, html: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Session Report',
      defaultPath: 'session-report.pdf',
      filters: [
        { name: 'PDF Document',  extensions: ['pdf']  },
        { name: 'HTML File',     extensions: ['html'] },
      ]
    })
    if (result.canceled || !result.filePath) return null

    const outPath = result.filePath
    const ext = extname(outPath).toLowerCase().slice(1)

    if (ext === 'html') {
      writeFileSync(outPath, html, 'utf-8')
      return outPath
    }

    // PDF: render HTML in a hidden BrowserWindow then print to PDF
    const tmpHtml = join(tmpdir(), `mm_report_${Date.now()}.html`)
    writeFileSync(tmpHtml, html, 'utf-8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    try {
      await win.loadFile(tmpHtml)
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
        margins: { marginType: 'default' }
      })
      writeFileSync(outPath, pdfBuffer)
      return outPath
    } finally {
      win.destroy()
      try { unlinkSync(tmpHtml) } catch { /* ignore */ }
    }
  })

  // Open the output folder in Finder/Explorer.
  // Restrict to paths inside the user's home directory to prevent renderer
  // from revealing arbitrary filesystem locations via Finder.
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') return
    const safe = resolve(normalize(filePath))
    const home = homedir()
    if (!safe.startsWith(home + '/') && safe !== home) {
      console.warn('shell:openPath blocked — path outside home dir:', safe)
      return
    }
    await shell.showItemInFolder(safe)
  })

  // Export video with pitch/volume graph strip and timed comment overlays burned in
  ipcMain.handle('desktop:exportAnnotatedVideo', async (
    _event,
    videoPath: string,
    pitchPng: string,   // base64 PNG data URL
    decibelPng: string, // base64 PNG data URL
    comments: Array<{ timestamp: number; tag: string; text: string }>
  ) => {
    // Validate video path is inside home dir
    const safe = resolve(normalize(videoPath))
    const home = homedir()
    if (!safe.startsWith(home + '/') && safe !== home) return { error: 'Invalid path' }

    const result = await dialog.showSaveDialog({
      title: 'Export Annotated Video',
      defaultPath: basename(videoPath, extname(videoPath)) + '-annotated.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    })
    if (result.canceled || !result.filePath) return null

    const outPath = result.filePath
    const ffmpegPath = getFfmpegPath()
    ffmpeg.setFfmpegPath(ffmpegPath)

    // Write graph PNGs to temp files
    const tmpPitch   = join(tmpdir(), `mm_pitch_${Date.now()}.png`)
    const tmpDecibel = join(tmpdir(), `mm_db_${Date.now()}.png`)

    try {
      const toBuffer = (dataUrl: string) => Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
      if (pitchPng)   writeFileSync(tmpPitch,   toBuffer(pitchPng))
      if (decibelPng) writeFileSync(tmpDecibel, toBuffer(decibelPng))

      // Build ffmpeg filter_complex:
      // [0:v] scale to fit → overlay pitch strip (bottom 20%) → overlay dB strip below that
      // drawtext for each comment at its timestamp (show for 4 seconds)
      const hasPitch   = pitchPng   && pitchPng.length > 0
      const hasDecibel = decibelPng && decibelPng.length > 0

      // Safe comment text: strip quotes and limit length
      const safeComments = comments
        .filter(c => c.timestamp >= 0 && c.text?.trim())
        .slice(0, 50)  // hard cap at 50 overlays
        .map(c => ({
          t: c.timestamp,
          tag: (c.tag || '').replace(/[^a-zA-Z0-9_ ]/g, ''),
          text: (c.text || '').replace(/['"\\:]/g, ' ').slice(0, 80)
        }))

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg(safe)

        const inputs: string[] = []
        if (hasPitch)   { cmd = cmd.input(tmpPitch);   inputs.push('pitch')   }
        if (hasDecibel) { cmd = cmd.input(tmpDecibel); inputs.push('decibel') }

        // Build filter graph
        const filters: string[] = []
        let lastV = '0:v'

        if (hasPitch) {
          const idx = 1
          // Scale pitch PNG to video width, overlay at bottom-220px
          filters.push(`[${idx}:v]scale=iw:-1[pitchscaled]`)
          filters.push(`[${lastV}][pitchscaled]overlay=0:H-220[v1]`)
          lastV = 'v1'
        }
        if (hasDecibel) {
          const idx = hasPitch ? 2 : 1
          filters.push(`[${idx}:v]scale=iw:-1[dbscaled]`)
          filters.push(`[${lastV}][dbscaled]overlay=0:H-h[v2]`)
          lastV = 'v2'
        }

        // Comment text overlays
        safeComments.forEach((c, i) => {
          const outTag = `vc${i}`
          const enable = `between(t,${c.t},${c.t + 4})`
          const line = `[${lastV}]drawtext=text='${c.tag}: ${c.text}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6:x=20:y=40:enable='${enable}'[${outTag}]`
          filters.push(line)
          lastV = outTag
        })

        if (filters.length > 0) {
          cmd = cmd.complexFilter(filters, lastV)
        }

        cmd
          .videoCodec('libx264')
          .videoBitrate('2000k')
          .audioCodec('aac')
          .audioBitrate('192k')
          .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
          .save(outPath)
          .on('end', () => resolve())
          .on('error', reject)
      })

      return outPath
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    } finally {
      try { unlinkSync(tmpPitch) } catch { /* ok */ }
      try { unlinkSync(tmpDecibel) } catch { /* ok */ }
    }
  })

  // Open the bundled BlackHole installer PKG
  ipcMain.handle('system:installBlackHole', async () => {
    const pkgPath = app.isPackaged
      ? join(process.resourcesPath, 'BlackHole2ch.pkg')
      : join(app.getAppPath(), 'resources', 'BlackHole2ch.pkg')
    const err = await shell.openPath(pkgPath)
    return err || null   // null = success, string = error message
  })

  // Open Audio MIDI Setup so the user can create a Multi-Output Device
  ipcMain.handle('system:openAudioMidiSetup', async () => {
    const err = await shell.openPath('/System/Applications/Utilities/Audio MIDI Setup.app')
    return err || null
  })

  // Export notes as PDF (HTML → hidden BrowserWindow → printToPDF)
  ipcMain.handle('dialog:saveNotesAsPDF', async (_event, html: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Notes as PDF',
      defaultPath: suggestedName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    const tmpHtml = join(tmpdir(), `mm_notes_${Date.now()}.html`)
    writeFileSync(tmpHtml, html, 'utf-8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    try {
      await win.loadFile(tmpHtml)
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
        margins: { marginType: 'default' }
      })
      writeFileSync(result.filePath, pdfBuffer)
      return result.filePath
    } finally {
      win.destroy()
      try { unlinkSync(tmpHtml) } catch { /* ignore */ }
    }
  })

  // Export notes as DOCX
  ipcMain.handle('dialog:saveNotesAsDocx', async (_event, payload: {
    fileName: string
    exportedAt: string
    comments: Array<{ timestamp: number; author: string; tag: string; text: string }>
  }, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Notes as Word Document',
      defaultPath: suggestedName,
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    })
    if (result.canceled || !result.filePath) return null

    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

    const TAG_COLORS: Record<string, string> = {
      pacing: '818CF8', clarity: '34D399', volume: 'FBBF24',
      posture: 'F472B6', eye_contact: '60A5FA', argument: 'F87171', general: '94A3B8'
    }

    const children: Paragraph[] = [
      new Paragraph({
        text: `Session Feedback — ${payload.fileName || 'Untitled'}`,
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: `Exported: ${payload.exportedAt}`, color: '64748B', size: 18 })],
        spacing: { after: 320 }
      }),
    ]

    if (payload.comments.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'No feedback comments recorded.', italics: true, color: '64748B' })] }))
    } else {
      for (const c of payload.comments) {
        const tagColor = TAG_COLORS[c.tag] ?? '94A3B8'
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${fmtTime(c.timestamp)}]  `, bold: true, color: '0284C7', size: 20 }),
              new TextRun({ text: c.tag.replace('_', ' ').toUpperCase(), bold: true, color: tagColor, size: 18 }),
            ],
            spacing: { before: 200, after: 60 },
            border: { left: { style: BorderStyle.THICK, color: tagColor, size: 12 } },
            indent: { left: 180 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${c.author}:  `, bold: true, size: 20 }),
              new TextRun({ text: c.text, size: 20 }),
            ],
            indent: { left: 360 },
            spacing: { after: 80 }
          })
        )
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22 }
          }
        }
      },
      sections: [{ properties: {}, children }]
    })

    const buf = await Packer.toBuffer(doc)
    writeFileSync(result.filePath, buf)
    return result.filePath
  })

  ipcMain.handle('permissions:getMediaStatus', () => {
    if (process.platform !== 'darwin') return { camera: 'granted', microphone: 'granted' }
    return {
      camera: systemPreferences.getMediaAccessStatus('camera'),
      microphone: systemPreferences.getMediaAccessStatus('microphone')
    }
  })

  ipcMain.handle('permissions:requestMedia', async () => {
    if (process.platform !== 'darwin') return { camera: true, microphone: true }
    // On macOS 15+ permission prompts are non-blocking banners — askForMediaAccess
    // resolves before the user responds. Just read the current TCC status.
    const camera = systemPreferences.getMediaAccessStatus('camera') === 'granted'
    const microphone = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
    return { camera, microphone }
  })
}
