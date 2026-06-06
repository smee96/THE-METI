/**
 * 테스트 시나리오 #1: 어드민 대시보드 기본 UI
 *
 * 검증 항목:
 *   1. /admin/ 접속 시 storageState 재사용으로 자동 로그인 유지
 *   2. 사이드바(#sidebar) 렌더링 확인
 *   3. 대시보드 API 호출 및 통계 카드 4개 렌더링
 *   4. 사이드바 nav 메뉴 8개 항목 존재 확인
 *   5. 페이지 제목(#page-title)이 "대시보드"로 표시
 *   6. 유저 관리 메뉴 클릭 → URL 해시 변경 + 페이지 제목 변경
 *   7. 그룹 관리 메뉴 클릭 → URL 해시 변경 + 페이지 제목 변경
 *   8. 대시보드로 돌아오기
 */

import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────
// 헬퍼: API 응답 대기 + 콘텐츠 렌더링 대기
// ─────────────────────────────────────────────
async function waitForSection(page: any, apiPath: string, labelText: string) {
  await Promise.all([
    page.waitForResponse(
      (resp: any) => resp.url().includes(apiPath) && resp.status() === 200,
      { timeout: 15000 }
    ),
    page.waitForSelector(`#page-content:has-text("${labelText}")`, { timeout: 15000 }),
  ])
}

// ─────────────────────────────────────────────
// 1. 대시보드 기본 로드
// ─────────────────────────────────────────────
test.describe('어드민 대시보드', () => {

  test('1-1 페이지 접속 시 사이드바가 보인다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })
  })

  test('1-2 대시보드 API 호출 후 통계 카드 4개가 렌더링된다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    // 대시보드 API 응답 대기
    await page.waitForResponse(
      resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
      { timeout: 15000 }
    )

    // 통계 카드 텍스트 4개 확인 (label 텍스트 기반)
    await expect(page.locator('#page-content')).toContainText('총 유저', { timeout: 10000 })
    await expect(page.locator('#page-content')).toContainText('활성 그룹')
    await expect(page.locator('#page-content')).toContainText('예정 행사')
    await expect(page.locator('#page-content')).toContainText('미처리 신고')
  })

  test('1-3 페이지 제목이 "대시보드"로 표시된다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#page-title')).toHaveText('대시보드', { timeout: 10000 })
  })

  test('1-4 플랜 분포 섹션이 렌더링된다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    await page.waitForResponse(
      resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
      { timeout: 15000 }
    )

    await expect(page.locator('#page-content')).toContainText('플랜 분포', { timeout: 10000 })
    await expect(page.locator('#page-content')).toContainText('빠른 실행')
  })

})

// ─────────────────────────────────────────────
// 2. 사이드바 nav 메뉴 항목
// ─────────────────────────────────────────────
test.describe('사이드바 메뉴', () => {

  test('2-1 사이드바에 필수 nav 버튼 8개가 존재한다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    const menus = [
      { id: 'nav-dashboard',    label: '대시보드' },
      { id: 'nav-users',        label: '유저 관리' },
      { id: 'nav-groups',       label: '그룹 관리' },
      { id: 'nav-events',       label: '행사 관리' },
      { id: 'nav-lessons',      label: '레슨 관리' },
      { id: 'nav-reports',      label: '신고 관리' },
      { id: 'nav-nfc-cards',    label: 'NFC 카드' },
      { id: 'nav-plan-configs', label: '플랜 설정' },
    ]

    for (const menu of menus) {
      await expect(page.locator(`#${menu.id}`)).toBeVisible({ timeout: 5000 })
      await expect(page.locator(`#${menu.id}`)).toContainText(menu.label)
    }
  })

  test('2-2 유저 관리 클릭 → 해시 변경 + 페이지 제목 변경', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    // 대시보드 초기 로드 완료 대기
    await page.waitForResponse(
      resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
      { timeout: 15000 }
    )

    // 유저 관리 클릭
    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/admin/users') && resp.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#nav-users').click(),
    ])

    await expect(page).toHaveURL(/#users/, { timeout: 5000 })
    await expect(page.locator('#page-title')).toHaveText('유저 관리', { timeout: 5000 })
    await expect(page.locator('#page-content')).toContainText('검색', { timeout: 10000 })
  })

  test('2-3 그룹 관리 클릭 → 해시 변경 + 페이지 제목 변경', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    await page.waitForResponse(
      resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
      { timeout: 15000 }
    )

    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/admin/groups') && resp.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#nav-groups').click(),
    ])

    await expect(page).toHaveURL(/#groups/, { timeout: 5000 })
    await expect(page.locator('#page-title')).toHaveText('그룹 관리', { timeout: 5000 })
  })

  test('2-4 대시보드 메뉴 클릭 → 대시보드로 복귀', async ({ page }) => {
    // 유저 관리 → 대시보드 복귀
    await page.goto('/admin/#users')
    await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15000 })

    // users 섹션 로드 대기
    await page.waitForResponse(
      resp => resp.url().includes('/admin/users') && resp.status() === 200,
      { timeout: 15000 }
    )

    // 대시보드 클릭
    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#nav-dashboard').click(),
    ])

    await expect(page).toHaveURL(/#dashboard/, { timeout: 5000 })
    await expect(page.locator('#page-title')).toHaveText('대시보드', { timeout: 5000 })
    await expect(page.locator('#page-content')).toContainText('총 유저', { timeout: 10000 })
  })

})

// ─────────────────────────────────────────────
// 3. 대시보드 API 응답 구조 검증
// ─────────────────────────────────────────────
test.describe('대시보드 API', () => {

  test('3-1 /admin/dashboard 응답에 필수 필드가 있다', async ({ page }) => {
    await page.goto('/admin/')

    const response = await page.waitForResponse(
      resp => resp.url().includes('/admin/dashboard') && resp.status() === 200,
      { timeout: 15000 }
    )

    const body = await response.json()

    // success 필드
    expect(body.success).toBe(true)

    // data 필드 존재
    expect(body.data).toBeDefined()

    // 핵심 통계 키 존재 확인
    expect(body.data.users).toBeDefined()
    expect(body.data.groups).toBeDefined()
    expect(body.data.events).toBeDefined()
    expect(body.data.reports).toBeDefined()

    // users 하위 필드
    expect(typeof body.data.users.total).toBe('number')
    expect(typeof body.data.users.today).toBe('number')
  })

  test('3-2 비인증 상태에서 /api/v1/admin/dashboard 접근 시 401', async ({ browser }) => {
    // storageState 없는 새 컨텍스트 (비인증)
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // /admin/dashboard는 SPA catch-all이므로 HTML 200 반환
    // 실제 API는 /api/v1/admin/dashboard (axios baseURL = /api/v1)
    const response = await page.request.get('/api/v1/admin/dashboard')
    expect([401, 403]).toContain(response.status())

    await ctx.close()
  })

})
