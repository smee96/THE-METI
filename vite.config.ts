import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    pages(),
    // 빌드 후 _routes.json을 덮어써서 /static/* 은 Pages가 정적 자산으로 직접 서빙,
    // 그 외 모든 요청은 Worker가 처리.
    // (브랜드 에셋 등 바이너리 정적 파일을 Worker 인라인 없이 서빙하기 위함)
    {
      name: 'override-routes-json',
      closeBundle() {
        const routesPath = resolve(__dirname, 'dist/_routes.json')
        const routes = {
          version: 1,
          include: ['/*'],
          exclude: ['/static/*'],
        }
        writeFileSync(routesPath, JSON.stringify(routes))
        console.log('[override-routes-json] _routes.json overridden: exclude=[/static/*]')
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
