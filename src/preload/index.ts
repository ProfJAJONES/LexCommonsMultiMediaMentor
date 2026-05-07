import { contextBridge, ipcRenderer } from 'electron'

export type MediaFile = { filePath: string; fileName: string }
export type FeedbackData = Record<string, unknown>

contextBridge.exposeInMainWorld('api', {
  openMedia: (): Promise<MediaFile | null> =>
    ipcRenderer.invoke('dialog:openMedia'),

  saveFeedback: (data: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:saveFeedback', data),

  saveNotesAs: (data: string, format: 'json' | 'csv' | 'md' | 'txt'): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveNotesAs', data, format),

  saveNotesAsPDF: (html: string, name: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveNotesAsPDF', html, name),

  saveNotesAsDocx: (payload: object, name: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveNotesAsDocx', payload, name),

  loadFeedback: (): Promise<FeedbackData | null> =>
    ipcRenderer.invoke('dialog:loadFeedback'),

  openPath: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  getCaptureSources: (): Promise<CaptureSource[]> =>
    ipcRenderer.invoke('desktop:getSources'),

  saveRecording: (buffer: Uint8Array, name: string): Promise<string | { fallback: true; webmPath: string } | null> =>
    ipcRenderer.invoke('desktop:saveRecording', buffer, name),

  saveProjectPackage: (
    webmBuffer: Uint8Array | null,
    reportHtml: string,
    notesPayload: {
      fileName: string
      exportedAt: string
      comments: object[]
      pitchData?: object[]
      decibelData?: object[]
      movementData?: object[]
      narrative?: string
    },
    slug: string
  ): Promise<string | null> =>
    ipcRenderer.invoke('desktop:saveProjectPackage', webmBuffer, reportHtml, notesPayload, slug),

  saveReport: (html: string): Promise<string | null> =>
    ipcRenderer.invoke('desktop:saveReport', html),

  exportAnnotatedVideo: (
    videoPath: string,
    pitchPng: string,
    decibelPng: string,
    comments: Array<{ timestamp: number; tag: string; text: string }>
  ): Promise<string | { error: string } | null> =>
    ipcRenderer.invoke('desktop:exportAnnotatedVideo', videoPath, pitchPng, decibelPng, comments),

  installBlackHole: (): Promise<string | null> =>
    ipcRenderer.invoke('system:installBlackHole'),

  openAudioMidiSetup: (): Promise<string | null> =>
    ipcRenderer.invoke('system:openAudioMidiSetup'),

  getMediaPermissions: (): Promise<{ camera: string; microphone: string }> =>
    ipcRenderer.invoke('permissions:getMediaStatus'),

  requestMediaAccess: (): Promise<{ camera: boolean; microphone: boolean }> =>
    ipcRenderer.invoke('permissions:requestMedia'),

  resetRendererMicTCC: (): Promise<{ ok: boolean; reset?: number }> =>
    ipcRenderer.invoke('permissions:resetRendererMicTCC'),

  resetAllAndRelaunch: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:resetAllAndRelaunch'),

  aggressiveReset: (): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> =>
    ipcRenderer.invoke('permissions:aggressiveReset'),

  openMainLog: (): Promise<string | null> =>
    ipcRenderer.invoke('system:openMainLog'),

  getScreenRecordingStatus: (): Promise<string> =>
    ipcRenderer.invoke('permissions:getScreenRecordingStatus'),

  openScreenRecordingSettings: (): Promise<void> =>
    ipcRenderer.invoke('system:openScreenRecordingSettings'),

  minimizeWindow: (): void =>
    ipcRenderer.send('window:minimize'),

  storeGet: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('store:get', key),

  storeGetAll: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('store:getAll'),

  storeSet: (key: string, value: string | null): Promise<void> =>
    ipcRenderer.invoke('store:set', key, value),

  openAssignment: (): Promise<{ assignment: object; slidesTempPath: string | null } | { error: string } | null> =>
    ipcRenderer.invoke('dialog:openAssignment'),

  saveAssignment: (assignment: object, slidesPdfPath: string | null): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveAssignment', assignment, slidesPdfPath),

  readFileAsBuffer: (filePath: string): Promise<Uint8Array | null> =>
    ipcRenderer.invoke('file:readAsBuffer', filePath),

  exportSubmission: (payload: {
    assignmentTitle: string
    webmBuffer: Uint8Array | null
    quizResults: object | null
    sessionData: object
  }): Promise<string | null> =>
    ipcRenderer.invoke('desktop:exportSubmission', payload),
})

export type CaptureSource = {
  id: string
  name: string
  thumbnail: string   // data URL
  appIcon: string | null
}
