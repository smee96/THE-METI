# METI 네이티브 앱 개발 에이전트 프롬프트 v2.8
> 작성일: 2026-05-14 | 백엔드 기준: `https://the-meti.pages.dev` (Cloudflare Pages + Hono + D1)

---

## 0. 이 문서의 목적

이 프롬프트는 **Flutter 네이티브 앱 에이전트**에게 전달합니다.
METI 백엔드 API가 완성되어 있으므로, 앱 에이전트는 UI/UX와 API 연동에 집중하면 됩니다.
백엔드 수정 없이 앱만으로 구현 가능한 범위를 기준으로 작성되어 있습니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | METI |
| 번들 ID | `com.meti.app` |
| 프레임워크 | Flutter (Dart) |
| 최소 지원 | iOS 15+ / Android 8+ (API 26+) |
| 백엔드 Base URL | `https://the-meti.pages.dev/api/v1` |
| 딥링크 Scheme | `meti://` |
| 상태관리 | Riverpod 권장 (또는 Provider / BLoC) |
| HTTP 클라이언트 | `dio` 권장 |
| 로컬 저장소 | `flutter_secure_storage` (JWT 토큰), `shared_preferences` (설정) |

---

## 2. 인증 시스템

### 2.1 JWT 방식
- **Access Token**: 만료 24h, `Authorization: Bearer {token}` 헤더로 전달
- **Refresh Token**: 만료 30일, 만료 시 재로그인 유도
- **저장**: `flutter_secure_storage`에 저장 (keychain/keystore)

### 2.2 회원가입 / 로그인 API

```
POST /api/v1/auth/register
Body: { email, password, name }
→ account_type은 서버에서 'personal' 고정 (앱에서 선택 불필요)

POST /api/v1/auth/login
Body: { email, password }
→ { token, refresh_token, user: { id, name, email, plan, role } }

POST /api/v1/auth/refresh
Body: { refresh_token }
→ { token }

POST /api/v1/auth/logout
Header: Authorization Bearer
```

### 2.3 소셜 로그인

```
POST /api/v1/auth/oauth/apple
Body: { id_token, name? }   # Sign in with Apple

POST /api/v1/auth/oauth/google
Body: { id_token }           # Google Sign-In
```

### 2.4 Dio Interceptor 패턴 (권장)
```dart
// 401 응답 시 자동 토큰 갱신
// 갱신 실패 시 로그인 화면으로 이동
// 모든 요청에 Authorization 헤더 자동 추가
```

### 2.5 웹뷰 결제 토큰 (일회성)
앱 내 결제가 필요한 경우 (레슨·행사 상품, 포인트 충전):
```
POST /api/v1/payments/payment-token
Body: { order_id: 42 }
→ { token: "otp_xxx", expires_in: 300 }

WebView URL: https://the-meti.pages.dev/payment?token=otp_xxx
```
> ⚠️ Apple/Google 정책: "웹에서 결제" 문구 직접 노출 금지. "이용권 구매" 등 중립적 표현 사용.

---

## 3. 사용자 유형 및 역할

### 3.1 account_type (users.account_type)
- **`personal`** — 유일한 타입. 모든 신규 가입자 고정.
- ~~headhunter~~ — v1.5에서 완전 제거. 앱에서 처리 불필요.

### 3.2 users.role (시스템 역할)
- `user` — 일반 사용자
- `super_admin` — 어드민 웹 전용, 앱에서 특별 처리 불필요

### 3.3 group_members.role (그룹 내 역할)
| role | 권한 |
|------|------|
| `admin` | 그룹 최고 관리자 (역할 변경, 행사·레슨 생성) |
| `sub_admin` | 부관리자 (행사·레슨 생성) |
| `instructor` | 강사 (담당 레슨 생성) |
| `member` | 일반 멤버 |

---

## 4. 플랜 구조

| 플랜 | 월 포인트 | 그룹 내 최대 멤버 | 기본 명함 수 |
|------|-----------|-----------------|------------|
| `free` | 0 P | 2명 | 1개 |
| `pro` | 10,000 P | 10명 | 3개 |
| `business` | 500,000 P | 무제한 | 10개 |

**구독**: Apple IAP (`com.meti.pro_monthly`, `com.meti.business_monthly`) + Google Play Billing

---

## 5. 핵심 화면 및 API 매핑

### 5.1 명함 (Cards)

```
GET    /api/v1/cards/me                   # 내 명함 목록
POST   /api/v1/cards                      # 명함 생성
GET    /api/v1/cards/:id                  # 명함 상세
PUT    /api/v1/cards/:id                  # 명함 수정
DELETE /api/v1/cards/:id                  # 명함 삭제
PATCH  /api/v1/cards/:id/default          # 기본 명함 설정
GET    /api/v1/cards/public/:id           # 공개 명함 (인증 불필요)
POST   /api/v1/cards/:id/qr              # QR 코드 생성
```

**명함 데이터 구조**:
```json
{
  "title": "대표 명함",
  "job_title": "iOS 개발자",
  "company": "METI",
  "email": "user@example.com",
  "phone": "010-1234-5678",
  "website": "https://example.com",
  "bio": "소개글",
  "is_active": 1
}
```

**명함 공개 링크 공유**:
- 공유 URL: `https://the-meti.pages.dev/card/{card_id}`
- QR 코드로도 공유 가능 → 앱 미설치자가 웹에서 조회

### 5.2 명함 교환 (NFC / QR)

```
POST /api/v1/cards/exchange/qr    # QR 스캔으로 교환
Body: { card_id, scanned_card_id }

GET  /api/v1/cards/received       # 받은 명함 목록
```

### 5.3 그룹 (Groups)

```
GET  /api/v1/groups               # 공개 그룹 목록 (검색: ?q=, ?category=)
POST /api/v1/groups               # 그룹 생성 신청 (서버에서 관리자 승인 후 활성화)
GET  /api/v1/groups/my            # 내 소속 그룹
GET  /api/v1/groups/:id           # 그룹 상세
GET  /api/v1/groups/:id/members   # 그룹 멤버 목록
POST /api/v1/groups/:id/join      # 그룹 가입 신청
DELETE /api/v1/groups/:id/leave   # 그룹 탈퇴
```

**그룹 생성 시 주의**: `status: pending` → 어드민 승인 후 `active`
  앱에서 "승인 대기 중" 상태 표시 필요.

**그룹 카테고리** (`category`):
- `association` (협회), `company` (기업), `club` (동호회), `other` (기타)

### 5.4 그룹 초대 (Invite Links)

```
POST /api/v1/groups/:id/invite-links   # 초대 링크 생성 (admin/sub_admin)
GET  /api/v1/groups/:id/invite-links   # 초대 링크 목록 (admin/sub_admin)
PATCH /api/v1/groups/:id/invite-links/:linkId/deactivate  # 비활성화

GET  /api/v1/groups/invite/:token      # 초대 링크 정보 조회 (인증 불필요)
POST /api/v1/auth/invite/:token/join   # 초대 링크로 그룹 가입 (인증 필요)
```

**딥링크 처리**:
```
앱 실행 시 meti://invite/{token} 수신
→ 로그인 상태: 그룹 가입 확인 모달 표시
→ 미로그인: SharedPreferences에 token 저장 → 로그인 완료 후 처리
```

**웹 초대 링크**: `https://the-meti.pages.dev/invite/{token}`
→ 앱 미설치자도 웹 페이지에서 초대 정보 확인 + 앱 다운로드 유도

### 5.5 포인트 (Points)

```
GET  /api/v1/points/balance                    # 내 포인트 잔액 + 7일 내 만료 예정
GET  /api/v1/points/history                    # 내 포인트 내역 (페이지네이션)
POST /api/v1/points/transfer                   # 개인→그룹 포인트 이전
GET  /api/v1/points/groups/:groupId/balance    # 그룹 포인트 잔액
GET  /api/v1/points/groups/:groupId/history    # 그룹 포인트 내역 (admin/sub_admin)
```

**포인트 이전 Body**:
```json
{ "group_id": 1, "amount": 5000 }
```

**포인트 만료 정책**:
- 구독 지급: 다음 갱신일 만료
- 충전·이벤트: 적립일 +90일
- UI에서 만료 임박 포인트 강조 표시 권장

### 5.6 행사 (Events)

```
GET  /api/v1/events                            # 공개 행사 목록
GET  /api/v1/events/groups/:groupId/events     # 그룹 행사 목록
POST /api/v1/events/groups/:groupId/events     # 행사 생성 (admin/sub_admin)
GET  /api/v1/events/:id                        # 행사 상세
POST /api/v1/events/:id/join                   # 행사 참가 신청
DELETE /api/v1/events/:id/join                 # 행사 취소
GET  /api/v1/events/:id/participants           # 참가자 목록 (admin/sub_admin)
```

**행사 참가 시 포인트 차감**: `entry_fee` 설정 시 자동 차감

### 5.7 레슨 (Lessons)

```
GET  /api/v1/lessons/groups/:groupId/lessons   # 그룹 레슨 목록
POST /api/v1/lessons/groups/:groupId/lessons   # 레슨 생성 (admin/sub_admin/instructor)
GET  /api/v1/lessons/:id                       # 레슨 상세
POST /api/v1/lessons/:id/register              # 수강 신청
DELETE /api/v1/lessons/:id/register            # 수강 취소
```

**레슨 생성 시**: 그룹 포인트에서 **500P 자동 차감**

### 5.8 상품·주문 (Products & Orders)

```
GET  /api/v1/groups/:groupId/products          # 상품 목록
POST /api/v1/groups/:groupId/products          # 상품 등록 (admin/sub_admin)
POST /api/v1/orders                            # 주문 생성
GET  /api/v1/orders                            # 내 주문 목록
GET  /api/v1/orders/:id                        # 주문 상세
```

**결제 방식**:
- 구독 (pro/business) → Apple IAP / Google Play Billing (인앱 결제)
- 레슨·행사 상품, 포인트 충전, 명함 추가 → 웹 결제 (WebView)

---

## 6. 구독 (IAP) 연동

### 6.1 제품 ID
| 플랜 | Apple 제품 ID | Google 제품 ID |
|------|--------------|----------------|
| Pro  | `com.meti.pro_monthly` | `pro_monthly` |
| Business | `com.meti.business_monthly` | `business_monthly` |

### 6.2 검증 흐름
```
1. Apple/Google 결제 완료
2. 영수증/토큰 수신
3. POST /api/v1/payments/subscription/verify-apple
   Body: { receipt_data: "..." }
   또는
   POST /api/v1/payments/subscription/verify-google
   Body: { purchase_token: "...", product_id: "..." }
4. 서버에서 플랜 업그레이드
5. 앱 내 플랜 정보 갱신
```

### 6.3 구독 검증 시점
- 앱 포그라운드 복귀 시
- 앱 콜드 스타트 시
- 결제 완료 직후

---

## 7. 딥링크 처리

| URL | 처리 방식 |
|-----|----------|
| `meti://invite/{token}` | 그룹 초대 모달 or 로그인 후 처리 |
| `meti://card/{id}` | 명함 상세 화면 이동 |
| `https://the-meti.pages.dev/card/{id}` | Universal Link → 앱에서 처리 |
| `https://the-meti.pages.dev/invite/{token}` | Universal Link → 앱에서 처리 |

**딥링크 핸들링 코드 패턴**:
```dart
// 앱 시작 시 초기 링크 확인
final Uri? initialLink = await getInitialUri();
if (initialLink != null) _handleDeepLink(initialLink);

// 앱 실행 중 링크 수신
uriLinkStream.listen(_handleDeepLink);

void _handleDeepLink(Uri uri) {
  if (uri.pathSegments.first == 'invite') {
    final token = uri.pathSegments.last;
    if (isLoggedIn) showInviteModal(token);
    else { saveToken(token); navigateToLogin(); }
  }
}
```

---

## 8. NFC 명함 교환

```dart
// Android: NfcManager 패키지
// iOS: core_nfc 패키지 (iOS 13+ 백그라운드 NFC 읽기)

// NFC 태그에는 카드 ID 기록
// meti://card/{card_id} 형태 NDEF 메시지

// 태그 감지 시:
// 1. NFC UID 파싱
// 2. POST /api/v1/cards/exchange/nfc { nfc_uid }
// 3. 교환 완료 → 받은 명함 상세 표시
```

---

## 9. 앱 화면 구조 (권장)

```
앱 진입
├── /app/login            로그인
├── /app/register         회원가입
└── (인증 후)
    ├── 홈 탭
    │   ├── 내 명함 (기본 명함 표시, QR 생성)
    │   ├── 받은 명함 목록
    │   └── 명함 스캔 (카메라/NFC)
    ├── 그룹 탭
    │   ├── 내 소속 그룹 목록
    │   ├── 그룹 탐색 (공개 그룹)
    │   └── 그룹 상세
    │       ├── 멤버 목록
    │       ├── 행사 목록
    │       ├── 레슨 목록
    │       ├── 그룹 포인트 (admin/sub_admin)
    │       └── 초대 링크 관리 (admin/sub_admin)
    ├── 행사/레슨 탭
    │   ├── 공개 행사 피드
    │   └── 내 신청 내역
    ├── 포인트 탭
    │   ├── 잔액 + 만료 예정
    │   ├── 내역
    │   └── 그룹 이전
    └── 마이페이지
        ├── 프로필 수정
        ├── 플랜 / 구독 관리
        ├── 명함 관리 (전체 목록)
        └── 로그아웃
```

---

## 10. 에러 처리 공통 패턴

### 10.1 API 응답 형식
```json
// 성공
{ "success": true, "data": {...}, "message": "..." }

// 실패
{ "success": false, "error": "에러 메시지" }
// 또는
{ "success": false, "message": "에러 메시지" }

// 페이지네이션
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1, "limit": 20,
    "total": 100, "total_pages": 5
  }
}
```

### 10.2 HTTP 상태 코드별 처리
| 코드 | 처리 |
|------|------|
| 401 | 토큰 갱신 시도 → 실패 시 로그인 화면 |
| 403 | "권한이 없습니다" 토스트 |
| 404 | "찾을 수 없습니다" 안내 |
| 410 | 만료/비활성화 안내 (초대 링크 등) |
| 400 | 서버 메시지 표시 |
| 500 | "일시적 오류, 잠시 후 다시 시도해주세요" |

---

## 11. 보안 주의 사항

1. **JWT 저장**: `flutter_secure_storage` 필수 (SharedPreferences 금지)
2. **API 키 하드코딩 금지**: 환경 변수 또는 빌드 타임 주입
3. **WebView 결제 URL**: `https://the-meti.pages.dev` 도메인만 허용
4. **Apple 정책**: "웹에서 결제하기" 문구 직접 노출 금지
   → "이용권 구매", "콘텐츠 구매" 등 중립 표현 사용
5. **인증 토큰을 URL 파라미터에 포함 금지** (일회성 OTP 토큰 방식 사용)

---

## 12. 현재 구현 완료된 백엔드 API (앱에서 바로 사용 가능)

| 영역 | 상태 | 비고 |
|------|------|------|
| 인증 (JWT, 소셜, 리프레시) | ✅ 완료 | |
| 명함 CRUD + QR + 공개 페이지 | ✅ 완료 | `/card/:id` 웹 페이지 있음 |
| 그룹 CRUD + 멤버 + 초대 링크 | ✅ 완료 | `/invite/:token` 웹 페이지 있음 |
| 포인트 잔액/내역/이전 | ✅ 완료 | `/api/v1/points/*` |
| 행사 CRUD + 참가 | ✅ 완료 | |
| 레슨 CRUD + 수강 신청 | ✅ 완료 | |
| 상품·주문·결제 API | ✅ 완료 | PG 키 미설정 (Placeholder) |
| 강사 역할 지정 | ✅ 완료 | |
| NFC 실물카드 신청 | ✅ 완료 | |
| 어드민 유저/그룹/명함/포인트 | ✅ 완료 | 어드민 웹 전용 |

### 🔴 미구현 (Phase 2)
| 항목 | 비고 |
|------|------|
| 결제 페이지 `/payment` | PG 키 수령 후 구현 |
| Toss / Stripe 서버사이드 검증 | PG 키 수령 후 구현 |
| 포인트 만료 배치 처리 | Cloudflare Cron Trigger 예정 |
| 웹훅 (구독 상태 변경) | Phase 2 |
| 푸시 알림 (FCM/APNs) | Phase 2 |

---

## 13. 개발 시작 전 체크리스트

- [ ] `dio` + `flutter_secure_storage` + `riverpod` (또는 선택한 상태관리) 패키지 설치
- [ ] Base URL 환경변수 설정 (`dart-define` 또는 `.env`)
- [ ] Dio Interceptor: 401 자동 토큰 갱신 구현
- [ ] 딥링크 설정: `AndroidManifest.xml` Intent Filter + `Info.plist` URL Scheme
- [ ] Universal Link 설정: `apple-app-site-association` (백엔드에 추가 필요 시 요청)
- [ ] IAP 패키지 (`in_app_purchase`) 설정 + 제품 ID 등록
- [ ] NFC 패키지 설정 (iOS: `NFCReaderUsageDescription` / Android: `<uses-permission>`)

---

## 14. 백엔드 담당자 연락 필요 사항

앱 개발 중 아래 항목이 필요하면 백엔드 담당자에게 요청하세요:

1. **`apple-app-site-association` 파일** → 백엔드에서 `/.well-known/` 경로에 추가 필요
2. **FCM 서버 키** → 푸시 알림 구현 시 (Phase 2)
3. **Toss / Stripe 키 설정** → 결제 기능 활성화 시
4. **Apple IAP 서버-투-서버 알림 URL** 등록 (Phase 2)
5. **포인트 만료 배치 Cron 설정** → Cloudflare Workers Cron Trigger

---

*METI Native App Agent Prompt v2.8 — 2026-05-14*
