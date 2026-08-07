# 작업지시 — ELID 서버 (2026-08-08 주말)

발행: 부사장 세션 (mobin_ceo) · 승인: 대표
목표: **해피트리 제휴에서 ELID가 약속한 4종을 구현해 교착을 푼다.**
2026-07-08에 확정 회신까지 해놓고 한 달째 미구현 상태다.

## 스펙 원본

`../ELID_Reply_to_HappyTree_v0.1.md` (2026-07-08 — **이게 확정본이다**)
관련: `../HappyTree_Reply_to_ELID_v0.1.md`, `../ELID_HappyTree_Integration_Guide.md`

## 구현할 것 (약속했던 4종)

### 1. `POST /api/v1/partner/settlement`

해피트리가 보내는 정산 통지 수신. 확정 회신 §의 스펙대로.
- **멱등 처리 필수** — 해피트리 outbox가 백오프 재시도를 하므로 같은 통지가
  여러 번 올 수 있다. `settlement_id` 기준 중복 무시
- 환불 역정산(음수 금액) 지원
- 인증: `meti_partner_*` API 키 (아래 4번)

### 2. launch-token 발급 (RS256)

ELID 앱이 해피트리 웹뷰를 열 때 쓰는 1회용 토큰.
- RS256 서명. 기존 FCM용 RS256 코드가 참고가 된다
- `jti` 포함 (해피트리 쪽이 원타임 검증한다)
- **`iss` 값 결정 필요**: 8/4에 도메인이 `my-elid.com`으로 전환됐는데 7/8 스펙은
  `https://the-meti.pages.dev` 기준이다. **어느 값으로 갈지 대표 확인 후 확정한다**
  — 이건 인박스에 올리고 진행한다 (다른 작업은 막히지 않는다)

### 3. `/.well-known/partner-jwks.json`

공개키 공표. 해피트리가 이 URL로 토큰을 자체 검증한다.
현재 `.well-known`에는 apple-app-site-association, assetlinks.json 2개뿐이다.

### 4. 파트너 등록 + `meti_partner_*` 키 발급 (staging/prod)

- **키 값은 절대 커밋하지 않는다.** `.dev.vars` + `wrangler pages secret put`
- 해피트리에 전달할 실값(JWKS URL, iss, 스테이징 엔드포인트, 키)은
  문서에 키 이름만 적고 값은 별도 채널로 전달한다

## 같이 정정할 것

- [ ] `src/routes/partner.ts:105` — `commission_rate ?? 0.15` → **`?? 0.20`**
  (7/8 확정본이 20%다. 해피트리는 이미 0.20으로 잡고 있다)
- [ ] `wrangler.jsonc`의 `env.preview.vars`에 평문으로 있는 `TOSS_CLIENT_KEY`/
  `TOSS_SECRET_KEY`를 secret으로 이전 (테스트 키지만 패턴이 위험하다 —
  Pages는 배포 시 vars로 대시보드 secret을 덮어쓴다)

## 완료 기준 — v0.2 회신 문서

구현이 끝나면 **`../ELID_Reply_to_HappyTree_v0.2.md`** 를 작성한다.
7/8 문서 말미에 "실구현 후 실값을 v0.2로 전달"이라고 약속돼 있다.
내용: JWKS URL, iss 확정값, 스테이징 엔드포인트, 키 이름(값 제외), 사용 예시.
최상위 폴더는 이제 git이다(`smee96/the-meti-docs`) — **커밋까지 한다.**

완료 보고는 `D:\project\mobin_ceo\reports\inbox\2026-08-09-elid-server-완료.md`.

## 하지 않는다

- 해피트리 쪽 코드 수정 (그쪽은 별도 세션이 작업 중)
- ELID 앱 관련 다른 기능 (이번 지시는 제휴 4종에 집중)
