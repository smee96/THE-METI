import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail } from '../middleware/response'
import { authMiddleware } from '../middleware/auth'
import { creditWallet } from '../lib/wallet'

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
// 파트너가 ELID 유저 매핑 토큰 요청
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
    points: z.number().int().min(1).max(10000),     // 유저 적립 포인트
    amount: z.number().int().positive().optional(), // 유저 소진 원금(통화 최소단위) — 정산용
    currency: z.string().length(3).optional(),      // ISO 4217 (기본 KRW)
    description: z.string().optional(),
    payload: z.record(z.unknown()).optional()
  })),
  async (c) => {
    const partnerId = c.get('partnerId') as number
    const partnerName = c.get('partnerName') as string
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

    // 정산 계산 — 소진 금액(amount)이 있으면 파트너 수수료율로 ELID 수취분 산출
    const pinfo = await c.env.DB.prepare(
      `SELECT commission_rate FROM partner_services WHERE id = ?`
    ).bind(partnerId).first<{ commission_rate: number }>()
    const rate = pinfo?.commission_rate ?? 0.15

    const gross = body.amount ?? null
    const currency = body.currency ?? (gross != null ? 'KRW' : null)
    const settlement = gross != null ? Math.floor(gross * rate) : 0
    const billingPeriod = new Date().toISOString().slice(0, 7)  // YYYY-MM

    // 리워드 이벤트 로그 기록 (정산 필드 포함)
    const logResult = await c.env.DB.prepare(`
      INSERT INTO partner_reward_events
        (partner_id, external_user_key, user_id, event_type, points_awarded, payload,
         gross_amount, currency, commission_rate, settlement_amount, billing_period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      partnerId, body.external_user_key, userId,
      body.event_type, body.points, JSON.stringify(body.payload ?? {}),
      gross, currency, gross != null ? rate : null, settlement, billingPeriod
    ).run()
    const eventId = logResult.meta.last_row_id as number

    // 포인트 적립 — point_wallets 단일 원장으로 일원화
    const credit = await creditWallet(c.env.DB, 'user', userId, body.points, {
      type: 'charge_partner',
      pointType: 'reward',
      refType: 'partner_reward_event',
      refId: eventId,
      description: body.description ?? `${partnerName} 리워드`,
    })

    // 부가 기록: 감사이력 / 처리완료 / 알림 / 정산 월집계
    const ops = [
      c.env.DB.prepare(`
        INSERT INTO rewards (user_id, type, source, partner_id, points, description)
        VALUES (?, 'partner', 'partner', ?, ?, ?)
      `).bind(userId, partnerId, body.points, body.description ?? body.event_type),
      c.env.DB.prepare(`
        UPDATE partner_reward_events SET processed = 1, processed_at = datetime('now') WHERE id = ?
      `).bind(eventId),
      c.env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES (?, 'reward', '리워드 지급', ?)
      `).bind(userId, `${partnerName} 파트너 혜택으로 ${body.points}P가 지급되었습니다.`),
    ]
    if (gross != null) {
      // 월·파트너·통화 단위 정산 집계 누적
      ops.push(c.env.DB.prepare(`
        INSERT INTO partner_settlements
          (partner_id, billing_period, currency, gross_total, settlement_total, event_count)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(partner_id, billing_period, currency) DO UPDATE SET
          gross_total      = gross_total + excluded.gross_total,
          settlement_total = settlement_total + excluded.settlement_total,
          event_count      = event_count + 1,
          updated_at       = datetime('now')
      `).bind(partnerId, billingPeriod, currency, gross, settlement))
    }
    await c.env.DB.batch(ops)

    return c.json(ok({
      user_id: userId,
      points_awarded: body.points,
      new_balance: credit.balanceAfter,
      settlement_amount: settlement,
      currency
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

  const wallet = await c.env.DB.prepare(
    `SELECT balance FROM point_wallets WHERE owner_type = 'user' AND owner_id = ?`
  ).bind(mapping.user_id).first<{ balance: number }>()

  return c.json(ok({ points: wallet?.balance ?? 0 }))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/partner/services
// B-2: 앱용 파트너 서비스 목록 (status=active, 일반 사용자용)
// ══════════════════════════════════════════════════════════════
partner.get('/services', authMiddleware, async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT id, name, description, webview_url, open_mode
    FROM partner_services
    WHERE status = 'active'
      AND webview_url IS NOT NULL
      AND webview_url != ''
    ORDER BY id ASC
  `).all()

  return c.json(ok(rows.results))
})

export default partner
