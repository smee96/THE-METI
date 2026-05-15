# METI 테스트 환경 가이드
> 네이티브 앱 에이전트 및 테스터 전달용  
> 작성일: 2026-05-15  
> 백엔드 기준: GitHub `smee96/THE-METI` / migration 0018

---

## 📌 환경 구성 개요

```
개발 흐름:
  코드 작성 → staging 테스트 → 통과 시 main 반영 (실서버)

환경 종류:
  로컬    localhost:3000          샌드박스 내부 (웹 에이전트 전용)
  staging staging.the-meti.pages.dev   ← 앱 에이전트 / Playwright 테스트용
  실서버  the-meti.pages.dev           ← 실제 서비스 (테스트 금지)
```

---

## 🌐 API Base URL

| 환경 | Base URL | DB | 용도 |
|------|----------|----|------|
| **로컬** | `https://3000-ihea8shyaufanzo0e9iq6-b237eb32.sandbox.novita.ai/api/v1` | 로컬 SQLite | 웹 에이전트 즉시 테스트 |
| **staging** | `https://staging.the-meti.pages.dev/api/v1` | D1 the-meti-staging | 앱 에이전트 / Playwright / 수동 테스트 |
| **실서버** | `https://the-meti.pages.dev/api/v1` | D1 the-meti-production | 실제 서비스 (⚠️ 테스트 금지) |

> ⚠️ **로컬 URL은 샌드박스 세션마다 변경됩니다.**  
> 앱 에이전트는 항상 **staging URL**을 사용하세요.

---

## 🔑 고정 테스트 계정

> staging DB에 영구 seed됨 — 절대 삭제하지 마세요

### 일반 유저 (free 플랜)
```
email:    test@meti.dev
password: MetiTest1234!
user_id:  9001
plan:     free
role:     user
이메일 인증: 완료
```

### Pro 유저
```
email:    pro@meti.dev
password: MetiTest1234!
user_id:  9003
plan:     pro
role:     user
이메일 인증: 완료
```

### 슈퍼 어드민
```
email:    admin@meti.dev
password: MetiAdmin1234!
user_id:  9002
plan:     business
role:     super_admin
이메일 인증: 완료
어드민 URL: https://staging.the-meti.pages.dev/admin
```

### 사전 생성된 테스트 데이터
```
명함:   테스트유저 명함 (id: 9001), 프로유저 명함 (id: 9002)
그룹:   테스트그룹 (id: 9001, status: active, public)
포인트: 테스트유저 지갑 50,000P / 테스트그룹 지갑 100,000P
```

---

## 🚀 로그인 API (회원가입 없이 바로 사용)

```http
POST https://staging.the-meti.pages.dev/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@meti.dev",
  "password": "MetiTest1234!"
}
```

응답:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "uuid-...",
    "token_type": "Bearer",
    "user": {
      "id": 9001,
      "email": "test@meti.dev",
      "name": "테스트유저",
      "plan": "free"
    }
  }
}
```

---

## 📱 Flutter 앱 에이전트 설정

### constants.dart (환경 분기)
```dart
class AppConfig {
  // 빌드 환경에 따라 분기
  static const bool isStaging = bool.fromEnvironment('STAGING', defaultValue: false);

  static const String baseUrl = isStaging
      ? 'https://staging.the-meti.pages.dev/api/v1'   // 테스트
      : 'https://the-meti.pages.dev/api/v1';            // 실서버
}
```

### 테스트 실행 시 (staging 강제 지정)
```bash
# Flutter run — staging 환경 지정
flutter run --dart-define=STAGING=true

# Flutter test
flutter test --dart-define=STAGING=true
```

### test_helpers.dart (자동 로그인 헬퍼)
```dart
class TestHelper {
  static const testUser = {
    'email': 'test@meti.dev',
    'password': 'MetiTest1234!',
  };
  static const proUser = {
    'email': 'pro@meti.dev',
    'password': 'MetiTest1234!',
  };
  static const adminUser = {
    'email': 'admin@meti.dev',
    'password': 'MetiAdmin1234!',
  };

  /// 테스트 시작 시 자동 로그인 — access_token 반환
  static Future<String> loginAsTestUser() async {
    final res = await dio.post('/auth/login', data: testUser);
    return res.data['data']['access_token'];
  }
}
```

---

## 🎭 Playwright 테스트 설정

### playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'https://staging.the-meti.pages.dev',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  projects: [
    { name: 'API Tests', testMatch: '**/*.api.spec.ts' },
    { name: 'Web Admin Tests', testMatch: '**/*.admin.spec.ts' },
  ],
});
```

### auth.setup.ts (전역 로그인 픽스처)
```typescript
import { test as setup } from '@playwright/test';
import { writeFileSync } from 'fs';

setup('로그인 토큰 취득', async ({ request }) => {
  const res = await request.post('/api/v1/auth/login', {
    data: {
      email: 'test@meti.dev',
      password: 'MetiTest1234!'
    }
  });
  const { data } = await res.json();
  
  // 전역 auth state 저장
  writeFileSync('playwright/.auth/token.json', JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  }));
});
```

### 테스트 예시 (cards.api.spec.ts)
```typescript
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('명함 API', () => {
  let token: string;

  test.beforeAll(() => {
    const auth = JSON.parse(readFileSync('playwright/.auth/token.json', 'utf-8'));
    token = auth.access_token;
  });

  test('내 명함 목록 조회', async ({ request }) => {
    const res = await request.get('/api/v1/cards', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0); // 테스트 명함 id:9001 존재
  });
});
```

---

## 🔄 개발 → 테스트 → 실서버 반영 흐름

```
1. 웹 에이전트 (이 세션)
   └── 코드 작성 / 수정
   └── npm run build → pm2 restart meti-local
   └── localhost:3000 로컬 빠른 확인

2. staging 반영
   └── git add . && git commit -m "feat: ..."
   └── git checkout staging && git merge main (또는 직접 작업)
   └── git push origin staging
   └── npm run build && wrangler pages deploy dist --project-name the-meti --branch staging
   └── https://staging.the-meti.pages.dev 에서 테스트

3. 앱 에이전트 / Playwright 테스트
   └── BASE_URL = https://staging.the-meti.pages.dev/api/v1
   └── test@meti.dev 계정으로 자동 로그인
   └── 시나리오 테스트 실행

4. 테스트 통과 시 실서버 반영
   └── git checkout main && git merge staging
   └── git push origin main
   └── npm run build && wrangler pages deploy dist --project-name the-meti
   └── https://the-meti.pages.dev 실서버 확인
```

---

## 🛠️ 웹 에이전트 전용 — 로컬 명령어 모음

```bash
# 로컬 서버 시작 (포트 3000)
cd /home/user/webapp && npm run build
pm2 start ecosystem.config.cjs --only meti-local

# 로컬 서버 재시작 (코드 수정 후)
cd /home/user/webapp && npm run build && pm2 restart meti-local

# staging 빌드·배포
cd /home/user/webapp && git checkout staging
npm run build
npx wrangler pages deploy dist --project-name the-meti --branch staging

# 실서버 배포
cd /home/user/webapp && git checkout main
npm run build
npx wrangler pages deploy dist --project-name the-meti

# 로컬 DB seed 재적용 (테스트 계정 복구)
npx wrangler d1 execute the-meti-production --local --file=./seed_test.sql

# staging DB seed 재적용
npx wrangler d1 execute the-meti-staging -e preview --remote --file=./seed_test.sql

# staging DB 마이그레이션 신규 적용
npx wrangler d1 migrations apply the-meti-staging -e preview --remote
```

---

## ⚠️ 주의사항

| 항목 | 내용 |
|------|------|
| 로컬 URL 변경 | 샌드박스 재시작마다 URL 변경 → 앱 에이전트는 staging 고정 사용 |
| seed 데이터 보호 | id 9001~9003 유저/명함/그룹 절대 삭제 금지 |
| 실서버 테스트 금지 | `the-meti.pages.dev`는 테스트 데이터 넣지 말 것 |
| staging 초기화 방법 | D1 콘솔에서 테이블 초기화 후 seed_test.sql 재실행 |
| JWT_SECRET | staging/실서버 모두 동일한 secret 사용 (Cloudflare secret 설정 필요) |

---

## 🔐 Cloudflare staging Secret 설정 (웹 에이전트 실행)

```bash
# staging 브랜치용 JWT_SECRET 설정 (실서버와 동일 값 권장)
npx wrangler pages secret put JWT_SECRET --project-name the-meti --env preview
```

---

*본 문서는 METI 테스트 환경 구성 완료 기준으로 작성되었습니다.*  
*staging DB ID: `5ebff506-d8a7-44dd-91ff-6dc805df4511`*  
*GitHub: https://github.com/smee96/THE-METI*
