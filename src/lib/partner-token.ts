// ============================================================
// 파트너 launch-token (RS256) 발급 + JWKS 공개키 공표
// 근거: ELID_Reply_to_HappyTree_v0.1.md §1-2 (2026-07-08 확정 회신)
// - PARTNER_JWT_PRIVATE_KEY 시크릿(PKCS8 PEM) 미설정 시 발급 비활성 (null 반환)
// - 공개키는 개인키에서 파생해 /.well-known/partner-jwks.json 으로 공표
// - jti = UUID (파트너측이 원타임 검증), TTL 5분
// ============================================================
import { SignJWT, importPKCS8, exportJWK, type KeyLike } from 'jose'
import type { Bindings } from '../types'

const ALG = 'RS256'
const TOKEN_TTL_SEC = 300 // 확정 스펙: exp = iat + 300

// iss 값 — 도메인 전환(2026-08-04, my-elid.com) 반영. 대표 확정 전까지 잠정값이며
// PARTNER_JWT_ISS 시크릿으로 재배포 없이 교체 가능하다. (인박스 질의 중)
const DEFAULT_ISS = 'https://my-elid.com'
const DEFAULT_KID = 'elid-partner-2026-08'

// isolate 수명 동안 키/JWKS 재사용
let cached: { pem: string; key: KeyLike; jwks: object } | null = null

async function loadKey(env: Bindings): Promise<{ key: KeyLike; jwks: object } | null> {
  const raw = env.PARTNER_JWT_PRIVATE_KEY
  if (!raw) return null
  // 시크릿에 개행이 \n 문자열로 들어간 경우 복원
  const pem = raw.includes('-----') ? raw.replace(/\\n/g, '\n') : raw
  if (cached && cached.pem === pem) return cached

  const key = await importPKCS8(pem, ALG, { extractable: true })
  const jwk = await exportJWK(key)
  // 개인키 파라미터(d, p, q, ...)를 제거하고 공개 부분만 공표
  const jwks = {
    keys: [{
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: ALG,
      use: 'sig',
      kid: env.PARTNER_JWT_KID || DEFAULT_KID,
    }],
  }
  cached = { pem, key, jwks }
  return cached
}

export type LaunchTokenResult = {
  token: string
  expires_in: number
  jti: string
}

// 파트너 웹뷰 진입용 1회용 토큰. 서명 키 미설정 시 null.
export async function issueLaunchToken(
  env: Bindings,
  partnerSlug: string,
  externalUserKey: string
): Promise<LaunchTokenResult | null> {
  const loaded = await loadKey(env)
  if (!loaded) return null

  const jti = crypto.randomUUID()
  const token = await new SignJWT({
    partner_id: partnerSlug,
    external_user_key: externalUserKey,
  })
    .setProtectedHeader({ alg: ALG, typ: 'JWT', kid: env.PARTNER_JWT_KID || DEFAULT_KID })
    .setIssuer(env.PARTNER_JWT_ISS || DEFAULT_ISS)
    .setAudience(partnerSlug)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SEC}s`)
    .setJti(jti)
    .sign(loaded.key)

  return { token, expires_in: TOKEN_TTL_SEC, jti }
}

// /.well-known/partner-jwks.json 응답 본문. 키 미설정 시 빈 keys(무해).
export async function publicJwks(env: Bindings): Promise<object> {
  const loaded = await loadKey(env)
  return loaded ? loaded.jwks : { keys: [] }
}
