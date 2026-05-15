import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware, superAdminMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 모든 admin 라우트는 인증 + 슈퍼관리자 권한 필요
admin.use('*', authMiddleware, superAdminMiddleware)

// ── 대시보드 통계 ─────────────────────────────────────
admin.get('/dashboard', async (c) => {
  const [users, groups, events, reports] = await Promise.all([
    c.env.DB.prepare(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free_plan,
      SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro_plan,
      SUM(CASE WHEN plan = 'business' THEN 1 ELSE 0 END) as business_plan
      FROM users WHERE is_deleted = 0`).first(),
    c.env.DB.prepare(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM groups WHERE is_deleted = 0`).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'upcoming' THEN 1 ELSE 0 END) as upcoming
      FROM events WHERE is_deleted = 0`).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM reports`).first()
  ])

  return c.json(ok({ users, groups, events, reports }))
})

// ── 유저 관리 ─────────────────────────────────────────
admin.get('/users', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const search = c.req.query('q')
  const plan = c.req.query('plan')

  let query = `SELECT id, email, name, account_type, plan, is_verified, is_active, created_at FROM users WHERE is_deleted = 0`
  const params: unknown[] = []
  if (search) { query += ` AND (name LIKE ? OR email LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  if (plan) { query += ` AND plan = ?`; params.push(plan) }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE is_deleted = 0').first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

admin.patch(
  '/users/:id',
  zValidator('json', z.object({
    is_active: z.number().int().min(0).max(1).optional(),
    plan: z.enum(['free', 'pro', 'business']).optional()
  })),
  async (c) => {
    const userId = c.req.param('id')
    const body = c.req.valid('json')

    const fields: string[] = []
    const values: unknown[] = []
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active) }
    if (body.plan !== undefined) { fields.push('plan = ?'); values.push(body.plan) }

    if (!fields.length) return c.json(fail('수정할 내용이 없습니다.'), 400)
    fields.push(`updated_at = datetime('now')`)
    values.push(userId)

    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    return c.json(ok(null, '유저 정보가 수정되었습니다.'))
  }
)

// ── 그룹 직접 생성 (슈퍼어드민) ─────────────────────
// 슈퍼어드민은 신청 없이 즉시 그룹 생성 가능
admin.post(
  '/groups',
  zValidator('json', z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    purpose: z.string().max(500).optional(),           // 그룹 용도 설명
    visibility: z.enum(['public', 'private']).default('public'),
    max_members: z.number().int().positive().optional(),
    has_minor: z.number().int().min(0).max(1).optional()  // 0=성인만, 1=미성년자 포함
  })),
  async (c) => {
    const adminId = c.get('userId')
    const body = c.req.valid('json')

    const result = await c.env.DB.prepare(`
      INSERT INTO groups (name, description, purpose, visibility, status,
        admin_user_id, approved_by, approved_at, max_members, has_minor)
      VALUES (?, ?, ?, ?, 'active', ?, ?, datetime('now'), ?, ?)
    `).bind(
      body.name, body.description ?? null, body.purpose ?? null,
      body.visibility, adminId, adminId,
      body.max_members ?? null, body.has_minor ?? null
    ).run()

    const groupId = result.meta.last_row_id

    // 슈퍼어드민을 그룹 admin 멤버로 자동 등록
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO group_members (group_id, user_id, role, status, joined_at, approved_by, approved_at)
      VALUES (?, ?, 'admin', 'active', datetime('now'), ?, datetime('now'))
    `).bind(groupId, adminId, adminId).run()

    return c.json(ok({ group_id: groupId, status: 'active' }, '그룹이 생성되었습니다.'), 201)
  }
)

// ── 그룹 승인/거절 ────────────────────────────────────
admin.get('/groups', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status')  // undefined = 전체

  const [rows, countRow] = await Promise.all([
    status
      ? c.env.DB.prepare(`
          SELECT g.id, g.name, g.description, g.category, g.purpose, g.visibility, g.status,
            g.max_members, g.has_minor, g.is_featured, g.created_at,
            u.name as admin_name, u.email as admin_email
          FROM groups g
          LEFT JOIN users u ON u.id = g.admin_user_id
          WHERE g.status = ? AND g.is_deleted = 0
          ORDER BY g.created_at DESC LIMIT ? OFFSET ?
        `).bind(status, limit, offset).all()
      : c.env.DB.prepare(`
          SELECT g.id, g.name, g.description, g.category, g.purpose, g.visibility, g.status,
            g.max_members, g.has_minor, g.is_featured, g.created_at,
            u.name as admin_name, u.email as admin_email
          FROM groups g
          LEFT JOIN users u ON u.id = g.admin_user_id
          WHERE g.is_deleted = 0
          ORDER BY g.created_at DESC LIMIT ? OFFSET ?
        `).bind(limit, offset).all(),
    status
      ? c.env.DB.prepare('SELECT COUNT(*) as total FROM groups WHERE status = ? AND is_deleted = 0').bind(status).first<{ total: number }>()
      : c.env.DB.prepare('SELECT COUNT(*) as total FROM groups WHERE is_deleted = 0').first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

admin.patch(
  '/groups/:id',
  zValidator('json', z.object({
    action: z.enum(['approve', 'reject', 'suspend', 'activate']),
    is_featured: z.number().int().min(0).max(1).optional(),
    // 승인 시 미성년자 포함 여부 체크 (관리자가 용도 심사 후 직접 판단)
    // null = 미판단, 0 = 성인만, 1 = 미성년자 포함
    has_minor: z.number().int().min(0).max(1).nullable().optional()
  })),
  async (c) => {
    const adminId = c.get('userId')
    const groupId = c.req.param('id')
    const { action, is_featured, has_minor } = c.req.valid('json')

    const statusMap: Record<string, string> = {
      approve: 'active', reject: 'rejected', suspend: 'suspended', activate: 'active'
    }

    const updates: string[] = [`status = '${statusMap[action]}'`]
    const values: unknown[] = []

    if (action === 'approve') {
      updates.push(`approved_by = ${adminId}`, `approved_at = datetime('now')`)
    }
    if (is_featured !== undefined) { updates.push(`is_featured = ?`); values.push(is_featured) }
    // 미성년자 포함 여부: 승인 시 관리자가 용도 확인 후 체크
    if (has_minor !== undefined) { updates.push(`has_minor = ?`); values.push(has_minor) }
    updates.push(`updated_at = datetime('now')`)
    values.push(groupId)

    await c.env.DB.prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    // 승인 시 신청자를 그룹 관리자로 등록
    if (action === 'approve') {
      const group = await c.env.DB.prepare(
        'SELECT admin_user_id FROM groups WHERE id = ?'
      ).bind(groupId).first<{ admin_user_id: number }>()

      if (group?.admin_user_id) {
        await c.env.DB.prepare(`
          INSERT OR REPLACE INTO group_members (group_id, user_id, role, status, joined_at, approved_by, approved_at)
          VALUES (?, ?, 'admin', 'active', datetime('now'), ?, datetime('now'))
        `).bind(parseInt(groupId), group.admin_user_id, adminId).run()
      }
    }

    const actionMsg: Record<string, string> = {
      approve: '승인', reject: '거절', suspend: '정지', activate: '활성화'
    }
    return c.json(ok(null, `그룹이 ${actionMsg[action]}되었습니다.`))
  }
)

// ── 행사 직접 생성 (슈퍼어드민) ─────────────────────
admin.post(
  '/events',
  zValidator('json', z.object({
    group_id: z.number().int().positive(),
    title: z.string().min(2).max(200),
    description: z.string().optional(),
    location: z.string().max(200).optional(),
    starts_at: z.string(),
    ends_at: z.string().optional(),
    visibility: z.enum(['public', 'group_only']).default('public'),
    registration_type: z.enum(['free', 'pre_required']).default('free'),
    entry_method: z.enum(['nfc_qr', 'qr', 'manual']).default('qr'),
    max_participants: z.number().int().positive().optional()
  })),
  async (c) => {
    const adminId = c.get('userId')
    const body = c.req.valid('json')

    // 그룹 존재 여부 확인
    const group = await c.env.DB.prepare(
      `SELECT id FROM groups WHERE id = ? AND status = 'active' AND is_deleted = 0`
    ).bind(body.group_id).first()
    if (!group) return c.json(fail('활성 상태의 그룹을 찾을 수 없습니다.'), 404)

    const result = await c.env.DB.prepare(`
      INSERT INTO events (group_id, organizer_id, title, description, location,
        starts_at, ends_at, visibility, registration_type, entry_method, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')
    `).bind(
      body.group_id, adminId, body.title, body.description ?? null, body.location ?? null,
      body.starts_at, body.ends_at ?? null,
      body.visibility, body.registration_type, body.entry_method, body.max_participants ?? null
    ).run()

    return c.json(ok({ event_id: result.meta.last_row_id }, '행사가 생성되었습니다.'), 201)
  }
)

// ── 신고 관리 ─────────────────────────────────────────
admin.get('/reports', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status') ?? 'pending'

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT r.*, u.name as reporter_name, u.email as reporter_email
      FROM reports r
      JOIN users u ON u.id = r.reporter_id
      WHERE r.status = ?
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM reports WHERE status = ?').bind(status).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

admin.patch(
  '/reports/:id',
  zValidator('json', z.object({
    status: z.enum(['reviewed', 'resolved', 'dismissed'])
  })),
  async (c) => {
    const adminId = c.get('userId')
    const reportId = c.req.param('id')
    const { status } = c.req.valid('json')

    await c.env.DB.prepare(`
      UPDATE reports SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).bind(status, adminId, reportId).run()

    return c.json(ok(null, '신고가 처리되었습니다.'))
  }
)

// ── 파트너 서비스 관리 ────────────────────────────────
admin.get('/partners', async (c) => {
  const partners = await c.env.DB.prepare(
    'SELECT id, name, description, status, created_at FROM partner_services ORDER BY created_at DESC'
  ).all()
  return c.json(ok(partners.results))
})

admin.post(
  '/partners',
  zValidator('json', z.object({
    name: z.string().min(2),
    description: z.string().optional()
  })),
  async (c) => {
    const { name, description } = c.req.valid('json')
    const apiKey = `meti_partner_${crypto.randomUUID().replace(/-/g, '')}`

    const result = await c.env.DB.prepare(`
      INSERT INTO partner_services (name, description, api_key) VALUES (?, ?, ?)
    `).bind(name, description ?? null, apiKey).run()

    return c.json(ok({
      id: result.meta.last_row_id,
      name,
      api_key: apiKey
    }, '파트너 서비스가 등록되었습니다.'), 201)
  }
)

// ── 리워드 잔액/이력 조회 ────────────────────────────
admin.get('/rewards', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT r.*, u.name, u.email, ps.name as partner_name
      FROM rewards r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN partner_services ps ON ps.id = r.partner_id
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM rewards').first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── NFC 실물카드 관리 ────────────────────────────────
admin.get('/nfc-cards', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status') ?? 'pending'

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT n.*, u.name as user_name, u.email as user_email, g.name as group_name
      FROM nfc_physical_cards n
      LEFT JOIN users u ON u.id = n.user_id
      LEFT JOIN groups g ON g.id = n.group_id
      WHERE n.status = ?
      ORDER BY n.applied_at DESC LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM nfc_physical_cards WHERE status = ?').bind(status).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

admin.patch(
  '/nfc-cards/:id',
  zValidator('json', z.object({
    action: z.enum(['approve', 'issue', 'reject', 'deactivate']),
    nfc_uid: z.string().optional(),
    serial_no: z.string().optional()
  })),
  async (c) => {
    const cardId = c.req.param('id')
    const { action, nfc_uid, serial_no } = c.req.valid('json')

    const statusMap: Record<string, string> = {
      approve: 'approved', issue: 'issued', reject: 'pending', deactivate: 'deactivated'
    }

    const updates: string[] = [`status = '${statusMap[action]}'`]
    const values: unknown[] = []

    if (action === 'issue') {
      updates.push(`issued_at = datetime('now')`)
      if (nfc_uid) { updates.push(`nfc_uid = ?`); values.push(nfc_uid) }
      if (serial_no) { updates.push(`serial_no = ?`); values.push(serial_no) }
    }
    if (action === 'deactivate') updates.push(`deactivated_at = datetime('now')`)
    updates.push(`updated_at = datetime('now')`)
    values.push(cardId)

    await c.env.DB.prepare(`UPDATE nfc_physical_cards SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    return c.json(ok(null, 'NFC 카드 상태가 변경되었습니다.'))
  }
)

// ── 플랜 설정 조회 ────────────────────────────────────
admin.get('/plan-configs', superAdminMiddleware, async (c) => {
  const plans = await c.env.DB.prepare(`
    SELECT code, name, max_cards, max_groups, max_group_members, monthly_points, price_monthly, features
    FROM plans WHERE target = 'user' ORDER BY price_monthly ASC
  `).all()
  return c.json(ok(plans.results))
})

// ── 플랜 설정 변경 ────────────────────────────────────
admin.patch(
  '/plan-configs/:code',
  superAdminMiddleware,
  zValidator('json', z.object({
    max_group_members: z.number().int().positive().nullable().optional(),
    max_cards:         z.number().int().positive().nullable().optional(),
    monthly_points:    z.number().int().min(0).optional(),
    price_monthly:     z.number().int().min(0).optional(),
  })),
  async (c) => {
    const code = c.req.param('code')
    const body = c.req.valid('json')
    const adminId = c.get('userId')

    const plan = await c.env.DB.prepare(
      `SELECT code FROM plans WHERE code = ? AND target = 'user'`
    ).bind(code).first()
    if (!plan) return c.json(fail('플랜을 찾을 수 없습니다.'), 404)

    const updates: string[] = [`updated_at = datetime('now')`, `updated_by = ?`]
    const values: unknown[] = [adminId]

    if (body.max_group_members !== undefined) { updates.push('max_group_members = ?'); values.push(body.max_group_members) }
    if (body.max_cards         !== undefined) { updates.push('max_cards = ?');         values.push(body.max_cards) }
    if (body.monthly_points    !== undefined) { updates.push('monthly_points = ?');    values.push(body.monthly_points) }
    if (body.price_monthly     !== undefined) { updates.push('price_monthly = ?');     values.push(body.price_monthly) }

    values.push(code)
    await c.env.DB.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE code = ?`).bind(...values).run()

    return c.json(ok(null, `${code} 플랜 설정이 변경되었습니다.`))
  }
)

// ══════════════════════════════════════════════════════════════
// GET /admin/lessons  — 전체 레슨 목록 (어드민 전용)
// ══════════════════════════════════════════════════════════════
admin.get('/lessons', superAdminMiddleware, async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status   = c.req.query('status')
  const groupId  = c.req.query('group_id')
  const search   = c.req.query('q')

  let baseWhere = `WHERE 1=1`
  const filterParams: unknown[] = []
  if (status  && status !== 'all') { baseWhere += ` AND l.status = ?`;   filterParams.push(status) }
  if (groupId) { baseWhere += ` AND l.group_id = ?`; filterParams.push(Number(groupId)) }
  if (search)  { baseWhere += ` AND (l.title LIKE ? OR u.name LIKE ?)`; filterParams.push(`%${search}%`, `%${search}%`) }

  const query = `
    SELECT l.*,
      g.name  AS group_name,
      u.name  AS instructor_name, u.email AS instructor_email,
      (SELECT COUNT(*) FROM lesson_registrations WHERE lesson_id = l.id AND status = 'confirmed') AS registered_count
    FROM lessons l
    JOIN groups g ON g.id = l.group_id
    JOIN users  u ON u.id = l.instructor_id
    ${baseWhere}
    ORDER BY l.scheduled_at DESC LIMIT ? OFFSET ?
  `

  const countQuery = `
    SELECT COUNT(*) as total FROM lessons l
    JOIN users u ON u.id = l.instructor_id
    ${baseWhere}
  `

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...filterParams, limit, offset).all(),
    c.env.DB.prepare(countQuery).bind(...filterParams).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// 유저 상세 (명함 + 그룹 + 포인트 한번에)
// ══════════════════════════════════════════════════════════════
admin.get('/users/:id/detail', async (c) => {
  const userId = Number(c.req.param('id'))

  const [user, cards, groups, wallet] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, email, name, account_type, plan, is_verified, is_active, role, created_at
      FROM users WHERE id = ? AND is_deleted = 0
    `).bind(userId).first(),
    c.env.DB.prepare(`
      SELECT id, title, job_title, company, is_default, is_active, created_at
      FROM cards WHERE user_id = ? AND is_deleted = 0 ORDER BY is_default DESC, created_at DESC
    `).bind(userId).all(),
    c.env.DB.prepare(`
      SELECT g.id, g.name, g.status, gm.role, gm.joined_at
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ? AND gm.status = 'active' AND g.is_deleted = 0
      ORDER BY gm.joined_at DESC
    `).bind(userId).all(),
    c.env.DB.prepare(`
      SELECT balance FROM point_wallets WHERE owner_type = 'user' AND owner_id = ?
    `).bind(userId).first<{ balance: number }>()
  ])

  if (!user) return c.json(fail('유저를 찾을 수 없습니다.'), 404)

  return c.json(ok({
    user,
    cards:         cards.results,
    groups:        groups.results,
    point_balance: wallet?.balance ?? 0
  }))
})

// ══════════════════════════════════════════════════════════════
// 명함 관리
// ══════════════════════════════════════════════════════════════
admin.get('/cards', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const search    = c.req.query('q')       // 유저 이름/이메일
  const isActive  = c.req.query('active')  // '1' | '0'

  let query = `
    SELECT c.id, c.title, c.job_title, c.company, c.is_default, c.is_active, c.created_at,
           u.id as user_id, u.name as user_name, u.email as user_email
    FROM cards c
    JOIN users u ON u.id = c.user_id
    WHERE c.is_deleted = 0
  `
  const params: unknown[] = []
  if (search)   { query += ` AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (isActive !== undefined && isActive !== '') { query += ` AND c.is_active = ?`; params.push(Number(isActive)) }
  query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  let countQ = `SELECT COUNT(*) as total FROM cards c JOIN users u ON u.id = c.user_id WHERE c.is_deleted = 0`
  const countParams: unknown[] = []
  if (search)   { countQ += ` AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)`; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (isActive !== undefined && isActive !== '') { countQ += ` AND c.is_active = ?`; countParams.push(Number(isActive)) }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(countQ).bind(...countParams).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// 명함 활성/비활성화
admin.patch('/cards/:id', zValidator('json', z.object({
  is_active: z.number().int().min(0).max(1)
})), async (c) => {
  const cardId = c.req.param('id')
  const { is_active } = c.req.valid('json')
  const exists = await c.env.DB.prepare(`SELECT id FROM cards WHERE id = ? AND is_deleted = 0`).bind(cardId).first()
  if (!exists) return c.json(fail('명함을 찾을 수 없습니다.'), 404)
  await c.env.DB.prepare(`UPDATE cards SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).bind(is_active, cardId).run()
  return c.json(ok(null, is_active ? '명함이 활성화되었습니다.' : '명함이 비활성화되었습니다.'))
})

// ══════════════════════════════════════════════════════════════
// 포인트 수동 지급 / 차감
// ══════════════════════════════════════════════════════════════
admin.post('/users/:id/points', zValidator('json', z.object({
  amount:      z.number().int().refine(v => v !== 0, '0은 입력할 수 없습니다.'),
  description: z.string().min(1, '사유를 입력해주세요.').max(200)
})), async (c) => {
  const targetId = Number(c.req.param('id'))
  const adminId  = c.get('userId')
  const { amount, description } = c.req.valid('json')

  const user = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? AND is_deleted = 0`).bind(targetId).first()
  if (!user) return c.json(fail('유저를 찾을 수 없습니다.'), 404)

  // 지갑 조회 or 생성
  let wallet = await c.env.DB.prepare(
    `SELECT id, balance FROM point_wallets WHERE owner_type = 'user' AND owner_id = ?`
  ).bind(targetId).first<{ id: number; balance: number }>()

  if (!wallet) {
    const r = await c.env.DB.prepare(
      `INSERT INTO point_wallets (owner_type, owner_id, balance) VALUES ('user', ?, 0)`
    ).bind(targetId).run()
    wallet = { id: r.meta.last_row_id as number, balance: 0 }
  }

  const newBalance = wallet.balance + amount
  if (newBalance < 0) return c.json(fail(`잔액 부족 (현재 ${wallet.balance}P)`), 400)

  const now = new Date().toISOString()
  const type = amount > 0 ? 'charge_admin' : 'use_admin'

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE point_wallets SET balance = ?, updated_at = ? WHERE id = ?`
    ).bind(newBalance, now, wallet.id),
    c.env.DB.prepare(`
      INSERT INTO point_transactions
        (wallet_id, type, point_type, amount, balance_after, ref_type, ref_id, description, created_at)
      VALUES (?, ?, 'reward', ?, ?, 'admin', ?, ?, ?)
    `).bind(wallet.id, type, amount, newBalance, adminId, description, now)
  ])

  return c.json(ok({
    user_id:     targetId,
    amount,
    new_balance: newBalance
  }, `포인트 ${amount > 0 ? '지급' : '차감'} 완료 (${newBalance}P)`))
})

// ══════════════════════════════════════════════════════════════
// 행사 관리 (어드민 전용 — 그룹 멤버 권한 없이 전체 접근)
// ══════════════════════════════════════════════════════════════

// POST /admin/events — 행사 직접 생성 (슈퍼어드민)
admin.post('/events', superAdminMiddleware,
  zValidator('json', z.object({
    group_id          : z.number().int().positive(),
    title             : z.string().min(2).max(200),
    description       : z.string().max(2000).optional(),
    location          : z.string().max(200).optional(),
    starts_at         : z.string(),
    ends_at           : z.string().optional(),
    capacity          : z.number().int().positive().optional(),
    visibility        : z.enum(['public', 'group_only']).default('group_only'),
    registration_type : z.enum(['free', 'pre_required']).default('free'),
    entry_method      : z.enum(['qr', 'nfc_qr', 'manual']).default('qr'),
    entry_fee         : z.number().int().min(0).default(0),
  })),
  async (c) => {
    const adminId = c.get('userId')
    const body    = c.req.valid('json')

    const group = await c.env.DB.prepare(`SELECT id FROM groups WHERE id = ? AND status = 'active'`).bind(body.group_id).first()
    if (!group) return c.json(fail('활성 그룹을 찾을 수 없습니다.'), 404)

    const result = await c.env.DB.prepare(`
      INSERT INTO events
        (group_id, created_by, title, description, location,
         starts_at, ends_at, capacity, visibility, registration_type,
         entry_method, point_cost, entry_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      body.group_id, adminId, body.title, body.description ?? null,
      body.location ?? null, body.starts_at, body.ends_at ?? null,
      body.capacity ?? null, body.visibility, body.registration_type,
      body.entry_method, body.entry_fee
    ).run()

    return c.json(ok({ event_id: result.meta.last_row_id }, '행사가 생성되었습니다.'), 201)
  }
)

// GET /admin/events — 전체 행사 목록
admin.get('/events', superAdminMiddleware, async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status  = c.req.query('status')
  const groupId = c.req.query('group_id')
  const q       = c.req.query('q')

  let query = `
    SELECT e.*,
      g.name  AS group_name,
      u.name  AS creator_name,
      (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') AS participant_count
    FROM events e
    JOIN groups g ON g.id = e.group_id
    JOIN users  u ON u.id = e.created_by
    WHERE 1=1
  `
  const params: unknown[] = []
  if (status)  { query += ` AND e.status = ?`;    params.push(status) }
  if (groupId) { query += ` AND e.group_id = ?`;  params.push(parseInt(groupId)) }
  if (q)       { query += ` AND e.title LIKE ?`;  params.push(`%${q}%`) }
  query += ` ORDER BY e.starts_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  let countQ = `SELECT COUNT(*) as total FROM events WHERE 1=1`
  const countP: unknown[] = []
  if (status)  { countQ += ` AND status = ?`;    countP.push(status) }
  if (groupId) { countQ += ` AND group_id = ?`;  countP.push(parseInt(groupId)) }
  if (q)       { countQ += ` AND title LIKE ?`;  countP.push(`%${q}%`) }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(countQ).bind(...countP).first<{ total: number }>()
  ])
  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// GET /admin/events/:id — 행사 상세 (참가자 포함)
admin.get('/events/:id', superAdminMiddleware, async (c) => {
  const eventId = parseInt(c.req.param('id'))

  const [event, participants] = await Promise.all([
    c.env.DB.prepare(`
      SELECT e.*, g.name AS group_name, u.name AS creator_name,
        (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') AS participant_count
      FROM events e
      JOIN groups g ON g.id = e.group_id
      JOIN users  u ON u.id = e.created_by
      WHERE e.id = ?
    `).bind(eventId).first(),
    c.env.DB.prepare(`
      SELECT ep.*, u.name, u.email
      FROM event_participants ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ?
      ORDER BY ep.joined_at ASC
      LIMIT 100
    `).bind(eventId).all()
  ])

  if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)
  return c.json(ok({ ...event, participants: participants.results }))
})

// PATCH /admin/events/:id — 행사 수정 (제목/설명/장소/일정/상태)
admin.patch('/events/:id', superAdminMiddleware,
  zValidator('json', z.object({
    title      : z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    location   : z.string().max(200).optional(),
    starts_at  : z.string().optional(),
    ends_at    : z.string().optional(),
    status     : z.enum(['upcoming', 'ongoing', 'ended', 'cancelled']).optional(),
    visibility : z.enum(['public', 'group_only']).optional(),
  })),
  async (c) => {
    const eventId = parseInt(c.req.param('id'))
    const body    = c.req.valid('json')

    const event = await c.env.DB.prepare(`SELECT id FROM events WHERE id = ?`).bind(eventId).first()
    if (!event) return c.json(fail('행사를 찾을 수 없습니다.'), 404)

    const fields: string[] = []
    const vals: unknown[]  = []
    if (body.title !== undefined)       { fields.push('title = ?');       vals.push(body.title) }
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description) }
    if (body.location !== undefined)    { fields.push('location = ?');    vals.push(body.location) }
    if (body.starts_at !== undefined)   { fields.push('starts_at = ?');   vals.push(body.starts_at) }
    if (body.ends_at !== undefined)     { fields.push('ends_at = ?');     vals.push(body.ends_at) }
    if (body.status !== undefined)      { fields.push('status = ?');      vals.push(body.status) }
    if (body.visibility !== undefined)  { fields.push('visibility = ?');  vals.push(body.visibility) }
    if (fields.length === 0) return c.json(fail('수정할 내용이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE events SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).bind(...vals, eventId).run()

    return c.json(ok(null, '행사가 수정되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// 레슨 관리 (어드민 전용 CRUD)
// ══════════════════════════════════════════════════════════════

// POST /admin/lessons — 어드민 직접 레슨 생성 (그룹 멤버 권한 우회, 포인트 차감 없음)
admin.post('/lessons', superAdminMiddleware,
  zValidator('json', z.object({
    group_id        : z.number().int().positive(),
    instructor_id   : z.number().int().positive(),
    title           : z.string().min(1).max(200),
    description     : z.string().max(1000).optional(),
    schedule_type   : z.enum(['one-time', 'repeat']).default('one-time'),
    scheduled_at    : z.string(),
    duration_minutes: z.number().int().positive().default(60),
    capacity        : z.number().int().positive().optional(),
    location        : z.string().max(200).optional(),
    point_cost      : z.number().int().min(0).default(0),
  })),
  async (c) => {
    const body = c.req.valid('json')

    // 그룹 존재 확인
    const group = await c.env.DB.prepare(
      `SELECT id FROM groups WHERE id = ? AND is_deleted = 0`
    ).bind(body.group_id).first()
    if (!group) return c.json(fail('존재하지 않는 그룹입니다.'), 404)

    // 강사 존재 확인
    const instructor = await c.env.DB.prepare(
      `SELECT id, name FROM users WHERE id = ? AND is_deleted = 0`
    ).bind(body.instructor_id).first()
    if (!instructor) return c.json(fail('존재하지 않는 강사입니다.'), 404)

    const result = await c.env.DB.prepare(`
      INSERT INTO lessons
        (group_id, instructor_id, title, description, schedule_type,
         scheduled_at, duration_minutes, capacity, location, point_cost, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')
    `).bind(
      body.group_id, body.instructor_id, body.title,
      body.description ?? null, body.schedule_type,
      body.scheduled_at, body.duration_minutes,
      body.capacity ?? null, body.location ?? null, body.point_cost
    ).run()

    return c.json(ok({ id: result.meta.last_row_id }, '레슨이 생성되었습니다.'), 201)
  }
)

// GET /admin/lessons — 전체 레슨 목록 (status/group_id/q 필터, 페이지네이션) — 기존 교체
// 기존 GET /admin/lessons 위에 덮어쓰기 위해 새 버전으로 재등록은 불가 (이미 등록됨)
// → 아래 상세/수정 API만 추가

// GET /admin/lessons/:id — 레슨 상세 + 수강자 목록
admin.get('/lessons/:id', superAdminMiddleware, async (c) => {
  const lessonId = Number(c.req.param('id'))

  const [lesson, registrations] = await Promise.all([
    c.env.DB.prepare(`
      SELECT l.*,
        g.name AS group_name,
        u.name AS instructor_name, u.email AS instructor_email,
        (SELECT COUNT(*) FROM lesson_registrations WHERE lesson_id = l.id AND status = 'confirmed') AS registered_count
      FROM lessons l
      JOIN groups g ON g.id = l.group_id
      JOIN users  u ON u.id = l.instructor_id
      WHERE l.id = ?
    `).bind(lessonId).first(),
    c.env.DB.prepare(`
      SELECT lr.*, u.name, u.email
      FROM lesson_registrations lr
      JOIN users u ON u.id = lr.user_id
      WHERE lr.lesson_id = ?
      ORDER BY lr.created_at ASC
      LIMIT 200
    `).bind(lessonId).all()
  ])

  if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)
  return c.json(ok({ ...lesson, registrations: registrations.results }))
})

// PATCH /admin/lessons/:id — 레슨 수정 (제목/설명/장소/일정/상태/정원)
admin.patch('/lessons/:id', superAdminMiddleware,
  zValidator('json', z.object({
    title           : z.string().min(1).max(200).optional(),
    description     : z.string().max(1000).optional(),
    location        : z.string().max(200).optional(),
    scheduled_at    : z.string().optional(),
    duration_minutes: z.number().int().positive().optional(),
    capacity        : z.number().int().positive().nullable().optional(),
    status          : z.enum(['upcoming', 'ongoing', 'ended', 'cancelled']).optional(),
    instructor_id   : z.number().int().positive().optional(),
  })),
  async (c) => {
    const lessonId = Number(c.req.param('id'))
    const body = c.req.valid('json')

    const lesson = await c.env.DB.prepare(
      `SELECT id FROM lessons WHERE id = ?`
    ).bind(lessonId).first()
    if (!lesson) return c.json(fail('레슨을 찾을 수 없습니다.'), 404)

    const fields: string[] = []
    const vals: unknown[] = []

    if (body.title           !== undefined) { fields.push('title = ?');            vals.push(body.title) }
    if (body.description     !== undefined) { fields.push('description = ?');      vals.push(body.description) }
    if (body.location        !== undefined) { fields.push('location = ?');         vals.push(body.location) }
    if (body.scheduled_at    !== undefined) { fields.push('scheduled_at = ?');     vals.push(body.scheduled_at) }
    if (body.duration_minutes!== undefined) { fields.push('duration_minutes = ?'); vals.push(body.duration_minutes) }
    if (body.capacity        !== undefined) { fields.push('capacity = ?');         vals.push(body.capacity) }
    if (body.status          !== undefined) { fields.push('status = ?');           vals.push(body.status) }
    if (body.instructor_id   !== undefined) { fields.push('instructor_id = ?');    vals.push(body.instructor_id) }

    if (fields.length === 0) return c.json(fail('변경할 항목이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, lessonId).run()

    return c.json(ok(null, '레슨이 수정되었습니다.'))
  }
)

export default admin
