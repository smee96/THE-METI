import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { Bindings, Variables, JWTPayload } from '../types'

// JWT 인증 미들웨어
export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verify(token, c.env.JWT_SECRET) as JWTPayload
    c.set('userId', parseInt(payload.sub))
    c.set('userEmail', payload.email)
    c.set('userPlan', payload.plan)
    c.set('accountType', payload.account_type)
    await next()
  } catch {
    return c.json({ success: false, error: '유효하지 않은 토큰입니다.' }, 401)
  }
})

// 슈퍼관리자 전용 미들웨어
export const superAdminMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const userId = c.get('userId')

  // super_admins 테이블 또는 users 테이블에서 슈퍼관리자 여부 확인
  // 현재는 users 테이블에 role 컬럼 추가 전이므로 ID=1 (seed 기준) 임시 처리
  const result = await c.env.DB.prepare(
    `SELECT id FROM users WHERE id = ? AND is_active = 1`
  ).bind(userId).first()

  if (!result) {
    return c.json({ success: false, error: '권한이 없습니다.' }, 403)
  }

  // TODO: 슈퍼관리자 역할 테이블 구현 후 체크 로직 변경 필요
  // 현재는 plan = 'business' + 첫 번째 유저를 슈퍼관리자로 처리
  const user = result as { id: number }
  if (user.id !== 1) {
    return c.json({ success: false, error: '슈퍼관리자 권한이 필요합니다.' }, 403)
  }

  await next()
})

// 플랜 게이팅 미들웨어 팩토리
export const requirePlan = (minPlan: 'free' | 'pro' | 'business') => {
  const planOrder = { free: 0, pro: 1, business: 2 }
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
    async (c, next) => {
      const userPlan = c.get('userPlan') as keyof typeof planOrder
      if (planOrder[userPlan] < planOrder[minPlan]) {
        return c.json({
          success: false,
          error: `이 기능은 ${minPlan.toUpperCase()} 플랜 이상에서 사용 가능합니다.`,
          upgrade_required: true,
          required_plan: minPlan
        }, 403)
      }
      await next()
    }
  )
}
