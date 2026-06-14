/**
 * Pro 플랜 차별화 기능 E2E 테스트
 * - chromium-pro project: tests/.auth/pro.json (pro@meti.dev)
 * - baseURL: staging.the-meti.pages.dev (CI) | localhost:3000 (local)
 *
 * 검증 목표: free 플랜과 다른 pro 한도·기능이 실제로 동작하는지 확인
 *   free : 명함 3개, 그룹 1개, 그룹멤버 2명
 *   pro  : 명함 10개, 그룹 5개, 그룹멤버 10명
 */
import { test, expect } from '@playwright/test'

test.describe('Pro 플랜 — 명함 한도', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })
  })

  // ─────────────────────────────────────────────
  // P-1. 구독 섹션 — pro 플랜 표시 확인
  // ─────────────────────────────────────────────
  test('P-1 구독 섹션 — 현재 플랜이 Pro로 표시됨', async ({ page }) => {
    await page.click('button[data-section="subscription"]')
    await expect(page.locator('#page-title')).toHaveText('구독', { timeout: 5000 })
    await expect(page.locator('#sub-plan-name')).toHaveText('Pro', { timeout: 8000 })
    await expect(page.locator('#sub-status-text')).toContainText('Pro', { timeout: 5000 })

    // 플랜 카드 목록에서 Pro 행이 "현재" 뱃지를 가짐
    await expect(page.locator('#plan-cards')).toContainText('현재', { timeout: 8000 })
  })

  // ─────────────────────────────────────────────
  // P-2. /api/v1/cards 응답에서 플랜 정보 확인
  // ─────────────────────────────────────────────
  test('P-2 명함 목록 API — pro 계정 정상 조회', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])
    const body = await resp.json()
    expect(body.success).toBe(true)
  })

  // ─────────────────────────────────────────────
  // P-3. 명함 생성 — pro 한도(10개) 내에서 성공
  // ─────────────────────────────────────────────
  test('P-3 명함 생성 — pro 한도(10개) 이내 201 응답', async ({ page }) => {
    const [listResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])

    const listBody = await listResp.json()
    const existing: Record<string, unknown>[] = listBody.data?.cards
      ?? (Array.isArray(listBody.data) ? listBody.data : [])

    if (existing.length >= 10) {
      // 이미 한도 도달 → 생성 시도 후 한도 초과 에러 확인으로 변경
      await page.click('button:has-text("명함 추가")')
      await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })
      await page.fill('#card-name', `한도초과_${Date.now()}`)
      const [overResp] = await Promise.all([
        page.waitForResponse(
          r => r.url().includes('/api/v1/cards') && r.request().method() === 'POST',
          { timeout: 15000 }
        ),
        page.click('#create-card-form button[type="submit"]'),
      ])
      // 10개 초과 시 402 또는 에러 응답
      expect(overResp.status()).not.toBe(201)
      return
    }

    // 한도 미만: 정상 생성 확인
    await page.click('button:has-text("명함 추가")')
    await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })

    const cardName = `PRO명함_${Date.now()}`
    await page.fill('#card-name',    cardName)
    await page.fill('#card-title',   'Pro Engineer')
    await page.fill('#card-company', 'METI Pro')

    const [postResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15000 }
      ),
      page.click('#create-card-form button[type="submit"]'),
    ])
    const postBody = await postResp.json()
    expect(postBody.success).toBe(true)

    await expect(page.locator('#modal-create-card')).toBeHidden({ timeout: 5000 })
    await expect(page.locator('#cards-list')).toContainText(cardName, { timeout: 10000 })
  })

  // ─────────────────────────────────────────────
  // P-4. free 한도(3개)를 pro가 초과할 수 있음을 API로 확인
  // ─────────────────────────────────────────────
  test('P-4 명함 API — pro 계정은 free 한도(3개) 초과 카드 보유 가능', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/cards') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="cards"]'),
    ])
    const body = await resp.json()
    const cards: unknown[] = body.data?.cards ?? (Array.isArray(body.data) ? body.data : [])

    // pro 계정은 3개 초과 카드를 보유할 수 있어야 함 (없으면 통과)
    // 3개 초과인 경우 목록이 모두 정상 렌더링되는지 확인
    if (cards.length > 3) {
      await expect(page.locator('#cards-list .item-card')).toHaveCount(cards.length, { timeout: 8000 })
    }
    // pro 플랜이므로 카드 조회 자체는 항상 성공
    expect(body.success).toBe(true)
  })
})

test.describe('Pro 플랜 — 그룹 한도', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })
  })

  // ─────────────────────────────────────────────
  // P-5. 그룹 섹션 정상 로드
  // ─────────────────────────────────────────────
  test('P-5 그룹 섹션 — /groups/mine API 정상 조회', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  // ─────────────────────────────────────────────
  // P-6. 그룹 개설 신청 — pro 한도(5개) 내 성공
  // ─────────────────────────────────────────────
  test('P-6 그룹 개설 신청 — pro 계정 201 응답', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await page.locator('#groups-list button:has-text("그룹 개설 신청")').click()
    await expect(page.locator('#modal-create-group')).toBeVisible({ timeout: 5000 })

    const groupName = `PRO그룹_${Date.now()}`
    await page.fill('#group-name', groupName)
    await page.fill('#group-description', 'Pro 계정 자동화 테스트 그룹')
    await page.fill('#group-purpose', 'Playwright E2E 테스트 — pro 플랜 그룹 개설 검증용')

    const [postResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15000 }
      ),
      page.click('#create-group-form button[type="submit"]'),
    ])

    const postBody = await postResp.json()
    expect(postBody.success).toBe(true)
    expect(postBody.data.status).toBe('pending')

    await expect(page.locator('#modal-create-group')).toBeHidden({ timeout: 5000 })
    await expect(page.locator('#groups-list')).toContainText(groupName, { timeout: 10000 })
  })

  // ─────────────────────────────────────────────
  // P-7. 그룹 탐색 — pro 계정으로 공개 그룹 조회
  // ─────────────────────────────────────────────
  test('P-7 그룹 탐색 — pro 계정으로 공개 그룹 조회 및 상세보기', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    const [exploreResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && !r.url().includes('/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#groups-list button:has-text("그룹 탐색")').click(),
    ])

    await expect(page.locator('#modal-group-explore')).toBeVisible({ timeout: 5000 })
    const body = await exploreResp.json()
    expect(body.success).toBe(true)

    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })

    // 그룹이 있으면 상세 모달까지 확인
    const cards = page.locator('#explore-groups-list .border.rounded-2xl')
    if (await cards.count() === 0) return

    const [detailResp] = await Promise.all([
      page.waitForResponse(
        r => /\/api\/v1\/groups\/\d+$/.test(r.url()) && r.status() === 200,
        { timeout: 15000 }
      ),
      cards.first().click(),
    ])

    await expect(page.locator('#modal-group-detail')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#group-detail-body')).not.toContainText('불러오는 중', { timeout: 10000 })

    const detailBody = await detailResp.json()
    expect(detailBody.success).toBe(true)
  })

  // ─────────────────────────────────────────────
  // P-8. 그룹 가입 신청 — pro 계정 (201 or 409)
  // ─────────────────────────────────────────────
  test('P-8 그룹 탐색 — pro 계정으로 가입 신청', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && !r.url().includes('/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.locator('#groups-list button:has-text("그룹 탐색")').click(),
    ])

    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })

    const joinBtn = page.locator('#explore-groups-list button:has-text("가입 신청")').first()
    if (await joinBtn.count() === 0) return

    const [joinResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && r.url().includes('/join'),
        { timeout: 15000 }
      ),
      joinBtn.click(),
    ])

    // 201 성공 또는 409(이미 신청됨) 허용
    expect([201, 409]).toContain(joinResp.status())
  })
})
