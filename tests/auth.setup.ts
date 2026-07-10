import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM 환경에서 __dirname 대체 ("type":"module" 프로젝트 필수)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const authFile = path.join(__dirname, '.auth/admin.json')

setup('admin login', async ({ page }) => {
  // ELID 리브랜딩 이후 어드민도 통합 로그인 페이지(/login)에서 로그인.
  // 어드민 계정으로 로그인하면 앱이 자동으로 /admin/dashboard 로 이동시킨다.
  await page.goto('/login')

  // localStorage 강제 클리어 → 로그인 폼 노출 보장
  // (통합 토큰 키: meti_token / meti_user / meti_refresh_token)
  await page.evaluate(() => {
    localStorage.removeItem('meti_token')
    localStorage.removeItem('meti_user')
    localStorage.removeItem('meti_refresh_token')
  })
  await page.reload()

  // 로그인 폼 대기
  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 })

  // 이메일/비밀번호 입력 (#pw: 신규 비밀번호 셀렉터)
  await page.fill('#email', process.env.TEST_ADMIN_EMAIL    || 'admin@meti.dev')
  await page.fill('#pw',    process.env.TEST_ADMIN_PASSWORD || 'Admin1234!')

  // 클릭과 API 응답을 동시에 대기 (타임아웃 방지)
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth/login') && resp.status() === 200,
      { timeout: 30000 }
    ),
    page.click('#btn'),
  ])

  // 로그인 성공 → 어드민 대시보드 사이드바 확인
  await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

  // storageState 저장 → 이후 모든 테스트에서 재사용
  await page.context().storageState({ path: authFile })
})
