// ============================================================
// 유저 부속 리소스 라우트 — /api/v1/users
// 현재: FCM 디바이스 토큰 등록/해제 (앱 회신 2026-07-16 §D-1)
// ============================================================
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail } from '../middleware/response'

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── POST /api/v1/users/me/device-tokens ───────────────
// FCM 토큰 upsert. 같은 토큰이 다른 계정에 등록돼 있으면 현재 유저로 이전
// (한 기기에서 로그아웃 없이 계정 전환한 경우)
users.post(
  '/me/device-tokens',
  authMiddleware,
  zValidator('json', z.object({
    token: z.string().min(10).max(4096),
    platform: z.enum(['android', 'ios']),
    app_version: z.string().max(50).optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const { token, platform, app_version } = c.req.valid('json')

    await c.env.DB.prepare(`
      INSERT INTO device_tokens (user_id, token, platform, app_version)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_id     = excluded.user_id,
        platform    = excluded.platform,
        app_version = excluded.app_version,
        updated_at  = datetime('now')
    `).bind(userId, token, platform, app_version ?? null).run()

    return c.json(ok(null, '디바이스 토큰이 등록되었습니다.'), 201)
  }
)

// ── DELETE /api/v1/users/me/device-tokens ─────────────
// 로그아웃 시 호출. body { token } 필수
users.delete(
  '/me/device-tokens',
  authMiddleware,
  zValidator('json', z.object({
    token: z.string().min(10).max(4096)
  })),
  async (c) => {
    const userId = c.get('userId')
    const { token } = c.req.valid('json')

    const result = await c.env.DB.prepare(
      'DELETE FROM device_tokens WHERE token = ? AND user_id = ?'
    ).bind(token, userId).run()

    if (!result.meta.changes) {
      return c.json(fail('등록된 토큰이 아닙니다.'), 404)
    }
    return c.json(ok(null, '디바이스 토큰이 삭제되었습니다.'))
  }
)

export default users
