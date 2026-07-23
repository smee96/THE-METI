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
import { sendPushToUsers } from '../lib/push'

const nfc = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 목록 조회 ─────────────────────────────────────────────
// GET /admin/nfc-cards?status=pending&page=1&limit=20
nfc.get('/', async (c) => {
  const status  = c.req.query('status')  // all | pending | approved | issued | deactivated | rejected
  const q       = c.req.query('q')       // 사용자명·이메일 검색
  const date    = c.req.query('date')    // YYYY-MM-DD, 신청일 일별(KST) — 어드민 일별 주문 처리용
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
  if (date) {
    // applied_at은 UTC 저장 → KST(+9h) 기준 달력일로 필터
    conditions.push("DATE(n.applied_at, '+9 hours') = ?")
    bindings.push(date)
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

// ── 통계 요약 ─────────────────────────────────────────────
// ⚠️ 정적 경로(/stats, /daily)는 반드시 /:id 앞에 등록 — Hono가 등록순 매칭이라
//    /:id 뒤에 두면 id='stats'로 잡혀 404가 난다(기존 버그 수정).
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

// ── 일별 요약 ─────────────────────────────────────────────
// GET /admin/nfc-cards/daily?days=30
// 신청일(KST) 기준 일별 건수 — 어드민이 어느 날에 주문이 몰렸는지, 미처리(pending) 몇 건인지 파악
nfc.get('/daily', async (c) => {
  const days = Math.min(Math.max(parseInt(c.req.query('days') ?? '30', 10) || 30, 1), 180)
  const rows = await c.env.DB.prepare(`
    SELECT
      DATE(applied_at, '+9 hours') AS day,
      COUNT(*)                                             AS total,
      SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'issued'   THEN 1 ELSE 0 END) AS issued
    FROM nfc_physical_cards
    WHERE DATE(applied_at, '+9 hours') >= DATE('now', '+9 hours', '-' || ? || ' days')
    GROUP BY day
    ORDER BY day DESC
  `).bind(days).all<{ day: string; total: number; pending: number; approved: number; issued: number }>()

  return c.json(ok(rows.results))
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
      'SELECT status, user_id, card_id FROM nfc_physical_cards WHERE id = ?'
    ).bind(id).first<{ status: string; user_id: number; card_id: number }>()

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

    // 신청자 알림 + 푸시 (앱 회신 §D-2 트리거③: approved/issued만, 응답 비차단)
    if ((action === 'approve' || action === 'issue') && current.user_id) {
      const newStatus = statusMap[action]  // approved | issued
      const title = action === 'approve' ? 'NFC 카드 신청 승인' : 'NFC 카드 발송'
      const body = action === 'approve'
        ? 'NFC 실물카드 신청이 승인되었습니다. 제작 후 발송됩니다.'
        : 'NFC 실물카드가 발송되었습니다. 배송 정보를 확인해주세요.'
      const data = {
        type: 'nfc_status',
        application_id: String(id),
        status: newStatus,
        card_id: String(current.card_id ?? '')
      }

      c.executionCtx.waitUntil((async () => {
        await c.env.DB.prepare(`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (?, 'nfc_status', ?, ?, ?)
        `).bind(current.user_id, title, body, JSON.stringify(data)).run()
        await sendPushToUsers(c.env, [current.user_id], { title, body, data })
      })())
    }

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

// ── 일괄 운송장 등록 ──────────────────────────────────────
// POST /admin/nfc-cards/bulk-tracking
// body: { items: [{ id, carrier, tracking_no }] }
nfc.post(
  '/bulk-tracking',
  zValidator('json', z.object({
    items: z.array(z.object({
      id:          z.number().int().positive(),
      carrier:     z.string().min(1),
      tracking_no: z.string().min(1),
    })).min(1).max(100),
  })),
  async (c) => {
    const { items } = c.req.valid('json')

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // id 목록으로 현재 상태 일괄 조회
    const ids = items.map(i => i.id)
    const placeholders = ids.map(() => '?').join(',')
    const existingRows = await c.env.DB.prepare(
      `SELECT id, status FROM nfc_physical_cards WHERE id IN (${placeholders})`
    ).bind(...ids).all<{ id: number; status: string }>()

    const existingMap = new Map(existingRows.results.map(r => [r.id, r.status]))

    const succeeded: number[] = []
    const skipped:   number[] = []

    // D1은 batch를 지원하므로 모든 업데이트를 한 번에 실행
    const stmts = items.flatMap(item => {
      const currentStatus = existingMap.get(item.id)
      // issued 상태이면서 운송장이 없는 것만 처리
      if (!currentStatus || currentStatus !== 'issued') {
        skipped.push(item.id)
        return []
      }
      succeeded.push(item.id)
      return [
        c.env.DB.prepare(
          `UPDATE nfc_physical_cards
           SET tracking_no = ?, carrier = ?, shipped_at = ?, updated_at = ?
           WHERE id = ? AND status = 'issued'`
        ).bind(item.tracking_no, item.carrier, now, now, item.id),
      ]
    })

    if (stmts.length > 0) {
      await c.env.DB.batch(stmts)
    }

    return c.json(ok(
      { succeeded: succeeded.length, skipped: skipped.length, skipped_ids: skipped },
      `${succeeded.length}건 운송장 등록 완료${skipped.length ? `, ${skipped.length}건 건너뜀` : ''}`
    ))
  }
)

export default nfc
