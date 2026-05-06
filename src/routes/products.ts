import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const products = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const ADMIN_ROLES = ['admin', 'sub_admin']

async function getMemberRole(db: D1Database, groupId: number, userId: number) {
  return db.prepare(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`
  ).bind(groupId, userId).first<{ role: string }>()
}

// ══════════════════════════════════════════════════════════════
// GET /api/v1/groups/:groupId/products
// 그룹 상품 목록
// ══════════════════════════════════════════════════════════════
products.get('/groups/:groupId/products', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const groupId = parseInt(c.req.param('groupId'))

  const member = await getMemberRole(c.env.DB, groupId, userId)
  if (!member) return c.json(fail('접근 권한이 없습니다.'), 403)

  const rows = await c.env.DB.prepare(`
    SELECT p.*
    FROM products p
    WHERE p.group_id = ? AND p.is_active = 1
    ORDER BY p.type, p.created_at DESC
  `).bind(groupId).all()

  return c.json(ok(rows.results))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/groups/:groupId/products
// 상품 등록 (admin / sub_admin)
// ══════════════════════════════════════════════════════════════
products.post(
  '/groups/:groupId/products',
  authMiddleware,
  zValidator('json', z.object({
    type        : z.enum(['lesson', 'event', 'etc']),
    target_id   : z.number().int().positive(),
    title       : z.string().min(1).max(200),
    description : z.string().max(1000).optional(),
    price       : z.number().int().min(0),           // 원(KRW)
    stock       : z.number().int().positive().optional(),
    expires_days: z.number().int().positive().optional(),
  })),
  async (c) => {
    const userId  = c.get('userId')
    const groupId = parseInt(c.req.param('groupId'))
    const body    = c.req.valid('json')

    const member = await getMemberRole(c.env.DB, groupId, userId)
    if (!member || !ADMIN_ROLES.includes(member.role)) {
      return c.json(fail('그룹 관리자만 상품을 등록할 수 있습니다.'), 403)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO products (group_id, type, target_id, title, description, price, stock, expires_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId, body.type, body.target_id, body.title,
      body.description ?? null, body.price,
      body.stock ?? null, body.expires_days ?? null
    ).run()

    return c.json(ok({ product_id: result.meta.last_row_id }, '상품이 등록되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// PUT /api/v1/products/:id
// 상품 수정
// ══════════════════════════════════════════════════════════════
products.put(
  '/:id',
  authMiddleware,
  zValidator('json', z.object({
    title       : z.string().min(1).max(200).optional(),
    description : z.string().max(1000).optional(),
    price       : z.number().int().min(0).optional(),
    stock       : z.number().int().positive().nullable().optional(),
    is_active   : z.number().int().min(0).max(1).optional(),
  })),
  async (c) => {
    const userId    = c.get('userId')
    const productId = parseInt(c.req.param('id'))
    const body      = c.req.valid('json')

    const product = await c.env.DB.prepare(
      `SELECT id, group_id FROM products WHERE id = ?`
    ).bind(productId).first<{ id: number; group_id: number }>()
    if (!product) return c.json(fail('상품을 찾을 수 없습니다.'), 404)

    const member = await getMemberRole(c.env.DB, product.group_id, userId)
    if (!member || !ADMIN_ROLES.includes(member.role)) {
      return c.json(fail('수정 권한이 없습니다.'), 403)
    }

    const fields: string[] = []
    const vals: unknown[]  = []

    if (body.title !== undefined)       { fields.push('title = ?');       vals.push(body.title) }
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description) }
    if (body.price !== undefined)       { fields.push('price = ?');       vals.push(body.price) }
    if (body.stock !== undefined)       { fields.push('stock = ?');       vals.push(body.stock) }
    if (body.is_active !== undefined)   { fields.push('is_active = ?');   vals.push(body.is_active) }

    if (fields.length === 0) return c.json(fail('수정할 내용이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...vals, productId).run()

    return c.json(ok(null, '상품이 수정되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// POST /api/v1/orders
// 주문 생성 + 상품 아이템 추가
// ══════════════════════════════════════════════════════════════
products.post(
  '/orders',
  authMiddleware,
  zValidator('json', z.object({
    items: z.array(z.object({
      product_id: z.number().int().positive(),
      quantity  : z.number().int().positive().default(1),
    })).min(1)
  })),
  async (c) => {
    const userId = c.get('userId')
    const { items } = c.req.valid('json')

    // 상품 정보 일괄 조회 (가격 스냅샷)
    const productIds = items.map(i => i.product_id)
    const placeholders = productIds.map(() => '?').join(',')
    const productRows = await c.env.DB.prepare(
      `SELECT id, price, stock, is_active FROM products WHERE id IN (${placeholders})`
    ).bind(...productIds).all<{ id: number; price: number; stock: number | null; is_active: number }>()

    const productMap = new Map(productRows.results.map(p => [p.id, p]))

    // 유효성 검증
    let totalAmount = 0
    for (const item of items) {
      const product = productMap.get(item.product_id)
      if (!product)         return c.json(fail(`상품 ID ${item.product_id}를 찾을 수 없습니다.`), 404)
      if (!product.is_active) return c.json(fail(`비활성화된 상품입니다: ${item.product_id}`), 400)
      if (product.stock !== null && product.stock < item.quantity) {
        return c.json(fail(`재고가 부족합니다: ${item.product_id}`), 409)
      }
      totalAmount += product.price * item.quantity
    }

    // 주문 생성
    const orderResult = await c.env.DB.prepare(`
      INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'pending')
    `).bind(userId, totalAmount).run()

    const orderId = orderResult.meta.last_row_id as number

    // 주문 아이템 일괄 삽입
    const stmts = items.map(item => {
      const product = productMap.get(item.product_id)!
      return c.env.DB.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `).bind(orderId, item.product_id, item.quantity, product.price)
    })
    await c.env.DB.batch(stmts)

    return c.json(ok({
      order_id    : orderId,
      total_amount: totalAmount,
      item_count  : items.length
    }, '주문이 생성되었습니다.'), 201)
  }
)

// ══════════════════════════════════════════════════════════════
// GET /api/v1/orders/:id
// 주문 상세 조회 (본인 주문만)
// ══════════════════════════════════════════════════════════════
products.get('/orders/:id', authMiddleware, async (c) => {
  const userId  = c.get('userId')
  const orderId = parseInt(c.req.param('id'))

  const order = await c.env.DB.prepare(
    `SELECT * FROM orders WHERE id = ? AND user_id = ?`
  ).bind(orderId, userId).first()
  if (!order) return c.json(fail('주문을 찾을 수 없습니다.'), 404)

  const [items, payment] = await Promise.all([
    c.env.DB.prepare(`
      SELECT oi.*, p.title, p.type, p.target_id
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `).bind(orderId).all(),
    c.env.DB.prepare(
      `SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(orderId).first()
  ])

  return c.json(ok({ ...order, items: items.results, payment }))
})

// ══════════════════════════════════════════════════════════════
// GET /api/v1/orders
// 내 주문 목록
// ══════════════════════════════════════════════════════════════
products.get('/orders', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`
    ).bind(userId).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ══════════════════════════════════════════════════════════════
// POST /api/v1/payments/verify-web
// 웹 결제 검증 및 주문 확정
// PG사 결제 검증 완료 후 호출
// ══════════════════════════════════════════════════════════════
products.post(
  '/payments/verify-web',
  authMiddleware,
  zValidator('json', z.object({
    order_id         : z.number().int().positive(),
    pg               : z.enum(['toss', 'portone']),
    pg_transaction_id: z.string().min(1),
    amount           : z.number().int().positive(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    // 주문 확인 (본인 + pending 상태)
    const order = await c.env.DB.prepare(
      `SELECT id, total_amount, status FROM orders WHERE id = ? AND user_id = ?`
    ).bind(body.order_id, userId).first<{ id: number; total_amount: number; status: string }>()

    if (!order)                    return c.json(fail('주문을 찾을 수 없습니다.'), 404)
    if (order.status !== 'pending') return c.json(fail('이미 처리된 주문입니다.'), 409)

    // 금액 검증
    if (order.total_amount !== body.amount) {
      return c.json(fail('결제 금액이 주문 금액과 다릅니다.', {
        order_amount  : order.total_amount,
        payment_amount: body.amount
      }), 400)
    }

    // TODO: PG사 서버사이드 검증 (토스페이먼츠/포트원 API 호출) - PG 확정 후 구현
    // 현재: 금액 일치 확인만 수행

    // 결제 레코드 생성 + 주문 상태 변경
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO payments (order_id, method, pg, pg_transaction_id, amount, status, paid_at)
        VALUES (?, 'web', ?, ?, ?, 'paid', datetime('now'))
      `).bind(body.order_id, body.pg, body.pg_transaction_id, body.amount),
      c.env.DB.prepare(
        `UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?`
      ).bind(body.order_id)
    ])

    return c.json(ok({
      order_id: body.order_id,
      paid    : true,
      amount  : body.amount
    }, '결제가 완료되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// POST /api/v1/payments/subscription/verify-apple
// Apple IAP 구독 영수증 검증
// ══════════════════════════════════════════════════════════════
products.post(
  '/payments/subscription/verify-apple',
  authMiddleware,
  zValidator('json', z.object({
    receipt_data    : z.string().min(1),
    product_id      : z.string().min(1),   // e.g. com.meti.pro_monthly
    transaction_id  : z.string().min(1),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    // 플랜 매핑
    const planMap: Record<string, string> = {
      'com.meti.pro_monthly'     : 'pro',
      'com.meti.business_monthly': 'business',
    }
    const newPlan = planMap[body.product_id]
    if (!newPlan) return c.json(fail('알 수 없는 상품 ID입니다.'), 400)

    // TODO: Apple 서버사이드 영수증 검증 API 호출
    // POST https://buy.itunes.apple.com/verifyReceipt
    // 현재: 영수증 수신 후 플랜 즉시 반영 (검증 로직 추가 예정)

    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(newPlan, expiresAt.toISOString(), userId),
      c.env.DB.prepare(`
        INSERT INTO payments (order_id, method, pg, pg_transaction_id, amount, status, paid_at)
        SELECT id, 'inapp_apple', 'apple', ?, 0, 'paid', datetime('now')
        FROM orders WHERE user_id = ? AND status = 'pending' LIMIT 1
      `).bind(body.transaction_id, userId)
    ])

    return c.json(ok({ plan: newPlan, expires_at: expiresAt.toISOString() }, '구독이 활성화되었습니다.'))
  }
)

// ══════════════════════════════════════════════════════════════
// POST /api/v1/payments/subscription/verify-google
// Google Play Billing 구독 영수증 검증
// ══════════════════════════════════════════════════════════════
products.post(
  '/payments/subscription/verify-google',
  authMiddleware,
  zValidator('json', z.object({
    purchase_token: z.string().min(1),
    product_id    : z.string().min(1),   // e.g. com.meti.pro_monthly
    package_name  : z.string().default('com.meti.app'),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body   = c.req.valid('json')

    const planMap: Record<string, string> = {
      'com.meti.pro_monthly'     : 'pro',
      'com.meti.business_monthly': 'business',
    }
    const newPlan = planMap[body.product_id]
    if (!newPlan) return c.json(fail('알 수 없는 상품 ID입니다.'), 400)

    // TODO: Google Play Developer API 검증
    // GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}
    // 현재: 플랜 즉시 반영 (검증 로직 추가 예정)

    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await c.env.DB.prepare(
      `UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newPlan, expiresAt.toISOString(), userId).run()

    return c.json(ok({ plan: newPlan, expires_at: expiresAt.toISOString() }, '구독이 활성화되었습니다.'))
  }
)

export default products
