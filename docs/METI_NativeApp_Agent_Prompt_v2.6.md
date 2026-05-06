# METI 네이티브 앱 에이전트 프롬프트 v2.6
> 작성일: 2026-05-06 | 이전 버전: v2.5

---

## 서비스 개요

**METI**는 디지털 명함 + 그룹 네트워킹 + 레슨·행사 관리 + 포인트·결제를 통합한 Flutter 네이티브 앱입니다.

- **백엔드 API 베이스 URL**: `https://the-meti.pages.dev/api/v1`
- **앱 번들 ID**: `com.meti.app`
- **인앱결제 상품 ID**: `com.meti.pro_monthly`, `com.meti.business_monthly`

---

## 1. 인증 (Auth)

### 1.1 토큰 구조
- **Access Token**: JWT, 만료 1시간, Authorization 헤더에 Bearer로 전달
- **Refresh Token**: 로컬 저장, 자동 갱신

### 1.2 핵심 API
```
POST /auth/login          { email, password } → { access_token, refresh_token, user }
POST /auth/register       { email, password, name, account_type }
POST /auth/refresh        { refresh_token } → { access_token }
POST /auth/logout
GET  /auth/me
```

### 1.3 딥링크 처리 (앱 시작 시)
앱 시작 시 `Uri.base`를 파싱하여 딥링크를 감지합니다.

```dart
// main.dart 또는 router 초기화 시
final uri = Uri.base;

if (uri.path.startsWith('/invite/')) {
  final token = uri.pathSegments.last;
  if (isLoggedIn) {
    // 바로 그룹 미리보기 → 가입 모달
    showInviteJoinModal(token);
  } else {
    // SharedPreferences에 임시 저장 → 로그인 완료 후 처리
    await prefs.setString('pending_invite_token', token);
    navigateTo('/login');
  }
}

if (uri.path.startsWith('/card/')) {
  final cardId = uri.pathSegments.last;
  // 명함 공개 페이지 표시 (인증 불필요)
  navigateTo('/card/$cardId');
}
```

**초대 관련 API**
```
GET  /auth/invite-preview/:token   인증 불필요, 그룹 미리보기
POST /auth/invite-join             { token } 인증 필요, 실제 가입
```

---

## 2. 명함 (Cards)

```
GET    /cards               내 명함 목록
POST   /cards               명함 생성
GET    /cards/:id           명함 상세
PUT    /cards/:id           명함 수정
DELETE /cards/:id           명함 삭제
GET    /cards/public/:id    공개 명함 조회 (인증 불필요)
```

---

## 3. 그룹 (Groups)

```
GET    /groups                   공개 그룹 목록
POST   /groups                   그룹 생성 (group_admin 플랜 필요)
GET    /groups/:id               그룹 상세
GET    /groups/:id/members       멤버 목록
POST   /groups/:id/join          가입 신청
DELETE /groups/:id/join          탈퇴
PATCH  /groups/:id/members/:memberId         가입 승인/거절
PATCH  /groups/:id/members/:memberId/role    역할 변경 (admin 전용)
```

### 3.1 그룹 내 역할 (role)
| 값 | 설명 |
|----|------|
| `admin` | 그룹 오너. 역할 변경, 모든 기능 |
| `sub_admin` | 부관리자. 행사·레슨 생성 |
| `instructor` | 강사. 담당 레슨 생성 |
| `member` | 일반 멤버 |

### 3.2 강사 지정
```
PATCH /groups/:id/members/:memberId/role
Body: { "role": "instructor" }
권한: admin만 가능
```

---

## 4. 레슨 (Lessons)

### 4.1 API
```
GET    /lessons/groups/:groupId/lessons       레슨 목록 (그룹 멤버)
POST   /lessons/groups/:groupId/lessons       레슨 생성 (admin/sub_admin/instructor, 그룹포인트 500P 차감)
GET    /lessons/:id                           레슨 상세 (관리자·강사는 등록자 목록 포함)
PUT    /lessons/:id                           레슨 수정 (admin/sub_admin/강사 본인)
DELETE /lessons/:id                           레슨 취소 (admin/sub_admin)
POST   /lessons/:id/register                  수강 신청 (그룹 멤버)
DELETE /lessons/:id/register                  수강 취소 (신청자 본인)
```

### 4.2 레슨 생성 요청 Body
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

### 4.3 레슨 상태
`upcoming` → `ongoing` → `ended` | `cancelled`

---

## 5. 행사 (Events)

### 5.1 API
```
GET    /events/groups/:groupId/events       행사 목록 (그룹 멤버)
POST   /events/groups/:groupId/events       행사 생성 (admin/sub_admin, 그룹포인트 차감)
GET    /events/:id                          행사 상세
PUT    /events/:id                          행사 수정 (admin/sub_admin)
DELETE /events/:id                          행사 취소 (admin/sub_admin)
POST   /events/:id/join                     참가 신청 (그룹 멤버, entry_fee 차감)
DELETE /events/:id/join                     참가 취소 (참가비 환불)
GET    /events/:id/participants             참가자 목록 (admin/sub_admin)
```

### 5.2 행사 생성 요청 Body
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

### 5.3 행사 개설 비용 (그룹 포인트 자동 차감)
| 정원 | 차감 포인트 |
|------|------------|
| ≤30명 | 1,000 P |
| 31~100명 | 3,000 P |
| >100명 또는 무제한 | 5,000 P |

### 5.4 에러 응답 (포인트 부족)
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

---

## 6. 상품·주문·결제 (Products / Orders / Payments)

### 6.1 상품
```
GET  /groups/:groupId/products          그룹 상품 목록 (그룹 멤버)
POST /groups/:groupId/products          상품 등록 (admin/sub_admin)
PUT  /products/:id                      상품 수정
```

### 6.2 주문
```
POST /orders                            주문 생성
GET  /orders                            내 주문 목록
GET  /orders/:id                        주문 상세
```

주문 생성 Body:
```json
{
  "items": [
    { "product_id": 1, "quantity": 1 }
  ]
}
```

응답:
```json
{
  "success": true,
  "data": { "order_id": 42, "total_amount": 100000, "item_count": 1 }
}
```

### 6.3 결제

#### 웹 결제 (레슨·행사 상품 — PG사 미확정)
```
POST /payments/verify-web
Body: {
  "order_id": 42,
  "pg": "toss",
  "pg_transaction_id": "PG사_거래ID",
  "amount": 100000
}
```

**앱에서 웹 결제 유도 흐름**:
1. 상품 선택 → `POST /orders` → `order_id` 획득
2. 앱 내 웹뷰로 `https://the-meti.pages.dev/payment?order_id=42` 열기
3. PG 결제 완료 → `POST /payments/verify-web` 호출
4. 결제 성공 → 주문 상태 `paid`

#### 구독 결제 (Apple IAP)
```
POST /payments/subscription/verify-apple
Body: {
  "receipt_data": "base64_영수증",
  "product_id": "com.meti.pro_monthly",
  "transaction_id": "apple_거래ID"
}
```

#### 구독 결제 (Google Play)
```
POST /payments/subscription/verify-google
Body: {
  "purchase_token": "google_구매토큰",
  "product_id": "com.meti.pro_monthly",
  "package_name": "com.meti.app"
}
```

---

## 7. 포인트 시스템

```
GET  /points/me                   개인 포인트 잔액·이력
POST /points/transfer             개인 → 그룹 포인트 이전
  Body: { "group_id": 1, "amount": 500 }
GET  /groups/:id/points           그룹 포인트 잔액·이력
```

---

## 8. 결제 방식 정책

| 항목 | 방식 | 이유 |
|------|------|------|
| 구독 (pro/business) | Apple IAP + Google Play | 스토어 정책 |
| 레슨·행사 상품 구매 | 웹 결제 (웹뷰 유도) | 수수료 절감 (30% vs 3%) |
| 포인트 직접 충전 | 웹 결제 (Phase 2) | 수수료 절감 |

> ⚠️ 주의: 앱 내에서 "포인트 충전" 버튼은 웹뷰(또는 외부 브라우저)로 연결해야 합니다.
> 구독 이외의 결제를 앱 내 IAP로 처리하면 스토어 정책 위반이 아니나, 수수료 30%가 발생합니다.

---

## 9. 공통 응답 구조

```json
// 성공
{ "success": true, "data": { ... }, "message": "..." }

// 실패
{ "success": false, "error": "오류 메시지" }

// 페이지네이션
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1, "limit": 20, "total": 50,
    "total_pages": 3, "has_next": true
  }
}
```

---

## 10. 전체 API 목록 요약

### 인증
| Method | Path |
|--------|------|
| POST | /auth/login |
| POST | /auth/register |
| POST | /auth/refresh |
| POST | /auth/logout |
| GET | /auth/me |
| GET | /auth/invite-preview/:token |
| POST | /auth/invite-join |

### 명함
| Method | Path |
|--------|------|
| GET/POST | /cards |
| GET/PUT/DELETE | /cards/:id |
| GET | /cards/public/:id |

### 그룹
| Method | Path |
|--------|------|
| GET/POST | /groups |
| GET | /groups/:id |
| GET | /groups/:id/members |
| POST | /groups/:id/join |
| DELETE | /groups/:id/join |
| PATCH | /groups/:id/members/:memberId |
| PATCH | /groups/:id/members/:memberId/role |
| GET/POST | /groups/:id/invite-links |

### 레슨
| Method | Path |
|--------|------|
| GET/POST | /lessons/groups/:groupId/lessons |
| GET/PUT/DELETE | /lessons/:id |
| POST/DELETE | /lessons/:id/register |

### 행사
| Method | Path |
|--------|------|
| GET/POST | /events/groups/:groupId/events |
| GET/PUT/DELETE | /events/:id |
| POST/DELETE | /events/:id/join |
| GET | /events/:id/participants |

### 상품·주문·결제
| Method | Path |
|--------|------|
| GET/POST | /groups/:groupId/products |
| PUT | /products/:id |
| GET/POST | /orders |
| GET | /orders/:id |
| POST | /payments/verify-web |
| POST | /payments/subscription/verify-apple |
| POST | /payments/subscription/verify-google |

### 포인트
| Method | Path |
|--------|------|
| GET | /points/me |
| POST | /points/transfer |
| GET | /groups/:id/points |

---

## 11. 미구현 / Phase 2 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| PG사 서버사이드 검증 | ⏳ | PG사 확정 후 구현 (Toss/포트원) |
| Apple IAP 영수증 검증 | ⏳ | Apple Verify API 연동 필요 |
| Google Play 구매 검증 | ⏳ | Google Publisher API 연동 필요 |
| 웹 결제 페이지 | ⏳ | 앱 웹뷰용 결제 페이지 구현 예정 |
| 포인트 직접 충전 | ⏳ | Phase 2 |
| 푸시 알림 (FCM) | ⏳ | 미결정 |
| 채팅 (그룹 채팅) | ⏳ | 미결정 |
| NFC 태그 입장 처리 | ⏳ | 네이티브 NFC API 필요 |
