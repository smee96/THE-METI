import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail } from '../middleware/response'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 유틸리티 ──────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

async function generateTokens(
  userId: number,
  email: string,
  plan: string,
  account_type: string,
  jwtSecret: string
) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign(
    {
      sub: String(userId),
      email,
      plan,
      account_type,
      iat: now,
      exp: now + 7 * 24 * 60 * 60  // 7일
    },
    jwtSecret
  )
  const refreshToken = crypto.randomUUID()
  return { accessToken, refreshToken }
}

// ── POST /api/v1/auth/register ────────────────────────
auth.post(
  '/register',
  zValidator('json', z.object({
    email: z.string().email('유효한 이메일을 입력해주세요.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(50),
    account_type: z.enum(['personal', 'headhunter']).default('personal')
  })),
  async (c) => {
    const { email, password, name, account_type } = c.req.valid('json')

    // 이메일 중복 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0'
    ).bind(email).first()

    if (existing) {
      return c.json(fail('이미 사용 중인 이메일입니다.'), 409)
    }

    const passwordHash = await hashPassword(password)

    // 유저 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, name, account_type, plan, is_verified)
      VALUES (?, ?, ?, ?, 'free', 0)
    `).bind(email, passwordHash, name, account_type).run()

    const userId = result.meta.last_row_id as number

    // 이메일 인증 토큰 생성
    const verifyToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(userId, verifyToken, expiresAt).run()

    // 리워드 잔액 초기화
    await c.env.DB.prepare(
      'INSERT INTO reward_balances (user_id, points) VALUES (?, 0)'
    ).bind(userId).run()

    // TODO: 이메일 발송 (추후 이메일 서비스 연동)
    // 현재는 토큰을 응답에 포함 (개발용)

    return c.json(ok({
      user_id: userId,
      email,
      verify_token: verifyToken  // TODO: 운영에서 제거, 이메일로 발송
    }, '회원가입이 완료되었습니다. 이메일 인증을 진행해주세요.'), 201)
  }
)

// ── POST /api/v1/auth/verify-email ────────────────────
auth.post(
  '/verify-email',
  zValidator('json', z.object({
    token: z.string()
  })),
  async (c) => {
    const { token } = c.req.valid('json')

    const record = await c.env.DB.prepare(`
      SELECT ev.*, u.email FROM email_verifications ev
      JOIN users u ON u.id = ev.user_id
      WHERE ev.token = ? AND ev.used_at IS NULL AND ev.expires_at > datetime('now')
    `).bind(token).first<{ user_id: number; email: string }>()

    if (!record) {
      return c.json(fail('유효하지 않거나 만료된 인증 토큰입니다.'), 400)
    }

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').bind(record.user_id),
      c.env.DB.prepare('UPDATE email_verifications SET used_at = datetime(\'now\') WHERE token = ?').bind(token)
    ])

    return c.json(ok(null, '이메일 인증이 완료되었습니다.'))
  }
)

// ── POST /api/v1/auth/login ───────────────────────────
auth.post(
  '/login',
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string()
  })),
  async (c) => {
    const { email, password } = c.req.valid('json')

    const user = await c.env.DB.prepare(`
      SELECT id, email, password_hash, name, account_type, plan, is_verified, is_active
      FROM users WHERE email = ? AND is_deleted = 0
    `).bind(email).first<{
      id: number; email: string; password_hash: string; name: string;
      account_type: string; plan: string; is_verified: number; is_active: number
    }>()

    if (!user) {
      return c.json(fail('이메일 또는 비밀번호가 올바르지 않습니다.'), 401)
    }

    if (!user.is_active) {
      return c.json(fail('비활성화된 계정입니다. 고객센터에 문의해주세요.'), 403)
    }

    const isValid = await comparePassword(password, user.password_hash)
    if (!isValid) {
      return c.json(fail('이메일 또는 비밀번호가 올바르지 않습니다.'), 401)
    }

    if (!user.is_verified) {
      return c.json(fail('이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해주세요.'), 403)
    }

    const { accessToken, refreshToken } = await generateTokens(
      user.id, user.email, user.plan, user.account_type, c.env.JWT_SECRET
    )

    // Refresh Token 저장
    const rtExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(`
      INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)
    `).bind(user.id, refreshToken, rtExpiresAt).run()

    return c.json(ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        account_type: user.account_type,
        plan: user.plan
      }
    }, '로그인 성공'))
  }
)

// ── POST /api/v1/auth/refresh ─────────────────────────
auth.post(
  '/refresh',
  zValidator('json', z.object({
    refresh_token: z.string()
  })),
  async (c) => {
    const { refresh_token } = c.req.valid('json')

    const record = await c.env.DB.prepare(`
      SELECT rt.*, u.email, u.plan, u.account_type, u.is_active
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token = ? AND rt.revoked_at IS NULL AND rt.expires_at > datetime('now')
    `).bind(refresh_token).first<{
      user_id: number; email: string; plan: string; account_type: string; is_active: number
    }>()

    if (!record || !record.is_active) {
      return c.json(fail('유효하지 않은 Refresh Token입니다.'), 401)
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      record.user_id, record.email, record.plan, record.account_type, c.env.JWT_SECRET
    )

    // 기존 토큰 폐기 + 새 토큰 저장
    const rtExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE refresh_tokens SET revoked_at = datetime(\'now\') WHERE token = ?').bind(refresh_token),
      c.env.DB.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').bind(record.user_id, newRefreshToken, rtExpiresAt)
    ])

    return c.json(ok({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer'
    }))
  }
)

// ── POST /api/v1/auth/logout ──────────────────────────
auth.post('/logout', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const refreshToken = body?.refresh_token

  if (refreshToken) {
    await c.env.DB.prepare(
      'UPDATE refresh_tokens SET revoked_at = datetime(\'now\') WHERE token = ? AND user_id = ?'
    ).bind(refreshToken, c.get('userId')).run()
  }

  return c.json(ok(null, '로그아웃되었습니다.'))
})

// ── POST /api/v1/auth/forgot-password ─────────────────
auth.post(
  '/forgot-password',
  zValidator('json', z.object({
    email: z.string().email()
  })),
  async (c) => {
    const { email } = c.req.valid('json')

    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0'
    ).bind(email).first<{ id: number }>()

    // 보안상 유저 존재 여부 노출 안 함
    if (!user) {
      return c.json(ok(null, '비밀번호 재설정 이메일이 발송되었습니다.'))
    }

    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1시간

    await c.env.DB.prepare(`
      INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)
    `).bind(user.id, resetToken, expiresAt).run()

    // TODO: 이메일 발송

    return c.json(ok({
      reset_token: resetToken  // TODO: 운영에서 제거
    }, '비밀번호 재설정 이메일이 발송되었습니다.'))
  }
)

// ── POST /api/v1/auth/reset-password ──────────────────
auth.post(
  '/reset-password',
  zValidator('json', z.object({
    token: z.string(),
    password: z.string().min(8)
  })),
  async (c) => {
    const { token, password } = c.req.valid('json')

    const record = await c.env.DB.prepare(`
      SELECT user_id FROM password_resets
      WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')
    `).bind(token).first<{ user_id: number }>()

    if (!record) {
      return c.json(fail('유효하지 않거나 만료된 토큰입니다.'), 400)
    }

    const passwordHash = await hashPassword(password)

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(passwordHash, record.user_id),
      c.env.DB.prepare('UPDATE password_resets SET used_at = datetime(\'now\') WHERE token = ?').bind(token)
    ])

    return c.json(ok(null, '비밀번호가 변경되었습니다.'))
  }
)

// ── GET /api/v1/auth/me ───────────────────────────────
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const user = await c.env.DB.prepare(`
    SELECT id, email, name, account_type, plan, plan_expires_at, avatar_url, is_verified, created_at
    FROM users WHERE id = ? AND is_deleted = 0
  `).bind(userId).first()

  if (!user) {
    return c.json(fail('유저를 찾을 수 없습니다.'), 404)
  }

  return c.json(ok(user))
})

export default auth
