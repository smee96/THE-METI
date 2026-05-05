# METI 네이티브앱 개발 에이전트 프롬프트 v2.5

> **최종 업데이트**: 2026-05-05  
> **이전 버전**: v2.4 (2026-05-05)  
> **변경 사항 요약**:  
> - **플랜 정책 전면 개편**: 기능 제한 방식 → 그룹 최대 멤버 수 제한 방식으로 변경  
> - Free / Pro / Business 모두 그룹 생성·운영·관리 기능 **동일하게 제공**  
> - 차이점은 오직 **그룹당 최대 멤버 수** (Free: 2명, Pro: 10명, Business: 무제한)  
> - 멤버 한도 초과 시 업그레이드 유도 UX 가이드 추가  
> - 슈퍼어드민에서 플랜별 멤버 한도 실시간 조정 가능

---

## 1. 서비스 개요

**METI**는 디지털 명함 기반 소셜 네트워크 플랫폼입니다.

- 개인/헤드헌터용 디지털 명함 생성 및 공유
- QR / NFC 기반 명함 교환
- 그룹(협회·클럽·레슨 등) 생성 및 운영
- 행사 참가 관리 / 채팅 / 포인트

**베이스 URL**: `https://the-meti.pages.dev`  
**API 버전**: `/api/v1/`

---

## 2. 채널 및 역할 구조

### 2-1. 접속 채널

| 채널 | URL | 대상 | 상태 |
|------|-----|------|------|
| 네이티브 앱 (iOS/Android) | 앱스토어/구글플레이 | 일반 사용자 | **개발 중** |
| 사용자·그룹관리 웹 | `/app/*` | 일반 사용자 + 그룹 관리자 | 운영 중 |
| 슈퍼어드민 웹 | `/admin/*` | METI 운영팀 | 운영 중 |
| 명함 공개 페이지 | `/card/:id` | 미설치 사용자 | 운영 중 |

### 2-2. 역할 정의

| 역할 | 설명 | 구분 방식 |
|------|------|---------|
| `user` | 일반 회원 | 기본값 |
| `group_admin` | 그룹 관리자 | `group_members.role = 'admin'` 또는 `'sub_admin'` |
| `super_admin` | METI 운영팀 | `users.role = 'super_admin'` |

> `group_admin`은 별도 계정이 아님.  
> 일반 `user`가 특정 그룹의 admin 멤버이면 해당 그룹의 **그룹 관리 화면**으로 전환 가능.  
> 한 사람이 여러 그룹을 관리할 수 있으며, 그룹별 독립 컨텍스트 전환.

### 2-3. 로그인 후 역할별 화면 분기

```
POST /api/v1/auth/login 성공
         ↓
  user.role 확인
         ├── 'super_admin' → 웹: /admin/dashboard
         └── 그 외         → 웹: /app/dashboard
                                  앱: 메인 탭 (홈)
```

---

## 3. 플랜 정책 ★ v2.5 전면 개편

### 3-1. 플랜 정의

> **핵심 원칙**: **기능은 모든 플랜 동일**, 차이는 **그룹당 최대 멤버 수**만으로 구분

| 플랜 | 구독료 | 구독 지급 포인트 | 명함 한도 | 그룹 생성 | 그룹 관리 | **그룹 최대 멤버 수** |
|------|-------|--------------|---------|:---:|:---:|:---:|
| `free` | 0원 | 0 P | 3개 | ✅ | ✅ | **2명** |
| `pro` | 미정 | 10,000 P/월 | 10개 | ✅ | ✅ | **10명** |
| `business` | 미정 | 500,000 P/월 | 무제한 | ✅ | ✅ | **무제한** |

> - 그룹 생성·멤버 관리·공지사항·초대링크·행사 개설·레슨 관리 모두 **플랜 상관없이 동일하게 제공**  
> - 구독료·포인트·명함 한도·**그룹 최대 멤버 수**는 슈퍼어드민에서 변경 가능 (`plan_configs`)  
> - `max_group_members = NULL` → 무제한 (business 기본값)

### 3-2. 플랜 차등화 전략 (업그레이드 유도)

```
Free 사용자 → 그룹 생성 → 2명 초대 → 3번째 초대 시도
                                         ↓
                     API 응답: plan_member_limit_reached (limit: 2)
                                         ↓
               앱 메시지: "멤버 한도(2명)에 도달했습니다.
                          Pro로 업그레이드하면 최대 10명까지 초대할 수 있어요!"
                                         ↓
                          [Pro 구독하기] → 인앱결제
```

**장점**: 그룹 생성부터 운영까지 먼저 경험 → 멤버 증가 욕구가 생길 때 자연스러운 업그레이드 유도

### 3-3. 멤버 한도 초과 API 응답

```json
{
  "success": false,
  "error": "플랜 멤버 한도에 도달했습니다. 플랜을 업그레이드해주세요.",
  "error_code": "plan_member_limit_reached",
  "current": 2,
  "limit": 2,
  "upgrade_required": true
}
```

**앱 처리 가이드**:
- `error_code === 'plan_member_limit_reached'` 수신 시
- 현재 한도와 다음 플랜 혜택을 명시한 업그레이드 안내 모달 표시
- [구독하기] 버튼 → 인앱결제 플로우 진입

### 3-4. 플랜별 명함 한도 초과 처리 (기존 유지)

```json
{ "success": false, "error_code": "card_limit_exceeded", "upgrade_required": true }
```
→ `upgrade_required: true` 수신 시 업그레이드 유도 다이얼로그 표시

---

## 4. 포인트 시스템

### 4-1. 기본 원칙

- **1P = 1원** (고정)
- **개인 지갑**과 **그룹 지갑** 별도 운영
- 개인 포인트 → 그룹 포인트 이전 가능 (그룹 관리자만)
- 그룹 포인트 → 개인 포인트 역이전 불가
- 포인트는 현금으로 직접 전환 불가 (서비스 이용 수단)

### 4-2. 포인트 충전 방식 — **인앱결제 정책 중요**

#### A. 구독 자동 지급 (인앱결제 — 앱 전용)
- 플랜 구독 시 매월 구독 포인트 자동 지급
- 처리: 앱스토어/구글플레이 결제 → 영수증 서버 검증 → 포인트 지급

#### B. 단건 포인트 충전 (웹 전용 — 앱에서 절대 불가)
- 사용자 웹(`/app/points`)에서만 PG 결제로 충전
- **앱에서는 아래 항목 모두 금지** (Apple/Google 정책):

| 항목 | 앱 내 허용 여부 |
|------|--------------|
| "포인트 충전하기" 버튼 | ❌ **절대 금지** |
| "웹에서 충전하세요" 문구 | ❌ **절대 금지** |
| 외부 결제 URL 연결/표시 | ❌ **절대 금지** |
| 포인트 잔액 표시 | ✅ 허용 |
| "포인트가 부족합니다" 오류 메시지 | ✅ 허용 |
| "멤버 한도에 도달했습니다" 오류 메시지 | ✅ 허용 |
| 인앱결제 구독 상품 구매 버튼 | ✅ 허용 |

> ⚠️ **Netflix 방식 적용**: 앱 내 단건 충전 진입점 완전 제거.  
> 포인트 부족 시 오류 메시지만 노출하고, 충전 방법 안내 금지.

### 4-3. 포인트 사용처 및 기본 단가

| 사용처 | 차감 지갑 | 기본 단가 |
|-------|---------|---------|
| 명함 추가 생성 (한도 초과 1개당) | 개인 | 1,000 P |
| 그룹 생성 | 개인 | 0 P (무료) |
| 행사 개설 | 그룹 | 3,000 P |
| NFC 실물카드 발급 (기본형) | 개인 | 15,000 P |
| NFC 실물카드 발급 (프리미엄) | 개인 | 30,000 P |
| 파트너 서비스 이용 | 개인/그룹 | 파트너별 설정 |

> 단가는 슈퍼어드민에서 변경 가능 (`point_prices` 테이블)

### 4-4. 포인트 부족 처리 흐름 (앱)

```
유료 기능 요청
     ↓
서버: 포인트 잔액 확인
     ├── 충분 → 차감 후 기능 실행
     └── 부족 → 응답:
         {
           "success": false,
           "error": "포인트가 부족합니다.",
           "error_code": "insufficient_points",
           "required": 3000,
           "current": 500,
           "short": 2500
         }
         ↓
앱: "포인트가 부족합니다. (현재 500P / 필요 3,000P)" 메시지 표시
    (충전 유도 버튼/링크 표시 금지)
```

### 4-5. 구독 포인트 유효기간 (권장)

| 포인트 종류 | 유효기간 | 비고 |
|-----------|--------|------|
| 구독 지급 포인트 | 90일 | 갱신 시 리셋 권장 |
| 단건 충전 포인트 | 365일 | 충전 시점부터 |
| 관리자 지급 포인트 | 관리자 설정 | 프로모션용 |

---

## 5. 인증 API

### 5-1. 회원가입
```
POST /api/v1/auth/register
```
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "account_type": "personal"
}
```
> ⚠️ 회원가입 시 생년월일 수집 안 함

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "verify_token": "uuid..."
  }
}
```

### 5-2. 이메일 인증
```
POST /api/v1/auth/verify-email
{ "token": "uuid..." }
```

### 5-3. 로그인
```
POST /api/v1/auth/login
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

### 5-4. 토큰 갱신
```
POST /api/v1/auth/refresh
{ "refresh_token": "uuid..." }
```

### 5-5. 로그아웃
```
POST /api/v1/auth/logout
Authorization: Bearer {token}
{ "refresh_token": "uuid..." }
```

### 5-6. 비밀번호 찾기 / 재설정
```
POST /api/v1/auth/forgot-password   { "email": "..." }
POST /api/v1/auth/reset-password    { "token": "...", "password": "..." }
```

### 5-7. 내 정보 조회
```
GET /api/v1/auth/me
Authorization: Bearer {token}
```

### 5-8. 초대링크 미리보기 (인증 불필요)
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
      "description": "...",
      "purpose": "성인·청소년 대상 수영 레슨",
      "has_minor": 1,
      "creator_name": "김강사"
    }
  }
}
```

### 5-9. 초대링크로 그룹 즉시 가입 (로그인 필수)
```
POST /api/v1/auth/invite/:token/join
Authorization: Bearer {token}
{ "birth_date": "2010-03-15" }
```
> ✅ 즉시 `active` 상태 — 관리자 승인 불필요  
> ⚠️ 그룹 관리자 플랜의 `max_group_members` 한도 초과 시 `plan_member_limit_reached` 오류 반환

---

## 6. 명함 API

### 6-1. 내 명함 목록
```
GET /api/v1/cards?page=1&limit=20
Authorization: Bearer {token}
```

### 6-2. 명함 생성
```
POST /api/v1/cards
Authorization: Bearer {token}
```
```json
{
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
> ⚠️ `is_public` 기본값 = **0 (비공개)**  
> 플랜 한도 초과 시: `{ "error_code": "card_limit_exceeded", "upgrade_required": true }` → 포인트 1,000P 차감 또는 업그레이드 유도

### 6-3. 명함 공개 페이지 (인증 불필요)
```
GET /api/v1/cards/public/:cardId
```

### 6-4. 명함 저장 (상대방 명함)
```
POST /api/v1/cards/:id/save
Authorization: Bearer {token}
```
> ⚠️ 채팅 시작 전 상대방 명함 저장 필수

---

## 7. 그룹 API

### 7-1. 공개 그룹 목록
```
GET /api/v1/groups?page=1&limit=20&q=검색어
```

### 7-2. 그룹 생성 신청
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
> - `purpose` 5자 이상 필수 (관리자 심사용)
> - `category` 필드 없음
> - 생성 후 상태: `pending` → 관리자 승인 후 `active`
> - ✅ **모든 플랜에서 그룹 생성 가능** (Free 포함)

### 7-3. 그룹 상세
```
GET /api/v1/groups/:id
```

### 7-4. 그룹 가입 신청 (일반 — 관리자 승인 필요)
```
POST /api/v1/groups/:id/join
Authorization: Bearer {token}
{ "birth_date": "2010-03-15" }
```
> ⚠️ 그룹 관리자 플랜의 `max_group_members` 한도 초과 시 `plan_member_limit_reached` 오류 반환

### 7-5. 그룹 탈퇴
```
DELETE /api/v1/groups/:id/leave
Authorization: Bearer {token}
```

### 7-6. 멤버 목록 (관리자)
```
GET /api/v1/groups/:id/members?status=pending&page=1
Authorization: Bearer {token}
```

### 7-7. 멤버 승인/거절/강퇴 (관리자)
```
PATCH /api/v1/groups/:id/members/:userId
Authorization: Bearer {token}
{ "action": "approve" }
```
> `action`: `approve` | `reject` | `kick`  
> ⚠️ `approve` 시 `max_group_members` 한도 초과 체크 → `plan_member_limit_reached` 가능

### 7-8. 공지사항
```
GET  /api/v1/groups/:id/notices?page=1
POST /api/v1/groups/:id/notices   (관리자)
```

### 7-9. 초대링크 관리 (그룹 관리자)
```
POST  /api/v1/groups/:id/invite-links
GET   /api/v1/groups/:id/invite-links
PATCH /api/v1/groups/:id/invite-links/:linkId/deactivate
```
**POST body:**
```json
{
  "label": "2026 봄 수영반",
  "max_uses": 30,
  "expires_days": 30
}
```

---

## 8. 포인트 API (Phase 1 — 백엔드 구현 예정)

> 아래 API는 현재 설계 확정 단계이며, Phase 1 완료 후 사용 가능합니다.  
> 앱 개발 시 **준비만 해두고, API 연동은 서버 완성 후 진행**하세요.

### 8-1. 개인 포인트 지갑
```
GET /api/v1/points/me
Authorization: Bearer {token}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 8500,
    "total_charged": 10000,
    "total_used": 1500,
    "recent_transactions": [...]
  }
}
```

### 8-2. 포인트 이력
```
GET /api/v1/points/me/transactions?page=1&limit=20
Authorization: Bearer {token}
```

### 8-3. 그룹 포인트 지갑 (그룹 관리자)
```
GET /api/v1/points/groups/:id
Authorization: Bearer {token}
```

### 8-4. 개인 → 그룹 포인트 이전 (그룹 관리자)
```
POST /api/v1/points/transfer
Authorization: Bearer {token}
{ "group_id": 5, "amount": 5000 }
```

---

## 9. 결제 API (Phase 2 — 결제 연동 후 사용)

### 9-1. 구독 영수증 검증 (인앱결제)
```
POST /api/v1/payments/subscription/verify-apple
POST /api/v1/payments/subscription/verify-google
Authorization: Bearer {token}
```
**Request:**
```json
{
  "receipt_data": "...",
  "plan": "pro"
}
```

**구독 처리 흐름:**
```
앱 → 스토어 결제 완료
     ↓
앱 → 영수증 수신
     ↓
POST /payments/subscription/verify-apple
     ↓
서버 → 애플/구글 서버 검증
     ↓
검증 성공
     → subscriptions 테이블 갱신
     → users.plan 업데이트 (free → pro 등)
     → 구독 포인트 자동 지급 (type: charge_subscription)
     → max_group_members 한도 자동 상향 (plans 기준)
     ↓
앱 → "Pro 플랜으로 업그레이드되었습니다! 이제 최대 10명까지 관리할 수 있어요." 화면
```

### 9-2. 결제 이력 조회
```
GET /api/v1/payments/orders
Authorization: Bearer {token}
```

---

## 10. 행사 API

```
GET  /api/v1/events?page=1&group_id=1
POST /api/v1/events/:id/register        (참가 신청)
POST /api/v1/events/:id/check-in        (QR/NFC 입장)
```
> ✅ **모든 플랜에서 행사 생성 가능**  
> 행사 생성 시 그룹 포인트 3,000P 차감 (Phase 1 완료 후 적용)

---

## 11. 채팅 API

```
GET  /api/v1/chat/rooms
POST /api/v1/chat/rooms                 { "target_user_id": 2 }
GET  /api/v1/chat/rooms/:id/messages
POST /api/v1/chat/rooms/:id/messages
```
> ⚠️ 채팅 시작 전 `POST /cards/:id/save` 필수

---

## 12. 레슨 API

```
GET  /api/v1/lessons/groups/:groupId/schedules
POST /api/v1/lessons/groups/:groupId/schedules   (관리자)
POST /api/v1/lessons/schedules/:id/attendance    (출석 처리)
```
> ✅ **모든 플랜에서 레슨 관리 가능**

---

## 13. 관리자 API (슈퍼어드민 전용)

```
GET   /api/v1/admin/dashboard
GET   /api/v1/admin/users?q=&plan=&page=
PATCH /api/v1/admin/users/:id             { "is_active": 0, "plan": "pro" }
GET   /api/v1/admin/groups?status=pending
PATCH /api/v1/admin/groups/:id            { "action": "approve", "has_minor": 1 }
POST  /api/v1/admin/groups                (직접 생성)

-- 플랜 설정 ✅ 구현 완료
GET   /api/v1/admin/plan-configs
PATCH /api/v1/admin/plan-configs/:plan    { "max_group_members": 10 }  ← 한도 조정

-- 포인트/결제 설정 (Phase 1 완료 후)
GET   /api/v1/admin/point-prices
PATCH /api/v1/admin/point-prices/:feature
POST  /api/v1/admin/points/grant          (직접 지급)
```

---

## 14. 앱 개발 주요 가이드

### 14-1. 초대링크 딥링크 처리
```
링크 클릭 (https://the-meti.pages.dev/invite/:token 또는 앱 딥링크)
     ↓
GET /api/v1/auth/invite/:token    (그룹 정보 미리보기, 인증 불필요)
     ↓
로그인 여부 확인
     ├── 미로그인 → 로그인/회원가입 화면 → 완료 후 join
     └── 로그인됨 → 바로 join 호출
     ↓
POST /api/v1/auth/invite/:token/join
     { "birth_date": "YYYY-MM-DD" }
     ↓
성공 → 즉시 active 상태로 그룹 가입 완료
실패(plan_member_limit_reached) → 멤버 한도 안내 표시
```

### 14-2. 일반 그룹 가입 흐름
```
그룹 상세 → 가입 신청
     ↓
POST /api/v1/groups/:id/join
     { "birth_date": "YYYY-MM-DD" }
     ↓
성공: status: pending → 승인 대기 안내 표시
실패(plan_member_limit_reached): 멤버 한도 초과 안내 표시
     ↓ (관리자 승인 후)
status: active → 그룹 화면 접근 가능
```

### 14-3. 그룹 관리자 컨텍스트 전환 UX

> 한 사용자가 여러 그룹을 관리할 수 있습니다. 그룹별로 독립된 컨텍스트로 전환합니다.

**헤더 드롭다운 (웹·앱 공통 UX):**
```
[홍길동 ▼]  ← 탭/클릭
  ├── 👤 개인 계정          → 개인 대시보드
  ├── ─────────────────
  ├── 🏊 한강수영클럽 (관리자) → 그룹 관리 화면
  ├── 🎾 테니스동호회 (관리자) → 그룹 관리 화면
  └── ─────────────────
      📋 전체 그룹 목록 보기  → 내 그룹 목록 화면
```

**앱 흐름:**
```
로그인 후 메인 화면
     ↓
GET /api/v1/groups?my=true (내가 속한 전체 그룹 조회)
     ↓
admin 그룹 존재 시 → 헤더/탭에 [그룹 관리] 전환 UI 표시

[그룹 관리] 탭 진입
     ↓
관리 중인 그룹 목록 표시 (그룹명 + 역할 배지 + 현재 멤버수/한도)
     ↓
그룹 선택 → 해당 그룹 관리 화면 진입
     - 멤버 관리 탭 (멤버수 표시: 현재 N명 / 최대 M명)
     - 행사 관리 탭
     - 그룹 포인트 탭
     - 레슨 관리 탭
     - 초대링크 탭

[전체 그룹 목록] 탭
     ↓
내가 속한 모든 그룹 표시 (일반 멤버 포함)
     ├── 역할 배지: 관리자 / 일반
     └── 관리자인 그룹만 [관리하기] 버튼 표시
```

### 14-4. 멤버 한도 초과 UX 가이드 ★ v2.5 추가

**상황**: 그룹 관리자(Free 플랜)가 3번째 멤버를 초대/승인 시도

**API 응답**:
```json
{
  "error_code": "plan_member_limit_reached",
  "current": 2,
  "limit": 2,
  "upgrade_required": true
}
```

**앱 UI 처리**:
```
모달 또는 바텀시트 표시:

  ┌─────────────────────────────────────┐
  │  📋 멤버 한도에 도달했습니다           │
  │                                     │
  │  현재 Free 플랜은 그룹당 최대          │
  │  2명까지 관리할 수 있습니다.           │
  │                                     │
  │  Pro로 업그레이드하면                 │
  │  최대 10명까지 초대할 수 있어요!       │
  │                                     │
  │  [Pro 구독하기]   [나중에]            │
  └─────────────────────────────────────┘
```

**주의사항**:
- 구독 버튼은 **인앱결제**로 연결 (외부 URL 금지)
- "웹에서 구독하세요" 문구 사용 금지 (Apple/Google 정책)
- 단, 구독 화면에서 플랜별 혜택 안내 시 멤버 한도 명시 권장

### 14-5. 생년월일 입력 UI 가이드
- 레슨·스포츠 성격 그룹 가입 시 권장 문구 표시
- "레슨 관리를 위해 생년월일을 입력해주세요 (선택사항)"
- 입력하지 않아도 가입 가능 (강제 아님)
- 만 19세 미만 입력 시 `is_minor = 1` 자동 설정

### 14-6. 명함 공개 설정 UI 가이드
- 기본 비공개 → 토글로 공개 전환
- 비공개: "나만 보기 · 공유 링크로만 접근"
- 공개: "전체 공개 · 검색/피드에 노출"
- 명함 목록에서 공개 상태 아이콘(🔒 / 🌐) 표시

### 14-7. 그룹 생성 신청 UI 가이드
- 필드: 그룹 이름 / 설명 / **용도(purpose)** / 공개 여부 / 최대 인원
- purpose 안내: "그룹의 목적과 활동 내용을 간단히 설명해 주세요"
- 제출 후: 심사 중 안내 화면 표시
- ✅ **모든 플랜에서 그룹 생성 신청 가능** (Free 포함) — 제한 없음

### 14-8. 포인트 표시 가이드 (앱)
- 메인/프로필 화면: 개인 포인트 잔액 표시 (숫자 P)
- 그룹 관리 화면: 그룹 포인트 잔액 표시
- 포인트 부족 시: 오류 메시지만 표시 (충전 유도 불가)
- 구독 가입 화면: 플랜별 월 지급 포인트 + **최대 멤버 수** 명시

---

## 15. 화면별 API 호출 맵

| 화면 | 사용 API |
|------|---------|
| 회원가입 | `POST /auth/register` |
| 이메일 인증 | `POST /auth/verify-email` |
| 로그인 | `POST /auth/login` |
| 내 정보 | `GET /auth/me` |
| 내 그룹 목록 (전체) | `GET /groups?my=true` |
| 초대링크 미리보기 | `GET /auth/invite/:token` |
| 초대링크 가입 | `POST /auth/invite/:token/join` |
| 명함 목록 | `GET /cards` |
| 명함 생성 | `POST /cards` |
| 명함 공개 페이지 | `GET /cards/public/:id` |
| 명함 저장 | `POST /cards/:id/save` |
| 공개 그룹 목록 | `GET /groups` |
| 그룹 상세 | `GET /groups/:id` |
| 그룹 생성 신청 | `POST /groups` |
| 그룹 가입 신청 | `POST /groups/:id/join` |
| 그룹 탈퇴 | `DELETE /groups/:id/leave` |
| 그룹 공지 | `GET /groups/:id/notices` |
| 초대링크 생성 | `POST /groups/:id/invite-links` |
| 초대링크 목록 | `GET /groups/:id/invite-links` |
| 멤버 관리 | `GET /groups/:id/members` |
| 멤버 승인/거절/강퇴 | `PATCH /groups/:id/members/:userId` |
| 행사 목록 | `GET /events` |
| 행사 참가 | `POST /events/:id/register` |
| 채팅 목록 | `GET /chat/rooms` |
| 채팅 시작 | `POST /chat/rooms` |
| 메시지 | `GET/POST /chat/rooms/:id/messages` |
| 레슨 일정 | `GET /lessons/groups/:id/schedules` |
| 출석 처리 | `POST /lessons/schedules/:id/attendance` |
| 개인 포인트 | `GET /points/me` *(Phase 1)* |
| 포인트 이력 | `GET /points/me/transactions` *(Phase 1)* |
| 그룹 포인트 | `GET /points/groups/:id` *(Phase 1)* |
| 포인트 이전 | `POST /points/transfer` *(Phase 1)* |
| 구독 영수증 검증 | `POST /payments/subscription/verify-apple` *(Phase 2)* |
| 결제 이력 | `GET /payments/orders` *(Phase 2)* |

---

## 16. DB 스키마 핵심 변경 이력

| 마이그레이션 | 주요 내용 |
|------------|---------|
| 0011 | `group_invite_links` 테이블 추가 |
| 0012 | `groups.purpose`, `groups.has_minor`, `group_members.is_minor`, `group_members.birth_date` 추가 |
| 0013 *(예정)* | `point_wallets`, `point_transactions`, `point_prices` 신규 + `plans.max_group_members` 컬럼 추가 + 기존 `plans`/`subscriptions`/`payments` 확장 |

**plans 플랜별 max_group_members 기본값 (Migration 0013):**
```sql
free     → max_group_members = 2     (2명)
pro      → max_group_members = 10    (10명)
business → max_group_members = NULL  (무제한)
```

**group_members 주요 컬럼:**
```sql
is_minor   INTEGER  -- null(미입력), 0(성인), 1(미성년) — 그룹 단위
birth_date TEXT     -- YYYY-MM-DD, 선택 입력
```

**groups 주요 컬럼:**
```sql
purpose   TEXT     -- 그룹 용도 설명 (관리자 심사용)
has_minor INTEGER  -- null(미판단), 0(성인만), 1(미성년 포함)
```

**point_wallets 주요 컬럼 (Phase 1):**
```sql
owner_type TEXT    -- 'user' | 'group'
owner_id   INTEGER -- users.id 또는 groups.id
balance    INTEGER -- 현재 잔액 (P)
```

---

## 17. 제거된 기능

| 제거 항목 | 이유 |
|----------|------|
| Lite 계정 (초대 전용) | 일반 유저가 초대링크로 직접 가입 |
| `user_type` (ADULT/MINOR) | `group_members.is_minor`로 대체 |
| `user_guardians` 테이블 | 보호자 연결 기능 전면 제거 |
| `guardian_invitations` 테이블 | 제거 |
| `minorAccessMiddleware` | 기능 제한 없음으로 제거 |
| 그룹 `category` 필드 | `purpose`로 대체 |
| `reward_balances` / `rewards` | `point_wallets` / `point_transactions`으로 단계적 대체 (Phase 1) |
| **플랜별 기능 제한** | **그룹 최대 멤버 수 제한으로 대체** (v2.5) |

---

## 18. 구현 로드맵 (앱 개발팀 참고)

| Phase | 내용 | 서버 상태 |
|-------|------|---------|
| **현재** | 인증, 명함, 그룹, 행사, 채팅, 레슨 API + **플랜별 멤버 한도 체크** | ✅ 완료 |
| **Phase 1** | 포인트 지갑/이력/차감 API + Migration 0013 | 설계 완료, 구현 예정 |
| **Phase 2** | 인앱결제 영수증 검증, 단건 충전 (웹) | PG사 선정 후 |
| **Phase 3** | 파트너 서비스 포인트 연동 | 추후 |

---

*METI NativeApp Agent Prompt v2.5 — 2026-05-05*
