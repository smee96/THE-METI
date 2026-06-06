import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    pages(),
    // 빌드 후 _routes.json을 덮어써서 Worker가 모든 요청 처리
    // (ASSETS.fetch를 통해 정적 파일 서빙)
    {
      name: 'override-routes-json',
      closeBundle() {
        const routesPath = resolve(__dirname, 'dist/_routes.json')
        const routes = {
          version: 1,
          include: ['/*'],
          exclude: [],
        }
        writeFileSync(routesPath, JSON.stringify(routes))
        console.log('[override-routes-json] _routes.json overridden: exclude=[]')
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: []
    }
  }
})
