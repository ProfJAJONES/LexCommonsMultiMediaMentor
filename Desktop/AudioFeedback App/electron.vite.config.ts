import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron', 'fluent-ffmpeg']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      // Stub optional TF/MediaPipe backends that MoveNet+WebGL doesn't need
      {
        name: 'stub-optional-tf-backends',
        resolveId(id: string) {
          const stubs = ['@mediapipe/pose','@mediapipe/face_detection','@mediapipe/face_mesh','@mediapipe/hands','@tensorflow/tfjs-backend-webgpu']
          if (stubs.includes(id)) return '\0stub:' + id
          return null
        },
        load(id: string) {
          if (id.startsWith('\0stub:')) {
            // Export a proxy that returns undefined for any named export access
            return `
              const handler = { get: () => undefined }
              const proxy = new Proxy({}, handler)
              export default proxy
              export const Pose = undefined
              export const webgpu_util = proxy
              export const WebGPUBackend = undefined
            `
          }
          return null
        }
      }
    ],
    optimizeDeps: {
      exclude: ['@xenova/transformers']
    }
  }
})
