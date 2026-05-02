import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables, JWTPayload } from '../types'

// JWT base64url 디코딩 유틸
function base64urlDecode(str: string): string {
  const pad = str.length % 4
  const padded = pad ? str + '='.repeat(4 - pad) : str
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64)
}

// HMAC-SHA256 서명 검증 (Web Crypto API)
async function verifyHS256(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts
    const data = `${headerB64}.${payloadB64}`

    // secret → CryptoKey
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // signature 검증
    const sigPad = signatureB64.length % 4
    const sigPadded = sigPad ? signatureB64 + '='.repeat(4 - sigPad) : signatureB64
    const sigBase64 = sigPadded.replace(/-/g, '+').replace(/_/g, '/')
    const sigBytes = Uint8Array.from(atob(sigBase64), c => c.charCodeAt(0))

    const valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      sigBytes,
      encoder.encode(data)
    )
    if (!valid) return null

    // payload 파싱
    const payload = JSON.parse(base64urlDecode(payloadB64)) as JWTPayload

    // 만료 확인
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

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
  const secret = c.env.JWT_SECRET

  if (!secret) {
    return c.json({ success: false, error: 'JWT_SECRET 환경변수가 설정되지 않았습니다.' }, 500)
  }

  const payload = await verifyHS256(token, secret)
  if (!payload) {
    return c.json({ success: false, error: '유효하지 않은 토큰입니다.' }, 401)
  }

  c.set('userId', parseInt(payload.sub))
  c.set('userEmail', payload.email)
  c.set('userPlan', payload.plan)
  c.set('accountType', payload.account_type)
  await next()
})

// 슈퍼관리자 전용 미들웨어
export const superAdminMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const userId = c.get('userId')

  const result = await c.env.DB.prepare(
    `SELECT id, role FROM users WHERE id = ? AND is_active = 1`
  ).bind(userId).first() as { id: number; role: string } | null

  if (!result) {
    return c.json({ success: false, error: '권한이 없습니다.' }, 403)
  }

  // role = 'super_admin' 이거나 id = 1 (초기 관리자)
  if (result.role !== 'super_admin' && result.id !== 1) {
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

// ── 미성년자(MINOR) 접근 제어 미들웨어 ───────────────────
// MINOR 계정은 그룹/레슨 관련 API 외에 모든 기능 차단
// 허용 경로 패턴: /api/v1/groups/*, /api/v1/lessons/*, /api/v1/auth/*
export const minorAccessMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const userId = c.get('userId')
  if (!userId) return await next()

  // DB에서 user_type 확인
  const user = await c.env.DB.prepare(
    `SELECT user_type FROM users WHERE id = ? AND is_deleted = 0`
  ).bind(userId).first<{ user_type: string }>()

  if (!user || user.user_type !== 'MINOR') {
    // 성인이면 그냥 통과
    return await next()
  }

  // MINOR인 경우 허용 경로 체크
  const path = new URL(c.req.url).pathname

  // 허용 경로:
  // - /api/v1/auth/* (로그인, 토큰 갱신, 내 정보)
  // - /api/v1/groups/:id (그룹 상세 조회)
  // - /api/v1/groups/:id/notices (공지 조회)
  // - /api/v1/groups/:id/leave (그룹 탈퇴)
  // - /api/v1/lessons/* (레슨 일정/출석 조회)
  const allowedPatterns = [
    /^\/api\/v1\/auth\//,
    /^\/api\/v1\/groups\/\d+$/,
    /^\/api\/v1\/groups\/\d+\/notices/,
    /^\/api\/v1\/groups\/\d+\/leave/,
    /^\/api\/v1\/lessons\//,
  ]

  const isAllowed = allowedPatterns.some(pattern => pattern.test(path))

  if (!isAllowed) {
    return c.json({
      success: false,
      error: '미성년자 계정은 그룹 및 레슨 기능만 이용할 수 있습니다.',
      minor_restricted: true
    }, 403)
  }

  return await next()
})
