import { defineConfig, devices } from '@playwright/test'

/**
 * BASE_URL 우선순위:
 *   1. 환경변수 BASE_URL → GitHub Actions preview workflow에서 주입
 *   2. 기본값 localhost:3000
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // 로그인 세션 의존성이 있으므로 직렬 실행
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // storageState는 global에 설정하지 않음
    // → setup project 실행 전 파일 없음 에러 방지
    // → 아래 chromium project에서만 설정
  },

  projects: [
    // ── 어드민: 로그인 셋업
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // ── 어드민: E2E 테스트
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/admin-*.spec.ts',
    },

    // ── 일반 유저: 로그인 셋업
    {
      name: 'user-setup',
      testMatch: '**/user.setup.ts',
    },
    // ── 일반 유저: E2E 테스트
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['user-setup'],
      testMatch: ['**/app-cards.spec.ts', '**/app-groups.spec.ts'],
    },

    // ── Pro 유저: 로그인 셋업
    {
      name: 'pro-setup',
      testMatch: '**/pro.setup.ts',
    },
    // ── Pro 유저: E2E 테스트
    {
      name: 'chromium-pro',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/pro.json',
      },
      dependencies: ['pro-setup'],
      testMatch: '**/app-pro.spec.ts',
    },
  ],

  // 로컬에서만 자동 서버 기동 (CI에서는 preview URL 사용)
  webServer: process.env.CI ? undefined : {
    command: 'npx wrangler pages dev dist --d1=the-meti-production --local --ip 0.0.0.0 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
