# METI NativeApp Agent Prompt — v2.7 변경 패치

> **문서 성격**: 이 문서는 **v2.6 대비 변경된 부분만** 기술합니다.  
> 앱 에이전트는 **v2.6 전체 문서를 기본(Base)으로 유지**하면서, 아래 지시에 따라 해당 섹션을 교체·추가하세요.  
> 변경되지 않은 섹션(인증 API, 명함 API, 채팅 API, 레슨 API, 행사 API 등)은 v2.6 그대로 사용합니다.

> **버전**: v2.7  
> **기준 버전**: v2.6 (2026-05-06)  
> **패치 작성일**: 2026-05-08

---

## 변경 요약

| # | 대상 섹션 | 변경 유형 | 한 줄 요약 |
|---|---------|---------|----------|
| 1 | §3 플랜 구조 | **교체** | 기본 명함 수 컬럼 추가, 결제 PG Toss+Stripe 확정 |
| 2 | 신규 §4 명함 정책 | **섹션 신규 추가** | 플랜별 기본 명함 수 + 추가 명함 구매 정책 |
| 3 | §5 포인트 시스템 | **교체** | 만료 정책 확정, 포인트 충전 상품 목록 추가 |
| 4 | §10 결제 방식 정책 | **교체** | PG 확정(Toss/Stripe), 일회성 토큰 URL 흐름, 구독 검증 방식 확정 |
| 5 | §10 신규 API | **내용 추가** | payment-token 발급/검증 API, point_charge_products API |
| 6 | §16 DB 스키마 | **내용 추가** | migration 0016, 0017 테이블 목록 |
| 7 | §18 로드맵 | **상태 업데이트** | v1.5 결정사항 반영 완료 표시 |

---

## PATCH 1 — §3 플랜 구조 교체

**v2.6의 §3 플랜 구조 표를 아래로 교체하세요.**

| 플랜 | 월 포인트 | 그룹 최대 멤버 | 기본 명함 수 | 구독 방식 |
|------|-----------|---------------|------------|-----------|
| free | 0 P | 2명 | 1개 | 무료 |
| pro | 10,000 P | 10명 | 3개 | Apple IAP / Google Play |
| business | 500,000 P | 무제한 | 10개 | Apple IAP / Google Play |

> **결제 PG 확정**: 국내 → Toss Payments / 해외 → Stripe  
> **Cloudflare 시크릿**: `TOSS_SECRET_KEY`, `STRIPE_SECRET_KEY`

---

## PATCH 2 — §4 명함 정책 섹션 신규 추가

**v2.6 §3 뒤에 §4를 새로 삽입하세요. 기존 §4 이후 번호는 한 칸씩 밀립니다.**

### 4-1. 플랜별 기본 명함 수

| 플랜 | 기본 명함 수 | 추가 명함 비용 |
|------|------------|--------------|
| free | 1개 | 1개당 5,000원 |
| pro | 3개 | 1개당 5,000원 |
| business | 10개 | 1개당 5,000원 |

### 4-2. 추가 명함 구매 흐름

- 기본 수량 초과 시 1개당 **5,000원** 웹 결제 (WebView 유도)
- 어드민 패널에서 단가 조정 가능 (`plan_configs.extra_card_price`)
- 구매한 추가 명함은 플랜 변경 시에도 유지

**앱 처리**:
1. 명함 생성 시도 → 서버에서 `card_limit_exceeded` 에러 반환 시
2. 추가 명함 구매 안내 화면 표시
3. WebView로 결제 페이지 유도 (일회성 토큰 방식)

```json
// 명함 한도 초과 에러 응답 (예시)
{
  "success": false,
  "error": "명함 생성 한도를 초과했습니다.",
  "data": {
    "error_code": "card_limit_exceeded",
    "current": 1,
    "limit": 1,
    "extra_price": 5000
  }
}
```

---

## PATCH 3 — §5 포인트 시스템 교체

**v2.6의 §5(또는 기존 포인트 섹션) 전체를 아래로 교체하세요.**

### 5-1. 개인 포인트 용도

| 사용처 | 방식 |
|--------|------|
| 명함 추가 구매 | 5,000원/개 — 웹 결제 (포인트 차감 아님) |
| 행사 참가비 (`entry_fee`) | 개인 포인트 차감 |
| 개인 → 그룹 이전 | 이전 금액만큼 차감 |

### 5-2. 포인트 만료 정책 (확정)

| 포인트 종류 | `point_type` | 만료 기준 |
|-----------|------------|---------|
| 구독 지급 포인트 (월 지급) | `subscription` | 다음 구독 갱신일에 만료 |
| 직접 충전 포인트 | `charged` | 충전 시점 기준 **90일** 후 만료 |
| 행사 환불·보상 포인트 | `reward` | 적립 시점 기준 **90일** 후 만료 |
| 이전·환불 포인트 | `transfer` | 발생 시점 기준 **90일** 후 만료 |

> **앱 처리**: 포인트 잔액 표시 시 만료 예정 포인트를 별도 안내 권장  
> 예) "곧 만료 예정 포인트: 3,000P (3일 후)"

### 5-3. 포인트 직접 충전 상품

```
GET /api/v1/payments/point-charge-products
권한: 인증 사용자
응답: 충전 상품 목록
```

응답 예시:
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "포인트 10,000P",  "amount_krw": 10000,  "points": 10000,  "is_custom": 0 },
    { "id": 2, "title": "포인트 100,000P", "amount_krw": 100000, "points": 100000, "is_custom": 0 },
    { "id": 3, "title": "포인트 500,000P", "amount_krw": 500000, "points": 500000, "is_custom": 0 },
    { "id": 4, "title": "직접 입력",       "amount_krw": 0,      "points": 0,      "is_custom": 1, "min_amount": 10000 }
  ]
}
```

> 직접 입력 최소 금액: **10,000원**. 앱에서 10,000원 미만 입력 시 로컬 유효성 검사로 차단.

---

## PATCH 4 — §10 결제 방식 정책 전체 교체

**v2.6의 §10-4 결제 방식 정책을 아래로 교체하세요.**

### 결제 PG (확정)

| 대상 결제 | PG사 | 통화 |
|---------|------|------|
| 국내 결제 | **Toss Payments** | KRW |
| 해외 결제 | **Stripe** | USD / 기타 |
| Apple 구독 | Apple IAP | 각국 통화 |
| Google 구독 | Google Play Billing | 각국 통화 |

### 결제 항목별 방식 (확정)

| 항목 | 결제 방식 | 비고 |
|------|---------|------|
| 구독 (pro/business) | Apple IAP + Google Play | 인앱결제 |
| 레슨·행사 상품 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 포인트 직접 충전 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 명함 추가 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |

> ⚠️ **Apple/Google 정책 준수**: 앱 내에서 "웹에서 결제하세요" 문구 직접 노출 금지.  
> WebView 방식 또는 외부 브라우저로 유도할 것.

### 구독 검증 방식 (확정)

**앱 재검증(Client-side) 방식** 채택. 웹훅은 Phase 2.

```
앱 실행 시 또는 구독 상태 확인 필요 시:
  → Apple/Google로부터 영수증/구매토큰 수신
  → POST /api/v1/payments/subscription/verify-apple (또는 verify-google)
  → 서버에서 유효성 확인 후 플랜 업데이트
```

---

## PATCH 5 — §10 일회성 결제 토큰 API 추가

**v2.6 §10-3 결제(Payments) 섹션에 아래 API를 추가하세요.**

### 일회성 결제 토큰 발급

```
POST /api/v1/payments/payment-token
권한: 인증 사용자
Body: { "order_id": 42 }
```

응답:
```json
{
  "success": true,
  "data": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expires_in": 300,
    "expires_at": "2026-05-08T10:35:00.000Z",
    "payment_url": "/payment?token=550e8400-e29b-41d4-a716-446655440000"
  }
}
```

> - 토큰은 **5분 유효**, **1회 사용 즉시 무효화**
> - 동일 주문에 토큰 재발급 시 이전 토큰 자동 무효화
> - JWT를 URL에 직접 포함하지 않는 이유: 서버 로그에 토큰 노출 방지

### 토큰 검증 (결제 페이지 서버 내부용)

```
GET /api/v1/payments/payment-token/verify?token=xxx
권한: 없음 (결제 페이지에서 서버가 직접 호출)
```

응답:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "user_name": "홍길동",
    "user_email": "hong@example.com",
    "order_id": 42,
    "total_amount": 100000,
    "order_status": "pending"
  }
}
```

> ⚠️ 토큰 검증 즉시 `is_used = 1` 처리 — 이후 동일 토큰 재사용 불가

### 앱 WebView 결제 전체 흐름 (확정)

```
1. 앱: 상품 선택 → POST /api/v1/orders → order_id 획득
   ↓
2. 앱: POST /api/v1/payments/payment-token
        { "order_id": 42 }
        → token, payment_url 획득
   ↓
3. 앱: WebView로 결제 페이지 열기
        URL: https://the-meti.pages.dev/payment?token={token}
   ↓
4. 결제 서버: 토큰 검증 (GET /payments/payment-token/verify)
              → 사용자 인증 완료 → PG 결제창 표시
   ↓
5. PG 결제 완료 → POST /api/v1/payments/verify-web
        { "order_id": 42, "pg": "toss", "pg_transaction_id": "...", "amount": 100000 }
   ↓
6. 서버: 금액 검증 → 주문 상태 paid → WebView 닫기 콜백
```

---

## PATCH 6 — §16 DB 스키마에 내용 추가

**v2.6 §16 DB 스키마 변경 이력 표의 마지막 행 아래에 다음을 추가하세요.**

| Migration | 내용 |
|-----------|------|
| *(기존 행 유지)* | *(변경 없음)* |
| **0016** | `point_transactions.point_type` 컬럼 추가 / `payment_tokens` 신규 테이블 (일회성 결제 토큰) |
| **0017** | `plans.free_card_limit` 컬럼 추가 / `plan_configs` 신규 테이블 / `point_charge_products` 신규 테이블 |

---

## PATCH 7 — §18 로드맵 현재 Phase 업데이트

**v2.6 §18 로드맵 표의 "현재" 행을 아래로 교체하세요.**

| Phase | 내용 | 서버 상태 |
|-------|------|---------|
| **현재** | 인증, 명함, 그룹, 포인트, 강사 역할, 레슨/행사 CRUD, 상품·주문·결제 API, **일회성 결제 토큰**, **포인트 만료 정책 DB**, **명함 수량 제한 plan_configs** | ✅ 완료 |

> ~~v2.6: 결제 토큰·포인트 만료 정책 미포함~~

---

## 적용 후 검증 체크리스트

- [ ] §3 플랜 표에 "기본 명함 수" 컬럼이 추가됨 (free=1, pro=3, business=10)
- [ ] §3에 결제 PG가 "Toss Payments + Stripe"로 명시됨
- [ ] §4(명함 정책)가 신규 삽입됨 — extra_price = 5,000원, card_limit_exceeded 에러 코드 포함
- [ ] §5 포인트 만료 정책에 point_type 4가지와 만료 기준이 명시됨
- [ ] §5에 포인트 충전 상품 목록 API(`GET .../point-charge-products`)가 있음
- [ ] §5에 직접 입력 최소 금액(10,000원)이 명시됨
- [ ] §10 결제 PG가 Toss + Stripe로 확정됨
- [ ] §10에 구독 검증 방식이 "앱 재검증(Client-side)"으로 확정됨
- [ ] §10에 `POST .../payment-token` 발급 API가 있음
- [ ] §10에 `GET .../payment-token/verify` 검증 API가 있음
- [ ] §10에 WebView 결제 전체 흐름 6단계가 있음
- [ ] §16에 migration 0016, 0017 행이 추가됨
- [ ] §18 현재 Phase에 일회성 토큰·포인트 만료·명함 수량 제한 완료 표시됨

---

*METI NativeApp Agent Prompt v2.7 Patch — 2026-05-08*  
*Base: v2.6 (2026-05-06) — 변경된 섹션만 기술, 나머지는 v2.6 원본 유지*
