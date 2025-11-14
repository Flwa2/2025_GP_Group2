// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ✅ one clear API gateway; everything else stays frontend
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,

      },
      proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }

   
    },
  },
})
