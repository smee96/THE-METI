import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const authFile = path.join(__dirname, '.auth/pro.json')

setup('pro user login', async ({ page }) => {
  await page.goto('/login')

  await page.evaluate(() => {
    localStorage.removeItem('meti_token')
    localStorage.removeItem('meti_user')
    localStorage.removeItem('meti_refresh_token')
  })
  await page.reload()

  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 })

  await page.fill('#email', process.env.TEST_PRO_EMAIL    || 'pro@meti.dev')
  await page.fill('#pw',    process.env.TEST_PRO_PASSWORD || 'MetiTest1234!')

  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth/login') && resp.status() === 200,
      { timeout: 30000 }
    ),
    page.click('#btn'),
  ])

  await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })

  // 로그인된 유저가 실제로 pro 플랜인지 확인
  const plan = await page.evaluate(() => {
    const u = JSON.parse(localStorage.getItem('meti_user') || '{}')
    return u.plan
  })
  if (plan !== 'pro') throw new Error(`pro 플랜 계정이 아닙니다 (현재: ${plan})`)

  await page.context().storageState({ path: authFile })
})
