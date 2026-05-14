# METI 서비스 기획서 v1.5
> 최종 업데이트: 2026-05-08

---

## 변경 이력 (v1.4 → v1.5)

| # | 항목 | 변경 내용 |
|---|------|---------|
| 1 | 결제 PG | Toss + Stripe 확정 |
| 2 | 웹뷰 토큰 전달 | 일회성 토큰 URL 방식 확정 |
| 3 | 명함 추가 비용 | 기본 외 추가 명함 1개당 5,000원 확정 + 플랜별 기본 수량 확정 |
| 4 | 포인트 만료 | 일반 포인트 90일, 구독 지급 포인트 다음 갱신일 기준 만료 |
| 5 | 구독 검증 방식 | 앱 재검증(Client-side) 방식 확정 (웹훅 Phase 2) |

---

## 1. 서비스 개요

METI는 그룹·행사·레슨 기반의 네트워킹 플랫폼입니다.
디지털 명함 교환, 그룹 활동 관리, 포인트 시스템, 레슨/행사 상품 결제를 통합 제공합니다.

| 항목 | 내용 |
|------|------|
| 서비스명 | METI |
| 플랫폼 | Flutter 네이티브 앱 + 웹(Cloudflare Pages) |
| 백엔드 | Hono (Cloudflare Workers) + D1 SQLite |
| 배포 URL | https://the-meti.pages.dev |
| 앱 번들 ID | com.meti.app |

---

## 2. 사용자 유형

| 유형 | 설명 |
|------|------|
| `personal` | 일반 사용자 (명함·그룹 멤버). 모든 회원의 기본 account_type |
| `group_admin` | 그룹 관리자 역할 — group_members.role = 'admin' 으로 관리 (별도 account_type 아님) |
| `super_admin` | 슈퍼어드민 (어드민 웹 전용) — users.role = 'super_admin' 으로 관리 |

> **⚠️ v1.5 변경**: `headhunter` account_type 완전 제거. 모든 신규 가입자는 `personal` 고정.
> 그룹 관리자 권한은 `account_type`이 아닌 `group_members.role` 컬럼으로 구분.

---

## 3. 플랜 구조

| 플랜 | 월 포인트 | 그룹 최대 멤버 | 기본 명함 수 | 구독 방식 |
|------|-----------|---------------|------------|-----------|
| free | 0 P | 2명 | 1개 | 무료 |
| pro | 10,000 P | 10명 | 3개 | Apple IAP / Google Play |
| business | 500,000 P | 무제한 | 10개 | Apple IAP / Google Play |

> **구독 결제**: Apple IAP(`com.meti.pro_monthly`, `com.meti.business_monthly`) + Google Play Billing  
> **웹 결제** (레슨·행사 상품·포인트 충전): Toss Payments + Stripe (확정)

---

## 4. 명함 정책

### 4.1 기본 제공 수량 (플랜별)

| 플랜 | 기본 명함 수 | 추가 명함 비용 |
|------|------------|--------------|
| free | 1개 | 1개당 5,000원 |
| pro | 3개 | 1개당 5,000원 |
| business | 10개 | 1개당 5,000원 |

### 4.2 추가 명함 구매
- 기본 수량 초과 시 1개당 **5,000원** 웹 결제
- 어드민 패널에서 단가 설정 가능 (`plan_configs.extra_card_price`)
- 구매한 추가 명함은 플랜 변경 시에도 유지

---

## 5. 포인트 시스템

### 5.1 개인 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 명함 추가 구매 | 5,000원/개 (웹 결제, 포인트 아님) |
| 행사 참가비 (`entry_fee`) | 행사 설정값 |
| 개인 → 그룹 이전 | 이전 금액만큼 |

### 5.2 그룹 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 레슨 개설 | 500 P |
| 행사 개설 (정원 ≤30) | 1,000 P |
| 행사 개설 (정원 31~100) | 3,000 P |
| 행사 개설 (정원 >100 또는 무제한) | 5,000 P |

### 5.3 포인트 만료 정책

| 포인트 종류 | 만료 기준 |
|-----------|---------|
| 구독 지급 포인트 (월 지급) | 다음 구독 갱신일에 만료 |
| 포인트 충전 (웹 결제) | 충전 시점 기준 90일 후 만료 |
| 행사 참가비 환불 포인트 | 환불 시점 기준 90일 후 만료 |
| 이벤트·보상 포인트 | 적립 시점 기준 90일 후 만료 |

> **DB 구현**: `user_points` 테이블에 `expires_at` 컬럼, `point_type` (`subscription`|`charged`|`reward`) 구분

### 5.4 포인트 흐름
```
구독 결제 → 개인 포인트 월 지급 (만료: 다음 갱신일)
포인트 충전 결제 → 개인 포인트 적립 (만료: +90일)
개인 포인트 → 그룹 포인트 이전 (POST /api/v1/points/transfer)
그룹 포인트 → 레슨/행사 개설 비용 차감
참가자 개인 포인트 → 행사 참가비 차감 → 그룹 포인트로 적립
```

### 5.5 포인트 직접 충전 상품

| 상품 | 금액 | 지급 포인트 |
|------|------|-----------|
| 포인트 10,000P | 10,000원 | 10,000 P |
| 포인트 100,000P | 100,000원 | 100,000 P |
| 포인트 500,000P | 500,000원 | 500,000 P |
| 직접 입력 | 최소 10,000원 | 입력금액 P |

---

## 6. 그룹 내 역할 (group_members.role)

| 역할 | 권한 |
|------|------|
| `admin` | 그룹 최고 관리자. 역할 변경, 행사·레슨 생성 |
| `sub_admin` | 부관리자. 행사·레슨 생성 가능 |
| `instructor` | 강사. 담당 레슨 생성 가능 |
| `member` | 일반 멤버 |

> **강사 지정**: 그룹 `admin`이 `PATCH /api/v1/groups/:id/members/:memberId/role` 로 `instructor` 역할 부여  
> **자가 생성**: 강사가 직접 그룹을 생성하면 자동으로 `admin` → 별도 지정 없이 레슨 생성 가능

---

## 7. 레슨 (Lessons)

### 7.1 DB 스키마 (lessons 테이블)
```sql
id, group_id, instructor_id (FK→users), title, description,
schedule_type (one-time|repeat), scheduled_at, duration_minutes,
capacity, location, point_cost (개설 비용), status, created_at
```

### 7.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/lessons/groups/:groupId/lessons | 그룹 멤버 | 레슨 목록 |
| POST | /api/v1/lessons/groups/:groupId/lessons | admin/sub_admin/instructor | 레슨 생성 (500P 차감) |
| GET | /api/v1/lessons/:id | 그룹 멤버 | 레슨 상세 |
| PUT | /api/v1/lessons/:id | admin/sub_admin/강사 본인 | 레슨 수정 |
| DELETE | /api/v1/lessons/:id | admin/sub_admin | 레슨 취소 |
| POST | /api/v1/lessons/:id/register | 그룹 멤버 | 수강 신청 |
| DELETE | /api/v1/lessons/:id/register | 신청자 본인 | 수강 취소 |

---

## 8. 행사 (Events)

### 8.1 DB 스키마 (events 테이블)
```sql
id, group_id, created_by (FK→users), title, description, location,
starts_at, ends_at, capacity, visibility (public|group_only),
registration_type (free|pre_required), entry_method (qr|nfc_qr|manual),
point_cost (개설 비용), entry_fee (참가비·포인트), status, created_at
```

### 8.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/events/groups/:groupId/events | 그룹 멤버 | 행사 목록 |
| POST | /api/v1/events/groups/:groupId/events | admin/sub_admin | 행사 생성 (포인트 차감) |
| GET | /api/v1/events/:id | 조건부 | 행사 상세 |
| PUT | /api/v1/events/:id | admin/sub_admin | 행사 수정 |
| DELETE | /api/v1/events/:id | admin/sub_admin | 행사 취소 |
| POST | /api/v1/events/:id/join | 그룹 멤버 | 행사 참가 신청 |
| DELETE | /api/v1/events/:id/join | 신청자 본인 | 행사 취소 (참가비 환불) |
| GET | /api/v1/events/:id/participants | admin/sub_admin | 참가자 목록 |

---

## 9. 상품·주문·결제

### 9.1 상품 (products)
그룹 관리자가 레슨/행사에 대한 **결제 상품**을 등록.  
예: `수영 초급 10회 이용권 - 100,000원`, `체험 1회 - 10,000원`

### 9.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/groups/:groupId/products | 그룹 멤버 | 상품 목록 |
| POST | /api/v1/groups/:groupId/products | admin/sub_admin | 상품 등록 |
| PUT | /api/v1/products/:id | admin/sub_admin | 상품 수정 |
| POST | /api/v1/orders | 인증 사용자 | 주문 생성 |
| GET | /api/v1/orders | 본인 | 주문 목록 |
| GET | /api/v1/orders/:id | 본인 | 주문 상세 |
| POST | /api/v1/payments/verify-web | 인증 사용자 | 웹 결제 검증 |
| POST | /api/v1/payments/subscription/verify-apple | 인증 사용자 | Apple IAP 검증 |
| POST | /api/v1/payments/subscription/verify-google | 인증 사용자 | Google Play 검증 |

### 9.3 결제 PG (확정)

| 대상 | PG사 | 통화 |
|------|------|------|
| 국내 결제 | Toss Payments | KRW |
| 해외 결제 | Stripe | USD / 기타 |
| Apple 구독 | Apple IAP | 각국 통화 |
| Google 구독 | Google Play Billing | 각국 통화 |

**Cloudflare 시크릿 변수명:**
```
TOSS_SECRET_KEY       # Toss 시크릿 키
STRIPE_SECRET_KEY     # Stripe 시크릿 키
```

### 9.4 웹 결제 토큰 흐름 (일회성 토큰 URL 방식)

```
1. 앱에서 상품 선택
   ↓
2. POST /api/v1/payments/payment-token
   { "order_id": 42 }
   → { "token": "otp_abc123", "expires_in": 300 }  (5분 유효, 1회용)
   ↓
3. 앱 내 WebView로 결제 페이지 열기
   URL: https://the-meti.pages.dev/payment?token=otp_abc123
   ↓
4. 서버에서 토큰 검증 → 사용자 인증 → PG 결제창 표시
   ↓
5. PG 결제 완료 → POST /api/v1/payments/verify-web
   ↓
6. 결제 완료 → 주문 상태 paid → WebView 닫기 콜백
```

> **일회성 토큰 방식 사용 이유**: JWT를 URL에 직접 포함하면 로그에 노출됨.  
> 토큰은 5분 후 자동 만료되며, 1회 사용 즉시 무효화.

### 9.5 결제 방식 정책

| 항목 | 방식 | 비고 |
|------|------|------|
| 구독 (pro/business) | Apple IAP + Google Play Billing | 인앱결제만 |
| 레슨·행사 상품 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 포인트 직접 충전 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 명함 추가 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |

> 앱 내에서 "웹에서 결제" 문구 직접 노출 금지 (Apple/Google 정책).  
> WebView 방식 또는 외부 브라우저 유도 사용.

### 9.6 구독 검증 방식

**확정: 앱 재검증(Client-side) 방식**  
웹훅은 Phase 2에서 추가.

```
앱 실행 시 or 구독 상태 확인 필요 시:
  → Apple/Google로부터 영수증/토큰 수신
  → POST /api/v1/payments/subscription/verify-apple (또는 verify-google)
  → 서버에서 Apple/Google API로 유효성 확인
  → 플랜 업그레이드 or 유지
```

---

## 10. 딥링크

| URL 패턴 | 동작 |
|----------|------|
| `/card/:id` | 명함 공개 페이지 (앱 미설치자도 웹으로 조회) |
| `/invite/:token` | 그룹 초대링크 (로그인 후 그룹 가입 확인 모달) |
| `/payment?token=xxx` | 웹 결제 페이지 (일회성 토큰 인증) |

> Flutter 앱: `Uri.base` 파싱으로 앱 시작 시 딥링크 감지  
> 미로그인 시: SharedPreferences에 토큰 임시 저장 → 로그인 완료 후 처리

---

## 11. 구현 현황

| 영역 | 상태 |
|------|------|
| 인증 (JWT, OAuth, 리프레시) | ✅ 완료 |
| 명함 (생성·수정·공개) | ✅ 완료 |
| 그룹 (생성·승인·멤버·초대링크) | ✅ 완료 |
| 포인트 API (잔액·내역·이전·그룹) | ✅ 완료 (migration 0013) |
| 강사 역할 지정 API | ✅ 완료 |
| 레슨 CRUD + 수강 신청 | ✅ 완료 |
| 행사 CRUD + 참가 신청 | ✅ 완료 |
| 상품·주문·결제 API | ✅ 완료 (PG 검증 Placeholder) |
| 어드민 웹 — 대시보드·유저·그룹·행사·레슨 | ✅ 완료 |
| 어드민 웹 — 명함 관리 탭 | ✅ 완료 |
| 어드민 웹 — 유저 상세 모달 (명함·그룹·포인트) | ✅ 완료 |
| 어드민 웹 — 포인트 수동 지급/차감 | ✅ 완료 |
| 어드민 웹 — 그룹 전체 탭 + 상태별 액션 버튼 | ✅ 완료 |
| 어드민 API — 유저 상세·명함 CRUD·포인트 지급 | ✅ 완료 |
| 명함 공개 페이지 (/card/:id) | ✅ 완료 |
| 그룹 초대 페이지 (/invite/:token) | ✅ 완료 |
| headhunter account_type 제거 (단일화) | ✅ 완료 (migration 0018) |
| 포인트 만료 정책 DB (expires_at) | ✅ 완료 (migration 0016) |
| 명함 수량 제한 plan_configs | ✅ 완료 (migration 0017) |
| 일회성 결제 토큰 API | ⏳ 구현 예정 |
| 웹 결제 페이지 (/payment) | ⏳ PG 키 수령 후 구현 |
| Toss 서버사이드 검증 | ⏳ PG 키 수령 후 구현 |
| Stripe 서버사이드 검증 | ⏳ PG 키 수령 후 구현 |
| Apple IAP 영수증 서버검증 | ⏳ 구현 예정 |
| Google Play 서버검증 | ⏳ 구현 예정 |
| 딥링크 처리 (Flutter) | ⏳ 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 | ⏳ 미결정 |
| 채팅 | ⏳ 미결정 |
| 구독 웹훅 | ⏳ Phase 2 |

---

## 12. DB 마이그레이션 목록

| 번호 | 내용 | 상태 |
|------|------|------|
| 0001~0009 | 기본 스키마 (users, cards, groups, events, chat, rewards, plans, user_role) | ✅ 적용 |
| 0010~0012 | 미성년자/보호자, 초대링크, 그룹 단순화 | ✅ 적용 |
| 0013 | 포인트 시스템 (point_wallets, point_transactions), 플랜 멤버수 제한 | ✅ 적용 |
| 0014 | lessons, events(재설계), products, orders, payments, lesson_registrations, event_participants | ✅ 적용 |
| 0015 | events.entry_fee 컬럼 추가 | ✅ 적용 |
| 0016 | point_wallets.expires_at, point_type 컬럼 추가 (포인트 만료 정책) | ✅ 적용 |
| 0017 | plan_configs: extra_card_price, free_card_limit 컬럼 추가 | ✅ 적용 |
| 0018 | headhunter account_type 제거 — users 전체 personal 단일화, plans.features 정리 | ✅ 적용 |
