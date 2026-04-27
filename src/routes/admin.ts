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

// ── 그룹 승인/거절 ────────────────────────────────────
admin.get('/groups', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status = c.req.query('status') ?? 'pending'

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT g.*, u.name as admin_name, u.email as admin_email
      FROM groups g
      LEFT JOIN users u ON u.id = g.admin_user_id
      WHERE g.status = ? AND g.is_deleted = 0
      ORDER BY g.created_at DESC LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM groups WHERE status = ? AND is_deleted = 0').bind(status).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

admin.patch(
  '/groups/:id',
  zValidator('json', z.object({
    action: z.enum(['approve', 'reject', 'suspend', 'activate']),
    is_featured: z.number().int().min(0).max(1).optional()
  })),
  async (c) => {
    const adminId = c.get('userId')
    const groupId = c.req.param('id')
    const { action, is_featured } = c.req.valid('json')

    const statusMap: Record<string, string> = {
      approve: 'active', reject: 'suspended', suspend: 'suspended', activate: 'active'
    }

    const updates: string[] = [`status = '${statusMap[action]}'`]
    const values: unknown[] = []

    if (action === 'approve') {
      updates.push(`approved_by = ${adminId}`, `approved_at = datetime('now')`)
    }
    if (is_featured !== undefined) { updates.push(`is_featured = ?`); values.push(is_featured) }
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

    return c.json(ok(null, `그룹이 ${action === 'approve' ? '승인' : action === 'reject' ? '거절' : '상태 변경'}되었습니다.`))
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

export default admin
