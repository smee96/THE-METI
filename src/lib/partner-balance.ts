// ============================================================
// B-2: 파트너(해피트리) 게임재화 잔액 조회 클라이언트
// 근거: ELID_Reply_to_HappyTree_v0.1.md §2 — GET /api/elid/v1/balance
//       인증 X-HT-Partner-Key · ELID측 5~10초 캐시 합의(레이트리밋 600/분 보호)
// - HT_PARTNER_KEY / HT_BALANCE_BASE_URL 미설정 시 비활성 (null 반환)
//   (해피트리가 prod 파트너 등록 전까지 prod는 미설정 → 자동 비활성)
// ============================================================
import type { Bindings } from '../types'

export type PartnerBalance = {
  stars: number
  hearts: number
  hearts_max: number
  coins: number
  level?: number
}

export type BalanceResult =
  | { status: 'ok'; data: PartnerBalance }
  | { status: 'not_linked' }              // 첫 SSO 로그인 전 — 해피트리에 플레이어 없음
  | { status: 'error'; httpStatus: number }

// isolate 수명 캐시 (합의: 5~10초)
const TTL_MS = 10_000
const cache = new Map<string, { exp: number; data: PartnerBalance }>()

export function balanceConfigured(env: Bindings): boolean {
  return !!(env.HT_PARTNER_KEY && env.HT_BALANCE_BASE_URL)
}

export async function fetchPartnerBalance(
  env: Bindings,
  externalUserKey: string
): Promise<BalanceResult | null> {
  if (!balanceConfigured(env)) return null

  const now = Date.now()
  const hit = cache.get(externalUserKey)
  if (hit && hit.exp > now) return { status: 'ok', data: hit.data }
  if (cache.size > 5000) {
    for (const [k, v] of cache) if (v.exp <= now) cache.delete(k)
  }

  const base = env.HT_BALANCE_BASE_URL!.replace(/\/+$/, '')
  const res = await fetch(`${base}/api/elid/v1/balance?external_user_key=${externalUserKey}`, {
    headers: { 'X-HT-Partner-Key': env.HT_PARTNER_KEY! },
  })
  if (res.status === 404) return { status: 'not_linked' }
  if (!res.ok) return { status: 'error', httpStatus: res.status }

  const body = await res.json<{ success: boolean; data: PartnerBalance }>().catch(() => null)
  if (!body?.success || !body.data) return { status: 'error', httpStatus: 502 }

  cache.set(externalUserKey, { exp: now + TTL_MS, data: body.data })
  return { status: 'ok', data: body.data }
}
