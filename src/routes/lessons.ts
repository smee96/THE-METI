import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'
import { debitWallet } from '../lib/wallet'

const lessons = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ══════════════════════════════════════════════════════════════
// 헬퍼: 그룹 내 역할 확인
// ══════════════════════════════════════════════════════════════
async function getMemberRole(db: D1Database, groupId: number, userId: number) {
  return db.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()
}

const MANAGE_ROLES = ['admin', 'sub_admin', 'instructor']
const ADMIN_ROLES  = ['admin', 'sub_admin']

// ══════════════════════════════════════════════════════════════
// GET /api/v1/groups/:groupId/lessons
// 그룹 내 레슨 목록 (그룹 멤버 전체 조회 가능)
// ══════════════════════════════════════════════════════════════
lessons.get('/groups/:groupId/lessons', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status  = c.req.query('status')

  const member = await getMemberRole(c.env.DB, groupId, userId)
  if (!member) return c.json(fail('그룹 멤버만 조회할 수 있습니다.'), 403)

  let query = `
    SELECT l.*,
      u.name   AS instructor_name,
      u.email  AS instructor_email,
      (SELECT COUNT(*) FROM lesson_registrations WHERE lesson_id = l.id AND status = 'confirmed') AS registered_count
    FROM lessons l
    JOIN users u ON u.id = l.instructor_id
    WHERE l.group_id = ?
  `
  const params: unknown[] = [groupId]
  if (status) { query += ` AND l.status = ?`; params.push(status) }
  query += ` ORDER BY l.scheduled_at ASC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM lessons WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/groups/:groupId/lessons
// 레슨 생성 (admin / sub_admin / instructor)
// 그룹 포인트 500P 차감
// ══════════════════════════════════════════════════════════════
lessons.post(
  '/groups/:groupId/lessons',
  authMiddleware,
  zValidator('json', z.object({
    instructor_id   : z.number().int().positive(),
    title           : z.string().min(1).max(200),
    description     : z.string().max(1000).optional(),
    schedule_type   : z.enum(['one-time', 'repeat']).default('one-time'),
    scheduled_at    : z.string(),
    duration_minutes: z.number().int().positive().default(60),
    capacity        : z.number().int().positive().optional(),
    location        : z.string().max(200).optional(),
    point_cost      : z.number().int().min(0).default(500),
  })),
  async (c) => {
    const userId  = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const body    = c.req.valid('json')

    // 권한 확인 (admin / sub_admin / instructor)
    const member = await getMemberRole(c.env.DB, groupId, userId)
    if (!member || !MANAGE_ROLES.includes(member.role)) {
      return c.json(fail('레슨은 그룹 관리자 또는 강사만 생성할 수 있습니다.'), 403)
    }

    // 강사가 해당 그룹의 멤버인지 확인
    const instructorMember = await getMemberRole(c.env.DB, groupId, body.instructor_id)
    if (!instructorMember || !MANAGE_ROLES.includes(instructorMember.role)) {
      return c.json(fail('강사는 그룹의 instructor / admin / sub_admin 역할이어야 합니다.'), 400)
    }

    // 그룹 포인트 잔액 사전 확인 (point_wallets 단일 원장)
    if (body.point_cost > 0) {
      const gWallet = await c.env.DB.prepare(
        `SELECT balance FROM point_wallets WHERE owner_type = 'group' AND owner_id = ?`
      ).bind(groupId).first<{ balance: number }>()

      const balance = gWallet?.balance ?? 0
      if (balance < body.point_cost) {
        return c.json(fail('그룹 포인트가 부족합니다.', {
          error_code: 'insufficient_group_points',
          required  : body.point_cost,
          current   : balance,
          shortage  : body.point_cost - balance
        }), 402)
      }
    }

    // 레슨 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO lessons
        (group_id, instructor_id, title, description, schedule_type,
         scheduled_at, duration_minutes, capacity, location, point_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId, body.instructor_id, body.title, body.description ?? null,
      body.schedule_type, body.scheduled_at, body.duration_minutes,
      body.capacity ?? null, body.location ?? null, body.point_cost
    ).run()
    const lessonId = result.meta.last_row_id as number

    // 그룹 포인트 차감 (개설 비용) — 실패 시 레슨 롤백
    if (body.point_cost > 0) {
      const debit = await debitWallet(c.env.DB, 'group', groupId, body.point_cost, {
        type: 'use_lesson_create',
        refType: 'lesson',
        refId: lessonId,
        description: '레슨 개설 비용',
      })
      if (!debit.ok) {
        await c.env.DB.prepare(`DELETE FROM lessons WHERE id = ?`).bind(lessonId).run()
        return c.json(fail('그룹 포인트가 부족합니다.', {
          error_code: 'insufficient_group_points',
          required  : body.point_cost,
          current   : debit.balance,
          shortage  : body.point_cost - debit.balance
        }), 402)
      }
    }

    return c.json(ok({ lesson_id: lessonId }, '레슨이 생성되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// GET /api/v1/lessons/:id
// 레슨 상세 조회
// ══════════════════════════════════════════════════════════════
lessons.get('/:id', authMiddleware, async (c) => {
  const userId   = c.get('userId')
  const lessonId = parseInt(c.req.param('id'))

  const lesson = await c.env.DB.prepare(`
    SELECT l.*,
      u.name  AS instructor_name,
      u.email AS instructor_email,
      g.name  AS group_name,
      (SELECT COUNT(*) FROM lesson_registrations WHERE lesson_id = l.id AND status = 'confirmed') AS registered_count
    FROM lessons l
    JOIN users u ON u.id = l.instructor_id
    JOIN groups g ON g.id = l.group_id
    WHERE l.id = ?
  `).bind(lessonId).first()

  if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)

  // 멤버 확인
  const member = await getMemberRole(c.env.DB, (lesson as any).group_id, userId)
  if (!member) return c.json(fail('접근 권한이 없습니다.'), 403)

  // 관리자/강사에게는 등록자 목록도 제공
  let registrations = null
  if (MANAGE_ROLES.includes(member.role)) {
    const rows = await c.env.DB.prepare(`
      SELECT lr.*, u.name, u.email, u.avatar_url
      FROM lesson_registrations lr
      JOIN users u ON u.id = lr.user_id
      WHERE lr.lesson_id = ?
      ORDER BY lr.created_at ASC
    `).bind(lessonId).all()
    registrations = rows.results
  }

  return c.json(ok({ ...lesson, registrations }))
})

// ══════════════════════════════════════════════════════════════
// PUT /api/v1/lessons/:id
// 레슨 수정 (admin / sub_admin / 해당 강사)
// ══════════════════════════════════════════════════════════════
lessons.put(
  '/:id',
  authMiddleware,
  zValidator('json', z.object({
    title           : z.string().min(1).max(200).optional(),
    description     : z.string().max(1000).optional(),
    scheduled_at    : z.string().optional(),
    duration_minutes: z.number().int().positive().optional(),
    capacity        : z.number().int().positive().nullable().optional(),
    location        : z.string().max(200).optional(),
    status          : z.enum(['upcoming', 'ongoing', 'ended', 'cancelled']).optional(),
  })),
  async (c) => {
    const userId   = c.get('userId')
    const lessonId = parseInt(c.req.param('id'))
    const body     = c.req.valid('json')

    const lesson = await c.env.DB.prepare(
      `SELECT id, group_id, instructor_id FROM lessons WHERE id = ?`
    ).bind(lessonId).first<{ id: number; group_id: number; instructor_id: number }>()

    if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)

    const member = await getMemberRole(c.env.DB, lesson.group_id, userId)
    const isInstructor = lesson.instructor_id === userId
    if (!member || (!ADMIN_ROLES.includes(member.role) && !isInstructor)) {
      return c.json(fail('수정 권한이 없습니다.'), 403)
    }

    const fields: string[] = []
    const vals: unknown[]  = []

    if (body.title !== undefined)            { fields.push('title = ?');            vals.push(body.title) }
    if (body.description !== undefined)      { fields.push('description = ?');      vals.push(body.description) }
    if (body.scheduled_at !== undefined)     { fields.push('scheduled_at = ?');     vals.push(body.scheduled_at) }
    if (body.duration_minutes !== undefined) { fields.push('duration_minutes = ?'); vals.push(body.duration_minutes) }
    if (body.capacity !== undefined)         { fields.push('capacity = ?');         vals.push(body.capacity) }
    if (body.location !== undefined)         { fields.push('location = ?');         vals.push(body.location) }
    if (body.status !== undefined)           { fields.push('status = ?');           vals.push(body.status) }

    if (fields.length === 0) return c.json(fail('수정할 내용이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, lessonId).run()

    return c.json(ok(null, '레슨이 수정되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// DELETE /api/v1/lessons/:id
// 레슨 삭제 (admin / sub_admin 전용)
// ══════════════════════════════════════════════════════════════
lessons.delete('/:id', authMiddleware, async (c) => {
  const userId   = c.get('userId')
  const lessonId = parseInt(c.req.param('id'))

  const lesson = await c.env.DB.prepare(
    `SELECT id, group_id FROM lessons WHERE id = ?`
  ).bind(lessonId).first<{ id: number; group_id: number }>()

  if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)

  const member = await getMemberRole(c.env.DB, lesson.group_id, userId)
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return c.json(fail('삭제 권한이 없습니다.'), 403)
  }

  await c.env.DB.prepare(
    `UPDATE lessons SET status = 'cancelled' WHERE id = ?`
  ).bind(lessonId).run()

  return c.json(ok(null, '레슨이 취소되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/lessons/:id/register
// 레슨 수강 신청 (그룹 멤버)
// ══════════════════════════════════════════════════════════════
lessons.post('/:id/register', authMiddleware, async (c) => {
  const userId   = c.get('userId')
  const lessonId = parseInt(c.req.param('id'))

  const lesson = await c.env.DB.prepare(`
    SELECT id, group_id, status, capacity FROM lessons WHERE id = ?
  `).bind(lessonId).first<{ id: number; group_id: number; status: string; capacity: number | null }>()

  if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)
  if (lesson.status === 'cancelled') return c.json(fail('취소된 레슨입니다.'), 400)
  if (lesson.status === 'ended')     return c.json(fail('종료된 레슨입니다.'), 400)

  const member = await getMemberRole(c.env.DB, lesson.group_id, userId)
  if (!member) return c.json(fail('그룹 멤버만 수강 신청할 수 있습니다.'), 403)

  // 중복 신청 확인
  const existing = await c.env.DB.prepare(
    `SELECT status FROM lesson_registrations WHERE lesson_id = ? AND user_id = ?`
  ).bind(lessonId, userId).first<{ status: string }>()

  if (existing?.status === 'confirmed') return c.json(fail('이미 수강 신청한 레슨입니다.'), 409)

  // 정원 확인
  if (lesson.capacity) {
    const cnt = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM lesson_registrations WHERE lesson_id = ? AND status = 'confirmed'`
    ).bind(lessonId).first<{ cnt: number }>()
    if ((cnt?.cnt ?? 0) >= lesson.capacity) {
      return c.json(fail('수강 정원이 가득 찼습니다.'), 409)
    }
  }

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO lesson_registrations (lesson_id, user_id, status)
    VALUES (?, ?, 'confirmed')
  `).bind(lessonId, userId).run()

  return c.json(ok(null, '수강 신청이 완료되었습니다.'), 201)
})

// ══════════════════════════════════════════════════════════════
// DELETE /api/v1/lessons/:id/register
// 수강 신청 취소
// ══════════════════════════════════════════════════════════════
lessons.delete('/:id/register', authMiddleware, async (c) => {
  const userId   = c.get('userId')
  const lessonId = parseInt(c.req.param('id'))

  const existing = await c.env.DB.prepare(
    `SELECT id FROM lesson_registrations WHERE lesson_id = ? AND user_id = ? AND status = 'confirmed'`
  ).bind(lessonId, userId).first()

  if (!existing) return c.json(fail('수강 신청 내역이 없습니다.'), 404)

  await c.env.DB.prepare(
    `UPDATE lesson_registrations SET status = 'cancelled' WHERE lesson_id = ? AND user_id = ?`
  ).bind(lessonId, userId).run()

  return c.json(ok(null, '수강 신청이 취소되었습니다.'))
})

export default lessons
