# METI 서비스 기획서 v1.7
> 최종 업데이트: 2026-05-29

---

## 변경 이력 (v1.6 → v1.7)

| # | 항목 | 변경 내용 |
|---|------|---------|
| 1 | 보호자(Guardian) API | `user_guardians` 테이블 기반 7개 엔드포인트 구현 완료 → 정책 반영 |
| 2 | 레슨 스케줄/출석 API | `lesson_schedules` / `lesson_attendances` 테이블 기반 5개 엔드포인트 구현 완료 → 정책 반영 |
| 3 | 채팅 보관 정책 | 플랜별 메시지 보관 일수 정책 (free 1일 / pro 90일 / business 무제한) 구현 완료 → 정책 반영 |
| 4 | 채팅 파일 업로드 | 채팅방 내 이미지(5MB) / 파일(20MB) R2 업로드 구현 완료 → 정책 반영 |
| 5 | 명함첩 API 명칭 정정 | `GET /cards/saved` → 실제 구현은 `GET /cards/contacts/list`, `POST /cards/:id/save`는 내부적으로 `card_contacts` 테이블 사용 |
| 6 | auth 보안 패치 | 회원가입(`verify_token`) / 비밀번호 재설정(`reset_token`) 응답 노출 제거 |
| 7 | 파트너 WebView URL | `partner_services.webview_url` 컬럼 추가 (migration 0020) |
| 8 | DB 마이그레이션 | 0020 (파트너 WebView URL + 채팅 보관 정책) 추가 |
| 9 | 구현 현황 | 보호자 API / Lesson Schedule API / 채팅 정책 / auth 보안 패치 반영 |

---

## 1. 서비스 개요 (변경 없음)

METI는 그룹·행사·레슨 기반의 네트워킹 플랫폼입니다.  
디지털 명함 교환, 그룹 활동 관리, 포인트 시스템, 레슨/행사 상품 결제를 통합 제공합니다.

| 항목 | 내용 |
|------|------|
| 서비스명 | METI |
| 플랫폼 | Flutter 네이티브 앱 + 웹(Cloudflare Pages) |
| 백엔드 | Hono (Cloudflare Workers) + D1 SQLite |
| 이미지 스토리지 | Cloudflare R2 (`the-meti-storage`) |
| R2 Public URL | `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev` |
| 배포 URL | https://the-meti.pages.dev |
| GitHub | https://github.com/smee96/THE-METI |
| 앱 번들 ID | com.meti.app |

---

## 2. 사용자 유형 (변경 없음)

| 유형 | 설명 |
|------|------|
| `personal` | 일반 사용자 — 모든 신규 가입자의 기본 account_type |
| `group_admin` | 그룹 관리자 역할 — `group_members.role = 'admin'` 으로 관리 (별도 account_type 아님) |
| `super_admin` | 슈퍼어드민 (어드민 웹 전용) — `users.role = 'super_admin'` 으로 관리 |

> `super_admin` 또는 `id=1` 계정은 이메일 인증(`is_verified`) 없이 로그인 가능.  
> `headhunter` account_type 완전 제거 (migration 0018).

---

## 3. 플랜 구조 (변경 없음)

| 플랜 | 월 포인트 | 그룹 최대 멤버 | 기본 명함 수 | 구독 방식 |
|------|-----------|---------------|------------|-----------|
| free | 0 P | 2명 | 3개 | 무료 |
| pro | 10,000 P | 10명 | 10개 | Apple IAP / Google Play |
| business | 500,000 P | 무제한 | 무제한 | Apple IAP / Google Play |

> 플랜별 명함 한도는 `plan_configs.free_card_limit` 어드민 설정으로 조정 가능.

---

## 4. 명함 정책 (변경 없음)

### 4.1 명함 종류

| card_type | 설명 |
|-----------|------|
| `personal` | 개인 명함 (기본) |
| `group` | 그룹 명함 — 특정 그룹의 active 멤버만 생성 가능, 탈퇴 시 자동 비활성화 |

### 4.2 명함 데이터 구성

```
cards (기본 정보)
  ├── card_tags[]      (이력 태그: career·education·skill·keyword)
  └── card_sns_links[] (SNS 링크: platform + url + sort_order)
```

### 4.3 명함 API 현황

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/cards` | 내 명함 목록 (sns_count 포함) |
| POST | `/api/v1/cards` | 명함 생성 (tags[], sns_links[] 동시 지원) |
| GET | `/api/v1/cards/public/:id` | 공개 명함 조회 (tags, sns_links, avatar_url 포함) |
| GET | `/api/v1/cards/:id` | 명함 상세 (인증 필요, tags, sns_links 포함) |
| PATCH | `/api/v1/cards/:id` | 명함 수정 (tags/sns_links full-replace) |
| DELETE | `/api/v1/cards/:id` | 명함 삭제 |
| POST | `/api/v1/cards/:id/avatar` | 명함 사진 R2 업로드 |
| POST | `/api/v1/cards/:id/qr-token` | QR 토큰 생성 (5분 유효) |
| GET | `/api/v1/cards/qr/:token` | QR 토큰으로 명함 조회 |
| POST | `/api/v1/cards/:id/save` | 명함첩에 저장 (`card_contacts` 테이블) |
| GET | `/api/v1/cards/contacts/list` | 저장된 명함 목록 조회 ⚠️ v1.6 표기(`/cards/saved`)와 다름 |

> ⚠️ **v1.6 표기 정정**: v1.6 스펙의 `GET /cards/saved` 경로는 실제 구현에서 `GET /cards/contacts/list`로 구현됨. 앱 개발 시 `/cards/contacts/list` 사용 필요.

---

## 5. 사용자 프로필 (변경 없음)

| 항목 | API |
|------|-----|
| 프로필 조회 | `GET /auth/me` (avatar_url 포함) |
| 이름 수정 | `PATCH /auth/me` |
| 프로필 사진 업로드 | `POST /auth/me/avatar` (R2, 5MB 한도) |
| 비밀번호 변경 | `PUT /auth/password` |

---

## 6. 인증 (Auth) — v1.7 변경사항

### 6.1 보안 패치: 토큰 응답 제거

**v1.7부터 아래 두 응답에서 토큰이 제거됩니다.**

#### 회원가입 응답 변경
```diff
// POST /auth/register → 201
{
  "success": true,
  "data": {
    "user_id": 2,
    "email": "user@example.com"
-   "verify_token": "uuid-..."  // 제거됨
  },
  "message": "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요."
}
```

#### 비밀번호 재설정 요청 응답 변경
```diff
// POST /auth/forgot-password → 200
{
  "success": true,
- "data": { "reset_token": "uuid-..." },  // 제거됨
+ "data": null,
  "message": "비밀번호 재설정 이메일이 발송되었습니다."
}
```

> **현황**: 이메일 발송 서비스 미연동. 개발/테스트 시 DB에서 직접 토큰 확인 필요.  
> **앱 처리**: 회원가입/비밀번호 재설정 후 "이메일을 확인하세요" 안내 화면만 표시.

---

## 7. 포인트 시스템 (변경 없음)

### 7.1 개인 포인트 용도

| 사용처 | 차감 |
|--------|------|
| 행사 참가비 (`entry_fee`) | 행사 설정값 |
| 개인 → 그룹 이전 | 이전 금액 |

### 7.2 그룹 포인트 용도

| 사용처 | 차감 포인트 |
|--------|------------|
| 레슨 개설 | 500 P |
| 행사 개설 (정원 ≤ 30) | 1,000 P |
| 행사 개설 (정원 31~100) | 3,000 P |
| 행사 개설 (정원 > 100 또는 무제한) | 5,000 P |

### 7.3 포인트 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/points/balance` | 개인 포인트 잔액 |
| GET | `/api/v1/points/history` | 개인 포인트 내역 |
| POST | `/api/v1/points/transfer` | 개인 → 그룹 이전 |
| GET | `/api/v1/points/groups/:groupId/balance` | 그룹 포인트 잔액 |
| GET | `/api/v1/points/groups/:groupId/history` | 그룹 포인트 내역 |
| GET | `/api/v1/point-charge-products` | 포인트 충전 상품 목록 |

---

## 8. 그룹 (Groups) (변경 없음)

### 8.1 그룹 내 역할

| 역할 | 권한 |
|------|------|
| `admin` | 최고 관리자. 역할 변경, 행사·레슨 생성 |
| `sub_admin` | 부관리자. 행사·레슨 생성 가능 |
| `instructor` | 강사. 담당 레슨 생성 가능 |
| `member` | 일반 멤버 |

### 8.2 그룹 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/groups` | 공개 그룹 탐색 |
| POST | `/api/v1/groups` | 그룹 개설 신청 (`purpose` 필수, 플랜 무관) |
| GET | `/api/v1/groups/mine` | 내 그룹 + 신청내역 통합 조회 |
| GET | `/api/v1/groups/:id` | 그룹 상세 |
| POST | `/api/v1/groups/:id/join` | 가입 신청 |
| DELETE | `/api/v1/groups/:id/leave` | 탈퇴 (active) 또는 가입취소 (pending → row 삭제) |
| GET | `/api/v1/groups/:id/members` | 멤버 목록 |
| PATCH | `/api/v1/groups/:id/members/:memberId` | 승인/거절/강퇴 |
| PATCH | `/api/v1/groups/:id/members/:memberId/role` | 역할 변경 |
| GET | `/api/v1/groups/:id/notices` | 공지 목록 |
| POST | `/api/v1/groups/:id/notices` | 공지 작성 |
| POST | `/api/v1/groups/:id/invite-links` | 초대 링크 생성 |
| GET | `/api/v1/groups/:id/invite-links` | 초대 링크 목록 |
| GET | `/api/v1/groups/invite/:token` | 초대 링크 정보 조회 (Public) |
| POST | `/api/v1/auth/invite/:token/join` | 초대 링크로 그룹 가입 |

---

## 9. 보호자 (Guardians) — v1.7 신규 🆕

> 미성년자(MINOR) ↔ 보호자(부모/강사) 연결 관리  
> **DB 테이블**: `user_guardians`, `guardian_invitations` (migration 0010)

### 9.1 정책

| 항목 | 내용 |
|------|------|
| 연결 요청 주체 | 보호자(성인) → 학생(MINOR)에게 요청 |
| 수락 주체 | 학생 본인 또는 super_admin |
| 거절 주체 | 학생 본인만 |
| 연결 관계 유형 | `parent` (부모) \| `teacher` (강사/선생님) |
| 연결 상태 | `pending` → `active` (수락) \| `rejected` (거절) |
| 재요청 | `rejected` 상태에서 동일 학생에게 재요청 가능 |
| 연결 해제 | 학생 본인 또는 보호자 본인 모두 해제 가능 (양방향) |

### 9.2 API

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/guardians/link` | 🔐 Auth | 보호자 연결 요청 |
| POST | `/api/v1/guardians/link/:requestId/accept` | 🔐 학생 본인 / super_admin | 연결 수락 |
| POST | `/api/v1/guardians/link/:requestId/reject` | 🔐 학생 본인 | 연결 거절 |
| GET | `/api/v1/guardians?role=mine\|students` | 🔐 Auth | 보호자/학생 목록 조회 |
| GET | `/api/v1/guardians/pending` | 🔐 Auth | 대기 중인 연결 요청 목록 |
| DELETE | `/api/v1/guardians/:guardianUserId` | 🔐 Auth | 보호자 연결 해제 |
| GET | `/api/v1/guardians/lesson-groups` | 🔐 Auth | 내 학생들의 레슨 그룹 목록 |

### 9.3 연결 요청 API 상세

```
POST /api/v1/guardians/link  🔐
```

**Request**
```json
{
  "minor_user_id": 5,               // minor_user_id 또는 minor_email 중 하나 필수
  "minor_email": "student@meti.io",
  "relation": "teacher",            // "parent" | "teacher"
  "group_id": 2                     // optional: 그룹 내 보호자 자동 등록
}
```

**Response 201**
```json
{
  "success": true,
  "data": { "id": 1, "minor_user_id": 5, "guardian_user_id": 3, "relation": "teacher", "status": "pending" },
  "message": "보호자 연결 요청이 발송되었습니다."
}
```

---

## 10. 레슨 (Lessons) — v1.7 확장

### 10.1 기존 레슨 CRUD API (변경 없음)

`lessons` 테이블 기반 수강 신청/취소 시스템.

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/lessons/groups/:groupId/lessons` | 그룹 멤버 | 레슨 목록 |
| POST | `/api/v1/lessons/groups/:groupId/lessons` | admin/sub_admin/instructor | 레슨 생성 (500P 차감) |
| GET | `/api/v1/lessons/:id` | 그룹 멤버 | 레슨 상세 |
| PUT | `/api/v1/lessons/:id` | admin/sub_admin/강사 본인 | 레슨 수정 |
| DELETE | `/api/v1/lessons/:id` | admin/sub_admin | 레슨 취소 |
| POST | `/api/v1/lessons/:id/register` | 그룹 멤버 | 수강 신청 |
| DELETE | `/api/v1/lessons/:id/register` | 신청자 본인 | 수강 취소 |

### 10.2 레슨 스케줄/출석 API — 신규 🆕

`lesson_schedules` + `lesson_attendances` 테이블 기반. LESSON 타입 그룹 전용.

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/lessons/:groupId/schedules` | 그룹 멤버·보호자 | 일정 목록 (페이지네이션) |
| POST | `/api/v1/lessons/:groupId/schedules` | instructor 이상 | 일정 생성 |
| GET | `/api/v1/lessons/:groupId/schedules/:id` | 그룹 멤버·보호자 | 일정 상세 + 출석 현황 |
| POST | `/api/v1/lessons/:groupId/schedules/:id/attendance` | instructor 이상 | 출석 배치 처리 (UPSERT) |
| GET | `/api/v1/lessons/:groupId/students` | instructor 이상 | 학생 목록 + 보호자 정보 + 출석률 |

### 10.3 레슨 스케줄 정책

| 항목 | 내용 |
|------|------|
| 생성 조건 | LESSON 타입 그룹에서만 생성 가능 |
| 생성 권한 | `instructor` / `sub_admin` / `admin` |
| 일정 상태 | `scheduled` → `ongoing` (첫 출석 처리 시 자동 전환) → `completed` / `cancelled` |
| 출석 처리 | UPSERT — 이미 처리된 학생도 재처리 가능 |
| 출석 상태값 | `present` (출석) / `absent` (결석) / `late` (지각) / `excused` (공결) |
| 보호자 접근 | 담당 학생의 출석만 조회 가능 |

---

## 11. 행사 (Events) (변경 없음)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/events/groups/:groupId/events` | 그룹 멤버 | 행사 목록 |
| POST | `/api/v1/events/groups/:groupId/events` | admin/sub_admin | 행사 생성 (포인트 차감) |
| GET | `/api/v1/events/:id` | 조건부 | 행사 상세 |
| PUT | `/api/v1/events/:id` | admin/sub_admin | 행사 수정 |
| DELETE | `/api/v1/events/:id` | admin/sub_admin | 행사 취소 |
| POST | `/api/v1/events/:id/join` | 그룹 멤버 | 행사 참가 신청 |
| DELETE | `/api/v1/events/:id/join` | 신청자 본인 | 행사 취소 (참가비 환불) |
| GET | `/api/v1/events/:id/participants` | admin/sub_admin | 참가자 목록 |

---

## 12. 채팅 (Chat) — v1.7 정책 추가

### 12.1 채팅 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/chat` | 내 채팅방 목록 |
| POST | `/api/v1/chat` | 1:1 채팅방 시작/조회 (명함 교환 여부 확인) |
| GET | `/api/v1/chat/:roomId/messages` | 메시지 목록 |
| POST | `/api/v1/chat/:roomId/messages` | 메시지 전송 |
| DELETE | `/api/v1/chat/:roomId/messages/:msgId` | 메시지 삭제 (본인) |
| POST | `/api/v1/chat/:roomId/report` | 신고 |
| POST | `/api/v1/chat/:roomId/upload` | 파일/이미지 R2 업로드 |
| POST | `/api/v1/chat/:userId/block` | 차단 |

### 12.2 채팅 메시지 보관 정책 — 신규 🆕

> migration 0020 + `plan_configs` 기반으로 구현 완료

| 플랜 | 메시지 보관 기간 |
|------|----------------|
| free | **1일** |
| pro | **90일** |
| business | **무제한** |

- `config_key` 기준: `chat_retention_free` / `chat_retention_pro` / `chat_retention_business`
- 값 `0` = 무제한 (business 기본값)
- 메시지 전송 시 플랜 조회 → `expires_at` 자동 설정
- 어드민 `plan_configs`에서 기간 조정 가능

### 12.3 채팅 파일 업로드 정책 — 신규 🆕

```
POST /api/v1/chat/:roomId/upload
Content-Type: multipart/form-data
```

| 항목 | 내용 |
|------|------|
| form field | `file` (필수) |
| 이미지 최대 크기 | **5MB** |
| 파일 최대 크기 | **20MB** |
| 허용 이미지 형식 | JPG, PNG, GIF, WEBP, BMP, SVG |
| R2 키 패턴 | `chat/{roomId}/{userId}_{timestamp}_{originalName}` |
| 메시지 자동 저장 | 업로드 후 채팅 메시지로 자동 저장 (type: `image` 또는 `file`) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "url": "https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/chat/1/2_1716000000000_photo.jpg",
    "file_type": "image",
    "file_name": "photo.jpg",
    "file_size": 1048576,
    "message_id": 42
  }
}
```

> ⚠️ 채팅방 멤버 확인 + 차단 여부 확인 후 업로드 허용  
> 채팅 시작 조건(명함 교환)이 충족된 방에서만 업로드 가능

---

## 13. 상품·주문·결제 (변경 없음)

### 13.1 결제 PG

| 대상 | PG사 | 통화 |
|------|------|------|
| 국내 결제 | Toss Payments | KRW |
| 해외 결제 | Stripe | USD |
| Apple 구독 | Apple IAP | 각국 통화 |
| Google 구독 | Google Play Billing | 각국 통화 |

### 13.2 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/groups/:groupId/products` | 그룹 상품 목록 |
| POST | `/api/v1/groups/:groupId/products` | 상품 등록 (admin/sub_admin) |
| PUT | `/api/v1/products/:id` | 상품 수정 |
| POST | `/api/v1/orders` | 주문 생성 |
| GET | `/api/v1/orders` | 내 주문 목록 |
| GET | `/api/v1/orders/:id` | 주문 상세 |
| POST | `/api/v1/payments/verify-web` | 웹 결제 검증 (PG placeholder) |
| POST | `/api/v1/payments/payment-token` | 결제용 일회성 토큰 발급 |
| GET | `/api/v1/payments/payment-token/verify` | 토큰 유효성 검증 |
| POST | `/api/v1/payments/subscription/verify-apple` | Apple IAP 검증 (placeholder) |
| POST | `/api/v1/payments/subscription/verify-google` | Google Play 검증 (placeholder) |
| GET | `/api/v1/point-charge-products` | 포인트 충전 상품 목록 |

---

## 14. NFC 실물카드 (변경 없음)

| 컬럼 | 설명 |
|------|------|
| `design_type` | `basic` \| `premium` \| `custom` |
| `status` | `pending` → `approved` → `issued` \| `lost` \| `deactivated` |
| `shipping_*` | 수령인 이름·연락처·주소·메모 |
| `tracking_no` / `carrier` | 운송장 번호 / 택배사 |
| `amount` / `payment_status` | 결제금액 / `unpaid`\|`paid`\|`refunded` |
| `shipped_at` | 발송 일시 |

> NFC 실물카드 **앱 신청 API 미구현** — DB 스키마만 준비 완료 (어드민 웹에서만 관리 가능)

---

## 15. 파트너 연동 — v1.7 업데이트

### 15.1 파트너 API (S2S 전용)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/partner/users/map` | 사용자 매핑 |
| POST | `/api/v1/partner/rewards` | 리워드 지급 |
| GET | `/api/v1/partner/user-balance` | 사용자 잔액 조회 |
| GET | `/api/v1/partner/services` | 파트너 서비스 목록 조회 (앱용) |

### 15.2 파트너 WebView URL — 신규 🆕

> migration 0020: `partner_services.webview_url` 컬럼 추가

- 파트너 서비스를 앱 내 WebView로 로드할 URL 저장 가능
- `GET /api/v1/partner/services` 응답에 `webview_url` 포함
- 앱에서 해당 서비스 선택 시 WebView로 열기

---

## 16. 딥링크 (변경 없음)

| URL 패턴 | 동작 |
|----------|------|
| `/card/:id` | 명함 공개 페이지 (이력·SNS·아바타 포함) |
| `/invite/:token` | 그룹 초대링크 |
| `/payment?token=xxx` | 웹 결제 페이지 (일회성 토큰) |

---

## 17. 구현 현황 (v1.7 업데이트)

| 영역 | 상태 |
|------|------|
| 인증 (JWT, Rotation, 비밀번호 재설정) | ✅ 완료 |
| 프로필 사진·이름 수정 | ✅ 완료 |
| **auth 보안 패치 (토큰 응답 노출 제거)** | ✅ **완료 (v1.7 신규)** |
| 명함 CRUD + 아바타 + 이력/SNS | ✅ 완료 |
| 명함 공개 페이지 (이력·SNS·아바타) | ✅ 완료 |
| QR 토큰 (명함 공유, 행사 입장) | ✅ 완료 |
| 명함첩 (`card_contacts` — `POST /cards/:id/save`, `GET /cards/contacts/list`) | ✅ 완료 |
| 그룹 (생성·승인·멤버·역할·공지·초대링크) | ✅ 완료 |
| `GET /groups/mine` (내 그룹 + 신청내역) | ✅ 완료 |
| `DELETE /groups/:id/leave` pending 취소 | ✅ 완료 |
| 포인트 (잔액·내역·이전·그룹) | ✅ 완료 |
| **보호자 API (7개 엔드포인트)** | ✅ **완료 (v1.7 신규)** |
| 레슨 CRUD + 수강 신청 | ✅ 완료 |
| **레슨 스케줄/출석 API (5개 엔드포인트)** | ✅ **완료 (v1.7 신규)** |
| 행사 CRUD + 참가 신청·체크인·환불 | ✅ 완료 |
| 채팅 API (1:1, 메시지, 신고·차단) | ✅ 완료 |
| **채팅 파일/이미지 업로드 (R2, 5MB/20MB)** | ✅ **완료 (v1.7 신규)** |
| **채팅 메시지 보관 정책 (플랜별 차등)** | ✅ **완료 (v1.7 신규)** |
| 상품·주문·결제 API (PG placeholder) | ✅ 완료 |
| 파트너 API (매핑·리워드·잔액) | ✅ 완료 |
| **파트너 WebView URL** | ✅ **완료 (v1.7 신규)** |
| 어드민 웹 (대시보드·유저·그룹·명함·행사·레슨·포인트·NFC·신고·파트너) | ✅ 완료 |
| NFC 실물카드 DB 스키마 (배송·디자인 컬럼) | ✅ 완료 (migration 0019) |
| **NFC 실물카드 어드민 관리 API** | ✅ **완료 (어드민 전용)** |
| 이메일 발송 연동 (verify/reset) | ⏳ 도메인/Resend 서비스 확정 대기 |
| 웹 결제 페이지 (`/payment`) | ⏳ PG 키 수령 후 구현 |
| Toss / Stripe 서버사이드 검증 | ⏳ PG 키 수령 후 구현 |
| Apple IAP / Google Play 서버 검증 | ⏳ 앱 연동 후 구현 |
| NFC 실물카드 **앱 신청 API** | ⏳ 미구현 |
| 딥링크 처리 (Flutter 앱 내) | ⏳ 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 (FCM / APNs) | ⏳ 미결정 |
| 채팅 실시간 (WebSocket/SSE) | ⏳ Phase 2 |
| 구독 웹훅 | ⏳ Phase 2 |

---

## 18. DB 마이그레이션 목록 (v1.7 기준)

| 번호 | 내용 | 상태 |
|------|------|------|
| 0001~0009 | 기본 스키마 (users, cards, groups, events, chat, rewards, plans, user_role) | ✅ 적용 |
| 0010 | 미성년자/보호자 (`user_guardians`, `guardian_invitations`), 레슨 스케줄 (`lesson_schedules`, `lesson_attendances`) | ✅ 적용 |
| 0011~0012 | 초대링크 단순화, 그룹 단순화 (`category` → `purpose`, `has_minor`) | ✅ 적용 |
| 0013 | 포인트 시스템 (`point_wallets`, `point_transactions`), 플랜 멤버수 제한 | ✅ 적용 |
| 0014 | lessons, events(재설계), products, orders, payments, lesson_registrations, event_participants | ✅ 적용 |
| 0015 | `events.entry_fee` 컬럼 추가 | ✅ 적용 |
| 0016 | `point_wallets.expires_at`, `point_type` 컬럼 추가 | ✅ 적용 |
| 0017 | `plan_configs`: `extra_card_price`, `free_card_limit` / `point_charge_products` 테이블 | ✅ 적용 |
| 0018 | headhunter account_type 제거 | ✅ 적용 |
| 0019 | `nfc_physical_cards` 배송·디자인 컬럼 추가 | ✅ 적용 |
| **0020** | **`partner_services.webview_url` 추가 + 채팅 보관 정책 (`plan_configs`)** | ✅ **적용 (v1.7 신규)** |

---

## 19. 미결 정책 항목

| 항목 | 현재 상태 | 확정 필요 내용 |
|------|---------|-------------|
| 플랜별 명함 한도 | free 3개·pro 10개·business 무제한 | 기획 원안(1·3·10개)과 다름 → 최종 확정 후 서버 수정 |
| NFC 실물카드 앱 신청 API | DB 스키마만 존재 | 신청·발급·배송조회 앱 API 설계 필요 |
| NFC 실물카드 가격 | 미정 | 디자인 타입별(basic/premium/custom) 가격 정책 필요 |
| 이메일 발송 연동 | 미연동 | 도메인 확정 후 Resend 연동 예정 |
| 푸시 알림 | 미결정 | FCM/APNs 연동 여부 및 알림 항목 확정 필요 |
| 채팅 실시간 | Phase 2 | WebSocket 또는 SSE 방식 확정 필요 |

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v1.7 작성일: 2026-05-29*  
*기준 커밋: `0c65554` + `ee29d7b`*
