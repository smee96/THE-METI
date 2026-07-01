import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

// 마운트 위치: /admin/partners
const partnerAdmin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── GET /admin/partners — 파트너 서비스 목록 ─────────────────
partnerAdmin.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT ps.*,
      (SELECT COUNT(*) FROM partner_user_mapping WHERE partner_id = ps.id) as mapped_users,
      (SELECT COUNT(*) FROM partner_reward_events WHERE partner_id = ps.id AND processed = 1) as total_rewards,
      (SELECT COALESCE(SUM(points_awarded),0) FROM partner_reward_events WHERE partner_id = ps.id AND processed = 1) as total_points
    FROM partner_services ps
    ORDER BY ps.created_at DESC
  `).all()
  return c.json(ok(rows.results))
})

// ── POST /admin/partners — 파트너 서비스 등록 ───────────────
partnerAdmin.post(
  '/',
  zValidator('json', z.object({
    name:        z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    webview_url: z.string().url().optional(),   // WebView로 열 게임/서비스 URL
    open_mode:   z.enum(['webview', 'external']).optional(),  // webview=인앱 / external=외부 브라우저
    webhook_url: z.string().url().optional(),
  })),
  async (c) => {
    const body = c.req.valid('json')

    // API 키 자동 생성 (랜덤 32바이트 hex)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    const apiKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const result = await c.env.DB.prepare(`
      INSERT INTO partner_services (name, description, api_key, webview_url, open_mode, webhook_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      body.name,
      body.description ?? null,
      apiKey,
      body.webview_url ?? null,
      body.open_mode ?? 'webview',
      body.webhook_url ?? null
    ).run()

    return c.json(ok({
      id:      result.meta.last_row_id,
      api_key: apiKey,
      message: 'API 키는 이 응답에서만 확인 가능합니다. 안전하게 보관해주세요.'
    }, '파트너가 등록되었습니다.'), 201)
  }
)

// ── GET /admin/partners/:id — 파트너 상세 ───────────────────
partnerAdmin.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const [partner, recentEvents] = await Promise.all([
    c.env.DB.prepare(`
      SELECT ps.*,
        (SELECT COUNT(*) FROM partner_user_mapping WHERE partner_id = ps.id) as mapped_users,
        (SELECT COALESCE(SUM(points_awarded),0) FROM partner_reward_events WHERE partner_id = ps.id AND processed = 1) as total_points
      FROM partner_services ps WHERE ps.id = ?
    `).bind(id).first(),
    c.env.DB.prepare(`
      SELECT pre.*, u.name as user_name, u.email as user_email
      FROM partner_reward_events pre
      LEFT JOIN users u ON u.id = pre.user_id
      WHERE pre.partner_id = ?
      ORDER BY pre.created_at DESC LIMIT 20
    `).bind(id).all()
  ])

  if (!partner) return c.json(fail('파트너를 찾을 수 없습니다.'), 404)

  return c.json(ok({ partner, recent_events: recentEvents.results }))
})

// ── PATCH /admin/partners/:id — 파트너 수정 ─────────────────
partnerAdmin.patch(
  '/:id',
  zValidator('json', z.object({
    name:        z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    webview_url: z.string().url().nullable().optional(),
    open_mode:   z.enum(['webview', 'external']).optional(),
    webhook_url: z.string().url().nullable().optional(),
    status:      z.enum(['active', 'inactive', 'suspended']).optional(),
  })),
  async (c) => {
    const id   = parseInt(c.req.param('id'))
    const body = c.req.valid('json')

    const partner = await c.env.DB.prepare('SELECT id FROM partner_services WHERE id = ?').bind(id).first()
    if (!partner) return c.json(fail('파트너를 찾을 수 없습니다.'), 404)

    const fields: string[] = [`updated_at = datetime('now')`]
    const vals: unknown[] = []
    if (body.name        !== undefined) { fields.push('name = ?');        vals.push(body.name) }
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description) }
    if (body.webview_url !== undefined) { fields.push('webview_url = ?'); vals.push(body.webview_url) }
    if (body.open_mode   !== undefined) { fields.push('open_mode = ?');   vals.push(body.open_mode) }
    if (body.webhook_url !== undefined) { fields.push('webhook_url = ?'); vals.push(body.webhook_url) }
    if (body.status      !== undefined) { fields.push('status = ?');      vals.push(body.status) }

    await c.env.DB.prepare(
      `UPDATE partner_services SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, id).run()

    return c.json(ok(null, '파트너 정보가 수정되었습니다.'))
  }
)

// ── POST /admin/partners/:id/regenerate-key — API 키 재발급 ─
partnerAdmin.post('/:id/regenerate-key', async (c) => {
  const id = parseInt(c.req.param('id'))

  const partner = await c.env.DB.prepare('SELECT id FROM partner_services WHERE id = ?').bind(id).first()
  if (!partner) return c.json(fail('파트너를 찾을 수 없습니다.'), 404)

  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const newApiKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  await c.env.DB.prepare(
    `UPDATE partner_services SET api_key = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(newApiKey, id).run()

  return c.json(ok({
    api_key: newApiKey,
    message: 'API 키가 재발급되었습니다. 기존 키는 즉시 만료됩니다.'
  }))
})

// ── GET /admin/partners/:id/reward-events — 리워드 이벤트 내역
partnerAdmin.get('/:id/reward-events', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT pre.*, u.name as user_name, u.email as user_email
      FROM partner_reward_events pre
      LEFT JOIN users u ON u.id = pre.user_id
      WHERE pre.partner_id = ?
      ORDER BY pre.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(id, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM partner_reward_events WHERE partner_id = ?`).bind(id).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

export default partnerAdmin
