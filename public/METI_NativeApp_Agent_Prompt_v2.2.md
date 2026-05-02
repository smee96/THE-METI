# METI 네이티브앱 개발 에이전트 프롬프트 v2.2

> **최종 업데이트**: 2026-05-02  
> **변경 사항 요약**: 미성년자 정책 최종 단순화 — Lite 계정 완전 제거, 그룹 초대링크 통합, 기본 비공개 원칙 확립

---

## 1. 서비스 개요

**METI**는 디지털 명함 기반 소셜 네트워크 플랫폼입니다.

- 개인/헤드헌터용 디지털 명함 생성 및 공유
- QR / NFC 기반 명함 교환
- 그룹(협회·클럽·레슨 등) 생성 및 운영
- 행사 참가 관리 / 채팅 / 리워드 포인트

**베이스 URL**: `https://the-meti.pages.dev`  
**API 버전**: `/api/v1/`

---

## 2. 핵심 정책 원칙 (v2.2 확정)

### 2-1. 기본 비공개 원칙
| 항목 | 기본값 | 사용자 변경 |
|------|--------|------------|
| 명함(is_public) | **비공개(0)** | 사용자가 공개 전환 가능 |
| 프로필(profile_visible) | **비공개** | 사용자가 공개 전환 가능 |
| 그룹(visibility) | public 또는 private 선택 | 그룹 생성 시 결정 |

### 2-2. 미성년자 정책 (단순화)

**핵심: 별도 계정 타입 없음. 모든 사용자는 동일한 일반 회원가입.**

- 나이는 회원가입 시 **수집하지 않음**
- 그룹 가입(직접 가입 또는 초대링크) 시 **생년월일 선택 입력**
- 생년월일 입력 시 → `group_members.is_minor` 자동 계산 (만 19세 미만 = 미성년)
- `is_minor`는 **그룹 멤버십 단위 속성** (특정 그룹에서만 미성년 표시)
- 플랫폼 전체 기능 제한 없음 — 미성년자도 일반 유저와 동일하게 METI 모든 기능 이용 가능
- **보호자 동의 불필요** (간단한 그룹 가입만으로 충분)

### 2-3. 그룹 생성 정책
- 누구든 그룹 생성 신청 가능
- 카테고리 구분 없음 → **용도(purpose)** 텍스트로 관리자 심사
- 관리자 심사 시 **미성년자 포함 여부(has_minor)** 직접 체크
- 승인 후 그룹 활성화

### 2-4. 초대링크 정책
- **모든 그룹**이 초대링크 생성 가능
- 초대링크 클릭 → 로그인/회원가입 후 그룹 즉시 가입 (active)
- 초대링크로 가입 시 관리자 승인 불필요
- 공개 모집(앱 내 광고·공지)도 가능

---

## 3. 인증 API

### 3-1. 회원가입
```
POST /api/v1/auth/register
```
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "account_type": "personal"  // "personal" | "headhunter"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "verify_token": "uuid..."  // 운영 환경에서는 이메일로 발송
  },
  "message": "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요."
}
```
> ⚠️ **나이(생년월일) 미수집** — 회원가입 폼에 생년월일 입력 불필요

---

### 3-2. 이메일 인증
```
POST /api/v1/auth/verify-email
```
```json
{ "token": "uuid..." }
```

---

### 3-3. 로그인
```
POST /api/v1/auth/login
```
```json
{ "email": "user@example.com", "password": "password123" }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "uuid...",
    "token_type": "Bearer",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "account_type": "personal",
      "plan": "free",
      "role": "user"
    }
  }
}
```

---

### 3-4. 토큰 갱신
```
POST /api/v1/auth/refresh
```
```json
{ "refresh_token": "uuid..." }
```

---

### 3-5. 로그아웃
```
POST /api/v1/auth/logout
Authorization: Bearer {token}
```
```json
{ "refresh_token": "uuid..." }
```

---

### 3-6. 비밀번호 찾기 / 재설정
```
POST /api/v1/auth/forgot-password
{ "email": "user@example.com" }

POST /api/v1/auth/reset-password
{ "token": "uuid...", "password": "newpassword123" }
```

---

### 3-7. 내 정보 조회
```
GET /api/v1/auth/me
Authorization: Bearer {token}
```

---

### 3-8. 초대링크 미리보기 (Public — 인증 불필요)
```
GET /api/v1/auth/invite/:token
```
**Response:**
```json
{
  "success": true,
  "data": {
    "token": "uuid...",
    "label": "2026 봄 수영반",
    "group": {
      "id": 5,
      "name": "한강수영클럽",
      "description": "한강에서 즐기는 수영 레슨",
      "logo_url": null,
      "purpose": "성인·청소년 대상 수영 레슨 운영",
      "has_minor": 1,
      "creator_name": "김강사"
    }
  }
}
```
> 앱 딥링크 처리 흐름: 링크 클릭 → 미리보기 조회 → 로그인/회원가입 → join API 호출

---

### 3-9. 초대링크로 그룹 즉시 가입 (로그인 필수)
```
POST /api/v1/auth/invite/:token/join
Authorization: Bearer {token}
```
**Request Body:**
```json
{
  "birth_date": "2010-03-15"  // 선택 — 입력 시 is_minor 자동 계산
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "group_id": 5,
    "is_minor": 1  // null(미입력), 0(성인), 1(미성년)
  },
  "message": "그룹에 참여했습니다."
}
```
> ✅ 초대링크 가입은 관리자 승인 없이 즉시 **active** 상태로 등록됩니다.

---

## 4. 명함 API

### 4-1. 내 명함 목록
```
GET /api/v1/cards?page=1&limit=20
Authorization: Bearer {token}
```

### 4-2. 명함 생성
```
POST /api/v1/cards
Authorization: Bearer {token}
```
```json
{
  "card_type": "personal",
  "name": "홍길동",
  "title": "프리랜서 개발자",
  "company": "(주)예시",
  "email": "hong@example.com",
  "phone": "010-1234-5678",
  "website": "https://hong.dev",
  "bio": "풀스택 개발자",
  "is_public": 0
}
```
> ⚠️ **is_public 기본값 = 0 (비공개)** — 사용자가 명시적으로 공개 설정 필요

**플랜별 명함 생성 제한:**
| 플랜 | 최대 명함 수 |
|------|-------------|
| free | 3개 |
| pro | 10개 |
| business | 무제한 |

초과 시 응답:
```json
{ "success": false, "error": "명함 생성 한도를 초과했습니다.", "upgrade_required": true }
```

### 4-3. 명함 공개 페이지 (인증 불필요)
```
GET /api/v1/cards/public/:cardId
```

### 4-4. 명함 저장 (상대방 명함 저장)
```
POST /api/v1/cards/:id/save
Authorization: Bearer {token}
```
> ⚠️ 채팅 시작 전 반드시 상대방 명함 저장 필요

---

## 5. 그룹 API

### 5-1. 공개 그룹 목록
```
GET /api/v1/groups?page=1&limit=20&q=검색어
```
> `q` 파라미터로 그룹 이름, 설명, **용도(purpose)** 통합 검색

**Response 항목:**
```json
{
  "id": 1,
  "name": "한강수영클럽",
  "description": "...",
  "purpose": "성인·청소년 대상 수영 레슨 운영",
  "visibility": "public",
  "has_minor": 1,
  "member_count": 42,
  "is_featured": 0
}
```

### 5-2. 그룹 개설 신청
```
POST /api/v1/groups
Authorization: Bearer {token}
```
```json
{
  "name": "한강수영클럽",
  "description": "한강에서 즐기는 수영 레슨 그룹",
  "purpose": "성인·청소년 대상 주 2회 수영 레슨 운영 목적",
  "visibility": "public",
  "max_members": 50
}
```
> - `purpose` 필드는 관리자 심사용 (5자 이상 필수)
> - `category` 필드 **없음** (구분 없이 purpose로 심사)
> - 생성 후 상태: `pending` → 관리자 승인 후 `active`

### 5-3. 그룹 상세 조회
```
GET /api/v1/groups/:id
```

### 5-4. 그룹 가입 신청 (일반 가입 — 관리자 승인 필요)
```
POST /api/v1/groups/:id/join
Authorization: Bearer {token}
```
```json
{
  "birth_date": "2010-03-15"  // 선택 — 레슨/스포츠 그룹에서 권장
}
```
> 일반 가입: `pending` → 그룹 관리자 승인 후 `active`  
> 초대링크 가입: 즉시 `active` (`POST /api/v1/auth/invite/:token/join` 사용)

### 5-5. 그룹 탈퇴
```
DELETE /api/v1/groups/:id/leave
Authorization: Bearer {token}
```

### 5-6. 멤버 목록 (관리자용)
```
GET /api/v1/groups/:id/members?status=pending&page=1
Authorization: Bearer {token}
```
> `is_minor` 필드 포함 — 관리자가 미성년자 구분 가능

### 5-7. 멤버 승인/거절/강퇴 (관리자)
```
PATCH /api/v1/groups/:id/members/:userId
Authorization: Bearer {token}
```
```json
{ "action": "approve" }  // "approve" | "reject" | "kick"
```

### 5-8. 공지사항
```
GET /api/v1/groups/:id/notices?page=1
POST /api/v1/groups/:id/notices  (관리자)
```

### 5-9. 초대링크 관리 (그룹 관리자)
```
POST /api/v1/groups/:id/invite-links
Authorization: Bearer {token}
```
```json
{
  "label": "2026 봄 수영반",
  "max_uses": 30,
  "expires_days": 30
}
```
**Response:**
```json
{
  "token": "uuid...",
  "invite_url": "https://the-meti.pages.dev/invite/uuid...",
  "label": "2026 봄 수영반",
  "max_uses": 30,
  "expires_at": "2026-06-01T00:00:00.000Z"
}
```

```
GET  /api/v1/groups/:id/invite-links              // 목록 조회
PATCH /api/v1/groups/:id/invite-links/:linkId/deactivate  // 비활성화
```

---

## 6. 행사 API

### 6-1. 행사 목록
```
GET /api/v1/events?page=1&limit=20&q=검색어&group_id=1
```

### 6-2. 행사 참가 신청
```
POST /api/v1/events/:id/register
Authorization: Bearer {token}
```

### 6-3. QR/NFC 입장 체크
```
POST /api/v1/events/:id/check-in
Authorization: Bearer {token}
```

---

## 7. 채팅 API

### 7-1. 채팅방 목록
```
GET /api/v1/chat/rooms
Authorization: Bearer {token}
```

### 7-2. 1:1 채팅 시작
```
POST /api/v1/chat/rooms
Authorization: Bearer {token}
```
```json
{ "target_user_id": 2 }
```
> ⚠️ **채팅 시작 전 반드시 상대방 명함 저장 필요** (`POST /api/v1/cards/:id/save`)

### 7-3. 메시지 조회 / 전송
```
GET  /api/v1/chat/rooms/:roomId/messages
POST /api/v1/chat/rooms/:roomId/messages
```

---

## 8. 레슨 API

### 8-1. 그룹 레슨 일정 목록
```
GET /api/v1/lessons/groups/:groupId/schedules
Authorization: Bearer {token}
```

### 8-2. 레슨 일정 생성 (관리자)
```
POST /api/v1/lessons/groups/:groupId/schedules
Authorization: Bearer {token}
```
```json
{
  "title": "수영 레슨 1회차",
  "starts_at": "2026-05-10T10:00:00Z",
  "ends_at": "2026-05-10T11:00:00Z",
  "location": "한강 수영장 A레인",
  "max_students": 20
}
```

### 8-3. 출석 처리
```
POST /api/v1/lessons/schedules/:scheduleId/attendance
Authorization: Bearer {token}
```
```json
{
  "student_user_id": 5,
  "status": "present"  // "present" | "absent" | "late"
}
```

---

## 9. 관리자 API (슈퍼어드민 전용)

### 9-1. 그룹 심사 목록
```
GET /api/v1/admin/groups?status=pending&page=1
Authorization: Bearer {admin_token}
```
**Response 항목에 `purpose` 포함:**
```json
{
  "id": 1,
  "name": "한강수영클럽",
  "purpose": "성인·청소년 대상 주 2회 수영 레슨",
  "admin_name": "김관리",
  "admin_email": "kim@example.com",
  "has_minor": null,
  "status": "pending"
}
```

### 9-2. 그룹 승인/거절 (has_minor 판단 포함)
```
PATCH /api/v1/admin/groups/:id
Authorization: Bearer {admin_token}
```
```json
{
  "action": "approve",
  "has_minor": 1,        // ← 관리자가 purpose 검토 후 직접 체크
  "is_featured": 0
}
```

| `action` | 설명 |
|----------|------|
| `approve` | 승인 → 그룹 status = active |
| `reject` | 거절 → status = rejected |
| `suspend` | 운영 정지 → status = suspended |
| `activate` | 재활성화 → status = active |

| `has_minor` | 의미 |
|-------------|------|
| `null` | 미판단 (기본) |
| `0` | 성인만 포함 |
| `1` | 미성년자 포함 |

### 9-3. 그룹 직접 생성 (슈퍼어드민)
```
POST /api/v1/admin/groups
Authorization: Bearer {admin_token}
```
```json
{
  "name": "METI 공식 그룹",
  "description": "METI 공식 커뮤니티",
  "purpose": "플랫폼 공지 및 이벤트 운영",
  "visibility": "public",
  "max_members": 1000,
  "has_minor": 0
}
```

### 9-4. 유저 관리
```
GET   /api/v1/admin/users?q=검색어&plan=free&page=1
PATCH /api/v1/admin/users/:id
```
```json
{ "is_active": 0, "plan": "pro" }
```

### 9-5. 대시보드 통계
```
GET /api/v1/admin/dashboard
```

---

## 10. 앱 개발팀 주요 가이드

### 10-1. 초대링크 딥링크 처리 흐름
```
초대링크 클릭 (https://the-meti.pages.dev/invite/:token)
    ↓
GET /api/v1/auth/invite/:token   ← 그룹 정보 미리보기 (인증 불필요)
    ↓
로그인 여부 확인
    ├── 미로그인 → 로그인 or 회원가입 유도
    └── 로그인됨 → 바로 join 호출
    ↓
POST /api/v1/auth/invite/:token/join   ← Bearer 토큰 필요
    { "birth_date": "YYYY-MM-DD" }     ← has_minor=1인 그룹이면 입력 권장
    ↓
그룹 즉시 가입 완료 (active)
```

### 10-2. 일반 그룹 가입 흐름
```
그룹 목록 화면 → 그룹 상세 → "가입 신청" 버튼
    ↓
POST /api/v1/groups/:id/join
    { "birth_date": "YYYY-MM-DD" }  ← 레슨 그룹이면 입력 권장 (선택)
    ↓
status: pending → 그룹 관리자 승인 대기 알림 표시
    ↓ (관리자 승인 후)
status: active → 그룹 화면 접근 가능
```

### 10-3. 생년월일 입력 UI 가이드
- **레슨·스포츠 성격의 그룹 가입 시** 생년월일 입력 권장 문구 표시
  - 예: "레슨 관리를 위해 생년월일을 입력해주세요 (선택사항)"
- **입력하지 않아도 가입 가능** (강제 아님)
- 입력 시 만 19세 미만이면 `is_minor = 1` 자동 설정 (그룹 멤버십 단위)

### 10-4. 명함 공개 설정 UI 가이드
- 명함 생성 시 **기본 비공개** → 토글/체크박스로 공개 전환
  - 비공개: "나만 보기 · 공유 링크로만 접근 가능"
  - 공개: "전체 공개 · 검색/피드에 노출"
- 명함 목록에서 공개 상태 아이콘(🔒/🌐) 표시

### 10-5. 그룹 생성 신청 UI 가이드
- 필드: 그룹 이름, 설명, **용도(purpose)**, 공개여부, 최대 인원
- `purpose` 안내 문구: "그룹의 목적과 활동 내용을 간단히 설명해 주세요 (예: 테니스 레슨, 동네 독서 모임 등)"
- 제출 후: "심사 중 안내 화면" 표시

### 10-6. 관리자 그룹 심사 UI 가이드
- 그룹 이름 / 용도(purpose) / 신청자 정보 표시
- **"미성년자 포함"** 체크박스: `has_minor` 값 설정 (null/0/1)
- 승인 / 거절 버튼
- 승인 시 `has_minor` 함께 전송:
  ```json
  { "action": "approve", "has_minor": 1 }
  ```

### 10-7. 플랜 업그레이드 유도
명함 3개(free) 초과 시:
```json
{ "success": false, "error": "명함 생성 한도를 초과했습니다.", "upgrade_required": true }
```
→ `upgrade_required: true` 응답 수신 시 업그레이드 유도 다이얼로그 표시

---

## 11. 화면별 API 호출 맵

| 화면 | 사용 API |
|------|---------|
| 회원가입 | `POST /auth/register` |
| 이메일 인증 | `POST /auth/verify-email` |
| 로그인 | `POST /auth/login` |
| 내 정보 | `GET /auth/me` |
| 초대링크 미리보기 | `GET /auth/invite/:token` |
| 초대링크 가입 | `POST /auth/invite/:token/join` |
| 명함 목록 | `GET /cards` |
| 명함 생성 | `POST /cards` |
| 명함 공개 페이지 | `GET /cards/public/:id` |
| 명함 저장 | `POST /cards/:id/save` |
| 그룹 목록 | `GET /groups` |
| 그룹 상세 | `GET /groups/:id` |
| 그룹 개설 신청 | `POST /groups` |
| 그룹 가입 신청 | `POST /groups/:id/join` |
| 그룹 탈퇴 | `DELETE /groups/:id/leave` |
| 그룹 공지 | `GET /groups/:id/notices` |
| 초대링크 생성 | `POST /groups/:id/invite-links` |
| 초대링크 목록 | `GET /groups/:id/invite-links` |
| 멤버 관리 | `GET /groups/:id/members` |
| 멤버 승인 | `PATCH /groups/:id/members/:userId` |
| 행사 목록 | `GET /events` |
| 행사 참가 | `POST /events/:id/register` |
| 채팅 목록 | `GET /chat/rooms` |
| 채팅 시작 | `POST /chat/rooms` |
| 메시지 | `GET/POST /chat/rooms/:id/messages` |
| 레슨 일정 | `GET /lessons/groups/:id/schedules` |
| 출석 처리 | `POST /lessons/schedules/:id/attendance` |
| 관리자 대시보드 | `GET /admin/dashboard` |
| 관리자 그룹 심사 | `GET/PATCH /admin/groups` |
| 관리자 유저 관리 | `GET/PATCH /admin/users` |

---

## 12. DB 스키마 핵심 변경 이력

| 마이그레이션 | 주요 내용 |
|------------|---------|
| 0011 | `group_invite_links` 테이블 추가 |
| 0012 | `groups.purpose` 추가, `groups.has_minor` 추가, `group_members.is_minor` / `birth_date` 추가 |

**group_members 주요 컬럼:**
```sql
is_minor    INTEGER  -- null(미입력), 0(성인), 1(미성년) — 그룹 단위 속성
birth_date  TEXT     -- YYYY-MM-DD 형식, 선택 입력
```

**groups 주요 컬럼:**
```sql
purpose   TEXT     -- 그룹 용도 설명 (관리자 심사용)
has_minor INTEGER  -- null(미판단), 0(성인만), 1(미성년 포함)
```

---

## 13. 제거된 기능 (v2.2)

다음 기능들은 **완전히 제거**되었습니다:

| 제거 항목 | 이유 |
|----------|------|
| Lite 계정 (invite join/login) | 불필요 — 일반 로그인 유저가 초대링크로 직접 가입 |
| `user_type` (ADULT/MINOR) | 불필요 — 그룹 멤버십 단위의 `is_minor`로 대체 |
| `invited_via_token` 컬럼 | Lite 계정 제거와 함께 불필요 |
| `user_guardians` 테이블 | 보호자 연결 기능 전면 제거 |
| `guardian_invitations` 테이블 | 제거 |
| `minor_activity_logs` 테이블 | 제거 |
| `minorAccessMiddleware` | 전체 기능 제한 없음으로 제거 |
| 그룹 `category` 필드 | `purpose`로 대체 |

---

*METI NativeApp Agent Prompt v2.2 — 2026-05-02*
