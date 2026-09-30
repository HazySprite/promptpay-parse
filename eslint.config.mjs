import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  globalIgnores(['dist/', 'coverage/']),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
)
