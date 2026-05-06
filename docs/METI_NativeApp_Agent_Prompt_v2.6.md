# METI NativeApp Agent Prompt — v2.6 변경 패치

> **문서 성격**: 이 문서는 **v2.5 대비 변경된 부분만** 기술합니다.  
> 앱 에이전트는 **v2.5 전체 문서를 기본(Base)으로 유지**하면서, 아래 지시에 따라 해당 섹션을 교체·추가하세요.  
> 변경되지 않은 섹션(인증 API, 명함 API, 채팅 API, 포인트 API 등)은 v2.5 그대로 사용합니다.

> **버전**: v2.6  
> **기준 버전**: v2.5 (2026-05-05)  
> **패치 작성일**: 2026-05-06

---

## 변경 요약

| # | 대상 섹션 | 변경 유형 | 한 줄 요약 |
|---|---------|---------|----------|
| 1 | §7 그룹 멤버 역할 | **교체** | role ENUM에 `instructor` 추가 + 강사 지정 API 신규 |
| 2 | §8 레슨 API | **전체 교체** | API 경로 변경, 생성 권한 명확화, 수강 신청/취소 추가 |
| 3 | §9 행사 API | **전체 교체** | API 경로 변경, 개설 비용 정책, 참가비 포인트 흐름 추가 |
| 4 | 신규 §10 상품·주문·결제 | **섹션 신규 추가** | products, orders, payments API 전체 |
| 5 | §16 DB 스키마 | **내용 추가** | migration 0014, 0015 테이블 목록 |
| 6 | §18 로드맵 | **상태 업데이트** | 레슨·행사·상품·결제 완료 표시 |

---

## PATCH 1 — §7 그룹 멤버 역할(role) 교체

**v2.5의 §7 그룹 멤버 역할 표를 아래로 교체하세요.**

### 그룹 내 역할 (group_members.role)

| 값 | 설명 | 레슨 생성 | 행사 생성 |
|----|------|:---:|:---:|
| `admin` | 그룹 오너. 역할 변경 포함 모든 기능 | ✅ | ✅ |
| `sub_admin` | 부관리자 | ✅ | ✅ |
| `instructor` | 강사. 담당 레슨 생성만 가능 | ✅ | ❌ |
| `member` | 일반 멤버 | ❌ | ❌ |

> ~~v2.5: instructor 역할 없음~~  
> **v2.6 추가**: `instructor` 역할 신규. `admin`이 지정.

### 강사 지정 API (신규)

```
PATCH /api/v1/groups/:id/members/:memberId/role
권한: admin만 가능
Body: { "role": "instructor" }   // "sub_admin" | "instructor" | "member"
```

**레슨 생성 주체 정리**:
- 강사가 직접 그룹을 만든 경우 → 자동으로 `admin` 역할 → 별도 지정 없이 레슨 생성 가능
- 기존 그룹에 강사를 추가하는 경우 → `admin`이 위 API로 `instructor` 역할 부여 후 레슨 생성 가능

---

## PATCH 2 — §8 레슨 API 전체 교체

**v2.5의 §8 레슨 API 전체를 아래로 교체하세요.**

### 8-1. 레슨 목록

```
GET /api/v1/lessons/groups/:groupId/lessons
권한: 그룹 멤버 전체
Query: page, limit, status(upcoming|ongoing|ended|cancelled)
```

> ~~v2.5: `GET /lessons/:groupId/schedules`~~ → **v2.6: 경로 변경**

### 8-2. 레슨 생성

```
POST /api/v1/lessons/groups/:groupId/lessons
권한: admin / sub_admin / instructor
효과: 그룹 포인트 500P 자동 차감
```

```json
{
  "instructor_id": 123,
  "title": "수영 초급 클래스",
  "schedule_type": "one-time",
  "scheduled_at": "2026-06-01T10:00:00",
  "duration_minutes": 60,
  "capacity": 10,
  "location": "실내수영장 A레인",
  "point_cost": 500
}
```

**포인트 부족 응답** (그룹 포인트 부족 시):
```json
{
  "success": false,
  "error": "그룹 포인트가 부족합니다.",
  "data": {
    "error_code": "insufficient_group_points",
    "required": 500,
    "current": 200,
    "shortage": 300
  }
}
```

> ~~v2.5: 레슨 생성 비용 없음~~ → **v2.6: 그룹 포인트 500P 차감**

### 8-3. 레슨 상세

```
GET /api/v1/lessons/:id
권한: 그룹 멤버
응답: 레슨 정보 + 강사 정보 + registered_count
      (admin/sub_admin/instructor에게는 등록자 목록도 포함)
```

### 8-4. 레슨 수정

```
PUT /api/v1/lessons/:id
권한: admin / sub_admin / 강사 본인
Body: title, description, scheduled_at, duration_minutes, capacity, location, status (모두 optional)
```

### 8-5. 레슨 취소

```
DELETE /api/v1/lessons/:id
권한: admin / sub_admin
효과: status → 'cancelled' (포인트 환불 없음)
```

### 8-6. 수강 신청 (신규)

```
POST /api/v1/lessons/:id/register
권한: 그룹 멤버
```

응답:
```json
{ "success": true, "message": "수강 신청이 완료되었습니다." }
```

에러:
```json
{ "success": false, "error": "수강 정원이 가득 찼습니다." }   // 409
{ "success": false, "error": "이미 수강 신청한 레슨입니다." } // 409
```

### 8-7. 수강 취소 (신규)

```
DELETE /api/v1/lessons/:id/register
권한: 신청자 본인
```

### 8-8. 레슨 상태

```
upcoming → ongoing → ended
                   → cancelled
```

---

## PATCH 3 — §9 행사 API 전체 교체

**v2.5의 §9 행사 API 전체를 아래로 교체하세요.**

### 9-1. 행사 목록

```
GET /api/v1/events/groups/:groupId/events
권한: 그룹 멤버 전체
Query: page, limit, status
```

> ~~v2.5: `GET /events?group_id=X`~~ → **v2.6: 경로 변경**

### 9-2. 행사 생성

```
POST /api/v1/events/groups/:groupId/events
권한: admin / sub_admin
효과: 그룹 포인트 자동 차감 (정원에 따라 다름)
```

```json
{
  "title": "2026 하계 수영 대회",
  "description": "그룹 연간 행사",
  "location": "시립수영장",
  "starts_at": "2026-07-15T09:00:00",
  "ends_at": "2026-07-15T18:00:00",
  "capacity": 50,
  "visibility": "group_only",
  "registration_type": "pre_required",
  "entry_method": "qr",
  "entry_fee": 0
}
```

**행사 개설 비용 (그룹 포인트 자동 차감)**:

| 정원 | 차감 포인트 |
|------|------------|
| ≤30명 | 1,000 P |
| 31~100명 | 3,000 P |
| >100명 또는 무제한(미입력) | 5,000 P |

> ~~v2.5: 행사 개설 비용 없음~~ → **v2.6: 정원 기준 포인트 차감**

**포인트 부족 응답**:
```json
{
  "success": false,
  "error": "그룹 포인트가 부족합니다.",
  "data": {
    "error_code": "insufficient_group_points",
    "required": 1000,
    "current": 300,
    "shortage": 700
  }
}
```

### 9-3. 행사 상세

```
GET /api/v1/events/:id
권한: public 행사 → 누구나 / group_only → 그룹 멤버
```

### 9-4. 행사 수정

```
PUT /api/v1/events/:id
권한: admin / sub_admin
Body: title, description, location, starts_at, ends_at, status, visibility, registration_type (모두 optional)
```

### 9-5. 행사 취소

```
DELETE /api/v1/events/:id
권한: admin / sub_admin
효과: status → 'cancelled'
```

### 9-6. 행사 참가 신청 (신규)

```
POST /api/v1/events/:id/join
권한: 그룹 멤버
효과: entry_fee > 0 이면 개인 포인트 차감 → 그룹 포인트로 적립
```

에러:
```json
{ "success": false, "error": "행사 정원이 가득 찼습니다." }     // 409
{ "success": false, "error": "이미 참가 신청한 행사입니다." }   // 409
{
  "success": false,
  "error": "포인트가 부족합니다.",
  "data": {
    "error_code": "insufficient_points",
    "required": 500, "current": 100, "shortage": 400
  }
}
```

### 9-7. 행사 참가 취소 (신규)

```
DELETE /api/v1/events/:id/join
권한: 신청자 본인
효과: entry_fee > 0 이면 개인 포인트 환불, 그룹 포인트 차감
```

### 9-8. 참가자 목록

```
GET /api/v1/events/:id/participants
권한: admin / sub_admin
Query: page, limit
```

---

## PATCH 4 — §10 상품·주문·결제 섹션 신규 추가

**v2.5 §9 뒤에 §10을 새로 삽입하세요. 기존 §10 이후 번호는 한 칸씩 밀립니다.**

### 10-1. 상품 (Products)

그룹 관리자가 레슨·행사에 대한 **결제 상품**을 등록합니다.  
예) 수영 초급 10회 이용권 100,000원 / 체험 1회 10,000원

```
GET  /api/v1/groups/:groupId/products     그룹 상품 목록 (그룹 멤버)
POST /api/v1/groups/:groupId/products     상품 등록 (admin / sub_admin)
PUT  /api/v1/products/:id                 상품 수정 (admin / sub_admin)
```

상품 등록 Body:
```json
{
  "type": "lesson",
  "target_id": 1,
  "title": "수영 초급 10회 이용권",
  "price": 100000,
  "stock": null,
  "expires_days": 90
}
```

### 10-2. 주문 (Orders)

```
POST /api/v1/orders       주문 생성
GET  /api/v1/orders       내 주문 목록
GET  /api/v1/orders/:id   주문 상세
```

주문 생성 Body:
```json
{ "items": [{ "product_id": 1, "quantity": 1 }] }
```

응답:
```json
{ "success": true, "data": { "order_id": 42, "total_amount": 100000, "item_count": 1 } }
```

### 10-3. 결제 (Payments)

#### 웹 결제 (레슨·행사 상품 — PG사 미확정)

> **앱에서 웹 결제를 유도하는 이유**: 인앱결제 수수료 30% 절감 (PG사 약 3%)

**앱 내 웹 결제 유도 흐름**:
```
1. 사용자 상품 선택
   ↓
2. POST /orders → order_id 획득
   ↓
3. 앱 내 WebView로 결제 페이지 열기
   URL: https://the-meti.pages.dev/payment?order_id={order_id}
   ↓
4. PG 결제 완료 콜백
   ↓
5. POST /api/v1/payments/verify-web 호출
   ↓
6. 결제 완료 → 주문 상태 paid
```

```
POST /api/v1/payments/verify-web
Body: {
  "order_id": 42,
  "pg": "toss",
  "pg_transaction_id": "PG사_거래ID",
  "amount": 100000
}
```

> ⚠️ **필수 준수**: 앱 내에서 "웹에서 결제하세요" 문구 직접 노출 시  
> Apple/Google 정책 위반 가능 — WebView 방식 또는 외부 브라우저 유도 사용

#### 구독 결제 (Apple IAP)

```
POST /api/v1/payments/subscription/verify-apple
Body: {
  "receipt_data": "base64_영수증",
  "product_id": "com.meti.pro_monthly",
  "transaction_id": "apple_거래ID"
}
```

상품 ID:
| 상품 | product_id |
|------|-----------|
| Pro 월간 | `com.meti.pro_monthly` |
| Business 월간 | `com.meti.business_monthly` |

#### 구독 결제 (Google Play)

```
POST /api/v1/payments/subscription/verify-google
Body: {
  "purchase_token": "google_구매토큰",
  "product_id": "com.meti.pro_monthly",
  "package_name": "com.meti.app"
}
```

### 10-4. 결제 방식 정책

| 항목 | 방식 |
|------|------|
| 구독 (pro/business) | Apple IAP + Google Play Billing |
| 레슨·행사 상품 구매 | 웹 결제 (WebView 유도) |
| 포인트 직접 충전 | 웹 결제 (Phase 2) |

---

## PATCH 5 — §16 DB 스키마에 내용 추가

**v2.5 §16 DB 스키마 변경 이력 표의 마지막 행 아래에 다음을 추가하세요.**

| Migration | 내용 |
|-----------|------|
| *(기존 행 유지)* | *(변경 없음)* |
| **0014** | `lessons`, `lesson_registrations`, `events`(재설계), `event_participants`, `products`, `orders`, `order_items`, `payments` 신규 / `group_members.role`에 `instructor` 추가 |
| **0015** | `events.entry_fee` 컬럼 추가 |

---

## PATCH 6 — §18 로드맵 현재 Phase 행 업데이트

**v2.5 §18 로드맵 표의 "현재" 행을 아래로 교체하세요.**

| Phase | 내용 | 서버 상태 |
|-------|------|---------|
| **현재** | 인증, 명함, 그룹, 포인트, 강사 역할 지정, **레슨 CRUD + 수강신청**, **행사 CRUD + 참가신청**, **상품·주문·결제 API** | ✅ 완료 |

> ~~v2.5: 레슨·행사·결제 미포함~~

---

## 적용 후 검증 체크리스트

- [ ] §7 역할 표에 `instructor` 항목과 강사 지정 API(`PATCH .../role`)가 존재함
- [ ] §7에 "강사가 직접 그룹을 만들면 admin → 바로 레슨 생성 가능" 설명이 있음
- [ ] §8 레슨 API 경로가 `/lessons/groups/:groupId/lessons` 형식으로 변경됨
- [ ] §8에 수강 신청(`POST .../register`) 및 취소(`DELETE .../register`) API가 있음
- [ ] §8에 레슨 개설 시 그룹 포인트 500P 차감 안내가 있음
- [ ] §9 행사 API 경로가 `/events/groups/:groupId/events` 형식으로 변경됨
- [ ] §9에 행사 참가 신청(`POST .../join`) 및 취소(`DELETE .../join`) API가 있음
- [ ] §9에 행사 개설 비용 표(1000/3000/5000P)가 있음
- [ ] §10이 신규 삽입되어 상품·주문·결제 API가 기술되어 있음
- [ ] §10에 웹 결제 유도 흐름 5단계가 있음
- [ ] §10에 Apple IAP / Google Play 구독 검증 API가 있음
- [ ] §16에 migration 0014, 0015 행이 추가됨
- [ ] §18 현재 Phase에 레슨·행사·상품·결제 완료 표시됨

---

*METI NativeApp Agent Prompt v2.6 Patch — 2026-05-06*  
*Base: v2.5 (2026-05-05) — 변경된 섹션만 기술, 나머지는 v2.5 원본 유지*
