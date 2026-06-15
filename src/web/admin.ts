// ── Admin Web UI HTML 템플릿 ──────────────────────────

export function adminLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI Admin</title>
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    :root {
      --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
      --gold:#C9A86A; --gold-admin:#C2974E; --gold-soft:rgba(194,151,78,0.16);
      --bg:#F4F5F8; --surface:#FFFFFF; --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
      --line:rgba(14,23,38,0.08);
      --danger:#D8513C; --danger-soft:rgba(216,81,60,0.10);
      --r-md:14px; --r-lg:18px; --r-card:22px;
      --font:Pretendard,-apple-system,system-ui,sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:var(--font);
      background:radial-gradient(130% 130% at 78% -10%,var(--navy-glow) 0%,var(--navy) 42%,var(--navy-deep) 100%);
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      padding:24px 20px;
      padding-left:max(20px, env(safe-area-inset-left, 20px));
      padding-right:max(20px, env(safe-area-inset-right, 20px));
    }
    .wrap{width:100%;max-width:380px}
    .wordmark{font-size:26px;font-weight:800;letter-spacing:0.2em;color:#fff;text-align:center;margin-bottom:6px}
    .wordmark .i{color:var(--gold)}
    .tagline{text-align:center;color:rgba(255,255,255,0.42);font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:28px}
    .card{background:var(--surface);border-radius:var(--r-card);padding:32px;box-shadow:0 2px 4px rgba(6,18,42,.28),0 18px 40px -12px rgba(6,18,42,.58)}
    @media(max-width:420px){.card{padding:28px 24px}}
    label{display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:6px;letter-spacing:0.04em}
    input{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:var(--r-md);font-family:var(--font);font-size:15px;color:var(--ink);background:var(--bg);outline:none;transition:border-color 0.15s}
    input:focus{border-color:var(--navy);background:#fff}
    .field{margin-bottom:16px}
    .btn{width:100%;padding:14px;background:var(--navy);color:#fff;border:none;border-radius:var(--r-md);font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;margin-top:4px;transition:opacity 0.15s}
    .btn:hover{opacity:0.88}
    .btn:disabled{opacity:0.55;cursor:not-allowed}
    #err{display:none;background:var(--danger-soft);border:1px solid rgba(216,81,60,.22);color:#B5402E;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="wordmark">MET<span class="i">I</span></div>
    <p class="tagline">Admin Dashboard</p>
    <div class="card">
      <div id="err"></div>
      <form id="frm">
        <div class="field">
          <label for="email">이메일</label>
          <input type="email" id="email" placeholder="admin@meti.io" autocomplete="email">
        </div>
        <div class="field">
          <label for="pw">비밀번호</label>
          <input type="password" id="pw" placeholder="••••••••" autocomplete="current-password">
        </div>
        <button class="btn" id="btn" type="submit">로그인</button>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('frm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const err = document.getElementById('err');
      btn.textContent = '로그인 중…'; btn.disabled = true; err.style.display = 'none';
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('pw').value })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('meti_token', data.data.access_token);
          localStorage.setItem('meti_user', JSON.stringify(data.data.user));
          window.location.href = '/admin/dashboard';
        } else {
          err.textContent = data.error || '로그인에 실패했습니다.'; err.style.display = 'block';
        }
      } catch { err.textContent = '서버 연결에 실패했습니다.'; err.style.display = 'block'; }
      finally { btn.textContent = '로그인'; btn.disabled = false; }
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
  <title>METI Admin</title>
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* ── METI Design Tokens ───────────────────────────────── */
    :root {
      --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
      --gold:#C9A86A; --gold-admin:#C2974E; --gold-soft:rgba(194,151,78,0.14);
      --bg:#F4F5F8; --surface:#FFFFFF; --surface-2:#F7F8FA;
      --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
      --line:rgba(14,23,38,0.08); --line-2:rgba(14,23,38,0.05);
      --success:#1B9C73; --success-soft:rgba(27,156,115,0.12);
      --danger:#D8513C;  --danger-soft:rgba(216,81,60,0.12);
      --warn:#C98A1E;    --warn-soft:rgba(201,138,30,0.13);
      --info:#3470C4;    --info-soft:rgba(52,112,196,0.12);
      --r-sm:8px; --r-md:14px; --r-lg:18px; --r-card:22px; --r-pill:9999px;
      --shadow-card:0 1px 2px rgba(14,23,38,.04),0 8px 24px rgba(14,23,38,.06);
      --font:Pretendard,-apple-system,system-ui,sans-serif;
    }

    /* ── Base ─────────────────────────────────────────────── */
    html,body { font-family:var(--font) !important; background:var(--bg) !important; }

    /* ── Sidebar nav links ─────────────────────────────────── */
    .sidebar-link {
      display:flex; align-items:center; gap:10px;
      padding:9px 12px; border-radius:10px;
      color:rgba(255,255,255,0.50); cursor:pointer;
      transition:all 0.15s; font-size:13px; font-weight:500;
      width:100%; border:none; background:transparent; text-align:left; font-family:var(--font);
    }
    .sidebar-link:hover { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.88); }
    .sidebar-link.active { background:var(--gold-soft); color:var(--gold-admin); font-weight:700; }
    .sidebar-link i { width:14px; text-align:center; font-size:13px; flex-shrink:0; }

    /* ── Shared surface card ───────────────────────────────── */
    .meti-card {
      background:var(--surface); border-radius:var(--r-lg);
      box-shadow:var(--shadow-card); border:1px solid var(--line-2);
    }

    /* ── Badge ─────────────────────────────────────────────── */
    .meti-badge {
      display:inline-flex; align-items:center; gap:5px;
      font-size:12px; font-weight:700; padding:3px 9px; border-radius:var(--r-pill);
    }

    /* ── 콘텐츠 영역 Tailwind → METI 토큰 오버라이드 ──────── */
    /* 파란색 → 네이비 */
    #page-content .bg-blue-600,
    #page-content .bg-blue-700              { background-color:var(--navy)           !important; }
    #page-content .hover\\:bg-blue-700:hover,
    #page-content .hover\\:bg-blue-600:hover { background-color:var(--navy-deep)      !important; }
    #page-content .text-blue-600,
    #page-content .text-blue-700            { color:var(--navy)                      !important; }
    #page-content .hover\\:text-blue-700:hover { color:var(--navy-deep)              !important; }
    #page-content .border-blue-200          { border-color:rgba(11,30,64,0.18)       !important; }
    #page-content .border-blue-400,
    #page-content .border-blue-500,
    #page-content .border-blue-600          { border-color:var(--navy)               !important; }
    #page-content .bg-blue-50               { background-color:rgba(11,30,64,0.04)   !important; }
    #page-content .bg-blue-100              { background-color:rgba(11,30,64,0.07)   !important; }
    #page-content .hover\\:bg-blue-50:hover  { background-color:rgba(11,30,64,0.04)  !important; }
    #page-content .hover\\:bg-blue-100:hover { background-color:rgba(11,30,64,0.07)  !important; }
    #page-content .focus\\:ring-blue-400:focus,
    #page-content .focus\\:ring-blue-500:focus { --tw-ring-color:rgba(11,30,64,.22)  !important; }

    /* 회색 → METI 서피스/잉크 */
    #page-content .text-gray-900            { color:var(--ink)                       !important; }
    #page-content .text-gray-800            { color:var(--ink)                       !important; }
    #page-content .text-gray-700            { color:var(--sub)                       !important; }
    #page-content .text-gray-600            { color:var(--sub)                       !important; }
    #page-content .text-gray-500            { color:var(--sub)                       !important; }
    #page-content .text-gray-400            { color:var(--mute)                      !important; }
    #page-content .bg-gray-50               { background-color:var(--surface-2)      !important; }
    #page-content .bg-gray-100              { background-color:rgba(14,23,38,0.05)   !important; }
    #page-content .border-gray-100          { border-color:var(--line-2)             !important; }
    #page-content .border-gray-200          { border-color:var(--line)               !important; }
    #page-content .border-gray-300          { border-color:rgba(14,23,38,0.16)       !important; }
    #page-content .divide-gray-100>*+*      { border-color:var(--line-2)             !important; }
    #page-content .divide-gray-200>*+*      { border-color:var(--line)               !important; }
    #page-content .hover\\:bg-gray-50:hover  { background-color:var(--surface-2)     !important; }
    #page-content .hover\\:bg-gray-100:hover { background-color:rgba(14,23,38,0.05)  !important; }

    /* 모듈 공용 input → METI 포커스 */
    #page-content input[type="text"]:focus,
    #page-content input[type="number"]:focus,
    #page-content input[type="email"]:focus,
    #page-content input[type="date"]:focus,
    #page-content input[type="datetime-local"]:focus,
    #page-content textarea:focus,
    #page-content select:focus {
      border-color:var(--navy) !important;
      box-shadow:0 0 0 2px rgba(11,30,64,0.12) !important;
      outline:none !important;
    }

    /* ── Table defaults ────────────────────────────────────── */
    .meti-table { width:100%; border-collapse:collapse; font-size:13.5px; }
    .meti-table th {
      font-weight:700; color:var(--mute); font-size:11.5px; letter-spacing:0.05em;
      padding:10px 12px; text-align:left;
      border-bottom:1px solid var(--line); background:var(--surface-2);
    }
    .meti-table td { padding:11px 12px; border-bottom:1px solid var(--line-2); color:var(--ink); vertical-align:middle; }
    .meti-table tbody tr:hover td { background:var(--surface-2); }
  </style>
</head>
<body>
  <div id="app">
    <div id="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-3xl mb-4" style="color:var(--navy)"></i>
        <p style="color:var(--sub);font-size:14px;font-family:var(--font)">로딩 중…</p>
      </div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="/static/admin.js?v=20260614"></script>
  <script src="/static/admin-users.js?v=20260614"></script>
  <script src="/static/admin-events.js?v=20260614"></script>
  <script src="/static/admin-plans.js?v=20260614"></script>
  <script src="/static/admin-lessons.js?v=20260614"></script>
  <script src="/static/admin-nfc.js?v=20260614"></script>
  <script src="/static/admin-reports.js?v=20260614"></script>
  <script src="/static/admin-groups.js?v=20260614"></script>
  <script src="/static/admin-orders.js?v=20260614"></script>
  <script src="/static/admin-partner.js?v=20260614"></script>
</body>
</html>`
}
