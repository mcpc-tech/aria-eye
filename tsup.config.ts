import { defineConfig } from 'tsup'
import path from 'path'

export default defineConfig([
  // Main library build
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    clean: false, // Don't clean to preserve injected files
    sourcemap: true,
    external: ['esbuild'],
    outDir: 'dist'
  },
  // Browser injected scripts build
  {
    entry: ['src/injected/a11y.ts'],
    format: ['iife'],
    globalName: '_a11y',
    outDir: 'dist/injected',
    splitting: false,
    minify: true,
    platform: 'browser',
    clean: false, // Don't clean to preserve other files
    outExtension() {
      return {
        js: '.js'
      }
    },
    // Include path mappings for isomorphic modules
    esbuildOptions(options) {
      options.alias = {
        '@isomorphic': path.resolve(process.cwd(), 'src/utils/isomorphic')
      }
    }
  }
])
