# METI 네이티브 앱 개발 에이전트 시작 프롬프트 v3.0

> 최종 업데이트: 2026-05-29  
> 변경 이력: **v2.9 → v3.0** — Guardian(보호자) API 신규 · Lesson Schedule/Attendance API 신규 · auth 보안 패치 · 어드민 UI 모듈화 · 백엔드 현황 최신화

---

## 🔔 이 문서의 목적

**v2.8 + v2.9 프롬프트 + v1.6 스펙** 기준으로 이미 전달된 내용을 **기반**으로 하며,  
본 문서는 **그 이후 백엔드에서 추가/변경된 사항만** delta(차이) 형식으로 기술합니다.

> v2.8 · v2.9 문서와 v1.6 기획서를 함께 읽어야 전체 API 명세가 완성됩니다.

---

## 📌 기준 정보 (변경 없음)

- **Base URL**: `https://the-meti.pages.dev/api/v1`
- **인증**: JWT Bearer Token (Access 1시간 / Refresh 7일, Token Rotation)
- **스토리지**: Cloudflare R2 (`the-meti-storage`)
  - Public CDN URL: `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev`
- **GitHub**: https://github.com/smee96/THE-METI
- **최신 배포**: https://the-meti.pages.dev (2026-05-29, 커밋 `0c65554`)

---

## 🗂️ v3.0 변경사항 요약

| 영역 | 변경 유형 | 내용 |
|------|----------|------|
| `POST /guardians/link` | **신규 API** | 보호자 연결 요청 |
| `POST /guardians/link/:id/accept` | **신규 API** | 연결 수락 (학생/super_admin) |
| `POST /guardians/link/:id/reject` | **신규 API** | 연결 거절 (학생 본인) |
| `GET /guardians` | **신규 API** | 보호자·학생 목록 (`?role=mine\|students`) |
| `GET /guardians/pending` | **신규 API** | 대기 중인 연결 요청 목록 |
| `DELETE /guardians/:guardianUserId` | **신규 API** | 보호자 연결 해제 (양방향) |
| `GET /guardians/lesson-groups` | **신규 API** | 내 학생들의 레슨 그룹 목록 |
| `GET /lessons/:groupId/schedules` | **신규 API** | 레슨 일정 목록 (페이지네이션) |
| `POST /lessons/:groupId/schedules` | **신규 API** | 레슨 일정 생성 (강사급) |
| `GET /lessons/:groupId/schedules/:id` | **신규 API** | 일정 상세 + 출석 현황 |
| `POST /lessons/:groupId/schedules/:id/attendance` | **신규 API** | 출석 배치 처리 |
| `GET /lessons/:groupId/students` | **신규 API** | 학생 목록 + 보호자 정보 + 출석률 |
| `POST /auth/register` 응답 | **보안 패치** | `verify_token` 응답 제거 (이메일 발송으로 이동 예정) |
| `POST /auth/forgot-password` 응답 | **보안 패치** | `reset_token` 응답 제거 (이메일 발송으로 이동 예정) |

---

## 6. 보호자 (Guardians) — 신규 🆕

> **Base Path**: `/api/v1/guardians`  
> **대상**: 미성년자(MINOR) ↔ 보호자(부모/강사) 연결 관리  
> **DB 테이블**: `user_guardians`, `guardian_invitations` (migration 0010에 존재)

### 데이터 모델

```
user_guardians
  id                : PK
  user_id           : 학생(MINOR) FK→users
  guardian_user_id  : 보호자/강사(ADULT) FK→users
  relation          : 'parent' | 'teacher'
  status            : 'pending' | 'active' | 'rejected'
  invited_at        : 요청 일시
  accepted_at       : 수락 일시 (nullable)
```

---

### 6-1. 보호자 연결 요청
```
POST /guardians/link   🔐
```
> 보호자(부모/강사)가 학생에게 연결 요청을 보냄

**Request**
```json
{
  "minor_user_id": 5,               // minor_user_id 또는 minor_email 중 하나 필수
  "minor_email": "student@meti.io", // 둘 다 전송 시 minor_user_id 우선
  "relation": "teacher",            // "parent" | "teacher"
  "group_id": 2                     // optional: 해당 그룹 멤버의 보호자로 자동 등록
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "minor_user_id": 5,
    "guardian_user_id": 3,
    "relation": "teacher",
    "status": "pending"
  },
  "message": "보호자 연결 요청이 발송되었습니다."
}
```

**에러 케이스**
- `400`: minor_user_id / minor_email 모두 미전송
- `404`: 학생을 찾을 수 없음
- `409`: 이미 연결 완료 또는 대기 중 요청 존재
- `400`: 자기 자신에게 요청 불가

> ⚠️ **재요청 허용**: `rejected` 상태인 경우 동일 학생에게 재요청 가능 (status가 `pending`으로 갱신됨)

---

### 6-2. 보호자 연결 수락
```
POST /guardians/link/:requestId/accept   🔐
권한: 학생 본인 또는 super_admin
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "request_id": 1,
    "minor_user_id": 5,
    "guardian_user_id": 3,
    "relation": "teacher",
    "status": "active"
  },
  "message": "보호자 연결이 수락되었습니다."
}
```

**에러 케이스**
- `404`: 요청 없음
- `400`: 이미 처리된 요청 (pending 상태가 아님)
- `403`: 수락 권한 없음

---

### 6-3. 보호자 연결 거절
```
POST /guardians/link/:requestId/reject   🔐
권한: 학생 본인만
```

**Response 200**
```json
{
  "success": true,
  "data": { "request_id": 1, "status": "rejected" },
  "message": "보호자 연결 요청이 거절되었습니다."
}
```

---

### 6-4. 보호자/학생 목록 조회
```
GET /guardians?role=mine   🔐
GET /guardians?role=students   🔐
```

**Query 파라미터**

| 값 | 설명 |
|----|------|
| `role=mine` (기본) | 내 보호자 목록 조회 (학생 입장) |
| `role=students` | 내가 담당하는 학생 목록 조회 (보호자/강사 입장) |

**Response 200 (role=students)**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "relation": "teacher",
      "status": "active",
      "accepted_at": "2026-05-20T10:00:00Z",
      "student_id": 5,
      "student_name": "김학생",
      "student_email": "student@meti.io",
      "user_type": "MINOR",
      "birth_date": "2012-04-10",
      "avatar_url": null
    }
  ]
}
```

**Response 200 (role=mine — 보호자 목록)**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "relation": "teacher",
      "status": "active",
      "accepted_at": "2026-05-20T10:00:00Z",
      "guardian_id": 3,
      "guardian_name": "김강사",
      "guardian_email": "teacher@meti.io",
      "guardian_avatar": null
    }
  ]
}
```

---

### 6-5. 대기 중인 연결 요청 목록
```
GET /guardians/pending   🔐
권한: 학생 본인 (수락/거절해야 할 요청 목록)
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "request_id": 1,
      "relation": "parent",
      "status": "pending",
      "invited_at": "2026-05-28T09:00:00Z",
      "guardian_id": 4,
      "guardian_name": "박부모",
      "guardian_email": "parent@meti.io",
      "guardian_avatar": null
    }
  ]
}
```

> 앱에서 이 API를 주기적으로 polling하거나 로그인 시 확인하여 알림 표시 권장

---

### 6-6. 보호자 연결 해제
```
DELETE /guardians/:guardianUserId   🔐
권한: 학생 본인 또는 보호자 본인 (양방향 해제 가능)
```

**Response 200**
```json
{
  "success": true,
  "data": null,
  "message": "보호자 연결이 해제되었습니다."
}
```

---

### 6-7. 내 학생들의 레슨 그룹 목록
```
GET /guardians/lesson-groups   🔐
권한: 보호자/강사 (active 담당 학생이 있어야 결과 반환)
```

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "group_id": 2,
      "group_name": "피아노 레슨반",
      "group_type": "LESSON",
      "description": "초등 피아노 레슨",
      "group_avatar": null,
      "member_count": 8,
      "upcoming_lessons": 3
    }
  ]
}
```

---

### 앱 UI 가이드 — 보호자 기능

**[학생 입장]**
```
[ 보호자 관리 ] 화면
  ─────────────────────
  ● 나의 보호자 (role=mine)
    [김강사 — teacher]  [해제]
    [박부모 — parent]   [해제]
  
  ● 대기 중인 요청 (pending)
    [최강사 — teacher]  [수락] [거절]
```

**[보호자/강사 입장]**
```
[ 담당 학생 ] 화면
  ─────────────────────
  ● 담당 학생 목록 (role=students)
    [김학생 MINOR · 2012-04-10]  →  학생 상세
    [이학생 MINOR · 2013-06-15]  →  학생 상세
  
  ● 학생 추가
    이메일로 검색 → POST /guardians/link
```

---

## 7. 레슨 스케줄/출석 (Lesson Schedules) — 신규 🆕

> **Base Path**: `/api/v1/lessons/:groupId`  
> **대상**: LESSON 타입 그룹 전용 — 일정 관리 + 출석 처리  
> **DB 테이블**: `lesson_schedules`, `lesson_attendances` (migration 0010에 존재)  
> ⚠️ **기존 레슨 API** (`/lessons/groups/:groupId/lessons`)는 별도 유지됨 — 이 섹션은 스케줄/출석 전용

### 데이터 모델

```
lesson_schedules
  id            : PK
  group_id      : FK→groups (LESSON 타입만)
  title         : 일정 제목
  description   : 설명 (nullable)
  instructor_id : 강사 FK→users
  starts_at     : 시작 일시 (ISO 8601)
  ends_at       : 종료 일시 (nullable)
  location      : 장소 (nullable)
  max_students  : 최대 학생 수 (nullable)
  status        : 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

lesson_attendances
  schedule_id   : FK→lesson_schedules
  student_id    : FK→users
  status        : 'present' | 'absent' | 'late' | 'excused'
  checked_by    : 출석 처리한 강사 FK→users
  checked_at    : 출석 처리 일시
  note          : 특이사항 메모
  UNIQUE(schedule_id, student_id)
```

---

### 7-1. 레슨 일정 목록
```
GET /lessons/:groupId/schedules   🔐
```

**접근 권한**
- 그룹 멤버 (admin/sub_admin/instructor/member)
- 보호자 (담당 학생이 해당 그룹 멤버인 경우)

**Query 파라미터**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `page` | number | 페이지 (기본 1) |
| `limit` | number | 개수 (기본 20) |
| `status` | string | `scheduled` \| `ongoing` \| `completed` \| `cancelled` |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "group_id": 2,
      "title": "3월 1주차 피아노 레슨",
      "description": "바이엘 50번 연습",
      "instructor_id": 3,
      "instructor_name": "김강사",
      "starts_at": "2026-03-04T15:00:00Z",
      "ends_at": "2026-03-04T16:00:00Z",
      "location": "음악실 201호",
      "max_students": 10,
      "status": "scheduled",
      "present_count": 0,
      "total_students": 8
    }
  ],
  "pagination": {
    "page": 1, "limit": 20, "total": 15, "total_pages": 1, "has_next": false
  }
}
```

---

### 7-2. 레슨 일정 생성
```
POST /lessons/:groupId/schedules   🔐
권한: instructor / sub_admin / admin (LESSON 타입 그룹에서만 가능)
```

**Request**
```json
{
  "title": "3월 1주차 피아노 레슨",    // required
  "description": "바이엘 50번 연습",   // optional
  "starts_at": "2026-03-04T15:00:00Z", // required, ISO 8601
  "ends_at": "2026-03-04T16:00:00Z",   // optional
  "location": "음악실 201호",           // optional
  "max_students": 10                    // optional
}
```

**Response 201**
```json
{
  "success": true,
  "data": { "schedule_id": 1 },
  "message": "레슨 일정이 생성되었습니다."
}
```

**에러 케이스**
- `403`: instructor 미만 권한
- `404`: 그룹 없음
- `400`: LESSON 타입이 아닌 그룹

---

### 7-3. 레슨 일정 상세 + 출석 현황
```
GET /lessons/:groupId/schedules/:scheduleId   🔐
```

**접근 권한별 응답 차이**

| 역할 | 출석 데이터 범위 |
|------|----------------|
| instructor / admin / sub_admin | 그룹 전체 학생 출석 현황 |
| 보호자 | 담당 학생들의 출석만 |
| 일반 멤버 | 자신의 출석만 |

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "group_id": 2,
    "title": "3월 1주차 피아노 레슨",
    "description": "바이엘 50번 연습",
    "instructor_id": 3,
    "instructor_name": "김강사",
    "instructor_email": "teacher@meti.io",
    "starts_at": "2026-03-04T15:00:00Z",
    "ends_at": "2026-03-04T16:00:00Z",
    "location": "음악실 201호",
    "max_students": 10,
    "status": "completed",
    "attendances": [
      {
        "student_id": 5,
        "name": "김학생",
        "user_type": "MINOR",
        "avatar_url": null,
        "status": "present",      // "present" | "absent" | "late" | "excused"
        "checked_at": "2026-03-04T15:05:00Z",
        "note": null
      },
      {
        "student_id": 6,
        "name": "이학생",
        "user_type": "MINOR",
        "avatar_url": null,
        "status": "absent",
        "checked_at": null,
        "note": "사전 연락"
      }
    ]
  }
}
```

---

### 7-4. 출석 처리 (배치)
```
POST /lessons/:groupId/schedules/:scheduleId/attendance   🔐
권한: instructor / sub_admin / admin
```

> 출석 처리는 **UPSERT** 방식 — 이미 처리된 학생도 재처리 가능  
> 최초 처리 시 일정 status가 `scheduled` → `ongoing`으로 자동 전환

**Request**
```json
{
  "attendances": [
    { "student_id": 5, "status": "present",  "note": null },
    { "student_id": 6, "status": "absent",   "note": "사전 연락" },
    { "student_id": 7, "status": "late",     "note": "10분 지각" },
    { "student_id": 8, "status": "excused",  "note": "병결 처리" }
  ]
}
```

**출석 status 허용값**

| 값 | 의미 |
|----|------|
| `present` | 출석 |
| `absent` | 결석 |
| `late` | 지각 |
| `excused` | 공결 (인정 결석) |

**Response 200**
```json
{
  "success": true,
  "data": { "processed": 4 },
  "message": "출석이 처리되었습니다."
}
```

**에러 케이스**
- `403`: instructor 미만 권한
- `404`: 일정 없음
- `400`: 취소된 일정

---

### 7-5. 학생 목록 조회 (강사 전용)
```
GET /lessons/:groupId/students   🔐
권한: instructor / sub_admin / admin
```

> 그룹 멤버 중 일반 학생(admin/sub_admin/instructor 제외)의 목록을 보호자 정보 및 출석률과 함께 반환

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "김학생",
      "email": "student@meti.io",
      "user_type": "MINOR",
      "birth_date": "2012-04-10",
      "avatar_url": null,
      "member_role": "member",
      "guardian_user_id": 3,
      "guardian_approved_at": "2026-05-20T10:00:00Z",
      "guardian_link_id": 1,
      "guardian_relation": "parent",
      "guardian_link_status": "active",
      "guardian_id": 3,
      "guardian_name": "김보호자",
      "guardian_email": "parent@meti.io",
      "guardian_avatar": null,
      "present_count": 8,
      "total_lessons": 10
    }
  ]
}
```

---

### 앱 UI 가이드 — 레슨 스케줄 기능

**[강사 입장]**
```
[ 레슨 일정 ] 탭  (LESSON 그룹 내)
  ─────────────────────────────────
  [일정 추가] 버튼
  
  ● 예정 (scheduled/ongoing)
    [3월 1주차 피아노 레슨]
    📅 03/04 오후 3시~4시  📍 음악실 201호
    👥 출석 0/8
    [출석 처리 →]
  
  ● 완료 (completed)
    [2월 5주차 피아노 레슨]
    📅 02/25  👥 출석 7/8 (87.5%)
    [출석 결과 보기]
```

**[출석 처리 화면]**
```
[ 3월 1주차 피아노 레슨 출석 ]
  ─────────────────────────────────
  [전체 출석] 버튼 (한 번에 모두 present)
  
  김학생  [출석 ✓] [결석] [지각] [공결]  메모:
  이학생  [출석]   [결석 ✓] [지각] [공결] 메모: [사전 연락]
  박학생  [출석]   [결석] [지각 ✓] [공결] 메모:
  
  [저장]  → POST /lessons/:groupId/schedules/:id/attendance
```

**[보호자 입장]**
```
[ 내 학생 레슨 현황 ] 화면
  ─────────────────────────────────
  학생 선택: [김학생 ▼]
  
  레슨 그룹: [피아노 레슨반]
  
  최근 일정
  [3월 1주차]  출석 ✓   03/04
  [2월 5주차]  결석 ✗   02/25  메모: 병결
  [2월 4주차]  지각 △   02/18
  
  출석률: 8/10 (80%)
```

---

## ⚠️ v3.0 보안 패치 — 앱 개발 주의사항

### auth 응답 변경

**[회원가입 응답 변경]**

```diff
// POST /auth/register Response 201
{
  "success": true,
  "data": {
    "user_id": 2,
    "email": "user@example.com",
-   "verify_token": "uuid-..."   // ← 운영 서버에서 제거됨
  },
  "message": "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요."
}
```

> ⚠️ **앱 처리**: 회원가입 후 이메일 인증 토큰을 응답에서 받을 수 없습니다.  
> 사용자에게 "이메일을 확인하여 인증 링크를 클릭하세요" 안내 문구만 표시하면 됩니다.  
> (현재 이메일 발송 서비스 미연동 — 개발 테스트는 DB에서 직접 토큰 확인 필요)

**[비밀번호 재설정 요청 응답 변경]**

```diff
// POST /auth/forgot-password Response 200
{
  "success": true,
- "data": { "reset_token": "uuid-..." },  // ← 운영 서버에서 제거됨
+ "data": null,
  "message": "비밀번호 재설정 이메일이 발송되었습니다."
}
```

> ⚠️ **앱 처리**: 비밀번호 재설정 토큰도 응답에서 받을 수 없습니다.  
> 사용자에게 "이메일을 확인하여 재설정 링크를 클릭하세요" 안내만 표시하세요.

---

## 🏗️ 백엔드 현황 (v3.0 업데이트)

v2.9 현황에서 추가/변경된 항목만 기재합니다.

| 항목 | v2.9 상태 | v3.0 상태 |
|------|----------|----------|
| Guardian API — 보호자 연결 요청/수락/거절 | ⏳ 미구현 | ✅ 완료 |
| Guardian API — 보호자/학생 목록 조회 | ⏳ 미구현 | ✅ 완료 |
| Guardian API — 대기 요청 목록 / 연결 해제 | ⏳ 미구현 | ✅ 완료 |
| Guardian API — 레슨 그룹 목록 | ⏳ 미구현 | ✅ 완료 |
| Lesson Schedule API — 일정 목록/생성 | ⏳ 미구현 | ✅ 완료 |
| Lesson Schedule API — 일정 상세 + 출석 현황 | ⏳ 미구현 | ✅ 완료 |
| Lesson Schedule API — 출석 배치 처리 | ⏳ 미구현 | ✅ 완료 |
| Lesson Schedule API — 학생 목록 (보호자+출석률) | ⏳ 미구현 | ✅ 완료 |
| auth.ts `verify_token` 응답 노출 | ⚠️ 노출 중 | ✅ 제거 완료 |
| auth.ts `reset_token` 응답 노출 | ⚠️ 노출 중 | ✅ 제거 완료 |

### 전체 현황 (미구현 항목만)

| 항목 | 상태 | 비고 |
|------|------|------|
| 이메일 발송 연동 (verify/reset) | ⏳ 보류 | 도메인/Resend 서비스 확정 대기 |
| 웹 결제 페이지 (`/payment`) | ⏳ 보류 | Toss/Stripe PG 키 수령 후 |
| Toss / Stripe 서버사이드 검증 | ⏳ 보류 | PG 키 수령 후 |
| Apple IAP / Google Play 서버 검증 | ⏳ 보류 | 앱 심사 후 연동 |
| NFC 실물카드 신청·발급 API | ⏳ 미구현 | DB 스키마 준비 완료 |
| 푸시 알림 (FCM / APNs) | ⏳ 미결정 | — |
| 채팅 실시간 (WebSocket/SSE) | ⏳ Phase 2 | — |
| 구독 웹훅 | ⏳ Phase 2 | — |

---

## 📋 v3.0 화면-API 연결 표 (신규 추가분)

| 화면 | 연결 API | 비고 |
|------|---------|------|
| 보호자 연결 요청 (학생 이메일/ID 입력) | `POST /guardians/link` | relation 선택 필요 |
| 내 보호자 목록 (학생 입장) | `GET /guardians?role=mine` | |
| 담당 학생 목록 (강사/보호자 입장) | `GET /guardians?role=students` | |
| 대기 중인 연결 요청 목록 | `GET /guardians/pending` | 로그인 시 polling 권장 |
| 연결 수락 | `POST /guardians/link/:id/accept` | |
| 연결 거절 | `POST /guardians/link/:id/reject` | |
| 보호자 연결 해제 | `DELETE /guardians/:guardianUserId` | |
| 내 학생 레슨 그룹 | `GET /guardians/lesson-groups` | |
| 레슨 일정 목록 | `GET /lessons/:groupId/schedules` | LESSON 그룹만 |
| 레슨 일정 생성 | `POST /lessons/:groupId/schedules` | instructor 이상 |
| 레슨 일정 상세 + 출석 현황 | `GET /lessons/:groupId/schedules/:id` | 역할별 차등 |
| 출석 처리 | `POST /lessons/:groupId/schedules/:id/attendance` | UPSERT |
| 학생 목록 (강사 전용) | `GET /lessons/:groupId/students` | 보호자+출석률 포함 |

---

## 📦 DB 마이그레이션 현황 (v3.0 기준 최신)

| 번호 | 내용 | 상태 |
|------|------|------|
| 0001~0009 | 기본 스키마 | ✅ |
| 0010 | 미성년자/보호자(`user_guardians`, `guardian_invitations`), 레슨 스케줄(`lesson_schedules`, `lesson_attendances`) | ✅ |
| 0011~0013 | 초대링크, 그룹 단순화, 포인트 시스템 | ✅ |
| 0014 | lessons, events(재설계), products, orders, payments | ✅ |
| 0015~0017 | events.entry_fee, 포인트 만료, plan_configs | ✅ |
| 0018 | headhunter 제거 | ✅ |
| 0019 | nfc_physical_cards 배송·디자인 컬럼 | ✅ |

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v3.0 작성일: 2026-05-29*  
*기준 커밋: `0c65554` (feat: Guardian API + Lesson Schedule API + auth security fix)*  
*배포 URL: https://the-meti.pages.dev*
