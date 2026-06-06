# METI 네이티브 앱 개발 에이전트 시작 프롬프트 v2.9

> 최종 업데이트: 2026-05-18  
> 변경 이력: **v2.8 → v2.9** — 명함 아바타(사진) 업로드 API 추가 · 명함 이력/SNS 탭 구조 추가 · 그룹 신청내역 API(`GET /groups/mine`) 신규 · pending 가입취소 지원 · 프로필 사진 업로드 API 추가 · 명함/그룹 응답 스키마 변경

---

## 🔔 이 문서의 목적

**v2.8 프롬프트 + v1.5 스펙** 기준으로 이미 전달된 내용을 **기반**으로 하며,  
본 문서는 **그 이후 백엔드에서 추가/변경된 사항만** delta(차이) 형식으로 기술합니다.

> v2.8 문서(`METI_NativeApp_Agent_Prompt_v2.8.md`)와 함께 읽어야 전체 API 명세가 완성됩니다.

---

## 📌 서비스 개요 (변경 없음)

- **Base URL**: `https://the-meti.pages.dev/api/v1`
- **인증**: JWT Bearer Token (Access 7일 / Refresh 30일, Token Rotation)
- **스토리지**: Cloudflare R2 (`the-meti-storage`)
  - Public CDN URL: `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev`

---

## 🗂️ v2.9 변경사항 요약

| 영역 | 변경 유형 | 내용 |
|------|----------|------|
| `POST /auth/me/avatar` | **신규 API** | 프로필 사진 R2 업로드 |
| `PATCH /auth/me` | **신규 API** | 이름 수정 |
| `GET /auth/me` 응답 | **스키마 추가** | `avatar_url` 필드 포함 |
| `POST /cards` | **요청 스키마 추가** | `tags[]`, `sns_links[]` 포함 |
| `GET /cards/:id` 응답 | **스키마 추가** | `tags[]`, `sns_links[]` 포함 |
| `GET /cards/public/:id` 응답 | **스키마 추가** | `tags[]`, `sns_links[]`, `avatar_url` 포함 |
| `PATCH /cards/:id` | **요청 스키마 추가** | `tags[]`, `sns_links[]` full-replace 지원 |
| `POST /cards/:id/avatar` | **신규 API** | 명함 사진 R2 업로드 |
| `GET /groups/mine` | **신규 API** | 내 그룹 + 신청내역 전용 목록 |
| `DELETE /groups/:id/leave` | **동작 변경** | pending 상태 가입취소(row DELETE) 지원 추가 |
| `POST /groups` | **요청 스키마 변경** | `category` → `purpose` 로 필드명 변경, 누구나 신청 가능 확인 |

---

## 1. 인증 (Auth) — 변경사항

### 1-A. [신규] 프로필 사진 업로드
```
POST /auth/me/avatar
권한: 🔐 Auth Required
Content-Type: multipart/form-data
```

**Request (form-data)**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `avatar` | File | ✅ | JPG/PNG/WEBP/GIF, 최대 5MB |

**Response 200**
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/avatars/2_1716000000000.jpg"
  },
  "message": "프로필 사진이 변경되었습니다."
}
```

**R2 키 패턴**: `avatars/{userId}_{timestamp}.{ext}`  
**에러 케이스**
- `400`: avatar 필드 없음 / 지원하지 않는 형식 / 5MB 초과
- `404`: 유저 없음

**Flutter 구현 참고**
```dart
// multipart/form-data 업로드
final request = http.MultipartRequest(
  'POST',
  Uri.parse('${baseUrl}/auth/me/avatar'),
)
..headers['Authorization'] = 'Bearer $accessToken'
..files.add(await http.MultipartFile.fromPath('avatar', imagePath));

final response = await request.send();
```

---

### 1-B. [신규] 프로필 이름 수정
```
PATCH /auth/me
권한: 🔐 Auth Required
Content-Type: application/json
```

**Request**
```json
{ "name": "새이름" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "user@example.com",
    "name": "새이름",
    "account_type": "personal",
    "plan": "free",
    "avatar_url": "https://...",
    "is_verified": 1,
    "role": "user",
    "created_at": "..."
  },
  "message": "프로필이 수정되었습니다."
}
```

**에러 케이스**
- `400`: `name` 미전송

---

### 1-C. [스키마 추가] GET /auth/me 응답

v2.9부터 `avatar_url` 필드가 응답에 포함됩니다.

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
    "avatar_url": "https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/avatars/2_xxx.jpg",  // ← 신규
    "is_verified": 1,
    "role": "user",
    "created_at": "2026-05-01T00:00:00.000Z"
  }
}
```

---

### 1-D. [동작 변경] 로그인 — super_admin 인증 우회

`role = 'super_admin'` 또는 `id = 1` 인 계정은 이메일 인증(`is_verified`) 없이도 로그인 가능.  
네이티브 앱에서는 이 동작에 영향 없음 (일반 유저는 동일하게 인증 필수).

---

## 2. 명함 (Cards) — 변경사항

### 2-A. [신규] 명함 사진 업로드
```
POST /cards/:id/avatar
권한: 🔐 Auth Required (본인 명함)
Content-Type: multipart/form-data
```

**Request (form-data)**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `avatar` | File | ✅ | JPG/PNG/WEBP/GIF, 최대 5MB |

**Response 200**
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/cards/2_5_1716000000000.jpg"
  },
  "message": "명함 사진이 변경되었습니다."
}
```

**R2 키 패턴**: `cards/{userId}_{cardId}_{timestamp}.{ext}`  

**앱 구현 플로우**
```
[명함 생성 플로우]
1. POST /cards   → cardId 획득
2. (선택) POST /cards/:cardId/avatar   → avatar_url 갱신

[명함 편집 플로우]
1. 사진 선택 즉시 → POST /cards/:id/avatar 호출
2. 기본 정보 저장 → PATCH /cards/:id
```

> ⚠️ 명함 **생성** 시점에는 avatar_url이 `null`로 초기화됩니다.  
> 생성 직후 별도 API 호출로 업로드하거나, 편집 화면에서 업로드하세요.

**에러 케이스**
- `400`: avatar 필드 없음 / 지원하지 않는 형식 / 5MB 초과
- `404`: 명함 없음 또는 본인 명함 아님

---

### 2-B. [스키마 추가] 명함 생성 — tags / sns_links 포함

`POST /cards` 요청 시 생성과 동시에 이력 태그와 SNS 링크를 함께 전송할 수 있습니다.

**Request (추가된 필드)**
```json
{
  "name": "홍길동",
  "title": "개발팀장",
  "company": "METI Inc.",
  "email": "hong@meti.io",
  "phone": "010-1234-5678",
  "website": "https://meti.io",
  "bio": "안녕하세요",
  "template_id": "default",
  "is_public": 1,

  // ── v2.9 신규 필드 ──
  "tags": [                            // 이력 태그 (선택)
    { "tag_type": "career",     "tag_value": "삼성전자 선임연구원 (2020~2023)" },
    { "tag_type": "career",     "tag_value": "METI Inc. 개발팀장 (2023~현재)" },
    { "tag_type": "education",  "tag_value": "서울대학교 컴퓨터공학과 (2016)" },
    { "tag_type": "skill",      "tag_value": "Flutter" },
    { "tag_type": "skill",      "tag_value": "TypeScript" }
  ],
  "sns_links": [                        // SNS 링크 (선택)
    { "platform": "linkedin",  "url": "https://linkedin.com/in/hong", "sort_order": 0 },
    { "platform": "github",    "url": "https://github.com/hong",      "sort_order": 1 },
    { "platform": "instagram", "url": "https://instagram.com/hong",   "sort_order": 2 }
  ]
}
```

**tag_type 허용값**

| tag_type | 설명 |
|----------|------|
| `career` | 경력 (회사명, 직책, 기간 등 자유 텍스트) |
| `education` | 학력 (학교명, 전공, 졸업연도 등 자유 텍스트) |
| `skill` | 기술 스택 / 스킬 (칩 형태로 표시) |
| `keyword` | 키워드 / 관심사 (기타 태그) |

**sns platform 허용값 (확장 가능)**

| platform | 표시 아이콘 예시 |
|----------|--------------|
| `linkedin` | LinkedIn 아이콘 |
| `github` | GitHub 아이콘 |
| `instagram` | Instagram 아이콘 |
| `twitter` | X(Twitter) 아이콘 |
| `facebook` | Facebook 아이콘 |
| `youtube` | YouTube 아이콘 |
| `blog` | 블로그/웹사이트 아이콘 |

---

### 2-C. [스키마 추가] 명함 상세 조회 응답 — tags / sns_links / avatar_url 포함

**GET /cards/:id** (인증 필요) 및 **GET /cards/public/:id** (공개) 응답에 추가된 필드:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "user_id": 2,
    "card_type": "personal",
    "name": "홍길동",
    "title": "개발팀장",
    "company": "METI Inc.",
    "email": "hong@meti.io",
    "phone": "010-1234-5678",
    "website": "https://meti.io",
    "bio": "안녕하세요",
    "template_id": "default",
    "is_primary": 1,
    "is_public": 1,
    "is_active": 1,
    "avatar_url": "https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/cards/2_5_xxx.jpg",  // ← 신규
    "created_at": "2026-05-01T00:00:00.000Z",
    "updated_at": "2026-05-18T00:00:00.000Z",

    // ── v2.9 신규 필드 ──
    "tags": [
      { "id": 1, "card_id": 5, "tag_type": "career",    "tag_value": "삼성전자 선임연구원 (2020~2023)", "created_at": "..." },
      { "id": 2, "card_id": 5, "tag_type": "skill",     "tag_value": "Flutter", "created_at": "..." }
    ],
    "sns_links": [
      { "id": 1, "card_id": 5, "platform": "linkedin", "url": "https://linkedin.com/in/hong", "sort_order": 0, "created_at": "..." },
      { "id": 2, "card_id": 5, "platform": "github",   "url": "https://github.com/hong",      "sort_order": 1, "created_at": "..." }
    ]
  }
}
```

> `GET /cards/public/:id`에도 동일하게 `tags`, `sns_links`, `avatar_url`이 포함됩니다.  
> `sns_count` 필드는 목록(`GET /cards`) 응답에만 포함되며, 상세 조회에서는 `sns_links` 배열로 확인합니다.

---

### 2-D. [스키마 추가] 명함 수정 — tags / sns_links full-replace

`PATCH /cards/:id` 요청 시 `tags`, `sns_links`를 포함하면 기존 데이터를 **전체 교체**합니다.

**Full-replace 규칙**
- `tags` 또는 `sns_links` 필드를 **포함하지 않으면** 해당 데이터 변경 없음 (기존 유지)
- `null`로 전송하면 변경 없음
- **빈 배열 `[]`로 전송하면 전체 삭제**
- **배열 값이 있으면 기존 전체 삭제 후 새로 INSERT** (수정 아님, 교체)

**Request 예시 — 이력 수정**
```json
{
  "bio": "업데이트된 소개",
  "tags": [
    { "tag_type": "career",    "tag_value": "새 직장 (2024~현재)" },
    { "tag_type": "skill",     "tag_value": "Dart" },
    { "tag_type": "skill",     "tag_value": "Flutter" }
  ],
  "sns_links": [
    { "platform": "linkedin", "url": "https://linkedin.com/in/hong-new", "sort_order": 0 }
  ]
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    // ... 명함 전체 필드 + tags[] + sns_links[]
  },
  "message": "명함이 수정되었습니다."
}
```

---

### 2-E. [참고] 명함 목록 응답 — sns_count 추가

`GET /cards` (내 명함 목록) 응답에 `sns_count` 필드가 추가됩니다 (상세 조회 없이 SNS 연결 여부 표시용).

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "홍길동",
      "title": "개발팀장",
      // ...기존 필드...
      "avatar_url": "https://...",    // 사진 있으면 URL, 없으면 null
      "sns_count": 2                  // ← 신규: SNS 링크 개수
    }
  ]
}
```

---

## 3. 그룹 (Groups) — 변경사항

### 3-A. [신규] 내 그룹 목록 (active + pending 통합)
```
GET /groups/mine
권한: 🔐 Auth Required
```

> ⚠️ **기존 `GET /groups`와 다릅니다.** `GET /groups`는 공개 그룹 탐색 전용이며 `my_status` 필드가 없습니다.  
> 내가 가입했거나 신청한 그룹, 내가 개설 신청한 그룹을 모두 보려면 반드시 이 API를 사용하세요.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "name": "METI 개발팀",
      "description": "개발자 모임",
      "purpose": "팀 내 명함 관리 및 네트워킹",
      "logo_url": null,
      "visibility": "public",
      "group_status": "active",      // 그룹 자체 상태: pending | active | suspended
      "max_members": 10,
      "created_at": "2026-05-01T00:00:00.000Z",
      "admin_name": "홍길동",
      "member_count": 5,

      // ── 내 상태 정보 ──
      "my_role": "member",           // admin | sub_admin | instructor | member
      "my_status": "active",         // active | pending | group_pending (내가 개설 신청한 그룹)
      "applied_at": "2026-05-10T00:00:00.000Z",
      "joined_at": "2026-05-11T00:00:00.000Z"
    },
    {
      "id": 7,
      "name": "신규 그룹 개설 신청",
      "group_status": "pending",     // 아직 승인 안 된 그룹
      "my_role": "admin",
      "my_status": "group_pending",  // ← 내가 직접 개설 신청한 그룹
      "applied_at": "2026-05-17T00:00:00.000Z",
      "joined_at": null
    },
    {
      "id": 4,
      "name": "수영 동호회",
      "group_status": "active",
      "my_role": "member",
      "my_status": "pending",        // ← 내가 가입 신청했으나 아직 승인 대기
      "applied_at": "2026-05-15T00:00:00.000Z",
      "joined_at": null
    }
  ]
}
```

**my_status 값 설명**

| my_status | 의미 | UI 표시 예시 |
|-----------|------|------------|
| `active` | 정식 가입 완료 | 그룹 배지 표시, 메뉴 접근 가능 |
| `pending` | 가입 신청 완료, 관리자 승인 대기 | "승인 대기 중" 배지, 취소 버튼 표시 |
| `group_pending` | 내가 개설 신청한 그룹, 플랫폼 어드민 승인 대기 | "개설 심사 중" 배지 |

---

### 3-B. [동작 변경] 그룹 탈퇴 / 가입 취소

**기존**: `DELETE /groups/:id/leave` — active 멤버만 탈퇴 처리  
**변경**: pending 상태의 가입 신청도 취소 가능 (row 삭제)

```
DELETE /groups/:id/leave
권한: 🔐 Auth Required
```

**상태별 처리**

| 현재 상태 | 처리 | Response |
|---------|------|---------|
| `active` (일반 멤버) | `status = 'left'` 업데이트 | `그룹에서 탈퇴했습니다.` |
| `active` (admin) | **오류** — 권한 이임 후 탈퇴 필요 | `400` |
| `pending` (가입 신청) | group_members row **DELETE** | `가입 신청이 취소되었습니다.` |

**Response 200 (취소 성공)**
```json
{
  "success": true,
  "data": null,
  "message": "가입 신청이 취소되었습니다."
}
```

---

### 3-C. [스키마 변경] 그룹 생성 신청

`POST /groups` 요청 스키마가 변경되었습니다.

**변경 전 (v2.8)**
```json
{
  "name": "METI 개발팀",
  "description": "개발자 모임",
  "category": "company",          // ← 삭제됨
  "visibility": "public",
  "max_members": 10
}
```

**변경 후 (v2.9)**
```json
{
  "name": "METI 개발팀",           // required, 2~100자
  "description": "개발자 모임",    // optional, ~1000자
  "purpose": "팀 명함 관리 및 네트워킹 목적으로 사용합니다.",  // required, 5~500자 ← 신규 필수
  "visibility": "public",          // optional, 기본 public
  "max_members": 10                // optional
}
```

> `category` 필드는 제거되었습니다. 대신 `purpose`(용도 설명)를 5자 이상 필수 입력해야 합니다.  
> `purpose`는 관리자 심사 시 그룹 승인/거절 판단에 사용됩니다.

**Response 201**
```json
{
  "success": true,
  "data": {
    "group_id": 7,
    "status": "pending",
    "message": "그룹 개설 신청이 완료되었습니다. 관리자 심사 후 활성화됩니다."
  }
}
```

**그룹 생성 정책 (v2.9 확인)**
- **플랜 무관** — free/pro/business 누구나 그룹 개설 신청 가능
- 생성 즉시 `status: pending` (어드민 승인 필요)
- 승인 후 `status: active`로 전환

---

## 4. 앱 화면 구성 — 신규/변경 화면

### 4-A. 명함 생성 화면 (2단계 구조)

v2.9부터 명함 생성은 **2단계 탭 구조**로 구현을 권장합니다.

**탭 1: 기본 정보**
```
[ 명함 사진 업로드 ]  ← 원형 아바타, 탭하면 갤러리/카메라 선택
─────────────────────
이름 *
직책
소속
이메일
전화번호
웹사이트
소개
─────────────────────
[ 다음: 이력 & SNS → ]
```

**탭 2: 이력 & SNS**
```
[ 경력 ]
+ 경력 추가 → 자유 텍스트 입력 (예: "METI Inc. 개발팀장 2023~현재")
  • METI Inc. 개발팀장 2023~현재  [삭제]
  • 삼성전자 선임연구원 2020~2023  [삭제]

[ 학력 ]
+ 학력 추가 → 자유 텍스트 입력 (예: "서울대학교 컴퓨터공학과 2016")
  • 서울대학교 컴퓨터공학과 2016  [삭제]

[ 스킬 ]
+ 스킬 추가 → 자유 텍스트 입력 (예: "Flutter")
  • Flutter  ×    TypeScript  ×    Dart  ×

[ SNS 링크 ]
플랫폼 선택: [LinkedIn ▼]  URL: [https://...]  [삭제]
+ SNS 링크 추가
─────────────────────
[ 저장 완료 ]  ← 탭 1 + 탭 2 데이터를 합쳐 POST /cards 한 번에 전송
```

**API 호출 순서**
```
1. POST /cards  (name, title, company, ..., tags[], sns_links[])  → cardId
2. (선택) POST /cards/:cardId/avatar  (form-data, avatar 파일)  → avatar_url
```

---

### 4-B. 명함 수정 화면 (2단계 구조)

**탭 1: 기본 정보** — 기존 데이터 채워서 표시, 사진 변경 즉시 업로드  
**탭 2: 이력 & SNS** — 기존 tags/sns_links 데이터 채워서 표시

**API 호출**
```
사진 변경 시   → 즉시 POST /cards/:id/avatar
저장 버튼 클릭 → PATCH /cards/:id  (변경된 필드 + tags[] + sns_links[] 전체 교체)
```

> `PATCH` 시 `tags`와 `sns_links`는 현재 화면에 표시된 전체 목록을 전송해야 합니다.  
> 서버는 기존 데이터를 삭제하고 전송된 배열로 교체합니다 (partial update 불가).

---

### 4-C. 공개 명함 페이지 (웹 딥링크 / 앱 인앱 표시)

`GET /cards/public/:id` 응답 기준 표시 항목:

```
[ 원형 아바타 사진 ]       ← avatar_url
이름                       ← name
직책 · 소속                ← title, company
이메일 | 전화번호 | 웹사이트  ← 연락처 아이콘 버튼
소개                       ← bio

[ SNS 링크 ]               ← sns_links[]
  [LinkedIn] [GitHub] [Instagram] ...  (플랫폼별 아이콘)

[ 경력 ]                   ← tags where tag_type = 'career'
  • METI Inc. 개발팀장 2023~현재
  • 삼성전자 선임연구원 2020~2023

[ 학력 ]                   ← tags where tag_type = 'education'
  • 서울대학교 컴퓨터공학과 2016

[ 스킬 ]                   ← tags where tag_type = 'skill'
  [Flutter] [TypeScript] [Dart] ...  (칩 형태)
```

> 각 섹션은 데이터가 있을 때만 표시합니다 (조건부 렌더링).

---

### 4-D. 그룹 화면 구조 (신청내역 분리)

**v2.9 권장 UI 구조**

```
[ 내 그룹 ] 탭              ← GET /groups/mine 결과
  ─────────────────────────
  ● 활성 그룹 (my_status = 'active')
    [METI 개발팀] admin  →  그룹 상세 이동
    [수영 동호회] member →  그룹 상세 이동

  ─────────────────────────
  ● 신청 내역 (my_status = 'pending' | 'group_pending')
    [개설 신청] 새 그룹 이름 — "개설 심사 중"
    [가입 신청] 수영 동호회  — "승인 대기 중"  [취소]

[ 그룹 탐색 ] 탭            ← GET /groups (공개 그룹 목록)
  검색창
  그룹 카드 목록
  [가입 신청] 버튼
```

**가입 취소 버튼 동작**
```dart
// pending 상태 가입 신청 취소
Future<void> cancelGroupJoin(int groupId) async {
  final response = await apiClient.delete('/groups/$groupId/leave');
  if (response['success'] == true) {
    // 목록에서 제거 또는 새로고침
    await loadMyGroups();
  }
}
```

---

### 4-E. 그룹 개설 신청 화면

```
[ 그룹 개설 신청 ]
─────────────────────
그룹 이름 *          (2~100자)
설명                 (선택, ~1000자)
그룹 용도 *          (5~500자, 관리자 심사용)
  예: "사내 명함 관리 및 행사 공지를 위해 사용하고자 합니다."
공개 설정            [공개 ▼ / 비공개]
최대 멤버 수         (선택)
─────────────────────
[신청하기]
```

> ✅ **플랜 무관** — free 플랜도 그룹 개설 신청 가능.  
> 개설 신청 후 `status: pending` → 플랫폼 어드민 승인 대기.  
> 앱에서는 "개설 심사 중" 상태로 표시하고, 승인 알림(푸시) 연동 권장.

---

## 5. DB 스키마 — 참고

### cards 테이블 (v2.8 기준 이미 존재)
```sql
cards.avatar_url   TEXT   -- NULL 가능, R2 public URL
```

### card_tags 테이블
```sql
CREATE TABLE card_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_type   TEXT NOT NULL,   -- career | education | skill | keyword
  tag_value  TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### card_sns_links 테이블
```sql
CREATE TABLE card_sns_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL,   -- linkedin | instagram | twitter | github | facebook | etc
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> 위 테이블들은 v2.8 이전 이미 마이그레이션 0002에 포함되어 있었으나,  
> 실제 앱에서 활용하는 API(POST/PATCH)가 v2.9에서 완성되었습니다.

---

## 6. 백엔드 현황 (v2.9 업데이트)

v2.8 현황에서 추가/변경된 항목만 기재합니다.

| 항목 | v2.8 상태 | v2.9 상태 |
|------|----------|----------|
| 명함 아바타 업로드 API (`POST /cards/:id/avatar`) | ⏳ 미구현 | ✅ 완료 |
| 명함 이력 태그 저장 (`POST /cards` tags[]) | ⏳ 미구현 | ✅ 완료 |
| 명함 SNS 링크 저장 (`POST /cards` sns_links[]) | ⏳ 미구현 | ✅ 완료 |
| 명함 이력/SNS 수정 (`PATCH /cards/:id` full-replace) | ⏳ 미구현 | ✅ 완료 |
| 명함 상세 조회 응답에 tags/sns_links 포함 | ⏳ 미구현 | ✅ 완료 |
| 공개 명함 조회 응답에 tags/sns_links/avatar_url 포함 | ⏳ 미구현 | ✅ 완료 |
| 프로필 사진 업로드 (`POST /auth/me/avatar`) | ⏳ 미구현 | ✅ 완료 |
| 프로필 이름 수정 (`PATCH /auth/me`) | ⏳ 미구현 | ✅ 완료 |
| 내 그룹 목록 API (`GET /groups/mine`) | ⏳ 미구현 | ✅ 완료 |
| 가입 신청 취소 (`DELETE /groups/:id/leave` pending) | ❌ 미지원 | ✅ 완료 |
| 그룹 개설 신청 (`POST /groups`) | ✅ 완료 | ✅ `purpose` 필드로 변경 |

---

## 7. 앱 개발 주의사항 (v2.9 추가분)

### ⚠️ 그룹 목록 API 혼동 주의

| API | 용도 | my_status 포함 여부 |
|-----|------|-------------------|
| `GET /groups` | 공개 그룹 탐색 (전체) | ❌ 없음 |
| `GET /groups/mine` | **내 그룹 + 신청내역** | ✅ 있음 |

앱의 "내 그룹" 탭에서는 반드시 `GET /groups/mine`을 사용하세요.

---

### ⚠️ 명함 이력 데이터 처리

1. **전체 교체 방식**: `PATCH /cards/:id` 시 `tags`/`sns_links`를 전송하면 기존 데이터 전체 삭제 후 재삽입
2. **일부만 수정 불가**: 특정 태그만 삭제/추가하는 partial update API 없음 → 전체 배열을 조합하여 전송
3. **순서 보장**: `sns_links`의 `sort_order`는 서버에서 배열 인덱스 순서로 자동 설정 (0, 1, 2...)

---

### ⚠️ 이미지 업로드 공통 규칙

| 항목 | 규격 |
|------|------|
| 허용 형식 | JPG, PNG, WEBP, GIF |
| 최대 크기 | 5MB |
| Content-Type | `multipart/form-data` |
| form field name | `avatar` (공통) |
| 서버 응답 | `{ avatar_url: "https://pub-..." }` |

---

### ⚠️ 명함 생성 후 사진 업로드 시 타이밍

```
❌ 잘못된 방식:
  POST /cards + avatar_url 필드 직접 전송  (→ avatar_url 필드 무시됨)

✅ 올바른 방식:
  1. POST /cards  → cardId
  2. POST /cards/:cardId/avatar  → avatar_url 반환
```

명함 생성 시 `avatar_url`은 항상 `null`로 초기화됩니다.  
반드시 별도 업로드 API를 호출하여 갱신하세요.

---

## 8. 화면-API 연결 표 (v2.9 업데이트)

v2.8 표에서 추가된 행만 기재합니다. 기존 항목은 v2.8 문서를 참고하세요.

| 화면 | 연결 API | 비고 |
|------|---------|------|
| 프로필 사진 변경 | `POST /auth/me/avatar` | multipart |
| 프로필 이름 수정 | `PATCH /auth/me` | |
| 명함 생성 (기본정보 탭) | `POST /cards` | tags[], sns_links[] 포함 |
| 명함 생성 후 사진 업로드 | `POST /cards/:id/avatar` | 생성 직후 또는 편집 시 |
| 명함 상세 (이력·SNS 포함) | `GET /cards/:id` | tags[], sns_links[] 포함 |
| 명함 수정 (이력·SNS) | `PATCH /cards/:id` | full-replace |
| 공개 명함 (딥링크) | `GET /cards/public/:id` | 이력·SNS·아바타 포함 |
| 내 그룹 + 신청내역 | `GET /groups/mine` | my_status로 분기 |
| 가입 신청 취소 | `DELETE /groups/:id/leave` | pending 상태 |
| 그룹 개설 신청 | `POST /groups` | purpose 필수 |

---

## 9. Flutter 코드 스니펫 (신규 API)

### 9-1. 이미지 업로드 공통 유틸
```dart
/// R2에 이미지를 업로드하는 공통 함수
Future<String?> uploadAvatar(String endpoint, String filePath) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('${ApiConstants.baseUrl}$endpoint'),
  );
  
  request.headers['Authorization'] = 'Bearer ${authService.accessToken}';
  request.files.add(
    await http.MultipartFile.fromPath('avatar', filePath),
  );
  
  final streamedResponse = await request.send();
  final response = await http.Response.fromStream(streamedResponse);
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['data']['avatar_url'] as String?;
  }
  return null;
}

// 사용 예시
// 프로필 사진
final url = await uploadAvatar('/auth/me/avatar', selectedImagePath);

// 명함 사진
final url = await uploadAvatar('/cards/$cardId/avatar', selectedImagePath);
```

---

### 9-2. 명함 생성 (이력 포함)
```dart
Future<Map<String, dynamic>> createCard({
  required String name,
  String? title,
  String? company,
  String? email,
  String? phone,
  String? bio,
  List<Map<String, String>> tags = const [],
  List<Map<String, dynamic>> snsLinks = const [],
}) async {
  final response = await apiClient.post('/cards', body: {
    'name': name,
    'title': title,
    'company': company,
    'email': email,
    'phone': phone,
    'bio': bio,
    'template_id': 'default',
    'is_public': 1,
    'tags': tags,          // [{'tag_type': 'career', 'tag_value': '...'}]
    'sns_links': snsLinks, // [{'platform': 'linkedin', 'url': '...', 'sort_order': 0}]
  });
  return response['data'];
}
```

---

### 9-3. 내 그룹 목록 로드
```dart
Future<void> loadMyGroups() async {
  final response = await apiClient.get('/groups/mine');
  final List<dynamic> all = response['data'] as List;
  
  // my_status로 분기
  activeGroups = all
      .where((g) => g['my_status'] == 'active')
      .cast<Map<String, dynamic>>()
      .toList();
  
  pendingGroups = all
      .where((g) => g['my_status'] == 'pending' || g['my_status'] == 'group_pending')
      .cast<Map<String, dynamic>>()
      .toList();
  
  notifyListeners();
}

/// 가입 신청 취소
Future<void> cancelJoin(int groupId) async {
  await apiClient.delete('/groups/$groupId/leave');
  await loadMyGroups(); // 목록 새로고침
}
```

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v2.9 작성일: 2026-05-18*  
*기준 커밋: `7aa6cc2` (feat: 그룹 신청내역 표시 + 그룹 개설 신청 기능 + GET /groups/mine API)*
