/**
 * 어드민 그룹 상세 관리 라우트
 * 마운트 위치: /api/v1/admin/groups/:groupId/...
 *
 * 제공 기능:
 *  - 그룹 상세 정보 조회
 *  - 멤버 목록 조회 (role/status 필터, 페이지네이션)
 *  - 멤버 역할 변경 (admin | sub_admin | instructor | member)
 *  - 멤버 강제 탈퇴 (kicked)
 *  - 그룹 포인트 내역 조회
 *  - 그룹 포인트 직접 지급/차감 (어드민 전용)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const groupDetail = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 그룹 상세 정보 ────────────────────────────────────────
// GET /admin/groups/:groupId/detail
groupDetail.get('/detail', async (c) => {
  const groupId = c.req.param('groupId')

  const [group, memberCount, walletRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        g.*,
        u.name  AS admin_name,
        u.email AS admin_email
      FROM groups g
      LEFT JOIN users u ON u.id = g.admin_user_id
      WHERE g.id = ? AND g.is_deleted = 0
    `).bind(groupId).first(),

    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active'  THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
      FROM group_members WHERE group_id = ?
    `).bind(groupId).first<{ total: number; active: number; pending: number }>(),

    c.env.DB.prepare(`
      SELECT pw.balance, pw.id AS wallet_id
      FROM point_wallets pw
      WHERE pw.owner_type = 'group' AND pw.owner_id = ?
    `).bind(groupId).first<{ balance: number; wallet_id: number }>(),
  ])

  if (!group) return c.json(fail('그룹을 찾을 수 없습니다.'), 404)

  return c.json(ok({
    ...group,
    member_count: memberCount,
    point_balance: walletRow?.balance ?? 0,
    wallet_id: walletRow?.wallet_id ?? null,
  }))
})

// ── 멤버 목록 ─────────────────────────────────────────────
// GET /admin/groups/:groupId/members?role=&status=active&q=&page=1
groupDetail.get('/members', async (c) => {
  const groupId = c.req.param('groupId')
  const role    = c.req.query('role')    // admin | sub_admin | instructor | member
  const status  = c.req.query('status') ?? 'active'  // active | pending | kicked | left
  const q       = c.req.query('q')

  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    50
  )

  const conditions: string[] = ['gm.group_id = ?']
  const bindings: unknown[]  = [groupId]

  if (status !== 'all') { conditions.push('gm.status = ?'); bindings.push(status) }
  if (role)             { conditions.push('gm.role = ?');   bindings.push(role) }
  if (q) {
    conditions.push('(u.name LIKE ? OR u.email LIKE ?)')
    bindings.push(`%${q}%`, `%${q}%`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        gm.id, gm.group_id, gm.user_id,
        gm.role, gm.custom_role, gm.status,
        gm.joined_at, gm.approved_at, gm.left_at, gm.created_at,
        u.name      AS user_name,
        u.email     AS user_email,
        u.is_active AS user_status,
        u.plan      AS user_plan
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      ${where}
      ORDER BY
        CASE gm.role
          WHEN 'admin'      THEN 0
          WHEN 'sub_admin'  THEN 1
          WHEN 'instructor' THEN 2
          ELSE 3
        END,
        gm.joined_at ASC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      ${where}
    `).bind(...bindings).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 멤버 역할 변경 ────────────────────────────────────────
// PATCH /admin/groups/:groupId/members/:memberId/role
groupDetail.patch(
  '/members/:memberId/role',
  zValidator('json', z.object({
    role: z.enum(['admin', 'sub_admin', 'instructor', 'member']),
  })),
  async (c) => {
    const groupId  = c.req.param('groupId')
    const memberId = c.req.param('memberId')  // group_members.id
    const { role } = c.req.valid('json')

    // 멤버 존재 확인
    const member = await c.env.DB.prepare(`
      SELECT gm.id, gm.user_id, gm.role, gm.status, u.name
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.id = ? AND gm.group_id = ?
    `).bind(memberId, groupId).first<{ id: number; user_id: number; role: string; status: string; name: string }>()

    if (!member) return c.json(fail('해당 멤버를 찾을 수 없습니다.'), 404)
    if (member.status !== 'active') return c.json(fail('활성 멤버만 역할을 변경할 수 있습니다.'), 400)

    // admin으로 변경 시: 기존 admin을 sub_admin으로 강등
    if (role === 'admin') {
      await c.env.DB.prepare(`
        UPDATE group_members
        SET role = 'sub_admin', updated_at = datetime('now')
        WHERE group_id = ? AND role = 'admin' AND id != ?
      `).bind(groupId, memberId).run()

      // groups.admin_user_id 업데이트
      await c.env.DB.prepare(`
        UPDATE groups SET admin_user_id = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(member.user_id, groupId).run()
    }

    await c.env.DB.prepare(`
      UPDATE group_members
      SET role = ?, updated_at = datetime('now')
      WHERE id = ? AND group_id = ?
    `).bind(role, memberId, groupId).run()

    const roleLabels: Record<string, string> = {
      admin: '관리자', sub_admin: '부관리자', instructor: '강사', member: '일반 멤버',
    }
    return c.json(ok(null, `${member.name}의 역할이 ${roleLabels[role]}(으)로 변경되었습니다.`))
  }
)

// ── 멤버 강제 탈퇴 ────────────────────────────────────────
// DELETE /admin/groups/:groupId/members/:memberId
groupDetail.delete('/members/:memberId', async (c) => {
  const groupId  = c.req.param('groupId')
  const memberId = c.req.param('memberId')

  const member = await c.env.DB.prepare(`
    SELECT gm.id, gm.user_id, gm.role, gm.status, u.name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.id = ? AND gm.group_id = ?
  `).bind(memberId, groupId).first<{ id: number; user_id: number; role: string; status: string; name: string }>()

  if (!member) return c.json(fail('해당 멤버를 찾을 수 없습니다.'), 404)
  if (member.role === 'admin') {
    return c.json(fail('그룹 관리자(admin)는 강제 탈퇴할 수 없습니다. 역할을 먼저 변경해주세요.'), 400)
  }

  await c.env.DB.prepare(`
    UPDATE group_members
    SET status = 'kicked', left_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND group_id = ?
  `).bind(memberId, groupId).run()

  return c.json(ok(null, `${member.name} 멤버를 강제 탈퇴 처리했습니다.`))
})

// ── 가입 대기 승인/거절 ───────────────────────────────────
// PATCH /admin/groups/:groupId/members/:memberId/approve
groupDetail.patch(
  '/members/:memberId/approve',
  zValidator('json', z.object({
    action: z.enum(['approve', 'reject']),
  })),
  async (c) => {
    const groupId  = c.req.param('groupId')
    const memberId = c.req.param('memberId')
    const adminId  = c.get('userId')
    const { action } = c.req.valid('json')

    const member = await c.env.DB.prepare(`
      SELECT id, status, user_id FROM group_members
      WHERE id = ? AND group_id = ? AND status = 'pending'
    `).bind(memberId, groupId).first<{ id: number; status: string; user_id: number }>()

    if (!member) return c.json(fail('대기 중인 멤버를 찾을 수 없습니다.'), 404)

    if (action === 'approve') {
      await c.env.DB.prepare(`
        UPDATE group_members
        SET status = 'active', approved_by = ?, approved_at = datetime('now'),
            joined_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(adminId, memberId).run()
    } else {
      await c.env.DB.prepare(`
        UPDATE group_members
        SET status = 'rejected', updated_at = datetime('now')
        WHERE id = ?
      `).bind(memberId).run()
    }

    return c.json(ok(null, action === 'approve' ? '가입 승인되었습니다.' : '가입 거절되었습니다.'))
  }
)

// ── 그룹 포인트 내역 ──────────────────────────────────────
// GET /admin/groups/:groupId/point-history?page=1
groupDetail.get('/point-history', async (c) => {
  const groupId = c.req.param('groupId')
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    20
  )

  const wallet = await c.env.DB.prepare(`
    SELECT id, balance FROM point_wallets
    WHERE owner_type = 'group' AND owner_id = ?
  `).bind(groupId).first<{ id: number; balance: number }>()

  if (!wallet) return c.json(ok({ balance: 0, transactions: [], pagination: null }))

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT pt.*, u.name AS actor_name
      FROM point_transactions pt
      LEFT JOIN users u ON u.id = pt.actor_id
      WHERE pt.wallet_id = ?
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(wallet.id, limit, offset).all(),

    c.env.DB.prepare(
      'SELECT COUNT(*) AS total FROM point_transactions WHERE wallet_id = ?'
    ).bind(wallet.id).first<{ total: number }>(),
  ])

  const total = countRow?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  return c.json(ok({
    balance: wallet.balance,
    transactions: rows.results,
    pagination: { page, limit, total, totalPages },
  }))
})

// ── 그룹별 행사 목록 ──────────────────────────────────────
// GET /admin/groups/:groupId/events?page=1&status=all
groupDetail.get('/events', async (c) => {
  const groupId = c.req.param('groupId')
  const status  = c.req.query('status') // upcoming | ongoing | ended | cancelled
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    20
  )

  const conditions: string[] = ['e.group_id = ?', 'e.is_deleted = 0']
  const bindings: unknown[]  = [groupId]

  if (status && status !== 'all') {
    conditions.push('e.status = ?')
    bindings.push(status)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        e.id, e.title, e.description, e.location,
        e.start_at, e.end_at, e.status,
        e.entry_fee, e.max_participants,
        e.created_at, e.updated_at,
        u.name AS organizer_name,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count
      FROM events e
      LEFT JOIN users u ON u.id = e.organizer_id
      ${where}
      ORDER BY e.start_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS total FROM events e
      ${where}
    `).bind(...bindings).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 그룹별 레슨 목록 ──────────────────────────────────────
// GET /admin/groups/:groupId/lessons?page=1&status=all
groupDetail.get('/lessons', async (c) => {
  const groupId = c.req.param('groupId')
  const status  = c.req.query('status') // scheduled | ongoing | ended | cancelled
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    20
  )

  const conditions: string[] = ['l.group_id = ?', 'l.is_deleted = 0']
  const bindings: unknown[]  = [groupId]

  if (status && status !== 'all') {
    conditions.push('l.status = ?')
    bindings.push(status)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        l.id, l.title, l.description, l.location,
        l.start_at, l.end_at, l.status,
        l.fee, l.max_students,
        l.created_at, l.updated_at,
        u.name AS instructor_name,
        (SELECT COUNT(*) FROM lesson_enrollments le WHERE le.lesson_id = l.id) AS enrolled_count
      FROM lessons l
      LEFT JOIN users u ON u.id = l.instructor_id
      ${where}
      ORDER BY l.start_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) AS total FROM lessons l
      ${where}
    `).bind(...bindings).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 그룹별 공지 목록 ──────────────────────────────────────
// GET /admin/groups/:groupId/notices?page=1
groupDetail.get('/notices', async (c) => {
  const groupId = c.req.param('groupId')
  const { page, limit, offset } = parsePagination(
    c.req.query('page'),
    c.req.query('limit'),
    20
  )

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        n.id, n.title, n.content, n.is_pinned,
        n.created_at, n.updated_at,
        u.name AS author_name
      FROM group_notices n
      LEFT JOIN users u ON u.id = n.author_id
      WHERE n.group_id = ? AND n.is_deleted = 0
      ORDER BY n.is_pinned DESC, n.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(groupId, limit, offset).all(),

    c.env.DB.prepare(
      'SELECT COUNT(*) AS total FROM group_notices WHERE group_id = ? AND is_deleted = 0'
    ).bind(groupId).first<{ total: number }>(),
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 그룹 공지 생성 ────────────────────────────────────────
// POST /admin/groups/:groupId/notices
groupDetail.post(
  '/notices',
  zValidator('json', z.object({
    title:     z.string().min(1).max(200),
    content:   z.string().min(1),
    is_pinned: z.boolean().optional().default(false),
  })),
  async (c) => {
    const groupId = c.req.param('groupId')
    const adminId = c.get('userId')
    const { title, content, is_pinned } = c.req.valid('json')

    const group = await c.env.DB.prepare(
      'SELECT id FROM groups WHERE id = ? AND is_deleted = 0'
    ).bind(groupId).first()
    if (!group) return c.json(fail('그룹을 찾을 수 없습니다.'), 404)

    const res = await c.env.DB.prepare(`
      INSERT INTO group_notices (group_id, author_id, title, content, is_pinned, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(groupId, adminId, title, content, is_pinned ? 1 : 0).run()

    return c.json(ok({ id: res.meta.last_row_id }, '공지가 등록되었습니다.'), 201)
  }
)

// ── 그룹 공지 수정 ────────────────────────────────────────
// PATCH /admin/groups/:groupId/notices/:noticeId
groupDetail.patch(
  '/notices/:noticeId',
  zValidator('json', z.object({
    title:     z.string().min(1).max(200).optional(),
    content:   z.string().min(1).optional(),
    is_pinned: z.boolean().optional(),
  })),
  async (c) => {
    const groupId  = c.req.param('groupId')
    const noticeId = c.req.param('noticeId')
    const body     = c.req.valid('json')

    const notice = await c.env.DB.prepare(
      'SELECT id FROM group_notices WHERE id = ? AND group_id = ? AND is_deleted = 0'
    ).bind(noticeId, groupId).first()
    if (!notice) return c.json(fail('공지를 찾을 수 없습니다.'), 404)

    const fields: string[] = ['updated_at = datetime(\'now\')']
    const vals: unknown[]  = []
    if (body.title     !== undefined) { fields.push('title = ?');     vals.push(body.title) }
    if (body.content   !== undefined) { fields.push('content = ?');   vals.push(body.content) }
    if (body.is_pinned !== undefined) { fields.push('is_pinned = ?'); vals.push(body.is_pinned ? 1 : 0) }

    await c.env.DB.prepare(
      `UPDATE group_notices SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, noticeId).run()

    return c.json(ok(null, '공지가 수정되었습니다.'))
  }
)

// ── 그룹 공지 삭제 ────────────────────────────────────────
// DELETE /admin/groups/:groupId/notices/:noticeId
groupDetail.delete('/notices/:noticeId', async (c) => {
  const groupId  = c.req.param('groupId')
  const noticeId = c.req.param('noticeId')

  const notice = await c.env.DB.prepare(
    'SELECT id FROM group_notices WHERE id = ? AND group_id = ? AND is_deleted = 0'
  ).bind(noticeId, groupId).first()
  if (!notice) return c.json(fail('공지를 찾을 수 없습니다.'), 404)

  await c.env.DB.prepare(
    'UPDATE group_notices SET is_deleted = 1, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(noticeId).run()

  return c.json(ok(null, '공지가 삭제되었습니다.'))
})

// ── 그룹 포인트 직접 지급/차감 ───────────────────────────
// POST /admin/groups/:groupId/points
groupDetail.post(
  '/points',
  zValidator('json', z.object({
    amount:      z.number().int().refine(v => v !== 0, { message: '0은 입력할 수 없습니다.' }),
    description: z.string().min(1).max(200),
  })),
  async (c) => {
    const groupId = c.req.param('groupId')
    const adminId = c.get('userId')
    const { amount, description } = c.req.valid('json')

    // 지갑 조회 (없으면 생성)
    let wallet = await c.env.DB.prepare(`
      SELECT id, balance FROM point_wallets
      WHERE owner_type = 'group' AND owner_id = ?
    `).bind(groupId).first<{ id: number; balance: number }>()

    if (!wallet) {
      const res = await c.env.DB.prepare(`
        INSERT INTO point_wallets (owner_type, owner_id, balance)
        VALUES ('group', ?, 0)
      `).bind(groupId).run()
      wallet = { id: res.meta.last_row_id as number, balance: 0 }
    }

    // 차감 시 잔액 부족 체크
    if (amount < 0 && wallet.balance + amount < 0) {
      return c.json(fail(`잔액 부족: 현재 ${wallet.balance.toLocaleString()}P`), 400)
    }

    // 잔액 업데이트
    await c.env.DB.prepare(`
      UPDATE point_wallets SET balance = balance + ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(amount, wallet.id).run()

    // 거래 기록
    await c.env.DB.prepare(`
      INSERT INTO point_transactions
        (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, created_at)
      VALUES (?, ?, 'reward', ?, ?, 'admin', ?, ?, datetime('now'))
    `).bind(
      wallet.id,
      amount > 0 ? 'admin_grant' : 'admin_deduct',
      amount,
      wallet.balance + amount,
      adminId,
      description,
    ).run()

    const action = amount > 0 ? '지급' : '차감'
    return c.json(ok(
      { new_balance: wallet.balance + amount },
      `그룹 포인트 ${Math.abs(amount).toLocaleString()}P ${action}되었습니다.`
    ))
  }
)

export default groupDetail
