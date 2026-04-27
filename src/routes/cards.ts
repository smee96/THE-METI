import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const cards = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 명함 목록 조회 (내 명함) ──────────────────────────
cards.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { page, limit, offset } = parsePagination(
    c.req.query('page'), c.req.query('limit')
  )

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM card_sns_links WHERE card_id = c.id) as sns_count
      FROM cards c
      WHERE c.user_id = ? AND c.is_deleted = 0
      ORDER BY c.is_primary DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM cards WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 명함 생성 ─────────────────────────────────────────
cards.post(
  '/',
  authMiddleware,
  zValidator('json', z.object({
    card_type: z.enum(['personal', 'group']).default('personal'),
    group_id: z.number().int().positive().optional(),
    name: z.string().min(1).max(100),
    title: z.string().max(100).optional(),
    company: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    website: z.string().url().optional().or(z.literal('')),
    bio: z.string().max(500).optional(),
    template_id: z.string().default('default'),
    is_public: z.number().int().min(0).max(1).default(1),
    sns_links: z.array(z.object({
      platform: z.string(),
      url: z.string().url(),
      sort_order: z.number().default(0)
    })).optional(),
    tags: z.array(z.object({
      tag_type: z.string(),
      tag_value: z.string()
    })).optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const userPlan = c.get('userPlan')
    const body = c.req.valid('json')

    // 플랜별 명함 수 제한
    const cardCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM cards WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first<{ total: number }>()

    const maxCards: Record<string, number | null> = { free: 3, pro: 10, business: null }
    const max = maxCards[userPlan]
    if (max !== null && (cardCount?.total ?? 0) >= max) {
      return c.json({
        success: false,
        error: `${userPlan.toUpperCase()} 플랜의 명함 생성 한도(${max}개)에 도달했습니다.`,
        upgrade_required: true
      }, 403)
    }

    // 그룹 명함이면 멤버 여부 확인
    if (body.card_type === 'group' && body.group_id) {
      const member = await c.env.DB.prepare(
        `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
      ).bind(body.group_id, userId).first()
      if (!member) {
        return c.json(fail('해당 그룹의 멤버만 그룹 명함을 생성할 수 있습니다.'), 403)
      }
    }

    // 명함 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO cards (user_id, group_id, card_type, name, title, company, email, phone, website, bio, template_id, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, body.group_id ?? null, body.card_type, body.name,
      body.title ?? null, body.company ?? null, body.email ?? null,
      body.phone ?? null, body.website ?? null, body.bio ?? null,
      body.template_id, body.is_public
    ).run()

    const cardId = result.meta.last_row_id as number

    // SNS 링크 저장
    if (body.sns_links?.length) {
      const stmts = body.sns_links.map(link =>
        c.env.DB.prepare(
          'INSERT INTO card_sns_links (card_id, platform, url, sort_order) VALUES (?, ?, ?, ?)'
        ).bind(cardId, link.platform, link.url, link.sort_order)
      )
      await c.env.DB.batch(stmts)
    }

    // 태그 저장
    if (body.tags?.length) {
      const stmts = body.tags.map(tag =>
        c.env.DB.prepare(
          'INSERT INTO card_tags (card_id, tag_type, tag_value) VALUES (?, ?, ?)'
        ).bind(cardId, tag.tag_type, tag.tag_value)
      )
      await c.env.DB.batch(stmts)
    }

    const card = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE id = ?'
    ).bind(cardId).first()

    return c.json(ok(card, '명함이 생성되었습니다.'), 201)
  }
)

// ── 명함 상세 조회 (공개 — 앱 미설치자 포함) ──────────
cards.get('/public/:id', async (c) => {
  const cardId = c.req.param('id')

  const card = await c.env.DB.prepare(`
    SELECT c.*, u.name as owner_name
    FROM cards c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ? AND c.is_public = 1 AND c.is_active = 1 AND c.is_deleted = 0
  `).bind(cardId).first()

  if (!card) {
    return c.json(fail('명함을 찾을 수 없거나 비공개 명함입니다.'), 404)
  }

  const [snsLinks, tags] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM card_sns_links WHERE card_id = ? ORDER BY sort_order').bind(cardId).all(),
    c.env.DB.prepare('SELECT * FROM card_tags WHERE card_id = ?').bind(cardId).all()
  ])

  return c.json(ok({ ...card, sns_links: snsLinks.results, tags: tags.results }))
})

// ── 명함 상세 조회 (인증 필요) ────────────────────────
cards.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const cardId = c.req.param('id')

  const card = await c.env.DB.prepare(`
    SELECT * FROM cards WHERE id = ? AND user_id = ? AND is_deleted = 0
  `).bind(cardId, userId).first()

  if (!card) {
    return c.json(fail('명함을 찾을 수 없습니다.'), 404)
  }

  const [snsLinks, tags] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM card_sns_links WHERE card_id = ? ORDER BY sort_order').bind(cardId).all(),
    c.env.DB.prepare('SELECT * FROM card_tags WHERE card_id = ?').bind(cardId).all()
  ])

  return c.json(ok({ ...card, sns_links: snsLinks.results, tags: tags.results }))
})

// ── 명함 수정 ─────────────────────────────────────────
cards.patch(
  '/:id',
  authMiddleware,
  zValidator('json', z.object({
    name: z.string().min(1).max(100).optional(),
    title: z.string().max(100).optional().nullable(),
    company: z.string().max(100).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    website: z.string().optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    template_id: z.string().optional(),
    is_public: z.number().int().min(0).max(1).optional(),
    is_primary: z.number().int().min(0).max(1).optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const cardId = c.req.param('id')
    const body = c.req.valid('json')

    const card = await c.env.DB.prepare(
      'SELECT id FROM cards WHERE id = ? AND user_id = ? AND is_deleted = 0'
    ).bind(cardId, userId).first()

    if (!card) {
      return c.json(fail('명함을 찾을 수 없습니다.'), 404)
    }

    // 동적 업데이트 빌더
    const fields: string[] = []
    const values: unknown[] = []
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    })

    if (fields.length === 0) {
      return c.json(fail('수정할 내용이 없습니다.'), 400)
    }

    fields.push('updated_at = datetime(\'now\')')
    values.push(cardId, userId)

    await c.env.DB.prepare(
      `UPDATE cards SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run()

    const updated = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE id = ?'
    ).bind(cardId).first()

    return c.json(ok(updated, '명함이 수정되었습니다.'))
  }
)

// ── 명함 삭제 ─────────────────────────────────────────
cards.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const cardId = c.req.param('id')

  const card = await c.env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ? AND is_deleted = 0'
  ).bind(cardId, userId).first()

  if (!card) {
    return c.json(fail('명함을 찾을 수 없습니다.'), 404)
  }

  await c.env.DB.prepare(
    `UPDATE cards SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).bind(cardId).run()

  return c.json(ok(null, '명함이 삭제되었습니다.'))
})

// ── QR 토큰 생성 ──────────────────────────────────────
cards.post('/:id/qr-token', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const cardId = c.req.param('id')
  const { purpose, event_id } = await c.req.json().catch(() => ({}))

  const card = await c.env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ? AND is_active = 1 AND is_deleted = 0'
  ).bind(cardId, userId).first()

  if (!card) {
    return c.json(fail('명함을 찾을 수 없습니다.'), 404)
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5분

  await c.env.DB.prepare(`
    INSERT INTO qr_tokens (user_id, card_id, token, purpose, event_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, cardId, token, purpose || 'card_share', event_id ?? null, expiresAt).run()

  return c.json(ok({ token, expires_at: expiresAt, qr_url: `/cards/qr/${token}` }))
})

// ── QR 토큰으로 명함 조회 (교환) ─────────────────────
cards.get('/qr/:token', async (c) => {
  const token = c.req.param('token')

  const qrRecord = await c.env.DB.prepare(`
    SELECT qt.*, c.* FROM qr_tokens qt
    JOIN cards c ON c.id = qt.card_id
    WHERE qt.token = ? AND qt.used_at IS NULL AND qt.expires_at > datetime('now')
  `).bind(token).first<{ user_id: number; card_id: number; purpose: string; event_id: number | null }>()

  if (!qrRecord) {
    return c.json(fail('유효하지 않거나 만료된 QR 코드입니다.'), 404)
  }

  // card_share 목적이면 사용 처리
  if (qrRecord.purpose === 'card_share') {
    await c.env.DB.prepare(
      `UPDATE qr_tokens SET used_at = datetime('now') WHERE token = ?`
    ).bind(token).run()
  }

  const snsLinks = await c.env.DB.prepare(
    'SELECT * FROM card_sns_links WHERE card_id = ? ORDER BY sort_order'
  ).bind(qrRecord.card_id).all()

  return c.json(ok({ ...qrRecord, sns_links: snsLinks.results }))
})

// ── 명함첩: 명함 저장 ────────────────────────────────
cards.post('/:id/save', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const cardId = parseInt(c.req.param('id'))
  const { memo } = await c.req.json().catch(() => ({}))

  // 자신의 명함은 저장 불가
  const card = await c.env.DB.prepare(
    'SELECT id, user_id FROM cards WHERE id = ? AND is_active = 1 AND is_deleted = 0'
  ).bind(cardId).first<{ id: number; user_id: number }>()

  if (!card) return c.json(fail('명함을 찾을 수 없습니다.'), 404)
  if (card.user_id === userId) return c.json(fail('자신의 명함은 저장할 수 없습니다.'), 400)

  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO card_contacts (owner_id, card_id, memo)
    VALUES (?, ?, ?)
  `).bind(userId, cardId, memo ?? null).run()

  return c.json(ok(null, '명함첩에 저장되었습니다.'), 201)
})

// ── 명함첩 목록 ───────────────────────────────────────
cards.get('/contacts/list', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const search = c.req.query('q')
  const favorite = c.req.query('favorite')

  let query = `
    SELECT cc.*, c.name, c.title, c.company, c.email, c.phone, c.avatar_url
    FROM card_contacts cc
    JOIN cards c ON c.id = cc.card_id
    WHERE cc.owner_id = ? AND c.is_deleted = 0
  `
  const params: unknown[] = [userId]

  if (search) {
    query += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.title LIKE ?)`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (favorite === '1') {
    query += ` AND cc.is_favorite = 1`
  }

  query += ` ORDER BY cc.is_favorite DESC, cc.received_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM card_contacts WHERE owner_id = ?'
    ).bind(userId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

export default cards
