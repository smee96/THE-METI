# METI 네이티브 앱 개발 에이전트 시작 프롬프트 v2.8

> 최종 업데이트: 2026-05-14  
> 변경 이력: v2.7 → v2.8 — headhunter 제거·포인트 API 완성·레슨/행사/상품/결제 API 추가·딥링크 페이지 구현·백엔드 현황 최신화

---

## 📌 서비스 개요

**METI(메티)**는 디지털 명함 기반의 비즈니스 네트워킹 플랫폼입니다.

- **주요 기능**: 디지털 명함 생성/공유, 그룹 커뮤니티, 행사·레슨, 포인트 시스템, 1:1 채팅, 리워드
- **타겟**: 비즈니스 사용자 (이메일 인증 기반, 소셜 로그인 없음)
- **플랫폼**: iOS / Android 네이티브 앱 (Flutter 권장)
- **백엔드**: 이미 완성된 REST API 서버 (Cloudflare Workers + Hono + D1 SQLite)
- **인증**: JWT (Access Token 1시간, Refresh Token 7일, Token Rotation 방식)

---

## 🏗️ 시스템 아키텍처

```
[iOS / Android 앱]
        ↓  REST API (JSON)
[METI Backend API]  ← 이미 완성됨
  Base URL: https://the-meti.pages.dev/api/v1
        ↓
[Cloudflare D1 (SQLite)]
        ↓
[파트너 서비스] ← X-Partner-API-Key 헤더 기반 서버-투-서버 연동
```

---

## 🔐 인증 방식

### JWT Token 구조
```
Access Token  : 유효시간 1시간 (모든 인증 API 요청 헤더에 첨부)
Refresh Token : 유효시간 7일  (Token Rotation — 갱신 시 기존 토큰 무효화)
```

### 요청 헤더
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 토큰 갱신 흐름
1. API 요청 → 401 응답 수신
2. `POST /api/v1/auth/refresh` 호출 (refresh_token 전송)
3. 새 access_token + refresh_token 수신 → 로컬 저장 (Keychain/Keystore)
4. 원래 요청 재시도

---

## 📡 공통 응답 형식

```json
// 성공
{ "success": true, "data": { ... }, "message": "선택적 메시지" }

// 실패
{ "success": false, "error": "오류 메시지" }

// 페이지네이션 포함
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1, "limit": 20,
    "total": 100, "total_pages": 5, "has_next": true
  }
}
```

---

## 🗂️ 플랜 체계

| 플랜 | 기본 명함 수 | 월 포인트 | 그룹 최대 멤버 | 구독 방식 |
|------|------------|----------|--------------|---------|
| free | 1개 | 0 P | 2명 | 무료 |
| pro | 3개 | 10,000 P | 10명 | Apple IAP / Google Play |
| business | 10개 | 500,000 P | 무제한 | Apple IAP / Google Play |

- 추가 명함: 1개당 5,000원 웹 결제 (플랜 변경 시에도 유지)
- 구독 결제: `com.meti.pro_monthly` / `com.meti.business_monthly`
- 웹 결제 (레슨·행사·포인트 충전): Toss Payments(국내) + Stripe(해외)

---

## 👤 사용자 유형 및 역할

### account_type (v1.5 — headhunter 완전 제거)
| 값 | 설명 |
|----|------|
| `personal` | **모든 사용자의 유일한 account_type** — 신규 가입 시 자동 고정 |

### users.role
| 값 | 설명 |
|----|------|
| `user` | 일반 사용자 |
| `super_admin` | 플랫폼 전체 어드민 (웹 어드민 전용) |

### group_members.role (그룹 내 역할)
| 값 | 권한 |
|----|------|
| `admin` | 그룹 최고 관리자. 역할 변경·행사·레슨 생성 |
| `sub_admin` | 부관리자. 행사·레슨 생성 가능 |
| `instructor` | 강사. 담당 레슨 생성 가능 |
| `member` | 일반 멤버 |

---

# 📋 전체 API 명세

> **Base URL**: `https://the-meti.pages.dev/api/v1`  
> **로컬 개발**: `http://localhost:3000/api/v1`

---

## 1. 인증 (Auth)

### 1-1. 회원가입
```
POST /auth/register
권한: Public
```
```json
// Request
{
  "email": "user@example.com",
  "password": "Test1234!",
  "name": "홍길동"
}

// Response 201
{
  "success": true,
  "data": {
    "user_id": 2,
    "email": "user@example.com",
    "verify_token": "uuid-..."   // 개발환경에서만 노출, 운영은 이메일 발송
  },
  "message": "회원가입이 완료되었습니다. 이메일을 확인해주세요."
}
```
> ⚠️ `account_type` 필드 불필요 — 서버에서 `personal`로 자동 고정

---

### 1-2. 이메일 인증
```
POST /auth/verify-email
권한: Public
```
```json
// Request
{ "token": "uuid-..." }

// Response 200
{ "success": true, "data": null, "message": "이메일 인증이 완료되었습니다." }
```

---

### 1-3. 로그인
```
POST /auth/login
권한: Public
```
```json
// Request
{ "email": "user@example.com", "password": "Test1234!" }

// Response 200
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "uuid-...",
    "token_type": "Bearer",
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "account_type": "personal",
      "plan": "free"
    }
  }
}
```
- `401`: 이메일 또는 비밀번호 불일치
- `403`: 이메일 인증 미완료

---

### 1-4. 토큰 갱신 (Token Rotation)
```
POST /auth/refresh
권한: Public
```
```json
// Request
{ "refresh_token": "uuid-..." }

// Response 200
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "new-uuid-...",
    "token_type": "Bearer"
  }
}
```

---

### 1-5. 로그아웃
```
POST /auth/logout
권한: 🔐 Auth Required
```
```json
// Request (선택)
{ "refresh_token": "uuid-..." }

// Response 200
{ "success": true, "data": null, "message": "로그아웃되었습니다." }
```

---

### 1-6. 비밀번호 재설정 요청
```
POST /auth/forgot-password
권한: Public
```
```json
// Request
{ "email": "user@example.com" }

// Response 200
{
  "success": true,
  "data": { "reset_token": "uuid-..." }  // 개발환경만
}
```

---

### 1-7. 비밀번호 재설정
```
POST /auth/reset-password
권한: Public
```
```json
// Request
{
  "token": "uuid-...",
  "new_password": "NewPass1234!"
}

// Response 200
{ "success": true, "data": null, "message": "비밀번호가 재설정되었습니다." }
```

---

### 1-8. 내 프로필 조회
```
GET /auth/me
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": {
    "id": 2,
    "email": "user@example.com",
    "name": "홍길동",
    "account_type": "personal",
    "plan": "free",
    "is_verified": 1,
    "is_active": 1,
    "role": "user",
    "created_at": "2026-05-01T00:00:00.000Z"
  }
}
```

---

### 1-9. 초대링크로 그룹 가입
```
POST /auth/invite/:token/join
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": { "group_id": 3, "group_name": "METI 개발팀" },
  "message": "그룹에 가입되었습니다."
}
```
- 토큰 만료/소진/비활성 시 `400`
- 이미 가입된 그룹 시 `409`

---

## 2. 명함 (Cards)

### 2-1. 내 명함 목록
```
GET /cards
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "개발팀장 명함",
      "name": "홍길동",
      "job_title": "개발팀장",
      "company": "METI Inc.",
      "email": "hong@meti.io",
      "phone": "010-1234-5678",
      "website": "https://meti.io",
      "bio": "안녕하세요",
      "template_id": 1,
      "is_default": 1,
      "is_public": 1,
      "is_active": 1,
      "created_at": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

---

### 2-2. 명함 생성
```
POST /cards
권한: 🔐 Auth Required
```
```json
// Request
{
  "title": "개발팀장 명함",         // required, 2~100자
  "name": "홍길동",                 // required, 2~50자
  "job_title": "개발팀장",          // optional
  "company": "METI Inc.",           // optional
  "email": "hong@meti.io",          // optional
  "phone": "010-1234-5678",         // optional
  "website": "https://meti.io",     // optional
  "bio": "안녕하세요",               // optional
  "template_id": 1,                 // optional
  "is_public": 1                    // optional, 기본값 1
}

// Response 201
{
  "success": true,
  "data": { "id": 1, ... },
  "message": "명함이 생성되었습니다."
}
```
- `403`: 플랜 명함 한도 초과 (free: 1개, pro: 3개, business: 10개)

---

### 2-3. 명함 상세 조회 (인증 필요)
```
GET /cards/:id
권한: 🔐 Auth Required
```

---

### 2-4. 공개 명함 조회 (인증 불필요)
```
GET /cards/public/:id
권한: Public
```
```json
// Response 200
{
  "success": true,
  "data": {
    "id": 1,
    "name": "홍길동",
    "title": "개발팀장 명함",
    "job_title": "개발팀장",
    "company": "METI Inc.",
    "email": "hong@meti.io",
    "phone": "010-1234-5678",
    "website": "https://meti.io",
    "bio": "안녕하세요",
    "template_id": 1
  }
}
```
> 웹 딥링크 `/card/:id` → 이 API 호출하여 표시 (앱 미설치자용)

---

### 2-5. 명함 수정
```
PATCH /cards/:id
권한: 🔐 Auth Required (본인 명함)
```

---

### 2-6. 명함 삭제
```
DELETE /cards/:id
권한: 🔐 Auth Required (본인 명함)
```
```json
// Response 200
{ "success": true, "data": null, "message": "명함이 삭제되었습니다." }
```

---

### 2-7. QR 토큰 생성
```
POST /cards/:id/qr-token
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": {
    "token": "qr_abc123...",
    "expires_in": 300   // 5분 유효
  }
}
```

---

### 2-8. QR 토큰으로 명함 조회
```
GET /cards/qr/:token
권한: Public
```

---

### 2-9. 명함 저장 (명함첩)
```
POST /cards/:id/save
권한: 🔐 Auth Required
```
```json
// Response 200
{ "success": true, "data": null, "message": "명함이 저장되었습니다." }
```

---

### 2-10. 저장된 명함 목록 (명함첩)
```
GET /cards/saved
권한: 🔐 Auth Required
```

---

## 3. 그룹 (Groups)

### 3-1. 그룹 목록
```
GET /groups
권한: 🔐 Auth Required
Query: page, limit, status(my|public), category
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "METI 개발팀",
      "description": "개발자 모임",
      "category": "company",       // association | company | club | other
      "visibility": "public",      // public | private
      "status": "active",          // pending | active | suspended
      "member_count": 5,
      "max_members": 10,
      "my_role": "admin",          // 내 역할 (미가입 시 null)
      "created_at": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

---

### 3-2. 그룹 생성 신청
```
POST /groups
권한: 🔐 Auth Required
```
```json
// Request
{
  "name": "METI 개발팀",            // required, 2~100자
  "description": "개발자 모임",      // optional
  "category": "company",            // required: association|company|club|other
  "visibility": "public",           // optional, 기본 public
  "max_members": 10                 // optional (플랜 한도 내)
}

// Response 201
{
  "success": true,
  "data": { "id": 3, "name": "METI 개발팀", "status": "pending" },
  "message": "그룹 생성이 신청되었습니다. 관리자 승인 후 활성화됩니다."
}
```

---

### 3-3. 그룹 상세 조회
```
GET /groups/:id
권한: 🔐 Auth Required
```

---

### 3-4. 그룹 가입 신청
```
POST /groups/:id/join
권한: 🔐 Auth Required
```
```json
// Response 200
{ "success": true, "data": null, "message": "가입 신청이 완료되었습니다." }
```

---

### 3-5. 그룹 탈퇴
```
DELETE /groups/:id/leave
권한: 🔐 Auth Required
```

---

### 3-6. 그룹 멤버 목록
```
GET /groups/:id/members
권한: 🔐 Auth Required (그룹 멤버)
Query: page, limit, role, status
```

---

### 3-7. 멤버 역할 변경
```
PATCH /groups/:id/members/:memberId/role
권한: 🔐 Auth Required (그룹 admin)
```
```json
// Request
{ "role": "sub_admin" }   // admin | sub_admin | instructor | member
```

---

### 3-8. 그룹 공지 목록
```
GET /groups/:id/announcements
권한: 🔐 Auth Required (그룹 멤버)
```

---

### 3-9. 그룹 공지 작성
```
POST /groups/:id/announcements
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Request
{ "title": "공지 제목", "content": "공지 내용" }
```

---

### 3-10. 초대링크 생성
```
POST /groups/:id/invites
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Request
{
  "label": "2기 모집",     // optional
  "max_uses": 20,          // optional, null=무제한
  "expires_at": "2026-06-01T00:00:00Z"  // optional
}

// Response 201
{
  "success": true,
  "data": {
    "id": 5,
    "token": "inv_abc123",
    "invite_url": "https://the-meti.pages.dev/invite/inv_abc123",
    "label": "2기 모집",
    "max_uses": 20,
    "used_count": 0,
    "expires_at": "2026-06-01T00:00:00.000Z"
  }
}
```

---

### 3-11. 초대링크 공개 조회 (인증 불필요)
```
GET /groups/invite/:token
권한: Public
```
```json
// Response 200
{
  "success": true,
  "data": {
    "group_id": 3,
    "group_name": "METI 개발팀",
    "label": "2기 모집",
    "max_uses": 20,
    "used_count": 3,
    "expires_at": "2026-06-01T00:00:00.000Z"
  }
}
```
> 웹 딥링크 `/invite/:token` → 이 API 호출 → 앱 딥링크(`meti://invite/:token`) or 로그인 후 가입

---

## 4. 포인트 (Points)

### 4-1. 개인 포인트 잔액
```
GET /points/balance
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": {
    "balance": 8500,
    "expiring_soon": {
      "amount": 2000,
      "expires_at": "2026-06-01T00:00:00.000Z"
    }
  }
}
```

---

### 4-2. 개인 포인트 내역
```
GET /points/history
권한: 🔐 Auth Required
Query: page(1), limit(20)
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 10,
      "type": "charge_subscription",   // charge_subscription | charge_web | charge_admin
                                        // use_event | use_admin | transfer_out | transfer_in
      "point_type": "subscription",    // subscription | charged | reward
      "amount": 10000,                 // 양수=입금, 음수=출금
      "balance_after": 10000,
      "ref_type": "subscription",
      "ref_id": null,
      "description": "Pro 플랜 구독 포인트",
      "created_at": "2026-05-01T00:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

---

### 4-3. 개인→그룹 포인트 이전
```
POST /points/transfer
권한: 🔐 Auth Required
```
```json
// Request
{
  "group_id": 3,       // required
  "amount": 5000       // required, 양수 (잔액 초과 시 400)
}

// Response 200
{
  "success": true,
  "data": {
    "transferred": 5000,
    "my_balance_after": 3500,
    "group_balance_after": 15000
  },
  "message": "5,000P가 그룹으로 이전되었습니다."
}
```

---

### 4-4. 그룹 포인트 잔액
```
GET /points/groups/:groupId/balance
권한: 🔐 Auth Required (그룹 멤버)
```
```json
// Response 200
{
  "success": true,
  "data": { "group_id": 3, "group_name": "METI 개발팀", "balance": 15000 }
}
```

---

### 4-5. 그룹 포인트 내역
```
GET /points/groups/:groupId/history
권한: 🔐 Auth Required (admin | sub_admin)
Query: page, limit
```

---

## 5. 레슨 (Lessons)

### 5-1. 그룹 레슨 목록
```
GET /lessons/groups/:groupId/lessons
권한: 🔐 Auth Required (그룹 멤버)
Query: page, limit
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "수영 초급반",
      "instructor_name": "김강사",
      "scheduled_at": "2026-06-10T09:00:00.000Z",
      "duration_minutes": 60,
      "capacity": 10,
      "registered_count": 3,
      "location": "수영장 A",
      "status": "upcoming"    // upcoming | ongoing | ended | cancelled
    }
  ]
}
```

---

### 5-2. 레슨 생성
```
POST /lessons/groups/:groupId/lessons
권한: 🔐 Auth Required (admin | sub_admin | instructor)
```
```json
// Request
{
  "title": "수영 초급반",             // required
  "instructor_id": 5,                // required
  "scheduled_at": "2026-06-10T09:00:00Z",  // required
  "duration_minutes": 60,            // optional
  "capacity": 10,                    // optional
  "location": "수영장 A",             // optional
  "description": "초급자 대상"        // optional
}

// Response 201 — 그룹 포인트 500P 차감
{
  "success": true,
  "data": { "id": 1, ... },
  "message": "레슨이 생성되었습니다. (500P 차감)"
}
```

---

### 5-3. 수강 신청
```
POST /lessons/:id/register
권한: 🔐 Auth Required (그룹 멤버)
```

---

### 5-4. 수강 취소
```
DELETE /lessons/:id/register
권한: 🔐 Auth Required (신청자 본인)
```

---

## 6. 행사 (Events)

### 6-1. 그룹 행사 목록
```
GET /events/groups/:groupId/events
권한: 🔐 Auth Required (그룹 멤버)
Query: page, limit, status
```

---

### 6-2. 행사 생성
```
POST /events/groups/:groupId/events
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Request
{
  "title": "2026 네트워킹 파티",       // required
  "starts_at": "2026-07-01T18:00:00Z", // required (ISO 8601)
  "ends_at": "2026-07-01T21:00:00Z",   // optional
  "description": "연례 네트워킹",       // optional
  "location": "서울 강남구",            // optional
  "capacity": 50,                      // optional
  "visibility": "public",              // optional: public | group_only
  "registration_type": "pre_required", // optional: free | pre_required
  "entry_method": "qr",               // optional: qr | nfc_qr | manual
  "entry_fee": 1000                   // optional, 참가비 (포인트)
}

// 포인트 차감: 정원 ≤30 → 1,000P / ≤100 → 3,000P / >100 또는 무제한 → 5,000P
```

---

### 6-3. 행사 상세
```
GET /events/:id
권한: 🔐 Auth Required (공개 행사 or 그룹 멤버)
```

---

### 6-4. 행사 참가 신청
```
POST /events/:id/join
권한: 🔐 Auth Required
```

---

### 6-5. 행사 참가 취소 (참가비 환불)
```
DELETE /events/:id/join
권한: 🔐 Auth Required (신청자 본인)
```

---

### 6-6. 행사 체크인 (QR/NFC)
```
POST /events/:id/checkin
권한: 🔐 Auth Required
```
```json
// Request
{ "qr_token": "qr_abc..." }    // QR 스캔 값

// Response 200
{ "success": true, "data": null, "message": "체크인되었습니다." }
```

---

### 6-7. 참가자 목록
```
GET /events/:id/participants
권한: 🔐 Auth Required (admin | sub_admin)
```

---

## 7. 상품·주문·결제

### 7-1. 그룹 상품 목록
```
GET /groups/:groupId/products
권한: 🔐 Auth Required (그룹 멤버)
```

---

### 7-2. 상품 등록
```
POST /groups/:groupId/products
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Request
{
  "name": "수영 10회 이용권",
  "description": "초급 대상",
  "price": 100000,
  "currency": "KRW",
  "type": "lesson_pass"   // lesson_pass | event_ticket | point_charge | card_extra
}
```

---

### 7-3. 주문 생성
```
POST /orders
권한: 🔐 Auth Required
```
```json
// Request
{ "product_id": 5, "quantity": 1 }

// Response 201
{
  "success": true,
  "data": { "order_id": 42, "status": "pending", "total_amount": 100000 }
}
```

---

### 7-4. 웹 결제 토큰 발급 (일회성)
```
POST /payments/payment-token
권한: 🔐 Auth Required
```
```json
// Request
{ "order_id": 42 }

// Response 200
{
  "success": true,
  "data": {
    "token": "otp_abc123",
    "expires_in": 300,   // 5분, 1회용
    "payment_url": "https://the-meti.pages.dev/payment?token=otp_abc123"
  }
}
```
> 앱에서 WebView로 `payment_url` 열기 → Toss/Stripe 결제창 → 완료 후 콜백

---

### 7-5. 웹 결제 검증
```
POST /payments/verify-web
권한: 🔐 Auth Required
```
```json
// Request
{ "payment_key": "toss_pay_key_...", "order_id": "order_42", "amount": 100000 }
```

---

### 7-6. Apple IAP 구독 검증
```
POST /payments/subscription/verify-apple
권한: 🔐 Auth Required
```
```json
// Request
{ "receipt_data": "base64_encoded_receipt..." }
```

---

### 7-7. Google Play 구독 검증
```
POST /payments/subscription/verify-google
권한: 🔐 Auth Required
```
```json
// Request
{ "purchase_token": "...", "product_id": "com.meti.pro_monthly" }
```

---

## 8. 채팅 (Chat)

### 8-1. 채팅방 목록
```
GET /chat/rooms
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "direct",
      "partner": {
        "id": 3,
        "name": "김철수",
        "card_title": "영업팀장 명함"
      },
      "last_message": { "content": "안녕하세요", "created_at": "..." },
      "unread_count": 2
    }
  ]
}
```

---

### 8-2. 1:1 채팅방 생성/조회
```
POST /chat/rooms/direct
권한: 🔐 Auth Required
```
```json
// Request
{ "card_id": 5 }   // 상대방 명함 ID (저장된 명함만 가능)

// Response 200 or 201
{ "success": true, "data": { "room_id": 1 } }
```

---

### 8-3. 메시지 목록 (커서 기반)
```
GET /chat/rooms/:roomId/messages
권한: 🔐 Auth Required (채팅방 참여자)
Query: cursor(메시지 ID), limit(50)
```
```json
// Response 200
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 100,
        "sender_id": 2,
        "content": "안녕하세요",
        "message_type": "text",   // text | card | image | system
        "created_at": "2026-05-01T00:00:00.000Z"
      }
    ],
    "has_more": true,
    "next_cursor": 50
  }
}
```

---

### 8-4. 메시지 전송
```
POST /chat/rooms/:roomId/messages
권한: 🔐 Auth Required (채팅방 참여자)
```
```json
// Request
{
  "content": "안녕하세요",
  "message_type": "text",   // text | card
  "card_id": null            // message_type=card 시 필수
}
```

---

### 8-5. 신고
```
POST /chat/reports
권한: 🔐 Auth Required
```
```json
// Request
{ "target_type": "user", "target_id": 5, "reason": "스팸" }
```

---

### 8-6. 사용자 차단
```
POST /chat/blocks
권한: 🔐 Auth Required
```
```json
// Request
{ "blocked_user_id": 5 }
```

---

## 9. 파트너 연동 (Partner)

> **인증**: `X-Partner-API-Key: <partner_api_key>` 헤더 (서버→서버 전용)

### 9-1. 사용자 매핑
```
POST /partner/map-user
헤더: X-Partner-API-Key
```
```json
// Request
{ "meti_user_id": 2, "partner_user_id": "happytree_user_abc" }
```

---

### 9-2. 리워드 포인트 지급
```
POST /partner/reward
헤더: X-Partner-API-Key
```
```json
// Request
{
  "meti_user_id": 2,
  "points": 500,
  "description": "HappyTree 운동 목표 달성",
  "idempotency_key": "ht_reward_20260501_001"   // 중복 방지 키
}
```

---

### 9-3. 리워드 잔액 조회
```
GET /partner/balance/:metiUserId
헤더: X-Partner-API-Key
```

---

## 10. 딥링크 처리 (Flutter 앱)

앱 시작 시 URI를 파싱하여 처리합니다.

| 웹 URL 패턴 | 앱 딥링크 | 동작 |
|------------|---------|------|
| `/card/:id` | `meti://card/:id` | 명함 공개 페이지 — 앱 설치 시 인앱 표시, 미설치 시 웹 |
| `/invite/:token` | `meti://invite/:token` | 그룹 초대 — 로그인 후 `POST /auth/invite/:token/join` |
| `/payment?token=xxx` | `meti://payment?token=xxx` | WebView 결제 완료 콜백 |

```dart
// Flutter 딥링크 처리 예시
void handleDeepLink(Uri uri) {
  if (uri.pathSegments.first == 'card') {
    final cardId = uri.pathSegments[1];
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => CardPublicPage(cardId: cardId),
    ));
  } else if (uri.pathSegments.first == 'invite') {
    final token = uri.pathSegments[1];
    if (!isLoggedIn) {
      // SharedPreferences에 토큰 저장 후 로그인 화면으로
      prefs.setString('pending_invite', token);
      Navigator.push(context, MaterialPageRoute(builder: (_) => LoginPage()));
    } else {
      showInviteDialog(context, token);
    }
  }
}
```

---

## 11. 공통 에러 코드

| HTTP 상태 | 설명 |
|-----------|------|
| 400 | 요청 형식 오류, 필수 파라미터 누락, 잔액 부족 |
| 401 | Authorization 헤더 없음 또는 토큰 만료/무효 |
| 403 | 권한 없음 (이메일 미인증, 플랜 한도 초과, 역할 부족) |
| 404 | 요청한 리소스 없음 |
| 409 | 충돌 (중복 이메일, 이미 가입된 그룹, 이미 신청된 레슨 등) |
| 422 | 유효성 검사 실패 (Zod 스키마 오류) |
| 500 | 서버 내부 오류 |

---

## 12. 앱 화면 구성

### 인증 플로우
```
스플래시 → (토큰 있으면 자동 로그인) → 홈
         → (토큰 없으면) → 온보딩 → 로그인 / 회원가입 → 이메일 인증 대기 → 홈
```

### 메인 탭 구성 (하단 네비게이션)
```
🏠 홈       — 내 명함 빠른 공유, QR 스캔, 최근 저장 명함
👥 그룹     — 내 그룹 목록, 그룹 탐색, 행사·레슨 피드
📅 일정     — 참가 중인 행사·레슨 캘린더
💬 채팅     — 1:1 채팅방 목록
👤 마이     — 프로필, 명함 관리, 포인트, 구독 플랜, 설정
```

### 주요 화면 목록
| 화면 | 연결 API |
|------|---------|
| 명함 목록 | `GET /cards` |
| 명함 생성/편집 | `POST /cards`, `PATCH /cards/:id` |
| QR 코드 표시 | `POST /cards/:id/qr-token` |
| QR 스캔 | `GET /cards/qr/:token` |
| 명함첩 | `GET /cards/saved` |
| 그룹 탐색 | `GET /groups?status=public` |
| 그룹 상세·멤버·공지 | `GET /groups/:id`, `/members`, `/announcements` |
| 초대링크 공유 | `POST /groups/:id/invites` |
| 초대 수락 | `POST /auth/invite/:token/join` |
| 행사 목록·상세 | `GET /events/groups/:id/events` |
| 행사 참가·체크인 | `POST /events/:id/join`, `/checkin` |
| 레슨 목록·수강신청 | `GET /lessons/groups/:id/lessons`, `POST /lessons/:id/register` |
| 결제 (WebView) | `POST /payments/payment-token` → `payment_url` |
| 포인트 현황 | `GET /points/balance`, `GET /points/history` |
| 포인트 이전 | `POST /points/transfer` |
| 채팅 | `GET /chat/rooms`, `GET /chat/rooms/:id/messages` |
| 구독 업그레이드 | Apple IAP / Google Play → `POST /payments/subscription/verify-*` |
| 명함 공개 페이지 | `GET /cards/public/:id` (딥링크 `/card/:id`) |
| 그룹 초대 페이지 | `GET /groups/invite/:token` (딥링크 `/invite/:token`) |

---

## 13. 개발 시 주의사항

### ⚠️ 필수 로직
1. **토큰 자동 갱신**: 401 응답 시 `POST /auth/refresh` 후 재시도 (Dio Interceptor 등)
2. **명함 저장 선행**: 1:1 채팅 시작 전 반드시 상대방 명함 저장 (`POST /cards/:id/save`)
3. **그룹 승인 대기**: 그룹 생성 후 `status: pending` → 어드민 승인 전까지 기능 제한
4. **플랜 명함 한도**: free 1개·pro 3개·business 10개 → 초과 시 `403` (추가 구매 유도)
5. **행사 날짜 필드**: `event_date` ❌ → `starts_at` ✅ (반드시 ISO 8601 형식)
6. **account_type**: 회원가입 시 전송 불필요 — 서버에서 `personal` 자동 고정
7. **포인트 이전**: 개인→그룹만 가능, 그룹→개인 불가

### 💳 결제 주의사항
- 구독(pro/business): 반드시 Apple IAP / Google Play 인앱결제만 사용 (앱 내 "웹에서 결제" 문구 금지)
- 레슨·행사·포인트 충전·명함 추가: WebView(`payment_url`) 또는 외부 브라우저 유도
- 결제 완료 후 `POST /payments/verify-web` 서버 검증 필수

### 📱 네이티브 앱 특화
- **NFC**: 명함 공유 시 NFC 태그 지원 (`entry_method: "nfc_qr"`)
- **QR 스캔**: 카메라 권한 요청 → `GET /cards/qr/:token`
- **이벤트 체크인**: QR/NFC 스캔 → `POST /events/:id/checkin`
- **딥링크**: `/card/:id`, `/invite/:token` 처리 필수
- **푸시 알림**: 채팅·그룹 공지·행사 알림 (FCM/APNs 별도 연동)

### 🔒 보안
- Access Token / Refresh Token: Keychain(iOS) / Keystore(Android) 저장
- 앱 백그라운드 전환 시 민감 화면 블러 처리
- 생체인증(Face ID / 지문) 앱 잠금 옵션 권장

---

## 14. 백엔드 현황 (v2.8 기준)

| 항목 | 상태 |
|------|------|
| 인증 API (JWT, Rotation, 비밀번호 재설정) | ✅ 완료 |
| 명함 API (CRUD, QR, 명함첩, 공개 조회) | ✅ 완료 |
| 명함 공개 페이지 (`/card/:id`) | ✅ 완료 |
| 그룹 API (생성·승인·멤버·역할·공지·초대) | ✅ 완료 |
| 그룹 초대 페이지 (`/invite/:token`) | ✅ 완료 |
| 포인트 API (잔액·내역·이전·그룹) | ✅ 완료 |
| 레슨 API (CRUD, 수강신청·취소) | ✅ 완료 |
| 행사 API (CRUD, 참가·체크인·환불) | ✅ 완료 |
| 상품·주문·결제 API (PG Placeholder) | ✅ 완료 |
| 파트너 API (매핑·리워드·잔액) | ✅ 완료 |
| 채팅 API (1:1, 메시지, 신고·차단) | ✅ 완료 |
| 어드민 API (유저·그룹·명함·포인트 수동 지급) | ✅ 완료 |
| 어드민 웹 UI (대시보드·유저·그룹·명함·행사·레슨·포인트) | ✅ 완료 |
| headhunter 제거 — personal 단일화 | ✅ 완료 (migration 0018) |
| DB 마이그레이션 (0001~0018) | ✅ 프로덕션 적용 완료 |
| 웹 결제 페이지 (`/payment`) | ⏳ PG 키 수령 후 구현 |
| Toss / Stripe 서버사이드 검증 | ⏳ PG 키 수령 후 구현 |
| Apple IAP / Google Play 서버 검증 | ⏳ 앱 연동 후 구현 |
| 딥링크 처리 (Flutter 앱 내) | ⏳ 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 (FCM / APNs) | ⏳ 미결정 |
| 채팅 실시간 (WebSocket/SSE) | ⏳ Phase 2 |
| 구독 웹훅 | ⏳ Phase 2 |

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v2.8 작성일: 2026-05-14*
