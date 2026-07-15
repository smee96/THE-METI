import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'
import { debitWallet } from '../lib/wallet'

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
      INSERT INTO cards (user_id, group_id, card_type, name, title, company, email, phone, website, bio, template_id, is_public, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, body.group_id ?? null, body.card_type, body.name,
      body.title ?? null, body.company ?? null, body.email ?? null,
      body.phone ?? null, body.website ?? null, body.bio ?? null,
      body.template_id, body.is_public, null   // avatar_url은 생성 후 별도 업로드
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
    avatar_url: z.string().url().optional().nullable(),
    template_id: z.string().optional(),
    is_public: z.number().int().min(0).max(1).optional(),
    is_primary: z.number().int().min(0).max(1).optional(),
    // 이력/태그/SNS — 전체 교체 방식 (null이면 무시, 빈 배열이면 전체 삭제)
    sns_links: z.array(z.object({
      platform: z.string().max(50),
      url: z.string().url(),
      sort_order: z.number().default(0)
    })).optional().nullable(),
    tags: z.array(z.object({
      tag_type: z.string().max(50),   // skill | career | education | etc
      tag_value: z.string().max(200)
    })).optional().nullable(),
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

    // ── 기본 필드 업데이트 ──────────────────────────────
    const coreFields = ['name','title','company','email','phone','website','bio','avatar_url','template_id','is_public','is_primary']
    const fields: string[] = []
    const values: unknown[] = []
    Object.entries(body).forEach(([key, value]) => {
      if (coreFields.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    })

    if (fields.length > 0) {
      fields.push('updated_at = datetime(\'now\')')
      values.push(cardId, userId)
      await c.env.DB.prepare(
        `UPDATE cards SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...values).run()
    }

    // ── SNS 링크 전체 교체 ──────────────────────────────
    if (body.sns_links !== undefined && body.sns_links !== null) {
      await c.env.DB.prepare('DELETE FROM card_sns_links WHERE card_id = ?').bind(cardId).run()
      if (body.sns_links.length > 0) {
        const stmts = body.sns_links.map((link, i) =>
          c.env.DB.prepare(
            'INSERT INTO card_sns_links (card_id, platform, url, sort_order) VALUES (?, ?, ?, ?)'
          ).bind(cardId, link.platform, link.url, i)
        )
        await c.env.DB.batch(stmts)
      }
    }

    // ── 태그 전체 교체 ──────────────────────────────────
    if (body.tags !== undefined && body.tags !== null) {
      await c.env.DB.prepare('DELETE FROM card_tags WHERE card_id = ?').bind(cardId).run()
      if (body.tags.length > 0) {
        const stmts = body.tags.map(tag =>
          c.env.DB.prepare(
            'INSERT INTO card_tags (card_id, tag_type, tag_value) VALUES (?, ?, ?)'
          ).bind(cardId, tag.tag_type, tag.tag_value)
        )
        await c.env.DB.batch(stmts)
      }
    }

    const [updated, snsLinks, tags] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first(),
      c.env.DB.prepare('SELECT * FROM card_sns_links WHERE card_id = ? ORDER BY sort_order').bind(cardId).all(),
      c.env.DB.prepare('SELECT * FROM card_tags WHERE card_id = ?').bind(cardId).all(),
    ])

    return c.json(ok({ ...updated, sns_links: snsLinks.results, tags: tags.results }, '명함이 수정되었습니다.'))
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

// ── 명함 사진 업로드 ──────────────────────────────────
cards.post('/:id/avatar', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const cardId = c.req.param('id')

  // 명함 소유권 확인
  const card = await c.env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ? AND is_deleted = 0'
  ).bind(cardId, userId).first()
  if (!card) return c.json(fail('명함을 찾을 수 없습니다.'), 404)

  // multipart 파싱
  let formData: FormData
  try { formData = await c.req.formData() }
  catch { return c.json(fail('이미지 파일을 업로드해주세요.'), 400) }

  const file = formData.get('avatar') as File | null
  if (!file || typeof file === 'string') {
    return c.json(fail('avatar 필드에 이미지 파일을 첨부해주세요.'), 400)
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json(fail('JPG, PNG, WEBP, GIF 형식만 업로드 가능합니다.'), 400)
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json(fail('파일 크기는 5MB 이하여야 합니다.'), 400)
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const key = `cards/${userId}_${cardId}_${Date.now()}.${ext}`

  await c.env.STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  })

  const avatarUrl = `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/${key}`

  await c.env.DB.prepare(
    `UPDATE cards SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(avatarUrl, cardId).run()

  return c.json(ok({ avatar_url: avatarUrl }, '명함 사진이 변경되었습니다.'))
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

// ══════════════════════════════════════════════════════════
// NFC 실물카드 신청 (포인트 차감)
//
// 실물 상품이므로 IAP 비대상 — 포인트로 결제하고 어드민이
// pending → approved → issued(배송) 플로우로 처리 (admin-nfc.ts)
// ══════════════════════════════════════════════════════════

const NFC_ACTIVE_STATUSES = ['pending', 'approved', 'issued']

// ── GET /api/v1/cards/nfc/config — 신청 가격 ───────────────
cards.get('/nfc/config', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT config_val FROM plan_configs WHERE config_key = 'nfc_card_price_basic'`
  ).first<{ config_val: string }>()
  return c.json(ok({ price: parseInt(row?.config_val ?? '10000', 10), design_type: 'basic' }))
})

// ── GET /api/v1/cards/nfc/applications — 내 신청 목록 ──────
cards.get('/nfc/applications', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const rows = await c.env.DB.prepare(`
    SELECT n.id, n.card_id, n.design_type, n.status, n.amount, n.payment_status,
           n.tracking_no, n.carrier, n.applied_at, n.issued_at, n.shipped_at,
           c.name AS card_name
    FROM nfc_physical_cards n
    LEFT JOIN cards c ON c.id = n.card_id
    WHERE n.user_id = ?
    ORDER BY n.applied_at DESC
  `).bind(userId).all()
  return c.json(ok(rows.results))
})

// ── POST /api/v1/cards/nfc/apply — 실물카드 신청 + 포인트 차감 ──
cards.post(
  '/nfc/apply',
  authMiddleware,
  zValidator('json', z.object({
    card_id:          z.number().int().positive(),
    design_type:      z.enum(['basic']).default('basic'),
    shipping_name:    z.string().min(1).max(50),
    shipping_phone:   z.string().min(1).max(20),
    shipping_zipcode: z.string().min(1).max(10),
    shipping_address: z.string().min(1).max(200),
    shipping_detail:  z.string().max(200).optional(),
    shipping_memo:    z.string().max(200).optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    // 명함 소유 확인
    const card = await c.env.DB.prepare(
      `SELECT id FROM cards WHERE id = ? AND user_id = ? AND is_deleted = 0`
    ).bind(body.card_id, userId).first()
    if (!card) return c.json(fail('명함을 찾을 수 없습니다.'), 404)

    // 같은 명함의 진행 중 신청 중복 방지
    const dup = await c.env.DB.prepare(`
      SELECT id, status FROM nfc_physical_cards
      WHERE card_id = ? AND user_id = ? AND status IN (${NFC_ACTIVE_STATUSES.map(() => '?').join(',')})
    `).bind(body.card_id, userId, ...NFC_ACTIVE_STATUSES).first<{ id: number; status: string }>()
    if (dup) return c.json(fail('이미 진행 중인 실물카드 신청이 있습니다.', { status: dup.status }), 409)

    // 가격 조회 (어드민 설정, 기본 10,000P)
    const priceRow = await c.env.DB.prepare(
      `SELECT config_val FROM plan_configs WHERE config_key = 'nfc_card_price_basic'`
    ).first<{ config_val: string }>()
    const price = parseInt(priceRow?.config_val ?? '10000', 10)

    // 신청 생성 → 포인트 차감 (실패 시 신청 롤백 — lessons 패턴)
    const insert = await c.env.DB.prepare(`
      INSERT INTO nfc_physical_cards
        (user_id, card_id, order_type, design_type, status,
         shipping_name, shipping_phone, shipping_zipcode, shipping_address,
         shipping_detail, shipping_memo, amount, payment_status)
      VALUES (?, ?, 'individual', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, body.card_id, body.design_type,
      body.shipping_name, body.shipping_phone, body.shipping_zipcode, body.shipping_address,
      body.shipping_detail ?? null, body.shipping_memo ?? null,
      price, price > 0 ? 'paid' : 'unpaid'
    ).run()
    const applicationId = insert.meta.last_row_id as number

    if (price > 0) {
      const debit = await debitWallet(c.env.DB, 'user', userId, price, {
        type:        'use_nfc_card',
        refType:     'nfc_card',
        refId:       applicationId,
        description: `NFC 실물카드 신청 (${body.design_type})`,
      })
      if (!debit.ok) {
        await c.env.DB.prepare(`DELETE FROM nfc_physical_cards WHERE id = ?`).bind(applicationId).run()
        return c.json(fail('포인트가 부족합니다.', {
          error_code: 'insufficient_points',
          required:   price,
          balance:    debit.balance,
          shortage:   price - debit.balance,
        }), 400)
      }
      return c.json(ok({
        application_id: applicationId,
        amount:         price,
        balance_after:  debit.balanceAfter,
      }, '실물카드 신청이 완료되었습니다.'), 201)
    }

    return c.json(ok({ application_id: applicationId, amount: 0 }, '실물카드 신청이 완료되었습니다.'), 201)
  }
)

export default cards
