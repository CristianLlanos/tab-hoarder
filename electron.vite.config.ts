import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default {
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: 'src/main/index.ts'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: 'src/preload/index.ts'
      }
    }
  },
  renderer: {
    server: {
      port: 5201,
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    }
  }
}
