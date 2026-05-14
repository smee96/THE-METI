import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

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
