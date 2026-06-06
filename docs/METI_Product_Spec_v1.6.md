# METI 서비스 기획서 v1.6
> 최종 업데이트: 2026-05-18

---

## 변경 이력 (v1.5 → v1.6)

| # | 항목 | 변경 내용 |
|---|------|---------|
| 1 | 명함 데이터 모델 | `avatar_url`, `card_type`, `is_primary` 필드 정식 기재 · `card_tags` / `card_sns_links` 테이블 기능 활성화 |
| 2 | 명함 이력/SNS 기능 | 경력·학력·스킬·SNS 링크 입력·저장·표시 기능 구현 완료 → 정책 반영 |
| 3 | 명함 아바타(사진) | 명함별 프로필 사진 업로드(R2) 기능 구현 완료 → 정책 반영 |
| 4 | 프로필 사진/이름 수정 | 사용자 프로필 사진(R2) 및 이름 수정 기능 구현 완료 → 정책 반영 |
| 5 | 그룹 정책 | `category` 필드 제거 확정 · `purpose`(용도) 필드 필수화 · **플랜 무관 누구나 개설 신청 가능** 명시 |
| 6 | 그룹 신청내역 | 그룹 가입 신청 및 개설 신청 상태를 별도 조회하는 `GET /groups/mine` API 정책 반영 |
| 7 | 그룹 가입취소 | pending 상태에서 가입 신청 취소 가능(row 삭제) 정책 반영 |
| 8 | DB 마이그레이션 | 0019 (NFC 실물카드 배송·디자인 컬럼) 추가 |
| 9 | 명함 한도 | 현재 실제 적용 한도 (free 3개·pro 10개·business 무제한) 반영 |
| 10 | 스토리지 | Cloudflare R2 (`the-meti-storage`) 정식 채택 명시 |

---

## 1. 서비스 개요

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
| 앱 번들 ID | com.meti.app |

---

## 2. 사용자 유형

| 유형 | 설명 |
|------|------|
| `personal` | 일반 사용자 (명함·그룹 멤버). 모든 회원의 기본 account_type |
| `group_admin` | 그룹 관리자 역할 — `group_members.role = 'admin'` 으로 관리 (별도 account_type 아님) |
| `super_admin` | 슈퍼어드민 (어드민 웹 전용) — `users.role = 'super_admin'` 으로 관리 |

> **⚠️ v1.5 이후 확정**: `headhunter` account_type 완전 제거. 모든 신규 가입자는 `personal` 고정.  
> `super_admin` 또는 `id=1` 계정은 이메일 인증(`is_verified`) 없이 로그인 가능 (관리자 계정 운영 편의).

---

## 3. 플랜 구조

| 플랜 | 월 포인트 | 그룹 최대 멤버 | 기본 명함 수 | 구독 방식 |
|------|-----------|---------------|------------|-----------|
| free | 0 P | 2명 | 3개 ⚠️ | 무료 |
| pro | 10,000 P | 10명 | 10개 ⚠️ | Apple IAP / Google Play |
| business | 500,000 P | 무제한 | 무제한 ⚠️ | Apple IAP / Google Play |

> ⚠️ **v1.6 수정**: 실제 서버 구현 기준 명함 한도.  
> v1.5 스펙(free 1개 / pro 3개 / business 10개)과 **현재 서버 코드가 다릅니다**.  
> 현재 코드: `{ free: 3, pro: 10, business: null(무제한) }`  
> → 추후 어드민 설정(`plan_configs.free_card_limit`)으로 조정 가능하며, 최종 정책 확정 시 서버 코드 수정 필요.

> **구독 결제**: Apple IAP(`com.meti.pro_monthly`, `com.meti.business_monthly`) + Google Play Billing  
> **웹 결제** (레슨·행사 상품·포인트 충전): Toss Payments + Stripe

---

## 4. 명함 정책

### 4.1 명함 종류

| card_type | 설명 |
|-----------|------|
| `personal` | 개인 명함 (기본) |
| `group` | 그룹 명함 — 특정 그룹의 active 멤버만 생성 가능, 탈퇴 시 자동 비활성화 |

### 4.2 기본 제공 수량 및 추가 구매

| 플랜 | 기본 명함 수 | 추가 명함 비용 |
|------|------------|--------------|
| free | 3개 (코드 기준, 정책 확정 필요) | 1개당 5,000원 |
| pro | 10개 (코드 기준, 정책 확정 필요) | 1개당 5,000원 |
| business | 무제한 (코드 기준) | — |

- 기본 수량 초과 시 1개당 **5,000원** 웹 결제 (`plan_configs.extra_card_price` 어드민 변경 가능)
- 구매한 추가 명함은 플랜 변경 시에도 유지
- 플랜 한도 초과 시 `403 upgrade_required: true` 응답

### 4.3 명함 데이터 구성

명함 1장은 아래 세 가지 데이터로 구성됩니다.

```
cards (기본 정보)
  ├── card_tags[]      (이력 태그: 경력·학력·스킬·키워드)
  └── card_sns_links[] (SNS 링크: 플랫폼 + URL)
```

#### cards 테이블 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK |
| `user_id` | INTEGER | 소유자 |
| `group_id` | INTEGER? | 그룹 명함 시 그룹 ID |
| `card_type` | TEXT | `personal` \| `group` |
| `name` | TEXT | 이름 (필수) |
| `title` | TEXT? | 직책 |
| `company` | TEXT? | 소속 |
| `email` | TEXT? | 이메일 |
| `phone` | TEXT? | 전화번호 |
| `website` | TEXT? | 웹사이트 URL |
| `bio` | TEXT? | 소개 (최대 500자) |
| `avatar_url` | TEXT? | **명함 사진** R2 URL (생성 시 null, 별도 업로드) |
| `template_id` | TEXT | 디자인 템플릿 (기본: `default`) |
| `is_primary` | INTEGER | 대표 명함 여부 (0\|1) |
| `is_public` | INTEGER | 공개 여부 (기본 1) |

#### card_tags 테이블

명함에 연결된 이력 태그. `tag_type`으로 구분.

| tag_type | 의미 | 표시 방식 |
|----------|------|---------|
| `career` | 경력 (회사·직책·기간 자유 텍스트) | 목록 |
| `education` | 학력 (학교·전공·졸업연도 자유 텍스트) | 목록 |
| `skill` | 기술 스택 / 스킬 | 칩(Chip) |
| `keyword` | 키워드 / 관심사 | 칩(Chip) |

#### card_sns_links 테이블

| 컬럼 | 설명 |
|------|------|
| `platform` | `linkedin` \| `github` \| `instagram` \| `twitter` \| `facebook` \| `youtube` \| `blog` 등 |
| `url` | 프로필 URL |
| `sort_order` | 표시 순서 |

### 4.4 명함 사진(아바타) 업로드 정책

- **저장소**: Cloudflare R2 (`the-meti-storage`)
- **키 패턴**: `cards/{userId}_{cardId}_{timestamp}.{ext}`
- **허용 형식**: JPG, PNG, WEBP, GIF
- **최대 크기**: 5MB
- **업로드 시점**: 명함 생성 후 별도 API 호출 (`POST /cards/:id/avatar`)
  - 명함 생성 시점에는 `avatar_url = null`
  - 편집 모드에서 사진 변경 시 즉시 업로드 가능

### 4.5 이력/SNS 저장 방식 (Full-replace)

- 명함 수정 시 `tags`/`sns_links` 배열을 전송하면 기존 데이터 **전체 삭제 후 재삽입**
- 빈 배열(`[]`) 전송 → 전체 삭제
- 필드 미포함 → 기존 유지 (변경 없음)
- Partial update(일부 항목만 수정/삭제) API 없음 → 앱에서 전체 배열을 관리

---

## 5. 사용자 프로필

### 5.1 프로필 구성

| 항목 | 변경 방법 |
|------|---------|
| 이름 | `PATCH /auth/me` |
| 프로필 사진 | `POST /auth/me/avatar` (R2 업로드) |
| 비밀번호 | `PUT /auth/password` |
| 이메일 | 변경 불가 (가입 시 확정) |

### 5.2 프로필 사진 업로드 정책

- **저장소**: Cloudflare R2
- **키 패턴**: `avatars/{userId}_{timestamp}.{ext}`
- **허용 형식**: JPG, PNG, WEBP, GIF
- **최대 크기**: 5MB
- `users.avatar_url` 컬럼에 R2 public URL 저장

---

## 6. 포인트 시스템

### 6.1 개인 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 명함 추가 구매 | 5,000원/개 (웹 결제, 포인트 아님) |
| 행사 참가비 (`entry_fee`) | 행사 설정값 |
| 개인 → 그룹 이전 | 이전 금액만큼 |

### 6.2 그룹 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 레슨 개설 | 500 P |
| 행사 개설 (정원 ≤30) | 1,000 P |
| 행사 개설 (정원 31~100) | 3,000 P |
| 행사 개설 (정원 >100 또는 무제한) | 5,000 P |

### 6.3 포인트 만료 정책

| 포인트 종류 | 만료 기준 |
|-----------|---------|
| 구독 지급 포인트 (월 지급) | 다음 구독 갱신일에 만료 |
| 포인트 충전 (웹 결제) | 충전 시점 기준 90일 후 만료 |
| 행사 참가비 환불 포인트 | 환불 시점 기준 90일 후 만료 |
| 이벤트·보상 포인트 | 적립 시점 기준 90일 후 만료 |

> **DB 구현**: `point_wallets` 테이블 `expires_at` 컬럼, `point_type` (`subscription`|`charged`|`reward`) 구분

### 6.4 포인트 흐름
```
구독 결제 → 개인 포인트 월 지급 (만료: 다음 갱신일)
포인트 충전 결제 → 개인 포인트 적립 (만료: +90일)
개인 포인트 → 그룹 포인트 이전 (POST /api/v1/points/transfer)
그룹 포인트 → 레슨/행사 개설 비용 차감
참가자 개인 포인트 → 행사 참가비 차감 → 그룹 포인트로 적립
```

### 6.5 포인트 직접 충전 상품

| 상품 | 금액 | 지급 포인트 |
|------|------|-----------|
| 포인트 10,000P | 10,000원 | 10,000 P |
| 포인트 100,000P | 100,000원 | 100,000 P |
| 포인트 500,000P | 500,000원 | 500,000 P |
| 직접 입력 | 최소 10,000원 | 입력금액 P |

---

## 7. 그룹 (Groups)

### 7.1 그룹 내 역할 (group_members.role)

| 역할 | 권한 |
|------|------|
| `admin` | 그룹 최고 관리자. 역할 변경, 행사·레슨 생성 |
| `sub_admin` | 부관리자. 행사·레슨 생성 가능 |
| `instructor` | 강사. 담당 레슨 생성 가능 |
| `member` | 일반 멤버 |

> **강사 지정**: 그룹 `admin`이 `PATCH /api/v1/groups/:id/members/:memberId/role`로 `instructor` 역할 부여  
> **자가 생성**: 강사가 직접 그룹을 생성하면 자동으로 `admin` → 별도 지정 없이 레슨 생성 가능

### 7.2 그룹 개설 정책

| 항목 | 내용 |
|------|------|
| 신청 자격 | **플랜 무관 누구나 가능** (free 포함) |
| 신청 즉시 상태 | `status: pending` |
| 활성화 조건 | 플랫폼 어드민 승인 후 `status: active` |
| 심사 자료 | `purpose` 필드 (용도 설명, 5자 이상 필수) |
| `category` 필드 | **v1.6 제거** — `purpose` 자유 텍스트로 대체 |

### 7.3 그룹 상태 흐름

```
개설 신청 (POST /groups)
    ↓ status: pending
어드민 심사
    ↓ 승인 → status: active
    ↓ 거절 → status: rejected (또는 삭제)
운영 중
    ↓ 문제 발생 → status: suspended
```

### 7.4 그룹 가입 상태

| my_status | 의미 |
|-----------|------|
| `active` | 정식 가입 완료 |
| `pending` | 가입 신청 완료, 관리자 승인 대기 |
| `group_pending` | 내가 개설 신청한 그룹, 플랫폼 어드민 승인 대기 |

### 7.5 그룹 API

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/groups | Public | 공개 그룹 탐색 (active만, my_status 없음) |
| POST | /api/v1/groups | 🔐 Auth | 그룹 개설 신청 (누구나, purpose 필수) |
| **GET** | **/api/v1/groups/mine** | 🔐 Auth | **내 그룹 + 신청내역 통합 조회 ← v1.6 신규** |
| GET | /api/v1/groups/:id | Public | 그룹 상세 |
| POST | /api/v1/groups/:id/join | 🔐 Auth | 가입 신청 (pending 상태) |
| DELETE | /api/v1/groups/:id/leave | 🔐 Auth | 탈퇴 (active) 또는 **신청취소 (pending → row 삭제)** ← v1.6 변경 |
| GET | /api/v1/groups/:id/members | 🔐 admin/sub_admin | 멤버 목록 |
| PATCH | /api/v1/groups/:id/members/:userId | 🔐 admin/sub_admin | 승인/거절/강퇴 |
| PATCH | /api/v1/groups/:id/members/:memberId/role | 🔐 admin | 역할 변경 |
| GET | /api/v1/groups/:id/notices | Public | 공지 목록 |
| POST | /api/v1/groups/:id/notices | 🔐 admin/sub_admin | 공지 작성 |
| POST | /api/v1/groups/:id/invite-links | 🔐 admin/sub_admin | 초대 링크 생성 |
| GET | /api/v1/groups/:id/invite-links | 🔐 admin/sub_admin | 초대 링크 목록 |
| GET | /api/v1/groups/invite/:token | Public | 초대 링크 정보 조회 |

### 7.6 그룹 미성년자 정책

- 그룹 가입 시 생년월일 선택 입력 → 만 19세 미만이면 `is_minor = 1`
- 어드민이 그룹 승인 시 `has_minor` 여부 체크 (0=성인만 / 1=미성년자 포함 / null=미확인)
- 앱에서 `has_minor = 1` 그룹은 UI 안내 표시 권장

---

## 8. 레슨 (Lessons)

### 8.1 DB 스키마 (lessons 테이블)
```sql
id, group_id, instructor_id (FK→users), title, description,
schedule_type (one-time|repeat), scheduled_at, duration_minutes,
capacity, location, point_cost (개설 비용), status, created_at
```

### 8.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/lessons/groups/:groupId/lessons | 그룹 멤버 | 레슨 목록 |
| POST | /api/v1/lessons/groups/:groupId/lessons | admin/sub_admin/instructor | 레슨 생성 (500P 차감) |
| GET | /api/v1/lessons/:id | 그룹 멤버 | 레슨 상세 |
| PUT | /api/v1/lessons/:id | admin/sub_admin/강사 본인 | 레슨 수정 |
| DELETE | /api/v1/lessons/:id | admin/sub_admin | 레슨 취소 |
| POST | /api/v1/lessons/:id/register | 그룹 멤버 | 수강 신청 |
| DELETE | /api/v1/lessons/:id/register | 신청자 본인 | 수강 취소 |

---

## 9. 행사 (Events)

### 9.1 DB 스키마 (events 테이블)
```sql
id, group_id, created_by (FK→users), title, description, location,
starts_at, ends_at, capacity, visibility (public|group_only),
registration_type (free|pre_required), entry_method (qr|nfc_qr|manual),
point_cost (개설 비용), entry_fee (참가비·포인트), status, created_at
```

### 9.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/events/groups/:groupId/events | 그룹 멤버 | 행사 목록 |
| POST | /api/v1/events/groups/:groupId/events | admin/sub_admin | 행사 생성 (포인트 차감) |
| GET | /api/v1/events/:id | 조건부 | 행사 상세 |
| PUT | /api/v1/events/:id | admin/sub_admin | 행사 수정 |
| DELETE | /api/v1/events/:id | admin/sub_admin | 행사 취소 |
| POST | /api/v1/events/:id/join | 그룹 멤버 | 행사 참가 신청 |
| DELETE | /api/v1/events/:id/join | 신청자 본인 | 행사 취소 (참가비 환불) |
| GET | /api/v1/events/:id/participants | admin/sub_admin | 참가자 목록 |

---

## 10. 상품·주문·결제

### 10.1 결제 PG (확정)

| 대상 | PG사 | 통화 |
|------|------|------|
| 국내 결제 | Toss Payments | KRW |
| 해외 결제 | Stripe | USD / 기타 |
| Apple 구독 | Apple IAP | 각국 통화 |
| Google 구독 | Google Play Billing | 각국 통화 |

### 10.2 결제 방식 정책

| 항목 | 방식 | 비고 |
|------|------|------|
| 구독 (pro/business) | Apple IAP + Google Play Billing | 인앱결제만 |
| 레슨·행사 상품 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 포인트 직접 충전 | 웹 결제 (Toss/Stripe) | WebView 유도 |
| 명함 추가 구매 | 웹 결제 (Toss/Stripe) | WebView 유도 |

> 앱 내에서 "웹에서 결제" 문구 직접 노출 금지 (Apple/Google 정책).

### 10.3 웹 결제 토큰 흐름 (일회성 토큰 URL 방식)

```
1. 앱에서 상품 선택
   ↓
2. POST /api/v1/payments/payment-token  { "order_id": 42 }
   → { "token": "otp_abc123", "expires_in": 300 }  (5분 유효, 1회용)
   ↓
3. 앱 내 WebView로 결제 페이지 열기
   URL: https://the-meti.pages.dev/payment?token=otp_abc123
   ↓
4. 서버 토큰 검증 → 사용자 인증 → PG 결제창 표시
   ↓
5. PG 결제 완료 → POST /api/v1/payments/verify-web
   ↓
6. 결제 완료 → 주문 상태 paid → WebView 닫기 콜백
```

### 10.4 구독 검증 방식

**확정: 앱 재검증(Client-side) 방식** (웹훅은 Phase 2)

```
앱 실행 시 or 구독 상태 확인 필요 시:
  → Apple/Google로부터 영수증/토큰 수신
  → POST /api/v1/payments/subscription/verify-apple (또는 verify-google)
  → 서버에서 Apple/Google API로 유효성 확인
  → 플랜 업그레이드 or 유지
```

---

## 11. NFC 실물카드 (Physical NFC Card)

> v1.5에서 DB 스키마만 존재했으나 v1.6에서 배송·디자인 정책 추가 (migration 0019)

### 11.1 NFC 실물카드 정책

- 사용자가 디지털 명함과 연결된 NFC 실물카드를 신청
- 관리자가 심사·발급 후 실물 배송
- 실물카드 NFC 태깅 → 앱 딥링크 또는 웹 공개 명함 페이지 연결

### 11.2 nfc_physical_cards 테이블 주요 컬럼 (migration 0019 반영)

| 컬럼 | 설명 |
|------|------|
| `user_id` | 신청자 |
| `card_id` | 연결된 디지털 명함 |
| `nfc_uid` | NFC 태그 UID |
| `serial_no` | 카드 일련번호 |
| `design_type` | `basic` \| `premium` \| `custom` |
| `status` | `pending` → `approved` → `issued` \| `lost` \| `deactivated` |
| `shipping_name` | 수령인 이름 |
| `shipping_phone` | 수령인 연락처 |
| `shipping_zipcode` | 우편번호 |
| `shipping_address` | 기본 주소 |
| `shipping_detail` | 상세 주소 |
| `shipping_memo` | 배송 메모 |
| `tracking_no` | 운송장 번호 |
| `carrier` | 택배사 (`cjlogistics` \| `hanjin` \| `lotte` \| `epost` 등) |
| `amount` | 결제금액(원) |
| `payment_status` | `unpaid` \| `paid` \| `refunded` |
| `shipped_at` | 발송 일시 |

---

## 12. 딥링크

| URL 패턴 | 동작 |
|----------|------|
| `/card/:id` | 명함 공개 페이지 (앱 미설치자도 웹으로 조회, 이력·SNS·사진 표시) |
| `/invite/:token` | 그룹 초대링크 (로그인 후 그룹 가입 확인 모달) |
| `/payment?token=xxx` | 웹 결제 페이지 (일회성 토큰 인증) |

> Flutter 앱: `Uri.base` 파싱으로 앱 시작 시 딥링크 감지  
> 미로그인 시: SharedPreferences에 토큰 임시 저장 → 로그인 완료 후 처리

---

## 13. 구현 현황

| 영역 | 상태 |
|------|------|
| 인증 (JWT, Rotation, 비밀번호 재설정) | ✅ 완료 |
| **프로필 사진 업로드 (`POST /auth/me/avatar`)** | ✅ **완료 (v1.6 신규)** |
| **프로필 이름 수정 (`PATCH /auth/me`)** | ✅ **완료 (v1.6 신규)** |
| 명함 CRUD | ✅ 완료 |
| **명함 아바타 업로드 (`POST /cards/:id/avatar`)** | ✅ **완료 (v1.6 신규)** |
| **명함 이력 태그 (tags[], career·education·skill)** | ✅ **완료 (v1.6 신규)** |
| **명함 SNS 링크 (sns_links[])** | ✅ **완료 (v1.6 신규)** |
| **명함 공개 페이지 — 이력·SNS·사진 표시** | ✅ **완료 (v1.6 신규)** |
| QR 토큰 (명함 공유, 행사 입장) | ✅ 완료 |
| 명함첩 (저장·목록) | ✅ 완료 |
| 그룹 (생성·승인·멤버·역할·공지·초대링크) | ✅ 완료 |
| **`GET /groups/mine` (내 그룹 + 신청내역)** | ✅ **완료 (v1.6 신규)** |
| **`DELETE /groups/:id/leave` pending 취소** | ✅ **완료 (v1.6 신규)** |
| 포인트 (잔액·내역·이전·그룹) | ✅ 완료 |
| 레슨 CRUD + 수강 신청 | ✅ 완료 |
| 행사 CRUD + 참가 신청·체크인·환불 | ✅ 완료 |
| 상품·주문·결제 API (PG Placeholder) | ✅ 완료 |
| 파트너 API (매핑·리워드·잔액) | ✅ 완료 |
| 채팅 API (1:1, 메시지, 신고·차단) | ✅ 완료 |
| 어드민 웹 (대시보드·유저·그룹·명함·행사·레슨·포인트) | ✅ 완료 |
| NFC 실물카드 DB 스키마 (배송·디자인 컬럼) | ✅ 완료 (migration 0019) |
| 웹 결제 페이지 (`/payment`) | ⏳ PG 키 수령 후 구현 |
| Toss / Stripe 서버사이드 검증 | ⏳ PG 키 수령 후 구현 |
| Apple IAP / Google Play 서버 검증 | ⏳ 앱 연동 후 구현 |
| NFC 실물카드 신청·발급 API | ⏳ 미구현 |
| 딥링크 처리 (Flutter 앱 내) | ⏳ 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 (FCM / APNs) | ⏳ 미결정 |
| 채팅 실시간 (WebSocket/SSE) | ⏳ Phase 2 |
| 구독 웹훅 | ⏳ Phase 2 |

---

## 14. DB 마이그레이션 목록

| 번호 | 내용 | 상태 |
|------|------|------|
| 0001~0009 | 기본 스키마 (users, cards, groups, events, chat, rewards, plans, user_role) | ✅ 적용 |
| 0010~0012 | 미성년자/보호자, 초대링크, 그룹 단순화 (`category` → `purpose`, `has_minor` 추가) | ✅ 적용 |
| 0013 | 포인트 시스템 (`point_wallets`, `point_transactions`), 플랜 멤버수 제한 | ✅ 적용 |
| 0014 | lessons, events(재설계), products, orders, payments, lesson_registrations, event_participants | ✅ 적용 |
| 0015 | `events.entry_fee` 컬럼 추가 | ✅ 적용 |
| 0016 | `point_wallets.expires_at`, `point_type` 컬럼 추가 (포인트 만료 정책) | ✅ 적용 |
| 0017 | `plan_configs`: `extra_card_price`, `free_card_limit` 컬럼 추가 / `point_charge_products` 테이블 추가 | ✅ 적용 |
| 0018 | headhunter account_type 제거 — users 전체 personal 단일화 | ✅ 적용 |
| **0019** | **`nfc_physical_cards` 배송·디자인 컬럼 추가** (`design_type`, `shipping_*`, `tracking_no`, `carrier`, `amount`, `payment_status`) | ✅ **적용 (v1.6 신규)** |

---

## 15. 미결 정책 항목 (네이티브 앱 개발 전 확정 필요)

| 항목 | 현재 상태 | 확정 필요 내용 |
|------|---------|-------------|
| 플랜별 명함 한도 | 서버: free 3개·pro 10개·business 무제한 | 기획 원안(1개·3개·10개)과 다름 → 최종 정책 확정 후 서버 수정 |
| NFC 실물카드 신청 API | DB 스키마만 존재 | 신청·발급·배송조회 API 설계 필요 |
| NFC 실물카드 가격 | 미정 | 디자인 타입별(basic/premium/custom) 가격 정책 필요 |
| 푸시 알림 | 미결정 | FCM/APNs 연동 여부 및 알림 항목 확정 필요 |
| 채팅 실시간 | Phase 2 | WebSocket 또는 SSE 방식 확정 필요 |

---

*본 문서는 METI 백엔드 실제 구현 코드(https://github.com/smee96/THE-METI) 기반으로 작성되었습니다.*  
*v1.6 작성일: 2026-05-18*  
*기준 커밋: `7aa6cc2` + `4ef9a32`*
