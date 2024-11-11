import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __API_PATH__: JSON.stringify("/api"),
  },
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      // proxy requests with the API path to the server
      // <http://localhost:5173/ui/static> -> <http://localhost:3001/ui/static>
      "/ui/static": "http://localhost:3000",
      "/api": "http://localhost:3000",
      "/download": "http://localhost:3000"
    },
  },
  // we use 'optimizeDeps' to support importing a commonjs module using esmodule syntax.
  // see https://stackoverflow.com/questions/74845363/vue3-with-vite-cant-import-commonjs-module
  optimizeDeps: {
    include: ["@cppbrowser/snapshot-tools"],
    force: true
  },
  // build: {
  //   commonjsOptions: {
  //     include: ["@cppbrowser/snapshot-tools"],
  //   },
  // },
})
