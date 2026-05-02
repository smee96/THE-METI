import { Hono } from 'hono'
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

// Web Crypto API 기반 HS256 JWT 서명 (hono/jwt 대체)
async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = { alg: 'HS256', typ: 'JWT' }
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const headerB64 = b64url(header)
  const payloadB64 = b64url(payload)
  const data = `${headerB64}.${payloadB64}`
  const keyData = encoder.encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${data}.${sigB64}`
}

async function generateTokens(
  userId: number,
  email: string,
  plan: string,
  account_type: string,
  jwtSecret: string
) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await signJWT(
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
    account_type: z.enum(['personal', 'headhunter']).default('personal'),
    user_type: z.enum(['ADULT', 'MINOR']).default('ADULT'),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    phone: z.string().max(30).optional()
  })),
  async (c) => {
    const { email, password, name, account_type, user_type, birth_date, phone } = c.req.valid('json')

    // 이메일 중복 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0'
    ).bind(email).first()

    if (existing) {
      return c.json(fail('이미 사용 중인 이메일입니다.'), 409)
    }

    const passwordHash = await hashPassword(password)

    // 미성년자는 기본 visibility 제한 적용 (앱 레이어 정책)
    // 유저 생성
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, name, account_type, plan, is_verified, user_type, birth_date, phone)
      VALUES (?, ?, ?, ?, 'free', 0, ?, ?, ?)
    `).bind(email, passwordHash, name, account_type, user_type, birth_date ?? null, phone ?? null).run()

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
      SELECT id, email, password_hash, name, account_type, plan, is_verified, is_active, user_type, role
      FROM users WHERE email = ? AND is_deleted = 0
    `).bind(email).first<{
      id: number; email: string; password_hash: string; name: string;
      account_type: string; plan: string; is_verified: number; is_active: number;
      user_type: string; role: string
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
        plan: user.plan,
        user_type: user.user_type ?? 'ADULT',
        role: user.role ?? 'user'
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
    SELECT id, email, name, account_type, plan, plan_expires_at, avatar_url,
           is_verified, user_type, role, created_at
    FROM users WHERE id = ? AND is_deleted = 0
  `).bind(userId).first()

  if (!user) {
    return c.json(fail('유저를 찾을 수 없습니다.'), 404)
  }

  return c.json(ok(user))
})

// ── PUT /api/v1/auth/password ─────────────────────────
auth.put(
  '/password',
  authMiddleware,
  zValidator('json', z.object({
    current_password: z.string(),
    new_password: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.')
  })),
  async (c) => {
    const userId = c.get('userId')
    const { current_password, new_password } = c.req.valid('json')

    const user = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ? AND is_deleted = 0'
    ).bind(userId).first<{ password_hash: string }>()

    if (!user) return c.json(fail('유저를 찾을 수 없습니다.'), 404)

    const isValid = await comparePassword(current_password, user.password_hash)
    if (!isValid) return c.json(fail('현재 비밀번호가 올바르지 않습니다.'), 400)

    const newHash = await hashPassword(new_password)
    await c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newHash, userId).run()

    return c.json(ok(null, '비밀번호가 변경되었습니다.'))
  }
)

// ── GET /api/v1/auth/invite/:token ───────────────────
// 초대 링크 정보 사전 조회 (가입 전 그룹 정보 확인용)
auth.get('/invite/:token', async (c) => {
  const token = c.req.param('token')

  const invite = await c.env.DB.prepare(`
    SELECT
      gil.id, gil.token, gil.label, gil.max_uses, gil.used_count,
      gil.expires_at, gil.is_active,
      g.id as group_id, g.name as group_name, g.description as group_description,
      g.logo_url, g.group_type, g.lesson_config, g.status as group_status,
      u.name as instructor_name
    FROM group_invite_links gil
    JOIN groups g ON g.id = gil.group_id AND g.is_deleted = 0
    JOIN users u ON u.id = gil.created_by
    WHERE gil.token = ?
  `).bind(token).first<{
    id: number; token: string; label: string | null
    max_uses: number | null; used_count: number
    expires_at: string | null; is_active: number
    group_id: number; group_name: string; group_description: string | null
    logo_url: string | null; group_type: string; lesson_config: string | null
    group_status: string; instructor_name: string
  }>()

  if (!invite) return c.json(fail('유효하지 않은 초대 링크입니다.'), 404)
  if (!invite.is_active) return c.json(fail('비활성화된 초대 링크입니다.'), 410)
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return c.json(fail('만료된 초대 링크입니다.'), 410)
  }
  if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
    return c.json(fail('사용 횟수가 초과된 초대 링크입니다.'), 410)
  }
  if (invite.group_status !== 'active') {
    return c.json(fail('현재 가입할 수 없는 그룹입니다.'), 410)
  }

  return c.json(ok({
    token: invite.token,
    label: invite.label,
    group: {
      id: invite.group_id,
      name: invite.group_name,
      description: invite.group_description,
      logo_url: invite.logo_url,
      group_type: invite.group_type,
      lesson_config: invite.lesson_config ? JSON.parse(invite.lesson_config) : null,
      instructor_name: invite.instructor_name
    }
  }))
})

// ── POST /api/v1/auth/invite/:token/join ─────────────
// 초대 링크로 가입 (미성년자 Lite 계정 전용)
// - 이메일 인증 없음
// - 최소 정보만 입력 (이름 + 생년월일 + PIN)
// - 가입 즉시 해당 그룹 멤버로 등록
// - user_type = MINOR 자동 설정
auth.post(
  '/invite/:token/join',
  zValidator('json', z.object({
    name: z.string().min(1, '이름을 입력해주세요.').max(50),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식으로 입력해주세요.'),
    pin: z.string().min(4, 'PIN은 4자리 이상이어야 합니다.').max(8),
    // 선택: 보호자/강사가 나중에 연락할 수 있는 연락처 (없어도 됨)
    contact: z.string().max(100).optional()  // 전화번호 또는 부모 연락처
  })),
  async (c) => {
    const token = c.req.param('token')
    const { name, birth_date, pin, contact } = c.req.valid('json')

    // 초대 링크 유효성 확인
    const invite = await c.env.DB.prepare(`
      SELECT
        gil.id, gil.group_id, gil.max_uses, gil.used_count,
        gil.expires_at, gil.is_active,
        g.status as group_status, g.max_members
      FROM group_invite_links gil
      JOIN groups g ON g.id = gil.group_id AND g.is_deleted = 0
      WHERE gil.token = ?
    `).bind(token).first<{
      id: number; group_id: number
      max_uses: number | null; used_count: number
      expires_at: string | null; is_active: number
      group_status: string; max_members: number | null
    }>()

    if (!invite) return c.json(fail('유효하지 않은 초대 링크입니다.'), 404)
    if (!invite.is_active) return c.json(fail('비활성화된 초대 링크입니다.'), 410)
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return c.json(fail('만료된 초대 링크입니다.'), 410)
    }
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      return c.json(fail('사용 횟수가 초과된 초대 링크입니다.'), 410)
    }
    if (invite.group_status !== 'active') {
      return c.json(fail('현재 가입할 수 없는 그룹입니다.'), 410)
    }

    // 그룹 정원 확인
    if (invite.max_members) {
      const memberCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ? AND status = 'active'`
      ).bind(invite.group_id).first<{ cnt: number }>()
      if ((memberCount?.cnt ?? 0) >= invite.max_members) {
        return c.json(fail('그룹 정원이 가득 찼습니다.'), 409)
      }
    }

    // 생년월일로 미성년자 여부 자동 판별
    // (만 19세 미만 → MINOR, 이상 → ADULT)
    const birthYear = parseInt(birth_date.split('-')[0])
    const birthMonth = parseInt(birth_date.split('-')[1])
    const birthDay = parseInt(birth_date.split('-')[2])
    const today = new Date()
    let age = today.getFullYear() - birthYear
    if (
      today.getMonth() + 1 < birthMonth ||
      (today.getMonth() + 1 === birthMonth && today.getDate() < birthDay)
    ) {
      age--
    }
    const userType = age < 19 ? 'MINOR' : 'ADULT'

    // 내부 식별용 이메일 생성 (로그인에 사용 안 함)
    // 초대 링크 토큰 + 타임스탬프 기반으로 유니크하게
    const fakeEmail = `invite_${token.slice(0, 8)}_${Date.now()}@meti.internal`
    const pinHash = await hashPassword(pin)

    // 유저 생성 (is_verified = 1, 이메일 인증 불필요)
    const userResult = await c.env.DB.prepare(`
      INSERT INTO users
        (email, password_hash, name, account_type, plan, is_verified, is_active,
         user_type, birth_date, phone, invited_via_token)
      VALUES (?, ?, ?, 'personal', 'free', 1, 1, ?, ?, ?, ?)
    `).bind(
      fakeEmail, pinHash, name,
      userType, birth_date, contact ?? null, token
    ).run()

    const userId = userResult.meta.last_row_id as number

    // 리워드 잔액 초기화
    await c.env.DB.prepare(
      'INSERT INTO reward_balances (user_id, points) VALUES (?, 0)'
    ).bind(userId).run()

    // 그룹 멤버로 즉시 등록 (승인 불필요 - 초대 링크로 가입이므로 바로 active)
    await c.env.DB.prepare(`
      INSERT INTO group_members (group_id, user_id, status, role, joined_at)
      VALUES (?, ?, 'active', 'member', datetime('now'))
    `).bind(invite.group_id, userId).run()

    // 초대 링크 사용 횟수 증가
    await c.env.DB.prepare(`
      UPDATE group_invite_links
      SET used_count = used_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `).bind(invite.id).run()

    // JWT 발급 (초대 가입자도 앱 로그인 가능)
    const { accessToken, refreshToken } = await generateTokens(
      userId, fakeEmail, 'free', 'personal', c.env.JWT_SECRET
    )

    const rtExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(userId, refreshToken, rtExpiresAt).run()

    return c.json(ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: userId,
        name,
        user_type: userType,
        group_id: invite.group_id,
        plan: 'free',
        role: 'user'
      }
    }, `${name}님, 환영합니다! 그룹에 참여되었습니다.`), 201)
  }
)

// ── POST /api/v1/auth/invite/:token/login ────────────
// 초대 링크 가입자 PIN 로그인
// (이메일 없이 이름 + 그룹 ID + PIN으로 로그인)
auth.post(
  '/invite/:token/login',
  zValidator('json', z.object({
    name: z.string().min(1).max(50),
    pin: z.string().min(4).max(8)
  })),
  async (c) => {
    const token = c.req.param('token')
    const { name, pin } = c.req.valid('json')

    // 해당 초대 토큰으로 가입한 유저 조회
    const user = await c.env.DB.prepare(`
      SELECT u.id, u.name, u.password_hash, u.user_type, u.is_active,
             gm.group_id
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id AND gm.status = 'active'
      JOIN group_invite_links gil ON gil.token = u.invited_via_token AND gil.group_id = gm.group_id
      WHERE u.invited_via_token = ? AND u.name = ? AND u.is_deleted = 0
      LIMIT 1
    `).bind(token, name).first<{
      id: number; name: string; password_hash: string
      user_type: string; is_active: number; group_id: number
    }>()

    if (!user) return c.json(fail('이름 또는 PIN이 올바르지 않습니다.'), 401)
    if (!user.is_active) return c.json(fail('비활성화된 계정입니다.'), 403)

    const isValid = await comparePassword(pin, user.password_hash)
    if (!isValid) return c.json(fail('이름 또는 PIN이 올바르지 않습니다.'), 401)

    const fakeEmail = `invite_${token.slice(0, 8)}_${user.id}@meti.internal`
    const { accessToken, refreshToken } = await generateTokens(
      user.id, fakeEmail, 'free', 'personal', c.env.JWT_SECRET
    )

    const rtExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, refreshToken, rtExpiresAt).run()

    return c.json(ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        user_type: user.user_type,
        group_id: user.group_id,
        plan: 'free',
        role: 'user'
      }
    }, '로그인 성공'))
  }
)

export default auth
