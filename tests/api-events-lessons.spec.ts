/**
 * 행사 / 레슨 쓰기 플로우 — API 레벨 E2E (결정적)
 *
 * UI(그룹 관리) 깊은 네비 대신 실제 쓰기 동작을 API로 검증:
 *   - 행사 만들기 / 행사 참여(+취소/삭제 cleanup)
 *   - 레슨 만들기 / 레슨 신청(+취소/삭제 cleanup)
 *
 * 전제: test@meti.dev(id 9001)는 활성 그룹 9001 'admin'.
 *       그룹 9001 point_wallets 잔액 10만P, 개인 잔액 5만P.
 *
 * ⚠️ 알려진 백엔드 버그(2026-06-30): 레슨 생성이 존재하지 않는 group_points 테이블을
 *    조회하여 500 발생. 해당 테스트는 정당하게 실패하여 버그를 노출한다. (bug-lesson-create-500)
 */
import { test, expect, type APIRequestContext } from '@playwright/test'

const USER = { email: 'test@meti.dev', password: 'MetiTest1234!' }
const GROUP_ID = 9001
const INSTRUCTOR_ID = 9001 // 본인(admin) — instructor 자격 충족

async function login(request: APIRequestContext): Promise<Record<string, string>> {
  const r = await request.post('/api/v1/auth/login', { data: USER })
  expect(r.status(), '유저 로그인').toBe(200)
  const token = (await r.json()).data.access_token
  return { Authorization: `Bearer ${token}` }
}

// 미래 일시 (YYYY-MM-DDTHH:mm)
function futureAt(daysAhead = 150): string {
  const d = new Date(Date.now() + daysAhead * 86400_000)
  return d.toISOString().slice(0, 16)
}

test.describe('행사 쓰기 플로우 (API)', () => {
  test('E-1 행사 만들기 → 201 + event_id, 포인트 차감', async ({ request }) => {
    const headers = await login(request)
    let eventId: number | undefined
    try {
      const res = await request.post(`/api/v1/events/groups/${GROUP_ID}/events`, {
        headers,
        data: {
          title: `E2E행사_${Date.now()}`,
          starts_at: futureAt(150),
          ends_at: futureAt(151),
          capacity: 10,          // 1000P
          visibility: 'public',
        },
      })
      expect(res.status(), '행사 생성').toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.event_id).toBeGreaterThan(0)
      expect(body.data.point_cost).toBe(1000)
      eventId = body.data.event_id
    } finally {
      if (eventId) await request.delete(`/api/v1/events/${eventId}`, { headers })
    }
  })

  test('E-2 행사 참여 → 201, 중복 참여 → 409', async ({ request }) => {
    const headers = await login(request)
    let eventId: number | undefined
    try {
      const create = await request.post(`/api/v1/events/groups/${GROUP_ID}/events`, {
        headers,
        data: { title: `E2E참여_${Date.now()}`, starts_at: futureAt(150), capacity: 10, visibility: 'public' },
      })
      expect(create.status()).toBe(201)
      eventId = (await create.json()).data.event_id

      // 참여
      const join = await request.post(`/api/v1/events/${eventId}/join`, { headers })
      expect(join.status(), '행사 참여').toBe(201)

      // 중복 참여 → 409
      const dup = await request.post(`/api/v1/events/${eventId}/join`, { headers })
      expect(dup.status(), '중복 참여').toBe(409)
    } finally {
      if (eventId) {
        await request.delete(`/api/v1/events/${eventId}/join`, { headers })
        await request.delete(`/api/v1/events/${eventId}`, { headers })
      }
    }
  })
})

test.describe('레슨 쓰기 플로우 (API)', () => {
  // ⚠️ 알려진 버그: group_points 테이블 미존재로 500. 수정 시 통과로 전환됨.
  test('L-1 레슨 만들기 → 201 + lesson_id (현재 buggy: 500)', async ({ request }) => {
    const headers = await login(request)
    let lessonId: number | undefined
    try {
      const res = await request.post(`/api/v1/lessons/groups/${GROUP_ID}/lessons`, {
        headers,
        data: {
          instructor_id: INSTRUCTOR_ID,
          title: `E2E레슨_${Date.now()}`,
          scheduled_at: futureAt(150),
          duration_minutes: 60,
        },
      })
      expect(res.status(), '레슨 생성 (group_points 버그 시 500)').toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      lessonId = body.data.lesson_id
    } finally {
      if (lessonId) await request.delete(`/api/v1/lessons/${lessonId}`, { headers })
    }
  })

  test('L-2 레슨 신청 → 201, 중복 신청 → 409 (레슨 생성 의존)', async ({ request }) => {
    const headers = await login(request)
    const create = await request.post(`/api/v1/lessons/groups/${GROUP_ID}/lessons`, {
      headers,
      data: { instructor_id: INSTRUCTOR_ID, title: `E2E신청_${Date.now()}`, scheduled_at: futureAt(150), duration_minutes: 60 },
    })
    // 레슨 생성 버그(500)면 신청 검증 불가 → skip
    test.skip(create.status() !== 201, `레슨 생성이 ${create.status()} (group_points 버그) → 신청 테스트 보류`)

    const lessonId = (await create.json()).data.lesson_id
    try {
      const reg = await request.post(`/api/v1/lessons/${lessonId}/register`, { headers })
      expect(reg.status(), '레슨 신청').toBe(201)
      const dup = await request.post(`/api/v1/lessons/${lessonId}/register`, { headers })
      expect(dup.status(), '중복 신청').toBe(409)
    } finally {
      await request.delete(`/api/v1/lessons/${lessonId}/register`, { headers })
      await request.delete(`/api/v1/lessons/${lessonId}`, { headers })
    }
  })
})
