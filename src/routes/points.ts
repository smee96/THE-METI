import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'
import { creditWallet } from '../lib/wallet'

const points = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 헬퍼: 지갑 조회 or 생성 ────────────────────────────────
async function getOrCreateWallet(
  db: D1Database,
  ownerType: 'user' | 'group',
  ownerId: number
): Promise<{ id: number; balance: number }> {
  const existing = await db.prepare(
    `SELECT id, balance FROM point_wallets WHERE owner_type = ? AND owner_id = ?`
  ).bind(ownerType, ownerId).first<{ id: number; balance: number }>()

  if (existing) return existing

  const result = await db.prepare(
    `INSERT INTO point_wallets (owner_type, owner_id, balance) VALUES (?, ?, 0)`
  ).bind(ownerType, ownerId).run()

  return { id: result.meta.last_row_id as number, balance: 0 }
}

// ══════════════════════════════════════════════════════════
// 개인 포인트
// ══════════════════════════════════════════════════════════

// ── GET /api/v1/points/balance — 내 포인트 잔액 ────────────
points.get('/balance', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const wallet = await getOrCreateWallet(c.env.DB, 'user', userId)

  // 만료 예정 포인트 (7일 이내)
  const expiringSoon = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM point_transactions
    WHERE wallet_id = ?
      AND amount > 0
      AND expires_at IS NOT NULL
      AND expires_at > datetime('now')
      AND expires_at <= datetime('now', '+7 days')
  `).bind(wallet.id).first<{ total: number }>()

  return c.json(ok({
    balance: wallet.balance,
    expiring_soon: expiringSoon?.total ?? 0
  }))
})

// ── GET /api/v1/points/history — 포인트 내역 ───────────────
points.get('/history', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const wallet = await getOrCreateWallet(c.env.DB, 'user', userId)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, type, point_type, amount, balance_after,
             ref_type, ref_id, description, expires_at, created_at
      FROM point_transactions
      WHERE wallet_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(wallet.id, limit, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM point_transactions WHERE wallet_id = ?`
    ).bind(wallet.id).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── POST /api/v1/points/transfer — 개인→그룹 포인트 이전 ───
points.post(
  '/transfer',
  authMiddleware,
  zValidator('json', z.object({
    group_id: z.number().int().positive(),
    amount:   z.number().int().positive('이전할 포인트는 1 이상이어야 합니다.')
  })),
  async (c) => {
    const userId  = c.get('userId')
    const { group_id, amount } = c.req.valid('json')

    // 내 그룹 멤버 여부 확인
    const member = await c.env.DB.prepare(`
      SELECT id FROM group_members
      WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).bind(group_id, userId).first()
    if (!member) return c.json(fail('해당 그룹의 멤버가 아닙니다.'), 403)

    const userWallet  = await getOrCreateWallet(c.env.DB, 'user',  userId)
    const groupWallet = await getOrCreateWallet(c.env.DB, 'group', group_id)

    if (userWallet.balance < amount) {
      return c.json(fail('포인트 잔액이 부족합니다.'), 400)
    }

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    const userBalAfter  = userWallet.balance  - amount
    const groupBalAfter = groupWallet.balance + amount

    await c.env.DB.batch([
      // 개인 지갑 차감
      c.env.DB.prepare(
        `UPDATE point_wallets SET balance = ?, total_used = total_used + ?, updated_at = ? WHERE id = ?`
      ).bind(userBalAfter, amount, now, userWallet.id),
      // 개인 트랜잭션 기록
      c.env.DB.prepare(`
        INSERT INTO point_transactions
          (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, created_at)
        VALUES (?, 'use_transfer_out', 'transfer', ?, ?, 'group', ?, ?, ?)
      `).bind(userWallet.id, -amount, userBalAfter, group_id, `그룹(${group_id})으로 포인트 이전`, now),
      // 그룹 지갑 적립
      c.env.DB.prepare(
        `UPDATE point_wallets SET balance = ?, total_charged = total_charged + ?, updated_at = ? WHERE id = ?`
      ).bind(groupBalAfter, amount, now, groupWallet.id),
      // 그룹 트랜잭션 기록
      c.env.DB.prepare(`
        INSERT INTO point_transactions
          (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, expires_at, created_at)
        VALUES (?, 'charge_transfer_in', 'transfer', ?, ?, 'user', ?, ?, ?, ?)
      `).bind(groupWallet.id, amount, groupBalAfter, userId, `유저(${userId})로부터 포인트 이전`, expiresAt, now),
    ])

    return c.json(ok({
      transferred: amount,
      user_balance:  userBalAfter,
      group_balance: groupBalAfter
    }, `${amount.toLocaleString()}P 이전 완료`))
  }
)

// ══════════════════════════════════════════════════════════
// 포인트 충전 (토스페이먼츠 웹 결제)
//
// 주문생성(pending) → 프론트가 토스 결제창 → 리다이렉트 페이지가
// confirm 호출 → 토스 승인 API 검증 → paid + creditWallet 지급
// ══════════════════════════════════════════════════════════

// ── GET /api/v1/points/charge/config — 결제 가능 여부 + 클라이언트 키 ──
points.get('/charge/config', authMiddleware, async (c) => {
  const enabled = Boolean(c.env.TOSS_CLIENT_KEY && c.env.TOSS_SECRET_KEY)
  return c.json(ok({
    enabled,
    pg: 'toss',
    client_key: enabled ? c.env.TOSS_CLIENT_KEY : null,
  }))
})

// ── POST /api/v1/points/charge/orders — 충전 주문 생성 ─────
points.post(
  '/charge/orders',
  authMiddleware,
  zValidator('json', z.object({
    charge_product_id: z.number().int().positive(),
    custom_amount:     z.number().int().positive().optional(),  // is_custom 상품일 때
    owner_type:        z.enum(['user', 'group']).default('user'),
    group_id:          z.number().int().positive().optional(),  // owner_type=group일 때
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    if (!c.env.TOSS_CLIENT_KEY || !c.env.TOSS_SECRET_KEY) {
      return c.json(fail('결제 기능 준비 중입니다.'), 503)
    }

    const product = await c.env.DB.prepare(`
      SELECT id, title, amount_krw, points, is_custom, min_amount
      FROM point_charge_products
      WHERE id = ? AND is_active = 1
    `).bind(body.charge_product_id).first<{
      id: number; title: string; amount_krw: number; points: number;
      is_custom: number; min_amount: number | null
    }>()
    if (!product) return c.json(fail('충전 상품을 찾을 수 없습니다.'), 404)

    // 금액/포인트 확정 (직접입력은 1P = 1원)
    let amountKrw = product.amount_krw
    let pointsAmt = product.points
    if (product.is_custom) {
      const min = product.min_amount ?? 10000
      if (!body.custom_amount) return c.json(fail('충전 금액을 입력해주세요.'), 400)
      if (body.custom_amount < min) {
        return c.json(fail(`최소 충전 금액은 ${min.toLocaleString()}원입니다.`), 400)
      }
      if (body.custom_amount > 10000000) {
        return c.json(fail('1회 최대 충전 금액은 10,000,000원입니다.'), 400)
      }
      amountKrw = body.custom_amount
      pointsAmt = body.custom_amount
    }

    // 지급 대상 지갑 확인 (그룹이면 admin/sub_admin만)
    let ownerId = userId
    if (body.owner_type === 'group') {
      if (!body.group_id) return c.json(fail('group_id가 필요합니다.'), 400)
      const member = await c.env.DB.prepare(`
        SELECT role FROM group_members
        WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).bind(body.group_id, userId).first<{ role: string }>()
      if (!member || !['admin', 'sub_admin'].includes(member.role)) {
        return c.json(fail('그룹 관리자만 그룹 포인트를 충전할 수 있습니다.'), 403)
      }
      ownerId = body.group_id
    }

    const orderUid = `CHG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    await c.env.DB.prepare(`
      INSERT INTO point_charge_orders
        (order_uid, user_id, owner_type, owner_id, charge_product_id, amount_krw, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(orderUid, userId, body.owner_type, ownerId, product.id, amountKrw, pointsAmt).run()

    return c.json(ok({
      order_uid:  orderUid,
      order_name: product.is_custom ? `ELID 포인트 ${pointsAmt.toLocaleString()}P` : product.title,
      amount_krw: amountKrw,
      points:     pointsAmt,
    }, '충전 주문이 생성되었습니다.'), 201)
  }
)

// ── POST /api/v1/points/charge/orders/confirm — 토스 승인 + 포인트 지급 ──
points.post(
  '/charge/orders/confirm',
  authMiddleware,
  zValidator('json', z.object({
    order_uid:   z.string().min(1),
    payment_key: z.string().min(1),
    amount:      z.number().int().positive(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    if (!c.env.TOSS_SECRET_KEY) return c.json(fail('결제 기능 준비 중입니다.'), 503)

    const order = await c.env.DB.prepare(`
      SELECT id, order_uid, user_id, owner_type, owner_id, amount_krw, points, status
      FROM point_charge_orders
      WHERE order_uid = ? AND user_id = ?
    `).bind(body.order_uid, userId).first<{
      id: number; order_uid: string; user_id: number;
      owner_type: 'user' | 'group'; owner_id: number;
      amount_krw: number; points: number; status: string
    }>()
    if (!order) return c.json(fail('충전 주문을 찾을 수 없습니다.'), 404)

    // 멱등: 이미 지급된 주문은 재승인 없이 성공 응답
    if (order.status === 'paid') {
      return c.json(ok({ order_uid: order.order_uid, points: order.points, duplicate: true }))
    }
    if (order.status !== 'pending') {
      return c.json(fail('이미 처리된 주문입니다.'), 409)
    }
    if (order.amount_krw !== body.amount) {
      return c.json(fail('결제 금액이 주문 금액과 다릅니다.'), 400)
    }

    // 토스 결제 승인 (서버사이드 검증)
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${c.env.TOSS_SECRET_KEY}:`)}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        paymentKey: body.payment_key,
        orderId:    body.order_uid,
        amount:     body.amount,
      }),
    })

    if (!tossRes.ok) {
      const err = await tossRes.json().catch(() => ({})) as { code?: string; message?: string }
      await c.env.DB.prepare(`
        UPDATE point_charge_orders
        SET status = 'failed', fail_reason = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'pending'
      `).bind(`${err.code ?? tossRes.status}: ${err.message ?? '승인 실패'}`, order.id).run()
      return c.json(fail(err.message ?? '결제 승인에 실패했습니다.'), 400)
    }

    // pending → paid 선점 (동시 confirm 이중지급 방지)
    const mark = await c.env.DB.prepare(`
      UPDATE point_charge_orders
      SET status = 'paid', payment_key = ?, approved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'pending'
    `).bind(body.payment_key, order.id).run()
    if (!mark.meta.changes) {
      return c.json(ok({ order_uid: order.order_uid, points: order.points, duplicate: true }))
    }

    const credit = await creditWallet(c.env.DB, order.owner_type, order.owner_id, order.points, {
      type:        'charge_web',
      pointType:   'charged',
      refType:     'charge_order',
      refId:       order.id,
      description: `포인트 충전 (토스, ${order.amount_krw.toLocaleString()}원)`,
    })

    return c.json(ok({
      order_uid:     order.order_uid,
      points:        order.points,
      balance_after: credit.balanceAfter,
      owner_type:    order.owner_type,
    }, `${order.points.toLocaleString()}P 충전이 완료되었습니다.`))
  }
)

// ══════════════════════════════════════════════════════════
// 그룹 포인트
// ══════════════════════════════════════════════════════════

// ── GET /api/v1/points/groups/:groupId/balance — 그룹 포인트 잔액 ──
points.get('/groups/:groupId/balance', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = Number(c.req.param('groupId'))

  const member = await c.env.DB.prepare(`
    SELECT role FROM group_members
    WHERE group_id = ? AND user_id = ? AND status = 'active'
  `).bind(groupId, userId).first<{ role: string }>()
  if (!member) return c.json(fail('해당 그룹의 멤버가 아닙니다.'), 403)

  const wallet = await getOrCreateWallet(c.env.DB, 'group', groupId)

  return c.json(ok({
    group_id: groupId,
    balance:  wallet.balance
  }))
})

// ── GET /api/v1/points/groups/:groupId/history — 그룹 포인트 내역 ──
points.get('/groups/:groupId/history', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = Number(c.req.param('groupId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  // 그룹 멤버 + admin/sub_admin만 조회 가능
  const member = await c.env.DB.prepare(`
    SELECT role FROM group_members
    WHERE group_id = ? AND user_id = ? AND status = 'active'
  `).bind(groupId, userId).first<{ role: string }>()
  if (!member) return c.json(fail('해당 그룹의 멤버가 아닙니다.'), 403)
  if (!['admin', 'sub_admin'].includes(member.role)) {
    return c.json(fail('그룹 관리자만 포인트 내역을 조회할 수 있습니다.'), 403)
  }

  const wallet = await getOrCreateWallet(c.env.DB, 'group', groupId)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, type, point_type, amount, balance_after,
             ref_type, ref_id, description, expires_at, created_at
      FROM point_transactions
      WHERE wallet_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(wallet.id, limit, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM point_transactions WHERE wallet_id = ?`
    ).bind(wallet.id).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

export default points
