import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine backend URL based on environment
  const isDevelopment = mode === 'development';
  const backendTarget = isDevelopment 
    ? 'http://localhost:8081' 
    : 'https://brewpost.duckdns.org';

  return {
    server: {
      host: '::',
      port: 8080,
      proxy: {
        '/generate': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path, // keep path /generate
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: 'dist', // Explicitly set output directory for Amplify
      sourcemap: false,
    },
  };
});