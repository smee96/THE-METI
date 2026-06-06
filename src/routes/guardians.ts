import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail } from '../middleware/response'

const guardians = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ══════════════════════════════════════════════════════════════
// 헬퍼: 사용자 정보 조회
// ══════════════════════════════════════════════════════════════
async function getUserById(db: D1Database, userId: number) {
  return db.prepare(
    `SELECT id, name, email, user_type, birth_date, avatar_url, is_active
     FROM users WHERE id = ?`
  ).bind(userId).first<{
    id: number; name: string; email: string;
    user_type: string; birth_date: string | null;
    avatar_url: string | null; is_active: number;
  }>()
}

// ══════════════════════════════════════════════════════════════
// POST /api/v1/guardians/link
// 6-1. 보호자 연결 요청 (보호자/강사가 학생에게 요청)
// ══════════════════════════════════════════════════════════════
guardians.post(
  '/link',
  authMiddleware,
  zValidator('json', z.object({
    minor_user_id: z.number().int().positive().optional(),
    minor_email:   z.string().email().optional(),
    relation:      z.enum(['parent', 'teacher']),
    group_id:      z.number().int().positive().optional(),
  }).refine(d => d.minor_user_id || d.minor_email, {
    message: 'minor_user_id 또는 minor_email 중 하나는 필수입니다.',
  })),
  async (c) => {
    const guardianUserId = c.get('userId')
    const body = c.req.valid('json')

    // 학생 조회
    let minor: { id: number; name: string; email: string; user_type: string } | null = null
    if (body.minor_user_id) {
      minor = await c.env.DB.prepare(
        `SELECT id, name, email, user_type FROM users WHERE id = ? AND is_active = 1`
      ).bind(body.minor_user_id).first()
    } else if (body.minor_email) {
      minor = await c.env.DB.prepare(
        `SELECT id, name, email, user_type FROM users WHERE email = ? AND is_active = 1`
      ).bind(body.minor_email).first()
    }

    if (!minor) return c.json(fail('학생을 찾을 수 없습니다.'), 404)
    if (minor.id === guardianUserId) return c.json(fail('자기 자신에게 보호자 요청을 할 수 없습니다.'), 400)

    // 이미 연결 요청이 있는지 확인
    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM user_guardians WHERE user_id = ? AND guardian_user_id = ?`
    ).bind(minor.id, guardianUserId).first<{ id: number; status: string }>()

    if (existing) {
      if (existing.status === 'active') return c.json(fail('이미 연결된 보호자 관계입니다.'), 409)
      if (existing.status === 'pending') return c.json(fail('이미 대기 중인 연결 요청이 있습니다.'), 409)
      // rejected 상태면 재요청 허용
      await c.env.DB.prepare(
        `UPDATE user_guardians SET status = 'pending', relation = ?, invited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(body.relation, existing.id).run()
      return c.json(ok({ minor_user_id: minor.id, guardian_user_id: guardianUserId, relation: body.relation, status: 'pending' }, '보호자 연결 요청이 발송되었습니다.'), 201)
    }

    // 신규 연결 요청 생성
    const result = await c.env.DB.prepare(
      `INSERT INTO user_guardians (user_id, guardian_user_id, relation, status)
       VALUES (?, ?, ?, 'pending')`
    ).bind(minor.id, guardianUserId, body.relation).run()

    // group_id가 있으면 해당 그룹 멤버에 보호자 연결 정보 업데이트
    if (body.group_id) {
      await c.env.DB.prepare(
        `UPDATE group_members SET guardian_user_id = ?
         WHERE group_id = ? AND user_id = ? AND status = 'active'`
      ).bind(guardianUserId, body.group_id, minor.id).run()
    }

    return c.json(ok({
      id: result.meta.last_row_id,
      minor_user_id: minor.id,
      guardian_user_id: guardianUserId,
      relation: body.relation,
      status: 'pending',
    }, '보호자 연결 요청이 발송되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// POST /api/v1/guardians/link/:requestId/accept
// 6-2. 보호자 연결 수락 (학생 본인 또는 super_admin)
// ══════════════════════════════════════════════════════════════
guardians.post('/link/:requestId/accept', authMiddleware, async (c) => {
  const userId    = c.get('userId')
  const userRole  = c.get('userRole') as string
  const requestId = parseInt(c.req.param('requestId'))

  const request = await c.env.DB.prepare(
    `SELECT ug.*, u.name AS minor_name, g.name AS guardian_name
     FROM user_guardians ug
     JOIN users u  ON u.id  = ug.user_id
     JOIN users g  ON g.id  = ug.guardian_user_id
     WHERE ug.id = ?`
  ).bind(requestId).first<{
    id: number; user_id: number; guardian_user_id: number;
    relation: string; status: string;
    minor_name: string; guardian_name: string;
  }>()

  if (!request) return c.json(fail('연결 요청을 찾을 수 없습니다.'), 404)
  if (request.status !== 'pending') return c.json(fail('대기 중인 요청이 아닙니다.'), 400)

  // 학생 본인 또는 super_admin만 수락 가능
  const isSuperAdmin = userRole === 'super_admin'
  if (request.user_id !== userId && !isSuperAdmin) {
    return c.json(fail('수락 권한이 없습니다.'), 403)
  }

  await c.env.DB.prepare(
    `UPDATE user_guardians
     SET status = 'active', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(requestId).run()

  return c.json(ok({
    request_id: requestId,
    minor_user_id: request.user_id,
    guardian_user_id: request.guardian_user_id,
    relation: request.relation,
    status: 'active',
  }, '보호자 연결이 수락되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/guardians/link/:requestId/reject
// 6-3. 보호자 연결 거절 (학생 본인)
// ══════════════════════════════════════════════════════════════
guardians.post('/link/:requestId/reject', authMiddleware, async (c) => {
  const userId    = c.get('userId')
  const requestId = parseInt(c.req.param('requestId'))

  const request = await c.env.DB.prepare(
    `SELECT id, user_id, status FROM user_guardians WHERE id = ?`
  ).bind(requestId).first<{ id: number; user_id: number; status: string }>()

  if (!request) return c.json(fail('연결 요청을 찾을 수 없습니다.'), 404)
  if (request.status !== 'pending') return c.json(fail('대기 중인 요청이 아닙니다.'), 400)
  if (request.user_id !== userId) return c.json(fail('거절 권한이 없습니다. 학생 본인만 거절할 수 있습니다.'), 403)

  await c.env.DB.prepare(
    `UPDATE user_guardians
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(requestId).run()

  return c.json(ok({ request_id: requestId, status: 'rejected' }, '보호자 연결 요청이 거절되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/guardians
// 6-4. 보호자/학생 목록 조회
//   ?role=mine     (기본) → 내 보호자 목록 (학생 입장)
//   ?role=students → 내가 담당하는 학생 목록 (보호자/강사 입장)
// ══════════════════════════════════════════════════════════════
guardians.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const role   = c.req.query('role') ?? 'mine'

  if (role === 'students') {
    // 내가 담당하는 학생 목록
    const rows = await c.env.DB.prepare(
      `SELECT ug.id, ug.relation, ug.status, ug.accepted_at,
              u.id AS student_id, u.name AS student_name, u.email AS student_email,
              u.user_type, u.birth_date, u.avatar_url
       FROM user_guardians ug
       JOIN users u ON u.id = ug.user_id
       WHERE ug.guardian_user_id = ? AND ug.status = 'active'
       ORDER BY ug.accepted_at DESC`
    ).bind(userId).all()
    return c.json(ok(rows.results))
  }

  // 내 보호자 목록 (학생 입장)
  const rows = await c.env.DB.prepare(
    `SELECT ug.id, ug.relation, ug.status, ug.accepted_at,
            u.id AS guardian_id, u.name AS guardian_name, u.email AS guardian_email,
            u.avatar_url AS guardian_avatar
     FROM user_guardians ug
     JOIN users u ON u.id = ug.guardian_user_id
     WHERE ug.user_id = ? AND ug.status = 'active'
     ORDER BY ug.accepted_at DESC`
  ).bind(userId).all()
  return c.json(ok(rows.results))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/guardians/pending
// 6-5. 대기 중인 연결 요청 목록 (학생 본인)
// ══════════════════════════════════════════════════════════════
guardians.get('/pending', authMiddleware, async (c) => {
  const userId = c.get('userId')

  // 나에게 온 대기 중 요청 (학생 입장 — 수락/거절 대상)
  const rows = await c.env.DB.prepare(
    `SELECT ug.id AS request_id, ug.relation, ug.status, ug.invited_at,
            u.id AS guardian_id, u.name AS guardian_name, u.email AS guardian_email,
            u.avatar_url AS guardian_avatar
     FROM user_guardians ug
     JOIN users u ON u.id = ug.guardian_user_id
     WHERE ug.user_id = ? AND ug.status = 'pending'
     ORDER BY ug.invited_at DESC`
  ).bind(userId).all()

  return c.json(ok(rows.results))
})

// ══════════════════════════════════════════════════════════════
// DELETE /api/v1/guardians/:guardianUserId
// 6-6. 보호자 연결 해제 (학생 본인 또는 보호자 본인)
// ══════════════════════════════════════════════════════════════
guardians.delete('/:guardianUserId', authMiddleware, async (c) => {
  const userId         = c.get('userId')
  const guardianUserId = parseInt(c.req.param('guardianUserId'))

  // 학생 입장에서 내 보호자 해제 OR 보호자 입장에서 내 담당 학생 해제 모두 허용
  const record = await c.env.DB.prepare(
    `SELECT id FROM user_guardians
     WHERE (user_id = ? AND guardian_user_id = ?)
        OR (user_id = ? AND guardian_user_id = ?)
     LIMIT 1`
  ).bind(userId, guardianUserId, guardianUserId, userId).first<{ id: number }>()

  if (!record) return c.json(fail('보호자 연결 관계를 찾을 수 없습니다.'), 404)

  await c.env.DB.prepare(`DELETE FROM user_guardians WHERE id = ?`).bind(record.id).run()

  return c.json(ok(null, '보호자 연결이 해제되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/guardians/lesson-groups
// 6-7. 내 학생들의 레슨 그룹 목록 (보호자/강사 전용)
// ══════════════════════════════════════════════════════════════
guardians.get('/lesson-groups', authMiddleware, async (c) => {
  const userId = c.get('userId')

  // 내가 담당하는 active 학생들의 ID 목록
  const studentsResult = await c.env.DB.prepare(
    `SELECT user_id FROM user_guardians
     WHERE guardian_user_id = ? AND status = 'active'`
  ).bind(userId).all<{ user_id: number }>()

  const studentIds = studentsResult.results.map(r => r.user_id)
  if (studentIds.length === 0) return c.json(ok([]))

  // 학생들이 참여 중인 LESSON 타입 그룹 조회 (중복 제거)
  const placeholders = studentIds.map(() => '?').join(',')
  const rows = await c.env.DB.prepare(
    `SELECT DISTINCT
       g.id AS group_id, g.name AS group_name, g.group_type,
       g.description, g.avatar_url AS group_avatar,
       (SELECT COUNT(*) FROM group_members gm2
        WHERE gm2.group_id = g.id AND gm2.status = 'active') AS member_count,
       (SELECT COUNT(*) FROM lesson_schedules ls
        WHERE ls.group_id = g.id AND ls.is_deleted = 0
          AND ls.status IN ('scheduled','ongoing')) AS upcoming_lessons
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id IN (${placeholders})
       AND gm.status = 'active'
       AND g.group_type = 'LESSON'
     ORDER BY g.name ASC`
  ).bind(...studentIds).all()

  return c.json(ok(rows.results))
})

export default guardians
