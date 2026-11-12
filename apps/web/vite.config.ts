import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the local Hono Worker so the browser stays
      // same-origin during development.
      //
      // NOTE: /m is deliberately NOT proxied - that path is a client-side
      // SPA route that renders the public menu. The frontend fetches the
      // published snapshot JSON directly from the API origin.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // transformers.js ships its own WASM binaries; exclude it from the
    // dependency pre-bundle so the ONNX runtime is only fetched on demand.
    exclude: ['@huggingface/transformers'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep the ONNX runtime out of the main bundle. It is only needed
          // when the owner explicitly asks for background removal.
          if (id.includes('@huggingface/transformers') || id.includes('onnxruntime')) {
            return 'transformers'
          }
          if (id.includes('node_modules/three')) {
            return 'three'
          }
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
})
