import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// On GitHub Pages the site lives under /<repo name>/. Take the name from the
// Actions environment so renaming the repo can't break the deployed paths.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'M5-WholeHealth'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? `/${repoName}/` : '/',
  plugins: [react()],
  test: {
    setupFiles: ['./src/test/setup.js'],
  },
})
