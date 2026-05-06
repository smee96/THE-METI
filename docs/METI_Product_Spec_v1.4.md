# METI 서비스 기획서 v1.4
> 최종 업데이트: 2026-05-06

---

## 1. 서비스 개요

METI는 그룹·행사·레슨 기반의 네트워킹 플랫폼입니다.
디지털 명함 교환, 그룹 활동 관리, 포인트 시스템, 레슨/행사 상품 결제를 통합 제공합니다.

| 항목 | 내용 |
|------|------|
| 서비스명 | METI |
| 플랫폼 | Flutter 네이티브 앱 + 웹(Cloudflare Pages) |
| 백엔드 | Hono (Cloudflare Workers) + D1 SQLite |
| 배포 URL | https://the-meti.pages.dev |
| 앱 번들 ID | com.meti.app |

---

## 2. 사용자 유형

| 유형 | 설명 |
|------|------|
| `personal` | 일반 사용자 (명함·그룹 멤버) |
| `headhunter` | 헤드헌터 (확장 명함 기능) |
| `group_admin` | 그룹 관리자 (그룹 생성·운영 가능) |
| `super_admin` | 슈퍼어드민 (어드민 웹 전용) |

---

## 3. 플랜 구조

| 플랜 | 월 포인트 | 그룹 최대 멤버 | 구독 방식 |
|------|-----------|---------------|-----------|
| free | 0 P | 2명 | 무료 |
| pro | 10,000 P | 10명 | Apple IAP / Google Play |
| business | 500,000 P | 무제한 | Apple IAP / Google Play |

> **구독 결제**: Apple IAP(`com.meti.pro_monthly`, `com.meti.business_monthly`) + Google Play Billing
> **웹 결제** (레슨·행사 상품): PG사 미확정 — Toss / 포트원 중 선택 예정

---

## 4. 포인트 시스템

### 4.1 개인 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 명함 추가 비용 | 기획 확정 필요 |
| 행사 참가비 (`entry_fee`) | 행사 설정값 |
| 개인 → 그룹 이전 | 이전 금액만큼 |

### 4.2 그룹 포인트 용도
| 사용처 | 차감 포인트 |
|--------|------------|
| 레슨 개설 | 500 P |
| 행사 개설 (정원 ≤30) | 1,000 P |
| 행사 개설 (정원 31~100) | 3,000 P |
| 행사 개설 (정원 >100 또는 무제한) | 5,000 P |

### 4.3 포인트 흐름
```
구독 결제 → 개인 포인트 월 지급
개인 포인트 → 그룹 포인트 이전 (POST /api/v1/points/transfer)
그룹 포인트 → 레슨/행사 개설 비용 차감
참가자 개인 포인트 → 행사 참가비 차감 → 그룹 포인트로 적립
```

---

## 5. 그룹 내 역할 (group_members.role)

| 역할 | 권한 |
|------|------|
| `admin` | 그룹 최고 관리자. 역할 변경, 행사·레슨 생성 |
| `sub_admin` | 부관리자. 행사·레슨 생성 가능 |
| `instructor` | 강사. 담당 레슨 생성 가능 |
| `member` | 일반 멤버 |

> **강사 지정**: 그룹 `admin`이 `PATCH /api/v1/groups/:id/members/:memberId/role` 로 `instructor` 역할 부여

---

## 6. 레슨 (Lessons)

### 6.1 DB 스키마 (lessons 테이블)
```sql
id, group_id, instructor_id (FK→users), title, description,
schedule_type (one-time|repeat), scheduled_at, duration_minutes,
capacity, location, point_cost (개설 비용), status, created_at
```

### 6.2 API
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

## 7. 행사 (Events)

### 7.1 DB 스키마 (events 테이블)
```sql
id, group_id, created_by (FK→users), title, description, location,
starts_at, ends_at, capacity, visibility (public|group_only),
registration_type (free|pre_required), entry_method (qr|nfc_qr|manual),
point_cost (개설 비용), entry_fee (참가비·포인트), status, created_at
```

### 7.2 API
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

## 8. 상품·주문·결제

### 8.1 상품 (products)
그룹 관리자가 레슨/행사에 대한 **결제 상품**을 등록.
예: `수영 초급 10회 이용권 - 100,000원`, `체험 1회 - 10,000원`

### 8.2 API
| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/v1/groups/:groupId/products | 그룹 멤버 | 상품 목록 |
| POST | /api/v1/groups/:groupId/products | admin/sub_admin | 상품 등록 |
| PUT | /api/v1/products/:id | admin/sub_admin | 상품 수정 |
| POST | /api/v1/orders | 인증 사용자 | 주문 생성 |
| GET | /api/v1/orders | 본인 | 주문 목록 |
| GET | /api/v1/orders/:id | 본인 | 주문 상세 |
| POST | /api/v1/payments/verify-web | 인증 사용자 | 웹 결제 검증 |
| POST | /api/v1/payments/subscription/verify-apple | 인증 사용자 | Apple IAP 검증 |
| POST | /api/v1/payments/subscription/verify-google | 인증 사용자 | Google Play 검증 |

### 8.3 결제 흐름 (웹 결제)
```
1. 사용자가 상품 선택
2. POST /orders → order_id, total_amount 반환
3. 앱/웹에서 PG 결제창 호출 (Toss/포트원, 미확정)
4. PG 결제 완료 후 POST /payments/verify-web
5. 서버에서 금액 검증 → 주문 상태 paid 변경
```

---

## 9. 딥링크

| URL 패턴 | 동작 |
|----------|------|
| `/card/:id` | 명함 공개 페이지 (앱 미설치자도 웹으로 조회) |
| `/invite/:token` | 그룹 초대링크 (로그인 후 그룹 가입 확인 모달) |

> Flutter 앱: `Uri.base` 파싱으로 앱 시작 시 딥링크 감지
> 미로그인 시: SharedPreferences에 토큰 임시 저장 → 로그인 완료 후 처리

---

## 10. 인앱결제 범위

| 항목 | 결제 방식 |
|------|-----------|
| 구독 (pro/business) | Apple IAP + Google Play Billing |
| 레슨·행사 상품 구매 | 웹 결제 (PG사 미확정) — 앱 내 웹뷰 유도 |
| 포인트 직접 충전 | 웹 결제 (Phase 2) |

> 수수료 절감을 위해 구독 외 결제는 웹 결제로 유도

---

## 11. 구현 현황

| 영역 | 상태 |
|------|------|
| 인증 (JWT, OAuth, 리프레시) | ✅ 완료 |
| 명함 (생성·수정·공개) | ✅ 완료 |
| 그룹 (생성·승인·멤버·초대링크) | ✅ 완료 |
| 포인트 시스템 | ✅ 완료 (migration 0013) |
| 강사 역할 지정 API | ✅ 완료 (v2.6) |
| 레슨 CRUD + 수강 신청 | ✅ 완료 (v2.6) |
| 행사 CRUD + 참가 신청 | ✅ 완료 (v2.6) |
| 상품·주문·결제 API | ✅ 완료 (v2.6, PG 검증 Placeholder) |
| 관리자 웹 레슨 탭 | ✅ 완료 (v2.6) |
| 앱 웹 레슨 생성 모달 | ✅ 완료 (v2.6) |
| PG사 서버사이드 검증 | ⏳ PG사 확정 후 구현 |
| Apple IAP 영수증 서버검증 | ⏳ 검증 로직 추가 예정 |
| Google Play 서버검증 | ⏳ 검증 로직 추가 예정 |
| 딥링크 (Flutter) | ⏳ 네이티브 앱 에이전트 구현 예정 |
| 푸시 알림 | ⏳ 미결정 |
| 채팅 | ⏳ 미결정 |

---

## 12. DB 마이그레이션 목록

| 번호 | 내용 |
|------|------|
| 0001~0009 | 기본 스키마 (users, cards, groups, events, chat, recruiting, rewards, plans, user_role) |
| 0010~0012 | 미성년자/보호자, 초대링크, 그룹 단순화 |
| 0013 | 포인트 시스템, 플랜 멤버수 제한 |
| 0014 | lessons, events(재설계), products, orders, payments, lesson_registrations, event_participants |
| 0015 | events.entry_fee 컬럼 추가 |
