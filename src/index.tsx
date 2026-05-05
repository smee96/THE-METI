import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings, Variables } from './types'

// Routes
import authRoutes    from './routes/auth'
import cardsRoutes   from './routes/cards'
import groupsRoutes  from './routes/groups'
import eventsRoutes  from './routes/events'
import chatRoutes    from './routes/chat'
import partnerRoutes from './routes/partner'
import adminRoutes   from './routes/admin'
import lessonsRoutes from './routes/lessons'

// Web UI HTML 템플릿
import { adminLoginHtml, adminAppHtml }               from './web/admin'
import { appLoginHtml, appRegisterHtml, appShellHtml } from './web/app'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ════════════════════════════════════════════════════════════
// ── 명함 공개 페이지 HTML (함수 먼저 선언)
// ════════════════════════════════════════════════════════════
function cardPublicHtml(cardId: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI 디지털 명함</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <meta property="og:title" content="METI 디지털 명함">
  <meta property="og:description" content="QR 코드로 명함을 교환하세요">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
  <div id="card-container" class="w-full max-w-sm">
    <div class="text-center mb-6">
      <p class="text-sm text-gray-500 font-semibold tracking-widest">METI</p>
    </div>
    <div id="card-loading" class="bg-white rounded-3xl shadow-2xl p-8 text-center">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mb-3"></i>
      <p class="text-gray-500">명함 불러오는 중...</p>
    </div>
    <div id="card-content" class="hidden bg-white rounded-3xl shadow-2xl overflow-hidden">
      <div id="card-header" class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
        <h1 id="card-name"    class="text-2xl font-bold"></h1>
        <p  id="card-title"   class="text-blue-200 mt-1"></p>
        <p  id="card-company" class="text-blue-100 text-sm mt-1"></p>
      </div>
      <div class="p-6 space-y-3">
        <div id="card-email"   class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-envelope text-blue-500 w-5"></i>
          <span id="email-val"></span>
        </div>
        <div id="card-phone"   class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-phone text-blue-500 w-5"></i>
          <span id="phone-val"></span>
        </div>
        <div id="card-website" class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-globe text-blue-500 w-5"></i>
          <a id="website-val" class="text-blue-600 hover:underline"></a>
        </div>
        <div id="card-bio" class="hidden pt-2 border-t text-gray-600 text-sm"></div>
      </div>
      <div class="px-6 pb-6">
        <a href="https://meti.io" target="_blank"
          class="block w-full py-3 bg-blue-600 text-white text-center rounded-xl font-semibold hover:bg-blue-700 transition">
          <i class="fas fa-id-card mr-2"></i>METI로 명함 교환하기
        </a>
      </div>
    </div>
    <div id="card-error" class="hidden bg-white rounded-3xl shadow-2xl p-8 text-center">
      <i class="fas fa-exclamation-circle text-red-400 text-3xl mb-3"></i>
      <p class="text-gray-600">명함을 찾을 수 없습니다.</p>
    </div>
  </div>
  <script>
    fetch('/api/v1/cards/public/${cardId}')
      .then(r => r.json())
      .then(data => {
        document.getElementById('card-loading').classList.add('hidden');
        if (!data.success) { document.getElementById('card-error').classList.remove('hidden'); return; }
        const card = data.data;
        document.getElementById('card-content').classList.remove('hidden');
        document.getElementById('card-name').textContent    = card.name    || '';
        document.getElementById('card-title').textContent   = card.title   || '';
        document.getElementById('card-company').textContent = card.company || '';
        if (card.email)   { document.getElementById('card-email').classList.remove('hidden');   document.getElementById('email-val').textContent  = card.email; }
        if (card.phone)   { document.getElementById('card-phone').classList.remove('hidden');   document.getElementById('phone-val').textContent  = card.phone; }
        if (card.website) { document.getElementById('card-website').classList.remove('hidden'); const a = document.getElementById('website-val'); a.textContent = card.website; a.href = card.website; }
        if (card.bio)     { document.getElementById('card-bio').classList.remove('hidden');     document.getElementById('card-bio').textContent   = card.bio; }
        document.title = card.name + ' - METI 디지털 명함';
      })
      .catch(() => {
        document.getElementById('card-loading').classList.add('hidden');
        document.getElementById('card-error').classList.remove('hidden');
      });
  </script>
</body>
</html>`
}

// ── 글로벌 미들웨어 ───────────────────────────────────────
app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'https://meti.io',
    'https://admin.meti.io',
    'https://my.meti.io',
    'https://the-meti.pages.dev',
    'https://www.the-meti.pages.dev',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Partner-API-Key'],
  exposeHeaders: ['X-Total-Count'],
  maxAge: 86400,
  credentials: true,
}))

// ── 정적 파일 ─────────────────────────────────────────────
app.use('/static/*', serveStatic({ root: './public' }))

// ── API 라우트 (v1) ───────────────────────────────────────
app.route('/api/v1/auth',    authRoutes)
app.route('/api/v1/cards',   cardsRoutes)
app.route('/api/v1/groups',  groupsRoutes)
app.route('/api/v1/events',  eventsRoutes)
app.route('/api/v1/chat',    chatRoutes)
app.route('/api/v1/partner', partnerRoutes)
app.route('/api/v1/admin',   adminRoutes)
app.route('/api/v1/lessons', lessonsRoutes)

// ── 헬스체크 ──────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'METI Backend', version: '1.0.0' })
)

// ════════════════════════════════════════════════════════════
// ── Admin Web UI  (/admin)
// ════════════════════════════════════════════════════════════
app.get('/admin', (c) => c.html(adminLoginHtml()))
app.get('/admin/*', (c) => c.html(adminAppHtml()))

// ════════════════════════════════════════════════════════════
// ── App Web UI  (/app)
//    사용자 + 그룹관리자 웹
//
//  /app/login          로그인 (공통 진입점)
//  /app/register       회원가입
//  /app/dashboard      개인 대시보드
//  /app/cards          내 명함 관리
//  /app/groups         내 그룹 목록 (소속 전체)
//  /app/points         개인 포인트
//  /app/subscription   구독 현황
//  /app/group/:id/*    그룹 관리 (group_admin 전용)
//    └─ /app/group/:id/dashboard
//    └─ /app/group/:id/members
//    └─ /app/group/:id/events
//    └─ /app/group/:id/points
//    └─ /app/group/:id/lessons
//    └─ /app/group/:id/invites
// ════════════════════════════════════════════════════════════

// 로그인 / 회원가입 (인증 불필요)
app.get('/app/login',    (c) => c.html(appLoginHtml()))
app.get('/app/register', (c) => c.html(appRegisterHtml()))

// 루트 → /app/login 으로 리다이렉트
app.get('/', (c) => c.redirect('/app/login'))

// /app 루트 → 로그인으로 리다이렉트
app.get('/app', (c) => c.redirect('/app/login'))

// 나머지 /app/* 전체 → SPA shell (JS가 라우팅 처리)
app.get('/app/*', (c) => c.html(appShellHtml('METI')))

// ════════════════════════════════════════════════════════════
// ── 명함 공개 페이지 (앱 미설치자용)
// ════════════════════════════════════════════════════════════
app.get('/card/:id', (c) => {
  const cardId = c.req.param('id')
  return c.html(cardPublicHtml(cardId))
})

// ── API 404 ───────────────────────────────────────────────
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '요청한 엔드포인트를 찾을 수 없습니다.' }, 404)
  }
  return c.html('<h1>Not Found</h1>', 404)
})

// ── 글로벌 에러 핸들러 ────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '서버 오류가 발생했습니다.' }, 500)
  }
  return c.html('<h1>Internal Server Error</h1>', 500)
})

export default app
