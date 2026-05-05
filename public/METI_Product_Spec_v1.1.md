# METI 서비스 기획서 v1.1

> **작성일**: 2026-05-05  
> **이전 버전**: v1.0 (포인트 시스템 초안)  
> **변경 내용**: 기존 DB 테이블(0007~0008) 충돌 해결, 마이그레이션 전략 확정, 웹 역할 분기 UX 구체화  
> **다음 단계**: 기획 확정 → DB 마이그레이션 0013 작성 → API 코드 구현

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
| 사용자·그룹관리 웹 (별도 도메인 예: `my.meti.io`) | 개인 사용자 + 그룹 관리자 | **미개발 (예정)** |

---

## 2. 사용자 역할 체계

### 2-1. 역할 정의

| 역할 | 설명 | 접속 채널 |
|------|------|---------|
| `user` | 일반 회원 | 앱 + 사용자 웹 |
| `group_admin` | 그룹 관리자 (group_members.role = 'admin') | 앱 + 사용자 웹 (그룹 관리 탭) |
| `super_admin` | METI 운영팀 (users.role = 'super_admin') | 슈퍼어드민 웹 (`/admin`) |

> **중요**: `group_admin`은 별도 계정이 아닙니다.  
> 일반 `user`가 특정 그룹의 admin 멤버이면 해당 그룹의 **그룹 관리 탭으로 전환** 가능.  
> 한 사람이 여러 그룹을 관리할 수 있으며, 그룹별로 독립된 컨텍스트 전환.

### 2-2. 역할별 접근 가능 기능

| 기능 | user | group_admin | super_admin |
|------|:----:|:-----------:|:-----------:|
| 명함 생성/관리 | ✅ | ✅ | - |
| 그룹 가입/탈퇴 | ✅ | ✅ | - |
| 그룹 멤버 관리 | - | ✅ | - |
| 행사 개설 | - | ✅ | ✅ (직접 생성) |
| 개인 포인트 잔액 조회 | ✅ | ✅ | - |
| 개인 포인트 충전 (웹) | ✅ | ✅ | - |
| 개인 → 그룹 포인트 이전 | - | ✅ | - |
| 그룹 포인트 잔액/이력 조회 | - | ✅ | - |
| 그룹 포인트 충전 (웹) | - | ✅ | - |
| 구독 가입/해지 (인앱) | ✅ | ✅ | - |
| 전체 사용자 관리 | - | - | ✅ |
| 그룹 심사/승인 | - | - | ✅ |
| 포인트 단가 설정 | - | - | ✅ |
| 플랜별 포인트·한도 설정 | - | - | ✅ |
| 포인트 직접 지급 | - | - | ✅ |

### 2-3. 웹 로그인 후 화면 분기

```
로그인
  ↓
JWT 디코드 → users.role 확인
  ├── super_admin  → 슈퍼어드민 대시보드 (/admin/dashboard)
  └── 그 외        → 사용자 웹 진입
                        ↓
                     group_members 조회 → admin 그룹 존재 여부 확인
                        ├── 없음  → 개인 대시보드만 표시
                        └── 있음  → 개인 대시보드 + [그룹 관리] 전환 메뉴 표시
```

**그룹 관리자 전환 UX (헤더 드롭다운):**
```
[홍길동 ▼]  ←  클릭
  ├── 👤 개인 계정
  ├── ────────────
  ├── 🏊 한강수영클럽 (관리자)
  ├── 🎾 테니스동호회 (관리자)
  └── ────────────
```
- 선택된 컨텍스트에 따라 사이드바 메뉴 전환
- 그룹 컨텍스트: 포인트 지갑 → 그룹 지갑으로 자동 전환
- 앱에서도 동일한 전환 UX 적용

---

## 3. 플랜 정책

### 3-1. 개인 플랜 정의

| 플랜 | 월 구독료 | 구독 지급 포인트 | 명함 한도 | 그룹 기능 | 그룹 관리 기능 |
|------|---------|--------------|---------|---------|------------|
| `free` | 0원 | 0 P | 3개 | 가입만 가능 | ❌ |
| `pro` | 미정 | 10,000 P | 10개 | 생성·운영 가능 | ❌ |
| `business` | 미정 | 500,000 P | 무제한 | 생성·운영 가능 | ✅ (멤버통계, 행사대량초대, 출석리포트 등) |

> - 구독료·지급 포인트·한도는 **슈퍼어드민 `plan_configs` 테이블에서 변경 가능**
> - `business` 그룹 관리 기능 = METI 슈퍼어드민 기능과 완전히 별개

### 3-2. 구독 포인트 유효기간 정책 (권장, 추후 변경 가능)

| 포인트 종류 | 유효기간 | 비고 |
|-----------|--------|------|
| 구독 지급 포인트 | **90일** | 매월 갱신 시 리셋 (미사용분 소멸 권장) |
| 단건 충전 포인트 | **365일** | 충전 시점부터 1년 |
| 관리자 지급 포인트 | 관리자 설정 | 이벤트·프로모션용 |

> ※ 만료 7일 전 앱 푸시 알림 발송 권장

---

## 4. 포인트 시스템

### 4-1. 포인트 기본 원칙

- **1P = 1원** (고정)
- 포인트는 **개인 지갑**과 **그룹 지갑** 별도 운영
- 개인 포인트 → 그룹 포인트 이전 **가능** (그룹 관리자만)
- 그룹 포인트 → 개인 포인트 역이전 **불가** (환불 악용 방지)
- 포인트는 현금으로 직접 전환 불가 (파트너 서비스 **이용** 개념)

### 4-2. 포인트 소유 주체

```
개인 지갑 (point_wallets WHERE owner_type = 'user')
  └── 사용처: 명함 추가 생성, NFC 카드 발급, 파트너 서비스 이용

그룹 지갑 (point_wallets WHERE owner_type = 'group')
  └── 사용처: 행사 개설, 프리미엄 초대링크, 레슨 기능 확장
```

### 4-3. 포인트 사용처 및 단가

| feature 코드 | 사용처 | 차감 대상 | 기본 단가 | 어드민 변경 |
|-------------|-------|---------|---------|----------|
| `card_extra` | 명함 추가 생성 (한도 초과 1개당) | 개인 | **1,000 P** | ✅ |
| `group_create` | 그룹 생성 | 개인 | **0 P (무료)** | ✅ |
| `event_create` | 행사 개설 | 그룹 | **3,000 P** | ✅ |
| `nfc_basic` | NFC 실물카드 발급 (기본형) | 개인 | **15,000 P** | ✅ |
| `nfc_premium` | NFC 실물카드 발급 (프리미엄) | 개인 | **30,000 P** | ✅ |
| `partner_*` | 파트너 서비스 이용 | 개인/그룹 | 파트너사별 설정 | ✅ |

> 단가는 `point_prices` 테이블에 저장, 슈퍼어드민 웹에서 실시간 변경

### 4-4. 포인트 충전 방식

#### A. 구독 자동 지급 (인앱결제)
```
사용자 플랜 구독 (앱스토어/구글플레이) → 영수증 서버 검증
  → subscriptions 테이블 생성/갱신
  → 구독 포인트 자동 지급 (point_transactions type='charge_subscription')
  → 개인 지갑 잔액 업데이트
```
- 플랫폼: 앱스토어 인앱결제 / 구글플레이 인앱결제
- 앱 내에서만 구독 가입/해지 가능 (인앱결제 정책 준수)

#### B. 단건 포인트 충전 (웹 전용)
```
사용자 웹 접속 → 충전 금액 선택 → PG사 결제 창
  → 결제 완료 웹훅 수신
  → payment_orders 상태 'completed' 업데이트
  → point_transactions type='charge_purchase' 생성
  → 개인/그룹 지갑 잔액 업데이트
```
- PG사: 미정 (토스페이먼츠, 카카오페이, Stripe 중 선택)
- **앱 내에서는 단건 충전 버튼·문구·외부 링크 일절 표시 금지** (Apple/Google 정책 — Netflix 방식)

#### C. 그룹 포인트 충전
```
방법 1: 그룹 관리자 → 사용자 웹(그룹 관리 탭) → PG 결제 → 그룹 지갑 적립
방법 2: 그룹 관리자 → 개인 지갑에서 그룹 지갑으로 이전 (POST /api/v1/points/transfer)
```

### 4-5. 포인트 차감 흐름

```
사용자가 유료 기능 요청
  ↓
point_prices에서 feature 단가 조회
  ↓
point_wallets 잔액 확인
  ├── 잔액 ≥ 단가
  │     → 트랜잭션 시작
  │     → point_wallets.balance -= amount
  │     → point_transactions 이력 기록
  │     → 기능 실행
  │     → 트랜잭션 커밋
  └── 잔액 < 단가
        → 부족 금액 계산
        → 오류 응답 { error: 'insufficient_points', required: N, current: M, short: N-M }
        → 앱: "포인트가 부족합니다" 메시지 표시
        → 웹: 충전 페이지로 이동 유도
```

---

## 5. DB 설계

### 5-1. 기존 테이블 처리 전략 (마이그레이션 0013)

> 0007, 0008에서 생성된 테이블들과의 충돌을 아래와 같이 해결합니다.

| 기존 테이블 | 신규 대체 | 처리 방법 |
|-----------|---------|---------|
| `reward_balances` | `point_wallets` | **단계적 대체**: 신규 코드는 point_wallets 사용. reward_balances는 당분간 유지 후 추후 제거 |
| `rewards` | `point_transactions` | **단계적 대체**: 신규 코드는 point_transactions 사용 |
| `plans` | `plan_configs` | **확장 대체**: plans 테이블에 포인트 관련 컬럼 추가 (plan_configs로 역할 통합) |
| `subscriptions` | (확장) | **컬럼 추가**: pg_provider, pg_subscription_id, current_period_start/end 컬럼 추가 |
| `payments` | `payment_orders` | **확장 대체**: payments 테이블에 points_to_add, wallet_id 컬럼 추가 |

### 5-2. 신규 테이블 DDL

#### `point_wallets` — 포인트 지갑

```sql
CREATE TABLE IF NOT EXISTS point_wallets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type      TEXT    NOT NULL CHECK(owner_type IN ('user','group')),
  owner_id        INTEGER NOT NULL,   -- users.id 또는 groups.id
  balance         INTEGER NOT NULL DEFAULT 0,
  total_charged   INTEGER NOT NULL DEFAULT 0,  -- 누적 충전 (P)
  total_used      INTEGER NOT NULL DEFAULT 0,  -- 누적 사용 (P)
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id)
);
```

#### `point_transactions` — 포인트 이력

```sql
CREATE TABLE IF NOT EXISTS point_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id       INTEGER NOT NULL REFERENCES point_wallets(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL,
  /*
    충전 계열:
      charge_subscription  구독 자동 지급
      charge_purchase      단건 충전 (웹 결제)
      charge_admin         관리자 직접 지급 (프로모션)
      charge_transfer_in   개인→그룹 이전 (수신 측)
    차감 계열:
      use_card_extra        명함 추가 생성
      use_event_create      행사 개설
      use_nfc_card          NFC 카드 발급
      use_partner           파트너 서비스 이용
      use_transfer_out      개인→그룹 이전 (송신 측)
    소멸:
      expire                유효기간 만료 소멸
  */
  amount          INTEGER NOT NULL,   -- 양수: 충전, 음수: 차감
  balance_after   INTEGER NOT NULL,   -- 거래 후 잔액
  ref_type        TEXT,               -- 'card'|'event'|'nfc_order'|'payment_order'|'subscription'
  ref_id          INTEGER,            -- 연관 대상 ID
  description     TEXT,
  expires_at      DATETIME,           -- 이 포인트의 유효기한 (NULL = 무제한)
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `point_prices` — 기능별 포인트 단가

```sql
CREATE TABLE IF NOT EXISTS point_prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feature     TEXT    NOT NULL UNIQUE,
  /*
    card_extra      명함 추가 1개당
    group_create    그룹 생성
    event_create    행사 개설
    nfc_basic       NFC 기본형
    nfc_premium     NFC 프리미엄
    partner_*       파트너별 feature 코드
  */
  price       INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 단가 데이터
INSERT OR IGNORE INTO point_prices (feature, price, description) VALUES
  ('card_extra',    1000,  '명함 추가 생성 (한도 초과 1개당)'),
  ('group_create',     0,  '그룹 생성 (무료)'),
  ('event_create',  3000,  '행사 개설'),
  ('nfc_basic',    15000,  'NFC 실물카드 발급 - 기본형'),
  ('nfc_premium',  30000,  'NFC 실물카드 발급 - 프리미엄');
```

#### `plan_configs` — 플랜별 설정 (plans 테이블 확장)

> 기존 `plans` 테이블에 아래 컬럼을 추가 (ALTER TABLE)하여 통합합니다.

```sql
-- plans 테이블에 추가할 컬럼 (migration 0013에서 ALTER TABLE로 추가)
ALTER TABLE plans ADD COLUMN monthly_points     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN point_expire_days  INTEGER NOT NULL DEFAULT 90;
ALTER TABLE plans ADD COLUMN updated_by         INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 기본값 UPDATE
UPDATE plans SET monthly_points = 0       WHERE code = 'free';
UPDATE plans SET monthly_points = 10000   WHERE code = 'pro';
UPDATE plans SET monthly_points = 500000  WHERE code = 'business';
```

#### `payment_orders` — 결제 주문 (payments 테이블 확장)

> 기존 `payments` 테이블에 포인트 충전 관련 컬럼을 추가합니다.

```sql
-- payments 테이블에 추가할 컬럼 (migration 0013에서 ALTER TABLE로 추가)
ALTER TABLE payments ADD COLUMN order_no       TEXT;    -- 주문번호 METI-YYYYMMDD-XXXXXX
ALTER TABLE payments ADD COLUMN wallet_id      INTEGER REFERENCES point_wallets(id);
ALTER TABLE payments ADD COLUMN payment_type   TEXT DEFAULT 'subscription'; -- 'subscription'|'point_purchase'
ALTER TABLE payments ADD COLUMN points_to_add  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN pg_provider    TEXT;   -- 'apple_iap'|'google_iap'|'toss'|'kakao'|'stripe'
ALTER TABLE payments ADD COLUMN pg_raw         TEXT;   -- PG 원본 응답 JSON
ALTER TABLE payments ADD COLUMN plan           TEXT;   -- 구독 결제 시 플랜명
```

#### `subscriptions` 테이블 확장

```sql
-- subscriptions 테이블에 추가할 컬럼 (migration 0013)
ALTER TABLE subscriptions ADD COLUMN pg_provider           TEXT;  -- 'apple_iap'|'google_iap'
ALTER TABLE subscriptions ADD COLUMN pg_subscription_id    TEXT;  -- PG사 구독 ID
ALTER TABLE subscriptions ADD COLUMN current_period_start  DATETIME;
ALTER TABLE subscriptions ADD COLUMN current_period_end    DATETIME;
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end  INTEGER DEFAULT 0;
```

### 5-3. 인덱스

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_wallets_owner ON point_wallets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_point_wallets_owner_id    ON point_wallets(owner_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_wallet ON point_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type   ON point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_ref    ON point_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_no         ON payments(order_no);
CREATE INDEX IF NOT EXISTS idx_payments_wallet_id        ON payments(wallet_id);
```

---

## 6. API 설계

### 6-1. 포인트 지갑 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/points/me` | Bearer | 내 개인 지갑 잔액 + 최근 이력 5건 |
| GET | `/api/v1/points/me/transactions` | Bearer | 개인 포인트 이력 (페이지네이션) |
| GET | `/api/v1/points/groups/:id` | Bearer + group_admin | 그룹 지갑 잔액 |
| GET | `/api/v1/points/groups/:id/transactions` | Bearer + group_admin | 그룹 포인트 이력 |
| POST | `/api/v1/points/transfer` | Bearer + group_admin | 개인 → 그룹 포인트 이전 |

**POST /api/v1/points/transfer 요청 body:**
```json
{
  "group_id": 123,
  "amount": 5000
}
```

### 6-2. 결제 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/payments/subscription/verify-apple` | Bearer | 애플 인앱결제 영수증 검증 |
| POST | `/api/v1/payments/subscription/verify-google` | Bearer | 구글 인앱결제 영수증 검증 |
| POST | `/api/v1/payments/charge/prepare` | Bearer | 단건 충전 주문 생성 (웹 전용) |
| POST | `/api/v1/payments/charge/confirm` | Bearer | 결제 완료 확인 (PG 콜백) |
| POST | `/api/v1/payments/webhook/:provider` | PG 서명 | PG사 웹훅 수신 (서버→서버) |
| GET | `/api/v1/payments/orders` | Bearer | 내 결제 이력 |
| GET | `/api/v1/payments/orders/:orderNo` | Bearer | 주문 상세 |

**POST /api/v1/payments/charge/prepare 요청 body:**
```json
{
  "amount_krw": 10000,
  "wallet_type": "user",
  "group_id": null
}
```

**POST /api/v1/payments/subscription/verify-apple 요청 body:**
```json
{
  "receipt_data": "...",
  "plan": "pro"
}
```

### 6-3. 기존 API 포인트 차감 확장

기존 API에 포인트 차감 로직 추가 (코드 수정):

| API | 차감 시점 | 차감 지갑 | feature |
|-----|---------|---------|---------|
| `POST /api/v1/cards` | 플랜 한도 초과 시 | 개인 | `card_extra` |
| `POST /api/v1/events` | 행사 생성 성공 시 | 그룹 | `event_create` |
| `POST /api/v1/nfc/apply` | NFC 신청 접수 시 | 개인 | `nfc_basic` 또는 `nfc_premium` |
| `POST /api/v1/partner/use` | 파트너 서비스 이용 시 | 개인/그룹 | `partner_*` |

### 6-4. 어드민 설정 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/admin/point-prices` | 기능별 단가 전체 목록 |
| PATCH | `/api/v1/admin/point-prices/:feature` | 단가 변경 |
| GET | `/api/v1/admin/plan-configs` | 플랜별 설정 전체 목록 |
| PATCH | `/api/v1/admin/plan-configs/:plan` | 플랜 설정 변경 (monthly_points, card_limit 등) |
| POST | `/api/v1/admin/points/grant` | 포인트 직접 지급 (프로모션) |
| GET | `/api/v1/admin/payments` | 전체 결제 이력 |
| GET | `/api/v1/admin/points/stats` | 포인트 현황 통계 |

**PATCH /api/v1/admin/point-prices/:feature 요청 body:**
```json
{
  "price": 1500,
  "description": "명함 추가 생성"
}
```

**POST /api/v1/admin/points/grant 요청 body:**
```json
{
  "owner_type": "user",
  "owner_id": 42,
  "amount": 5000,
  "description": "5월 이벤트 당첨 보상",
  "expires_at": "2026-08-05"
}
```

---

## 7. 웹 사이트 구조 (사용자·그룹관리 웹)

> 현재 슈퍼어드민 웹(`/admin`)과 **별도 도메인** 권장  
> 예: `my.meti.io` (도메인 미결정)

### 7-1. 사이드바 메뉴 구조

**개인 컨텍스트:**
```
📇 내 명함
  ├── 명함 목록
  └── 명함 추가
👥 내 그룹
  └── 가입 그룹 목록
💰 포인트
  ├── 잔액 현황
  ├── 충전하기 (웹 PG 결제)
  └── 포인트 이력
💳 구독
  └── 현재 플랜 / 업그레이드 안내
```

**그룹 관리 컨텍스트 (group_admin 전환 시):**
```
📋 그룹 개요
  └── 정보 수정, 포인트 잔액
👤 멤버 관리
  ├── 멤버 목록 / 승인
  └── 초대링크 관리
📅 행사 관리
  ├── 행사 목록
  └── 행사 생성
📓 레슨 관리
  ├── 일정 관리
  └── 출석 현황
💰 그룹 포인트
  ├── 잔액 현황
  ├── 충전하기
  └── 이력
```

### 7-2. 포인트 충전 페이지 UX

```
[충전 금액 선택]
  ○ 5,000P   (5,000원)
  ○ 10,000P  (10,000원)
  ○ 30,000P  (30,000원)   ← 패키지 구성 미정, 추후 확정
  ○ 직접 입력: [___] P

[충전 대상]
  ● 내 개인 포인트
  ○ [그룹명] 포인트 (group_admin인 경우만 표시)

[결제 수단]
  ○ 신용카드 (Toss / Kakao / Stripe — PG사 미정)
  ○ 카카오페이
  ○ 토스페이

[결제하기 버튼]
```

---

## 8. 인앱결제 구현 가이드 (앱 개발팀)

### 8-1. 구독 상품 등록 (스토어에 등록할 상품 ID)

| 상품 ID | 플랜 | 주기 |
|--------|------|------|
| `meti.pro.monthly` | pro | 1개월 |
| `meti.pro.yearly` | pro | 1년 |
| `meti.business.monthly` | business | 1개월 |
| `meti.business.yearly` | business | 1년 |

### 8-2. 구독 처리 흐름 (앱 ↔ 서버)

```
1. 앱 → 스토어 결제 완료
2. 앱 → 영수증/구매토큰 수신
3. 앱 → POST /api/v1/payments/subscription/verify-apple
         body: { receipt_data, plan }
4. 서버 → 애플 검증 서버에 영수증 검증 요청
5. 검증 성공 →
   - subscriptions 테이블 생성/갱신
   - payments 테이블 이력 기록
   - 구독 포인트 지급 (point_transactions type='charge_subscription')
   - users.plan 업데이트
   - point_wallets.balance 업데이트
6. 앱 → 구독 완료 화면 표시
```

### 8-3. 앱 내 포인트 충전 금지 사항 (Apple/Google 정책)

| 항목 | 허용 여부 |
|------|---------|
| "포인트 충전하기" 버튼 | ❌ 금지 |
| "웹에서 충전하세요" 문구 | ❌ 금지 |
| 외부 결제 URL 연결/표시 | ❌ 금지 |
| 포인트 잔액 표시 | ✅ 허용 |
| "포인트가 부족합니다" 오류 메시지 | ✅ 허용 |
| 인앱결제 구독 상품 구매 버튼 | ✅ 허용 |

---

## 9. 파트너 서비스 연동 (포인트 사용 개념)

### 9-1. 연동 정책
- METI 포인트 **차감** → 파트너사 API 호출 → 파트너 서비스 제공
- 포인트 ≠ 현금 전환 (B2B 정산 방식, METI ↔ 파트너사 별도 계약)
- 초기: "파트너 서비스 이용권 구매" 수준으로 추상화

### 9-2. 파트너 단가 설정
- `point_prices` 테이블에 `partner_{partner_id}_{service_code}` 형식으로 feature 추가
- 슈퍼어드민에서 파트너사별 단가 설정

### 9-3. 파트너 연동 흐름 (예시)
```
앱 → POST /api/v1/partner/use
  body: { partner_id, service_code, ... }
  ↓
서버 → point_prices에서 해당 파트너 단가 조회
  → point_wallets 잔액 확인
  → 포인트 차감
  → partner_services API 호출 (쿠폰 발급, 아이템 지급 등)
  → partner_reward_events 이력 기록
```

---

## 10. 어드민 기능 확장 계획

### 현재 슈퍼어드민 `/admin` (기존)
- 전체 유저 관리
- 그룹 심사/승인
- 리워드 조회
- NFC 카드 관리
- 파트너 등록

### 추가 예정 — 슈퍼어드민 확장
| 메뉴 | 경로 | 기능 |
|------|------|------|
| 포인트 단가 설정 | `/admin/point-prices` | feature별 단가 조회/수정 |
| 플랜 설정 | `/admin/plan-configs` | 플랜별 포인트·한도·구독료 조회/수정 |
| 결제 이력 | `/admin/payments` | 전체 결제 내역 조회 |
| 포인트 통계 | `/admin/points/stats` | 총 충전/사용/잔액 현황 |
| 포인트 직접 지급 | `/admin/points/grant` | 프로모션·이벤트 지급 |

### 사용자·그룹관리 웹 (신규 개발)
- 개인 대시보드 + 포인트 충전 (PG 연동)
- 그룹 관리자 전용 탭 + 역할 전환 UX
- 구독 현황 확인 (앱에서 가입, 웹에서 조회만 가능)

---

## 11. 구현 로드맵

### Phase 1 — 백엔드 기반 (우선 진행)
- [ ] **마이그레이션 0013**: `point_wallets`, `point_transactions`, `point_prices` 신규 생성 + 기존 테이블 컬럼 확장
- [ ] **포인트 지갑 API** (`/api/v1/points/*`)
- [ ] **어드민 단가/플랜 설정 API** 및 슈퍼어드민 UI
- [ ] **명함 생성 포인트 차감** 연동 (`cards.ts` 수정)
- [ ] **행사 개설 포인트 차감** 연동 (`events.ts` 수정)
- [ ] 신규 가입 시 `point_wallets` 자동 생성 (auth.ts 수정)

### Phase 2 — 결제 연동
- [ ] 인앱결제 영수증 검증 API (Apple/Google Sandbox 테스트)
- [ ] PG사 선정 및 단건 충전 API
- [ ] 웹훅 수신 및 멱등성 처리

### Phase 3 — 사용자 웹 개발
- [ ] 개인 대시보드 (포인트 현황, 명함 관리, 구독 조회)
- [ ] 그룹 관리자 탭 (역할 전환 UX, 그룹 포인트 관리)
- [ ] 포인트 단건 충전 (PG 연동)

### Phase 4 — 슈퍼어드민 확장
- [ ] 포인트 단가 설정 UI
- [ ] 결제/포인트 통계 대시보드

---

## 12. 미결 사항

| # | 항목 | 내용 | 우선순위 |
|---|------|------|--------|
| 1 | 구독료 확정 | pro/business 월 구독료 (원) | Phase 2 전 |
| 2 | PG사 선정 | 토스페이먼츠 / 카카오페이 / Stripe | Phase 2 전 |
| 3 | 포인트 충전 패키지 | 단건 충전 금액 패키지 구성 | Phase 3 전 |
| 4 | 사용자 웹 도메인 | `my.meti.io` 등 결정 | Phase 3 전 |
| 5 | 구독 연간 할인율 | 연간 구독 시 할인율 결정 | Phase 2 전 |
| 6 | 포인트 환불 정책 | 미사용 포인트 환불 여부 (전자상거래법 검토) | Phase 2 전 |
| 7 | 그룹 포인트 충전 주체 | 그룹 관리자 개인 결제 vs 법인카드 결제 | Phase 3 전 |

---

## 13. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-05 | 포인트 시스템 초안 작성 |
| v1.1 | 2026-05-05 | 기존 DB 충돌 해결 (plans→확장, payments→확장, subscriptions→확장), 역할 전환 UX 구체화, API 표 형식 정리, 로드맵 Phase 구분 |

---

*METI Product Spec v1.1 — 2026-05-05*
