# METI 네이티브 앱 개발 에이전트 시작 프롬프트 v3.0

> 최종 업데이트: 2026-05-26  
> 변경 이력: v2.8 → v3.0  
> - **A파트 완료**: 어드민 주문/결제(A-1), plan_configs+충전상품(A-2), 파트너 WebView(A-3), 채팅 보관정책(A-4)  
> - **채팅 보관 일수**: Free 1일 / Pro 90일 / Business 무제한(0) — plan_configs 동적 설정  
> - **파트너 연동 방식**: WebView + API Key (서버→서버)  
> - **B/C 파트 보완목록** 섹션 신규 추가  
> - **DB 마이그레이션**: 0001~0020 프로덕션 전체 완료  

---

## 📌 서비스 개요

**METI(메티)**는 디지털 명함 기반의 비즈니스 네트워킹 플랫폼입니다.

- **주요 기능**: 디지털 명함 생성/공유, 그룹 커뮤니티, 행사·레슨, 포인트 시스템, 1:1 채팅, 리워드, 파트너 앱 연동
- **타겟**: 비즈니스 사용자 (이메일 인증 기반, 소셜 로그인 없음)
- **플랫폼**: iOS / Android 네이티브 앱 (Flutter 권장)
- **백엔드**: 이미 완성된 REST API 서버 (Cloudflare Pages + Hono + D1 SQLite)
- **인증**: JWT (Access Token 1시간, Refresh Token 7일, Token Rotation 방식)

---

## 🏗️ 시스템 아키텍처

```
[iOS / Android 앱]
        ↓  REST API (JSON)
[METI Backend API]  ← 이미 완성됨
  Base URL: https://the-meti.pages.dev/api/v1
        ↓
[Cloudflare D1 (SQLite)]   [Cloudflare R2 (이미지)]
        ↓
[파트너 서비스] ← X-Partner-API-Key (서버→서버) + WebView (앱 내 실행)
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
  "meta": {
    "page": 1, "limit": 20,
    "total": 100, "total_pages": 5, "has_next": true
  }
}
```

---

## 🗂️ 플랜 체계

| 플랜 | 기본 명함 수 | 월 포인트 | 그룹 최대 멤버 | 채팅 보관 | 구독 방식 |
|------|------------|----------|--------------|---------|---------| 
| free | 1개 | 0 P | 2명 | **1일** | 무료 |
| pro | 3개 | 10,000 P | 10명 | **90일** | Apple IAP / Google Play |
| business | 10개 | 500,000 P | 무제한 | **무제한** | Apple IAP / Google Play |

> ⚠️ 채팅 보관일수는 plan_configs에서 어드민이 동적으로 변경 가능  
> 보관일 초과 메시지는 매일 KST 02:00에 자동 소프트 삭제 처리됨

- 추가 명함: 1개당 5,000원 웹 결제 (플랜 변경 시에도 유지)
- 구독 결제: `com.meti.pro_monthly` / `com.meti.business_monthly`
- 웹 결제 (레슨·행사·포인트 충전): Toss Payments(국내) + Stripe(해외)

### 포인트 충전 상품 (어드민 설정 가능)
| 상품명 | 결제금액 | 지급 포인트 |
|--------|---------|------------|
| 포인트 10,000P | 10,000원 | 10,000 P |
| 포인트 100,000P | 100,000원 | 100,000 P |
| 포인트 500,000P | 500,000원 | 500,000 P |
| 직접 입력 | 최소 10,000원 | 결제금액 동일 |

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

### 1-9. 프로필 수정
```
PATCH /auth/me
권한: 🔐 Auth Required
```
```json
// Request (부분 수정 가능)
{ "name": "새이름", "bio": "자기소개" }
```

---

### 1-10. 아바타 업로드
```
POST /auth/me/avatar
권한: 🔐 Auth Required
Content-Type: multipart/form-data
```
```
Form field: avatar (image file)
```

---

### 1-11. 비밀번호 변경
```
PUT /auth/me/password
권한: 🔐 Auth Required
```
```json
// Request
{ "current_password": "old", "new_password": "New1234!" }
```

---

### 1-12. 초대링크 정보 조회
```
GET /auth/invite/:token
권한: Public
```

---

### 1-13. 초대링크로 그룹 가입
```
POST /auth/invite/:token/join
권한: 🔐 Auth Required
```
```json
// Response 200
{ "success": true, "data": { "group_id": 3, "role": "member" } }
```

---

## 2. 명함 (Cards)

### 2-1. 내 명함 목록
```
GET /cards
권한: 🔐 Auth Required
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
  "name": "홍길동",
  "title": "CEO",
  "company": "METI Inc.",
  "email": "hong@example.com",
  "phone": "010-1234-5678",
  "bio": "자기소개",
  "website": "https://example.com"
}
```
> ⚠️ 플랜별 명함 수 한도 초과 시 `403` 반환 → 추가 구매 유도

---

### 2-3. 명함 공개 조회 (비인증)
```
GET /cards/public/:id
권한: Public
```

---

### 2-4. 명함 상세
```
GET /cards/:id
권한: 🔐 Auth Required
```

---

### 2-5. 명함 수정
```
PATCH /cards/:id
권한: 🔐 Auth Required
```

---

### 2-6. 명함 삭제
```
DELETE /cards/:id
권한: 🔐 Auth Required
```

---

### 2-7. 명함 이미지 업로드
```
POST /cards/:id/avatar
권한: 🔐 Auth Required
Content-Type: multipart/form-data
```

---

### 2-8. QR 토큰 발급
```
POST /cards/:id/qr-token
권한: 🔐 Auth Required
```
```json
// Response 200
{ "success": true, "data": { "token": "qr_xxx", "expires_in": 300 } }
```

---

### 2-9. QR 토큰으로 명함 조회
```
GET /cards/qr/:token
권한: 🔐 Auth Required
```

---

### 2-10. 명함 저장 (명함첩)
```
POST /cards/:id/save
권한: 🔐 Auth Required
```
> ⚠️ **1:1 채팅 시작 전 반드시 상대방 명함 저장 필수**

---

### 2-11. 명함첩 (저장된 명함 목록)
```
GET /cards/contacts/list
권한: 🔐 Auth Required
```

---

## 3. 그룹 (Groups)

### 3-1. 그룹 탐색 (공개)
```
GET /groups
권한: Public
Query: page, limit, status(active|pending)
```

---

### 3-2. 그룹 생성
```
POST /groups
권한: 🔐 Auth Required
```
```json
// Request
{
  "name": "수영 동호회",
  "description": "주 3회 운동",
  "visibility": "public",   // public | private
  "category": "sports"
}
```
> ⚠️ 생성 후 `status: pending` — 어드민 승인 전까지 기능 제한

---

### 3-3. 내 그룹 목록
```
GET /groups/mine
권한: 🔐 Auth Required
```

---

### 3-4. 그룹 상세
```
GET /groups/:id
권한: Public
```

---

### 3-5. 그룹 가입 신청
```
POST /groups/:id/join
권한: 🔐 Auth Required
```

---

### 3-6. 그룹 탈퇴
```
DELETE /groups/:id/leave
권한: 🔐 Auth Required
```

---

### 3-7. 그룹 멤버 목록
```
GET /groups/:id/members
권한: 🔐 Auth Required
```

---

### 3-8. 멤버 역할 변경
```
PATCH /groups/:id/members/:memberId/role
권한: 🔐 Auth Required (admin)
```

---

### 3-9. 공지 목록
```
GET /groups/:id/notices
권한: Public
```

---

### 3-10. 공지 작성
```
POST /groups/:id/notices
권한: 🔐 Auth Required (admin | sub_admin)
```

---

### 3-11. 초대 링크 생성
```
POST /groups/:id/invite-links
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Response 200
{
  "success": true,
  "data": {
    "token": "inv_xxx",
    "url": "https://the-meti.pages.dev/invite/inv_xxx",
    "expires_at": "2026-06-01T00:00:00.000Z"
  }
}
```

---

### 3-12. 초대 링크 목록
```
GET /groups/:id/invite-links
권한: 🔐 Auth Required (admin | sub_admin)
```

---

### 3-13. 초대 링크 비활성화
```
PATCH /groups/:id/invite-links/:linkId/deactivate
권한: 🔐 Auth Required (admin)
```

---

### 3-14. 초대 링크 조회 (비인증)
```
GET /groups/invite/:token
권한: Public
```
> ⚠️ 앱 미설치 사용자는 `/invite/:token` 딥링크 페이지로 랜딩

---

## 4. 행사 (Events)

### 4-1. 그룹 행사 목록
```
GET /groups/:groupId/events
권한: 🔐 Auth Required (그룹 멤버)
Query: page, limit, status(upcoming|ongoing|ended|cancelled)
```

---

### 4-2. 행사 생성
```
POST /groups/:groupId/events
권한: 🔐 Auth Required (admin | sub_admin)
```
```json
// Request
{
  "title": "신년 네트워킹 파티",
  "description": "...",
  "location": "서울 강남",
  "starts_at": "2026-01-15T18:00:00.000Z",
  "ends_at": "2026-01-15T21:00:00.000Z",
  "capacity": 50,
  "visibility": "group_only",   // public | group_only
  "registration_type": "free",  // free | pre_required
  "entry_method": "qr",         // qr | nfc_qr | manual
  "entry_fee": 0                // 참가비 (원), 0=무료
}
```
> ⚠️ `event_date` 필드 없음 — `starts_at` / `ends_at` 사용 (ISO 8601)

---

### 4-3. 행사 상세
```
GET /events/:id
권한: 🔐 Auth Required
```

---

### 4-4. 행사 수정
```
PUT /events/:id
권한: 🔐 Auth Required (admin | sub_admin)
```

---

### 4-5. 행사 삭제
```
DELETE /events/:id
권한: 🔐 Auth Required (admin)
```

---

### 4-6. 행사 참가 신청
```
POST /events/:id/join
권한: 🔐 Auth Required
```

---

### 4-7. 행사 참가 취소
```
DELETE /events/:id/join
권한: 🔐 Auth Required
```

---

### 4-8. 참가자 목록
```
GET /events/:id/participants
권한: 🔐 Auth Required (admin | sub_admin)
```

---

## 5. 레슨 (Lessons)

### 5-1. 그룹 레슨 목록
```
GET /lessons/groups/:groupId/lessons
권한: 🔐 Auth Required (그룹 멤버)
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
  "title": "초급 수영 레슨",
  "description": "...",
  "scheduled_at": "2026-02-01T10:00:00.000Z",
  "duration_minutes": 60,
  "capacity": 10,
  "location": "수영장 1레인",
  "point_cost": 500,        // 그룹 포인트 개설 비용
  "schedule_type": "one-time"  // one-time | repeat
}
```

---

### 5-3. 레슨 상세
```
GET /lessons/:id
권한: 🔐 Auth Required
```

---

### 5-4. 레슨 수정
```
PUT /lessons/:id
권한: 🔐 Auth Required (admin | sub_admin | instructor)
```

---

### 5-5. 레슨 삭제
```
DELETE /lessons/:id
권한: 🔐 Auth Required (admin)
```

---

### 5-6. 레슨 수강 신청
```
POST /lessons/:id/register
권한: 🔐 Auth Required
```

---

### 5-7. 레슨 수강 취소
```
DELETE /lessons/:id/register
권한: 🔐 Auth Required
```

---

## 6. 포인트 (Points)

### 6-1. 개인 포인트 잔액
```
GET /points/balance
권한: 🔐 Auth Required
```
```json
// Response 200
{
  "success": true,
  "data": { "balance": 15000, "unit": "P" }
}
```

---

### 6-2. 개인 포인트 내역
```
GET /points/history
권한: 🔐 Auth Required
Query: page, limit
```

---

### 6-3. 포인트 이전 (개인 → 그룹)
```
POST /points/transfer
권한: 🔐 Auth Required
```
```json
// Request
{ "group_id": 3, "amount": 5000, "description": "그룹 이벤트 후원" }
```
> ⚠️ 개인→그룹만 가능, 그룹→개인 불가

---

### 6-4. 그룹 포인트 잔액
```
GET /points/groups/:groupId/balance
권한: 🔐 Auth Required (그룹 멤버)
```

---

### 6-5. 그룹 포인트 내역
```
GET /points/groups/:groupId/history
권한: 🔐 Auth Required (그룹 멤버)
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

---

### 7-3. 상품 수정
```
PUT /groups/:groupId/products/:productId
권한: 🔐 Auth Required (admin | sub_admin)
```

---

### 7-4. 주문 생성
```
POST /orders
권한: 🔐 Auth Required
```
```json
// Request
{ "items": [{ "product_id": 5, "quantity": 1 }] }

// Response 201
{
  "success": true,
  "data": { "order_id": 42, "status": "pending", "total_amount": 100000 }
}
```

---

### 7-5. 내 주문 목록
```
GET /orders
권한: 🔐 Auth Required
```

---

### 7-6. 주문 상세
```
GET /orders/:id
권한: 🔐 Auth Required
```

---

### 7-7. 웹 결제 토큰 발급 (일회성, 5분 유효)
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
    "expires_in": 300,
    "payment_url": "https://the-meti.pages.dev/payment?token=otp_abc123"
  }
}
```
> 앱에서 WebView로 `payment_url` 열기 → Toss/Stripe 결제창 → 완료 후 콜백

---

### 7-8. 결제 토큰 검증
```
GET /payments/payment-token/verify?token=otp_abc123
권한: Public (토큰 기반)
```

---

### 7-9. 웹 결제 검증
```
POST /payments/verify-web
권한: 🔐 Auth Required
```
```json
// Request
{ "payment_key": "toss_pay_key_...", "order_id": "42", "amount": 100000 }
```

---

### 7-10. Apple IAP 구독 검증
```
POST /payments/subscription/verify-apple
권한: 🔐 Auth Required
```
```json
// Request
{ "receipt_data": "base64_encoded_receipt...", "product_id": "com.meti.pro_monthly" }
```

---

### 7-11. Google Play 구독 검증
```
POST /payments/subscription/verify-google
권한: 🔐 Auth Required
```
```json
// Request
{ "purchase_token": "...", "product_id": "com.meti.pro_monthly" }
```

---

### 7-12. 포인트 충전 상품 목록 조회 (앱용)
```
GET /point-charge-products
권한: 🔐 Auth Required
```
> **⚠️ B파트 구현 필요** — 현재 어드민 CRUD만 구현됨, 앱용 공개 조회 API 미구현

```json
// Response 200 (예상)
{
  "success": true,
  "data": [
    { "id": 1, "title": "포인트 10,000P", "amount_krw": 10000, "points": 10000, "is_custom": 0 },
    { "id": 2, "title": "포인트 100,000P", "amount_krw": 100000, "points": 100000, "is_custom": 0 },
    { "id": 4, "title": "직접 입력", "amount_krw": 0, "points": 0, "is_custom": 1, "min_amount": 10000 }
  ]
}
```

---

## 8. 채팅 (Chat)

> **채팅 메시지 보관 정책** (v3.0 신규)
> - Free: 1일 후 자동 삭제 (소프트 딜리트)
> - Pro: 90일 후 자동 삭제
> - Business: 무제한 보관
> - 매일 KST 02:00에 만료 메시지 일괄 처리

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
      "last_message": "안녕하세요",
      "last_message_at": "2026-05-01T12:00:00.000Z",
      "unread_count": 2,
      "partner": {
        "id": 3,
        "name": "김철수",
        "avatar_url": "https://..."
      }
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
{ "partner_user_id": 3 }
```
> ⚠️ **채팅 시작 전 상대방 명함 저장 필수** (`POST /cards/:id/save`)

---

### 8-3. 메시지 목록 (페이지네이션)
```
GET /chat/rooms/:roomId/messages
권한: 🔐 Auth Required (채팅방 참여자)
Query: page, limit, before_id(커서 방식)
```
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 101,
      "content": "안녕하세요",
      "sender_id": 2,
      "created_at": "2026-05-01T12:00:00.000Z",
      "expires_at": "2026-05-02T00:00:00.000Z",  // Free 플랜: 1일 후 만료
      "is_deleted": 0
    }
  ]
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
{ "content": "안녕하세요!", "type": "text" }
```

---

### 8-5. 메시지 삭제
```
DELETE /chat/rooms/:roomId/messages/:msgId
권한: 🔐 Auth Required (메시지 작성자)
```

---

### 8-6. 채팅 신고
```
POST /chat/reports
권한: 🔐 Auth Required
```
```json
// Request
{ "message_id": 101, "reason": "spam" }
```

---

### 8-7. 사용자 차단
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
> **파트너 등록**: 어드민 패널 → 파트너 관리 → 등록 → API 키 자동 발급  
> **WebView 연동**: 파트너 서비스의 `webview_url`을 앱 내 WebView로 오픈

### 9-1. 사용자 매핑
```
POST /partner/map-user
헤더: X-Partner-API-Key: <key>
```
```json
// Request
{ "meti_user_id": 2, "partner_user_id": "happytree_user_abc" }

// Response 200
{ "success": true, "data": { "mapped": true } }
```

---

### 9-2. 리워드 포인트 지급
```
POST /partner/reward
헤더: X-Partner-API-Key: <key>
```
```json
// Request
{
  "meti_user_id": 2,
  "points": 500,
  "description": "HappyTree 운동 목표 달성",
  "idempotency_key": "ht_reward_20260501_001"
}

// Response 200
{ "success": true, "data": { "reward_id": 1, "points_awarded": 500 } }
```

---

### 9-3. 리워드 잔액 조회
```
GET /partner/balance/:metiUserId
헤더: X-Partner-API-Key: <key>
```
```json
// Response 200
{ "success": true, "data": { "balance": 1500, "unit": "P" } }
```

---

### 9-4. 파트너 WebView 연동 (앱 내 실행)

> 앱에서 파트너 서비스(예: 해피트리 게임)를 WebView로 실행하는 방식

```dart
// Flutter WebView 연동 예시
final partnerInfo = await api.get('/admin/partners/${partnerId}');
final webviewUrl = partnerInfo['webview_url'];

// 앱 사용자 인증 토큰을 쿼리 파라미터 또는 헤더로 전달
final authenticatedUrl = Uri.parse(webviewUrl).replace(
  queryParameters: {'meti_token': accessToken}
);

Navigator.push(context, MaterialPageRoute(
  builder: (_) => WebViewPage(url: authenticatedUrl.toString()),
));
```

> ⚠️ **B파트 구현 필요** — 앱용 파트너 목록 조회 API 미구현  
> 현재 파트너 정보는 어드민 전용. 일반 사용자가 접근 가능한 `/partner/services` 엔드포인트 추가 필요

---

## 10. 딥링크 처리 (Flutter 앱)

앱 시작 시 URI를 파싱하여 처리합니다.

| 웹 URL 패턴 | 앱 딥링크 | 동작 |
|------------|---------|------|
| `/card/:id` | `meti://card/:id` | 명함 공개 페이지 — 앱 설치 시 인앱 표시 |
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
      prefs.setString('pending_invite', token);
      Navigator.push(context, MaterialPageRoute(builder: (_) => LoginPage()));
    } else {
      showInviteDialog(context, token);
    }
  } else if (uri.queryParameters.containsKey('token') && uri.path == '/payment') {
    // 결제 완료 콜백 — 주문 상태 새로고침
    refreshOrderStatus();
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
👤 마이     — 프로필, 명함 관리, 포인트, 구독 플랜, 파트너 앱, 설정
```

### 주요 화면 목록
| 화면 | 연결 API |
|------|---------|
| 명함 목록 | `GET /cards` |
| 명함 생성/편집 | `POST /cards`, `PATCH /cards/:id` |
| QR 코드 표시 | `POST /cards/:id/qr-token` |
| QR 스캔 | `GET /cards/qr/:token` |
| 명함첩 | `GET /cards/contacts/list` |
| 그룹 탐색 | `GET /groups` |
| 그룹 상세·멤버·공지 | `GET /groups/:id`, `/members`, `/notices` |
| 초대링크 공유 | `POST /groups/:id/invite-links` |
| 초대 수락 | `POST /auth/invite/:token/join` |
| 행사 목록·상세 | `GET /groups/:groupId/events`, `GET /events/:id` |
| 행사 참가 | `POST /events/:id/join` |
| 레슨 목록·수강신청 | `GET /lessons/groups/:groupId/lessons`, `POST /lessons/:id/register` |
| 결제 (WebView) | `POST /payments/payment-token` → `payment_url` |
| 포인트 현황 | `GET /points/balance`, `GET /points/history` |
| 포인트 이전 | `POST /points/transfer` |
| 포인트 충전 | B파트 — 앱용 충전상품 API 필요 |
| 채팅 | `GET /chat/rooms`, `GET /chat/rooms/:id/messages` |
| 구독 업그레이드 | Apple IAP / Google Play → `POST /payments/subscription/verify-*` |
| 명함 공개 페이지 | `GET /cards/public/:id` (딥링크 `/card/:id`) |
| 그룹 초대 페이지 | `GET /groups/invite/:token` (딥링크 `/invite/:token`) |
| 파트너 앱 (WebView) | B파트 — 파트너 목록 API 필요 |

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
8. **채팅 보관 기간**: Free 1일 / Pro 90일 / Business 무제한 — 만료 메시지는 `is_deleted=1`로 소프트 삭제, UI에서 "삭제된 메시지입니다" 표시 처리 권장

### 💳 결제 주의사항
- 구독(pro/business): 반드시 Apple IAP / Google Play 인앱결제만 사용 (앱 내 "웹에서 결제" 문구 금지)
- 레슨·행사·포인트 충전·명함 추가: WebView(`payment_url`) 또는 외부 브라우저 유도
- 결제 완료 후 `POST /payments/verify-web` 서버 검증 필수

### 📱 네이티브 앱 특화
- **NFC**: 명함 공유 시 NFC 태그 지원 (`entry_method: "nfc_qr"`)
- **QR 스캔**: 카메라 권한 요청 → `GET /cards/qr/:token`
- **딥링크**: `/card/:id`, `/invite/:token`, `/payment?token=xxx` 처리 필수
- **푸시 알림**: 채팅·그룹 공지·행사 알림 (FCM/APNs 별도 연동)
- **파트너 WebView**: 파트너 앱 실행 시 `webview_url`에 인증 토큰 전달

### 🔒 보안
- Access Token / Refresh Token: Keychain(iOS) / Keystore(Android) 저장
- 앱 백그라운드 전환 시 민감 화면 블러 처리
- 생체인증(Face ID / 지문) 앱 잠금 옵션 권장
- 파트너 API 키는 절대 앱에 포함하지 말 것 (서버→서버 전용)

---

## 14. 백엔드 현황 (v3.0 기준)

| 항목 | 상태 |
|------|------|
| 인증 API (JWT, Rotation, 비밀번호 재설정) | ✅ 완료 |
| 명함 API (CRUD, QR, 명함첩, 공개 조회) | ✅ 완료 |
| 명함 공개 페이지 (`/card/:id`) | ✅ 완료 |
| 그룹 API (생성·승인·멤버·역할·공지·초대) | ✅ 완료 |
| 그룹 초대 페이지 (`/invite/:token`) | ✅ 완료 |
| 포인트 API (잔액·내역·이전·그룹) | ✅ 완료 |
| 레슨 API (CRUD, 수강신청·취소) | ✅ 완료 |
| 행사 API (CRUD, 참가·취소) | ✅ 완료 |
| 상품·주문·결제 API (PG Placeholder) | ✅ 완료 |
| 파트너 API (매핑·리워드·잔액) | ✅ 완료 |
| 채팅 API (1:1, 메시지, 신고·차단) | ✅ 완료 |
| **채팅 보관 정책 (plan_configs 동적 설정)** | ✅ 완료 (v3.0) |
| **어드민 주문/결제 관리 UI** | ✅ 완료 (v3.0) |
| **어드민 파트너 관리 (WebView URL + API키)** | ✅ 완료 (v3.0) |
| **어드민 포인트 충전상품 CRUD** | ✅ 완료 (v3.0) |
| **어드민 plan_configs 동적 설정** | ✅ 완료 (v3.0) |
| 어드민 API (유저·그룹·명함·포인트 수동 지급) | ✅ 완료 |
| 어드민 웹 UI (대시보드·유저·그룹·명함·행사·레슨·포인트·주문·파트너·NFC) | ✅ 완료 |
| headhunter 제거 — personal 단일화 | ✅ 완료 (migration 0018) |
| DB 마이그레이션 (0001~0020) | ✅ 프로덕션 적용 완료 |
| 앱용 포인트 충전상품 목록 API | ⚠️ **B파트** — 미구현 |
| 앱용 파트너 서비스 목록 API | ⚠️ **B파트** — 미구현 |
| 행사 체크인 API (`POST /events/:id/checkin`) | ⚠️ **B파트** — 미구현 |
| 이메일 발송 (회원가입·비밀번호 재설정) | ⚠️ **B파트** — 이메일 서비스 연동 필요 |
| 웹 결제 페이지 (`/payment`) | ⏳ **C파트** — PG 키 수령 후 구현 |
| Toss / Stripe 서버사이드 검증 | ⏳ **C파트** — PG 키 수령 후 구현 |
| Apple IAP / Google Play 서버 검증 | ⏳ **C파트** — 앱 연동 후 구현 |
| 채팅 실시간 (WebSocket/SSE) | ⏳ **C파트** — Phase 2 |
| 구독 웹훅 | ⏳ **C파트** — Phase 2 |
| 딥링크 처리 (Flutter 앱 내) | ⏳ **C파트** — 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 (FCM / APNs) | ⏳ **C파트** — 미결정 |

---

## 15. B/C 파트 보완목록 (A 완료 기준)

> A파트 (어드민 보완) 완료 후 남은 작업 목록.  
> **B = 중요도 높음, 빠른 시일 내 구현 권장**  
> **C = 의존성 있거나 Phase 2 예정**

---

### 🟡 B파트 — 백엔드 보완 (빠른 구현 권장)

#### B-1. 앱용 포인트 충전상품 목록 API
```
GET /api/v1/point-charge-products
권한: 🔐 Auth Required
```
- 현재 어드민 CRUD (`/api/v1/admin/point-charge-products`)만 구현됨
- 일반 사용자 앱에서 충전 상품 선택 화면에 필요
- `is_active=1`인 상품만 반환, `sort_order` 순 정렬

#### B-2. 앱용 파트너 서비스 목록 API
```
GET /api/v1/partner/services
권한: 🔐 Auth Required
```
- 현재 어드민 전용 파트너 목록만 구현됨
- 앱 내 "파트너 앱" 탭/섹션에서 이용 가능한 파트너 서비스 표시
- `status=active`인 파트너만 반환
- 반환 필드: `id`, `name`, `description`, `webview_url`, `logo_url`(미구현)

#### B-3. 행사 체크인 API
```
POST /events/:id/checkin
권한: 🔐 Auth Required (행사 참가자)
```
- QR/NFC 스캔 후 참가자 출석 확인
- `event_entry_logs` 테이블에 기록
- 이미 체크인한 경우 `409` 반환

#### B-4. 이메일 발송 연동
- 현재 `verify_token`을 응답 body에 노출 (개발 편의)
- SendGrid / Resend 등 이메일 서비스 연동 → 실제 이메일로 발송
- 영향 엔드포인트: `POST /auth/register`, `POST /auth/forgot-password`

#### B-5. 파일 업로드 (채팅 내 이미지)
- 현재 채팅은 텍스트만 지원
- R2 업로드 후 URL을 메시지 `content`에 포함하는 방식 또는 `type: "image"` 필드 추가

#### B-6. 그룹 상세 어드민 UI 보완
- 현재 `admin-groups.js`에서 멤버 관리, 포인트 내역만 구현
- 그룹별 행사 목록, 레슨 목록, 공지 관리 UI 추가 필요

---

### 🔴 B파트 — 어드민 UI 보완

#### B-7. NFC 카드 배송 관리 UI 보완
- `admin-nfc.js` 현재: 목록/상세/상태변경만 구현
- 추가 필요: 운송장 번호 입력, 택배사 선택, 배송 일괄 처리

#### B-8. 신고 관리 UI 보완
- `admin-reports.js` 현재: 목록/상세/상태변경만 구현
- 추가 필요: 신고 유저 제재 (계정 정지/정상화 버튼), 신고 통계 차트

---

### 🔵 C파트 — 외부 의존성 / Phase 2

#### C-1. PG 결제 서버사이드 검증 (Toss / Stripe)
- `POST /payments/verify-web` — 현재 Placeholder 상태
- Toss Payments API 키 또는 Stripe Secret Key 수령 후 구현
- 결제 금액 위변조 방지 검증 로직 필수

#### C-2. Apple IAP 서버 검증
- `POST /payments/subscription/verify-apple` — 현재 TODO 상태
- Apple App Store Connect API (JWS 검증) 연동 필요

#### C-3. Google Play 구독 검증
- `POST /payments/subscription/verify-google` — 현재 TODO 상태
- Google Play Developer API (service account) 연동 필요

#### C-4. 채팅 실시간 (WebSocket / SSE)
- 현재 폴링(주기적 GET) 방식으로 구현해야 함
- Phase 2에서 Cloudflare Durable Objects 기반 WebSocket 구현 예정

#### C-5. 구독 웹훅 처리
- Apple / Google의 구독 만료·갱신 서버 알림 처리
- `POST /webhooks/apple`, `POST /webhooks/google` 엔드포인트 필요

#### C-6. 푸시 알림 (FCM / APNs)
- 채팅 수신, 그룹 공지, 행사 알림
- Firebase Cloud Messaging 또는 APNs 직접 연동

#### C-7. 채팅 파일 업로드 (B-5 완료 후)
- 이미지/파일 첨부 — R2 업로드 연동

#### C-8. Cron 만료 채팅 삭제 — 별도 Worker 분리
- 현재: `wrangler.jsonc`의 `triggers` 블록이 Pages 환경에서 미지원으로 제거됨
- 해결 방법 옵션:
  1. 별도 Cloudflare Worker 프로젝트로 Cron 처리
  2. 외부 크론 서비스(GitHub Actions, etc.)에서 `POST /cdn-cgi/handler/scheduled` 호출
  3. 요청 시 만료 메시지 필터링 (현재 방식 — DB WHERE 조건으로 처리)
- 현재는 메시지 조회 시 `expires_at <= NOW()` 조건으로 필터링하므로 기능상 문제 없음

---

## 16. 구현 우선순위 권장 순서

```
🟢 즉시 착수 (앱 출시 필수)
  B-1: 앱용 포인트 충전상품 API
  B-2: 앱용 파트너 서비스 목록 API
  B-3: 행사 체크인 API

🟡 출시 전 완료 권장
  B-4: 이메일 발송 연동
  B-6: 그룹 상세 어드민 UI 보완
  B-7: NFC 배송 관리 UI 보완

🔵 PG 키 수령 후
  C-1: Toss / Stripe 검증
  C-2: Apple IAP 검증
  C-3: Google Play 검증

⏳ Phase 2
  C-4: 채팅 WebSocket
  C-5: 구독 웹훅
  C-6: 푸시 알림
```

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v3.0 작성일: 2026-05-26 — A파트 전체 완료 기준*
