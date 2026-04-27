import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings, Variables } from './types'

// Routes
import authRoutes from './routes/auth'
import cardsRoutes from './routes/cards'
import groupsRoutes from './routes/groups'
import eventsRoutes from './routes/events'
import chatRoutes from './routes/chat'
import partnerRoutes from './routes/partner'
import adminRoutes from './routes/admin'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 글로벌 미들웨어 ───────────────────────────────────
app.use('*', logger())
app.use('/api/*', cors({
  origin: ['https://meti.io', 'https://admin.meti.io', 'http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Partner-API-Key'],
  exposeHeaders: ['X-Total-Count'],
  maxAge: 86400,
  credentials: true
}))

// ── 정적 파일 ─────────────────────────────────────────
app.use('/static/*', serveStatic({ root: './public' }))

// ── API 라우트 (v1) ───────────────────────────────────
app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/cards', cardsRoutes)
app.route('/api/v1/groups', groupsRoutes)
app.route('/api/v1/events', eventsRoutes)
app.route('/api/v1/chat', chatRoutes)
app.route('/api/v1/partner', partnerRoutes)
app.route('/api/v1/admin', adminRoutes)

// ── 헬스체크 ──────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', service: 'METI Backend', version: '1.0.0' }))

// ── Admin Web UI ──────────────────────────────────────
app.get('/admin', (c) => {
  return c.html(adminLoginHtml())
})

app.get('/admin/*', (c) => {
  return c.html(adminAppHtml())
})

// ── 명함 공개 페이지 (앱 미설치자용) ─────────────────
app.get('/card/:id', (c) => {
  const cardId = c.req.param('id')
  return c.html(cardPublicHtml(cardId))
})

// ── API 404 ──────────────────────────────────────────
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '요청한 엔드포인트를 찾을 수 없습니다.' }, 404)
  }
  return c.html('<h1>Not Found</h1>', 404)
})

// ── 글로벌 에러 핸들러 ───────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '서버 오류가 발생했습니다.' }, 500)
  }
  return c.html('<h1>Internal Server Error</h1>', 500)
})

export default app

// ── HTML 템플릿 ───────────────────────────────────────
function adminLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
</head>
<body class="bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
        <i class="fas fa-id-card text-white text-2xl"></i>
      </div>
      <h1 class="text-3xl font-bold text-white">METI Admin</h1>
      <p class="text-slate-400 mt-2">디지털명함 플랫폼 관리자</p>
    </div>
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-6">로그인</h2>
      <div id="error-msg" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input type="email" id="email" placeholder="admin@meti.io"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input type="password" id="password" placeholder="••••••••"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" id="login-btn"
          class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
          <span id="btn-text">로그인</span>
          <span id="btn-loading" class="hidden"><i class="fas fa-spinner fa-spin mr-2"></i>로그인 중...</span>
        </button>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const btnText = document.getElementById('btn-text');
      const btnLoading = document.getElementById('btn-loading');
      const errorMsg = document.getElementById('error-msg');

      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');
      errorMsg.classList.add('hidden');

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('meti_admin_token', data.data.access_token);
          localStorage.setItem('meti_admin_user', JSON.stringify(data.data.user));
          window.location.href = '/admin/dashboard';
        } else {
          errorMsg.textContent = data.error || '로그인에 실패했습니다.';
          errorMsg.classList.remove('hidden');
        }
      } catch (err) {
        errorMsg.textContent = '서버 연결에 실패했습니다.';
        errorMsg.classList.remove('hidden');
      } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
      }
    });
  </script>
</body>
</html>`
}

function adminAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI Admin Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    .sidebar-link.active { background: #1d4ed8; color: white; }
    .sidebar-link { @apply flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors; }
    [x-cloak] { display: none; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div id="app">
    <!-- 인증 체크 중 -->
    <div id="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-blue-600 text-3xl mb-4"></i>
        <p class="text-gray-600">로딩 중...</p>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`
}

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
      <img src="/static/logo.svg" alt="METI" class="h-8 mx-auto mb-2" onerror="this.style.display='none'">
      <p class="text-sm text-gray-500">디지털 명함</p>
    </div>
    <div id="card-loading" class="bg-white rounded-3xl shadow-2xl p-8 text-center">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mb-3"></i>
      <p class="text-gray-500">명함 불러오는 중...</p>
    </div>
    <div id="card-content" class="hidden bg-white rounded-3xl shadow-2xl overflow-hidden">
      <div id="card-header" class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
        <div id="avatar-area" class="mb-3"></div>
        <h1 id="card-name" class="text-2xl font-bold"></h1>
        <p id="card-title" class="text-blue-200 mt-1"></p>
        <p id="card-company" class="text-blue-100 text-sm mt-1"></p>
      </div>
      <div class="p-6 space-y-3">
        <div id="card-email" class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-envelope text-blue-500 w-5"></i>
          <span id="email-val"></span>
        </div>
        <div id="card-phone" class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-phone text-blue-500 w-5"></i>
          <span id="phone-val"></span>
        </div>
        <div id="card-website" class="hidden flex items-center gap-3 text-gray-700">
          <i class="fas fa-globe text-blue-500 w-5"></i>
          <a id="website-val" class="text-blue-600 hover:underline"></a>
        </div>
        <div id="card-bio" class="hidden pt-2 border-t text-gray-600 text-sm"></div>
        <div id="sns-links" class="flex gap-3 pt-2"></div>
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
    const cardId = '${cardId}';
    fetch('/api/v1/cards/public/' + cardId)
      .then(r => r.json())
      .then(data => {
        document.getElementById('card-loading').classList.add('hidden');
        if (!data.success) {
          document.getElementById('card-error').classList.remove('hidden');
          return;
        }
        const card = data.data;
        document.getElementById('card-content').classList.remove('hidden');
        document.getElementById('card-name').textContent = card.name;
        if (card.title) document.getElementById('card-title').textContent = card.title;
        if (card.company) document.getElementById('card-company').textContent = card.company;
        if (card.email) {
          document.getElementById('card-email').classList.remove('hidden');
          document.getElementById('email-val').textContent = card.email;
        }
        if (card.phone) {
          document.getElementById('card-phone').classList.remove('hidden');
          document.getElementById('phone-val').textContent = card.phone;
        }
        if (card.website) {
          document.getElementById('card-website').classList.remove('hidden');
          const a = document.getElementById('website-val');
          a.textContent = card.website; a.href = card.website;
        }
        if (card.bio) {
          document.getElementById('card-bio').classList.remove('hidden');
          document.getElementById('card-bio').textContent = card.bio;
        }
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
