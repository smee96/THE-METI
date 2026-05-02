# METI 네이티브 앱 개발 에이전트 프롬프트 v2.0

> **최종 업데이트**: 2026-05-02  
> **버전**: v2.0 (미성년자 보호 / 보호자 연결 / 그룹 레슨 기능 추가)  
> **전달 대상**: iOS / Android 네이티브 앱 개발팀

---

## 1. 서비스 개요

**METI**는 디지털 명함 기반의 글로벌 네트워킹 플랫폼입니다.

| 항목 | 내용 |
|---|---|
| 서비스명 | METI (명함 기반 네트워킹) |
| 플랫폼 | iOS / Android 네이티브 앱 |
| 백엔드 | Cloudflare Workers + Hono + D1 (SQLite) |
| 인증 방식 | JWT (Access Token + Refresh Token) |
| API Base URL | `https://the-meti.pages.dev/api/v1` |
| 로컬 개발 URL | `http://localhost:3000/api/v1` |

### 주요 기능
- 디지털 명함 생성 / 공유 / QR 스캔
- 그룹 커뮤니티 (일반 그룹 / 레슨·스터디 그룹)
- 행사(이벤트) 생성·참여·출석 체크
- 1:1 채팅 (저장된 명함 상대방과만 가능)
- 포인트 리워드
- **미성년자 보호 (보호자 연결 / 레슨 그룹 출석 관리)** ← NEW

---

## 2. 인증 방식

### 요청 헤더
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 토큰 스펙
| 항목 | 값 |
|---|---|
| Access Token 유효기간 | 7일 |
| Refresh Token 유효기간 | 30일 |
| 토큰 방식 | HS256 JWT |
| 토큰 로테이션 | 리프레시 시 기존 토큰 폐기, 신규 발급 |

### 공통 응답 포맷
```json
// 성공
{
  "success": true,
  "data": { ... },
  "message": "처리 완료"
}

// 목록 (페이지네이션)
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}

// 실패
{
  "success": false,
  "error": "오류 메시지"
}
```

### 공통 HTTP 에러 코드
| 코드 | 의미 |
|---|---|
| 400 | 잘못된 요청 (필수값 누락, 형식 오류) |
| 401 | 인증 실패 (토큰 없음 / 만료) |
| 403 | 권한 없음 (플랜 초과, 역할 부족) |
| 404 | 리소스 없음 |
| 409 | 충돌 (이메일 중복, 이미 가입된 그룹 등) |
| 422 | 유효성 검사 실패 |
| 500 | 서버 오류 |

---

## 3. 플랜 정책

| 플랜 | 명함 생성 | 그룹 참여 | 채팅 | 비고 |
|---|---|---|---|---|
| **free** | **최대 3개** | 가능 | 가능 | 기본 무료 플랜 |
| **pro** | 최대 10개 | 가능 | 가능 | 유료 |
| **business** | 무제한 | 가능 | 가능 | 유료 |

> ⚠️ **중요**: free 플랜은 명함 3개까지 무료, 4개부터는 pro/business 플랜 업그레이드 필요  
> 명함 생성 시 한도 초과하면 `403` + `"upgrade_required": true` 응답

---

## 4. 사용자 유형

| user_type | 설명 |
|---|---|
| `ADULT` | 성인 (기본값) |
| `MINOR` | 미성년자 (보호자 연결 후 자동 설정) |

| role | 설명 |
|---|---|
| `user` | 일반 사용자 |
| `super_admin` | 플랫폼 관리자 |

---

## 5. API 명세

---

### 5-1. 인증 (Auth)

#### POST `/auth/register` — 회원가입
- **인증**: 불필요 (Public)
```json
// Request Body
{
  "email": "user@example.com",        // required, 유효한 이메일
  "password": "password123",          // required, 최소 8자
  "name": "홍길동",                    // required, 2~50자
  "account_type": "personal"          // optional, "personal" | "headhunter" (기본: personal)
}
```
```json
// Response 201
{
  "success": true,
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "verify_token": "uuid-token"       // 개발환경에서만 노출, 프로덕션 제거 예정
  },
  "message": "이메일 인증을 완료해주세요."
}
```

#### POST `/auth/verify-email` — 이메일 인증
- **인증**: 불필요 (Public)
```json
// Request Body
{ "token": "uuid-token" }
```
```json
// Response 200
{ "success": true, "message": "이메일 인증이 완료되었습니다." }
```

#### POST `/auth/login` — 로그인
- **인증**: 불필요 (Public)
```json
// Request Body
{
  "email": "user@example.com",
  "password": "password123"
}
```
```json
// Response 200
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "Bearer",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "account_type": "personal",
      "plan": "free",
      "user_type": "ADULT",
      "role": "user",
      "avatar_url": null
    }
  }
}
```
- 에러: `401` 잘못된 비밀번호, `403` 이메일 미인증

#### POST `/auth/refresh` — 토큰 갱신
- **인증**: 불필요 (Public)
```json
// Request Body
{ "refresh_token": "eyJ..." }
```
```json
// Response 200
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ..."
  }
}
```

#### POST `/auth/logout` — 로그아웃
- **인증**: 필요
```json
// Request Body (optional)
{ "refresh_token": "eyJ..." }
```

#### POST `/auth/forgot-password` — 비밀번호 재설정 요청
- **인증**: 불필요 (Public)
```json
// Request Body
{ "email": "user@example.com" }
```
```json
// Response 200
{ "success": true, "data": { "reset_token": "uuid" } }   // 개발환경만 노출
```

#### POST `/auth/reset-password` — 비밀번호 재설정
- **인증**: 불필요 (Public)
```json
// Request Body
{
  "token": "uuid-reset-token",
  "password": "newpassword123"         // 최소 8자
}
```

#### PUT `/auth/password` — 비밀번호 변경
- **인증**: 필요
```json
// Request Body
{
  "current_password": "old123",
  "new_password": "new456789"
}
```

#### GET `/auth/me` — 내 프로필 조회
- **인증**: 필요
```json
// Response 200
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "account_type": "personal",
    "plan": "free",
    "avatar_url": null,
    "user_type": "ADULT",
    "birth_date": null,
    "phone": null,
    "role": "user",
    "is_verified": 1,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

### 5-2. 명함 (Cards)

#### GET `/cards` — 내 명함 목록
- **인증**: 필요
- 쿼리: `page` (기본 1), `limit` (기본 20)
```json
// Response 200 (pagination)
{
  "data": [{
    "id": 1,
    "user_id": 1,
    "group_id": null,
    "card_type": "personal",
    "name": "홍길동",
    "title": "CTO",
    "company": "METI Inc.",
    "email": "user@example.com",
    "phone": "010-1234-5678",
    "website": "https://meti.io",
    "bio": "소개글",
    "avatar_url": null,
    "template_id": "default",
    "is_public": 1,
    "is_primary": 1,
    "sns_count": 2,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }]
}
```

#### POST `/cards` — 명함 생성
- **인증**: 필요
- ⚠️ **free 플랜 3개 초과 시 `403` + `"upgrade_required": true` 반환**
```json
// Request Body
{
  "name": "홍길동",                    // required, 1~100자
  "card_type": "personal",            // optional, "personal" | "group" (기본: personal)
  "group_id": null,                   // optional, 그룹 명함일 경우 그룹 ID
  "title": "CTO",                     // optional
  "company": "METI Inc.",             // optional
  "email": "user@example.com",        // optional
  "phone": "010-1234-5678",           // optional
  "website": "https://meti.io",       // optional
  "bio": "소개글",                     // optional, 최대 500자
  "template_id": "default",           // optional
  "is_public": 1,                     // optional, 0|1 (기본: 1)
  "sns_links": [                      // optional
    { "platform": "instagram", "url": "https://instagram.com/...", "sort_order": 0 }
  ],
  "tags": [                           // optional
    { "tag_type": "skill", "tag_value": "React" }
  ]
}
```
```json
// Response 201
{ "success": true, "data": { "card_id": 5 } }
```

#### GET `/cards/:id` — 명함 상세 (본인)
- **인증**: 필요

#### GET `/cards/public/:id` — 명함 공개 조회
- **인증**: 불필요 (Public)

#### PATCH `/cards/:id` — 명함 수정
- **인증**: 필요 (본인만)
- Body: 명함 생성과 동일 필드, 모두 optional

#### DELETE `/cards/:id` — 명함 삭제
- **인증**: 필요 (본인만)

#### POST `/cards/:id/qr-token` — QR 토큰 생성
- **인증**: 필요 (본인만)
```json
// Response 200
{
  "success": true,
  "data": {
    "token": "qr-uuid-token",
    "expires_at": "2026-01-02T00:00:00Z",
    "qr_url": "https://the-meti.pages.dev/api/v1/cards/qr/qr-uuid-token"
  }
}
```

#### GET `/cards/qr/:token` — QR 토큰으로 명함 조회
- **인증**: 불필요 (Public)

#### POST `/cards/:id/save` — 명함 저장 (연락처 추가)
- **인증**: 필요
- ℹ️ 채팅을 시작하려면 반드시 먼저 상대방 명함을 저장해야 합니다.

#### GET `/cards/contacts/list` — 저장된 명함(연락처) 목록
- **인증**: 필요
- 쿼리: `page`, `limit`

---

### 5-3. 그룹 (Groups)

#### GET `/groups` — 공개 그룹 목록
- **인증**: 불필요 (Public)
- 쿼리: `page`, `limit`, `q` (검색어), `category` (association|company|club|other), `group_type` (NORMAL|LESSON)
```json
// Response 200 (pagination)
{
  "data": [{
    "id": 1,
    "name": "METI 스터디",
    "description": "...",
    "logo_url": null,
    "category": "club",
    "group_type": "NORMAL",            // NEW: NORMAL | LESSON
    "lesson_config": null,             // NEW: LESSON 그룹 전용 설정 (아래 참조)
    "visibility": "public",
    "status": "active",
    "plan": "free",
    "member_count": 10,
    "admin_name": "홍길동",
    "admin_user_id": 1,
    "created_at": "2026-01-01T00:00:00Z"
  }]
}
```

#### POST `/groups` — 그룹 생성
- **인증**: 필요
```json
// Request Body
{
  "name": "피아노 레슨반",              // required, 2~100자
  "description": "설명",               // optional, 최대 1000자
  "category": "other",                // optional, association|company|club|other (기본: other)
  "visibility": "public",             // optional, public|private (기본: public)
  "group_type": "LESSON",             // optional, NORMAL|LESSON (기본: NORMAL)  ← NEW
  "lesson_config": {                  // optional, LESSON 그룹일 때 설정  ← NEW
    "allow_minor": true,              // 미성년자 참여 허용
    "require_guardian": true,         // 보호자 동의 필수
    "subject": "피아노",               // 레슨 과목
    "schedule": "매주 화/목 오후 3시",  // 스케줄 텍스트
    "lesson_fee": 50000               // 레슨비 (0=무료)
  },
  "custom_join_fields": "학교명,학년"   // optional, 가입 시 추가 입력 필드
}
```
```json
// Response 201
{
  "success": true,
  "data": { "group_id": 3, "status": "pending" },
  "message": "그룹 생성 요청이 완료되었습니다."
}
```
> ℹ️ 생성 후 상태는 `pending` → 슈퍼 어드민 승인 후 `active`

#### GET `/groups/:id` — 그룹 상세
- **인증**: public 그룹은 불필요 / private 그룹은 필요

#### POST `/groups/:id/join` — 그룹 가입 요청
- **인증**: 필요
```json
// Request Body (optional)
{ "join_fields": { "학교명": "METI고등학교", "학년": "2" } }
```

#### DELETE `/groups/:id/leave` — 그룹 탈퇴
- **인증**: 필요

#### GET `/groups/:id/members` — 멤버 목록 (그룹 관리자용)
- **인증**: 필요 (admin/sub_admin)
- 쿼리: `page`, `limit`, `status` (active|pending|rejected)
```json
// Response 200 (pagination)
{
  "data": [{
    "user_id": 2,
    "name": "김철수",
    "email": "kim@example.com",
    "role": "member",
    "status": "active",
    "user_type": "MINOR",              // NEW
    "guardian_user_id": 5,             // NEW: MINOR인 경우 보호자 ID
    "guardian_name": "김부모",          // NEW
    "joined_at": "2026-01-01T00:00:00Z"
  }]
}
```

#### PATCH `/groups/:id/members/:userId` — 멤버 상태 변경
- **인증**: 필요 (admin)
```json
// Request Body
{
  "action": "approve",     // approve | reject | kick
  "role": "member"         // optional
}
```

#### GET `/groups/:id/notices` — 그룹 공지 목록
- **인증**: 불필요 (Public)

#### POST `/groups/:id/notices` — 공지 작성
- **인증**: 필요 (admin/sub_admin/executive)
```json
// Request Body
{
  "title": "공지 제목",    // required, 1~200자
  "content": "내용",       // required
  "is_pinned": 0           // optional, 0|1
}
```

#### POST `/groups/:id/transfer-admin` — 그룹 관리자 이전
- **인증**: 필요 (현재 admin)
```json
// Request Body
{ "to_user_id": 5 }
```

---

### 5-4. 행사 (Events)

#### GET `/events` — 행사 목록
- **인증**: 불필요 (Public)
- 쿼리: `page`, `limit`, `group_id`, `status` (upcoming|ongoing|ended)
```json
// Response 200 (pagination)
{
  "data": [{
    "id": 1,
    "group_id": 1,
    "group_name": "METI 스터디",
    "title": "2026 네트워킹 행사",
    "description": "...",
    "thumbnail_url": null,
    "location": "서울 강남구",
    "starts_at": "2026-06-01T10:00:00Z",
    "ends_at": "2026-06-01T18:00:00Z",
    "visibility": "public",
    "registration_type": "pre_required",
    "entry_method": "qr",
    "max_participants": 100,
    "status": "upcoming",
    "participant_count": 23,
    "organizer_name": "홍길동"
  }]
}
```

#### POST `/events` — 행사 생성
- **인증**: 필요 (그룹 admin 또는 super_admin)
```json
// Request Body
{
  "group_id": 1,                        // required
  "title": "행사 제목",                  // required, 2~200자
  "description": "설명",                // optional
  "thumbnail_url": "https://...",       // optional
  "location": "장소",                   // optional
  "starts_at": "2026-06-01T10:00:00Z", // required, ISO8601
  "ends_at": "2026-06-01T18:00:00Z",   // optional, ISO8601
  "visibility": "public",              // optional, public|group_only (기본: public)
  "registration_type": "free",         // optional, free|pre_required (기본: free)
  "entry_method": "qr",               // optional, nfc_qr|qr|manual (기본: qr)
  "max_participants": 100              // optional
}
```
```json
// Response 201
{ "success": true, "data": { "event_id": 10 } }
```

#### GET `/events/:id` — 행사 상세
- **인증**: 불필요 (Public)

#### POST `/events/:id/join` — 행사 참가 신청
- **인증**: 필요

#### POST `/events/:id/checkin` — 출석 체크인
- **인증**: 필요 (행사 관리자)
```json
// Request Body
{
  "qr_token": "token-string",   // optional, QR 방식
  "user_id": 5,                 // optional, 수동 체크인
  "entry_method": "qr"          // optional
}
```

#### GET `/events/:id/participants` — 참가자 목록
- **인증**: 필요 (행사 관리자)
- 쿼리: `page`, `limit`, `status`

---

### 5-5. 채팅 (Chat)

> ⚠️ **채팅 선제조건**: 상대방의 명함을 먼저 `POST /cards/:id/save`로 저장해야 채팅 개설 가능

#### GET `/chat` — 채팅방 목록
- **인증**: 필요
```json
// Response 200
{
  "data": [{
    "id": 1,
    "room_type": "direct",
    "last_message": { "content": "안녕하세요", "created_at": "..." },
    "unread_count": 3,
    "members": [{ "id": 2, "name": "김철수", "avatar_url": null }]
  }]
}
```

#### POST `/chat/direct` — 1:1 채팅방 개설
- **인증**: 필요
```json
// Request Body
{ "target_user_id": 2 }
```
```json
// Response 200
{ "success": true, "data": { "room_id": 1, "is_new": true } }
```

#### GET `/chat/:roomId/messages` — 메시지 목록
- **인증**: 필요 (채팅방 멤버)
- 쿼리: `before` (메시지 ID, 커서 방식), `limit` (기본 20)
```json
// Response 200
{
  "data": [{
    "id": 100,
    "sender_id": 1,
    "sender_name": "홍길동",
    "sender_avatar": null,
    "content": "안녕하세요",
    "message_type": "text",
    "file_url": null,
    "card_id": null,
    "is_pinned": 0,
    "expires_at": null,
    "created_at": "2026-01-01T00:00:00Z"
  }]
}
```

#### POST `/chat/:roomId/messages` — 메시지 전송
- **인증**: 필요 (채팅방 멤버)
```json
// Request Body
{
  "content": "안녕하세요",            // optional
  "message_type": "text",            // optional, text|image|file|card (기본: text)
  "file_url": "https://...",         // optional, 파일/이미지 URL
  "card_id": null                    // optional, 명함 공유 시 card ID
}
```

#### DELETE `/chat/:roomId/messages/:msgId` — 메시지 삭제
- **인증**: 필요 (본인 메시지만)

#### POST `/chat/report` — 신고
- **인증**: 필요
```json
// Request Body
{
  "target_type": "user",             // user|message|card|group
  "target_id": 5,
  "reason": "스팸",
  "description": "상세 설명"          // optional
}
```

#### POST `/chat/block` — 차단
- **인증**: 필요
```json
// Request Body
{ "blocked_user_id": 5 }
```

---

### 5-6. 보호자 연결 (Guardians) ← NEW

> 미성년자(MINOR) 회원의 활동을 보호자 또는 강사가 관리할 수 있는 기능입니다.  
> 그룹 스터디, 레슨 등 미성년자가 참여하는 그룹에 활용됩니다.

#### POST `/guardians/link` — 보호자-학생 연결 요청
- **인증**: 필요 (ADULT만 가능)
```json
// Request Body
{
  "minor_user_id": 10,               // optional, 학생 user ID
  "minor_email": "student@ex.com",   // optional, 학생 이메일 (둘 중 하나는 필수)
  "relation": "parent",              // optional, "parent" | "teacher" (기본: parent)
  "group_id": 3                      // optional, 특정 레슨 그룹과 연결
}
```
```json
// Response 201
{
  "success": true,
  "data": {
    "minor_user_id": 10,
    "guardian_user_id": 5,
    "relation": "parent",
    "status": "pending"
  },
  "message": "보호자 연결 요청이 발송되었습니다."
}
```

#### POST `/guardians/link/:requestId/accept` — 연결 요청 수락
- **인증**: 필요 (학생 본인 또는 super_admin)
- 수락 시 학생의 `user_type`이 자동으로 `MINOR`로 변경됨

#### POST `/guardians/link/:requestId/reject` — 연결 요청 거절
- **인증**: 필요 (학생 본인)

#### GET `/guardians` — 보호자/학생 목록 조회
- **인증**: 필요
- 쿼리: `role` — `mine` (내 보호자 목록, 기본) | `students` (내가 담당하는 학생 목록)
```json
// role=students 응답 예시
{
  "data": [{
    "id": 1,
    "relation": "teacher",
    "status": "active",
    "accepted_at": "2026-01-01T00:00:00Z",
    "student_id": 10,
    "student_name": "김학생",
    "student_email": "student@ex.com",
    "user_type": "MINOR",
    "birth_date": "2010-05-15",
    "avatar_url": null
  }]
}
```

#### GET `/guardians/pending` — 대기 중인 연결 요청 목록
- **인증**: 필요 (학생 본인)
```json
// Response 200
{
  "success": true,
  "data": [{
    "id": 1,
    "relation": "parent",
    "created_at": "...",
    "guardian_id": 5,
    "guardian_name": "김부모",
    "guardian_email": "parent@ex.com"
  }]
}
```

#### DELETE `/guardians/:guardianUserId` — 보호자 연결 해제
- **인증**: 필요 (학생 본인)

#### GET `/guardians/lesson-groups` — 담당 학생들의 레슨 그룹 목록
- **인증**: 필요 (보호자/강사)
```json
// Response 200
{
  "success": true,
  "data": [{
    "id": 3,
    "name": "피아노 레슨반",
    "group_type": "LESSON",
    "lesson_config": { "subject": "피아노", ... },
    "member_count": 8
  }]
}
```

---

### 5-7. 레슨 관리 (Lessons) ← NEW

> `group_type = "LESSON"`인 그룹에서만 사용 가능한 레슨 일정 및 출석 관리 API입니다.

#### GET `/lessons/:groupId/schedules` — 레슨 일정 목록
- **인증**: 필요 (그룹 멤버 또는 담당 보호자)
- 쿼리: `page`, `limit`, `status` (scheduled|ongoing|completed|cancelled)
```json
// Response 200 (pagination)
{
  "data": [{
    "id": 1,
    "group_id": 3,
    "title": "3월 2주차 피아노 레슨",
    "description": null,
    "instructor_id": 5,
    "instructor_name": "박강사",
    "starts_at": "2026-03-10T15:00:00Z",
    "ends_at": "2026-03-10T16:00:00Z",
    "location": "강남 음악학원 3호실",
    "max_students": 10,
    "status": "scheduled",
    "present_count": 0,
    "total_students": 8
  }]
}
```

#### POST `/lessons/:groupId/schedules` — 레슨 일정 생성
- **인증**: 필요 (그룹 admin/sub_admin — 강사)
```json
// Request Body
{
  "title": "3월 2주차 피아노 레슨",      // required, 1~200자
  "description": "특이사항 없음",        // optional
  "starts_at": "2026-03-10T15:00:00Z", // required, ISO8601
  "ends_at": "2026-03-10T16:00:00Z",   // optional
  "location": "강남 음악학원 3호실",     // optional, 최대 200자
  "max_students": 10                   // optional
}
```
```json
// Response 201
{ "success": true, "data": { "schedule_id": 7 }, "message": "레슨 일정이 생성되었습니다." }
```

#### GET `/lessons/:groupId/schedules/:scheduleId` — 레슨 일정 상세 + 출석 현황
- **인증**: 필요 (멤버/보호자)
- 강사/관리자: 전체 학생 출석 현황 반환
- 일반 보호자: 담당 학생 출석만 반환
```json
// Response 200
{
  "success": true,
  "data": {
    "id": 7,
    "title": "3월 2주차 피아노 레슨",
    "instructor_name": "박강사",
    "starts_at": "2026-03-10T15:00:00Z",
    "status": "completed",
    "attendances": [
      {
        "student_id": 10,
        "name": "김학생",
        "user_type": "MINOR",
        "status": "present",          // present | absent | late | excused
        "checked_at": "2026-03-10T15:05:00Z",
        "note": null
      }
    ]
  }
}
```

#### POST `/lessons/:groupId/schedules/:scheduleId/attendance` — 출석 처리
- **인증**: 필요 (강사 — 그룹 admin/sub_admin)
```json
// Request Body
{
  "attendances": [
    { "student_id": 10, "status": "present", "note": null },
    { "student_id": 11, "status": "absent", "note": "감기" },
    { "student_id": 12, "status": "late", "note": null },
    { "student_id": 13, "status": "excused", "note": "경조사" }
  ]
}
```
```json
// Response 200
{ "success": true, "data": { "processed": 4 }, "message": "출석이 처리되었습니다." }
```

> ℹ️ 출석 처리 시 일정 `status`가 `scheduled` → `ongoing`으로 자동 변경됩니다.  
> ℹ️ 동일 일정에 재처리 시 기존 기록이 업데이트됩니다 (upsert).

#### GET `/lessons/:groupId/students` — 레슨 그룹 학생 목록
- **인증**: 필요 (강사 — 그룹 admin/sub_admin)
```json
// Response 200
{
  "success": true,
  "data": [{
    "id": 10,
    "name": "김학생",
    "email": "student@ex.com",
    "user_type": "MINOR",
    "birth_date": "2010-05-15",
    "avatar_url": null,
    "guardian_name": "김부모",
    "guardian_email": "parent@ex.com",
    "guardian_relation": "parent",
    "present_count": 12,
    "total_lessons": 15
  }]
}
```

---

### 5-8. 리워드 / 파트너 (Partner — 서버 간 통신)

> ⚠️ 앱에서 직접 호출하지 않음. 파트너 서버 → METI 백엔드 간 서버-서버 통신.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/partner/user-map` | 유저 매핑 (`X-Partner-API-Key` 헤더) |
| POST | `/partner/reward` | 포인트 적립 |
| GET | `/partner/user-balance` | 포인트 잔액 조회 |

---

## 6. 미성년자 보호 정책

앱 개발 시 반드시 준수해야 할 미성년자 보호 정책입니다.

### 6-1. 데이터 보호 규칙

| 항목 | ADULT | MINOR |
|---|---|---|
| 기본 프로필 공개 | 공개 가능 | 기본 비공개 |
| 연락처 (전화번호) 표시 | 표시 | **숨김 처리** |
| 외부 공유 | 가능 | **제한** |
| 그룹 외부에서 프로필 조회 | 가능 | 같은 그룹 내에서만 허용 |
| 리워드 직접 수령 | 가능 | **보호자 계정으로 지급** |

### 6-2. MINOR 판별 흐름

```
사용자 등록 (user_type = 'ADULT' 기본값)
    ↓
보호자가 POST /guardians/link 요청
    ↓
학생이 POST /guardians/link/:id/accept 수락
    ↓
학생의 user_type이 자동으로 'MINOR'로 변경
```

### 6-3. 레슨 그룹 미성년자 가입 흐름

```
1. 강사가 group_type = "LESSON" 그룹 생성
   lesson_config.require_guardian = true 설정 시
   
2. 학생이 그룹 가입 신청
   (lesson_config.allow_minor = true 인 그룹만 가능)

3. 강사가 학생 계정에 보호자 연결 요청
   POST /guardians/link (relation: "teacher")

4. 학생(또는 보호자)이 연결 수락
   → 학생 user_type이 MINOR로 변경

5. 강사가 레슨 일정 생성
   POST /lessons/:groupId/schedules

6. 강사가 출석 처리
   POST /lessons/:groupId/schedules/:scheduleId/attendance

7. 보호자가 담당 학생 출석 현황 확인
   GET /lessons/:groupId/schedules/:scheduleId
   (보호자 계정으로 조회 시 본인 담당 학생 출석만 반환)
```

### 6-4. 앱 UI 가이드라인

- MINOR 유저의 명함에는 전화번호 필드를 **표시하지 않을 것**
- MINOR 유저에게 리워드 지급 UI 노출 시 **"보호자 계정으로 지급됩니다"** 안내 표시
- 보호자 역할 사용자(relation = teacher/parent)는 학생 출석 현황을 조회할 수 있는 **전용 탭/화면** 제공 권장
- 레슨 그룹 생성 시 `group_type: LESSON` 옵션 선택 UI 제공 (일반 그룹과 구분)

---

## 7. 앱 개발 주요 유의사항

### 토큰 관리
- Access Token 만료 전 자동 갱신 로직 구현 필요
- Refresh Token 갱신 시 기존 토큰은 즉시 폐기됨
- 401 응답 수신 시 → Refresh Token으로 갱신 → 실패 시 로그아웃

### 명함 플랜 제한
- 명함 생성 전 현재 보유 명함 수를 확인하여 UI에서 제한 안내
- `403` + `"upgrade_required": true` 응답 수신 시 플랜 업그레이드 화면으로 유도
- **Free: 3개 / Pro: 10개 / Business: 무제한**

### QR / NFC 처리
- QR 코드 = `/api/v1/cards/qr/:token` URL 형태
- QR 토큰 유효기간 = **24시간**
- NFC 카드 = 별도 오프라인 신청 후 발급 (어드민 처리)

### 채팅
- 상대방 명함을 저장(`POST /cards/:id/save`)해야만 채팅 개설 가능
- 채팅 메시지 페이지네이션은 **커서 방식** (`before` 파라미터 = 가장 오래된 메시지 ID)

### 그룹
- 그룹 생성 후 상태는 `pending` → **어드민 승인 후** `active` 상태로 변경됨
- LESSON 타입 그룹은 레슨 일정/출석 관리 탭이 필요

---

## 8. 화면별 API 호출 맵

| 화면 | 주요 API |
|---|---|
| 스플래시 / 토큰 확인 | `GET /auth/me` |
| 회원가입 | `POST /auth/register` → `POST /auth/verify-email` |
| 로그인 | `POST /auth/login` |
| 홈 / 명함 목록 | `GET /cards` |
| 명함 생성 | `POST /cards` |
| 명함 QR 공유 | `POST /cards/:id/qr-token` |
| QR 스캔 결과 | `GET /cards/qr/:token` → `POST /cards/:id/save` |
| 연락처 목록 | `GET /cards/contacts/list` |
| 그룹 탐색 | `GET /groups` |
| 그룹 상세 | `GET /groups/:id` |
| 그룹 가입 | `POST /groups/:id/join` |
| 그룹 공지 | `GET /groups/:id/notices` |
| 행사 목록 | `GET /events` |
| 행사 참가 | `POST /events/:id/join` |
| 채팅 목록 | `GET /chat` |
| 채팅방 입장 | `GET /chat/:roomId/messages` |
| 메시지 전송 | `POST /chat/:roomId/messages` |
| 내 설정 | `GET /auth/me`, `PUT /auth/password` |
| 보호자 연결 요청 (강사) | `POST /guardians/link` |
| 보호자 연결 수락 (학생) | `GET /guardians/pending` → `POST /guardians/link/:id/accept` |
| 담당 학생 목록 (보호자) | `GET /guardians?role=students` |
| 레슨 일정 목록 | `GET /lessons/:groupId/schedules` |
| 레슨 일정 생성 (강사) | `POST /lessons/:groupId/schedules` |
| 출석 처리 (강사) | `POST /lessons/:groupId/schedules/:scheduleId/attendance` |
| 출석 현황 확인 (보호자) | `GET /lessons/:groupId/schedules/:scheduleId` |
| 담당 레슨 그룹 (보호자) | `GET /guardians/lesson-groups` |

---

## 9. 백엔드 구현 상태

| 모듈 | 상태 | 비고 |
|---|---|---|
| 인증 (Auth) | ✅ 완료 | JWT, 이메일 인증 |
| 명함 (Cards) | ✅ 완료 | QR, SNS 링크, 플랜별 제한 |
| 그룹 (Groups) | ✅ 완료 | NORMAL/LESSON 타입 지원 |
| 행사 (Events) | ✅ 완료 | 참가/체크인 |
| 채팅 (Chat) | ✅ 완료 | 1:1 직접 채팅, 신고/차단 |
| 보호자 연결 (Guardians) | ✅ 완료 | parent/teacher relation |
| 레슨 관리 (Lessons) | ✅ 완료 | 일정/출석/학생 관리 |
| 파트너 (Partner) | ✅ 완료 | 서버 간 통신 |
| 어드민 (Admin Web) | ✅ 완료 | 웹 어드민 별도 제공 |

---

## 10. 연락처

| 역할 | 담당 |
|---|---|
| 백엔드 API | METI 백엔드팀 |
| 어드민 웹 | https://the-meti.pages.dev/admin |
| 어드민 계정 | admin@the-meti.io / MetiAdmin2026! |

---

*이 문서는 METI 백엔드 구현 기준으로 작성되었습니다. API 추가/변경 시 문서가 업데이트됩니다.*
