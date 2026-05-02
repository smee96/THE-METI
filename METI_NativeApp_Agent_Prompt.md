# METI 네이티브 앱 개발 에이전트 가이드 v2.0

> **업데이트**: 미성년자(Minor) 보호 정책 + 그룹 레슨 기능 추가 반영 (2026-05-02)

---

## 📌 서비스 개요

**METI(메티)**는 디지털 명함 기반의 글로벌 비즈니스 네트워킹 플랫폼입니다.

- **주요 기능**: 디지털 명함 생성/공유, 그룹 커뮤니티, 이벤트, 1:1 채팅, 리워드, **그룹 레슨/스터디**
- **타겟**: 글로벌 비즈니스 사용자 + **학생/레슨 참여자 (미성년자 포함)**
- **플랫폼**: iOS / Android 네이티브 앱
- **백엔드**: 완성된 REST API (Cloudflare Workers + Hono + D1 SQLite)
- **Base URL**: `https://the-meti.pages.dev/api/v1`
- **인증**: JWT (Access Token 7일, Refresh Token 30일, Token Rotation)

---

## 🏗️ 시스템 아키텍처

```
[iOS / Android 앱]
        ↓  REST API (JSON)
[METI Backend API]  https://the-meti.pages.dev/api/v1
        ↓
[Cloudflare D1 (SQLite) - the-meti-production]
        ↓
[파트너 서버] ← 서버-투-서버 연동 (X-Partner-API-Key)
```

---

## 🔐 인증 방식

### JWT Token 구조
```
Access Token  : 7일 (모든 인증 API 요청 헤더)
Refresh Token : 30일 (Token Rotation — 갱신 시 기존 토큰 무효화)
```

### 요청 헤더
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 토큰 갱신 흐름
1. API 요청 → `401` 수신
2. `POST /auth/refresh` 호출
3. 새 `access_token` + `refresh_token` 수신 → 로컬 저장
4. 원래 요청 재시도

---

## 📡 공통 응답 형식

```json
// 성공
{ "success": true, "data": { ... }, "message": "선택적 메시지" }

// 실패
{ "success": false, "error": "오류 메시지" }

// 페이지네이션
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "total_pages": 5, "has_next": true }
}
```

---

## 🗂️ 플랜 체계

| 플랜 | 명함 수 | 그룹 가입 | 채팅 | 비고 |
|------|--------|----------|------|------|
| free | **3장** | 가능 | 가능 | 기본 플랜 |
| pro | 10장 | 가능 | 가능 | 유료 |
| business | 무제한 | 가능 | 가능 | 유료 |

---

## 👤 사용자 유형 및 역할

### user_type (신규)
| 값 | 설명 |
|----|------|
| `ADULT` | 성인 (기본값) |
| `MINOR` | 미성년자 — 보호 대상, 별도 접근 제어 적용 |

### 플랫폼 역할 (role)
| 값 | 설명 |
|----|------|
| `user` | 일반 사용자 |
| `super_admin` | 플랫폼 전체 관리자 |

### 그룹 내 역할 (group_members.role)
| 값 | 설명 |
|----|------|
| `admin` | 그룹 관리자 / 레슨 강사 |
| `sub_admin` | 부관리자 |
| `executive` | 임원 |
| `member` | 일반 멤버 |
| `minor` | 미성년자 멤버 (보호 대상 식별용) |

---

## 🔒 미성년자(Minor) 보호 정책

> **핵심 원칙**: 미성년자는 일반 유저가 아니라 보호 대상입니다.

### 데이터 노출 제한
- 전화번호(`phone`) 및 이메일 — **그룹 외부 노출 금지**
- 프로필 조회 — **같은 그룹 내에서만 가능**
- 공개 명함(`/cards/public/:id`) — MINOR 계정은 **발급 불가** (앱 레이어 차단)
- QR/NFC 외부 공유 — **제한**

### 보호자(Guardian) 연결 정책
- 미성년자는 `user_guardians` 테이블을 통해 보호자/강사와 연결
- `relation`: `parent`(학부모) | `teacher`(강사)
- 보호자 연결 없이는 **레슨 그룹 참여 불가** (앱 레이어 강제)
- 보호자는 담당 학생의 레슨 출석 현황 조회 가능

### 리워드 정책
- 미성년자 계정 **직접 리워드 지급 제한**
- 보호자 계정으로 대리 지급 (파트너 API 레이어)

### 앱 개발 시 필수 체크
```
회원가입 시 user_type = 'MINOR' 선택 → 보호자 연결 흐름 안내
미성년자 프로필 → 전화번호/이메일 항상 마스킹 처리
채팅 상대가 MINOR → 그룹 내 관계자(강사/보호자)만 허용
```

---

## 🏫 그룹 유형 (group_type)

| 값 | 설명 |
|----|------|
| `NORMAL` | 일반 협회/동호회/기업 그룹 (기본값) |
| `LESSON` | 레슨/스터디 그룹 — 미성년자 참여 가능, 출석 관리 포함 |

### LESSON 그룹 lesson_config (JSON)
```json
{
  "allow_minor": true,
  "require_guardian": true,
  "subject": "피아노",
  "schedule": "매주 화/목 오후 3시",
  "lesson_fee": 0
}
```

---

# 📋 전체 API 명세

> **Base URL**: `https://the-meti.pages.dev/api/v1`
> **로컬 개발**: `http://localhost:3000/api/v1`
> **🔐** = JWT 인증 필요 (`Authorization: Bearer <token>`)

---

## 1. 인증 (Auth)

### 1-1. 회원가입
```
POST /auth/register
권한: Public
```
```json
{
  "email": "user@example.com",     // required
  "password": "Test1234!",         // required, 8자 이상
  "name": "홍길동",                 // required, 2~50자
  "account_type": "personal",      // optional: "personal" | "headhunter"
  "user_type": "ADULT",            // optional: "ADULT" | "MINOR" (기본: ADULT)
  "birth_date": "2010-03-15",      // optional: YYYY-MM-DD (미성년자 권장)
  "phone": "010-1234-5678"         // optional
}
```
**Response 201**
```json
{
  "success": true,
  "data": { "user_id": 1, "email": "...", "verify_token": "uuid..." },
  "message": "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요."
}
```

---

### 1-2. 이메일 인증
```
POST /auth/verify-email
권한: Public
```
```json
{ "token": "uuid-..." }
```

---

### 1-3. 로그인
```
POST /auth/login
권한: Public
```
```json
{ "email": "user@example.com", "password": "Test1234!" }
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
      "id": 1, "email": "...", "name": "홍길동",
      "account_type": "personal", "plan": "free",
      "user_type": "ADULT",    // ★ 신규
      "role": "user"           // ★ 신규
    }
  }
}
```

---

### 1-4. 토큰 갱신
```
POST /auth/refresh
```
```json
{ "refresh_token": "uuid-..." }
```

### 1-5. 로그아웃
```
POST /auth/logout   🔐
```
```json
{ "refresh_token": "uuid-..." }
```

### 1-6. 비밀번호 재설정 요청
```
POST /auth/forgot-password
```
```json
{ "email": "user@example.com" }
```

### 1-7. 비밀번호 재설정
```
POST /auth/reset-password
```
```json
{ "token": "uuid-...", "password": "NewPass1234!" }
```

### 1-8. 내 프로필 조회
```
GET /auth/me   🔐
```
**Response** — `user_type`, `role`, `birth_date`, `phone` 포함하여 반환

---

## 2. 명함 (Cards)

### 2-1. 내 명함 목록
```
GET /cards   🔐
```

### 2-2. 명함 생성
```
POST /cards   🔐
⚠️  Free: 3장 제한 / MINOR 계정: 공개 명함 생성 제한 (앱 레이어)
```
```json
{
  "name": "홍길동",
  "card_type": "personal",      // "personal" | "group"
  "group_id": null,
  "title": "시니어 개발자",
  "company": "METI Corp",
  "email": "user@example.com",
  "phone": "010-1234-5678",
  "website": "https://meti.app",
  "bio": "자기소개 (500자 이내)",
  "template_id": "modern_blue",
  "is_public": 1,
  "sns_links": [{ "platform": "linkedin", "url": "https://...", "sort_order": 0 }],
  "tags": [{ "tag_type": "skill", "tag_value": "TypeScript" }]
}
```

### 2-3. 명함 상세 조회
```
GET /cards/:id   🔐
```

### 2-4. 공개 명함 조회 (인증 불필요)
```
GET /cards/public/:id
⚠️  MINOR 계정 명함은 공개 조회 불가 (앱 레이어 차단)
```

### 2-5. 명함 수정
```
PATCH /cards/:id   🔐 (소유자만)
```

### 2-6. 명함 삭제
```
DELETE /cards/:id   🔐 (소유자만)
```

### 2-7. QR 토큰 생성 (24시간 유효)
```
POST /cards/:id/qr-token   🔐
```

### 2-8. QR 토큰으로 명함 조회
```
GET /cards/qr/:token
```

### 2-9. 명함 저장 (명함첩)
```
POST /cards/:id/save   🔐
⚠️  채팅 시작 전 필수
```

### 2-10. 저장된 명함 목록
```
GET /cards/contacts/list   🔐
```

---

## 3. 그룹 (Groups)

### 3-1. 그룹 목록
```
GET /groups
```
**Query**: `page`, `limit`, `q`(검색), `category`(`association`|`company`|`club`|`other`), `group_type`(`NORMAL`|`LESSON`)

**Response** — `group_type`, `lesson_config` 포함하여 반환

---

### 3-2. 그룹 생성 신청
```
POST /groups   🔐
⚠️  슈퍼어드민 승인 후 활성화
```
```json
{
  "name": "피아노 레슨반 A",
  "description": "초등학생 대상 피아노 레슨",
  "category": "club",
  "visibility": "private",
  "group_type": "LESSON",             // ★ 신규: "NORMAL" | "LESSON"
  "lesson_config": "{\"allow_minor\":true,\"require_guardian\":true,\"subject\":\"피아노\"}",
  "custom_join_fields": null
}
```

---

### 3-3. 그룹 상세 조회
```
GET /groups/:id
```

### 3-4. 그룹 가입 신청
```
POST /groups/:id/join   🔐
```
> LESSON 그룹 + MINOR 유저: 보호자 연결이 없으면 앱에서 사전 차단 권장

### 3-5. 그룹 탈퇴
```
DELETE /groups/:id/leave   🔐
```

### 3-6. 그룹 멤버 목록 (어드민)
```
GET /groups/:id/members   🔐
```
**Query**: `status`(`active`|`pending`)

**Response** — `user_type`, `guardian_user_id`, `guardian_name` 포함

### 3-7. 멤버 상태/역할 변경
```
PATCH /groups/:id/members/:userId   🔐 (그룹 어드민)
```
```json
{ "action": "approve", "role": "minor" }
// action: "approve" | "reject" | "kick"
// role: "admin" | "sub_admin" | "executive" | "member" | "minor"
```

### 3-8. 그룹 공지 목록
```
GET /groups/:id/notices
```

### 3-9. 그룹 공지 작성
```
POST /groups/:id/notices   🔐 (어드민)
```
```json
{ "title": "공지 제목", "content": "공지 내용", "is_pinned": 0 }
```

### 3-10. 어드민 권한 이전 신청
```
POST /groups/:id/transfer-admin   🔐
```

---

## 4. 이벤트 (Events)

### 4-1. 이벤트 목록
```
GET /events
```
**Query**: `page`, `limit`, `group_id`, `status`(`upcoming`|`ongoing`|`ended`)

### 4-2. 이벤트 생성 (그룹 어드민 / 슈퍼어드민)
```
POST /events   🔐
```
```json
{
  "group_id": 1,
  "title": "METI 네트워킹 밋업",
  "description": "이벤트 설명",
  "location": "서울 강남구",
  "starts_at": "2026-06-15T18:00:00Z",
  "ends_at": "2026-06-15T21:00:00Z",
  "visibility": "public",
  "registration_type": "free",
  "entry_method": "qr",
  "max_participants": 50
}
```

### 4-3. 이벤트 상세
```
GET /events/:id
```

### 4-4. 이벤트 참가 신청
```
POST /events/:id/join   🔐
```

### 4-5. 이벤트 체크인 (QR/NFC)
```
POST /events/:id/checkin   🔐 (이벤트 어드민)
```
```json
{ "user_id": 3, "qr_token": "uuid-...", "entry_method": "qr" }
```

### 4-6. 참가자 목록
```
GET /events/:id/participants   🔐
```

---

## 5. 채팅 (Chat)

> ⚠️ 명함 저장 후에만 채팅 가능 / **MINOR 상대와의 채팅은 그룹 내 관계자만 허용**

### 5-1. 채팅방 목록
```
GET /chat   🔐
```

### 5-2. 1:1 채팅방 생성
```
POST /chat/direct   🔐
```
```json
{ "target_user_id": 3 }
```

### 5-3. 메시지 목록 (커서 기반)
```
GET /chat/:roomId/messages   🔐
```
**Query**: `before`(cursor), `limit`

### 5-4. 메시지 전송
```
POST /chat/:roomId/messages   🔐
```
```json
{ "content": "안녕하세요!", "message_type": "text" }
```

### 5-5. 메시지 삭제
```
DELETE /chat/:roomId/messages/:msgId   🔐 (발신자)
```

### 5-6. 신고
```
POST /chat/report   🔐
```
```json
{
  "target_type": "user",   // "user"|"message"|"card"|"group"
  "target_id": 3,
  "reason": "부적절한 메시지",
  "description": "상세 설명"
}
```

### 5-7. 사용자 차단
```
POST /chat/block   🔐
```
```json
{ "blocked_user_id": 3 }
```

---

## 6. 보호자 (Guardians)  ★ 신규

> 미성년자-보호자(학부모/강사) 연결 관리

### 6-1. 보호자 연결 요청
```
POST /guardians/link   🔐
```
```json
{
  "minor_user_id": 5,          // minor_user_id 또는 minor_email 중 하나 필수
  "minor_email": "student@example.com",
  "relation": "teacher",       // "parent" | "teacher"
  "group_id": 2                // optional: 해당 그룹 멤버에 보호자 자동 연결
}
```
**Response 201**
```json
{
  "success": true,
  "data": { "minor_user_id": 5, "guardian_user_id": 3, "relation": "teacher", "status": "pending" },
  "message": "보호자 연결 요청이 발송되었습니다."
}
```

---

### 6-2. 보호자 연결 수락
```
POST /guardians/link/:requestId/accept   🔐 (학생 본인 또는 super_admin)
```

---

### 6-3. 보호자 연결 거절
```
POST /guardians/link/:requestId/reject   🔐 (학생 본인)
```

---

### 6-4. 보호자/학생 목록 조회
```
GET /guardians   🔐
```
**Query**: `role`
- `role=mine` (기본): 내 보호자 목록 (학생 입장)
- `role=students`: 내가 담당하는 학생 목록 (보호자/강사 입장)

**Response (role=students)**
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "relation": "teacher", "status": "active",
      "student_id": 5, "student_name": "김학생",
      "student_email": "student@example.com",
      "user_type": "MINOR", "birth_date": "2012-04-10",
      "avatar_url": null
    }
  ]
}
```

---

### 6-5. 대기 중인 연결 요청 목록
```
GET /guardians/pending   🔐 (학생 본인)
```

---

### 6-6. 보호자 연결 해제
```
DELETE /guardians/:guardianUserId   🔐 (학생 본인)
```

---

### 6-7. 내 학생들의 레슨 그룹 목록
```
GET /guardians/lesson-groups   🔐 (보호자/강사)
```

---

## 7. 레슨 (Lessons)  ★ 신규

> LESSON 타입 그룹 전용 — 일정 관리 + 출석 처리

### 7-1. 레슨 일정 목록
```
GET /lessons/:groupId/schedules   🔐
```
**Query**: `page`, `limit`, `status`(`scheduled`|`ongoing`|`completed`|`cancelled`)

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "group_id": 2, "title": "3월 1주차 피아노 레슨",
      "instructor_id": 3, "instructor_name": "김강사",
      "starts_at": "2026-03-04T15:00:00Z", "ends_at": "2026-03-04T16:00:00Z",
      "location": "음악실 201호",
      "status": "scheduled",
      "present_count": 0, "total_students": 5
    }
  ]
}
```

---

### 7-2. 레슨 일정 생성
```
POST /lessons/:groupId/schedules   🔐 (그룹 admin/sub_admin — 강사)
⚠️  LESSON 타입 그룹에서만 가능
```
```json
{
  "title": "3월 1주차 피아노 레슨",   // required
  "description": "바이엘 50번 연습",  // optional
  "starts_at": "2026-03-04T15:00:00Z", // required, ISO 8601
  "ends_at": "2026-03-04T16:00:00Z",   // optional
  "location": "음악실 201호",          // optional
  "max_students": 10                   // optional
}
```
**Response 201**
```json
{ "success": true, "data": { "schedule_id": 1 }, "message": "레슨 일정이 생성되었습니다." }
```

---

### 7-3. 레슨 일정 상세 + 출석 현황
```
GET /lessons/:groupId/schedules/:scheduleId   🔐
```
- **강사/관리자**: 전체 학생 출석 현황 반환
- **보호자**: 담당 학생들의 출석만 반환

**Response**
```json
{
  "success": true,
  "data": {
    "id": 1, "title": "3월 1주차 피아노 레슨",
    "instructor_name": "김강사",
    "starts_at": "...", "status": "completed",
    "attendances": [
      {
        "student_id": 5, "name": "김학생",
        "user_type": "MINOR",
        "status": "present",    // "present"|"absent"|"late"|"excused"
        "checked_at": "2026-03-04T15:05:00Z",
        "note": null
      }
    ]
  }
}
```

---

### 7-4. 출석 처리 (배치)
```
POST /lessons/:groupId/schedules/:scheduleId/attendance   🔐 (강사)
```
```json
{
  "attendances": [
    { "student_id": 5, "status": "present", "note": null },
    { "student_id": 6, "status": "absent",  "note": "사전 연락" },
    { "student_id": 7, "status": "late",    "note": "10분 지각" }
  ]
}
```
**Response**
```json
{ "success": true, "data": { "processed": 3 }, "message": "출석이 처리되었습니다." }
```

---

### 7-5. 학생 목록 조회 (강사 전용)
```
GET /lessons/:groupId/students   🔐 (강사)
```
**Response** — 보호자 정보, 출석률 포함
```json
{
  "success": true,
  "data": [
    {
      "id": 5, "name": "김학생", "user_type": "MINOR",
      "birth_date": "2012-04-10", "avatar_url": null,
      "guardian_user_id": 3,
      "guardian_name": "김보호자", "guardian_email": "parent@example.com",
      "guardian_relation": "parent",
      "present_count": 8, "total_lessons": 10
    }
  ]
}
```

---

## 8. 파트너 연동 (Partner)

> ⚠️ **서버-투-서버(S2S) 전용** — 앱에서 직접 호출 금지
> 헤더: `X-Partner-API-Key: <key>`

### 8-1. 사용자 매핑
```
POST /partner/user-map
```
```json
{ "meti_user_id": 2 }
```

### 8-2. 리워드 지급
```
POST /partner/reward
⚠️  MINOR 계정에는 지급 불가 — 보호자 계정 ID 사용
```
```json
{
  "external_user_key": "hash...",
  "event_type": "lesson_complete",
  "points": 500,
  "payload": {}
}
```

### 8-3. 리워드 잔액 조회
```
GET /partner/user-balance?external_user_key=<key>
```

---

## 9. 공통 에러 코드

| HTTP | 설명 |
|------|------|
| 400 | 요청 형식 오류, 필수 파라미터 누락 |
| 401 | 토큰 없음 또는 만료 |
| 403 | 권한 없음 (플랜 제한, 역할 부족, **미성년자 접근 제한**) |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 이메일, 이미 가입된 그룹 등) |
| 422 | 유효성 검사 실패 |
| 500 | 서버 내부 오류 |

---

## 10. 앱 화면 구성

### 인증 플로우
```
스플래시 → 온보딩 → 로그인 / 회원가입
  → [MINOR 선택 시] 보호자 연결 요청 안내
  → 이메일 인증 → 메인 홈
```

### 메인 탭 (하단 네비게이션)
```
🏠 홈      — 내 명함, 최근 저장 명함, QR 공유
👥 그룹    — NORMAL 그룹 탐색 / LESSON 그룹 탐색
📅 이벤트  — 이벤트 목록, 참가 중인 이벤트
💬 채팅    — 채팅방 목록
👤 마이    — 프로필, 설정, 리워드, 플랜
```

### 주요 화면 목록

| 화면 | 설명 |
|------|------|
| 명함 목록 | 내 명함 + 생성 버튼 (MINOR: 제한 안내) |
| 명함 생성/편집 | 템플릿 선택, SNS 링크 |
| QR 코드 표시 | 전체화면 QR |
| QR 스캔 | 카메라 스캔 → 명함 저장 |
| NFC 공유 | NFC 탭으로 명함 공유 |
| 명함첩 | 저장된 명함 목록 |
| 그룹 탐색 | 카테고리/타입별 검색 |
| 그룹 상세 | 정보, 공지, 멤버, 이벤트 |
| **레슨 그룹 홈** ★ | 레슨 일정, 출석 현황, 학생 목록 |
| **보호자 연결** ★ | 연결 요청 목록, 수락/거절 |
| **레슨 일정 상세** ★ | 출석 처리 (강사), 출석 확인 (보호자) |
| 이벤트 체크인 | QR 스캔으로 입장 |
| 채팅 | 메시지, 명함 공유 |
| 리워드 | 포인트 잔액, 내역 |

---

## 11. 개발 시 주의사항

### ⚠️ 필수 로직
1. **토큰 자동 갱신**: 401 → `POST /auth/refresh` → 재시도
2. **명함 저장 선행**: 채팅 전 반드시 상대 명함 저장
3. **그룹 승인 대기**: 생성 후 `status: pending` → 어드민 승인 필요
4. **Free 플랜 제한**: 명함 3장 초과 시 403
5. **이벤트 필드명**: `starts_at` / `ends_at` (ISO 8601) ✅

### 🛡️ MINOR 보호 필수 로직
6. **로그인 응답의 `user_type` 확인** → MINOR 여부 판별 후 UI 제한 적용
7. **MINOR 프로필 조회 시** 전화번호/이메일 마스킹 (`***-***-****`)
8. **MINOR의 공개 명함 생성** → 앱에서 `is_public = 0` 강제
9. **LESSON 그룹 가입 시** → 보호자 연결 여부 확인 후 미연결 시 연결 흐름 선행
10. **보호자 없는 MINOR 채팅** → 그룹 내 강사/보호자로 대상 제한

### 📱 네이티브 앱 특화
- **NFC**: 명함 공유 시 NFC 태그 지원
- **QR 스캔**: `GET /cards/qr/:token`
- **이벤트 체크인**: `POST /events/:id/checkin`
- **레슨 출석 QR**: 강사 기기에서 학생 QR 스캔 → 자동 출석 처리
- **푸시 알림**: 채팅, 공지, 이벤트, **레슨 알림**, **보호자 연결 요청** (FCM/APNs 연동 필요)

### 🔒 보안
- Access/Refresh Token → 안전한 저장소 (Keychain/Keystore)
- 백그라운드 전환 시 민감 화면 가리기
- 생체인증(Face ID/지문) 앱 잠금 옵션 권장
- **MINOR 관련 API 응답은 절대 로컬 캐시에 원문 저장 금지**

---

## 12. DB 스키마 요약 (주요 테이블)

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 (`user_type`, `birth_date`, `phone` 포함) |
| `user_guardians` | 보호자-학생 연결 (`relation`: parent/teacher) |
| `guardian_invitations` | 보호자 초대 토큰 |
| `groups` | 그룹 (`group_type`: NORMAL/LESSON, `lesson_config` JSON) |
| `group_members` | 멤버 (`role`: admin/sub_admin/executive/member/minor, `guardian_user_id`) |
| `lesson_schedules` | 레슨 일정 |
| `lesson_attendances` | 레슨 출석 (`status`: present/absent/late/excused) |
| `minor_activity_logs` | 미성년자 활동 감사 로그 |
| `cards` | 디지털 명함 |
| `events` | 이벤트/행사 |
| `chat_rooms` | 채팅방 |
| `messages` | 채팅 메시지 |
| `rewards` | 리워드 내역 |
| `partner_services` | 파트너 서비스 |

---

## 13. 백엔드 현황

| 항목 | 상태 |
|------|------|
| DB 설계 (마이그레이션) | ✅ 완료 (0001~0010) |
| 인증 API | ✅ 완료 (user_type 지원) |
| 명함 API | ✅ 완료 |
| 그룹 API | ✅ 완료 (group_type 지원) |
| 이벤트 API | ✅ 완료 |
| 채팅 API | ✅ 완료 |
| 파트너 API | ✅ 완료 |
| **보호자(Guardian) API** | ✅ 완료 (신규) |
| **레슨(Lesson) API** | ✅ 완료 (신규) |
| 어드민 API | ✅ 완료 |
| Cloudflare 배포 | ✅ 완료 (`https://the-meti.pages.dev`) |
| Admin Web UI | ✅ 완료 (`https://the-meti.pages.dev/admin`) |

---

*본 문서는 METI 백엔드 실제 구현 코드 기반 + 원격 D1 마이그레이션 적용 완료 후 작성되었습니다.*
*v2.0 — Minor/Guardian/Lesson 기능 추가 (2026-05-02)*
