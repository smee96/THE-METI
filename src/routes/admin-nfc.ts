/**
 * 어드민 NFC 실물카드 관리 라우트
 * 마운트 위치: /api/v1/admin/nfc-cards
 *
 * 상태 흐름:
 *   pending → approved → issued (shipped_at 기록)
 *           → rejected  (재신청 가능 → pending 으로 되돌림)
 *   issued  → deactivated (분실/비활성)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const nfc = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 목록 조회 ─────────────────────────────────────────────
// GET /admin/nfc-cards?status=pending&page=1&limit=20
nfc.get('/', async (c) => {
  const status  = c.req.query('status')  // all | pending | approved | issued | deactivated | rejected
  const q       = c.req.query('q')       // 사용자명·이메일 검색
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    50
  )

  const conditions: string[] = []
  const bindings: unknown[]  = []

  if (status && status !== 'all') {
    conditions.push('n.status = ?')
    bindings.push(status)
  }
  if (q) {
    conditions.push('(u.name LIKE ? OR u.email LIKE ?)')
    bindings.push(`%${q}%`, `%${q}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        n.id, n.user_id, n.group_id, n.card_id,
        n.design_type, n.order_type, n.status,
        n.amount, n.payment_status,
        n.shipping_name, n.shipping_phone, n.shipping_zipcode,
        n.shipping_address, n.shipping_detail, n.shipping_memo,
        n.tracking_no, n.carrier,
        n.serial_no, n.nfc_uid,
        n.applied_at, n.issued_at, n.shipped_at, n.deactivated_at,
        n.admin_memo,
        u.name  AS user_name,
        u.email AS user_email,
        g.name  AS group_name
      FROM nfc_physical_cards n
      LEFT JOIN users  u ON u.id = n.user_id
      LEFT JOIN groups g ON g.id = n.group_id
      ${where}
      ORDER BY n.applied_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM nfc_physical_cards n
      LEFT JOIN users u ON u.id = n.user_id
      ${where}
    `).bind(...bindings).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 상세 조회 ─────────────────────────────────────────────
// GET /admin/nfc-cards/:id
nfc.get('/:id', async (c) => {
  const id = c.req.param('id')

  const row = await c.env.DB.prepare(`
    SELECT
      n.*,
      u.name  AS user_name,
      u.email AS user_email,
      u.phone AS user_phone,
      g.name  AS group_name,
      c.title AS card_title
    FROM nfc_physical_cards n
    LEFT JOIN users  u ON u.id = n.user_id
    LEFT JOIN groups g ON g.id = n.group_id
    LEFT JOIN cards  c ON c.id = n.card_id
    WHERE n.id = ?
  `).bind(id).first()

  if (!row) return c.json(fail('존재하지 않는 NFC 카드 주문입니다.'), 404)
  return c.json(ok(row))
})

// ── 상태 변경 / 발급 처리 ─────────────────────────────────
// PATCH /admin/nfc-cards/:id
nfc.patch(
  '/:id',
  zValidator('json', z.object({
    action:      z.enum(['approve', 'issue', 'reject', 'deactivate', 'reactivate']),
    nfc_uid:     z.string().optional(),
    serial_no:   z.string().optional(),
    tracking_no: z.string().optional(),
    carrier:     z.string().optional(),
    admin_memo:  z.string().optional(),
  })),
  async (c) => {
    const id = c.req.param('id')
    const { action, nfc_uid, serial_no, tracking_no, carrier, admin_memo } = c.req.valid('json')

    // 현재 상태 확인
    const current = await c.env.DB.prepare(
      'SELECT status FROM nfc_physical_cards WHERE id = ?'
    ).bind(id).first<{ status: string }>()

    if (!current) return c.json(fail('존재하지 않는 NFC 카드 주문입니다.'), 404)

    // 상태 전이 검증
    const allowed: Record<string, string[]> = {
      approve:    ['pending'],
      reject:     ['pending', 'approved'],
      issue:      ['approved'],
      deactivate: ['issued'],
      reactivate: ['deactivated'],
    }

    if (!allowed[action]?.includes(current.status)) {
      return c.json(fail(`현재 상태(${current.status})에서 ${action} 처리를 할 수 없습니다.`), 400)
    }

    const statusMap: Record<string, string> = {
      approve:    'approved',
      reject:     'pending',
      issue:      'issued',
      deactivate: 'deactivated',
      reactivate: 'issued',
    }

    const setClauses: string[] = [`status = '${statusMap[action]}'`, `updated_at = datetime('now')`]
    const values: unknown[]    = []

    if (action === 'issue') {
      setClauses.push(`issued_at = datetime('now')`)
      if (tracking_no) { setClauses.push('tracking_no = ?'); values.push(tracking_no) }
      if (carrier)     { setClauses.push('carrier = ?');     values.push(carrier) }
      if (nfc_uid)     { setClauses.push('nfc_uid = ?');     values.push(nfc_uid) }
      if (serial_no)   { setClauses.push('serial_no = ?');   values.push(serial_no) }
      if (tracking_no) {
        // 운송장 등록 시 shipped_at 기록
        setClauses.push(`shipped_at = datetime('now')`)
      }
    }
    if (action === 'deactivate') {
      setClauses.push(`deactivated_at = datetime('now')`)
    }
    if (admin_memo !== undefined) {
      setClauses.push('admin_memo = ?')
      values.push(admin_memo)
    }

    values.push(id)

    await c.env.DB.prepare(
      `UPDATE nfc_physical_cards SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    const messages: Record<string, string> = {
      approve:    '승인되었습니다.',
      reject:     '반려(재대기)되었습니다.',
      issue:      '발급(발송) 처리되었습니다.',
      deactivate: '비활성화되었습니다.',
      reactivate: '재활성화되었습니다.',
    }

    return c.json(ok(null, `NFC 카드가 ${messages[action]}`))
  }
)

// ── 운송장 단독 업데이트 ──────────────────────────────────
// PATCH /admin/nfc-cards/:id/tracking
nfc.patch(
  '/:id/tracking',
  zValidator('json', z.object({
    tracking_no: z.string().min(1),
    carrier:     z.string().min(1),
    admin_memo:  z.string().optional(),
  })),
  async (c) => {
    const id = c.req.param('id')
    const { tracking_no, carrier, admin_memo } = c.req.valid('json')

    const setClauses = [
      'tracking_no = ?',
      'carrier = ?',
      `shipped_at = datetime('now')`,
      `updated_at = datetime('now')`,
    ]
    const values: unknown[] = [tracking_no, carrier]

    if (admin_memo !== undefined) {
      setClauses.push('admin_memo = ?')
      values.push(admin_memo)
    }
    values.push(id)

    await c.env.DB.prepare(
      `UPDATE nfc_physical_cards SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return c.json(ok(null, '운송장 정보가 등록되었습니다.'))
  }
)

// ── 통계 요약 ─────────────────────────────────────────────
// GET /admin/nfc-cards/stats
nfc.get('/stats', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT status, COUNT(*) AS cnt
    FROM nfc_physical_cards
    GROUP BY status
  `).all<{ status: string; cnt: number }>()

  const stats: Record<string, number> = {
    pending: 0, approved: 0, issued: 0, deactivated: 0,
  }
  for (const r of rows.results) {
    if (r.status in stats) stats[r.status] = r.cnt
  }

  return c.json(ok(stats))
})

export default nfc
