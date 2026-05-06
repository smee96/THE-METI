import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const groups = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 그룹 목록 (공개) ──────────────────────────────────
groups.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const search = c.req.query('q')
  const category = c.req.query('category')

  let query = `
    SELECT g.id, g.name, g.description, g.purpose, g.logo_url, g.visibility,
      g.status, g.max_members, g.has_minor, g.is_featured, g.created_at,
      u.name as admin_name,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as member_count
    FROM groups g
    LEFT JOIN users u ON u.id = g.admin_user_id
    WHERE g.status = 'active' AND g.is_deleted = 0 AND g.visibility = 'public'
  `
  const params: unknown[] = []
  if (search) { query += ` AND (g.name LIKE ? OR g.description LIKE ? OR g.purpose LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  query += ` ORDER BY g.is_featured DESC, g.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM groups WHERE status='active' AND is_deleted=0 AND visibility='public'`).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 그룹 개설 신청 ────────────────────────────────────
// 누구나 신청 가능. 카테고리 없음, 용도(purpose)로 관리자가 심사.
// 미성년자 포함 여부는 관리자가 심사 후 승인 시 has_minor를 직접 체크.
groups.post(
  '/',
  authMiddleware,
  zValidator('json', z.object({
    name: z.string().min(2, '그룹 이름은 2자 이상이어야 합니다.').max(100),
    description: z.string().max(1000).optional(),
    purpose: z.string().min(5, '그룹 용도를 5자 이상 입력해주세요.').max(500),  // 관리자 심사용
    visibility: z.enum(['public', 'private']).default('public'),
    max_members: z.number().int().positive().optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    const result = await c.env.DB.prepare(`
      INSERT INTO groups (name, description, purpose, visibility, status, admin_user_id, max_members)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      body.name, body.description ?? null, body.purpose,
      body.visibility, userId, body.max_members ?? null
    ).run()

    return c.json(ok({
      group_id: result.meta.last_row_id,
      status: 'pending',
      message: '그룹 개설 신청이 완료되었습니다. 관리자 심사 후 활성화됩니다.'
    }), 201)
  }
)

// ── 그룹 상세 조회 ────────────────────────────────────
groups.get('/:id', async (c) => {
  const groupId = c.req.param('id')

  const group = await c.env.DB.prepare(`
    SELECT g.*, u.name as admin_name,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as member_count
    FROM groups g
    LEFT JOIN users u ON u.id = g.admin_user_id
    WHERE g.id = ? AND g.is_deleted = 0
  `).bind(groupId).first()

  if (!group) return c.json(fail('그룹을 찾을 수 없습니다.'), 404)

  const photos = await c.env.DB.prepare(
    'SELECT * FROM group_photos WHERE group_id = ? ORDER BY sort_order LIMIT 10'
  ).bind(groupId).all()

  return c.json(ok({ ...group, photos: photos.results }))
})

// ── 그룹 가입 신청 ────────────────────────────────────
// public 그룹: 바로 pending → 관리자 승인 대기
// 초대링크 가입: POST /api/v1/auth/invite/:token/join 사용 → 즉시 active
groups.post(
  '/:id/join',
  authMiddleware,
  zValidator('json', z.object({
    // 레슨·스포츠 그룹 가입 시 생년월일 선택 입력 (미성년자 여부 판단)
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const { birth_date } = c.req.valid('json')

    const group = await c.env.DB.prepare(
      `SELECT id, visibility, status, max_members FROM groups WHERE id = ? AND is_deleted = 0`
    ).bind(groupId).first<{ id: number; visibility: string; status: string; max_members: number | null }>()

    if (!group || group.status !== 'active') {
      return c.json(fail('그룹을 찾을 수 없거나 활성 상태가 아닙니다.'), 404)
    }

    // 이미 가입 여부 확인
    const existing = await c.env.DB.prepare(
      'SELECT status FROM group_members WHERE group_id = ? AND user_id = ?'
    ).bind(groupId, userId).first<{ status: string }>()

    if (existing) {
      if (existing.status === 'active') return c.json(fail('이미 가입된 그룹입니다.'), 409)
      if (existing.status === 'pending') return c.json(fail('이미 가입 신청 중입니다.'), 409)
    }

    // ── 플랜별 최대 멤버 수 확인 ──────────────────────────
    // groups.max_members: 그룹 자체 정원 (관리자가 설정)
    // plans.max_group_members: 그룹 관리자 플랜이 허용하는 최대 멤버 수
    const [memberCountRow, groupAdminPlan] = await Promise.all([
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ? AND status = 'active'`
      ).bind(groupId).first<{ cnt: number }>(),
      c.env.DB.prepare(`
        SELECT p.max_group_members
        FROM groups g
        JOIN users u ON u.id = g.admin_user_id
        JOIN plans p ON p.code = u.plan
        WHERE g.id = ?
      `).bind(groupId).first<{ max_group_members: number | null }>()
    ])

    const currentCount = memberCountRow?.cnt ?? 0

    // 그룹 자체 정원 초과 체크
    if (group.max_members && currentCount >= group.max_members) {
      return c.json(fail('그룹 정원이 가득 찼습니다.'), 409)
    }

    // 플랜 멤버 한도 초과 체크 (NULL = 무제한)
    const planLimit = groupAdminPlan?.max_group_members ?? null
    if (planLimit !== null && currentCount >= planLimit) {
      return c.json({
        success: false,
        error: '그룹 관리자의 플랜 멤버 한도에 도달했습니다.',
        error_code: 'plan_member_limit_reached',
        current: currentCount,
        limit: planLimit,
        upgrade_required: true
      }, 403)
    }

    // 생년월일 입력 시 미성년자 여부 계산
    let isMinor: number | null = null
    if (birth_date) {
      const [by, bm, bd] = birth_date.split('-').map(Number)
      const today = new Date()
      let age = today.getFullYear() - by
      if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) age--
      isMinor = age < 19 ? 1 : 0
    }

    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO group_members (group_id, user_id, status, role, is_minor, birth_date)
      VALUES (?, ?, 'pending', 'member', ?, ?)
    `).bind(groupId, userId, isMinor, birth_date ?? null).run()

    return c.json(ok({
      group_id: groupId,
      status: 'pending',
      message: '가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
    }), 201)
  }
)

// ── 그룹 탈퇴 ────────────────────────────────────────
groups.delete('/:id/leave', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('id'))

  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  if (!member) return c.json(fail('그룹 멤버가 아닙니다.'), 404)
  if (member.role === 'admin') return c.json(fail('관리자는 직접 탈퇴할 수 없습니다. 권한 이임 후 탈퇴해주세요.'), 400)

  await c.env.DB.prepare(`
    UPDATE group_members SET status = 'left', left_at = datetime('now'), updated_at = datetime('now')
    WHERE group_id = ? AND user_id = ?
  `).bind(groupId, userId).run()

  // 그룹 명함 비활성화
  await c.env.DB.prepare(
    `UPDATE cards SET is_active = 0, updated_at = datetime('now') WHERE group_id = ? AND user_id = ? AND card_type = 'group'`
  ).bind(groupId, userId).run()

  return c.json(ok(null, '그룹에서 탈퇴했습니다.'))
})

// ── 그룹 멤버 목록 (관리자용) ────────────────────────
groups.get('/:id/members', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('id'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status') ?? 'active'

  // 관리자 여부 확인
  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  if (!member || !['admin', 'sub_admin'].includes(member.role)) {
    return c.json(fail('그룹 관리자만 멤버 목록을 조회할 수 있습니다.'), 403)
  }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT gm.*, u.name, u.email, u.avatar_url, u.account_type
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND gm.status = ?
      ORDER BY gm.joined_at DESC
      LIMIT ? OFFSET ?
    `).bind(groupId, status, limit, offset).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM group_members WHERE group_id = ? AND status = ?'
    ).bind(groupId, status).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 멤버 승인/거절 (관리자) ───────────────────────────
groups.patch(
  '/:id/members/:userId',
  authMiddleware,
  zValidator('json', z.object({
    action: z.enum(['approve', 'reject', 'kick']),
    role: z.string().optional()
  })),
  async (c) => {
    const adminId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const targetUserId = parseInt(c.req.param('userId'))
    const { action, role } = c.req.valid('json')

    // 관리자 권한 확인
    const adminMember = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, adminId).first<{ role: string }>()

    if (!adminMember || !['admin', 'sub_admin'].includes(adminMember.role)) {
      return c.json(fail('권한이 없습니다.'), 403)
    }

    // 승인 시 플랜 멤버 한도 체크
    if (action === 'approve') {
      const [memberCountRow, groupAdminPlan] = await Promise.all([
        c.env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ? AND status = 'active'`
        ).bind(groupId).first<{ cnt: number }>(),
        c.env.DB.prepare(`
          SELECT p.max_group_members, g.max_members
          FROM groups g
          JOIN users u ON u.id = g.admin_user_id
          JOIN plans p ON p.code = u.plan
          WHERE g.id = ?
        `).bind(groupId).first<{ max_group_members: number | null; max_members: number | null }>()
      ])

      const currentCount = memberCountRow?.cnt ?? 0

      if (groupAdminPlan?.max_members && currentCount >= groupAdminPlan.max_members) {
        return c.json(fail('그룹 정원이 가득 찼습니다.'), 409)
      }

      const planLimit = groupAdminPlan?.max_group_members ?? null
      if (planLimit !== null && currentCount >= planLimit) {
        return c.json({
          success: false,
          error: '플랜 멤버 한도에 도달했습니다. 플랜을 업그레이드해주세요.',
          error_code: 'plan_member_limit_reached',
          current: currentCount,
          limit: planLimit,
          upgrade_required: true
        }, 403)
      }
    }

    const statusMap = { approve: 'active', reject: 'rejected', kick: 'kicked' }
    const newStatus = statusMap[action]

    await c.env.DB.prepare(`
      UPDATE group_members
      SET status = ?,
          ${action === 'approve' ? 'joined_at = datetime(\'now\'), approved_by = ' + adminId + ',' : ''}
          ${action !== 'approve' && action === 'kick' ? 'left_at = datetime(\'now\'),' : ''}
          ${role ? 'role = \'' + role + '\',' : ''}
          updated_at = datetime('now')
      WHERE group_id = ? AND user_id = ?
    `).bind(newStatus, groupId, targetUserId).run()

    const messages = { approve: '승인', reject: '거절', kick: '강제 탈퇴' }
    return c.json(ok(null, `멤버를 ${messages[action]}했습니다.`))
  }
)

// ── 공지사항 목록 ────────────────────────────────────
groups.get('/:id/notices', async (c) => {
  const groupId = c.req.param('id')
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT n.*, u.name as author_name
      FROM notices n
      JOIN users u ON u.id = n.author_id
      WHERE n.group_id = ? AND n.is_deleted = 0
      ORDER BY n.is_pinned DESC, n.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(groupId, limit, offset).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM notices WHERE group_id = ? AND is_deleted = 0'
    ).bind(groupId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 공지사항 작성 (관리자) ───────────────────────────
groups.post(
  '/:id/notices',
  authMiddleware,
  zValidator('json', z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    is_pinned: z.number().int().min(0).max(1).default(0)
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const body = c.req.valid('json')

    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    if (!member || !['admin', 'sub_admin', 'executive'].includes(member.role)) {
      return c.json(fail('공지사항 작성 권한이 없습니다.'), 403)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO notices (group_id, author_id, title, content, is_pinned)
      VALUES (?, ?, ?, ?, ?)
    `).bind(groupId, userId, body.title, body.content, body.is_pinned).run()

    return c.json(ok({ notice_id: result.meta.last_row_id }, '공지사항이 등록되었습니다.'), 201)
  }
)

// ── 관리자 권한 이임 요청 ────────────────────────────
groups.post(
  '/:id/transfer-admin',
  authMiddleware,
  zValidator('json', z.object({
    to_user_id: z.number().int().positive()
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const { to_user_id } = c.req.valid('json')

    // 현재 관리자 확인
    const group = await c.env.DB.prepare(
      `SELECT admin_user_id FROM groups WHERE id = ? AND is_deleted = 0`
    ).bind(groupId).first<{ admin_user_id: number }>()

    if (!group || group.admin_user_id !== userId) {
      return c.json(fail('그룹 관리자만 권한을 이임할 수 있습니다.'), 403)
    }

    // 대상 유저가 그룹 멤버인지 확인
    const targetMember = await c.env.DB.prepare(
      `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, to_user_id).first()

    if (!targetMember) {
      return c.json(fail('대상 유저가 그룹 멤버가 아닙니다.'), 400)
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(`
      INSERT INTO group_admin_transfers (group_id, from_user_id, to_user_id, status, expires_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).bind(groupId, userId, to_user_id, expiresAt).run()

    return c.json(ok(null, '관리자 권한 이임 요청을 발송했습니다. 대상자의 수락을 기다려주세요.'), 201)
  }
)

// ── 그룹 초대 링크 생성 (관리자) ─────────────────────
groups.post(
  '/:id/invite-links',
  authMiddleware,
  zValidator('json', z.object({
    label: z.string().max(100).optional(),          // 링크 구분 라벨 (예: "2026 봄 수영반")
    max_uses: z.number().int().positive().optional(), // 최대 사용 횟수 (미입력 = 무제한)
    expires_days: z.number().int().min(1).max(365).optional() // 만료 일수 (미입력 = 무기한)
  })),
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const body = c.req.valid('json')

    // 그룹 관리자 또는 super_admin 확인
    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    const userRole = await c.env.DB.prepare(
      `SELECT role FROM users WHERE id = ?`
    ).bind(userId).first<{ role: string }>()

    const isSuperAdmin = userRole?.role === 'super_admin'
    const isGroupAdmin = member && ['admin', 'sub_admin'].includes(member.role)

    if (!isSuperAdmin && !isGroupAdmin) {
      return c.json(fail('그룹 관리자만 초대 링크를 생성할 수 있습니다.'), 403)
    }

    // 그룹 존재 및 활성 확인
    const group = await c.env.DB.prepare(
      `SELECT id FROM groups WHERE id = ? AND status = 'active' AND is_deleted = 0`
    ).bind(groupId).first()
    if (!group) return c.json(fail('활성 상태의 그룹을 찾을 수 없습니다.'), 404)

    const token = crypto.randomUUID()
    const expiresAt = body.expires_days
      ? new Date(Date.now() + body.expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    await c.env.DB.prepare(`
      INSERT INTO group_invite_links (token, group_id, created_by, label, max_uses, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(token, groupId, userId, body.label ?? null, body.max_uses ?? null, expiresAt).run()

    return c.json(ok({
      token,
      invite_url: `https://the-meti.pages.dev/invite/${token}`,  // 앱 딥링크 or 웹 URL
      label: body.label ?? null,
      max_uses: body.max_uses ?? null,
      expires_at: expiresAt
    }, '초대 링크가 생성되었습니다.'), 201)
  }
)

// ── 그룹 초대 링크 목록 조회 (관리자) ────────────────
groups.get('/:id/invite-links', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const groupId = parseInt(c.req.param('id'))

  const member = await c.env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()

  const userRole = await c.env.DB.prepare(
    `SELECT role FROM users WHERE id = ?`
  ).bind(userId).first<{ role: string }>()

  if (userRole?.role !== 'super_admin' && (!member || !['admin', 'sub_admin'].includes(member.role))) {
    return c.json(fail('권한이 없습니다.'), 403)
  }

  const rows = await c.env.DB.prepare(`
    SELECT
      gil.id, gil.token, gil.label, gil.max_uses, gil.used_count,
      gil.expires_at, gil.is_active, gil.created_at,
      u.name as created_by_name
    FROM group_invite_links gil
    JOIN users u ON u.id = gil.created_by
    WHERE gil.group_id = ?
    ORDER BY gil.created_at DESC
  `).bind(groupId).all()

  // 각 링크에 invite_url 추가
  const links = rows.results.map((row: Record<string, unknown>) => ({
    ...row,
    invite_url: `https://the-meti.pages.dev/invite/${row.token}`
  }))

  return c.json(ok(links))
})

// ── 그룹 초대 링크 비활성화 (관리자) ─────────────────
groups.patch(
  '/:id/invite-links/:linkId/deactivate',
  authMiddleware,
  async (c) => {
    const userId = c.get('userId')
    const groupId = parseInt(c.req.param('id'))
    const linkId = parseInt(c.req.param('linkId'))

    const member = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    const userRole = await c.env.DB.prepare(
      `SELECT role FROM users WHERE id = ?`
    ).bind(userId).first<{ role: string }>()

    if (userRole?.role !== 'super_admin' && (!member || !['admin', 'sub_admin'].includes(member.role))) {
      return c.json(fail('권한이 없습니다.'), 403)
    }

    const link = await c.env.DB.prepare(
      `SELECT id FROM group_invite_links WHERE id = ? AND group_id = ?`
    ).bind(linkId, groupId).first()
    if (!link) return c.json(fail('초대 링크를 찾을 수 없습니다.'), 404)

    await c.env.DB.prepare(`
      UPDATE group_invite_links
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `).bind(linkId).run()

    return c.json(ok(null, '초대 링크가 비활성화되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// PATCH /:id/members/:memberId/role
// 멤버 역할 변경 (admin 전용) — instructor 포함
// ══════════════════════════════════════════════════════════════
groups.patch(
  '/:id/members/:memberId/role',
  authMiddleware,
  zValidator('json', z.object({
    role: z.enum(['sub_admin', 'instructor', 'member'])
  })),
  async (c) => {
    const userId   = c.get('userId')
    const groupId  = parseInt(c.req.param('id'))
    const memberId = parseInt(c.req.param('memberId'))
    const { role } = c.req.valid('json')

    // 요청자가 admin인지 확인
    const adminMember = await c.env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
    ).bind(groupId, userId).first<{ role: string }>()

    if (!adminMember || adminMember.role !== 'admin') {
      return c.json(fail('그룹 오너(admin)만 역할을 변경할 수 있습니다.'), 403)
    }

    // 대상 멤버가 존재하는지 확인
    const target = await c.env.DB.prepare(
      `SELECT id, user_id, role FROM group_members WHERE id = ? AND group_id = ? AND status = 'active'`
    ).bind(memberId, groupId).first<{ id: number; user_id: number; role: string }>()

    if (!target) return c.json(fail('멤버를 찾을 수 없습니다.'), 404)
    if (target.user_id === userId) return c.json(fail('자기 자신의 역할은 변경할 수 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE group_members SET role = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(role, memberId).run()

    return c.json(ok({ member_id: memberId, role }, `역할이 '${role}'(으)로 변경되었습니다.`))
  }
)

export default groups
