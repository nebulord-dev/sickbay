import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  server: {
    port: 3030,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
          if (id.includes('@xyflow/react') || id.includes('dagre')) return 'graph-viz';
          if (id.includes('react-markdown') || id.includes('react-syntax-highlighter')) return 'markdown';
        },
      },
    },
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
});
