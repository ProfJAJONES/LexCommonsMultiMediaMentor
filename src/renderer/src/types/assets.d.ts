// Wildcard module declarations for non-TS imports.
// This file has no imports/exports so the declarations stay ambient.

declare module '*.css'
declare module '*.svg' {
  const content: string
  export default content
}
declare module '*.png' {
  const content: string
  export default content
}
declare module '*.webp' {
  const content: string
  export default content
}
declare module '*.jpg' {
  const content: string
  export default content
}
declare module '*.jpeg' {
  const content: string
  export default content
}

// Vite's ?url import suffix returns a string URL for any asset.
declare module '*?url' {
  const url: string
  export default url
}

// mammoth ships no TS types; we only use mammoth.extractRawText.
declare module 'mammoth' {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>
}
