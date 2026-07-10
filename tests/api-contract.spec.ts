/**
 * Tier 1 — API 계약 테스트 (전 도메인)
 *
 * 목적: 80+ 엔드포인트를 상태코드/인증/응답 스키마 레벨로 광범위 커버.
 *  - 인증 필요한 GET 엔드포인트: 토큰 있으면 200 + {success,data}
 *  - 비인증 접근: 401
 *  - 알려진 500 버그(어드민 대시보드 / 레슨 생성)는 회귀로 추적
 *
 * 자격증명: admin@meti.dev / test@meti.dev (staging 실측)
 */
import { test, expect, type APIRequestContext } from '@playwright/test'

const ADMIN = { email: 'admin@meti.dev', password: 'Admin1234!' }
const USER  = { email: 'test@meti.dev', password: 'MetiTest1234!' }

async function token(request: APIRequestContext, creds: typeof ADMIN): Promise<string> {
  const r = await request.post('/api/v1/auth/login', { data: creds })
  expect(r.status(), `로그인 ${creds.email}`).toBe(200)
  return (await r.json()).data.access_token
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

// ─────────────────────────────────────────────
// 1. 인증 계약
// ─────────────────────────────────────────────
test.describe('인증 계약', () => {
  test('A-1 올바른 자격증명 → 200 + access_token', async ({ request }) => {
    const r = await request.post('/api/v1/auth/login', { data: USER })
    expect(r.status()).toBe(200)
    const b = await r.json()
    expect(b.success).toBe(true)
    expect(b.data.access_token).toBeTruthy()
    expect(b.data.user?.id).toBeDefined()
  })

  test('A-2 잘못된 비밀번호 → 401', async ({ request }) => {
    const r = await request.post('/api/v1/auth/login', { data: { email: USER.email, password: 'wrong!!' } })
    expect(r.status()).toBe(401)
  })

  test('A-3 /auth/me — 토큰 있으면 200, 없으면 401', async ({ request }) => {
    const t = await token(request, USER)
    const ok = await request.get('/api/v1/auth/me', { headers: bearer(t) })
    expect(ok.status()).toBe(200)
    const no = await request.get('/api/v1/auth/me')
    expect(no.status()).toBe(401)
  })
})

// ─────────────────────────────────────────────
// 2. 일반 유저 도메인 GET 계약 (200 + 스키마)
// ─────────────────────────────────────────────
test.describe('유저 도메인 GET 계약', () => {
  const endpoints = [
    '/api/v1/cards',
    '/api/v1/groups/mine',
    '/api/v1/groups',                       // 공개 그룹 탐색
    '/api/v1/points/balance',
    '/api/v1/points/history',
  ]
  for (const path of endpoints) {
    test(`U ${path} → 200 + success`, async ({ request }) => {
      const t = await token(request, USER)
      const r = await request.get(path, { headers: bearer(t) })
      expect(r.status(), path).toBe(200)
      const b = await r.json()
      expect(b.success, `${path} success`).toBe(true)
    })
  }

  test('U 비인증 /cards → 401', async ({ request }) => {
    const r = await request.get('/api/v1/cards')
    expect(r.status()).toBe(401)
  })
})

// ─────────────────────────────────────────────
// 2-b. 확장 도메인 GET 계약 (chat/guardians/events/lessons/products)
// ─────────────────────────────────────────────
test.describe('확장 도메인 GET 계약', () => {
  const GROUP_ID = 9001
  const endpoints = [
    '/api/v1/chat/',
    '/api/v1/guardians/',
    '/api/v1/point-charge-products',
    '/api/v1/events',
    `/api/v1/events/groups/${GROUP_ID}/events`,
    `/api/v1/lessons/groups/${GROUP_ID}/lessons`,
  ]
  for (const path of endpoints) {
    test(`X ${path} → 200`, async ({ request }) => {
      const t = await token(request, USER)
      const r = await request.get(path, { headers: bearer(t) })
      expect(r.status(), path).toBe(200)
    })
  }
})

// ─────────────────────────────────────────────
// 2-c. ⚠️ staging 500 (마이그레이션 갭) — 수정 시 자동 통과
//   근본원인 A: 0014 부분적용(products/orders/order_items/payments 누락)
//   + partner_services / user_guardians / lesson_schedules 관련 테이블 누락
// ─────────────────────────────────────────────
test.describe('staging 500 회귀 마커 (마이그레이션 갭)', () => {
  const buggy = [
    '/api/v1/orders',                       // orders 테이블 (A)
    `/api/v1/groups/9001/products`,         // products 테이블 (A)
    '/api/v1/partner/services',             // partner_services 테이블
    '/api/v1/guardians/pending',            // user_guardians 관련
    '/api/v1/guardians/lesson-groups',      // lesson_schedules 관련
  ]
  for (const path of buggy) {
    test(`BUG ${path} → 200 (현재 500)`, async ({ request }) => {
      const t = await token(request, USER)
      const r = await request.get(path, { headers: bearer(t) })
      expect(r.status(), `${path} (마이그레이션 적용 시 200)`).toBe(200)
    })
  }
})

// ─────────────────────────────────────────────
// 3. 어드민 도메인 GET 계약
// ─────────────────────────────────────────────
test.describe('어드민 도메인 GET 계약', () => {
  const okEndpoints = [
    '/api/v1/admin/users',
    '/api/v1/admin/groups',
    '/api/v1/admin/events',
    '/api/v1/admin/reports',
    '/api/v1/admin/nfc-cards',
    '/api/v1/admin/plan-configs',
  ]
  for (const path of okEndpoints) {
    test(`ADM ${path} → 200`, async ({ request }) => {
      const t = await token(request, ADMIN)
      const r = await request.get(path, { headers: bearer(t) })
      expect(r.status(), path).toBe(200)
    })
  }

  test('ADM 비인증 /admin/users → 401/403', async ({ request }) => {
    const r = await request.get('/api/v1/admin/users')
    expect([401, 403]).toContain(r.status())
  })

  // ⚠️ 알려진 버그군 A: orders 테이블 누락 추정 (staging 스키마 드리프트)
  //   → 대시보드 집계 / 주문 목록이 동일 원인으로 500. 수정 시 통과로 전환.
  test('ADM /admin/dashboard → 200 (현재 buggy: 500, orders 집계)', async ({ request }) => {
    const t = await token(request, ADMIN)
    const r = await request.get('/api/v1/admin/dashboard', { headers: bearer(t) })
    expect(r.status(), '대시보드 집계 (버그 시 500)').toBe(200)
  })

  test('ADM /admin/orders → 200 (현재 buggy: 500, orders 조회)', async ({ request }) => {
    const t = await token(request, ADMIN)
    const r = await request.get('/api/v1/admin/orders', { headers: bearer(t) })
    expect(r.status(), '주문 목록 (버그 시 500)').toBe(200)
  })
})
