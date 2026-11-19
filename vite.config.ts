import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // onnxruntime-web references its 25.6 MiB WebGPU (asyncify) wasm internally. It is never
      // loaded (WebGPU is disabled) and exceeds Cloudflare's 25 MiB per-asset limit, so drop it.
      name: 'drop-ort-asyncify-wasm',
      generateBundle(_o, bundle) {
        for (const name of Object.keys(bundle)) {
          if (/ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(name)) delete bundle[name]
        }
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // WASM codecs resolve their .wasm files with import.meta.url, so they must not be pre-bundled.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/oxipng'],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs'
          if (id.includes('pdf-lib')) return 'vendor-pdflib'
          if (id.includes('@huggingface') || id.includes('onnxruntime')) return 'vendor-ml'
          if (id.includes('svgo')) return 'vendor-svgo'
          if (id.includes('jszip')) return 'vendor-zip'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('zustand') || id.includes('scheduler')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
