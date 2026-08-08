import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail } from '../middleware/response'
import { authMiddleware } from '../middleware/auth'
import { creditWallet } from '../lib/wallet'
import { sendPushToUsers } from '../lib/push'
import { issueLaunchToken } from '../lib/partner-token'
import { fetchPartnerBalance } from '../lib/partner-balance'

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
    const rate = pinfo?.commission_rate ?? 0.20  // 해피트리 확정 회신(2026-07-08) 기준 20%

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

    // 푸시 발송 (앱 회신 §D-2 트리거④, 응답 비차단)
    c.executionCtx.waitUntil(sendPushToUsers(c.env, [userId], {
      title: '리워드 지급',
      body: `${partnerName} 파트너 혜택으로 ${body.points}P가 지급되었습니다.`,
      data: {
        type: 'partner_reward',
        point_amount: String(body.points),
        partner_name: partnerName
      }
    }))

    return c.json(ok({
      user_id: userId,
      points_awarded: body.points,
      new_balance: credit.balanceAfter,
      settlement_amount: settlement,
      currency
    }, '리워드가 지급되었습니다.'))
  }
)

// ── POST /api/v1/partner/settlement ───────────────────
// 해피트리 확정 회신(2026-07-08) §1-3: 정산 통지 수신 (정산 전용 —
// 유저 포인트 적립·알림 없음. /reward와 달리 유저 원장을 건드리지 않는다)
// 멱등: (partner_id, order_id) 유일 — outbox 백오프 재시도로 같은 통지가 여러 번 온다
partner.post(
  '/settlement',
  partnerAuth,
  zValidator('json', z.object({
    external_user_key: z.string().regex(/^[0-9a-f]{64}$/, 'external_user_key는 64자리 hex여야 합니다.'),
    event_type: z.enum(['star_purchase', 'star_purchase_refund']),
    amount: z.number().int().positive(),            // 결제/환불 원금 — 환불도 양수로 받는다
    currency: z.string().length(3).transform(s => s.toUpperCase()),
    order_id: z.string().min(1).max(128),           // 멱등 키 (이벤트당 유일)
    ref_order_id: z.string().min(1).max(128).nullable().optional(),
    occurred_at: z.string().datetime({ offset: true }).optional(),
  })),
  async (c) => {
    const partnerId = c.get('partnerId') as number
    const body = c.req.valid('json')

    const isRefund = body.event_type === 'star_purchase_refund'
    if (isRefund && !body.ref_order_id) {
      return c.json(fail('환불 통지에는 ref_order_id(원 결제 order_id)가 필요합니다.'), 400)
    }

    // 유저 매핑 확인
    const mapping = await c.env.DB.prepare(`
      SELECT user_id FROM partner_user_mapping
      WHERE partner_id = ? AND external_user_key = ?
    `).bind(partnerId, body.external_user_key).first<{ user_id: number }>()

    if (!mapping) {
      return c.json({ success: false, code: 'user_not_found', error: '유저 매핑을 찾을 수 없습니다.' }, 404)
    }

    // 정산액 = ±floor(원금 × 수수료율). 환불은 역정산(음수)
    const pinfo = await c.env.DB.prepare(
      `SELECT commission_rate FROM partner_services WHERE id = ?`
    ).bind(partnerId).first<{ commission_rate: number }>()
    const rate = pinfo?.commission_rate ?? 0.20
    const magnitude = Math.floor(body.amount * rate)
    const settlement = isRefund ? -magnitude : magnitude
    const grossSigned = isRefund ? -body.amount : body.amount
    const billingPeriod = new Date().toISOString().slice(0, 7)  // YYYY-MM

    // 멱등 삽입 — 이미 처리된 order_id면 재집계 없이 duplicate 응답
    const insert = await c.env.DB.prepare(`
      INSERT INTO partner_settlement_events
        (partner_id, external_user_key, user_id, event_type, amount, currency,
         order_id, ref_order_id, commission_rate, settlement_amount, billing_period, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(partner_id, order_id) DO NOTHING
    `).bind(
      partnerId, body.external_user_key, mapping.user_id, body.event_type,
      body.amount, body.currency, body.order_id, body.ref_order_id ?? null,
      rate, settlement, billingPeriod, body.occurred_at ?? null
    ).run()

    if (insert.meta.changes === 0) {
      const prev = await c.env.DB.prepare(`
        SELECT settlement_amount, currency FROM partner_settlement_events
        WHERE partner_id = ? AND order_id = ?
      `).bind(partnerId, body.order_id).first<{ settlement_amount: number; currency: string }>()
      return c.json(ok({
        accepted: true,
        order_id: body.order_id,
        settlement_amount: prev?.settlement_amount ?? settlement,
        currency: prev?.currency ?? body.currency,
        duplicate: true,
      }))
    }

    // 월·파트너·통화 단위 정산 집계 누적 (환불은 음수로 상쇄)
    await c.env.DB.prepare(`
      INSERT INTO partner_settlements
        (partner_id, billing_period, currency, gross_total, settlement_total, event_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(partner_id, billing_period, currency) DO UPDATE SET
        gross_total      = gross_total + excluded.gross_total,
        settlement_total = settlement_total + excluded.settlement_total,
        event_count      = event_count + 1,
        updated_at       = datetime('now')
    `).bind(partnerId, billingPeriod, body.currency, grossSigned, settlement).run()

    return c.json(ok({
      accepted: true,
      order_id: body.order_id,
      settlement_amount: settlement,
      currency: body.currency,
      duplicate: false,
    }))
  }
)

// ── POST /api/v1/partner/services/:id/launch-token ────
// ELID 앱이 파트너 웹뷰(해피트리 /play)를 열 때 쓰는 1회용 SSO 토큰 (앱 사용자 인증)
// 확정 회신 §1-2: RS256 · aud/partner_id = 파트너 slug · TTL 5분 · jti 원타임(파트너측 검증)
partner.post('/services/:id/launch-token', authMiddleware, async (c) => {
  const serviceId = parseInt(c.req.param('id'))
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return c.json(fail('유효하지 않은 파트너 ID입니다.'), 400)
  }

  const svc = await c.env.DB.prepare(`
    SELECT id, slug, webview_url, open_mode FROM partner_services
    WHERE id = ? AND status = 'active'
  `).bind(serviceId).first<{ id: number; slug: string | null; webview_url: string | null; open_mode: string }>()

  if (!svc) return c.json(fail('파트너를 찾을 수 없습니다.'), 404)
  if (!svc.slug) return c.json(fail('SSO 진입을 지원하지 않는 파트너입니다.'), 400)

  const userId = c.get('userId') as number

  // 유저 매핑 확보 — /partner/user-map과 동일한 결정론적 해시 (원본 ID 비공유)
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${svc.id}:${userId}`))
  const externalKey = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO partner_user_mapping (partner_id, user_id, external_user_key)
    VALUES (?, ?, ?)
  `).bind(svc.id, userId, externalKey).run()

  const issued = await issueLaunchToken(c.env, svc.slug, externalKey)
  if (!issued) {
    return c.json(fail('launch-token 서명 키가 설정되지 않았습니다.'), 503)
  }

  // webview_url이 있으면 토큰을 붙인 진입 URL까지 만들어준다 (앱은 그대로 웹뷰 오픈)
  const launchUrl = svc.webview_url
    ? `${svc.webview_url}${svc.webview_url.includes('?') ? '&' : '?'}token=${encodeURIComponent(issued.token)}`
    : null

  return c.json(ok({
    token: issued.token,
    expires_in: issued.expires_in,
    open_mode: svc.open_mode,
    launch_url: launchUrl,
  }))
})

// ── GET /api/v1/partner/services/:id/balance ──────────
// B-2: 앱 제휴 탭 표시용 파트너 게임재화 잔액 (해피트리 프록시 + 10초 캐시)
// 확정 회신 §2: 재화 표시 = ELID 네이티브 UI → 이 엔드포인트가 그 데이터 소스
partner.get('/services/:id/balance', authMiddleware, async (c) => {
  const serviceId = parseInt(c.req.param('id'))
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return c.json(fail('유효하지 않은 파트너 ID입니다.'), 400)
  }

  const svc = await c.env.DB.prepare(`
    SELECT id, slug FROM partner_services WHERE id = ? AND status = 'active'
  `).bind(serviceId).first<{ id: number; slug: string | null }>()

  if (!svc) return c.json(fail('파트너를 찾을 수 없습니다.'), 404)
  if (svc.slug !== 'happytree') {
    return c.json(fail('잔액 조회를 지원하지 않는 파트너입니다.'), 400)
  }

  const userId = c.get('userId') as number

  // external_user_key는 결정론적 해시 — 매핑 저장은 launch-token 쪽에서 하므로 계산만
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${svc.id}:${userId}`))
  const externalKey = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const result = await fetchPartnerBalance(c.env, externalKey)
  if (!result) {
    return c.json(fail('파트너 잔액 조회가 아직 설정되지 않았습니다.'), 503)
  }
  if (result.status === 'not_linked') {
    // 첫 SSO 진입 전 — 앱은 "게임 시작 전" 상태로 표시
    return c.json({ success: false, code: 'user_not_linked', error: '아직 게임을 시작하지 않은 사용자입니다.' }, 404)
  }
  if (result.status === 'error') {
    console.error(`파트너 잔액 조회 실패: HTTP ${result.httpStatus}`)
    return c.json(fail('파트너 잔액 조회에 실패했습니다.'), 502)
  }
  return c.json(ok(result.data))
})

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
