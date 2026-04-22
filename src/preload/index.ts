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

  getScreenRecordingStatus: (): Promise<string> =>
    ipcRenderer.invoke('permissions:getScreenRecordingStatus'),

  openScreenRecordingSettings: (): Promise<void> =>
    ipcRenderer.invoke('system:openScreenRecordingSettings'),

  minimizeWindow: (): void =>
    ipcRenderer.send('window:minimize'),
})

export type CaptureSource = {
  id: string
  name: string
  thumbnail: string   // data URL
  appIcon: string | null
}
