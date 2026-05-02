# METI 네이티브 앱 개발 에이전트 시작 프롬프트

## 📌 서비스 개요

**METI(메티)**는 디지털 명함 기반의 글로벌 비즈니스 네트워킹 플랫폼입니다.

- **주요 기능**: 디지털 명함 생성/공유, 그룹 커뮤니티, 이벤트, 1:1 채팅, 리워드
- **타겟**: 글로벌 비즈니스 사용자 (이메일 인증 기반, 소셜 로그인 없음)
- **플랫폼**: iOS / Android 네이티브 앱
- **백엔드**: 이미 완성된 REST API 서버 (Cloudflare Workers + Hono + D1)
- **인증**: JWT (Access Token 1시간, Refresh Token 7일, Token Rotation 방식)

---

## 🏗️ 시스템 아키텍처

```
[iOS / Android 앱]
        ↓  REST API (JSON)
[METI Backend API]  ← 이미 완성됨
  Base URL: https://<배포도메인>/api/v1
        ↓
[Cloudflare D1 (SQLite)]
        ↓
[HappyTree 제휴서비스] ← 파트너 서버-투-서버 연동
```

---

## 🔐 인증 방식

### JWT Token 구조
```
Access Token  : 유효시간 1시간 (모든 인증 API 요청 헤더에 첨부)
Refresh Token : 유효시간 7일  (Token Rotation - 갱신 시 기존 토큰 무효화)
```

### 요청 헤더
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 토큰 갱신 흐름
1. API 요청 → 401 응답 수신
2. `POST /api/v1/auth/refresh` 호출 (refresh_token 전송)
3. 새 access_token + refresh_token 수신 → 로컬 저장
4. 원래 요청 재시도

---

## 📡 공통 응답 형식

```json
// 성공
{
  "success": true,
  "data": { ... },
  "message": "선택적 메시지"
}

// 실패
{
  "success": false,
  "error": "오류 메시지"
}

// 페이지네이션 포함
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true
  }
}
```

---

## 🗂️ 플랜 체계

| 플랜 | 명함 수 | 그룹 가입 | 채팅 | 비고 |
|------|---------|----------|------|------|
| free | 1장 | 가능 | 가능 | 기본 플랜 |
| pro | 무제한 | 가능 | 가능 | 유료 |
| business | 무제한 | 가능 | 가능 | 유료 |

---

## 👤 사용자 역할

| 역할 | 설명 |
|------|------|
| user | 일반 사용자 |
| super_admin | 플랫폼 전체 관리자 |
| group admin | 특정 그룹의 관리자 (group_members.role = 'admin') |

---

# 📋 전체 API 명세

> **Base URL**: `https://<배포도메인>/api/v1`
> **로컬 개발**: `http://localhost:3000/api/v1`
> **실제 테스트 완료** ✅ (로컬 D1 SQLite 기반 검증 완료)

---

## 1. 인증 (Auth)

### 1-1. 회원가입
```
POST /auth/register
권한: Public
```

**Request Body**
```json
{
  "email": "user@example.com",       // required, 이메일 형식
  "password": "Test1234!",           // required, 8자 이상
  "name": "홍길동",                   // required, 2~50자
  "account_type": "personal"         // optional, "personal" | "headhunter" (기본: personal)
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "email": "user@example.com",
    "verify_token": "uuid-..."        // 개발환경에서만 노출, 운영은 이메일 발송
  },
  "message": "회원가입이 완료되었습니다. 이메일을 확인해주세요."
}
```

---

### 1-2. 이메일 인증
```
POST /auth/verify-email
권한: Public
```

**Request Body**
```json
{
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  // required, UUID
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "이메일 인증이 완료되었습니다."
}
```

---

### 1-3. 로그인
```
POST /auth/login
권한: Public
```

**Request Body**
```json
{
  "email": "user@example.com",   // required
  "password": "Test1234!"        // required
}
```

**Response 200**
```json
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
  },
  "message": "로그인 성공"
}
```

**오류 응답**
- `401`: 이메일 또는 비밀번호 불일치
- `403`: 이메일 인증 미완료

---

### 1-4. 토큰 갱신 (Token Rotation)
```
POST /auth/refresh
권한: Public
```

**Request Body**
```json
{
  "refresh_token": "uuid-..."   // required
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "new-uuid-...",   // 기존 토큰 무효화됨
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

**Request Body** (선택)
```json
{
  "refresh_token": "uuid-..."
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "로그아웃되었습니다."
}
```

---

### 1-6. 비밀번호 재설정 요청
```
POST /auth/forgot-password
권한: Public
```

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "reset_token": "uuid-..."    // 개발환경에서만 노출
  },
  "message": "비밀번호 재설정 이메일이 발송되었습니다."
}
```

---

### 1-7. 비밀번호 재설정
```
POST /auth/reset-password
권한: Public
```

**Request Body**
```json
{
  "token": "uuid-...",          // required, 재설정 토큰
  "password": "NewPass1234!"    // required, 8자 이상
}
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "비밀번호가 변경되었습니다."
}
```

---

### 1-8. 내 프로필 조회
```
GET /auth/me
권한: 🔐 Auth Required
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "user@example.com",
    "name": "홍길동",
    "account_type": "personal",
    "plan": "free",
    "plan_expires_at": null,
    "avatar_url": null,
    "is_verified": 1,
    "created_at": "2026-04-28 04:55:28"
  }
}
```

---

## 2. 명함 (Cards)

### 2-1. 내 명함 목록
```
GET /cards
권한: 🔐 Auth Required
```

**Query Parameters**
```
page  : number (기본: 1)
limit : number (기본: 20)
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 2,
      "group_id": null,
      "card_type": "personal",
      "name": "홍길동",
      "title": "시니어 개발자",
      "company": "METI Corp",
      "email": "user@example.com",
      "phone": "010-1234-5678",
      "website": "https://meti.app",
      "bio": "자기소개",
      "avatar_url": null,
      "template_id": "modern_blue",
      "is_primary": 0,
      "is_public": 1,
      "is_active": 1,
      "created_at": "2026-04-28 04:58:44",
      "updated_at": "2026-04-28 04:58:44",
      "sns_count": 1
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1, "has_next": false }
}
```

---

### 2-2. 명함 생성
```
POST /cards
권한: 🔐 Auth Required
⚠️  Free 플랜: 명함 1장 제한
```

**Request Body**
```json
{
  "name": "홍길동",                  // required, 1~100자
  "card_type": "personal",          // optional, "personal" | "group" (기본: personal)
  "group_id": null,                 // optional, 그룹 명함인 경우
  "title": "시니어 개발자",           // optional, 직책
  "company": "METI Corp",           // optional, 회사명
  "email": "user@example.com",      // optional
  "phone": "010-1234-5678",         // optional
  "website": "https://meti.app",    // optional, URL 형식
  "bio": "자기소개 (500자 이내)",     // optional
  "template_id": "modern_blue",     // optional (기본: "default")
  "is_public": 1,                   // optional, 0 | 1 (기본: 1)
  "sns_links": [                    // optional
    {
      "platform": "linkedin",
      "url": "https://linkedin.com/in/...",
      "sort_order": 0
    }
  ],
  "tags": [                         // optional
    {
      "tag_type": "skill",
      "tag_value": "TypeScript"
    }
  ]
}
```

**Response 201**
```json
{
  "success": true,
  "data": { "id": 1, "user_id": 2, "card_type": "personal", "name": "홍길동", ... },
  "message": "명함이 생성되었습니다."
}
```

---

### 2-3. 명함 상세 조회 (인증 필요)
```
GET /cards/:id
권한: 🔐 Auth Required
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    ...모든 필드...,
    "sns_links": [{ "id": 1, "platform": "linkedin", "url": "...", "sort_order": 0 }],
    "tags": []
  }
}
```

---

### 2-4. 공개 명함 조회 (인증 불필요)
```
GET /cards/public/:id
권한: Public
```

---

### 2-5. 명함 수정
```
PATCH /cards/:id
권한: 🔐 Auth Required (소유자만)
```

**Request Body** (모든 필드 optional)
```json
{
  "name": "홍길동 수정",
  "title": "테크 리드",
  "company": "METI",
  "email": "new@email.com",
  "phone": "010-9999-8888",
  "website": "https://new-site.com",
  "bio": "수정된 자기소개",
  "template_id": "classic",
  "is_public": 0,
  "is_primary": 1
}
```

---

### 2-6. 명함 삭제
```
DELETE /cards/:id
권한: 🔐 Auth Required (소유자만)
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "명함이 삭제되었습니다."
}
```

---

### 2-7. QR 토큰 생성
```
POST /cards/:id/qr-token
권한: 🔐 Auth Required (소유자만)
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "token": "uuid-...",
    "expires_at": "2026-04-29T05:03:55.826Z",   // 24시간 유효
    "qr_url": "/cards/qr/uuid-..."
  }
}
```

---

### 2-8. QR 토큰으로 명함 조회
```
GET /cards/qr/:token
권한: Public
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "token": "uuid-...",
    "expires_at": "...",
    "name": "홍길동",
    "title": "시니어 개발자",
    "company": "METI Corp",
    ...모든 명함 필드...,
    "sns_links": [...]
  }
}
```

---

### 2-9. 명함 저장 (명함첩)
```
POST /cards/:id/save
권한: 🔐 Auth Required
⚠️  채팅 사용 전 상대방 명함을 반드시 저장해야 함
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "명함첩에 저장되었습니다."
}
```

---

### 2-10. 저장된 명함 목록 (명함첩)
```
GET /cards/contacts/list
권한: 🔐 Auth Required
```

**Query Parameters**
```
page  : number (기본: 1)
limit : number (기본: 20)
```

---

## 3. 그룹 (Groups)

> 그룹 생성 시 슈퍼어드민 승인 필요 (status: pending → active)

### 3-1. 그룹 목록
```
GET /groups
권한: Public
```

**Query Parameters**
```
page     : number (기본: 1)
limit    : number (기본: 20)
q        : string (그룹명 검색)
category : "association" | "company" | "club" | "other"
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "METI 개발자 모임",
      "description": "...",
      "logo_url": null,
      "category": "club",
      "visibility": "public",
      "status": "active",
      "plan": "free",
      "max_members": null,
      "admin_user_id": 2,
      "admin_name": "홍길동",
      "member_count": 1,
      "created_at": "..."
    }
  ],
  "pagination": { ... }
}
```

---

### 3-2. 그룹 생성 신청
```
POST /groups
권한: 🔐 Auth Required
⚠️  슈퍼어드민 승인 후 활성화
```

**Request Body**
```json
{
  "name": "METI 개발자 모임",          // required, 그룹명 (고유)
  "description": "그룹 설명",          // optional
  "category": "club",                  // optional, "association"|"company"|"club"|"other"
  "visibility": "public",             // optional, "public"|"private" (기본: public)
  "custom_join_fields": null          // optional, JSON 문자열 (가입 시 추가 입력 필드)
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "group_id": 1,
    "status": "pending",
    "message": "그룹 개설 신청이 완료되었습니다. 슈퍼관리자 승인 후 활성화됩니다."
  }
}
```

---

### 3-3. 그룹 상세 조회
```
GET /groups/:id
권한: Public (공개) / 🔐 Auth Required (비공개)
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "METI 개발자 모임",
    "description": "...",
    "logo_url": null,
    "category": "club",
    "visibility": "public",
    "status": "active",
    "plan": "free",
    "max_members": null,
    "admin_user_id": 2,
    "admin_name": "홍길동",
    "member_count": 1,
    "photos": [],
    "created_at": "..."
  }
}
```

---

### 3-4. 그룹 가입 신청
```
POST /groups/:id/join
권한: 🔐 Auth Required
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "그룹 가입이 완료되었습니다." // 또는 "가입 신청이 완료되었습니다. 승인 대기 중입니다."
}
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
권한: 🔐 Auth Required (그룹 어드민)
```

**Query Parameters**
```
page   : number
limit  : number
status : "active" | "pending" | "banned"
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "group_id": 1,
      "user_id": 2,
      "role": "admin",             // "admin" | "member"
      "status": "active",
      "joined_at": "...",
      "name": "홍길동",
      "email": "user@example.com",
      "avatar_url": null,
      "account_type": "personal"
    }
  ],
  "pagination": { ... }
}
```

---

### 3-7. 멤버 상태/역할 변경
```
PATCH /groups/:id/members/:userId
권한: 🔐 Auth Required (그룹 어드민)
```

**Request Body**
```json
{
  "status": "approved",    // optional, "approved" | "rejected" | "banned"
  "role": "admin"          // optional, "admin" | "member"
}
```

---

### 3-8. 그룹 공지 목록
```
GET /groups/:id/notices
권한: Public
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "group_id": 1,
      "author_id": 2,
      "title": "첫 번째 공지",
      "content": "공지 내용",
      "is_pinned": 0,
      "created_at": "...",
      "author_name": "홍길동"
    }
  ],
  "pagination": { ... }
}
```

---

### 3-9. 그룹 공지 작성
```
POST /groups/:id/notices
권한: 🔐 Auth Required (그룹 어드민)
```

**Request Body**
```json
{
  "title": "공지 제목",     // required
  "content": "공지 내용"   // required
}
```

**Response 201**
```json
{
  "success": true,
  "data": { "notice_id": 1 },
  "message": "공지사항이 등록되었습니다."
}
```

---

### 3-10. 어드민 권한 이전 신청
```
POST /groups/:id/transfer-admin
권한: 🔐 Auth Required (그룹 어드민)
```

---

## 4. 이벤트 (Events)

### 4-1. 이벤트 목록
```
GET /events
권한: Public
```

**Query Parameters**
```
page     : number (기본: 1)
limit    : number (기본: 20)
group_id : number (특정 그룹 이벤트만)
status   : "upcoming" | "ongoing" | "ended"
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "group_id": 1,
      "organizer_id": 2,
      "title": "METI 네트워킹 밋업",
      "description": "...",
      "thumbnail_url": null,
      "location": "서울 강남구",
      "starts_at": "2026-05-15T18:00:00Z",
      "ends_at": "2026-05-15T21:00:00Z",
      "visibility": "public",
      "registration_type": "free",
      "entry_method": "qr",
      "max_participants": 50,
      "status": "upcoming",
      "group_name": "METI 개발자 모임",
      "organizer_name": "홍길동",
      "participant_count": 0,
      "created_at": "..."
    }
  ],
  "pagination": { ... }
}
```

---

### 4-2. 이벤트 생성
```
POST /events
권한: 🔐 Auth Required (그룹 어드민 / 슈퍼어드민)
```

**Request Body**
```json
{
  "group_id": 1,                        // required
  "title": "METI 네트워킹 밋업",          // required, 2~200자
  "description": "이벤트 설명",           // optional
  "thumbnail_url": null,                // optional, URL 형식
  "location": "서울 강남구",             // optional
  "starts_at": "2026-05-15T18:00:00Z", // required, ISO 8601
  "ends_at": "2026-05-15T21:00:00Z",   // optional, ISO 8601
  "visibility": "public",              // optional, "public" | "group_only"
  "registration_type": "free",         // optional, "free" | "pre_required"
  "entry_method": "qr",               // optional, "nfc_qr" | "qr" | "manual"
  "max_participants": 50               // optional
}
```

---

### 4-3. 이벤트 상세 조회
```
GET /events/:id
권한: Public
```

---

### 4-4. 이벤트 참가 신청
```
POST /events/:id/join
권한: 🔐 Auth Required
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "행사 참가 신청이 완료되었습니다."
}
```

---

### 4-5. 이벤트 체크인 (QR/NFC)
```
POST /events/:id/checkin
권한: 🔐 Auth Required (이벤트 어드민)
```

**Request Body**
```json
{
  "user_id": 3,       // optional (직접 지정)
  "qr_token": "uuid-..." // optional (QR 스캔)
}
```

---

### 4-6. 이벤트 참가자 목록
```
GET /events/:id/participants
권한: 🔐 Auth Required
```

---

## 5. 채팅 (Chat)

> ⚠️ **중요**: 명함을 저장(`POST /cards/:id/save`)한 상대방과만 채팅 가능

### 5-1. 채팅방 목록
```
GET /chat
권한: 🔐 Auth Required
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "room_type": "direct",
      "last_message": "안녕하세요!",
      "last_message_at": "...",
      "unread_count": 0,
      "members": [...]
    }
  ]
}
```

---

### 5-2. 1:1 채팅방 생성/조회
```
POST /chat/direct
권한: 🔐 Auth Required
⚠️  명함 교환(저장) 선행 필요
```

**Request Body**
```json
{
  "target_user_id": 3    // required
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "room_id": 1,
    "is_new": true     // true: 새로 생성, false: 기존 방 반환
  }
}
```

---

### 5-3. 메시지 목록 (커서 기반 페이지네이션)
```
GET /chat/:roomId/messages
권한: 🔐 Auth Required (채팅방 참여자)
```

**Query Parameters**
```
before : number (이 ID 이전 메시지 조회, 커서)
limit  : number (기본: 20)
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "room_id": 1,
      "sender_id": 2,
      "message_type": "text",
      "content": "안녕하세요!",
      "file_url": null,
      "card_id": null,
      "is_pinned": 0,
      "is_deleted": 0,
      "expires_at": "2026-04-29T00:00:00.000Z",
      "created_at": "...",
      "sender_name": "홍길동",
      "sender_avatar": null
    }
  ],
  "pagination": { ... }
}
```

---

### 5-4. 메시지 전송
```
POST /chat/:roomId/messages
권한: 🔐 Auth Required (채팅방 참여자)
```

**Request Body**
```json
{
  "content": "안녕하세요!",     // optional (text/card 타입)
  "message_type": "text",      // optional, "text"|"image"|"file"|"card" (기본: text)
  "file_url": null,             // optional, 파일/이미지 URL
  "card_id": null               // optional, 명함 공유 시
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "room_id": 1,
    "sender_id": 2,
    "message_type": "text",
    "content": "안녕하세요!",
    "expires_at": "2026-04-29T00:00:00.000Z",
    "created_at": "..."
  }
}
```

---

### 5-5. 메시지 삭제
```
DELETE /chat/:roomId/messages/:msgId
권한: 🔐 Auth Required (발신자만)
```

---

### 5-6. 신고
```
POST /chat/report
권한: 🔐 Auth Required
```

**Request Body**
```json
{
  "target_type": "message",    // required, "user"|"message"|"card"|"group"
  "target_id": 1,              // required
  "reason": "스팸 메시지",      // required, 1~200자
  "description": "상세 설명"   // optional, ~1000자
}
```

---

### 5-7. 사용자 차단
```
POST /chat/block
권한: 🔐 Auth Required
```

**Request Body**
```json
{
  "blocked_user_id": 3    // required
}
```

---

## 6. 파트너 연동 (Partner)

> ⚠️ **서버-투-서버(S2S) 전용** — 앱에서 직접 호출하지 않음
> 파트너 API Key는 어드민이 발급, 헤더에 `X-Partner-API-Key` 첨부

### 6-1. 사용자 매핑
```
POST /partner/user-map
권한: X-Partner-API-Key
```

**Request Body**
```json
{
  "meti_user_id": 2    // required, METI 사용자 ID
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "external_user_key": "hash-string..."    // 파트너 시스템에서 사용할 키
  }
}
```

---

### 6-2. 리워드 지급
```
POST /partner/reward
권한: X-Partner-API-Key
```

**Request Body**
```json
{
  "external_user_key": "hash-string...",   // required, 매핑된 키
  "event_type": "first_login",             // required, 이벤트 유형
  "points": 500,                           // required, 1~10000
  "payload": {}                            // optional, 추가 데이터
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "points_awarded": 500,
    "new_balance": 1000
  },
  "message": "리워드가 지급되었습니다."
}
```

---

### 6-3. 리워드 잔액 조회
```
GET /partner/user-balance?external_user_key=<key>
권한: X-Partner-API-Key
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "points": 1000
  }
}
```

---

## 7. 공통 에러 코드

| HTTP 상태 | 설명 |
|-----------|------|
| 400 | 요청 형식 오류, 필수 파라미터 누락 |
| 401 | Authorization 헤더 없음 또는 토큰 만료/무효 |
| 403 | 권한 없음 (이메일 미인증, 플랜 제한, 역할 부족) |
| 404 | 요청한 리소스 없음 |
| 409 | 충돌 (중복 이메일, 이미 가입된 그룹 등) |
| 422 | 유효성 검사 실패 (Zod 오류) |
| 500 | 서버 내부 오류 |

---

## 8. 앱 화면 구성 제안

### 인증 플로우
```
스플래시 → 온보딩 → 로그인 / 회원가입 → 이메일 인증 대기 → 메인 홈
```

### 메인 탭 구성 (하단 네비게이션)
```
🏠 홈       - 내 명함, 최근 저장된 명함, 빠른 QR 공유
👥 그룹     - 그룹 탐색, 내 그룹 목록
📅 이벤트   - 이벤트 목록, 참가 중인 이벤트
💬 채팅     - 채팅방 목록, 메시지
👤 마이     - 프로필, 설정, 리워드 잔액, 플랜
```

### 주요 화면 목록
| 화면 | 설명 |
|------|------|
| 명함 목록 | 내 명함들 + 생성 버튼 |
| 명함 생성/편집 | 템플릿 선택, 정보 입력, SNS 링크 추가 |
| QR 코드 표시 | 명함 QR 코드 전체 화면 표시 |
| QR 스캔 | 카메라로 상대방 QR 스캔 → 명함 상세 → 저장 |
| NFC 공유 | NFC 탭으로 명함 공유 |
| 명함첩 | 저장된 명함 목록 + 검색 |
| 그룹 탐색 | 카테고리별 그룹 검색 |
| 그룹 상세 | 그룹 정보, 공지, 멤버, 이벤트 |
| 이벤트 체크인 | QR 스캔으로 이벤트 입장 |
| 채팅 | 메시지 목록, 전송, 명함 공유 |
| 리워드 | 포인트 잔액, 내역 |

---

## 9. 개발 시 주의사항

### ⚠️ 필수 로직
1. **토큰 자동 갱신**: 401 응답 시 자동으로 `POST /auth/refresh` 호출 후 재시도
2. **명함 저장 선행**: 채팅 시작 전 반드시 상대방 명함 저장 필요
3. **그룹 승인 대기**: 그룹 생성 후 `status: pending` → 어드민 승인 전까지 비활성
4. **Free 플랜 제한**: 명함 1장만 생성 가능 (추가 시 403 응답)
5. **이벤트 필드명**: `event_date` ❌ → `starts_at` ✅ (ISO 8601)

### 📱 네이티브 앱 특화 기능
- **NFC**: 명함 공유 시 NFC 태그 지원 (`entry_method: "nfc_qr"`)
- **QR 스캔**: `GET /cards/qr/:token` 로 명함 조회
- **이벤트 체크인**: `POST /events/:id/checkin` 으로 QR/NFC 스캔 체크인
- **푸시 알림**: 채팅 메시지, 그룹 공지, 이벤트 알림 (별도 FCM/APNs 연동 필요)

### 🔒 보안
- Access Token과 Refresh Token은 안전한 로컬 저장소 사용 (Keychain/Keystore)
- 앱 백그라운드 전환 시 민감 화면 가리기
- 생체인증(Face ID / 지문) 앱 잠금 옵션 권장

---

## 10. 백엔드 현황

| 항목 | 상태 |
|------|------|
| DB 설계 | ✅ 완료 (9개 마이그레이션 파일) |
| 인증 API | ✅ 완료 및 테스트 통과 |
| 명함 API | ✅ 완료 및 테스트 통과 |
| 그룹 API | ✅ 완료 및 테스트 통과 |
| 이벤트 API | ✅ 완료 및 테스트 통과 |
| 채팅 API | ✅ 완료 및 테스트 통과 |
| 파트너 API | ✅ 완료 및 테스트 통과 |
| 어드민 API | ✅ 완료 및 테스트 통과 |
| Cloudflare 배포 | 🔜 진행 예정 |
| Admin Web UI | 🔜 진행 예정 |

---

*본 문서는 METI 백엔드 실제 구현 코드 기반으로 로컬 테스트 완료 후 작성되었습니다.*
*작성일: 2026-04-28*
