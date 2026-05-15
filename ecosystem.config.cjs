module.exports = {
  apps: [
    // ── 로컬 개발 (localhost:3000) ─────────────────────────
    // 사용: pm2 start ecosystem.config.cjs --only meti-local
    {
      name: 'meti-local',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=the-meti-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },

    // ── 스테이징 로컬 미러 (localhost:3001) ───────────────
    // staging D1 DB를 로컬에서 미러링 — 샌드박스 테스트용
    // 사용: pm2 start ecosystem.config.cjs --only meti-staging
    {
      name: 'meti-staging',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=the-meti-staging --local --ip 0.0.0.0 --port 3001',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
