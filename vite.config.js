import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
optimizeDeps: {
  include: ['xlsx']
}
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
