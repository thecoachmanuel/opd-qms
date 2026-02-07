import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile';
  
  return {
    plugins: [
      react(), 
      isMobile ? basicSsl() : null
    ].filter(Boolean),
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'framer-motion'],
            network: ['@supabase/supabase-js'],
            charts: ['recharts'],
            pdf: ['jspdf', 'jspdf-autotable', 'html2canvas']
          }
        }
      }
    },
    server: {
      host: isMobile, // Only expose to network in mobile mode
      port: isMobile ? 5174 : 5173, // Use 5174 for mobile to avoid conflict
    }
  }
})
