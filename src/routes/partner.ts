import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail } from '../middleware/response'

const partner = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 파트너 API 키 인증 미들웨어
const partnerAuth = async (c: any, next: () => Promise<void>) => {
  const apiKey = c.req.header('X-Partner-API-Key')
  if (!apiKey) {
    return c.json({ success: false, error: 'API 키가 필요합니다.' }, 401)
  }

  const partner = await c.env.DB.prepare(
    `SELECT id, name, status FROM partner_services WHERE api_key = ?`
  ).bind(apiKey).first<{ id: number; name: string; status: string }>()

  if (!partner || partner.status !== 'active') {
    return c.json({ success: false, error: '유효하지 않은 API 키입니다.' }, 401)
  }

  c.set('partnerId', partner.id)
  c.set('partnerName', partner.name)
  await next()
}

// ── POST /api/v1/partner/user-map ─────────────────────
// 파트너가 METI 유저 매핑 토큰 요청
partner.post(
  '/user-map',
  partnerAuth,
  zValidator('json', z.object({
    meti_user_id: z.number().int().positive()
  })),
  async (c) => {
    const partnerId = c.get('partnerId') as number
    const { meti_user_id } = c.req.valid('json')

    // 유저 존재 여부 확인
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ? AND is_active = 1 AND is_deleted = 0'
    ).bind(meti_user_id).first()

    if (!user) {
      return c.json(fail('유저를 찾을 수 없습니다.'), 404)
    }

    // external_user_key 생성 (hash 기반)
    const encoder = new TextEncoder()
    const data = encoder.encode(`${partnerId}:${meti_user_id}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const externalKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // 매핑 저장 또는 조회
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO partner_user_mapping (partner_id, user_id, external_user_key)
      VALUES (?, ?, ?)
    `).bind(partnerId, meti_user_id, externalKey).run()

    return c.json(ok({ external_user_key: externalKey }))
  }
)

// ── POST /api/v1/partner/reward ───────────────────────
// 파트너가 리워드 지급 요청 (서버 간 통신)
partner.post(
  '/reward',
  partnerAuth,
  zValidator('json', z.object({
    external_user_key: z.string(),
    event_type: z.string().min(1),
    points: z.number().int().min(1).max(10000),
    description: z.string().optional(),
    payload: z.record(z.unknown()).optional()
  })),
  async (c) => {
    const partnerId = c.get('partnerId') as number
    const body = c.req.valid('json')

    // 유저 매핑 조회
    const mapping = await c.env.DB.prepare(`
      SELECT user_id FROM partner_user_mapping
      WHERE partner_id = ? AND external_user_key = ?
    `).bind(partnerId, body.external_user_key).first<{ user_id: number }>()

    if (!mapping) {
      return c.json(fail('유저 매핑을 찾을 수 없습니다.'), 404)
    }

    const userId = mapping.user_id

    // 리워드 이벤트 로그 기록
    const logResult = await c.env.DB.prepare(`
      INSERT INTO partner_reward_events (partner_id, external_user_key, user_id, event_type, points_awarded, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      partnerId, body.external_user_key, userId,
      body.event_type, body.points, JSON.stringify(body.payload ?? {})
    ).run()

    // 리워드 지급 (트랜잭션)
    await c.env.DB.batch([
      // 리워드 잔액 업데이트
      c.env.DB.prepare(`
        INSERT INTO reward_balances (user_id, points) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET points = points + ?, updated_at = datetime('now')
      `).bind(userId, body.points, body.points),
      // 리워드 이력 저장
      c.env.DB.prepare(`
        INSERT INTO rewards (user_id, type, source, partner_id, points, description)
        VALUES (?, 'partner', 'partner', ?, ?, ?)
      `).bind(userId, partnerId, body.points, body.description ?? body.event_type),
      // 이벤트 처리 완료 표시
      c.env.DB.prepare(`
        UPDATE partner_reward_events SET processed = 1, processed_at = datetime('now') WHERE id = ?
      `).bind(logResult.meta.last_row_id),
      // 알림 생성
      c.env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES (?, 'reward', '리워드 지급', ?)
      `).bind(userId, `${c.get('partnerName')} 파트너 혜택으로 ${body.points}P가 지급되었습니다.`)
    ])

    // 업데이트된 잔액 조회
    const balance = await c.env.DB.prepare(
      'SELECT points FROM reward_balances WHERE user_id = ?'
    ).bind(userId).first<{ points: number }>()

    return c.json(ok({
      user_id: userId,
      points_awarded: body.points,
      new_balance: balance?.points ?? 0
    }, '리워드가 지급되었습니다.'))
  }
)

// ── GET /api/v1/partner/user-balance ──────────────────
// 파트너가 유저 리워드 잔액 조회
partner.get('/user-balance', partnerAuth, async (c) => {
  const partnerId = c.get('partnerId') as number
  const externalKey = c.req.query('external_user_key')

  if (!externalKey) {
    return c.json(fail('external_user_key 파라미터가 필요합니다.'), 400)
  }

  const mapping = await c.env.DB.prepare(`
    SELECT user_id FROM partner_user_mapping
    WHERE partner_id = ? AND external_user_key = ?
  `).bind(partnerId, externalKey).first<{ user_id: number }>()

  if (!mapping) {
    return c.json(fail('유저 매핑을 찾을 수 없습니다.'), 404)
  }

  const balance = await c.env.DB.prepare(
    'SELECT points FROM reward_balances WHERE user_id = ?'
  ).bind(mapping.user_id).first<{ points: number }>()

  return c.json(ok({ points: balance?.points ?? 0 }))
})

export default partner
