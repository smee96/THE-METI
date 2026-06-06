# METI 서비스 기획서 v1.3

> **작성일**: 2026-05-05  
> **이전 버전**: v1.2 (웹 URL 구조 확정, 다중 그룹 관리 UX)  
> **변경 내용**:  
> - **플랜 정책 개편**: 기능 제한 → 그룹 최대 멤버수로 차등화  
> - Free / Pro / Business 모두 그룹 생성·운영·관리 기능 동일 제공  
> - 차이점은 오직 **그룹당 최대 멤버 수** (Free: 2명, Pro: 10명, Business: 무제한)  
> - 슈퍼어드민에서 플랜별 멤버 한도 조정 가능 (`plan_configs` UI)  
> - 마이그레이션 0013에 `plans.max_group_members` 컬럼 추가 반영  
> **다음 단계**: Phase 1 — 마이그레이션 0013 + 포인트 API 구현

---

## 1. 서비스 개요

**METI**는 디지털 명함 기반 소셜 네트워크 플랫폼입니다.

### 핵심 가치
- 개인/단체의 디지털 명함 생성 및 QR·NFC 기반 교환
- 그룹(협회·클럽·레슨 등) 운영 및 행사 관리
- 포인트 기반 유료 기능 이용 (명함 추가, 행사 개설, NFC 카드 발급 등)

### 접속 채널

| 채널 | 대상 | URL | 상태 |
|------|------|-----|------|
| 네이티브 앱 (iOS/Android) | 일반 사용자 | — | 개발 중 |
| 슈퍼어드민 웹 | METI 운영팀 | `/admin` | ✅ 운영 중 |
| 사용자·그룹관리 웹 | 개인 사용자 + 그룹 관리자 | `/app/*` | ✅ 구조 완성 |
| 명함 공개 페이지 | 앱 미설치자 | `/card/:id` | ✅ 운영 중 |

---

## 2. 사용자 역할 체계

### 2-1. 역할 정의

| 역할 | 설명 | 접속 채널 |
|------|------|---------|
| `user` | 일반 회원 | 앱 + `/app/*` |
| `group_admin` | 그룹 관리자 (`group_members.role = 'admin'`) | 앱 + `/app/*` + `/app/group/:id/*` |
| `super_admin` | METI 운영팀 (`users.role = 'super_admin'`) | `/admin/*` |

> **중요**: `group_admin`은 별도 계정이 아닙니다.  
> 일반 `user`가 특정 그룹의 admin 멤버이면 해당 그룹의 **그룹 관리 탭으로 전환** 가능.  
> 한 사람이 **여러 그룹을 동시에 관리 가능** — 그룹별로 독립된 컨텍스트 전환.

### 2-2. 역할별 접근 가능 기능

| 기능 | user | group_admin | super_admin |
|------|:----:|:-----------:|:-----------:|
| 명함 생성/관리 | ✅ | ✅ | — |
| 그룹 가입/탈퇴 | ✅ | ✅ | — |
| **그룹 생성** | ✅ | ✅ | ✅ |
| **그룹 멤버 관리** | ✅ | ✅ | — |
| **행사 개설** | ✅ | ✅ | ✅ |
| 개인 포인트 잔액 조회 | ✅ | ✅ | — |
| 개인 포인트 충전 (웹) | ✅ | ✅ | — |
| 개인 → 그룹 포인트 이전 | — | ✅ | — |
| 그룹 포인트 잔액/이력 조회 | — | ✅ | — |
| 그룹 포인트 충전 (웹) | — | ✅ | — |
| 구독 가입/해지 (인앱) | ✅ | ✅ | — |
| 전체 사용자 관리 | — | — | ✅ |
| 그룹 심사/승인 | — | — | ✅ |
| 포인트 단가 설정 | — | — | ✅ |
| 플랜별 포인트·한도 설정 | — | — | ✅ |
| 포인트 직접 지급 | — | — | ✅ |

> **Note**: 그룹 생성·멤버 관리·행사 개설은 모든 플랜 공통 제공.  
> 플랜별 차이는 **그룹당 최대 멤버 수**로만 구분됩니다.

### 2-3. 웹 로그인 후 화면 분기 로직

```
POST /api/v1/auth/login
  ↓
JWT 발급 → 클라이언트 localStorage 저장
  ↓
JWT 디코드 → users.role 확인
  ├── super_admin  → /admin/dashboard  (슈퍼어드민 전용)
  └── 그 외        → /app/dashboard    (사용자 웹)
                        ↓
                     group_members 조회 → admin 그룹 존재 여부 확인
                        ├── 없음  → 개인 대시보드만 표시
                        └── 있음  → 헤더에 그룹 전환 드롭다운 표시
```

**그룹 관리자 전환 UX (헤더 드롭다운):**
```
[홍길동 ▼]  ←  클릭
  ├── 👤 개인 계정               → /app/dashboard
  ├── ────────────
  ├── 🏊 한강수영클럽 (관리자)    → /app/group/1/dashboard
  ├── 🎾 테니스동호회 (관리자)    → /app/group/2/dashboard
  └── ────────────
      ➕ 그룹 목록 보기           → /app/groups
```
- 선택된 컨텍스트에 따라 사이드바 메뉴 전환
- 그룹 컨텍스트: 포인트 지갑 → 그룹 지갑으로 자동 전환
- 앱에서도 동일한 전환 UX 적용

---

## 3. 웹 URL 구조 (확정)

### 3-1. 전체 URL 맵

```
/                           → /app/login 으로 리다이렉트
/app/login                  로그인 (공통 진입점)
/app/register               회원가입

/app/dashboard              개인 대시보드
  └─ 내 명함 요약, 소속 그룹, 포인트 잔액, 구독 플랜

/app/cards                  내 명함 관리 (목록·추가·수정·삭제)
/app/groups                 내 그룹 목록 (가입된 전체 그룹)
  └─ 그룹별 역할 표시 (일반/관리자)
  └─ 관리자인 그룹 → [그룹 관리] 버튼
/app/points                 개인 포인트 (잔액·충전·이력)
/app/subscription           구독 현황 (현재 플랜·앱에서 변경 안내)

/app/group/:id/dashboard    그룹 대시보드 (관리자 전용)
/app/group/:id/members      멤버 관리 (목록·승인·역할 변경)
/app/group/:id/events       행사 관리 (목록·생성·수정)
/app/group/:id/points       그룹 포인트 (잔액·충전·이전·이력)
/app/group/:id/lessons      레슨 관리 (일정·출석)
/app/group/:id/invites      초대링크 관리 (생성·비활성화)

/admin                      슈퍼어드민 로그인
/admin/*                    슈퍼어드민 대시보드 SPA
  └─ /admin/users           사용자 관리
  └─ /admin/groups          그룹 관리
  └─ /admin/events          행사 관리
  └─ /admin/nfc             NFC 카드 관리
  └─ /admin/partners        파트너 관리
  └─ /admin/plan-configs    플랜 설정 ✅ (멤버수·포인트·명함 한도)
  └─ /admin/point-prices    포인트 단가 설정 (예정)
  └─ /admin/payments        결제 이력 (예정)
  └─ /admin/points/stats    포인트 통계 (예정)

/card/:id                   명함 공개 페이지 (앱 미설치자용)
/health                     헬스체크 (JSON)
```

### 3-2. 경로 보호 정책

| 경로 | 접근 조건 |
|------|---------|
| `/app/login`, `/app/register` | 누구나 (미로그인 시) |
| `/app/*` | JWT 필요 (없으면 `/app/login` 리다이렉트) |
| `/app/group/:id/*` | JWT + 해당 그룹 `group_members.role = 'admin'` |
| `/admin` | 누구나 (로그인 폼) |
| `/admin/*` | JWT + `users.role = 'super_admin'` |
| `/card/:id` | 누구나 (공개) |
| `/health` | 누구나 (공개) |

### 3-3. 슈퍼어드민 vs 그룹관리자 완전 분리

| 항목 | 슈퍼어드민 (`/admin`) | 그룹관리자 (`/app/group/:id/*`) |
|------|---------------------|-------------------------------|
| 계정 종류 | `users.role = 'super_admin'` | 일반 user (group_members.role = 'admin') |
| 접근 URL | `/admin/*` | `/app/group/:id/*` |
| HTML 파일 | `src/web/admin.ts` | `src/web/app.ts` |
| JS 파일 | `public/static/admin.js` | `public/static/app.js` |
| 주요 기능 | 시스템 전체 관리 | 자신이 관리하는 그룹만 |
| 포인트 관리 | 단가 설정·직접지급·통계 | 그룹 지갑 충전·이력 조회 |

---

## 4. 플랜 정책 ★ v1.3 개편

### 4-1. 개인 플랜 정의

> **핵심 원칙**: 기능은 모든 플랜 동일, **차이는 그룹당 최대 멤버 수**만으로 구분

| 플랜 | 월 구독료 | 구독 지급 포인트 | 명함 한도 | 그룹 생성·운영 | 그룹 멤버 관리 | **그룹 최대 멤버 수** |
|------|---------|--------------|---------|:---:|:---:|:---:|
| `free` | 0원 | 0 P | 3개 | ✅ | ✅ | **2명** |
| `pro` | 미정 | 10,000 P | 10개 | ✅ | ✅ | **10명** |
| `business` | 미정 | 500,000 P | 무제한 | ✅ | ✅ | **무제한** |

> - 모든 플랜에서 그룹 생성 신청, 멤버 승인/거절/강퇴, 공지사항, 초대링크, 행사 개설, 레슨 관리 동일하게 사용 가능  
> - 구독료·지급 포인트·명함 한도·**그룹 최대 멤버 수**는 **슈퍼어드민 `plans` 테이블에서 변경 가능**  
> - `NULL` = 무제한 (business 기본값)

### 4-2. 플랜별 차등화 전략 (프리미엄 유도)

```
Free 사용자가 그룹을 만들어 2명을 초대 → 3번째 멤버 초대 시도
  ↓
API 응답: { error_code: 'plan_member_limit_reached', current: 2, limit: 2, upgrade_required: true }
  ↓
앱/웹: "멤버 한도에 도달했습니다. Pro로 업그레이드하면 최대 10명까지 관리할 수 있습니다." 안내
  ↓
사용자가 그룹 운영의 가치를 경험한 후 유료 결제 유도
```

**장점**: 기능 제한 없이 먼저 경험 → 멤버 수 부족 시 자연스러운 업그레이드 유도

### 4-3. 슈퍼어드민 플랜 설정 (`/admin/plan-configs`)

| 설정 항목 | 설명 | 현재 구현 |
|---------|------|---------|
| `max_group_members` | 그룹당 최대 멤버 수 (NULL = 무제한) | ✅ 구현됨 |
| `max_cards` | 명함 최대 생성 수 | ✅ 구현됨 |
| `monthly_points` | 구독 지급 포인트 | ✅ 구현됨 |
| `price_monthly` | 월 구독료 | ✅ 구현됨 |

**API**: `PATCH /api/v1/admin/plan-configs/:planCode`  
```json
{ "max_group_members": 10 }   // 숫자 = 한도, null = 무제한
```

### 4-4. 구독 포인트 유효기간 정책

| 포인트 종류 | 유효기간 | 비고 |
|-----------|--------|------|
| 구독 지급 포인트 | **90일** | 매월 갱신 시 리셋 (미사용분 소멸 권장) |
| 단건 충전 포인트 | **365일** | 충전 시점부터 1년 |
| 관리자 지급 포인트 | 관리자 설정 | 이벤트·프로모션용 |

> ※ 만료 7일 전 앱 푸시 알림 발송 권장

---

## 5. 포인트 시스템

### 5-1. 포인트 기본 원칙

- **1P = 1원** (고정)
- 포인트는 **개인 지갑**과 **그룹 지갑** 별도 운영
- 개인 포인트 → 그룹 포인트 이전 **가능** (그룹 관리자만)
- 그룹 포인트 → 개인 포인트 역이전 **불가** (환불 악용 방지)
- 포인트는 현금으로 직접 전환 불가 (파트너 서비스 **이용** 개념)

### 5-2. 포인트 소유 주체

```
개인 지갑 (point_wallets WHERE owner_type = 'user')
  └── 사용처: 명함 추가 생성, NFC 카드 발급, 파트너 서비스 이용

그룹 지갑 (point_wallets WHERE owner_type = 'group')
  └── 사용처: 행사 개설, 프리미엄 초대링크, 레슨 기능 확장
```

### 5-3. 포인트 사용처 및 단가

| feature 코드 | 사용처 | 차감 대상 | 기본 단가 | 어드민 변경 |
|-------------|-------|---------|---------|----------|
| `card_extra` | 명함 추가 생성 (한도 초과 1개당) | 개인 | **1,000 P** | ✅ |
| `group_create` | 그룹 생성 | 개인 | **0 P (무료)** | ✅ |
| `event_create` | 행사 개설 | 그룹 | **3,000 P** | ✅ |
| `nfc_basic` | NFC 실물카드 발급 (기본형) | 개인 | **15,000 P** | ✅ |
| `nfc_premium` | NFC 실물카드 발급 (프리미엄) | 개인 | **30,000 P** | ✅ |
| `partner_*` | 파트너 서비스 이용 | 개인/그룹 | 파트너사별 설정 | ✅ |

> 단가는 `point_prices` 테이블에 저장, 슈퍼어드민 웹에서 실시간 변경

### 5-4. 포인트 충전 방식

#### A. 구독 자동 지급 (인앱결제 — 앱 전용)
```
사용자 플랜 구독 (앱스토어/구글플레이) → 영수증 서버 검증
  → subscriptions 테이블 생성/갱신
  → 구독 포인트 자동 지급 (point_transactions type='charge_subscription')
  → 개인 지갑 잔액 업데이트
```
- **앱 내에서만** 구독 가입/해지 가능 (인앱결제 정책 준수)

#### B. 단건 포인트 충전 (웹 전용)
```
사용자 웹 /app/points → [충전하기] → PG사 결제 창
  → 결제 완료 웹훅 수신
  → payment_orders 상태 'completed' 업데이트
  → point_transactions type='charge_purchase' 생성
  → 개인/그룹 지갑 잔액 업데이트
```
- PG사: 미정 (토스페이먼츠, 카카오페이, Stripe 중 선택)
- **앱 내에서는 단건 충전 버튼·문구·외부 링크 일절 표시 금지** (Apple/Google 정책)

#### C. 그룹 포인트 충전
```
방법 1: 그룹 관리자 → /app/group/:id/points → PG 결제 → 그룹 지갑 적립
방법 2: 그룹 관리자 → /app/points → 개인→그룹 이전 (POST /api/v1/points/transfer)
```

### 5-5. 포인트 차감 흐름

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
        → 오류 응답 { error: 'insufficient_points', required: N, current: M, short: N-M }
        → 앱: "포인트가 부족합니다" 메시지 표시
        → 웹: /app/points 충전 페이지로 이동 유도
```

---

## 6. DB 설계

### 6-1. 기존 테이블 처리 전략 (마이그레이션 0013)

| 기존 테이블 | 신규 대체 | 처리 방법 |
|-----------|---------|---------|
| `reward_balances` | `point_wallets` | **단계적 대체**: 신규 코드는 point_wallets 사용 |
| `rewards` | `point_transactions` | **단계적 대체**: 신규 코드는 point_transactions 사용 |
| `plans` | — | **확장**: monthly_points, point_expire_days, **max_group_members** 컬럼 추가 |
| `subscriptions` | — | **확장**: pg_provider, pg_subscription_id, period 컬럼 추가 |
| `payments` | — | **확장**: order_no, wallet_id, points_to_add 등 추가 |

### 6-2. plans 테이블 — max_group_members 컬럼 ★ v1.3 추가

```sql
-- Migration 0013에 포함
ALTER TABLE plans ADD COLUMN max_group_members INTEGER;  -- NULL = 무제한

UPDATE plans SET max_group_members = 2    WHERE code = 'free';
UPDATE plans SET max_group_members = 10   WHERE code = 'pro';
UPDATE plans SET max_group_members = NULL WHERE code = 'business';  -- 무제한
```

**API 제한 로직 (groups.ts)**:
```
그룹 가입/멤버 승인 시
  ↓
groups.admin_user_id → users.plan → plans.max_group_members 조회
  ↓
현재 멤버 수(active) >= max_group_members
  → { error_code: 'plan_member_limit_reached', current: N, limit: N, upgrade_required: true }
```

### 6-3. 신규 테이블 DDL

#### `point_wallets` — 포인트 지갑

```sql
CREATE TABLE IF NOT EXISTS point_wallets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type      TEXT    NOT NULL CHECK(owner_type IN ('user','group')),
  owner_id        INTEGER NOT NULL,
  balance         INTEGER NOT NULL DEFAULT 0,
  total_charged   INTEGER NOT NULL DEFAULT 0,
  total_used      INTEGER NOT NULL DEFAULT 0,
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
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  ref_type        TEXT,
  ref_id          INTEGER,
  description     TEXT,
  expires_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `point_prices` — 기능별 포인트 단가

```sql
CREATE TABLE IF NOT EXISTS point_prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feature     TEXT    NOT NULL UNIQUE,
  price       INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6-4. 인덱스

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_wallets_owner ON point_wallets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_wallet ON point_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type   ON point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_ref    ON point_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_no         ON payments(order_no);
```

---

## 7. API 설계

### 7-1. 포인트 지갑 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/points/me` | Bearer | 내 개인 지갑 잔액 + 최근 이력 5건 |
| GET | `/api/v1/points/me/transactions` | Bearer | 개인 포인트 이력 (페이지네이션) |
| GET | `/api/v1/points/groups/:id` | Bearer + group_admin | 그룹 지갑 잔액 |
| GET | `/api/v1/points/groups/:id/transactions` | Bearer + group_admin | 그룹 포인트 이력 |
| POST | `/api/v1/points/transfer` | Bearer + group_admin | 개인 → 그룹 포인트 이전 |

### 7-2. 결제 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/payments/subscription/verify-apple` | Bearer | 애플 인앱결제 영수증 검증 |
| POST | `/api/v1/payments/subscription/verify-google` | Bearer | 구글 인앱결제 영수증 검증 |
| POST | `/api/v1/payments/charge/prepare` | Bearer | 단건 충전 주문 생성 (웹 전용) |
| POST | `/api/v1/payments/charge/confirm` | Bearer | 결제 완료 확인 (PG 콜백) |
| POST | `/api/v1/payments/webhook/:provider` | PG 서명 | PG사 웹훅 수신 |
| GET | `/api/v1/payments/orders` | Bearer | 내 결제 이력 |
| GET | `/api/v1/payments/orders/:orderNo` | Bearer | 주문 상세 |

### 7-3. 그룹 가입/멤버 제한 API 응답 ★ v1.3 추가

**멤버 한도 초과 시 응답 (`groups.ts`, `auth.ts`)**:
```json
{
  "success": false,
  "error": "플랜 멤버 한도에 도달했습니다. 플랜을 업그레이드해주세요.",
  "error_code": "plan_member_limit_reached",
  "current": 10,
  "limit": 10,
  "upgrade_required": true
}
```

**앱 처리 가이드**:
- `error_code === 'plan_member_limit_reached'` 수신 시
- "멤버 한도(N명)에 도달했습니다. Pro로 업그레이드하면 더 많은 멤버를 관리할 수 있습니다." 안내
- 구독 업그레이드 화면으로 유도 (인앱결제)

### 7-4. 기존 API 포인트 차감 확장

| API | 차감 시점 | 차감 지갑 | feature |
|-----|---------|---------|---------|
| `POST /api/v1/cards` | 플랜 한도 초과 시 | 개인 | `card_extra` |
| `POST /api/v1/events` | 행사 생성 성공 시 | 그룹 | `event_create` |
| `POST /api/v1/nfc/apply` | NFC 신청 접수 시 | 개인 | `nfc_basic`/`nfc_premium` |
| `POST /api/v1/partner/use` | 파트너 서비스 이용 시 | 개인/그룹 | `partner_*` |

### 7-5. 어드민 설정 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/admin/point-prices` | 기능별 단가 전체 목록 |
| PATCH | `/api/v1/admin/point-prices/:feature` | 단가 변경 |
| GET | `/api/v1/admin/plan-configs` | 플랜별 설정 전체 목록 |
| PATCH | `/api/v1/admin/plan-configs/:plan` | 플랜 설정 변경 (max_group_members 포함) |
| POST | `/api/v1/admin/points/grant` | 포인트 직접 지급 |
| GET | `/api/v1/admin/payments` | 전체 결제 이력 |
| GET | `/api/v1/admin/points/stats` | 포인트 현황 통계 |

---

## 8. 웹 SPA 파일 구조

### 8-1. 서버 파일 구성

```
src/
├── index.tsx              Hono 라우터 (HTML 반환 + API 연결)
├── web/
│   ├── admin.ts           슈퍼어드민 HTML 템플릿 함수
│   │   ├── adminLoginHtml()     /admin 로그인 페이지
│   │   └── adminAppHtml()       /admin/* SPA 쉘
│   └── app.ts             사용자·그룹관리 HTML 템플릿 함수
│       ├── appLoginHtml()       /app/login
│       ├── appRegisterHtml()    /app/register
│       └── appShellHtml()       /app/* SPA 쉘
└── routes/
    ├── auth.ts, cards.ts, groups.ts, events.ts
    ├── chat.ts, lessons.ts, partner.ts, admin.ts
    └── (예정) points.ts, payments.ts
```

### 8-2. 클라이언트 파일 구성

```
public/static/
├── admin.js               슈퍼어드민 SPA 로직
│   └── 플랜 설정 페이지 포함 (/admin → plan-configs 탭) ✅
└── app.js                 사용자·그룹관리 SPA 로직
    ├── 인증 (localStorage JWT 관리)
    ├── 역할 분기 라우터 (hash 기반)
    ├── 개인 대시보드 렌더러
    ├── 그룹 목록 렌더러  (/app/groups)
    └── 그룹 관리 렌더러  (/app/group/:id/*)
```

---

## 9. 사이드바 메뉴 구조

### 9-1. 개인 컨텍스트 (`/app/dashboard`)

```
📇 내 명함
  ├── 명함 목록
  └── 명함 추가
👥 내 그룹
  └── 가입 그룹 목록  (/app/groups)
💰 포인트
  ├── 잔액 현황
  ├── 충전하기 (웹 PG 결제)
  └── 포인트 이력
💳 구독
  └── 현재 플랜 / 업그레이드 안내 (앱에서 변경)
```

### 9-2. 그룹 관리 컨텍스트 (`/app/group/:id/*`)

```
📋 그룹 개요           (/app/group/:id/dashboard)
  └── 정보 수정, 포인트 잔액
👤 멤버 관리           (/app/group/:id/members)
  ├── 멤버 목록 / 승인
  └── 초대링크 관리     (/app/group/:id/invites)
📅 행사 관리           (/app/group/:id/events)
  ├── 행사 목록
  └── 행사 생성
📓 레슨 관리           (/app/group/:id/lessons)
  ├── 일정 관리
  └── 출석 현황
💰 그룹 포인트         (/app/group/:id/points)
  ├── 잔액 현황
  ├── 충전하기 (PG)
  ├── 개인→그룹 이전
  └── 이력
```

### 9-3. 슈퍼어드민 컨텍스트 (`/admin/*`)

```
📊 대시보드
👤 사용자 관리
👥 그룹 관리
📅 행사 관리
📊 리포트
💳 NFC 카드
🤝 파트너 관리
── 플랜·포인트 관리 ──
📋 플랜 설정 ✅        ← max_group_members·명함수·포인트 조정
💰 포인트 단가 설정  (예정)
💳 결제 이력         (예정)
📈 포인트 통계       (예정)
🎁 포인트 직접 지급  (예정)
```

---

## 10. 인앱결제 구현 가이드 (앱 개발팀)

### 10-1. 구독 상품 등록 (스토어 상품 ID)

| 상품 ID | 플랜 | 주기 |
|--------|------|------|
| `meti.pro.monthly` | pro | 1개월 |
| `meti.pro.yearly` | pro | 1년 |
| `meti.business.monthly` | business | 1개월 |
| `meti.business.yearly` | business | 1년 |

### 10-2. 구독 처리 흐름

```
1. 앱 → 스토어 결제 완료
2. 앱 → 영수증/구매토큰 수신
3. 앱 → POST /api/v1/payments/subscription/verify-apple
         body: { receipt_data, plan }
4. 서버 → 애플 검증 서버에 영수증 검증 요청
5. 검증 성공 →
   - subscriptions 테이블 생성/갱신
   - payments 테이블 이력 기록
   - 구독 포인트 지급 (type='charge_subscription')
   - users.plan 업데이트
   - point_wallets.balance 업데이트
6. 앱 → 구독 완료 화면 표시 (멤버 한도 자동 업데이트 안내)
```

### 10-3. 멤버 한도 업그레이드 유도 흐름 (앱) ★ v1.3 추가

```
그룹 관리자가 멤버 초대/승인 시도
  ↓
API 응답: { error_code: 'plan_member_limit_reached', limit: 2 }
  ↓
앱 UI: "현재 Free 플랜은 그룹당 최대 2명까지 관리할 수 있습니다.
        Pro로 업그레이드하면 최대 10명까지 초대할 수 있어요!" 토스트/모달
  ↓
[Pro 구독하기] 버튼 → 인앱결제 플로우
```

### 10-4. 앱 내 포인트 충전 금지 사항 (Apple/Google 정책)

| 항목 | 허용 여부 |
|------|---------|
| "포인트 충전하기" 버튼 | ❌ 금지 |
| "웹에서 충전하세요" 문구 | ❌ 금지 |
| 외부 결제 URL 연결/표시 | ❌ 금지 |
| 포인트 잔액 표시 | ✅ 허용 |
| "포인트가 부족합니다" 오류 메시지 | ✅ 허용 |
| "멤버 한도에 도달했습니다" 오류 메시지 | ✅ 허용 |
| 인앱결제 구독 상품 구매 버튼 | ✅ 허용 |

---

## 11. 파트너 서비스 연동

### 11-1. 연동 정책
- METI 포인트 **차감** → 파트너사 API 호출 → 파트너 서비스 제공
- 포인트 ≠ 현금 전환 (B2B 정산 방식, METI ↔ 파트너사 별도 계약)
- 초기: "파트너 서비스 이용권 구매" 수준으로 추상화 (실제 전환 로직 미구현)

### 11-2. 파트너 연동 흐름

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

## 12. 슈퍼어드민 기능

### 현재 운영 중 (`/admin`)

- 전체 유저 관리 / 그룹 심사·승인 / 리워드 조회 / NFC 카드 관리 / 파트너 등록
- **플랜 설정** (max_group_members, max_cards, monthly_points, price_monthly) ✅

### 추가 예정

| 메뉴 | 경로 | 기능 |
|------|------|------|
| 포인트 단가 설정 | `/admin/point-prices` | feature별 단가 조회/수정 |
| 결제 이력 | `/admin/payments` | 전체 결제 내역 조회 |
| 포인트 통계 | `/admin/points/stats` | 총 충전/사용/잔액 현황 |
| 포인트 직접 지급 | `/admin/points/grant` | 프로모션·이벤트 지급 |

---

## 13. 구현 로드맵

### Phase 1 — 백엔드 기반 (우선 진행)
- [ ] **마이그레이션 0013 적용**: `point_wallets`, `point_transactions`, `point_prices` 신규 + `plans.max_group_members` 컬럼 확장
- [ ] **포인트 지갑 API** (`/api/v1/points/*`)
- [ ] 신규 가입 시 `point_wallets` 자동 생성 (`auth.ts` 수정)
- [ ] **명함 생성 포인트 차감** 연동 (`cards.ts` 수정)
- [ ] **행사 개설 포인트 차감** 연동 (`events.ts` 수정)
- [ ] **어드민 단가 설정 API** (`/api/v1/admin/point-prices`)

### Phase 2 — 결제 연동
- [ ] 인앱결제 영수증 검증 API (Apple/Google Sandbox 테스트)
- [ ] PG사 선정 및 단건 충전 API
- [ ] 웹훅 수신 및 멱등성 처리

### Phase 3 — 사용자 웹 고도화
- [ ] 개인 대시보드 API 연동 (실 데이터)
- [ ] 그룹 목록 (`/app/groups`) — 역할 표시, 관리 진입
- [ ] 그룹 관리 페이지 완성 (`/app/group/:id/*`)
- [ ] 포인트 단건 충전 페이지 (PG 연동)

### Phase 4 — 슈퍼어드민 확장
- [ ] 포인트 단가 설정 UI
- [ ] 결제·포인트 통계 대시보드

---

## 14. 미결 사항

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

## 15. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-05 | 포인트 시스템 초안 작성 |
| v1.1 | 2026-05-05 | 기존 DB 충돌 해결, 마이그레이션 전략 확정, 역할 전환 UX 구체화 |
| v1.2 | 2026-05-05 | 웹 URL 구조 확정, 다중 그룹 관리 URL 추가, 슈퍼어드민·그룹관리자 완전 분리 |
| v1.3 | 2026-05-05 | **플랜 정책 개편**: 기능 제한 폐지 → 그룹 최대 멤버수만으로 차등화 (Free: 2명, Pro: 10명, Business: 무제한), DB `plans.max_group_members` 컬럼 추가, API 한도 체크 로직 구현, 슈퍼어드민 플랜 설정 UI 구현 |

---

*METI Product Spec v1.3 — 2026-05-05*
