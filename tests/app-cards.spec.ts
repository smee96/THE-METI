/**
 * 명함(Cards) E2E 테스트
 * - chromium-user project: tests/.auth/user.json (test@meti.dev)
 * - baseURL: staging.the-meti.pages.dev (CI) | localhost:3000 (local)
 */
import { test, expect } from '@playwright/test'

test.describe('명함 관리', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })
  })

  // ─────────────────────────────────────────────
  // C-1. 섹션 이동 + API 호출
  // ─────────────────────────────────────────────
  test('C-1 명함 섹션 이동 — /api/v1/cards 호출 및 목록 렌더링', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    await expect(page.locator('#page-title')).toHaveText('내 명함', { timeout: 5000 })
    await expect(page.locator('#section-cards')).toHaveClass(/active/, { timeout: 5000 })

    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
  })

  // ─────────────────────────────────────────────
  // C-2. 명함 목록 상태별 렌더링
  // ─────────────────────────────────────────────
  test('C-2 명함 목록 — 있으면 카드, 없으면 빈 상태 메시지', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    const body = await resp.json()
    const cards = body.data?.cards ?? body.data ?? []
    const el = page.locator('#cards-list')

    if (Array.isArray(cards) && cards.length > 0) {
      await expect(el).toContainText(cards[0].name, { timeout: 8000 })
    } else {
      await expect(el).toContainText('명함이 없습니다', { timeout: 8000 })
    }
  })

  // ─────────────────────────────────────────────
  // C-3. "명함 추가" 버튼 → 모달 열림
  // ─────────────────────────────────────────────
  test('C-3 "명함 추가" 버튼 → 생성 모달 열림', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    await page.click('button:has-text("명함 추가")')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // C-4. X 버튼으로 모달 닫기
  // ─────────────────────────────────────────────
  test('C-4 생성 모달 — X 버튼으로 닫기', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    await page.click('button:has-text("명함 추가")')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })
    await page.locator('#modal-create-card button[onclick*="closeModal"]').click()
    await expect(page.locator('#modal-create-card')).toBeHidden({ timeout: 3000 })
  })

  // ─────────────────────────────────────────────
  // C-5. 필수 필드(이름) 미입력 → 폼 제출 차단
  // ─────────────────────────────────────────────
  test('C-5 명함 이름 미입력 시 폼 제출 차단 (required 검증)', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    await page.click('button:has-text("명함 추가")')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })

    // 이름 없이 제출 → required 속성으로 브라우저 차단
    await page.click('#create-card-form button[type="submit"]')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 2000 })
  })

  // ─────────────────────────────────────────────
  // C-6. 명함 생성 — 201 응답, 목록 갱신, 공개 배지 확인
  // (free 플랜 카드 한도 3개 고려: 한도 초과 시 기존 목록 배지 검증으로 대체)
  // ─────────────────────────────────────────────
  test('C-6 명함 생성 — 201 응답, 목록 반영, 공개 배지 표시', async ({ page }) => {
    const [listResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    // 현재 카드 수 확인 — free 플랜 최대 3개
    const listBody = await listResp.json()
    const existing: Record<string, unknown>[] = listBody.data?.cards
      ?? (Array.isArray(listBody.data) ? listBody.data : [])

    if (existing.length >= 3) {
      // 한도 도달: 기존 공개 명함의 배지만 검증
      if (existing.some(c => c.is_public === 1 || c.is_public === true)) {
        await expect(page.locator('#cards-list')).toContainText('공개', { timeout: 8000 })
      }
      return
    }

    await page.click('button:has-text("명함 추가")')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })

    // #card-public 은 HTML 기본값 checked → 공개 명함으로 생성됨
    const cardName = `E2E명함_${Date.now()}`
    await page.fill('#card-name',    cardName)
    await page.fill('#card-title',   'QA Engineer')
    await page.fill('#card-company', 'METI Lab')
    await page.fill('#card-email',   'qa@meti.dev')

    const [postResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15000 }
      ),
      page.click('#create-card-form button[type="submit"]'),
    ])

    const postBody = await postResp.json()
    expect(postBody.success).toBe(true)

    // 모달 닫힘 + 목록에 새 명함 + "공개" 배지 표시
    await expect(page.locator('#modal-create-card')).toBeHidden({ timeout: 5000 })
    const cardRow = page.locator('#cards-list').locator('.item-card', { hasText: cardName })
    await expect(cardRow).toContainText(cardName, { timeout: 10000 })
    await expect(cardRow).toContainText('공개', { timeout: 5000 })
  })
})
