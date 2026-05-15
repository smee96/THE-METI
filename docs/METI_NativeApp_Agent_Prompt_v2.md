# METI 네이티브 앱 개발 에이전트 프롬프트 v2.1

> **최종 업데이트**: 2026-05-02  
> **버전**: v2.1 (미성년자 정책 단순화 — 초대 링크 Lite 계정 방식)  
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

### 핵심 기능
- 디지털 명함 생성 / 공유 / QR 스캔
- 그룹 커뮤니티 (일반 그룹 / 레슨 그룹 — 수영, 테니스, 피아노 등)
- 행사(이벤트) 생성 · 참여 · 출석 체크
- 1:1 채팅 (저장된 명함 상대방과만 가능)
- 포인트 리워드
- **미성년자 Lite 계정** — 초대 링크로만 가입, 그룹 기능만 이용

---

## 2. 계정 유형 (중요)

METI에는 두 가지 계정 유형이 있습니다.

### 일반 계정 (ADULT)
- 이메일 + 비밀번호로 일반 회원가입
- 이메일 인증 필요
- 플랫폼 전체 기능 이용 가능

### Lite 계정 (MINOR / ADULT 자동 판별)
- **그룹 초대 링크를 통해서만 가입 가능**
- 이름 + 생년월일 + PIN(4~8자리)만 입력
- 이메일 인증 없음, 즉시 가입 완료
- 가입 즉시 해당 그룹 멤버로 등록
- **생년월일 기준 만 19세 미만 → `MINOR` 자동 분류**
- **만 19세 이상 → `ADULT`로 분류** (성인도 편의상 초대 링크로 가입 가능)

### user_type별 이용 가능 기능

| 기능 | ADULT (일반) | MINOR (Lite) |
|---|---|---|
| 명함 생성 · 공유 | ✅ | ❌ |
| QR 명함 교환 | ✅ | ❌ |
| 그룹 탐색 · 자유 가입 | ✅ | ❌ |
| **그룹 공지 조회** | ✅ | ✅ |
| **레슨 일정 조회** | ✅ | ✅ |
| **본인 출석 현황 조회** | ✅ | ✅ |
| **그룹 탈퇴** | ✅ | ✅ |
| 행사 탐색 · 참여 | ✅ | ❌ |
| 1:1 채팅 | ✅ | ❌ |
| 리워드 | ✅ | ❌ |

> ⚠️ MINOR 계정이 차단된 API에 접근하면 `403` + `"minor_restricted": true` 반환

---

## 3. 인증 방식

### 일반 계정 요청 헤더
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Lite 계정 (초대 링크 가입자) 로그인
- 이메일 없음 → **이름 + 초대 토큰 + PIN** 으로 로그인
- 로그인 후 발급된 JWT는 일반 계정과 동일하게 사용

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
{ "success": true, "data": { ... }, "message": "처리 완료" }

// 목록 (페이지네이션)
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "total_pages": 5 }
}

// 실패
{ "success": false, "error": "오류 메시지" }

// 미성년자 접근 차단
{ "success": false, "error": "미성년자 계정은 그룹 및 레슨 기능만 이용할 수 있습니다.", "minor_restricted": true }
```

### 공통 HTTP 에러 코드
| 코드 | 의미 |
|---|---|
| 400 | 잘못된 요청 |
| 401 | 인증 실패 (토큰 없음 / 만료) |
| 403 | 권한 없음 (플랜 초과 / MINOR 제한 / 역할 부족) |
| 404 | 리소스 없음 |
| 409 | 충돌 (이미 가입된 그룹 등) |
| 410 | 만료 / 비활성 (초대 링크 만료 등) |
| 422 | 유효성 검사 실패 |
| 500 | 서버 오류 |

---

## 4. 플랜 정책

| 플랜 | 명함 | 비고 |
|---|---|---|
| **free** | **최대 3개** | 기본 무료, 초과 시 `403` + `"upgrade_required": true` |
| **pro** | 최대 10개 | 유료 |
| **business** | 무제한 | 유료 |

> Lite 계정(초대 링크 가입)은 항상 `free` 플랜이며, 명함 기능 자체를 이용하지 않습니다.

---

## 5. API 명세

---

### 5-1. 인증 (Auth)

#### POST `/auth/register` — 일반 회원가입
- **인증**: 불필요 (Public)
```json
// Request Body
{
  "email": "user@example.com",      // required
  "password": "password123",        // required, 최소 8자
  "name": "홍길동",                  // required, 2~50자
  "account_type": "personal",       // optional, "personal" | "headhunter" (기본: personal)
  "birth_date": "1990-05-15"        // optional, YYYY-MM-DD (만 19세 미만이면 MINOR 자동 설정)
}
```
```json
// Response 201
{
  "success": true,
  "data": { "user_id": 1, "email": "user@example.com", "verify_token": "uuid" },
  "message": "이메일 인증을 완료해주세요."
}
```

#### POST `/auth/verify-email` — 이메일 인증
```json
// Request Body
{ "token": "uuid-token" }
```

#### POST `/auth/login` — 일반 로그인
```json
// Request Body
{ "email": "user@example.com", "password": "password123" }
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
      "id": 1, "email": "user@example.com", "name": "홍길동",
      "account_type": "personal", "plan": "free",
      "user_type": "ADULT", "role": "user"
    }
  }
}
```

#### POST `/auth/refresh` — 토큰 갱신
```json
// Request Body
{ "refresh_token": "eyJ..." }
```

#### POST `/auth/logout` — 로그아웃 (인증 필요)
```json
// Request Body (optional)
{ "refresh_token": "eyJ..." }
```

#### POST `/auth/forgot-password` — 비밀번호 재설정 요청
```json
// Request Body
{ "email": "user@example.com" }
```

#### POST `/auth/reset-password` — 비밀번호 재설정
```json
// Request Body
{ "token": "uuid-reset-token", "password": "newpassword123" }
```

#### PUT `/auth/password` — 비밀번호 변경 (인증 필요)
```json
// Request Body
{ "current_password": "old123", "new_password": "new456789" }
```

#### GET `/auth/me` — 내 프로필 조회 (인증 필요)
```json
// Response 200
{
  "success": true,
  "data": {
    "id": 1, "email": "user@example.com", "name": "홍길동",
    "account_type": "personal", "plan": "free",
    "user_type": "ADULT",   // ADULT | MINOR
    "role": "user",
    "avatar_url": null, "is_verified": 1, "created_at": "..."
  }
}
```

---

### 5-2. 초대 링크 가입 (Lite 계정 — 미성년자용) ← 핵심 NEW

> 수영, 테니스, 피아노 등 레슨 그룹에 미성년자(또는 성인)를 초대할 때 사용합니다.  
> 강사/관리자가 초대 링크를 생성 → 카카오톡/문자로 공유 → 클릭 후 최소 정보 입력으로 가입

#### GET `/auth/invite/:token` — 초대 링크 정보 조회 (가입 전 미리보기)
- **인증**: 불필요 (Public)
- 앱에서 초대 링크 클릭 시 먼저 이 API로 그룹 정보 표시 후 가입 유도
```json
// Response 200
{
  "success": true,
  "data": {
    "token": "uuid-invite-token",
    "label": "2026 봄 수영반",
    "group": {
      "id": 3,
      "name": "한강 수영 레슨",
      "description": "초중급 수영 레슨입니다.",
      "logo_url": null,
      "group_type": "LESSON",
      "lesson_config": {
        "allow_minor": true,
        "subject": "수영",
        "schedule": "매주 화/목 오후 4시",
        "lesson_fee": 80000
      },
      "instructor_name": "박코치"
    }
  }
}
```
- 에러: `404` 유효하지 않은 링크, `410` 만료/비활성/정원 초과

#### POST `/auth/invite/:token/join` — 초대 링크로 가입 (Lite 계정 생성)
- **인증**: 불필요 (Public)
- ⚠️ 이메일 인증 없음 / 이메일 불필요
- ⚠️ 생년월일 기준 만 19세 미만 → `user_type: MINOR` 자동 설정
- ⚠️ 가입 즉시 그룹 멤버 `active` 상태로 등록 (승인 불필요)
```json
// Request Body
{
  "name": "김수영",                  // required, 1~50자
  "birth_date": "2012-08-20",       // required, YYYY-MM-DD (나이 자동 판별)
  "pin": "1234",                    // required, 4~8자리 숫자/문자 (PIN 로그인용)
  "contact": "010-1234-5678"        // optional, 보호자/강사 연락용 (전화번호 등)
}
```
```json
// Response 201
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "Bearer",
    "user": {
      "id": 50,
      "name": "김수영",
      "user_type": "MINOR",         // 만 19세 미만이면 MINOR
      "group_id": 3,                // 즉시 가입된 그룹 ID
      "plan": "free",
      "role": "user"
    }
  },
  "message": "김수영님, 환영합니다! 그룹에 참여되었습니다."
}
```

#### POST `/auth/invite/:token/login` — Lite 계정 PIN 로그인
- **인증**: 불필요 (Public)
- 이메일 없음 → **초대 토큰 + 이름 + PIN** 조합으로 로그인
```json
// Request Body
{
  "name": "김수영",     // 가입 시 입력한 이름
  "pin": "1234"         // 가입 시 설정한 PIN
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
      "id": 50, "name": "김수영", "user_type": "MINOR",
      "group_id": 3, "plan": "free", "role": "user"
    }
  }
}
```

---

### 5-3. 명함 (Cards) — ADULT 전용

> ⚠️ MINOR 계정은 모든 `/cards/*` API 접근 불가 (`403` + `minor_restricted: true`)

#### GET `/cards` — 내 명함 목록 (인증 필요)
- 쿼리: `page`, `limit`

#### POST `/cards` — 명함 생성 (인증 필요)
- **free 플랜 3개 초과 시 `403` + `"upgrade_required": true`**
```json
// Request Body
{
  "name": "홍길동",                  // required
  "card_type": "personal",          // optional, personal | group
  "group_id": null,                 // optional
  "title": "CTO", "company": "METI Inc.",
  "email": "user@example.com", "phone": "010-0000-0000",
  "website": "https://meti.io", "bio": "소개글",
  "template_id": "default", "is_public": 1,
  "sns_links": [{ "platform": "instagram", "url": "https://...", "sort_order": 0 }],
  "tags": [{ "tag_type": "skill", "tag_value": "React" }]
}
```

#### GET `/cards/:id` — 명함 상세 (인증 필요, 본인)
#### GET `/cards/public/:id` — 명함 공개 조회 (Public)
#### PATCH `/cards/:id` — 명함 수정 (인증 필요, 본인)
#### DELETE `/cards/:id` — 명함 삭제 (인증 필요, 본인)
#### POST `/cards/:id/qr-token` — QR 토큰 생성 (유효기간 24시간)
#### GET `/cards/qr/:token` — QR 토큰으로 명함 조회 (Public)
#### POST `/cards/:id/save` — 명함 저장 (채팅 전 필수)
#### GET `/cards/contacts/list` — 저장된 연락처 목록

---

### 5-4. 그룹 (Groups)

> ✅ MINOR 계정도 소속 그룹 조회, 공지 조회, 탈퇴 가능

#### GET `/groups` — 공개 그룹 목록 (Public)
- 쿼리: `page`, `limit`, `q`, `category`, `group_type` (NORMAL|LESSON)
```json
// Response data 항목
{
  "id": 3, "name": "한강 수영 레슨", "description": "...",
  "group_type": "LESSON",           // NORMAL | LESSON
  "lesson_config": {                // LESSON 그룹만 존재
    "allow_minor": true,
    "subject": "수영",
    "schedule": "매주 화/목 오후 4시",
    "lesson_fee": 80000
  },
  "category": "other", "visibility": "public",
  "status": "active", "member_count": 12, "admin_name": "박코치"
}
```

#### POST `/groups` — 그룹 생성 (인증 필요, ADULT)
```json
// Request Body
{
  "name": "한강 수영 레슨",          // required
  "description": "설명",            // optional
  "category": "other",             // optional
  "visibility": "public",          // optional, public | private
  "group_type": "LESSON",          // optional, NORMAL | LESSON (기본: NORMAL)
  "lesson_config": {               // optional, LESSON 그룹일 때
    "allow_minor": true,
    "subject": "수영",
    "schedule": "매주 화/목 오후 4시",
    "lesson_fee": 80000
  },
  "custom_join_fields": "학교명,학년"
}
```
> 생성 후 상태 `pending` → 어드민 승인 후 `active`

#### GET `/groups/:id` — 그룹 상세 (Public / private는 인증 필요)
#### POST `/groups/:id/join` — 그룹 가입 신청 (인증 필요, ADULT)
#### DELETE `/groups/:id/leave` — 그룹 탈퇴 (인증 필요, ADULT & MINOR 모두 가능)
#### GET `/groups/:id/members` — 멤버 목록 (인증 필요, 그룹 admin)
- 쿼리: `page`, `limit`, `status`
```json
// Response data 항목
{
  "user_id": 50, "name": "김수영", "user_type": "MINOR",
  "role": "member", "status": "active", "joined_at": "..."
}
```

#### PATCH `/groups/:id/members/:userId` — 멤버 승인/거절/강퇴 (인증 필요, admin)
```json
// Request Body
{ "action": "approve", "role": "member" }  // action: approve | reject | kick
```

#### GET `/groups/:id/notices` — 공지 목록 (Public, MINOR도 조회 가능)
#### POST `/groups/:id/notices` — 공지 작성 (인증 필요, admin/sub_admin)
```json
// Request Body
{ "title": "공지 제목", "content": "내용", "is_pinned": 0 }
```

#### POST `/groups/:id/transfer-admin` — 관리자 권한 이임 (인증 필요, admin)
```json
// Request Body
{ "to_user_id": 5 }
```

---

### 5-5. 그룹 초대 링크 관리 (Groups — 관리자용) ← NEW

> 강사/그룹 관리자가 초대 링크를 생성 · 관리합니다.

#### POST `/groups/:id/invite-links` — 초대 링크 생성 (인증 필요, 그룹 admin)
```json
// Request Body
{
  "label": "2026 봄 수영반",        // optional, 링크 구분용 이름
  "max_uses": 20,                   // optional, 최대 사용 횟수 (미입력 = 무제한)
  "expires_days": 30                // optional, 만료 일수 (미입력 = 무기한)
}
```
```json
// Response 201
{
  "success": true,
  "data": {
    "token": "uuid-invite-token",
    "invite_url": "https://the-meti.pages.dev/invite/uuid-invite-token",
    "label": "2026 봄 수영반",
    "max_uses": 20,
    "expires_at": "2026-06-01T00:00:00Z"
  },
  "message": "초대 링크가 생성되었습니다."
}
```

#### GET `/groups/:id/invite-links` — 초대 링크 목록 (인증 필요, 그룹 admin)
```json
// Response data 항목
{
  "id": 1, "token": "uuid...",
  "invite_url": "https://the-meti.pages.dev/invite/uuid...",
  "label": "2026 봄 수영반",
  "max_uses": 20, "used_count": 7,
  "expires_at": "2026-06-01T00:00:00Z",
  "is_active": 1,
  "created_by_name": "박코치", "created_at": "..."
}
```

#### PATCH `/groups/:id/invite-links/:linkId/deactivate` — 링크 비활성화 (인증 필요, 그룹 admin)

---

### 5-6. 레슨 관리 (Lessons) — LESSON 그룹 전용

> `group_type = "LESSON"` 그룹에서만 사용 가능.  
> ✅ MINOR 계정도 일정 조회 및 본인 출석 현황 조회 가능

#### GET `/lessons/:groupId/schedules` — 레슨 일정 목록 (인증 필요, 그룹 멤버)
- 쿼리: `page`, `limit`, `status` (scheduled|ongoing|completed|cancelled)
```json
// Response data 항목
{
  "id": 7, "title": "3월 2주차 수영 레슨",
  "instructor_name": "박코치",
  "starts_at": "2026-03-10T16:00:00Z",
  "ends_at": "2026-03-10T17:00:00Z",
  "location": "한강 수영장 3레인",
  "status": "scheduled",
  "present_count": 0, "total_students": 8
}
```

#### POST `/lessons/:groupId/schedules` — 레슨 일정 생성 (인증 필요, 그룹 admin/sub_admin)
```json
// Request Body
{
  "title": "3월 2주차 수영 레슨",    // required
  "description": null,             // optional
  "starts_at": "2026-03-10T16:00:00Z",  // required
  "ends_at": "2026-03-10T17:00:00Z",    // optional
  "location": "한강 수영장 3레인",        // optional
  "max_students": 10               // optional
}
```

#### GET `/lessons/:groupId/schedules/:scheduleId` — 레슨 상세 + 출석 현황 (인증 필요)
- 강사: 전체 학생 출석 현황
- 일반 멤버(MINOR 포함): 본인 출석만
```json
// Response data
{
  "id": 7, "title": "3월 2주차 수영 레슨",
  "instructor_name": "박코치",
  "status": "completed",
  "attendances": [
    {
      "student_id": 50, "name": "김수영",
      "user_type": "MINOR",
      "status": "present",         // present | absent | late | excused
      "checked_at": "2026-03-10T16:05:00Z", "note": null
    }
  ]
}
```

#### POST `/lessons/:groupId/schedules/:scheduleId/attendance` — 출석 처리 (인증 필요, 강사)
```json
// Request Body
{
  "attendances": [
    { "student_id": 50, "status": "present", "note": null },
    { "student_id": 51, "status": "absent", "note": "감기" },
    { "student_id": 52, "status": "late", "note": null },
    { "student_id": 53, "status": "excused", "note": "경조사" }
  ]
}
```
> ℹ️ 동일 일정 재처리 시 upsert (기존 기록 덮어쓰기)

#### GET `/lessons/:groupId/students` — 학생 목록 (인증 필요, 강사)
```json
// Response data 항목
{
  "id": 50, "name": "김수영",
  "user_type": "MINOR", "birth_date": "2012-08-20",
  "contact": "010-1234-5678",     // 가입 시 입력한 연락처
  "present_count": 12, "total_lessons": 15
}
```

---

### 5-7. 행사 (Events) — ADULT 전용

> ⚠️ MINOR 계정은 모든 `/events/*` API 접근 불가

#### GET `/events` — 행사 목록 (Public)
- 쿼리: `page`, `limit`, `group_id`, `status`

#### POST `/events` — 행사 생성 (인증 필요, 그룹 admin)
```json
// Request Body
{
  "group_id": 1, "title": "행사 제목",
  "description": null, "thumbnail_url": null,
  "location": "서울 강남",
  "starts_at": "2026-06-01T10:00:00Z",
  "ends_at": "2026-06-01T18:00:00Z",
  "visibility": "public",          // public | group_only
  "registration_type": "free",     // free | pre_required
  "entry_method": "qr",            // nfc_qr | qr | manual
  "max_participants": 100
}
```

#### GET `/events/:id` — 행사 상세 (Public)
#### POST `/events/:id/join` — 행사 참가 신청 (인증 필요)
#### POST `/events/:id/checkin` — 출석 체크인 (인증 필요, 행사 admin)
```json
// Request Body
{ "qr_token": "token", "user_id": 5, "entry_method": "qr" }
```
#### GET `/events/:id/participants` — 참가자 목록 (인증 필요, 행사 admin)

---

### 5-8. 채팅 (Chat) — ADULT 전용

> ⚠️ MINOR 계정은 모든 `/chat/*` API 접근 불가  
> ⚠️ 채팅 선제조건: `POST /cards/:id/save`로 상대방 명함 저장 후에만 채팅 가능

#### GET `/chat` — 채팅방 목록 (인증 필요)
#### POST `/chat/direct` — 1:1 채팅방 개설 (인증 필요)
```json
// Request Body
{ "target_user_id": 2 }
```
#### GET `/chat/:roomId/messages` — 메시지 목록 (인증 필요, 커서 방식)
- 쿼리: `before` (메시지 ID), `limit`
#### POST `/chat/:roomId/messages` — 메시지 전송 (인증 필요)
```json
// Request Body
{
  "content": "안녕하세요",
  "message_type": "text",          // text | image | file | card
  "file_url": null, "card_id": null
}
```
#### DELETE `/chat/:roomId/messages/:msgId` — 메시지 삭제 (인증 필요, 본인)
#### POST `/chat/report` — 신고 (인증 필요)
```json
// Request Body
{ "target_type": "user", "target_id": 5, "reason": "스팸", "description": null }
```
#### POST `/chat/block` — 차단 (인증 필요)
```json
// Request Body
{ "blocked_user_id": 5 }
```

---

### 5-9. 파트너 / 리워드 (Partner — 서버 간 통신)

> ⚠️ 앱에서 직접 호출하지 않음. 파트너 서버 → METI 백엔드 서버 간 통신

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/partner/user-map` | 유저 매핑 (`X-Partner-API-Key` 헤더) |
| POST | `/partner/reward` | 포인트 적립 |
| GET | `/partner/user-balance` | 포인트 잔액 조회 |

---

## 6. 미성년자 Lite 계정 전체 흐름

### 강사 → 학생 초대 흐름

```
[강사/그룹 관리자 — 앱 또는 어드민 웹]
  1. 레슨 그룹 생성 (group_type: LESSON)
     POST /groups
  2. 초대 링크 생성
     POST /groups/:id/invite-links
     → invite_url: "https://the-meti.pages.dev/invite/uuid-token"
  3. 링크를 카카오톡 / 문자로 학생/학부모에게 전달

[학생 — 앱]
  4. 링크 클릭 → 딥링크로 앱 실행 또는 앱스토어 안내
  5. 앱에서 초대 링크 미리보기
     GET /auth/invite/:token
     → 그룹 이름, 강사 이름, 레슨 정보 표시
  6. "참여하기" 버튼 → 최소 정보 입력
     이름 / 생년월일 / PIN 4자리
     POST /auth/invite/:token/join
     → 즉시 로그인 상태, 그룹 멤버 등록 완료

[이후 학생 재로그인]
  POST /auth/invite/:token/login
  이름 + PIN 입력
```

### 학생 앱 화면 구성 (MINOR 계정)

```
홈
 ├── 내 그룹 (소속된 그룹 목록)
 │    └── 그룹 상세
 │         ├── 공지사항
 │         └── 레슨 일정
 │              └── 일정 상세 (본인 출석 현황)
 └── 내 정보 (이름, 생년월일만 표시)
```

> 명함, 행사, 채팅, 리워드 탭은 MINOR 계정에 노출하지 않을 것을 권장합니다.  
> (API 레벨에서도 차단되지만, 앱 UI에서도 아예 숨기는 것이 UX상 올바릅니다)

---

## 7. 앱 개발 주요 유의사항

### Lite 계정 (초대 링크 가입자)
- 이메일이 내부 생성값(`invite_xxx@meti.internal`)이므로 UI에 이메일 노출 금지
- 로그인 화면은 **"일반 로그인"** 탭과 **"초대 링크로 로그인"** 탭 분리 권장
- MINOR 계정 로그인 후 홈 화면에서 명함/채팅/행사 탭 비표시 처리

### 초대 링크 딥링크 처리
- URL 스킴: `meti://invite/:token` 또는 Universal Link `https://the-meti.pages.dev/invite/:token`
- 앱 미설치 시 웹 랜딩 → 앱스토어 유도
- 앱 설치 시 초대 링크 가입 화면으로 바로 이동

### 토큰 관리
- Access Token 만료 시 Refresh Token으로 자동 갱신
- 401 응답 시 → Refresh 시도 → 실패 시 로그아웃

### 명함 플랜 제한
- `403` + `"upgrade_required": true` 수신 시 업그레이드 유도 화면
- **Free: 3개 / Pro: 10개 / Business: 무제한**

### QR 처리
- QR 토큰 유효기간: **24시간**
- QR URL: `/api/v1/cards/qr/:token`

---

## 8. 화면별 API 호출 맵

| 화면 | 주요 API | 계정 |
|---|---|---|
| 스플래시 / 인증 확인 | `GET /auth/me` | 모두 |
| 일반 회원가입 | `POST /auth/register` → `POST /auth/verify-email` | ADULT |
| 일반 로그인 | `POST /auth/login` | ADULT |
| **초대 링크 진입** | `GET /auth/invite/:token` | 누구나 |
| **초대 링크 가입** | `POST /auth/invite/:token/join` | 누구나 |
| **Lite 계정 로그인** | `POST /auth/invite/:token/login` | Lite |
| 홈 / 명함 목록 | `GET /cards` | ADULT |
| 명함 생성 | `POST /cards` | ADULT |
| QR 명함 공유 | `POST /cards/:id/qr-token` | ADULT |
| QR 스캔 후 | `GET /cards/qr/:token` → `POST /cards/:id/save` | ADULT |
| 연락처 목록 | `GET /cards/contacts/list` | ADULT |
| 그룹 탐색 | `GET /groups` | ADULT |
| **내 그룹 (Lite)** | `GET /groups/:id` | MINOR |
| **그룹 공지 (Lite)** | `GET /groups/:id/notices` | MINOR |
| **레슨 일정 목록 (Lite)** | `GET /lessons/:groupId/schedules` | MINOR |
| **레슨 상세 / 출석 (Lite)** | `GET /lessons/:groupId/schedules/:scheduleId` | MINOR |
| 행사 목록 | `GET /events` | ADULT |
| 채팅 목록 | `GET /chat` | ADULT |
| 채팅방 | `GET /chat/:roomId/messages` | ADULT |
| 설정 / 비밀번호 변경 | `PUT /auth/password` | ADULT |
| **초대 링크 생성 (강사)** | `POST /groups/:id/invite-links` | ADULT (admin) |
| **초대 링크 관리 (강사)** | `GET /groups/:id/invite-links` | ADULT (admin) |
| **레슨 일정 생성 (강사)** | `POST /lessons/:groupId/schedules` | ADULT (admin) |
| **출석 처리 (강사)** | `POST /lessons/:groupId/schedules/:scheduleId/attendance` | ADULT (admin) |
| **학생 목록 (강사)** | `GET /lessons/:groupId/students` | ADULT (admin) |

---

## 9. 백엔드 구현 상태

| 모듈 | 상태 | 비고 |
|---|---|---|
| 인증 (Auth) | ✅ 완료 | 일반 + 초대 링크 Lite 가입/로그인 |
| 명함 (Cards) | ✅ 완료 | ADULT 전용, 플랜별 제한 |
| 그룹 (Groups) | ✅ 완료 | NORMAL/LESSON 타입, 초대 링크 관리 |
| 초대 링크 (Invite Links) | ✅ 완료 | 생성/목록/비활성화 |
| 행사 (Events) | ✅ 완료 | ADULT 전용 |
| 채팅 (Chat) | ✅ 완료 | ADULT 전용 |
| 레슨 관리 (Lessons) | ✅ 완료 | MINOR도 조회 가능 |
| MINOR 접근 제어 미들웨어 | ✅ 완료 | cards/events/chat/partner 차단 |
| 파트너 (Partner) | ✅ 완료 | 서버 간 통신 |
| 어드민 (Admin Web) | ✅ 완료 | https://the-meti.pages.dev/admin |

---

## 10. 연락처

| 역할 | 담당 |
|---|---|
| 백엔드 API | METI 백엔드팀 |
| 어드민 웹 | https://the-meti.pages.dev/admin |
| 어드민 계정 | admin@the-meti.io / MetiAdmin2026! |

---

*이 문서는 METI 백엔드 구현 기준으로 작성되었습니다.*  
*API 추가/변경 시 문서가 업데이트됩니다.*
