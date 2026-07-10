/**
 * 그룹 초대링크 E2E — 커버리지 갭 보강 (2026-07-09)
 * - chromium-user: test@meti.dev(id 9001)는 활성 그룹 9001 'admin'
 *
 * 배경: ec10f64에서 "생성 결과 URL이 빈값"(프론트가 API 필드 invite_url을 lk.url로 오독)
 *       버그를 수정. 기존 테스트에 초대링크 시나리오가 아예 없어 검출 못 했음 → 여기서 보강.
 *
 * I-1: 생성 결과 URL 노출 (수정 회귀 가드) — invite_url 빈값이면 실패
 * I-2: 생성한 링크가 목록(#invites-list)에 표시 — 잔존 버그(res.data.data?.links) 재현
 * I-3: 초대 토큰 공개 해석 API (GET /groups/invite/:token) 200 + 그룹정보
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const GROUP_ID = 9001

// 정리용 로그인 헤더
async function apiHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const r = await request.post('/api/v1/auth/login', {
    data: { email: 'test@meti.dev', password: 'MetiTest1234!' },
  })
  return { Authorization: `Bearer ${(await r.json()).data.access_token}` }
}

// 토큰으로 링크 찾아 비활성화 (cleanup)
async function deactivateByToken(request: APIRequestContext, token: string) {
  const headers = await apiHeaders(request)
  const list = await request.get(`/api/v1/groups/${GROUP_ID}/invite-links`, { headers })
  const arr = (await list.json()).data ?? []
  const found = (Array.isArray(arr) ? arr : arr.links ?? []).find((l: any) => l.token === token)
  if (found?.id) {
    await request.patch(`/api/v1/groups/${GROUP_ID}/invite-links/${found.id}/deactivate`, { headers })
  }
}

// 초대 섹션 진입 + UI로 링크 생성 → 생성 응답(body) 반환
async function createInviteViaUI(page: Page): Promise<{ token: string; invite_url: string }> {
  await page.goto(`/app/group/${GROUP_ID}/invites`)
  await expect(page.locator('#invites-list')).toBeVisible({ timeout: 15000 })

  await page.click('button[onclick*="openCreateInviteModal"]')
  await expect(page.locator('#modal-create-invite')).toBeVisible({ timeout: 5000 })

  await page.fill('#invite-label', `E2E초대_${Date.now()}`)
  await page.fill('#invite-max-uses', '5')
  const exp = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
  await page.fill('#invite-expires', exp)

  const [resp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/invite-links') && r.request().method() === 'POST' && r.status() < 300,
      { timeout: 15000 }
    ),
    page.click('#create-invite-form button[type="submit"]'),
  ])
  return (await resp.json()).data
}

test.describe('그룹 초대링크', () => {
  test('I-1 링크 생성 → 결과 URL이 비어있지 않다 (ec10f64 회귀 가드)', async ({ page, request }) => {
    let token = ''
    try {
      const data = await createInviteViaUI(page)
      token = data.token

      // 결과 박스 노출 + URL 필드가 실제 초대 URL (빈값이면 = 원래 버그 재발)
      await expect(page.locator('#invite-result')).toBeVisible({ timeout: 5000 })
      const url = await page.locator('#invite-url').inputValue()
      expect(url, '생성 결과 invite_url').not.toBe('')
      expect(url).toMatch(/\/invite\/[0-9a-f-]{36}/)
    } finally {
      if (token) await deactivateByToken(request, token)
    }
  })

  test('I-2 생성한 링크가 목록에 표시된다 (잔존 버그: data?.links)', async ({ page, request }) => {
    let token = ''
    try {
      const data = await createInviteViaUI(page)
      token = data.token
      // 생성 직후 loadGroupInvites 재조회됨 → 목록에 방금 링크가 보여야 정상
      await expect(page.locator('#invites-list')).not.toContainText('초대링크가 없습니다', { timeout: 8000 })
      await expect(page.locator('#invites-list')).toContainText(token.slice(0, 8), { timeout: 8000 })
    } finally {
      if (token) await deactivateByToken(request, token)
    }
  })

  test('I-3 초대 토큰 공개 해석 (GET /groups/invite/:token) → 200 + 그룹정보', async ({ page, request }) => {
    let token = ''
    try {
      const data = await createInviteViaUI(page)
      token = data.token

      // 비인증(공개)으로도 초대 정보 조회 가능해야 초대가 성립
      const r = await request.get(`/api/v1/groups/invite/${token}`)
      expect(r.status(), '토큰 해석').toBe(200)
      const b = await r.json()
      expect(b.success).toBe(true)
      expect(b.data.group_id).toBe(GROUP_ID)
      expect(b.data.group_name).toBeTruthy()
    } finally {
      if (token) await deactivateByToken(request, token)
    }
  })
})
