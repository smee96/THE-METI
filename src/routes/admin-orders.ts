import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

// 마운트 위치: /admin/orders
const ordersAdmin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── GET /admin/orders — 전체 주문 목록 ───────────────────────
ordersAdmin.get('/', async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const status  = c.req.query('status')   // pending | paid | cancelled | refunded
  const search  = c.req.query('q')        // 유저명 또는 이메일
  const method  = c.req.query('method')   // inapp_apple | inapp_google | web

  let query = `
    SELECT o.id, o.total_amount, o.status, o.created_at, o.updated_at,
           u.id as user_id, u.name as user_name, u.email as user_email, u.plan as user_plan,
           p.method as payment_method, p.pg, p.status as payment_status, p.paid_at
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE 1=1`
  const params: unknown[] = []

  if (status) { query += ` AND o.status = ?`;              params.push(status) }
  if (method) { query += ` AND p.method = ?`;              params.push(method) }
  if (search) {
    query += ` AND (u.name LIKE ? OR u.email LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  let countQuery = `
    SELECT COUNT(*) as total FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE 1=1`
  const countParams: unknown[] = []
  if (status) { countQuery += ` AND o.status = ?`;         countParams.push(status) }
  if (method) { countQuery += ` AND p.method = ?`;         countParams.push(method) }
  if (search) {
    countQuery += ` AND (u.name LIKE ? OR u.email LIKE ?)`
    countParams.push(`%${search}%`, `%${search}%`)
  }

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>()
  ])

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── GET /admin/orders/stats — 결제 통계 ─────────────────────
ordersAdmin.get('/stats', async (c) => {
  const [monthly, byMethod, byStatus] = await Promise.all([
    // 최근 6개월 월별 매출
    c.env.DB.prepare(`
      SELECT strftime('%Y-%m', o.created_at) as month,
             COUNT(*) as order_count,
             SUM(CASE WHEN o.status = 'paid' THEN o.total_amount ELSE 0 END) as revenue
      FROM orders o
      WHERE o.created_at >= DATE('now', '-6 months')
      GROUP BY month ORDER BY month ASC
    `).all(),
    // 결제 수단별
    c.env.DB.prepare(`
      SELECT p.method, COUNT(*) as count,
             SUM(CASE WHEN o.status = 'paid' THEN o.total_amount ELSE 0 END) as revenue
      FROM payments p JOIN orders o ON o.id = p.order_id
      GROUP BY p.method
    `).all(),
    // 상태별
    c.env.DB.prepare(`
      SELECT status, COUNT(*) as count,
             SUM(total_amount) as amount
      FROM orders GROUP BY status
    `).all()
  ])

  return c.json(ok({
    monthly:   monthly.results,
    by_method: byMethod.results,
    by_status: byStatus.results
  }))
})

// ── GET /admin/orders/:id — 주문 상세 ───────────────────────
ordersAdmin.get('/:id', async (c) => {
  const orderId = parseInt(c.req.param('id'))

  const [order, items, payment] = await Promise.all([
    c.env.DB.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email, u.plan as user_plan
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `).bind(orderId).first(),
    c.env.DB.prepare(`
      SELECT oi.*, pr.name as product_name, pr.description as product_desc
      FROM order_items oi
      LEFT JOIN products pr ON pr.id = oi.product_id
      WHERE oi.order_id = ?
    `).bind(orderId).all(),
    c.env.DB.prepare(`SELECT * FROM payments WHERE order_id = ? LIMIT 1`).bind(orderId).first()
  ])

  if (!order) return c.json(fail('주문을 찾을 수 없습니다.'), 404)

  return c.json(ok({ order, items: items.results, payment }))
})

// ── PATCH /admin/orders/:id — 주문 상태 변경 ────────────────
ordersAdmin.patch(
  '/:id',
  zValidator('json', z.object({
    status: z.enum(['pending', 'paid', 'cancelled', 'refunded'])
  })),
  async (c) => {
    const orderId = parseInt(c.req.param('id'))
    const { status } = c.req.valid('json')

    const order = await c.env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first<{ id: number; status: string }>()
    if (!order) return c.json(fail('주문을 찾을 수 없습니다.'), 404)

    await c.env.DB.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(status, orderId).run()

    return c.json(ok(null, `주문 상태가 '${status}'로 변경되었습니다.`))
  }
)

export default ordersAdmin
