/**
 * 어드민 신고 관리 라우트
 * 마운트 위치: /api/v1/admin/reports
 *
 * 상태 흐름:
 *   pending → reviewed → resolved (처리 완료)
 *                      → dismissed (기각)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 목록 조회 ─────────────────────────────────────────────
// GET /admin/reports?status=pending&target_type=user&q=&page=1
reports.get('/', async (c) => {
  const status      = c.req.query('status')      // pending | reviewed | resolved | dismissed | all
  const targetType  = c.req.query('target_type') // user | message | card | group | (empty=all)
  const q           = c.req.query('q')           // 신고자명·이메일 검색
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    30
  )

  const conditions: string[] = []
  const bindings: unknown[]  = []

  if (status && status !== 'all') {
    conditions.push('r.status = ?')
    bindings.push(status)
  }
  if (targetType) {
    conditions.push('r.target_type = ?')
    bindings.push(targetType)
  }
  if (q) {
    conditions.push('(rep.name LIKE ? OR rep.email LIKE ?)')
    bindings.push(`%${q}%`, `%${q}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        r.id, r.target_type, r.target_id,
        r.reason, r.description, r.status,
        r.reviewed_at, r.created_at,
        rep.id    AS reporter_id,
        rep.name  AS reporter_name,
        rep.email AS reporter_email,
        rv.name   AS reviewer_name
      FROM reports r
      JOIN  users rep ON rep.id = r.reporter_id
      LEFT JOIN users rv  ON rv.id  = r.reviewed_by
      ${where}
      ORDER BY
        CASE r.status WHEN 'pending' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
        r.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM reports r
      JOIN users rep ON rep.id = r.reporter_id
      ${where}
    `).bind(...bindings).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 상세 조회 ─────────────────────────────────────────────
// GET /admin/reports/:id
reports.get('/:id', async (c) => {
  const id = c.req.param('id')

  const row = await c.env.DB.prepare(`
    SELECT
      r.*,
      rep.name  AS reporter_name,
      rep.email AS reporter_email,
      rv.name   AS reviewer_name,
      rv.email  AS reviewer_email
    FROM reports r
    JOIN  users rep ON rep.id = r.reporter_id
    LEFT JOIN users rv  ON rv.id  = r.reviewed_by
    WHERE r.id = ?
  `).bind(id).first()

  if (!row) return c.json(fail('존재하지 않는 신고입니다.'), 404)

  // 신고 대상 부가 정보 조회 (target_type에 따라 다름)
  const report = row as Record<string, unknown>
  let targetInfo: Record<string, unknown> | null = null

  if (report.target_type === 'user') {
    targetInfo = await c.env.DB.prepare(
      'SELECT id, name, email, status FROM users WHERE id = ?'
    ).bind(report.target_id).first() as Record<string, unknown> | null
  } else if (report.target_type === 'card') {
    targetInfo = await c.env.DB.prepare(
      'SELECT c.id, c.title, u.name AS owner_name, u.email AS owner_email FROM cards c JOIN users u ON u.id = c.user_id WHERE c.id = ?'
    ).bind(report.target_id).first() as Record<string, unknown> | null
  } else if (report.target_type === 'group') {
    targetInfo = await c.env.DB.prepare(
      'SELECT id, name, status FROM groups WHERE id = ?'
    ).bind(report.target_id).first() as Record<string, unknown> | null
  } else if (report.target_type === 'message') {
    targetInfo = await c.env.DB.prepare(
      'SELECT m.id, m.content, u.name AS sender_name FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?'
    ).bind(report.target_id).first() as Record<string, unknown> | null
  }

  return c.json(ok({ ...report, target_info: targetInfo }))
})

// ── 상태 변경 (처리) ──────────────────────────────────────
// PATCH /admin/reports/:id
reports.patch(
  '/:id',
  zValidator('json', z.object({
    status:     z.enum(['reviewed', 'resolved', 'dismissed']),
    admin_note: z.string().optional(),  // 어드민 처리 메모 (추후 확장용)
  })),
  async (c) => {
    const id      = c.req.param('id')
    const adminId = c.get('userId')
    const { status } = c.req.valid('json')

    const current = await c.env.DB.prepare(
      'SELECT status FROM reports WHERE id = ?'
    ).bind(id).first<{ status: string }>()

    if (!current) return c.json(fail('존재하지 않는 신고입니다.'), 404)

    // pending → reviewed → resolved|dismissed
    if (status === 'reviewed' && current.status !== 'pending') {
      return c.json(fail('검토 처리는 대기(pending) 상태에서만 가능합니다.'), 400)
    }
    if ((status === 'resolved' || status === 'dismissed') &&
        !['pending', 'reviewed'].includes(current.status)) {
      return c.json(fail('이미 처리 완료된 신고입니다.'), 400)
    }

    await c.env.DB.prepare(`
      UPDATE reports
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).bind(status, adminId, id).run()

    const labels: Record<string, string> = {
      reviewed:  '검토 중으로 변경되었습니다.',
      resolved:  '처리 완료 처리되었습니다.',
      dismissed: '기각 처리되었습니다.',
    }

    return c.json(ok(null, labels[status]))
  }
)

// ── 신고 대상 유저 계정 정지/정상화 ──────────────────────
// POST /admin/reports/:id/user-action
// 신고 대상이 user 타입일 때만 사용 가능
reports.post(
  '/:id/user-action',
  zValidator('json', z.object({
    action: z.enum(['suspend', 'activate']),  // suspend: 정지, activate: 정상화
    reason: z.string().max(500).optional(),
  })),
  async (c) => {
    const id      = c.req.param('id')
    const adminId = c.get('userId')
    const { action, reason } = c.req.valid('json')

    // 신고 조회 및 target_type 확인
    const report = await c.env.DB.prepare(
      'SELECT id, target_type, target_id, status FROM reports WHERE id = ?'
    ).bind(id).first<{ id: number; target_type: string; target_id: number; status: string }>()

    if (!report) return c.json(fail('존재하지 않는 신고입니다.'), 404)
    if (report.target_type !== 'user') {
      return c.json(fail('유저 신고 건에만 계정 제재를 적용할 수 있습니다.'), 400)
    }

    // 대상 유저 확인
    const targetUser = await c.env.DB.prepare(
      'SELECT id, name, is_active FROM users WHERE id = ? AND is_deleted = 0'
    ).bind(report.target_id).first<{ id: number; name: string; is_active: number }>()

    if (!targetUser) return c.json(fail('대상 유저를 찾을 수 없습니다.'), 404)

    const newIsActive = action === 'activate' ? 1 : 0

    await c.env.DB.prepare(
      `UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newIsActive, report.target_id).run()

    // 신고 상태를 resolved로 자동 업데이트 (정지 처리 시)
    if (action === 'suspend' && ['pending', 'reviewed'].includes(report.status)) {
      await c.env.DB.prepare(`
        UPDATE reports
        SET status = 'resolved', reviewed_by = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).bind(adminId, id).run()
    }

    const msg = action === 'suspend'
      ? `${targetUser.name} 계정이 정지되었습니다.`
      : `${targetUser.name} 계정이 정상화되었습니다.`

    return c.json(ok({ user_id: report.target_id, is_active: newIsActive }, msg))
  }
)

// ── 상태별 + 대상유형별 카운트 요약 ──────────────────────
// GET /admin/reports/stats
reports.get('/stats', async (c) => {
  const [statusRows, typeRows, trendRows] = await Promise.all([
    // 상태별 카운트
    c.env.DB.prepare(`
      SELECT status, COUNT(*) AS cnt FROM reports GROUP BY status
    `).all<{ status: string; cnt: number }>(),

    // 대상 유형별 카운트
    c.env.DB.prepare(`
      SELECT target_type, COUNT(*) AS cnt FROM reports GROUP BY target_type
    `).all<{ target_type: string; cnt: number }>(),

    // 최근 7일 일별 신고 수
    c.env.DB.prepare(`
      SELECT
        date(created_at) AS day,
        COUNT(*) AS cnt
      FROM reports
      WHERE created_at >= date('now', '-6 days')
      GROUP BY day
      ORDER BY day ASC
    `).all<{ day: string; cnt: number }>(),
  ])

  const byStatus: Record<string, number> = {
    pending: 0, reviewed: 0, resolved: 0, dismissed: 0,
  }
  for (const r of statusRows.results) {
    if (r.status in byStatus) byStatus[r.status] = r.cnt
  }

  const byType: Record<string, number> = { user: 0, card: 0, group: 0, message: 0 }
  for (const r of typeRows.results) {
    byType[r.target_type] = r.cnt
  }

  return c.json(ok({ by_status: byStatus, by_type: byType, trend: trendRows.results }))
})

export default reports
