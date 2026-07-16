// ============================================================
// FCM HTTP v1 푸시 발송
// - FCM_SERVICE_ACCOUNT 시크릿(서비스 계정 키 JSON) 미설정 시 자동 비활성 (no-op)
// - 페이로드: notification(title/body) + data 혼합 (앱 회신 2026-07-16 §D-3)
// - UNREGISTERED / INVALID_ARGUMENT 응답 토큰은 자동 삭제 (§D-1)
// - 호출부는 c.executionCtx.waitUntil()로 비동기 발송 — 본 응답을 막지 않음
// ============================================================
import type { Bindings } from '../types'

export type PushMessage = {
  title: string
  body: string
  // FCM 제약: data 값은 전부 문자열 (§D-3)
  data: Record<string, string>
}

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

// isolate 수명 동안 OAuth 액세스 토큰 재사용 (약 1시간 유효)
let cachedAccessToken: { token: string; exp: number } | null = null

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlFromJson(obj: unknown): string {
  return b64urlFromBytes(new TextEncoder().encode(JSON.stringify(obj)))
}

// 서비스 계정 키로 RS256 JWT 서명 → OAuth2 액세스 토큰 교환
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.exp > now + 60) {
    return cachedAccessToken.token
  }

  const header = b64urlFromJson({ alg: 'RS256', typ: 'JWT' })
  const claims = b64urlFromJson({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)
  )
  const jwt = `${header}.${claims}.${b64urlFromBytes(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`FCM OAuth 토큰 발급 실패: ${res.status} ${await res.text()}`)

  const data = await res.json<{ access_token: string; expires_in: number }>()
  cachedAccessToken = { token: data.access_token, exp: now + data.expires_in }
  return data.access_token
}

// 지정 유저들의 등록된 모든 기기로 발송. 실패해도 throw하지 않음.
export async function sendPushToUsers(
  env: Bindings,
  userIds: number[],
  msg: PushMessage
): Promise<void> {
  try {
    if (!env.FCM_SERVICE_ACCOUNT || userIds.length === 0) return

    let sa: ServiceAccount
    try {
      sa = JSON.parse(env.FCM_SERVICE_ACCOUNT)
    } catch {
      console.error('FCM_SERVICE_ACCOUNT 시크릿이 유효한 JSON이 아닙니다.')
      return
    }
    if (!sa.project_id || !sa.client_email || !sa.private_key) return

    const placeholders = userIds.map(() => '?').join(',')
    const rows = await env.DB.prepare(
      `SELECT id, token FROM device_tokens WHERE user_id IN (${placeholders})`
    ).bind(...userIds).all<{ id: number; token: string }>()
    if (!rows.results.length) return

    const accessToken = await getAccessToken(sa)
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

    await Promise.all(rows.results.map(async (row) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title: msg.title, body: msg.body },
              data: msg.data,
            },
          }),
        })
        if (!res.ok) {
          const errBody = await res.text()
          // 죽은 토큰 자동 삭제 (앱 회신 §D-1)
          if (res.status === 404 || errBody.includes('UNREGISTERED') || errBody.includes('INVALID_ARGUMENT')) {
            await env.DB.prepare('DELETE FROM device_tokens WHERE id = ?').bind(row.id).run()
          } else {
            console.error(`FCM 발송 실패 (token#${row.id}): ${res.status} ${errBody.slice(0, 300)}`)
          }
        }
      } catch (e) {
        console.error(`FCM 발송 오류 (token#${row.id}):`, e)
      }
    }))
  } catch (e) {
    console.error('sendPushToUsers 오류:', e)
  }
}
