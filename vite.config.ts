import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { wasp } from 'wasp/client/vite'

export default defineConfig({
  plugins: [wasp(), tailwindcss()],
  server: {
    host: "100.123.26.95",
    port: 5173,
    strictPort: true,
    open: false,
  },
})
