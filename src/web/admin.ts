// ── Admin Web UI HTML 템플릿 ──────────────────────────

export function adminLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'0.75rem','sm':'0.8125rem','base':'0.875rem','lg':'1rem','xl':'1.125rem','2xl':'1.25rem','3xl':'1.5rem' } } } }</script>
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

export function adminAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI Admin Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'0.75rem','sm':'0.8125rem','base':'0.875rem','lg':'1rem','xl':'1.125rem','2xl':'1.25rem','3xl':'1.5rem' } } } }</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    html, body { font-size: 14px !important; }
    .sidebar-link.active { background: #1d4ed8; color: white; }
    .sidebar-link { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; border-radius:0.5rem; color:#cbd5e1; cursor:pointer; transition:background 0.15s; }
    .sidebar-link:hover { background: #334155; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div id="app">
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
