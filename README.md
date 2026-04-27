# METI Backend - 디지털명함 플랫폼

## 프로젝트 개요
METI는 디지털 명함 기반의 종합 네트워킹 플랫폼입니다.
NFC 명함 교환, 그룹 운영, 채팅, 리크루팅, 행사 관리, 리워드 시스템을 통합 제공합니다.

## 기술 스택
- **Runtime**: Cloudflare Workers (Edge)
- **Framework**: Hono v4 (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (파일/이미지)
- **Auth**: JWT (이메일 전용)
- **Build**: Vite + @hono/vite-cloudflare-pages

## 주요 기능

### ✅ 완료된 기능
- 사용자 인증 (회원가입, 이메일 인증, 로그인, JWT Refresh)
- 디지털 명함 CRUD + SNS 링크 + 태그
- QR 토큰 생성 및 명함 공유
- 명함첩 (수신 명함 관리)
- 그룹 개설 신청 / 멤버 관리 / 공지사항
- 행사 생성 / 참가 신청 / QR 입장 처리
- 채팅 (1:1, 그룹) + 메시지 만료 정책
- 파트너 서비스 연동 API (리워드 지급)
- Admin Web UI (대시보드, 유저/그룹/신고 관리)

### 🔲 향후 개발 예정
- 리크루팅 API (구직 프로필, 채용공고, 헤드헌터)
- NFC 실물카드 신청/발급 워크플로우
- 이메일 발송 서비스 연동
- 결제 연동 (PG사 추후 확정)
- 푸시 알림
- Native App (별도 에이전트)

## API 엔드포인트 (v1)

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/v1/auth/register | 회원가입 |
| POST | /api/v1/auth/verify-email | 이메일 인증 |
| POST | /api/v1/auth/login | 로그인 |
| POST | /api/v1/auth/refresh | 토큰 갱신 |
| POST | /api/v1/auth/logout | 로그아웃 |
| POST | /api/v1/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/v1/auth/reset-password | 비밀번호 재설정 |
| GET  | /api/v1/auth/me | 내 정보 |

### 명함
| Method | Path | 설명 |
|--------|------|------|
| GET  | /api/v1/cards | 내 명함 목록 |
| POST | /api/v1/cards | 명함 생성 |
| GET  | /api/v1/cards/public/:id | 공개 명함 조회 |
| GET  | /api/v1/cards/:id | 명함 상세 |
| PATCH | /api/v1/cards/:id | 명함 수정 |
| DELETE | /api/v1/cards/:id | 명함 삭제 |
| POST | /api/v1/cards/:id/qr-token | QR 토큰 생성 |
| GET  | /api/v1/cards/qr/:token | QR로 명함 조회 |
| POST | /api/v1/cards/:id/save | 명함첩 저장 |
| GET  | /api/v1/cards/contacts/list | 명함첩 목록 |

### 그룹
| Method | Path | 설명 |
|--------|------|------|
| GET  | /api/v1/groups | 그룹 목록 |
| POST | /api/v1/groups | 그룹 개설 신청 |
| GET  | /api/v1/groups/:id | 그룹 상세 |
| POST | /api/v1/groups/:id/join | 가입 신청 |
| DELETE | /api/v1/groups/:id/leave | 탈퇴 |
| GET  | /api/v1/groups/:id/members | 멤버 목록 |
| PATCH | /api/v1/groups/:id/members/:userId | 멤버 승인/거절/강퇴 |
| GET  | /api/v1/groups/:id/notices | 공지사항 목록 |
| POST | /api/v1/groups/:id/notices | 공지사항 작성 |
| POST | /api/v1/groups/:id/transfer-admin | 관리자 권한 이임 |

### 행사
| Method | Path | 설명 |
|--------|------|------|
| GET  | /api/v1/events | 행사 목록 |
| POST | /api/v1/events | 행사 생성 |
| GET  | /api/v1/events/:id | 행사 상세 |
| POST | /api/v1/events/:id/join | 참가 신청 |
| POST | /api/v1/events/:id/checkin | 입장 처리 (QR/수동) |
| GET  | /api/v1/events/:id/participants | 참가자 목록 |

### 채팅
| Method | Path | 설명 |
|--------|------|------|
| GET  | /api/v1/chat | 채팅방 목록 |
| POST | /api/v1/chat/direct | 1:1 채팅방 시작 |
| GET  | /api/v1/chat/:roomId/messages | 메시지 목록 |
| POST | /api/v1/chat/:roomId/messages | 메시지 전송 |
| DELETE | /api/v1/chat/:roomId/messages/:msgId | 메시지 삭제 |
| POST | /api/v1/chat/report | 신고 |
| POST | /api/v1/chat/block | 차단 |

### 파트너 API (서버간 통신)
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/v1/partner/user-map | 유저 매핑 키 발급 |
| POST | /api/v1/partner/reward | 리워드 지급 |
| GET  | /api/v1/partner/user-balance | 리워드 잔액 조회 |

### Admin API
| Method | Path | 설명 |
|--------|------|------|
| GET  | /api/v1/admin/dashboard | 대시보드 통계 |
| GET/PATCH | /api/v1/admin/users | 유저 관리 |
| GET/PATCH | /api/v1/admin/groups | 그룹 승인/관리 |
| GET/PATCH | /api/v1/admin/reports | 신고 처리 |
| GET/POST | /api/v1/admin/partners | 파트너 서비스 관리 |
| GET  | /api/v1/admin/rewards | 리워드 내역 |
| GET/PATCH | /api/v1/admin/nfc-cards | NFC 카드 관리 |

## 페이지 URL
| URL | 설명 |
|-----|------|
| `/admin` | Admin 로그인 |
| `/admin/dashboard` | Admin 대시보드 |
| `/card/:id` | 공개 명함 페이지 (앱 미설치자용) |
| `/health` | 헬스체크 |

## DB 구조 (8개 마이그레이션)
1. **users_auth** - 유저, 이메일 인증, Refresh Token
2. **cards** - 명함, SNS링크, 태그, 명함첩, QR토큰, NFC실물카드
3. **groups** - 그룹, 멤버, 권한이임, 공지사항
4. **events** - 행사, 참가자, 입장로그
5. **chat** - 채팅방, 메시지, 읽음처리, 차단, 신고
6. **recruiting** - 구직프로필, 채용공고, 헤드헌터, 크레딧
7. **rewards_partner** - 리워드, 파트너서비스, 유저매핑, 알림
8. **plans_billing** - 요금제, 구독, 결제내역

## 개발 환경 실행
```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 로컬 DB 마이그레이션
npm run db:migrate:local

# 서버 실행 (PM2)
pm2 start ecosystem.config.cjs

# 테스트
curl http://localhost:3000/health
```

## 배포
```bash
# Cloudflare Pages 배포
npm run deploy
```

## 배포 상태
- **Platform**: Cloudflare Pages
- **Status**: 🔧 개발 중
- **Last Updated**: 2026-04-27
