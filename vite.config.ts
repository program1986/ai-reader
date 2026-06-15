import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'node:path';

const host = process.env.TAURI_DEV_HOST;

// Vite config tuned for Tauri v2 + SolidJS + iOS
// - 1420 = default Tauri dev port
// - HMR over LAN when TAURI_DEV_HOST is set
// - clearScreen disabled to keep Tauri errors visible
export default defineConfig({
  plugins: [solid()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // foliate-js/pdf.js 用了非标准路径 '@pdfjs/pdf.min.mjs',
      // 重定向到 pdfjs-dist 的实际文件。EPUB 走 EPUB 分支不真加载 PDF,
      // 这个 alias 只是满足 vite 静态解析。
      '@pdfjs/pdf.min.mjs': resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.min.mjs'),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '**/vendor/**'],
    },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: ['es2022', 'ios15'],
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  optimizeDeps: {
    // foliate-js 内部用了 process.env,需要预构建时静态替换
    include: ['foliate-js/view', 'foliate-js/annotation', 'foliate-js/footnote'],
  },
});
