import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/generate/index.ts',
      'src/validate/index.ts',
      'src/render/index.ts',
    ],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2020',
    clean: true,
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    globalName: 'PromptPayParse',
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
])
