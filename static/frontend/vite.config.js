import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // map the backend routes you call from the frontend
      '/create': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/edit': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/generate_audio': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/wait': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
