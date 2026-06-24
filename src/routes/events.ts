import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const events = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const ADMIN_ROLES = ['admin', 'sub_admin']

async function getMemberRole(db: D1Database, groupId: number, userId: number) {
  return db.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()
}

// ══════════════════════════════════════════════════════════════
// GET /api/v1/events
// 전체 공개 행사 피드 (커뮤니티 행사 탭) — 인증 불필요
//   visibility='public' 인 행사 전체 (그룹 무관), 취소 제외
//   각 카드에 group_name / organizer_name 포함
// ══════════════════════════════════════════════════════════════
events.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status')   // upcoming | ongoing | ended

  let query = `
    SELECT e.*,
      g.name AS group_name,
      u.name AS organizer_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') AS participant_count
    FROM events e
    JOIN groups g ON g.id = e.group_id
    JOIN users u ON u.id = e.created_by
    WHERE e.visibility = 'public' AND e.status != 'cancelled'
  `
  const params: unknown[] = []
  let countWhere = `WHERE visibility = 'public' AND status != 'cancelled'`
  const countParams: unknown[] = []
  if (status) {
    query += ` AND e.status = ?`;  params.push(status)
    countWhere += ` AND status = ?`; countParams.push(status)
  }
  query += ` ORDER BY e.starts_at ASC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM events ${countWhere}`
    ).bind(...countParams).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/groups/:groupId/events
// 그룹 내 행사 목록
// ══════════════════════════════════════════════════════════════
events.get('/groups/:groupId/events', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status  = c.req.query('status')

  const member = await getMemberRole(c.env.DB, groupId, userId)
  if (!member) return c.json(fail('그룹 멤버만 조회할 수 있습니다.'), 403)

  let query = `
    SELECT e.*,
      u.name AS creator_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') AS participant_count
    FROM events e
    JOIN users u ON u.id = e.created_by
    WHERE e.group_id = ?
  `
  const params: unknown[] = [groupId]
  if (status) { query += ` AND e.status = ?`; params.push(status) }
  query += ` ORDER BY e.starts_at ASC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM events WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/groups/:groupId/events
// 행사 생성 (admin / sub_admin)
// 그룹 포인트 차감: 정원에 따라 1000 / 3000 / 5000 P
// ══════════════════════════════════════════════════════════════
events.post(
  '/groups/:groupId/events',
  authMiddleware,
  zValidator('json', z.object({
    title            : z.string().min(2).max(200),
    description      : z.string().max(2000).optional(),
    location         : z.string().max(200).optional(),
    starts_at        : z.string(),
    ends_at          : z.string().optional(),
    capacity         : z.number().int().positive().optional(),   // undefined = 무제한
    visibility       : z.enum(['public', 'group_only']).default('group_only'),
    registration_type: z.enum(['free', 'pre_required']).default('free'),
    entry_method     : z.enum(['qr', 'nfc_qr', 'manual']).default('qr'),
    entry_fee        : z.number().int().min(0).default(0),      // 참가비 (포인트)
  })),
  async (c) => {
    const userId  = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const body    = c.req.valid('json')

    // 권한 확인
    const member = await getMemberRole(c.env.DB, groupId, userId)
    if (!member || !ADMIN_ROLES.includes(member.role)) {
      return c.json(fail('그룹 관리자만 행사를 생성할 수 있습니다.'), 403)
    }

    // 개설 비용 계산 (정원 기준)
    let pointCost = 1000
    if (!body.capacity) {
      pointCost = 5000        // 무제한
    } else if (body.capacity > 100) {
      pointCost = 5000
    } else if (body.capacity > 30) {
      pointCost = 3000
    }

    // 그룹 포인트 확인 및 차감
    const groupPoint = await c.env.DB.prepare(
      `SELECT balance FROM group_points WHERE group_id = ?`
    ).bind(groupId).first<{ balance: number }>()

    const balance = groupPoint?.balance ?? 0
    if (balance < pointCost) {
      return c.json(fail('그룹 포인트가 부족합니다.', {
        error_code: 'insufficient_group_points',
        required  : pointCost,
        current   : balance,
        shortage  : pointCost - balance
      }), 402)
    }

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE group_points SET balance = balance - ?, updated_at = datetime('now') WHERE group_id = ?`
      ).bind(pointCost, groupId),
      c.env.DB.prepare(`
        INSERT INTO point_transactions
          (owner_type, owner_id, type, amount, description, created_by)
        VALUES ('group', ?, 'event_open_cost', ?, '행사 개설 비용', ?)
      `).bind(groupId, -pointCost, userId)
    ])

    const result = await c.env.DB.prepare(`
      INSERT INTO events
        (group_id, created_by, title, description, location,
         starts_at, ends_at, capacity, visibility, registration_type,
         entry_method, point_cost, entry_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId, userId, body.title, body.description ?? null,
      body.location ?? null, body.starts_at, body.ends_at ?? null,
      body.capacity ?? null, body.visibility, body.registration_type,
      body.entry_method, pointCost, body.entry_fee
    ).run()

    return c.json(ok({
      event_id  : result.meta.last_row_id,
      point_cost: pointCost,
      entry_fee : body.entry_fee
    }, '행사가 생성되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// GET /api/v1/events/:id
// 행사 상세 조회
// ══════════════════════════════════════════════════════════════
events.get('/:id', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const eventId = parseInt(c.req.param('id'))

  const event = await c.env.DB.prepare(`
    SELECT e.*,
      u.name AS creator_name,
      g.name AS group_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') AS participant_count
    FROM events e
    JOIN users u ON u.id = e.created_by
    JOIN groups g ON g.id = e.group_id
    WHERE e.id = ?
  `).bind(eventId).first()

  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const member = await getMemberRole(c.env.DB, (event as any).group_id, userId)
  if (!member && (event as any).visibility === 'group_only') {
    return c.json(fail('접근 권한이 없습니다.'), 403)
  }

  return c.json(ok(event))
})

// ══════════════════════════════════════════════════════════════
// PUT /api/v1/events/:id
// 행사 수정 (admin / sub_admin)
// ══════════════════════════════════════════════════════════════
events.put(
  '/:id',
  authMiddleware,
  zValidator('json', z.object({
    title            : z.string().min(2).max(200).optional(),
    description      : z.string().max(2000).optional(),
    location         : z.string().max(200).optional(),
    starts_at        : z.string().optional(),
    ends_at          : z.string().optional(),
    status           : z.enum(['upcoming', 'ongoing', 'ended', 'cancelled']).optional(),
    visibility       : z.enum(['public', 'group_only']).optional(),
    registration_type: z.enum(['free', 'pre_required']).optional(),
  })),
  async (c) => {
    const userId  = c.get('userId')
    const eventId = parseInt(c.req.param('id'))
    const body    = c.req.valid('json')

    const event = await c.env.DB.prepare(
      `SELECT id, group_id FROM events WHERE id = ?`
    ).bind(eventId).first<{ id: number; group_id: number }>()
    if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

    const member = await getMemberRole(c.env.DB, event.group_id, userId)
    if (!member || !ADMIN_ROLES.includes(member.role)) {
      return c.json(fail('수정 권한이 없습니다.'), 403)
    }

    const fields: string[] = []
    const vals: unknown[]  = []

    if (body.title !== undefined)             { fields.push('title = ?');             vals.push(body.title) }
    if (body.description !== undefined)       { fields.push('description = ?');       vals.push(body.description) }
    if (body.location !== undefined)          { fields.push('location = ?');          vals.push(body.location) }
    if (body.starts_at !== undefined)         { fields.push('starts_at = ?');         vals.push(body.starts_at) }
    if (body.ends_at !== undefined)           { fields.push('ends_at = ?');           vals.push(body.ends_at) }
    if (body.status !== undefined)            { fields.push('status = ?');            vals.push(body.status) }
    if (body.visibility !== undefined)        { fields.push('visibility = ?');        vals.push(body.visibility) }
    if (body.registration_type !== undefined) { fields.push('registration_type = ?'); vals.push(body.registration_type) }

    if (fields.length === 0) return c.json(fail('수정할 내용이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE events SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, eventId).run()

    return c.json(ok(null, '행사가 수정되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// DELETE /api/v1/events/:id
// 행사 취소 (admin / sub_admin)
// ══════════════════════════════════════════════════════════════
events.delete('/:id', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const eventId = parseInt(c.req.param('id'))

  const event = await c.env.DB.prepare(
    `SELECT id, group_id FROM events WHERE id = ?`
  ).bind(eventId).first<{ id: number; group_id: number }>()
  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const member = await getMemberRole(c.env.DB, event.group_id, userId)
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return c.json(fail('취소 권한이 없습니다.'), 403)
  }

  await c.env.DB.prepare(
    `UPDATE events SET status = 'cancelled' WHERE id = ?`
  ).bind(eventId).run()

  return c.json(ok(null, '행사가 취소되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/events/:id/join
// 행사 참가 신청 (그룹 멤버)
// entry_fee > 0 이면 개인 포인트 차감
// ══════════════════════════════════════════════════════════════
events.post('/:id/join', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const eventId = parseInt(c.req.param('id'))

  const event = await c.env.DB.prepare(`
    SELECT id, group_id, status, capacity, entry_fee FROM events WHERE id = ?
  `).bind(eventId).first<{
    id: number; group_id: number; status: string;
    capacity: number | null; entry_fee: number
  }>()

  if (!event)                       return c.json(fail('행사를 찾을 수 없습니다.'), 404)
  if (event.status === 'cancelled') return c.json(fail('취소된 행사입니다.'), 400)
  if (event.status === 'ended')     return c.json(fail('종료된 행사입니다.'), 400)

  const member = await getMemberRole(c.env.DB, event.group_id, userId)
  if (!member) return c.json(fail('그룹 멤버만 참가 신청할 수 있습니다.'), 403)

  // 중복 확인
  const existing = await c.env.DB.prepare(
    `SELECT status FROM event_participants WHERE event_id = ? AND user_id = ?`
  ).bind(eventId, userId).first<{ status: string }>()
  if (existing?.status === 'confirmed') return c.json(fail('이미 참가 신청한 행사입니다.'), 409)

  // 정원 확인
  if (event.capacity) {
    const cnt = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM event_participants WHERE event_id = ? AND status = 'confirmed'`
    ).bind(eventId).first<{ cnt: number }>()
    if ((cnt?.cnt ?? 0) >= event.capacity) {
      return c.json(fail('행사 정원이 가득 찼습니다.'), 409)
    }
  }

  // 참가비 차감
  if (event.entry_fee > 0) {
    const userPoint = await c.env.DB.prepare(
      `SELECT balance FROM user_points WHERE user_id = ?`
    ).bind(userId).first<{ balance: number }>()
    const balance = userPoint?.balance ?? 0
    if (balance < event.entry_fee) {
      return c.json(fail('포인트가 부족합니다.', {
        error_code: 'insufficient_points',
        required  : event.entry_fee,
        current   : balance,
        shortage  : event.entry_fee - balance
      }), 402)
    }

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE user_points SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?`
      ).bind(event.entry_fee, userId),
      c.env.DB.prepare(`
        INSERT INTO point_transactions
          (owner_type, owner_id, type, amount, description, ref_id)
        VALUES ('user', ?, 'event_entry_fee', ?, '행사 참가비', ?)
      `).bind(userId, -event.entry_fee, eventId),
      // 행사 포인트 → 그룹 포인트로 이체
      c.env.DB.prepare(
        `UPDATE group_points SET balance = balance + ?, updated_at = datetime('now') WHERE group_id = ?`
      ).bind(event.entry_fee, event.group_id),
    ])
  }

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO event_participants (event_id, user_id, status)
    VALUES (?, ?, 'confirmed')
  `).bind(eventId, userId).run()

  return c.json(ok(null, '행사 참가 신청이 완료되었습니다.'), 201)
})

// ══════════════════════════════════════════════════════════════
// DELETE /api/v1/events/:id/join
// 행사 참가 취소 (참가비 환불)
// ══════════════════════════════════════════════════════════════
events.delete('/:id/join', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const eventId = parseInt(c.req.param('id'))

  const event = await c.env.DB.prepare(
    `SELECT id, group_id, entry_fee FROM events WHERE id = ?`
  ).bind(eventId).first<{ id: number; group_id: number; entry_fee: number }>()
  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const existing = await c.env.DB.prepare(
    `SELECT id FROM event_participants WHERE event_id = ? AND user_id = ? AND status = 'confirmed'`
  ).bind(eventId, userId).first()
  if (!existing) return c.json(fail('참가 신청 내역이 없습니다.'), 404)

  await c.env.DB.prepare(
    `UPDATE event_participants SET status = 'cancelled' WHERE event_id = ? AND user_id = ?`
  ).bind(eventId, userId).run()

  // 참가비 환불
  if (event.entry_fee > 0) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE user_points SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`
      ).bind(event.entry_fee, userId),
      c.env.DB.prepare(`
        INSERT INTO point_transactions
          (owner_type, owner_id, type, amount, description, ref_id)
        VALUES ('user', ?, 'event_entry_refund', ?, '행사 참가 취소 환불', ?)
      `).bind(userId, event.entry_fee, eventId),
      c.env.DB.prepare(
        `UPDATE group_points SET balance = balance - ?, updated_at = datetime('now') WHERE group_id = ?`
      ).bind(event.entry_fee, event.group_id),
    ])
  }

  return c.json(ok(null, '참가 취소가 완료되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/events/:id/participants
// 참가자 목록 조회 (admin / sub_admin)
// ══════════════════════════════════════════════════════════════
events.get('/:id/participants', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const eventId = parseInt(c.req.param('id'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const event = await c.env.DB.prepare(
    `SELECT id, group_id FROM events WHERE id = ?`
  ).bind(eventId).first<{ id: number; group_id: number }>()
  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

  const member = await getMemberRole(c.env.DB, event.group_id, userId)
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return c.json(fail('권한이 없습니다.'), 403)
  }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT ep.*, u.name, u.email, u.avatar_url
      FROM event_participants ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ?
      ORDER BY ep.joined_at ASC LIMIT ? OFFSET ?
    `).bind(eventId, limit, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM event_participants WHERE event_id = ?`
    ).bind(eventId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/events/:id/checkin
// B-3: 행사 현장 체크인 (QR / NFC)
// - 참가 신청(confirmed) 상태인 멤버만 체크인 가능
// - 중복 체크인 방지
// - event_entry_logs 테이블 기록
// ══════════════════════════════════════════════════════════════
events.post(
  '/:id/checkin',
  authMiddleware,
  zValidator('json', z.object({
    // entry_method: 실제 DB 스키마 컬럼명 (nfc | qr | manual)
    entry_method: z.enum(['qr', 'nfc', 'manual']).default('qr'),
    qr_token    : z.string().optional(),  // QR 토큰 (선택적 검증용)
  })),
  async (c) => {
    const userId  = c.get('userId')
    const eventId = parseInt(c.req.param('id'))
    const body    = c.req.valid('json')

    // 행사 조회
    const event = await c.env.DB.prepare(`
      SELECT id, group_id, status, title, entry_method
      FROM events WHERE id = ?
    `).bind(eventId).first<{
      id: number; group_id: number; status: string;
      title: string; entry_method: string
    }>()

    if (!event) {
      return c.json(fail('행사를 찾을 수 없습니다.'), 404)
    }
    if (event.status === 'cancelled') {
      return c.json(fail('취소된 행사입니다.'), 400)
    }
    if (event.status === 'ended') {
      return c.json(fail('종료된 행사입니다.'), 400)
    }
    if (event.status === 'upcoming') {
      return c.json(fail('아직 시작되지 않은 행사입니다.'), 400)
    }

    // 참가 신청 확인 (confirmed 상태여야 체크인 가능)
    const participant = await c.env.DB.prepare(`
      SELECT id, status, checked_in_at
      FROM event_participants
      WHERE event_id = ? AND user_id = ?
    `).bind(eventId, userId).first<{
      id: number; status: string; checked_in_at: string | null
    }>()

    // status: 'confirmed'(join API 기존값) 또는 'registered'(DB 스키마 기본값) 모두 허용
    if (!participant || !['confirmed', 'registered'].includes(participant.status)) {
      return c.json(fail('참가 신청이 확인된 멤버만 체크인할 수 있습니다.'), 403)
    }

    // 중복 체크인 방지
    if (participant.checked_in_at) {
      return c.json(fail('이미 체크인한 행사입니다.', {
        checked_in_at: participant.checked_in_at
      }), 409)
    }

    const now = new Date().toISOString()

    // 체크인 처리 (배치: 참가자 checked_in_at 업데이트 + 입장 로그 기록)
    await c.env.DB.batch([
      // event_participants.checked_in_at 업데이트
      c.env.DB.prepare(`
        UPDATE event_participants
        SET checked_in_at = ?
        WHERE event_id = ? AND user_id = ?
      `).bind(now, eventId, userId),

      // event_entry_logs 기록 (실제 스키마: entry_method, processed_by, entered_at)
      c.env.DB.prepare(`
        INSERT INTO event_entry_logs
          (event_id, user_id, entry_method, entered_at)
        VALUES (?, ?, ?, ?)
      `).bind(eventId, userId, body.entry_method, now),
    ])

    return c.json(ok({
      event_id     : eventId,
      event_title  : event.title,
      checked_in_at: now,
      entry_method : body.entry_method,
    }, '체크인이 완료되었습니다.'), 201)
  }
)

export default events
