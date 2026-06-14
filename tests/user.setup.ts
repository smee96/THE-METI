import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const authFile = path.join(__dirname, '.auth/user.json')

setup('user login', async ({ page }) => {
  await page.goto('/app/login')

  await page.evaluate(() => {
    localStorage.removeItem('meti_token')
    localStorage.removeItem('meti_user')
  })
  await page.reload()

  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 })

  await page.fill('#email',    process.env.TEST_USER_EMAIL    || 'test@meti.dev')
  await page.fill('#password', process.env.TEST_USER_PASSWORD || 'MetiTest1234!')

  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth/login') && resp.status() === 200,
      { timeout: 30000 }
    ),
    page.click('button[type="submit"]'),
  ])

  // 로그인 후 SPA shell 로드 확인 (대시보드로 이동)
  await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })

  await page.context().storageState({ path: authFile })
})
