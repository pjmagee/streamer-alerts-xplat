import { defineConfig } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  publicDir: false, // We'll handle copying manually
  define: {
    // Define a constant that can be used to determine asset paths
    __STATIC__: '""'
  },
  build: {
    rollupOptions: {            
      output: {
        // Handle dynamic imports properly
        manualChunks: undefined
      }
    }
  },
  plugins: [
    {
      name: 'copy-assets',
      buildStart() {
        
      },
      generateBundle() {
        // Copy images directory to build output
        const imagesSource = path.resolve(__dirname, 'images');
        const imagesDest = path.resolve(__dirname, '.vite/images');
        
        if (fs.existsSync(imagesSource)) {
          // Create destination directory if it doesn't exist
          if (!fs.existsSync(path.dirname(imagesDest))) {
            fs.mkdirSync(path.dirname(imagesDest), { recursive: true });
          }
          if (!fs.existsSync(imagesDest)) {
            fs.mkdirSync(imagesDest, { recursive: true });
          }
          
          // Copy all files from images to .vite/images
          const files = fs.readdirSync(imagesSource);
          files.forEach((file: string) => {
            const sourceFile = path.join(imagesSource, file);
            const destFile = path.join(imagesDest, file);
            fs.copyFileSync(sourceFile, destFile);
          });
        }
      }
    }
  ]
});
