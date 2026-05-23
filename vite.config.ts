import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: served from https://nama1223.github.io/NamaComp/ (build only).
// Dev serves from '/' so local preview/tooling hits the app at the server root.
// Build output goes to docs/ (committed) so a plain push deploys.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/NamaComp/' : '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
}))
