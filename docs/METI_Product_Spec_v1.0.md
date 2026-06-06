# METI 서비스 기획서 v1.0

> **작성일**: 2026-05-05  
> **상태**: 기획 확정 (코드 작업 전)  
> **다음 단계**: DB 마이그레이션 → API 구현 → 웹/앱 프롬프트 작성

---

## 1. 서비스 개요

**METI**는 디지털 명함 기반 소셜 네트워크 플랫폼입니다.

### 핵심 가치
- 개인/단체의 디지털 명함 생성 및 QR·NFC 기반 교환
- 그룹(협회·클럽·레슨 등) 운영 및 행사 관리
- 포인트 기반 유료 기능 이용 (명함 추가, 행사 개설, NFC 카드 발급 등)

### 접속 채널
| 채널 | 대상 | 상태 |
|------|------|------|
| 네이티브 앱 (iOS/Android) | 일반 사용자 | 개발 중 |
| 슈퍼어드민 웹 (`/admin`) | METI 운영팀 | 운영 중 |
| 사용자·그룹관리 웹 (별도 도메인) | 개인 사용자 + 그룹 관리자 | **미개발 (예정)** |

---

## 2. 사용자 역할 체계

### 2-1. 역할 정의

| 역할 | 설명 | 접속 채널 |
|------|------|---------|
| `user` | 일반 회원 | 앱 + 사용자 웹 |
| `group_admin` | 그룹 관리자 (특정 그룹의 admin/sub_admin) | 앱 + 사용자 웹 (그룹 관리 탭) |
| `super_admin` | METI 운영팀 | 슈퍼어드민 웹 (`/admin`) |

> **중요**: `group_admin`은 별도 계정이 아님.  
> 일반 `user`가 그룹 내에서 admin 역할을 가지면 **그룹 관리 탭으로 전환** 가능.

### 2-2. 역할별 접근 가능 기능

| 기능 | user | group_admin | super_admin |
|------|:----:|:-----------:|:-----------:|
| 명함 생성/관리 | ✅ | ✅ | - |
| 그룹 가입/탈퇴 | ✅ | ✅ | - |
| 그룹 멤버 관리 | - | ✅ | - |
| 행사 개설 | - | ✅ | ✅ |
| 개인 포인트 충전/사용 | ✅ | ✅ | - |
| 그룹 포인트 충전/사용 | - | ✅ | - |
| 전체 사용자 관리 | - | - | ✅ |
| 그룹 심사/승인 | - | - | ✅ |
| 포인트 단가 설정 | - | - | ✅ |
| 플랜별 지급 포인트 설정 | - | - | ✅ |

### 2-3. 웹 로그인 후 화면 분기

```
로그인
  ↓
역할 확인
  ├── super_admin → 슈퍼어드민 대시보드 (/admin/dashboard)
  ├── group_admin → 개인 대시보드 + [그룹 관리로 전환] 버튼 표시
  └── user       → 개인 대시보드
```

**그룹 관리자 전환 UX:**
- 헤더 또는 사이드바에 "개인 ↔ 그룹 관리" 토글
- 전환 시 현재 관리 중인 그룹 선택 (여러 그룹 관리 시 드롭다운)
- 그룹 관리 모드: 멤버 관리 / 행사 관리 / 그룹 포인트 / 출석 관리 탭

---

## 3. 플랜 정책

### 3-1. 개인 플랜 정의

| 플랜 | 월 구독료 | 구독 지급 포인트 | 명함 한도 | 그룹 기능 | 관리자 기능 |
|------|---------|--------------|---------|---------|-----------|
| `free` | 0원 | 0 P | 3개 | 가입만 가능 | ❌ |
| `pro` | 미정 | 10,000 P | 10개 | 생성·운영 가능 | ❌ |
| `business` | 미정 | 500,000 P | 무제한 | 생성·운영 가능 | 그룹 관리 기능 |

> - 구독료·지급 포인트는 **슈퍼어드민에서 변경 가능**
> - `business` 관리자 기능 = 그룹 내 관리자 기능 (멤버 통계, 행사 대량 초대, 레슨 출석 리포트 등)  
>   ※ METI 슈퍼어드민 기능과 완전히 별개

### 3-2. 구독 포인트 유효기간 정책 (권장)

| 포인트 종류 | 유효기간 | 비고 |
|-----------|--------|------|
| 구독 지급 포인트 | **90일** | 매월 갱신 시 리셋 (미사용분 소멸) |
| 단건 충전 포인트 | **365일** | 충전 시점부터 1년 |
| 관리자 지급 포인트 | 관리자 설정 | 이벤트·프로모션용 |

> ※ 유효기간 정책은 추후 변경 가능. 만료 7일 전 앱 푸시 알림 권장.

---

## 4. 포인트 시스템

### 4-1. 포인트 기본 원칙

- **1P = 1원** (고정)
- 포인트는 **개인 지갑**과 **그룹 지갑** 별도 운영
- 개인 포인트 → 그룹 포인트 이전 가능 (그룹 관리자만)
- 그룹 포인트 → 개인 포인트 역이전 불가 (환불 방지)

### 4-2. 포인트 소유 주체

```
개인 포인트 (point_wallets - owner_type: 'user')
  └── 사용처: 명함 추가 생성, NFC 카드 발급, 파트너 서비스 이용

그룹 포인트 (point_wallets - owner_type: 'group')
  └── 사용처: 행사 개설, 프리미엄 초대링크, 레슨 기능 확장
```

### 4-3. 포인트 사용처 및 단가

| 사용처 | 차감 대상 | 기본 단가 | 어드민 변경 |
|-------|---------|---------|----------|
| 명함 추가 생성 (한도 초과 시 1개당) | 개인 | **1,000 P** | ✅ |
| 그룹 생성 | 개인 | **0 P (무료)** | ✅ |
| 행사 개설 | 그룹 | **3,000 P** | ✅ |
| NFC 실물카드 발급 (기본형) | 개인 | **15,000 P** | ✅ |
| NFC 실물카드 발급 (프리미엄) | 개인 | **30,000 P** | ✅ |
| 파트너 서비스 이용 | 개인/그룹 | 파트너사 설정 | ✅ |

> 단가는 `point_prices` 테이블에 저장, 슈퍼어드민 웹에서 실시간 변경 가능

### 4-4. 포인트 충전 방식

#### A. 구독 자동 지급 (인앱결제)
```
사용자 플랜 구독 → 매월 1일 구독 포인트 자동 지급 → 개인 지갑 적립
```
- 충전 수단: 앱스토어(애플) / 구글플레이 인앱결제
- 앱 내에서만 구독 가입/해지 가능

#### B. 단건 포인트 충전 (웹 결제 - 미개발)
```
사용자 웹 접속 → 충전 금액 선택 → PG사 결제 → 포인트 즉시 적립
```
- 충전 수단: 신용카드, 카카오페이, 토스페이 등 (PG사 미정)
- **앱 내에서는 "웹에서 충전 가능합니다" 문구 및 유도 버튼 표시 금지** (애플/구글 정책)
- 앱에서는 충전 버튼 자체를 노출하지 않음 (Netflix 방식)

#### C. 그룹 포인트 충전
```
그룹 관리자 → 사용자 웹(그룹 관리 탭) → PG사 결제 → 그룹 지갑 적립
  또는
그룹 관리자 → 개인 포인트에서 그룹 포인트로 이전
```

### 4-5. 포인트 차감 흐름

```
사용자가 유료 기능 요청
  ↓
포인트 잔액 확인 (개인 또는 그룹 지갑)
  ├── 잔액 충분 → 포인트 차감 → 기능 실행 → 이력 기록
  └── 잔액 부족 → 부족 금액 안내 → 충전 유도 (웹 링크 제공)
```

---

## 5. DB 설계 (신규 추가)

### 5-1. 신규 테이블

#### `point_wallets` — 포인트 지갑
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
owner_type      TEXT NOT NULL  -- 'user' | 'group'
owner_id        INTEGER NOT NULL  -- users.id 또는 groups.id
balance         INTEGER NOT NULL DEFAULT 0  -- 현재 잔액 (P)
total_charged   INTEGER NOT NULL DEFAULT 0  -- 누적 충전액
total_used      INTEGER NOT NULL DEFAULT 0  -- 누적 사용액
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE(owner_type, owner_id)
```

#### `point_transactions` — 포인트 이력
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
wallet_id       INTEGER NOT NULL  -- point_wallets.id
type            TEXT NOT NULL
  -- 'charge_subscription' : 구독 자동 지급
  -- 'charge_purchase'     : 단건 충전
  -- 'charge_admin'        : 관리자 지급
  -- 'charge_transfer_in'  : 개인→그룹 이전 (수신)
  -- 'use_card_extra'      : 명함 추가 생성
  -- 'use_event_create'    : 행사 개설
  -- 'use_nfc_card'        : NFC 카드 발급
  -- 'use_partner'         : 파트너 서비스 이용
  -- 'use_transfer_out'    : 개인→그룹 이전 (송신)
  -- 'expire'              : 유효기간 만료 소멸
amount          INTEGER NOT NULL  -- 양수: 충전, 음수: 차감
balance_after   INTEGER NOT NULL  -- 거래 후 잔액
ref_type        TEXT  -- 연관 대상 타입 ('card'|'event'|'nfc_order'|'subscription'|'payment')
ref_id          INTEGER  -- 연관 대상 ID
description     TEXT  -- 이력 메모
expires_at      DATETIME  -- 포인트 유효기간 (null = 무제한)
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `point_prices` — 기능별 포인트 단가 (어드민 설정)
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
feature     TEXT NOT NULL UNIQUE
  -- 'card_extra'      : 명함 추가 1개
  -- 'group_create'    : 그룹 생성
  -- 'event_create'    : 행사 개설
  -- 'nfc_basic'       : NFC 기본형
  -- 'nfc_premium'     : NFC 프리미엄
price       INTEGER NOT NULL DEFAULT 0  -- P
description TEXT
is_active   INTEGER NOT NULL DEFAULT 1
updated_by  INTEGER  -- super_admin user_id
updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `plan_configs` — 플랜별 설정 (어드민 설정)
```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
plan                TEXT NOT NULL UNIQUE  -- 'free'|'pro'|'business'
monthly_points      INTEGER NOT NULL DEFAULT 0  -- 구독 시 월 지급 포인트
card_limit          INTEGER  -- null = 무제한
price_krw           INTEGER NOT NULL DEFAULT 0  -- 월 구독료 (원)
point_expire_days   INTEGER NOT NULL DEFAULT 90  -- 구독 포인트 유효일
features            TEXT  -- JSON: 활성화 기능 목록
updated_by          INTEGER
updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `payment_orders` — 결제 주문
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
order_no        TEXT NOT NULL UNIQUE  -- 주문번호 (METI-YYYYMMDD-XXXXXX)
user_id         INTEGER NOT NULL
wallet_id       INTEGER NOT NULL  -- 충전 대상 지갑
payment_type    TEXT NOT NULL  -- 'subscription' | 'point_purchase'
amount_krw      INTEGER NOT NULL  -- 결제 금액 (원)
points_to_add   INTEGER NOT NULL  -- 지급 예정 포인트
status          TEXT NOT NULL DEFAULT 'pending'
  -- 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'
pg_provider     TEXT  -- 'apple_iap' | 'google_iap' | 'toss' | 'kakao' | 'stripe'
pg_transaction_id TEXT  -- PG사 거래 ID
pg_raw          TEXT  -- PG 원본 응답 JSON
plan            TEXT  -- 구독 결제 시 플랜명
completed_at    DATETIME
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `subscriptions` — 구독 현황
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL UNIQUE
plan            TEXT NOT NULL
status          TEXT NOT NULL DEFAULT 'active'
  -- 'active' | 'cancelled' | 'expired' | 'past_due'
pg_provider     TEXT  -- 'apple_iap' | 'google_iap'
pg_subscription_id TEXT  -- PG사 구독 ID
current_period_start DATETIME
current_period_end   DATETIME
cancel_at_period_end INTEGER DEFAULT 0  -- 기간 말 해지 예약
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 5-2. 기존 테이블 변경

| 테이블 | 변경 내용 |
|-------|---------|
| `users` | `point_wallet_id` 제거 (wallet은 별도 조회) |
| `reward_balances` | **단계적 대체** → 신규 `point_wallets`로 마이그레이션 |
| `rewards` | **단계적 대체** → `point_transactions`로 통합 |
| `groups` | `point_wallet_id` 참조 추가 |

---

## 6. API 설계 (신규)

### 6-1. 포인트 지갑 API

```
GET  /api/v1/points/me              내 개인 지갑 잔액 + 최근 이력
GET  /api/v1/points/me/transactions 개인 포인트 이력 (페이지네이션)

GET  /api/v1/points/groups/:id      그룹 지갑 잔액 (그룹 관리자)
GET  /api/v1/points/groups/:id/transactions  그룹 포인트 이력

POST /api/v1/points/transfer        개인→그룹 포인트 이전 (그룹 관리자)
  body: { group_id, amount }
```

### 6-2. 결제 API

```
-- 구독 (인앱결제 영수증 검증)
POST /api/v1/payments/subscription/verify-apple   애플 영수증 검증
POST /api/v1/payments/subscription/verify-google  구글 영수증 검증

-- 단건 충전 (웹 전용 — 앱에서 호출 금지)
POST /api/v1/payments/charge/prepare     결제 준비 (주문번호 생성)
POST /api/v1/payments/charge/confirm     결제 완료 확인 (PG 웹훅 또는 프론트 콜백)
POST /api/v1/payments/webhook/:provider  PG사 웹훅 수신

-- 주문 조회
GET  /api/v1/payments/orders            내 결제 이력
GET  /api/v1/payments/orders/:orderNo   주문 상세
```

### 6-3. 포인트 차감 (기존 API 확장)

기존 API에 포인트 차감 로직 추가:

```
POST /api/v1/cards           명함 생성 시 한도 초과 → 개인 포인트 1,000P 차감
POST /api/v1/events          행사 개설 시 → 그룹 포인트 3,000P 차감
POST /api/v1/nfc/apply       NFC 카드 신청 → 개인 포인트 15,000~30,000P 차감
POST /api/v1/partner/use     파트너 서비스 이용 → 단가 조회 후 차감
```

### 6-4. 어드민 설정 API

```
GET  /api/v1/admin/point-prices           기능별 단가 목록
PATCH /api/v1/admin/point-prices/:feature  단가 변경

GET  /api/v1/admin/plan-configs           플랜별 설정 목록
PATCH /api/v1/admin/plan-configs/:plan     플랜 설정 변경

POST /api/v1/admin/points/grant           포인트 직접 지급 (프로모션용)
GET  /api/v1/admin/payments               전체 결제 이력
GET  /api/v1/admin/points/stats           포인트 현황 통계
```

---

## 7. 웹 사이트 구조 (사용자·그룹관리 웹)

> 현재 슈퍼어드민 웹(`/admin`)과 **별도 도메인** 권장  
> 예: `my.meti.io` 또는 `app.meti.io`

### 7-1. 사용자 웹 화면 구조

```
로그인
  ↓
역할 감지 → 대시보드 진입
  │
  ├── [공통] 개인 대시보드
  │     ├── 내 명함 관리
  │     ├── 내 그룹 목록
  │     ├── 포인트 잔액 및 이력
  │     └── 구독 현황
  │
  ├── [그룹 관리자 추가] 상단 "그룹 관리 전환" 버튼
  │     → 그룹 선택 드롭다운 (복수 그룹 관리 시)
  │     ├── 그룹 멤버 관리
  │     ├── 행사 관리
  │     ├── 그룹 포인트 충전/이력
  │     ├── 레슨 일정 / 출석
  │     └── 초대링크 관리
  │
  └── [단건 충전 전용]
        ├── 포인트 충전 (PG 결제)
        └── 결제 이력
```

### 7-2. 역할 전환 UX 상세

```
헤더 영역:
  [홍길동 ▼]  ←  클릭 시 드롭다운
    ├── 개인 계정
    ├── ─────────────
    ├── 한강수영클럽 (관리자)
    ├── 테니스동호회 (관리자)
    └── ─────────────
```

- 선택된 컨텍스트에 따라 사이드바 메뉴 전환
- 그룹 컨텍스트: 포인트 지갑이 그룹 지갑으로 전환
- 앱에서도 동일한 전환 UX 적용

---

## 8. 인앱결제 구현 가이드 (앱 개발팀)

### 8-1. 구독 상품 등록

| 상품 ID | 플랜 | 주기 |
|--------|------|------|
| `meti.pro.monthly` | pro | 1개월 |
| `meti.pro.yearly` | pro | 1년 (할인 적용) |
| `meti.business.monthly` | business | 1개월 |
| `meti.business.yearly` | business | 1년 |

### 8-2. 구독 처리 흐름

```
앱스토어/구글플레이 결제 완료
  ↓
앱 → 영수증/토큰 수신
  ↓
POST /api/v1/payments/subscription/verify-apple (또는 google)
  body: { receipt_data or purchase_token, plan }
  ↓
서버 → 스토어 서버에 영수증 검증 요청
  ↓
검증 성공 → subscriptions 테이블 업데이트
           → 구독 포인트 지급 (point_transactions)
           → users.plan 업데이트
  ↓
앱 → 구독 완료 화면
```

### 8-3. 앱 내 포인트 충전 금지 사항 (중요)

- ❌ "포인트 충전하기" 버튼 표시 금지
- ❌ "웹에서 충전하세요" 안내 문구 금지
- ❌ 외부 결제 URL 연결 금지
- ✅ 포인트 잔액 표시 가능
- ✅ "포인트가 부족합니다" 오류 메시지 표시 가능
- ✅ 구독 상품 구매 버튼 가능 (인앱결제만)

---

## 9. 파트너 서비스 연동 (포인트 사용)

> "포인트로 파트너 서비스 이용" — 전환이 아닌 **사용** 개념으로 추상화

### 9-1. 파트너 연동 방식
- METI 포인트 차감 → 파트너사 API 호출 → 파트너 서비스 제공
- METI가 파트너사에 정산 (포인트 ≠ 현금 직접 전환, B2B 정산)
- 예: METI 5,000P 차감 → 파트너 쿠폰 발급, 파트너 게임 아이템 지급 등

### 9-2. 파트너 단가 설정
- `point_prices` 테이블에 파트너별 feature 코드 추가
- 슈퍼어드민에서 파트너사별 단가 설정

---

## 10. 어드민 기능 확장 계획

### 현재 슈퍼어드민 `/admin`
- 전체 유저 관리
- 그룹 심사/승인
- 리워드 조회
- NFC 카드 관리

### 추가 예정 (슈퍼어드민)
- 포인트 단가 설정 (`/admin/point-prices`)
- 플랜 설정 (`/admin/plan-configs`)
- 결제 이력 조회 (`/admin/payments`)
- 포인트 현황 통계 (`/admin/points/stats`)
- 포인트 직접 지급 (`/admin/points/grant`)

### 사용자·그룹관리 웹 (신규 개발)
- 개인 대시보드 + 포인트 충전
- 그룹 관리자 전용 탭
- 역할 전환 UX

---

## 11. 구현 우선순위 (로드맵)

### Phase 1 — 백엔드 기반 (현재 진행 예정)
- [ ] DB 마이그레이션 0013: `point_wallets`, `point_transactions`, `point_prices`, `plan_configs`, `payment_orders`, `subscriptions`
- [ ] 포인트 지갑 API (`/api/v1/points/*`)
- [ ] 어드민 단가/플랜 설정 API
- [ ] 명함 생성 시 포인트 차감 연동
- [ ] 행사 개설 시 포인트 차감 연동

### Phase 2 — 결제 연동
- [ ] 인앱결제 영수증 검증 API (Apple/Google)
- [ ] PG사 선정 및 단건 충전 API

### Phase 3 — 사용자 웹 개발
- [ ] 개인 대시보드 (포인트 현황, 명함 관리)
- [ ] 그룹 관리자 탭 (역할 전환 UX)
- [ ] 포인트 단건 충전 (PG 연동)

### Phase 4 — 슈퍼어드민 확장
- [ ] 포인트 단가 설정 UI
- [ ] 결제/포인트 통계 대시보드

---

## 12. 미결 사항 (추후 결정)

| # | 항목 | 내용 |
|---|------|------|
| 1 | 구독료 확정 | pro/business 월 구독료 (원) |
| 2 | PG사 선정 | 토스페이먼츠 / 카카오페이 / Stripe 중 선택 |
| 3 | 포인트 충전 패키지 | 단건 충전 시 금액 패키지 구성 (예: 5,000P / 10,000P / 50,000P) |
| 4 | 그룹 포인트 충전 주체 | 그룹 관리자 개인 결제 vs 그룹 법인카드 결제 |
| 5 | 구독 연간 할인율 | 연간 구독 시 할인율 결정 |
| 6 | 포인트 환불 정책 | 미사용 포인트 환불 가능 여부 (전자상거래법 검토 필요) |
| 7 | 사용자 웹 도메인 | `my.meti.io` 등 결정 |

---

*METI Product Spec v1.0 — 2026-05-05*
