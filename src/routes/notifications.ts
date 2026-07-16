// ============================================================
// 알림함 API — /api/v1/notifications (앱 회신 2026-07-16 §F)
// notifications 테이블(0007)은 파트너 리워드 등에서 이미 적재 중
// ============================================================
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const notifications = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── GET /api/v1/notifications ─────────────────────────
// ?unread_only=1 로 안 읽은 알림만 조회 가능. 응답에 unread_count 포함
notifications.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const unreadOnly = c.req.query('unread_only') === '1'
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const whereClause = `user_id = ?${unreadOnly ? ' AND is_read = 0' : ''}`
  const [rows, countRow, unreadRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, type, title, body, data, is_read, read_at, created_at
      FROM notifications WHERE ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`
    ).bind(userId).first<{ total: number }>(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first<{ cnt: number }>()
  ])

  // data 컬럼(JSON 문자열) 파싱해서 내려줌
  const list = (rows.results as any[]).map(n => ({
    ...n,
    data: n.data ? safeParse(n.data) : null
  }))

  return c.json({
    ...paginate(list, countRow?.total ?? 0, page, limit),
    unread_count: unreadRow?.cnt ?? 0
  })
})

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return s }
}

// ── PATCH /api/v1/notifications/read-all ─────────────
// (동적 :id 라우트보다 먼저 등록)
notifications.patch('/read-all', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(`
    UPDATE notifications SET is_read = 1, read_at = datetime('now')
    WHERE user_id = ? AND is_read = 0
  `).bind(userId).run()

  return c.json(ok({ updated: result.meta.changes ?? 0 }, '모든 알림을 읽음 처리했습니다.'))
})

// ── PATCH /api/v1/notifications/:id/read ─────────────
notifications.patch('/:id/read', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json(fail('유효하지 않은 알림 ID입니다.'), 400)

  const result = await c.env.DB.prepare(`
    UPDATE notifications SET is_read = 1, read_at = datetime('now')
    WHERE id = ? AND user_id = ? AND is_read = 0
  `).bind(id, userId).run()

  if (!result.meta.changes) {
    const exists = await c.env.DB.prepare(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first()
    if (!exists) return c.json(fail('알림을 찾을 수 없습니다.'), 404)
  }
  return c.json(ok(null, '읽음 처리되었습니다.'))
})

export default notifications
