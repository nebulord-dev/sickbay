import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
  ],
  server: {
    port: 3030,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate React and vendor code
          react: ['react', 'react-dom'],
          // Heavy visualization libs (only loaded when viewing dependency graph)
          'graph-viz': ['@xyflow/react', 'dagre'],
          // Heavy markdown/syntax libs (only loaded when using AI chat)
          markdown: ['react-markdown', 'react-syntax-highlighter'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
