import { defineConfig } from 'vite';
import baseConfig from '../vite.config';

// Build this isolated fixture and serve it with `vite preview --config ...`.
// Unlike Vite's dev client (even with hmr:false), the built page has no
// reconnect-triggered reload. Rebuild and manually reload after source edits.
export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    // This development fixture uses top-level await for save isolation.
    // The normal game's production browser target remains unchanged.
    target: 'es2022',
    outDir: 'build/verification',
    rollupOptions: { input: 'tests/loading-recovery.html' },
  },
  preview: {
    host: '127.0.0.1',
    port: 5198,
    strictPort: true,
    open: false,
  },
});
