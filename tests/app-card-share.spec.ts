/**
 * 명함 공유하기 E2E
 * - chromium-user project: tests/.auth/user.json (test@meti.dev)
 * - 검증: 리스트 "링크 복사" 버튼 → 토스트, 공개 명함 미리보기 "공개 링크" 노출,
 *         공개 타깃(/card/:id, /api/v1/cards/public/:id) 실제 접근
 */
import { test, expect, type Page } from '@playwright/test'

// 클립보드 복사(navigator.clipboard) 허용
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

// 명함 섹션 이동 + /cards 응답에서 카드 목록 반환
async function gotoCardsAndList(page: Page): Promise<Record<string, any>[]> {
  const [resp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/v1/cards') && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 15000 }
    ),
    page.click('button[data-section="cards"]'),
  ])
  const body = await resp.json()
  return body.data?.cards ?? (Array.isArray(body.data) ? body.data : [])
}

// 공개 명함 1개 보장 — 없고 한도(free 3개) 미달이면 생성, 한도면 null
async function ensurePublicCard(page: Page, cards: Record<string, any>[]): Promise<Record<string, any> | null> {
  const pub = cards.find(c => c.is_public === 1 || c.is_public === true)
  if (pub) return pub
  if (cards.length >= 3) return null // 한도 도달 + 공개 없음 → 생성 불가

  await page.click('button:has-text("명함 추가")')
  await expect(page.locator('#modal-create-card')).toBeVisible({ timeout: 5000 })
  const name = `공유E2E_${Date.now()}`
  await page.fill('#card-name', name)
  await page.fill('#card-title', 'Share QA')
  // #card-public 기본 checked → 공개로 생성
  const [postResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/v1/cards') && r.request().method() === 'POST' && r.status() === 201,
      { timeout: 15000 }
    ),
    page.click('#create-card-form button[type="submit"]'),
  ])
  const created = (await postResp.json()).data
  await expect(page.locator('#modal-create-card')).toBeHidden({ timeout: 5000 })
  return created ?? { id: undefined, name, is_public: 1 }
}

test.describe('명함 공유', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })
  })

  // ─────────────────────────────────────────────
  // S-1. 카드 리스트의 "링크 복사" 버튼 → 토스트
  // ─────────────────────────────────────────────
  test('S-1 명함 "링크 복사" 버튼 클릭 → 복사 토스트 표시', async ({ page }) => {
    const cards = await gotoCardsAndList(page)
    if (cards.length === 0) {
      await ensurePublicCard(page, cards)         // 카드 0개면 하나 생성
      await gotoCardsAndList(page)
    }
    const copyBtn = page.locator('#cards-list button[title="링크 복사"]').first()
    await expect(copyBtn).toBeVisible({ timeout: 8000 })
    await copyBtn.click()
    // showToast('링크가 복사되었습니다!')
    await expect(page.locator('body')).toContainText('링크가 복사되었습니다', { timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // S-2. 공개 명함 미리보기 → "공개 링크" 섹션 + /card/:id URL
  // ─────────────────────────────────────────────
  test('S-2 공개 명함 미리보기 → 공개 링크 노출 (/card/:id)', async ({ page }) => {
    const cards = await gotoCardsAndList(page)
    const pub = await ensurePublicCard(page, cards)
    if (!pub) test.skip(true, 'free 한도 + 공개 명함 없음 → 생성 불가')

    // 공개 명함 카드 클릭 → 미리보기 모달 (이름으로 특정)
    const row = page.locator('#cards-list .item-card', { hasText: String(pub!.name) }).first()
    await row.click()
    await expect(page.locator('#modal-card-preview')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#card-preview-body')).toContainText('공개 링크', { timeout: 8000 })

    // 공개 링크 input 값이 /card/{id} 포함
    const linkInput = page.locator('#card-preview-body input[readonly]')
    await expect(linkInput).toHaveValue(/\/card\/\d+/, { timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // S-3. 공개 명함 타깃 — public API 200 + 공유 페이지 접근
  // ─────────────────────────────────────────────
  test('S-3 공개 명함 공유 타깃(/api/v1/cards/public/:id) 200 + 데이터', async ({ page, request }) => {
    const cards = await gotoCardsAndList(page)
    const pub = await ensurePublicCard(page, cards)
    if (!pub || !pub.id) test.skip(true, '공개 명함 id 확보 불가')

    // 공개 명함 상세 API (비인증으로도 접근 가능해야 공유가 성립)
    const resp = await request.get(`/api/v1/cards/public/${pub!.id}`)
    expect(resp.status(), `public 명함 ${pub!.id} 조회`).toBe(200)
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data?.id).toBeDefined()
    expect(body.data?.is_public === 1 || body.data?.is_public === true).toBe(true)
  })
})
