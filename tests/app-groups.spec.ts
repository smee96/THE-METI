/**
 * 그룹(Groups) E2E 테스트
 * - chromium-user project: tests/.auth/user.json (test@meti.dev)
 * - baseURL: staging.the-meti.pages.dev (CI) | localhost:3000 (local)
 */
import { test, expect } from '@playwright/test'

test.describe('그룹 관리', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.locator('#sidebar-username')).toBeVisible({ timeout: 15000 })
  })

  // ─────────────────────────────────────────────
  // G-1. 섹션 이동 + /groups/mine API 호출
  // ─────────────────────────────────────────────
  test('G-1 그룹 섹션 이동 — /api/v1/groups/mine 호출 및 렌더링', async ({ page }) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await expect(page.locator('#page-title')).toHaveText('내 그룹', { timeout: 5000 })
    await expect(page.locator('#section-groups')).toHaveClass(/active/, { timeout: 5000 })

    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  // ─────────────────────────────────────────────
  // G-2. 그룹 목록 상태별 렌더링
  // ─────────────────────────────────────────────
  test('G-2 그룹 목록 — 소속 그룹 / 신청 내역 섹션 항상 표시', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    // "소속 그룹" 헤더와 "신청 내역" 헤더가 항상 렌더링되어야 함
    await expect(page.locator('#groups-list')).toContainText('소속 그룹', { timeout: 8000 })
    await expect(page.locator('#groups-list')).toContainText('신청 내역', { timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // G-3. 액션 버튼 — "그룹 탐색" / "그룹 개설 신청" 항상 존재
  // ─────────────────────────────────────────────
  test('G-3 그룹 섹션 — "그룹 탐색" / "그룹 개설 신청" 버튼 표시', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await expect(page.locator('#groups-list button:has-text("그룹 탐색")')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#groups-list button:has-text("그룹 개설 신청")')).toBeVisible({ timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // G-4. "그룹 탐색" → 모달 열림 + 공개 그룹 목록 로드
  // ─────────────────────────────────────────────
  test('G-4 "그룹 탐색" 버튼 → modal-group-explore 열림 + 공개 그룹 조회', async ({ page }) => {
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

    // 로딩 스피너 제거 확인
    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })
    await expect(page.locator('#explore-groups-list')).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // G-5. 그룹 탐색 검색 — q 파라미터 필터링
  // ─────────────────────────────────────────────
  test('G-5 그룹 탐색 검색 — q 파라미터로 재조회', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await page.locator('#groups-list button:has-text("그룹 탐색")').click()
    await expect(page.locator('#modal-group-explore')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })

    // 검색어 입력 → debounce(400ms) 후 재조회
    const [searchResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && r.url().includes('q=') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.fill('#explore-search-input', '메티'),
    ])

    const body = await searchResp.json()
    expect(body.success).toBe(true)
    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })
  })

  // ─────────────────────────────────────────────
  // G-6. 탐색 모달 닫기 → 재오픈 시 검색어 초기화
  // ─────────────────────────────────────────────
  test('G-6 탐색 모달 닫기 → 재오픈 시 검색어 초기화', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    // 첫 오픈 + 검색어 입력
    await page.locator('#groups-list button:has-text("그룹 탐색")').click()
    await expect(page.locator('#modal-group-explore')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#explore-groups-list')).not.toContainText('불러오는 중', { timeout: 10000 })
    await page.fill('#explore-search-input', '검색어')

    // 닫기
    await page.locator('#modal-group-explore button[onclick*="closeModal"]').click()
    await expect(page.locator('#modal-group-explore')).toBeHidden({ timeout: 3000 })

    // 재오픈 → 검색어 초기화 확인
    await page.locator('#groups-list button:has-text("그룹 탐색")').click()
    await expect(page.locator('#modal-group-explore')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#explore-search-input')).toHaveValue('', { timeout: 3000 })
  })

  // ─────────────────────────────────────────────
  // G-7. 그룹 카드 클릭 → 상세 모달
  // ─────────────────────────────────────────────
  test('G-7 탐색 그룹 카드 클릭 → 상세 모달 + API 응답', async ({ page }) => {
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

    // 공개 그룹이 없으면 스킵
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
    expect(detailBody.data.id).toBeDefined()
    expect(detailBody.data.name).toBeDefined()
  })

  // ─────────────────────────────────────────────
  // G-8. 탐색 모달에서 가입 신청 버튼 클릭
  // ─────────────────────────────────────────────
  test('G-8 그룹 탐색 — 미가입 그룹 가입 신청 (201 or 409)', async ({ page }) => {
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

    // 미가입 그룹의 "가입 신청" 버튼
    const joinBtn = page.locator('#explore-groups-list button:has-text("가입 신청")').first()
    if (await joinBtn.count() === 0) return // 가입 가능한 그룹 없음

    const [joinResp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups') && r.url().includes('/join'),
        { timeout: 15000 }
      ),
      joinBtn.click(),
    ])

    // 201 성공 또는 409(이미 신청) 모두 허용
    expect([201, 409]).toContain(joinResp.status())
  })

  // ─────────────────────────────────────────────
  // G-9. "그룹 개설 신청" → 모달 열림
  // ─────────────────────────────────────────────
  test('G-9 "그룹 개설 신청" 버튼 → modal-create-group 열림', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await page.locator('#groups-list button:has-text("그룹 개설 신청")').click()
    await expect(page.locator('#modal-create-group')).toBeVisible({ timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // G-10. 그룹 개설 신청 제출 — 201 + pending 상태 표시
  // ─────────────────────────────────────────────
  test('G-10 그룹 개설 신청 제출 — 201 응답 + 신청 내역 표시', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await page.locator('#groups-list button:has-text("그룹 개설 신청")').click()
    await expect(page.locator('#modal-create-group')).toBeVisible({ timeout: 5000 })

    const groupName = `E2E그룹_${Date.now()}`
    await page.fill('#group-name', groupName)
    await page.fill('#group-description', '자동화 테스트로 생성된 그룹')
    await page.fill('#group-purpose', '플레이라이트 E2E 테스트 검증을 위한 임시 그룹입니다')

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

    // 모달 닫힘 + 신청 내역에 표시 (group_pending 상태)
    await expect(page.locator('#modal-create-group')).toBeHidden({ timeout: 5000 })
    await expect(page.locator('#groups-list')).toContainText(groupName, { timeout: 10000 })
    await expect(page.locator('#groups-list')).toContainText('개설 심사 중', { timeout: 5000 })
  })

  // ─────────────────────────────────────────────
  // G-11. 개설 신청 — 필수 필드 미입력 차단
  // ─────────────────────────────────────────────
  test('G-11 그룹 개설 신청 — 이름/용도 미입력 시 폼 차단', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/groups/mine') && r.status() === 200,
        { timeout: 15000 }
      ),
      page.click('button[data-section="groups"]'),
    ])

    await page.locator('#groups-list button:has-text("그룹 개설 신청")').click()
    await expect(page.locator('#modal-create-group')).toBeVisible({ timeout: 5000 })

    // 이름만 입력, purpose 누락
    await page.fill('#group-name', '이름만있는그룹')
    await page.click('#create-group-form button[type="submit"]')

    // required 속성에 의해 폼 제출 차단 → 모달 유지
    await expect(page.locator('#modal-create-group')).toBeVisible()
  })
})
