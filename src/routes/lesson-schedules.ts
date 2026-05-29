import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const schedules = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ══════════════════════════════════════════════════════════════
// 헬퍼: 그룹 내 역할 확인
// ══════════════════════════════════════════════════════════════
async function getMemberRole(db: D1Database, groupId: number, userId: number) {
  return db.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()
}

// 강사(instructor) 이상 권한 역할 목록
const INSTRUCTOR_ROLES = ['admin', 'sub_admin', 'instructor']

// ══════════════════════════════════════════════════════════════
// GET /api/v1/lessons/:groupId/schedules
// 7-1. 레슨 일정 목록 조회
// ══════════════════════════════════════════════════════════════
schedules.get('/:groupId/schedules', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status  = c.req.query('status')

  // 그룹 멤버 확인 (보호자도 접근 가능 — 그룹 멤버거나 담당 학생의 그룹인 경우)
  const member = await getMemberRole(c.env.DB, groupId, userId)
  if (!member) {
    // 보호자 자격으로 접근 허용 여부 확인
    const isGuardianOfGroupStudent = await c.env.DB.prepare(
      `SELECT 1 FROM user_guardians ug
       JOIN group_members gm ON gm.user_id = ug.user_id
       WHERE ug.guardian_user_id = ? AND gm.group_id = ? AND ug.status = 'active' AND gm.status = 'active'
       LIMIT 1`
    ).bind(userId, groupId).first()
    if (!isGuardianOfGroupStudent) return c.json(fail('접근 권한이 없습니다.'), 403)
  }

  let query = `
    SELECT ls.id, ls.group_id, ls.title, ls.description,
           ls.instructor_id, u.name AS instructor_name,
           ls.starts_at, ls.ends_at, ls.location,
           ls.max_students, ls.status,
           COUNT(CASE WHEN la.status = 'present' OR la.status = 'late' THEN 1 END) AS present_count,
           COUNT(la.id) AS total_students
    FROM lesson_schedules ls
    JOIN users u ON u.id = ls.instructor_id
    LEFT JOIN lesson_attendances la ON la.schedule_id = ls.id
    WHERE ls.group_id = ? AND ls.is_deleted = 0
  `
  const params: unknown[] = [groupId]
  if (status) { query += ` AND ls.status = ?`; params.push(status) }
  query += ` GROUP BY ls.id ORDER BY ls.starts_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM lesson_schedules WHERE group_id = ? AND is_deleted = 0${status ? ' AND status = ?' : ''}`
    ).bind(...(status ? [groupId, status] : [groupId])).first<{ total: number }>()
  ])

  const total = countRow?.total ?? 0
  return c.json(paginate(rows.results, page, limit, total))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/lessons/:groupId/schedules
// 7-2. 레슨 일정 생성 (강사/관리자)
// ══════════════════════════════════════════════════════════════
schedules.post(
  '/:groupId/schedules',
  authMiddleware,
  zValidator('json', z.object({
    title:        z.string().min(1).max(200),
    description:  z.string().max(1000).optional(),
    starts_at:    z.string().datetime({ offset: true }),
    ends_at:      z.string().datetime({ offset: true }).optional(),
    location:     z.string().max(200).optional(),
    max_students: z.number().int().positive().optional(),
  })),
  async (c) => {
    const userId  = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const body    = c.req.valid('json')

    // 권한 확인: 강사급 이상
    const member = await getMemberRole(c.env.DB, groupId, userId)
    if (!member || !INSTRUCTOR_ROLES.includes(member.role)) {
      return c.json(fail('레슨 일정을 생성하려면 강사(instructor) 이상의 권한이 필요합니다.'), 403)
    }

    // 그룹이 LESSON 타입인지 확인
    const group = await c.env.DB.prepare(
      `SELECT id, group_type FROM groups WHERE id = ? AND is_deleted = 0`
    ).bind(groupId).first<{ id: number; group_type: string }>()
    if (!group) return c.json(fail('그룹을 찾을 수 없습니다.'), 404)
    if (group.group_type !== 'LESSON') return c.json(fail('LESSON 타입 그룹에서만 레슨 일정을 생성할 수 있습니다.'), 400)

    const result = await c.env.DB.prepare(
      `INSERT INTO lesson_schedules (group_id, title, description, instructor_id, starts_at, ends_at, location, max_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`
    ).bind(
      groupId,
      body.title,
      body.description ?? null,
      userId,
      body.starts_at,
      body.ends_at ?? null,
      body.location ?? null,
      body.max_students ?? null,
    ).run()

    return c.json(ok({ schedule_id: result.meta.last_row_id }, '레슨 일정이 생성되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// GET /api/v1/lessons/:groupId/schedules/:scheduleId
// 7-3. 레슨 일정 상세 + 출석 현황
//   강사/관리자 → 전체 학생 출석 현황
//   보호자      → 담당 학생들의 출석만
// ══════════════════════════════════════════════════════════════
schedules.get('/:groupId/schedules/:scheduleId', authMiddleware, async (c) => {
  const userId     = c.get('userId')
  const groupId    = parseInt(c.req.param('groupId'))
  const scheduleId = parseInt(c.req.param('scheduleId'))

  const member = await getMemberRole(c.env.DB, groupId, userId)
  const isInstructor = member && INSTRUCTOR_ROLES.includes(member.role)

  let isGuardian = false
  if (!isInstructor) {
    const guardianCheck = await c.env.DB.prepare(
      `SELECT 1 FROM user_guardians ug
       JOIN group_members gm ON gm.user_id = ug.user_id
       WHERE ug.guardian_user_id = ? AND gm.group_id = ? AND ug.status = 'active' AND gm.status = 'active'
       LIMIT 1`
    ).bind(userId, groupId).first()
    if (!guardianCheck && !member) return c.json(fail('접근 권한이 없습니다.'), 403)
    if (guardianCheck) isGuardian = true
  }

  // 일정 기본 정보
  const schedule = await c.env.DB.prepare(
    `SELECT ls.*, u.name AS instructor_name, u.email AS instructor_email
     FROM lesson_schedules ls
     JOIN users u ON u.id = ls.instructor_id
     WHERE ls.id = ? AND ls.group_id = ? AND ls.is_deleted = 0`
  ).bind(scheduleId, groupId).first<{
    id: number; group_id: number; title: string; description: string | null;
    instructor_id: number; instructor_name: string; instructor_email: string;
    starts_at: string; ends_at: string | null; location: string | null;
    max_students: number | null; status: string;
  }>()

  if (!schedule) return c.json(fail('레슨 일정을 찾을 수 없습니다.'), 404)

  // 출석 현황 조회
  let attendanceQuery: string
  let attendanceParams: unknown[]

  if (isInstructor) {
    // 강사: 그룹의 모든 active 멤버(학생) 출석 현황
    attendanceQuery = `
      SELECT u.id AS student_id, u.name, u.user_type, u.avatar_url,
             la.status AS attendance_status, la.checked_at, la.note,
             la.checked_by
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      LEFT JOIN lesson_attendances la ON la.schedule_id = ? AND la.student_id = u.id
      WHERE gm.group_id = ? AND gm.status = 'active' AND gm.user_id != ?
      ORDER BY u.name ASC`
    attendanceParams = [scheduleId, groupId, schedule.instructor_id]
  } else if (isGuardian) {
    // 보호자: 담당 학생들만
    attendanceQuery = `
      SELECT u.id AS student_id, u.name, u.user_type, u.avatar_url,
             la.status AS attendance_status, la.checked_at, la.note
      FROM user_guardians ug
      JOIN users u ON u.id = ug.user_id
      JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ?
      LEFT JOIN lesson_attendances la ON la.schedule_id = ? AND la.student_id = u.id
      WHERE ug.guardian_user_id = ? AND ug.status = 'active' AND gm.status = 'active'
      ORDER BY u.name ASC`
    attendanceParams = [groupId, scheduleId, userId]
  } else {
    // 일반 멤버: 자신의 출석만
    attendanceQuery = `
      SELECT u.id AS student_id, u.name, u.user_type, u.avatar_url,
             la.status AS attendance_status, la.checked_at, la.note
      FROM users u
      LEFT JOIN lesson_attendances la ON la.schedule_id = ? AND la.student_id = ?
      WHERE u.id = ?`
    attendanceParams = [scheduleId, userId, userId]
  }

  const attendances = await c.env.DB.prepare(attendanceQuery).bind(...attendanceParams).all()

  return c.json(ok({
    ...schedule,
    attendances: attendances.results.map(a => ({
      student_id:  (a as any).student_id,
      name:        (a as any).name,
      user_type:   (a as any).user_type,
      avatar_url:  (a as any).avatar_url,
      status:      (a as any).attendance_status ?? 'absent',
      checked_at:  (a as any).checked_at ?? null,
      note:        (a as any).note ?? null,
    })),
  }))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/lessons/:groupId/schedules/:scheduleId/attendance
// 7-4. 출석 처리 배치 (강사 전용)
// ══════════════════════════════════════════════════════════════
schedules.post(
  '/:groupId/schedules/:scheduleId/attendance',
  authMiddleware,
  zValidator('json', z.object({
    attendances: z.array(z.object({
      student_id: z.number().int().positive(),
      status:     z.enum(['present', 'absent', 'late', 'excused']),
      note:       z.string().max(500).nullable().optional(),
    })).min(1),
  })),
  async (c) => {
    const userId     = c.get('userId')
    const groupId    = parseInt(c.req.param('groupId'))
    const scheduleId = parseInt(c.req.param('scheduleId'))
    const body       = c.req.valid('json')

    // 강사급 이상만 출석 처리 가능
    const member = await getMemberRole(c.env.DB, groupId, userId)
    if (!member || !INSTRUCTOR_ROLES.includes(member.role)) {
      return c.json(fail('출석 처리는 강사(instructor) 이상의 권한이 필요합니다.'), 403)
    }

    // 일정 존재 확인
    const schedule = await c.env.DB.prepare(
      `SELECT id, status FROM lesson_schedules WHERE id = ? AND group_id = ? AND is_deleted = 0`
    ).bind(scheduleId, groupId).first<{ id: number; status: string }>()
    if (!schedule) return c.json(fail('레슨 일정을 찾을 수 없습니다.'), 404)
    if (schedule.status === 'cancelled') return c.json(fail('취소된 일정에는 출석 처리를 할 수 없습니다.'), 400)

    const now = new Date().toISOString()
    let processed = 0

    // 배치 upsert
    for (const a of body.attendances) {
      await c.env.DB.prepare(
        `INSERT INTO lesson_attendances (schedule_id, student_id, status, checked_by, checked_at, note)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(schedule_id, student_id)
         DO UPDATE SET
           status = excluded.status,
           checked_by = excluded.checked_by,
           checked_at = excluded.checked_at,
           note = excluded.note,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(scheduleId, a.student_id, a.status, userId, now, a.note ?? null).run()
      processed++
    }

    // 일정 상태가 'scheduled'이면 'ongoing'으로 자동 전환
    if (schedule.status === 'scheduled') {
      await c.env.DB.prepare(
        `UPDATE lesson_schedules SET status = 'ongoing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(scheduleId).run()
    }

    return c.json(ok({ processed }, '출석이 처리되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// GET /api/v1/lessons/:groupId/students
// 7-5. 학생 목록 조회 (강사 전용) — 보호자 정보 + 출석률 포함
// ══════════════════════════════════════════════════════════════
schedules.get('/:groupId/students', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))

  // 강사급 이상만 접근 가능
  const member = await getMemberRole(c.env.DB, groupId, userId)
  if (!member || !INSTRUCTOR_ROLES.includes(member.role)) {
    return c.json(fail('학생 목록은 강사(instructor) 이상의 권한이 필요합니다.'), 403)
  }

  // LESSON 그룹의 일반 학생 멤버 목록 (강사 제외)
  const students = await c.env.DB.prepare(
    `SELECT
       u.id, u.name, u.email, u.user_type, u.birth_date, u.avatar_url,
       gm.role AS member_role, gm.guardian_user_id, gm.guardian_approved_at,
       ug.id AS guardian_link_id, ug.relation AS guardian_relation,
       ug.status AS guardian_link_status,
       guu.id AS guardian_id, guu.name AS guardian_name,
       guu.email AS guardian_email, guu.avatar_url AS guardian_avatar,
       -- 출석률: 전체 완료 일정 중 present/late 개수
       (SELECT COUNT(*) FROM lesson_attendances la
        JOIN lesson_schedules ls ON ls.id = la.schedule_id
        WHERE la.student_id = u.id AND ls.group_id = ?
          AND (la.status = 'present' OR la.status = 'late')
          AND ls.is_deleted = 0) AS present_count,
       (SELECT COUNT(*) FROM lesson_schedules ls
        WHERE ls.group_id = ? AND ls.status = 'completed' AND ls.is_deleted = 0) AS total_lessons
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     LEFT JOIN user_guardians ug ON ug.user_id = u.id AND ug.status = 'active'
     LEFT JOIN users guu ON guu.id = ug.guardian_user_id
     WHERE gm.group_id = ? AND gm.status = 'active'
       AND gm.role NOT IN ('admin', 'sub_admin', 'instructor')
     ORDER BY u.name ASC`
  ).bind(groupId, groupId, groupId).all()

  return c.json(ok(students.results))
})

export default schedules
