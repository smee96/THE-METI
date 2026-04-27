import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const events = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 행사 목록 ─────────────────────────────────────────
events.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const groupId = c.req.query('group_id')
  const status = c.req.query('status') ?? 'upcoming'

  let query = `
    SELECT e.*, g.name as group_name, u.name as organizer_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'registered') as participant_count
    FROM events e
    JOIN groups g ON g.id = e.group_id
    JOIN users u ON u.id = e.organizer_id
    WHERE e.is_deleted = 0 AND e.visibility = 'public'
  `
  const params: unknown[] = []
  if (status) { query += ` AND e.status = ?`; params.push(status) }
  if (groupId) { query += ` AND e.group_id = ?`; params.push(groupId) }
  query += ` ORDER BY e.starts_at ASC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM events WHERE is_deleted = 0 AND visibility = 'public'`).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 행사 생성 (그룹 관리자) ──────────────────────────
events.post(
  '/',
  authMiddleware,
  zValidator('json', z.object({
    group_id: z.number().int().positive(),
    title: z.string().min(2).max(200),
    description: z.string().optional(),
    thumbnail_url: z.string().url().optional(),
    location: z.string().max(200).optional(),
    starts_at: z.string(),
    ends_at: z.string().optional(),
    visibility: z.enum(['public', 'group_only']).default('public'),
    registration_type: z.enum(['free', 'pre_required']).default('free'),
    entry_method: z.enum(['nfc_qr', 'qr', 'manual']).default('qr'),
    max_participants: z.number().int().positive().optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    // 관리자 확인
    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(body.group_id, userId).first<{ role: string }>()

    if (!member || !['admin', 'sub_admin'].includes(member.role)) {
      return c.json(fail('그룹 관리자만 행사를 생성할 수 있습니다.'), 403)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO events (group_id, organizer_id, title, description, thumbnail_url, location,
        starts_at, ends_at, visibility, registration_type, entry_method, max_participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.group_id, userId, body.title, body.description ?? null, body.thumbnail_url ?? null,
      body.location ?? null, body.starts_at, body.ends_at ?? null,
      body.visibility, body.registration_type, body.entry_method, body.max_participants ?? null
    ).run()

    return c.json(ok({ event_id: result.meta.last_row_id }, '행사가 생성되었습니다.'), 201)
  }
)

// ── 행사 상세 조회 ────────────────────────────────────
events.get('/:id', async (c) => {
  const eventId = c.req.param('id')

  const event = await c.env.DB.prepare(`
    SELECT e.*, g.name as group_name, u.name as organizer_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'registered') as participant_count
    FROM events e
    JOIN groups g ON g.id = e.group_id
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ? AND e.is_deleted = 0
  `).bind(eventId).first()

  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  return c.json(ok(event))
})

// ── 행사 참가 신청 ────────────────────────────────────
events.post('/:id/join', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const eventId = parseInt(c.req.param('id'))

  const event = await c.env.DB.prepare(`
    SELECT id, status, max_participants FROM events WHERE id = ? AND is_deleted = 0
  `).bind(eventId).first<{ id: number; status: string; max_participants: number | null }>()

  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)
  if (event.status === 'cancelled') return c.json(fail('취소된 행사입니다.'), 400)
  if (event.status === 'ended') return c.json(fail('종료된 행사입니다.'), 400)

  // 중복 신청 확인
  const existing = await c.env.DB.prepare(
    'SELECT status FROM event_participants WHERE event_id = ? AND user_id = ?'
  ).bind(eventId, userId).first<{ status: string }>()

  if (existing && existing.status === 'registered') {
    return c.json(fail('이미 참가 신청한 행사입니다.'), 409)
  }

  // 정원 확인
  if (event.max_participants) {
    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM event_participants WHERE event_id = ? AND status = 'registered'`
    ).bind(eventId).first<{ cnt: number }>()
    if ((count?.cnt ?? 0) >= event.max_participants) {
      return c.json(fail('행사 정원이 가득 찼습니다.'), 409)
    }
  }

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO event_participants (event_id, user_id, status)
    VALUES (?, ?, 'registered')
  `).bind(eventId, userId).run()

  return c.json(ok(null, '행사 참가 신청이 완료되었습니다.'), 201)
})

// ── 행사 입장 처리 (QR 스캔) ─────────────────────────
events.post('/:id/checkin', authMiddleware, async (c) => {
  const adminId = c.get('userId')
  const eventId = parseInt(c.req.param('id'))
  const { qr_token, user_id: targetUserId, entry_method } = await c.req.json()

  // 행사 관리자 확인
  const event = await c.env.DB.prepare(`
    SELECT e.group_id FROM events e WHERE e.id = ? AND e.is_deleted = 0
  `).bind(eventId).first<{ group_id: number }>()

  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const adminMember = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(event.group_id, adminId).first<{ role: string }>()

  if (!adminMember || !['admin', 'sub_admin'].includes(adminMember.role)) {
    return c.json(fail('권한이 없습니다.'), 403)
  }

  let resolvedUserId = targetUserId

  // QR 토큰으로 유저 확인
  if (qr_token) {
    const tokenRecord = await c.env.DB.prepare(`
      SELECT user_id FROM qr_tokens
      WHERE token = ? AND purpose = 'event_entry' AND event_id = ?
        AND used_at IS NULL AND expires_at > datetime('now')
    `).bind(qr_token, eventId).first<{ user_id: number }>()

    if (!tokenRecord) return c.json(fail('유효하지 않은 QR 코드입니다.'), 400)
    resolvedUserId = tokenRecord.user_id

    await c.env.DB.prepare(
      `UPDATE qr_tokens SET used_at = datetime('now') WHERE token = ?`
    ).bind(qr_token).run()
  }

  if (!resolvedUserId) return c.json(fail('유저 정보가 필요합니다.'), 400)

  // 체크인 처리
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE event_participants SET status = 'checked_in', checked_in_at = datetime('now'), entry_method = ?, updated_at = datetime('now')
      WHERE event_id = ? AND user_id = ?
    `).bind(entry_method || 'qr', eventId, resolvedUserId),
    c.env.DB.prepare(`
      INSERT INTO event_entry_logs (event_id, user_id, entry_method, processed_by)
      VALUES (?, ?, ?, ?)
    `).bind(eventId, resolvedUserId, entry_method || 'qr', adminId)
  ])

  const user = await c.env.DB.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(resolvedUserId).first()

  return c.json(ok({ user, checked_in: true }, '입장 처리가 완료되었습니다.'))
})

// ── 입장 현황 조회 (관리자) ──────────────────────────
events.get('/:id/participants', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const eventId = parseInt(c.req.param('id'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status')

  const event = await c.env.DB.prepare(`SELECT group_id FROM events WHERE id = ?`).bind(eventId).first<{ group_id: number }>()
  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(event.group_id, userId).first<{ role: string }>()

  if (!member || !['admin', 'sub_admin'].includes(member.role)) {
    return c.json(fail('권한이 없습니다.'), 403)
  }

  let query = `
    SELECT ep.*, u.name, u.email, u.avatar_url
    FROM event_participants ep
    JOIN users u ON u.id = ep.user_id
    WHERE ep.event_id = ?
  `
  const params: unknown[] = [eventId]
  if (status) { query += ` AND ep.status = ?`; params.push(status) }
  query += ` ORDER BY ep.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM event_participants WHERE event_id = ?').bind(eventId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

export default events
