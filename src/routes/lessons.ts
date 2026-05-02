import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const lessons = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── GET /lessons/:groupId/schedules ───────────────────
// 레슨 그룹의 일정 목록 조회
lessons.get('/:groupId/schedules', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status')

  // 그룹 접근권한: 멤버 또는 보호자
  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  const isGuardian = await c.env.DB.prepare(`
    SELECT ug.id FROM user_guardians ug
    JOIN group_members gm ON gm.user_id = ug.user_id AND gm.group_id = ? AND gm.status = 'active'
    WHERE ug.guardian_user_id = ? AND ug.status = 'active'
    LIMIT 1
  `).bind(groupId, userId).first()

  if (!member && !isGuardian) {
    return c.json(fail('접근 권한이 없습니다.'), 403)
  }

  let query = `
    SELECT ls.*, u.name as instructor_name,
      (SELECT COUNT(*) FROM lesson_attendances WHERE schedule_id = ls.id AND status = 'present') as present_count,
      (SELECT COUNT(*) FROM lesson_attendances WHERE schedule_id = ls.id) as total_students
    FROM lesson_schedules ls
    JOIN users u ON u.id = ls.instructor_id
    WHERE ls.group_id = ? AND ls.is_deleted = 0
  `
  const params: unknown[] = [groupId]
  if (status) { query += ` AND ls.status = ?`; params.push(status) }
  query += ` ORDER BY ls.starts_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM lesson_schedules WHERE group_id = ? AND is_deleted = 0`
    ).bind(groupId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── POST /lessons/:groupId/schedules ─────────────────
// 레슨 일정 생성 (강사/그룹 어드민)
lessons.post(
  '/:groupId/schedules',
  authMiddleware,
  zValidator('json', z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    starts_at: z.string(),
    ends_at: z.string().optional(),
    location: z.string().max(200).optional(),
    max_students: z.number().int().positive().optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const body = c.req.valid('json')

    // LESSON 그룹인지 확인
    const group = await c.env.DB.prepare(
      `SELECT id, group_type FROM groups WHERE id = ? AND status = 'active' AND is_deleted = 0`
    ).bind(groupId).first<{ id: number; group_type: string }>()

    if (!group) return c.json(fail('그룹을 찾을 수 없습니다.'), 404)
    if (group.group_type !== 'LESSON') return c.json(fail('레슨 그룹에서만 일정을 생성할 수 있습니다.'), 400)

    // 강사(admin/sub_admin) 권한 확인
    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    if (!member || !['admin', 'sub_admin'].includes(member.role)) {
      return c.json(fail('레슨 일정은 강사(그룹 관리자)만 생성할 수 있습니다.'), 403)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO lesson_schedules
        (group_id, instructor_id, title, description, starts_at, ends_at, location, max_students)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId, userId, body.title, body.description ?? null,
      body.starts_at, body.ends_at ?? null,
      body.location ?? null, body.max_students ?? null
    ).run()

    return c.json(ok({ schedule_id: result.meta.last_row_id }, '레슨 일정이 생성되었습니다.'), 201)
  }
)

// ── GET /lessons/:groupId/schedules/:scheduleId ───────
// 레슨 일정 상세 + 출석 현황
lessons.get('/:groupId/schedules/:scheduleId', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))
  const scheduleId = parseInt(c.req.param('scheduleId'))

  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  const isGuardian = await c.env.DB.prepare(`
    SELECT ug.id FROM user_guardians ug
    JOIN group_members gm ON gm.user_id = ug.user_id AND gm.group_id = ? AND gm.status = 'active'
    WHERE ug.guardian_user_id = ? AND ug.status = 'active' LIMIT 1
  `).bind(groupId, userId).first()

  if (!member && !isGuardian) return c.json(fail('접근 권한이 없습니다.'), 403)

  const schedule = await c.env.DB.prepare(`
    SELECT ls.*, u.name as instructor_name
    FROM lesson_schedules ls
    JOIN users u ON u.id = ls.instructor_id
    WHERE ls.id = ? AND ls.group_id = ? AND ls.is_deleted = 0
  `).bind(scheduleId, groupId).first()

  if (!schedule) return c.json(fail('레슨 일정을 찾을 수 없습니다.'), 404)

  // 강사/관리자면 전체 출석 현황 제공, 일반 멤버면 본인 출석만
  let attendances
  if (member && ['admin', 'sub_admin'].includes(member.role)) {
    attendances = await c.env.DB.prepare(`
      SELECT la.*, u.name, u.avatar_url, u.user_type
      FROM lesson_attendances la
      JOIN users u ON u.id = la.student_id
      WHERE la.schedule_id = ?
      ORDER BY u.name ASC
    `).bind(scheduleId).all()
  } else {
    // 보호자: 담당 학생들의 출석만
    attendances = await c.env.DB.prepare(`
      SELECT la.*, u.name, u.avatar_url, u.user_type
      FROM lesson_attendances la
      JOIN users u ON u.id = la.student_id
      JOIN user_guardians ug ON ug.user_id = la.student_id AND ug.guardian_user_id = ? AND ug.status = 'active'
      WHERE la.schedule_id = ?
    `).bind(userId, scheduleId).all()
  }

  return c.json(ok({ ...schedule, attendances: attendances.results }))
})

// ── POST /lessons/:groupId/schedules/:scheduleId/attendance ──
// 출석 처리 (강사만)
lessons.post(
  '/:groupId/schedules/:scheduleId/attendance',
  authMiddleware,
  zValidator('json', z.object({
    attendances: z.array(z.object({
      student_id: z.number().int().positive(),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      note: z.string().max(200).optional()
    })).min(1)
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const scheduleId = parseInt(c.req.param('scheduleId'))
    const { attendances } = c.req.valid('json')

    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    if (!member || !['admin', 'sub_admin'].includes(member.role)) {
      return c.json(fail('출석 처리는 강사(그룹 관리자)만 가능합니다.'), 403)
    }

    // 일정 존재 확인
    const schedule = await c.env.DB.prepare(
      `SELECT id FROM lesson_schedules WHERE id = ? AND group_id = ? AND is_deleted = 0`
    ).bind(scheduleId, groupId).first()
    if (!schedule) return c.json(fail('레슨 일정을 찾을 수 없습니다.'), 404)

    // 배치 upsert 처리
    const stmts = attendances.map(a =>
      c.env.DB.prepare(`
        INSERT INTO lesson_attendances (schedule_id, student_id, status, checked_by, checked_at, note)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
        ON CONFLICT(schedule_id, student_id)
        DO UPDATE SET status = excluded.status, checked_by = excluded.checked_by,
          checked_at = excluded.checked_at, note = excluded.note,
          updated_at = datetime('now')
      `).bind(scheduleId, a.student_id, a.status, userId, a.note ?? null)
    )
    await c.env.DB.batch(stmts)

    // 일정 상태를 'ongoing'으로 업데이트
    await c.env.DB.prepare(
      `UPDATE lesson_schedules SET status = 'ongoing', updated_at = datetime('now') WHERE id = ? AND status = 'scheduled'`
    ).bind(scheduleId).run()

    return c.json(ok({ processed: attendances.length }, '출석이 처리되었습니다.'))
  }
)

// ── GET /lessons/:groupId/students ────────────────────
// 레슨 그룹의 학생 목록 (강사 전용)
lessons.get('/:groupId/students', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))

  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  if (!member || !['admin', 'sub_admin'].includes(member.role)) {
    return c.json(fail('강사(그룹 관리자)만 학생 목록을 조회할 수 있습니다.'), 403)
  }

  const rows = await c.env.DB.prepare(`
    SELECT
      gm.id as member_id, gm.role, gm.joined_at, gm.guardian_user_id,
      u.id, u.name, u.email, u.user_type, u.birth_date, u.avatar_url,
      g_u.name as guardian_name, g_u.email as guardian_email,
      ug.relation as guardian_relation,
      (SELECT COUNT(*) FROM lesson_attendances la
        JOIN lesson_schedules ls ON ls.id = la.schedule_id
        WHERE la.student_id = u.id AND ls.group_id = ? AND la.status = 'present'
      ) as present_count,
      (SELECT COUNT(*) FROM lesson_schedules WHERE group_id = ? AND is_deleted = 0) as total_lessons
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN users g_u ON g_u.id = gm.guardian_user_id
    LEFT JOIN user_guardians ug ON ug.user_id = u.id AND ug.guardian_user_id = gm.guardian_user_id AND ug.status = 'active'
    WHERE gm.group_id = ? AND gm.status = 'active'
    ORDER BY u.name ASC
  `).bind(groupId, groupId, groupId).all()

  return c.json(ok(rows.results))
})

export default lessons
