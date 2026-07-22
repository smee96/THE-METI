import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail } from '../middleware/response'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 유틸리티 ──────────────────────────────────────────
// 이메일 정규화: 소문자 + 앞뒤 공백 제거.
// users.email은 COLLATE NOCASE가 아니라 대소문자 구분이므로, 모바일 키보드 자동 대문자화
// (예: 'Smee96@naver.com')로 인해 계정을 못 찾는 문제를 방지한다. 등록/로그인/조회 공통 적용.
function normEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

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

// Web Crypto API 기반 HS256 JWT 서명
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
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식의 생년월일을 입력해주세요.'),
    account_type: z.enum(['personal']).default('personal').optional()
  })),
  async (c) => {
    const { password, name, birth_date } = c.req.valid('json')
    const email = normEmail(c.req.valid('json').email)

    // 만 19세 미만 가입 차단 (클라이언트 우회 방지 — 서버 측 강제)
    const [by, bm, bd] = birth_date.split('-').map(Number)
    const today = new Date()
    let age = today.getFullYear() - by
    if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) age--
    if (age < 19) {
      return c.json({
        success: false,
        error: '만 19세 미만은 가입할 수 없습니다.',
        error_code: 'age_restricted'
      }, 403)
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0'
    ).bind(email).first()

    if (existing) {
      return c.json(fail('이미 사용 중인 이메일입니다.'), 409)
    }

    const passwordHash = await hashPassword(password)

    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, name, account_type, plan, is_verified, birth_date)
      VALUES (?, ?, ?, 'personal', 'free', 1, ?)
    `).bind(email, passwordHash, name, birth_date).run()

    const userId = result.meta.last_row_id as number

    const verifyToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(userId, verifyToken, expiresAt).run()

    // 포인트 지갑 생성 (point_wallets 단일 원장)
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO point_wallets (owner_type, owner_id, balance) VALUES ('user', ?, 0)`
    ).bind(userId).run()

    // TODO: 이메일 발송 (추후 이메일 서비스 연동)
    return c.json(ok({
      user_id: userId,
      email,
    }, '회원가입이 완료되었습니다.'), 201)
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
    const { password } = c.req.valid('json')
    const email = normEmail(c.req.valid('json').email)

    const user = await c.env.DB.prepare(`
      SELECT id, email, password_hash, name, account_type, plan, is_verified, is_active, role
      FROM users WHERE email = ? AND is_deleted = 0
    `).bind(email).first<{
      id: number; email: string; password_hash: string; name: string;
      account_type: string; plan: string; is_verified: number; is_active: number;
      role: string
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

    // super_admin(id=1)은 이메일 인증 우회 (관리자 계정)
    const isSuperAdmin = user.role === 'super_admin' || user.id === 1
    if (!user.is_verified && !isSuperAdmin) {
      return c.json(fail('이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해주세요.'), 403)
    }

    const { accessToken, refreshToken } = await generateTokens(
      user.id, user.email, user.plan, user.account_type, c.env.JWT_SECRET
    )

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

// ── POST /api/v1/auth/web-session-token ───────────────
// 앱 → 외부 브라우저 자동 로그인용 원타임 토큰 발급 (앱 회신 2026-07-16 §C-2)
// 앱이 https://.../app/points?ott={token} 으로 브라우저를 열면
// 웹(app.js)이 /auth/web-session-exchange 로 교환해 세션 생성
const WEB_OTT_EXPIRES_IN = 300  // 5분

auth.post('/web-session-token', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')

  // 만료시각은 SQL에서 생성 — datetime('now') 비교와 포맷 일치 보장
  await c.env.DB.prepare(`
    INSERT INTO web_session_tokens (user_id, token, expires_at)
    VALUES (?, ?, datetime('now', '+${WEB_OTT_EXPIRES_IN} seconds'))
  `).bind(userId, token).run()

  return c.json(ok({ token, expires_in: WEB_OTT_EXPIRES_IN }), 201)
})

// ── POST /api/v1/auth/web-session-exchange ────────────
// 원타임 토큰 → 액세스/리프레시 토큰 교환 (1회용, 웹 전용)
auth.post(
  '/web-session-exchange',
  zValidator('json', z.object({
    token: z.string().min(16).max(128)
  })),
  async (c) => {
    const { token } = c.req.valid('json')

    const record = await c.env.DB.prepare(`
      SELECT wst.user_id, u.email, u.name, u.plan, u.account_type, u.role, u.is_active
      FROM web_session_tokens wst
      JOIN users u ON u.id = wst.user_id AND u.is_deleted = 0
      WHERE wst.token = ? AND wst.used_at IS NULL AND wst.expires_at > datetime('now')
    `).bind(token).first<{
      user_id: number; email: string; name: string; plan: string;
      account_type: string; role: string; is_active: number
    }>()

    if (!record || !record.is_active) {
      return c.json(fail('유효하지 않거나 만료된 토큰입니다.'), 401)
    }

    // 사용 처리를 먼저 — 동시 요청 경합에도 1회용 보장
    const used = await c.env.DB.prepare(
      `UPDATE web_session_tokens SET used_at = datetime('now') WHERE token = ? AND used_at IS NULL`
    ).bind(token).run()
    if (!used.meta.changes) {
      return c.json(fail('이미 사용된 토큰입니다.'), 401)
    }

    const { accessToken, refreshToken } = await generateTokens(
      record.user_id, record.email, record.plan, record.account_type, c.env.JWT_SECRET
    )

    const rtExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(record.user_id, refreshToken, rtExpiresAt).run()

    return c.json(ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: record.user_id,
        email: record.email,
        name: record.name,
        account_type: record.account_type,
        plan: record.plan,
        role: record.role ?? 'user'
      }
    }, '세션이 생성되었습니다.'))
  }
)

// ── POST /api/v1/auth/forgot-password ─────────────────
auth.post(
  '/forgot-password',
  zValidator('json', z.object({
    email: z.string().email()
  })),
  async (c) => {
    const email = normEmail(c.req.valid('json').email)

    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0'
    ).bind(email).first<{ id: number }>()

    if (!user) {
      return c.json(ok(null, '비밀번호 재설정 이메일이 발송되었습니다.'))
    }

    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(`
      INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)
    `).bind(user.id, resetToken, expiresAt).run()

    // TODO: 이메일 발송
    return c.json(ok(null, '비밀번호 재설정 이메일이 발송되었습니다.'))
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
           is_verified, role, created_at
    FROM users WHERE id = ? AND is_deleted = 0
  `).bind(userId).first()

  if (!user) {
    return c.json(fail('유저를 찾을 수 없습니다.'), 404)
  }

  return c.json(ok(user))
})

// ── PATCH /api/v1/auth/me ─────────────────────────────
// 프로필 수정 (이름)
auth.patch(
  '/me',
  authMiddleware,
  zValidator('json', z.object({
    name: z.string().min(2).max(50).optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { name } = c.req.valid('json')

    if (!name) return c.json(fail('수정할 내용이 없습니다.'), 400)

    await c.env.DB.prepare(
      `UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(name, userId).run()

    const user = await c.env.DB.prepare(`
      SELECT id, email, name, account_type, plan, plan_expires_at, avatar_url,
             is_verified, role, created_at
      FROM users WHERE id = ? AND is_deleted = 0
    `).bind(userId).first()

    return c.json(ok(user, '프로필이 수정되었습니다.'))
  }
)

// ── POST /api/v1/auth/me/avatar ───────────────────────
// 프로필 사진 업로드 (R2 저장)
auth.post('/me/avatar', authMiddleware, async (c) => {
  const userId = c.get('userId')

  // multipart/form-data 파싱
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json(fail('이미지 파일을 업로드해주세요.'), 400)
  }

  const file = formData.get('avatar') as File | null
  if (!file || typeof file === 'string') {
    return c.json(fail('avatar 필드에 이미지 파일을 첨부해주세요.'), 400)
  }

  // 파일 검증
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json(fail('JPG, PNG, WEBP, GIF 형식만 업로드 가능합니다.'), 400)
  }
  const maxSize = 5 * 1024 * 1024  // 5MB
  if (file.size > maxSize) {
    return c.json(fail('파일 크기는 5MB 이하여야 합니다.'), 400)
  }

  // 확장자 추출
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const key = `avatars/${userId}_${Date.now()}.${ext}`

  // R2에 업로드
  const arrayBuffer = await file.arrayBuffer()
  await c.env.STORAGE.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  })

  // public URL (r2.dev)
  const avatarUrl = `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/${key}`

  // DB 업데이트
  await c.env.DB.prepare(
    `UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(avatarUrl, userId).run()

  return c.json(ok({ avatar_url: avatarUrl }, '프로필 사진이 변경되었습니다.'))
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
// 초대 링크로 그룹 정보 미리보기 (로그인 전/후 모두 가능, Public)
auth.get('/invite/:token', async (c) => {
  const token = c.req.param('token')

  const invite = await c.env.DB.prepare(`
    SELECT
      gil.id, gil.token, gil.label, gil.max_uses, gil.used_count,
      gil.expires_at, gil.is_active,
      g.id as group_id, g.name as group_name, g.description as group_description,
      g.logo_url, g.purpose, g.has_minor, g.status as group_status,
      u.name as creator_name
    FROM group_invite_links gil
    JOIN groups g ON g.id = gil.group_id AND g.is_deleted = 0
    JOIN users u ON u.id = gil.created_by
    WHERE gil.token = ?
  `).bind(token).first<{
    id: number; token: string; label: string | null
    max_uses: number | null; used_count: number
    expires_at: string | null; is_active: number
    group_id: number; group_name: string; group_description: string | null
    logo_url: string | null; purpose: string | null; has_minor: number | null
    group_status: string; creator_name: string
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
      purpose: invite.purpose,
      has_minor: invite.has_minor,
      creator_name: invite.creator_name
    }
  }))
})

// ── POST /api/v1/auth/invite/:token/join ─────────────
// 초대 링크로 그룹 즉시 가입 (로그인된 일반 유저 전용)
// 흐름: 앱에서 초대링크 클릭 → 로그인/회원가입 → 이 API 호출 → 그룹 자동 active 가입
// - 생년월일은 선택입력 (미성년자 판단 목적, 레슨/스포츠 그룹에서 권장)
auth.post(
  '/invite/:token/join',
  authMiddleware,
  zValidator('json', z.object({
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const token = c.req.param('token')
    const { birth_date } = c.req.valid('json')

    // 초대 링크 + 그룹 유효성 확인
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

    // 이미 가입 여부 확인
    const existing = await c.env.DB.prepare(
      `SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`
    ).bind(invite.group_id, userId).first<{ status: string }>()
    if (existing?.status === 'active') return c.json(fail('이미 가입된 그룹입니다.'), 409)

    // 그룹 정원 + 플랜 멤버 한도 확인
    const [memberCountRow, groupAdminPlan] = await Promise.all([
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ? AND status = 'active'`
      ).bind(invite.group_id).first<{ cnt: number }>(),
      c.env.DB.prepare(`
        SELECT p.max_group_members
        FROM groups g
        JOIN users u ON u.id = g.admin_user_id
        JOIN plans p ON p.code = u.plan
        WHERE g.id = ?
      `).bind(invite.group_id).first<{ max_group_members: number | null }>()
    ])

    const currentCount = memberCountRow?.cnt ?? 0

    if (invite.max_members && currentCount >= invite.max_members) {
      return c.json(fail('그룹 정원이 가득 찼습니다.'), 409)
    }

    const planLimit = groupAdminPlan?.max_group_members ?? null
    if (planLimit !== null && currentCount >= planLimit) {
      return c.json({
        success: false,
        error: '그룹 멤버 한도에 도달했습니다.',
        error_code: 'plan_member_limit_reached',
        current: currentCount,
        limit: planLimit,
        upgrade_required: true
      }, 403)
    }

    // 생년월일 입력 시 미성년자 여부 계산 (만 19세 미만 = 미성년)
    let isMinor: number | null = null
    if (birth_date) {
      const [by, bm, bd] = birth_date.split('-').map(Number)
      const today = new Date()
      let age = today.getFullYear() - by
      if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) age--
      isMinor = age < 19 ? 1 : 0
    }

    // 초대 링크 가입 → 즉시 active (별도 승인 불필요)
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO group_members
        (group_id, user_id, status, role, joined_at, is_minor, birth_date)
      VALUES (?, ?, 'active', 'member', datetime('now'), ?, ?)
    `).bind(invite.group_id, userId, isMinor, birth_date ?? null).run()

    // 초대 링크 사용 횟수 증가
    await c.env.DB.prepare(`
      UPDATE group_invite_links SET used_count = used_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `).bind(invite.id).run()

    return c.json(ok({
      group_id: invite.group_id,
      is_minor: isMinor
    }, '그룹에 참여했습니다.'), 201)
  }
)

export default auth
