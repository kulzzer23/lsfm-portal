import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        adminLottery: resolve(__dirname, 'admin-lottery.html'),
        lotteryResults: resolve(__dirname, 'lottery-results.html'),
        lotteryArchive: resolve(__dirname, 'lottery-archive.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
