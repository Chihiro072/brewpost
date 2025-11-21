import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine backend URL based on environment
  const isDevelopment = mode === 'development';
  // In production, use VITE_API_BASE_URL from .env.production
  // In development, use localhost:5044
  const backendTarget = isDevelopment 
    ? 'http://localhost:5044' 
    : (process.env.VITE_API_BASE_URL || 'http://98.93.201.217:5044');

  return {
    server: {
      host: 'localhost',
      port: 3000,
      strictPort: true, // Do not auto-switch; fail if 3000 is taken
      proxy: {
        '/generate': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/generate/, '/api/generate'),
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