// ── App Web UI HTML 템플릿 (사용자 / 그룹관리자) ──────

export function appLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI - 로그인</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'11px','sm':'12px','base':'13px','lg':'14px','xl':'15px','2xl':'16px','3xl':'18px' } } } }</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-md px-4">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
        <i class="fas fa-id-card text-white text-2xl"></i>
      </div>
      <h1 class="text-xl font-bold text-gray-800">METI</h1>
      <p class="text-gray-500 mt-2">디지털 명함 플랫폼</p>
    </div>
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-6">로그인</h2>
      <div id="error-msg" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input type="email" id="email" placeholder="example@meti.io"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input type="password" id="password" placeholder="••••••••"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
        </div>
        <button type="submit"
          class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
          <span id="btn-text">로그인</span>
          <span id="btn-loading" class="hidden"><i class="fas fa-spinner fa-spin mr-2"></i>로그인 중...</span>
        </button>
      </form>
      <div class="mt-4 text-center">
        <a href="/app/forgot-password" class="text-sm text-blue-600 hover:underline">비밀번호를 잊으셨나요?</a>
      </div>
      <div class="mt-6 pt-6 border-t text-center text-sm text-gray-500">
        아직 계정이 없으신가요?
        <a href="/app/register" class="text-blue-600 font-medium hover:underline ml-1">회원가입</a>
      </div>
    </div>
  </div>
  <script>
    // 이미 로그인된 경우 리다이렉트
    (function() {
      const token = localStorage.getItem('meti_token');
      if (token) window.location.href = '/app/dashboard';
    })();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btnText    = document.getElementById('btn-text');
      const btnLoading = document.getElementById('btn-loading');
      const errorMsg   = document.getElementById('error-msg');

      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');
      errorMsg.classList.add('hidden');

      try {
        const res  = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('meti_token',        data.data.access_token);
          localStorage.setItem('meti_refresh_token', data.data.refresh_token);
          localStorage.setItem('meti_user',          JSON.stringify(data.data.user));

          // 역할별 분기
          const role = data.data.user.role;
          if (role === 'super_admin') {
            window.location.href = '/admin/dashboard';
          } else {
            window.location.href = '/app/dashboard';
          }
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

export function appRegisterHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI - 회원가입</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'11px','sm':'12px','base':'13px','lg':'14px','xl':'15px','2xl':'16px','3xl':'18px' } } } }</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center py-10">
  <div class="w-full max-w-md px-4">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
        <i class="fas fa-id-card text-white text-2xl"></i>
      </div>
      <h1 class="text-xl font-bold text-gray-800">METI</h1>
      <p class="text-gray-500 mt-2">디지털 명함 플랫폼</p>
    </div>
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-6">회원가입</h2>
      <div id="error-msg" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
      <div id="success-msg" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
      <form id="register-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input type="text" id="name" placeholder="홍길동"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input type="email" id="email" placeholder="example@meti.io"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input type="password" id="password" placeholder="8자 이상"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>

        <button type="submit"
          class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
          <span id="btn-text">가입하기</span>
          <span id="btn-loading" class="hidden"><i class="fas fa-spinner fa-spin mr-2"></i>처리 중...</span>
        </button>
      </form>
      <div class="mt-6 pt-6 border-t text-center text-sm text-gray-500">
        이미 계정이 있으신가요?
        <a href="/app/login" class="text-blue-600 font-medium hover:underline ml-1">로그인</a>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnText    = document.getElementById('btn-text');
      const btnLoading = document.getElementById('btn-loading');
      const errorMsg   = document.getElementById('error-msg');
      const successMsg = document.getElementById('success-msg');

      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');
      errorMsg.classList.add('hidden');
      successMsg.classList.add('hidden');

      try {
        const res  = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         document.getElementById('name').value.trim(),
            email:        document.getElementById('email').value.trim(),
            password:     document.getElementById('password').value,
            account_type: 'personal'
          })
        });
        const data = await res.json();

        if (data.success) {
          successMsg.textContent = '가입이 완료되었습니다. 이메일을 확인해 주세요.';
          successMsg.classList.remove('hidden');
          document.getElementById('register-form').reset();
          setTimeout(() => { window.location.href = '/app/login'; }, 2500);
        } else {
          errorMsg.textContent = data.error || '가입에 실패했습니다.';
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

export function appShellHtml(pageTitle: string = 'METI'): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'11px','sm':'12px','base':'13px','lg':'14px','xl':'15px','2xl':'16px','3xl':'18px' } } } }</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    html, body { font-size: 13px; }
    /* 사이드바 */
    #sidebar { transition: transform 0.25s ease; }
    @media (max-width: 768px) {
      #sidebar { transform: translateX(-100%); position: fixed; z-index: 50; height: 100vh; }
      #sidebar.open { transform: translateX(0); }
      #sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; }
      #sidebar-overlay.open { display: block; }
    }
    .nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 1rem; border-radius: 0.5rem;
      color: #94a3b8; cursor: pointer; transition: all 0.15s;
      font-size: 13px;
    }
    .nav-item:hover { background: #1e293b; color: #f1f5f9; }
    .nav-item.active { background: #2563eb; color: #fff; }
    .nav-item i { width: 1.1rem; text-align: center; }

    /* 컨텍스트 배지 */
    .ctx-badge {
      font-size: 0.75rem; padding: 0.1rem 0.5rem;
      border-radius: 9999px; font-weight: 600;
    }
    /* 페이지 섹션 */
    .page-section { display: none; }
    .page-section.active { display: block; }

    /* 카드 */
    .stat-card { background: #fff; border-radius: 1rem; padding: 1.25rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .item-card  { background: #fff; border-radius: 0.75rem; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 0.75rem; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- 모바일 오버레이 -->
<div id="sidebar-overlay" onclick="closeSidebar()"></div>

<!-- 레이아웃 -->
<div class="flex min-h-screen">

  <!-- ── 사이드바 ── -->
  <aside id="sidebar" class="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">

    <!-- 로고 -->
    <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
      <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
        <i class="fas fa-id-card text-white text-sm"></i>
      </div>
      <span class="font-bold text-lg text-white">METI</span>
    </div>

    <!-- 컨텍스트 선택 (개인 ↔ 그룹) -->
    <div class="px-4 py-3 border-b border-slate-700">
      <button id="ctx-btn" onclick="toggleContextMenu()"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
        <div class="flex items-center gap-2 min-w-0">
          <i id="ctx-icon" class="fas fa-user text-blue-400 text-xs flex-shrink-0"></i>
          <span id="ctx-name" class="text-sm font-medium text-white truncate">내 계정</span>
        </div>
        <i class="fas fa-chevron-down text-slate-400 text-xs flex-shrink-0 ml-1"></i>
      </button>
      <!-- 드롭다운 -->
      <div id="ctx-menu" class="hidden mt-1 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
        <div id="ctx-menu-items"></div>
      </div>
    </div>

    <!-- 네비게이션 -->
    <nav class="flex-1 px-3 py-3 overflow-y-auto space-y-1" id="nav-menu">
      <!-- JS로 렌더링 -->
    </nav>

    <!-- 하단 사용자 정보 -->
    <div class="px-4 py-4 border-t border-slate-700">
      <div class="flex items-center gap-3">
        <!-- 아바타: 클릭 → 프로필 모달 -->
        <button onclick="openProfileModal()" title="프로필 수정"
          class="relative w-9 h-9 rounded-full flex-shrink-0 group">
          <div id="sidebar-avatar-wrap" class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
            <i id="sidebar-avatar-icon" class="fas fa-user text-white text-sm"></i>
            <img id="sidebar-avatar-img" src="" class="hidden w-9 h-9 object-cover" onerror="this.classList.add('hidden');document.getElementById('sidebar-avatar-icon').classList.remove('hidden')">
          </div>
          <div class="absolute inset-0 rounded-full bg-black/40 hidden group-hover:flex items-center justify-center">
            <i class="fas fa-camera text-white text-xs"></i>
          </div>
        </button>
        <div class="flex-1 min-w-0 cursor-pointer" onclick="openProfileModal()">
          <p id="sidebar-username" class="text-sm font-medium text-white truncate">-</p>
          <p id="sidebar-plan"     class="text-xs text-slate-400 truncate">Free</p>
        </div>
        <button onclick="logout()" title="로그아웃"
          class="text-slate-400 hover:text-white transition">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- ── 메인 콘텐츠 ── -->
  <div class="flex-1 flex flex-col min-w-0">

    <!-- 헤더 -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      <button onclick="openSidebar()" class="md:hidden text-gray-500 hover:text-gray-800">
        <i class="fas fa-bars text-xl"></i>
      </button>
      <h2 id="page-title" class="font-semibold text-gray-800 text-lg flex-1">대시보드</h2>
      <span id="header-ctx-badge" class="ctx-badge bg-blue-100 text-blue-700 hidden"></span>
      <button onclick="showSection('notifications')" class="relative text-gray-500 hover:text-gray-800">
        <i class="fas fa-bell text-xl"></i>
        <span id="notif-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">0</span>
      </button>
    </header>

    <!-- 페이지 콘텐츠 -->
    <main class="flex-1 p-4 md:p-6 overflow-auto">

      <!-- ── [개인] 대시보드 ── -->
      <section id="section-dashboard" class="page-section active">
        <div class="mb-6">
          <h3 class="text-lg font-bold text-gray-800">안녕하세요, <span id="greeting-name">-</span>님 👋</h3>
          <p class="text-gray-500 mt-1">오늘도 좋은 하루 되세요.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-blue-600" id="stat-cards">-</p>
            <p class="text-sm text-gray-500 mt-1">내 명함</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-green-600" id="stat-groups">-</p>
            <p class="text-sm text-gray-500 mt-1">소속 그룹</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-purple-600" id="stat-points">-</p>
            <p class="text-sm text-gray-500 mt-1">포인트 (P)</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-orange-500" id="stat-plan">-</p>
            <p class="text-sm text-gray-500 mt-1">현재 플랜</p>
          </div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="stat-card">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700">최근 명함</h4>
              <button onclick="showSection('cards')" class="text-sm text-blue-600 hover:underline">전체보기</button>
            </div>
            <div id="recent-cards">
              <p class="text-sm text-gray-400 text-center py-4">명함이 없습니다.</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700">내 그룹</h4>
              <button onclick="showSection('groups')" class="text-sm text-blue-600 hover:underline">전체보기</button>
            </div>
            <div id="recent-groups">
              <p class="text-sm text-gray-400 text-center py-4">소속된 그룹이 없습니다.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── [개인] 내 명함 ── -->
      <section id="section-cards" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">내 명함</h3>
          <button onclick="openCreateCardModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 명함 추가
          </button>
        </div>
        <div id="cards-list">
          <p class="text-sm text-gray-400 text-center py-8">명함이 없습니다.</p>
        </div>
      </section>

      <!-- ── [개인] 내 그룹 목록 ── -->
      <section id="section-groups" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">내 그룹</h3>
          <button onclick="openJoinGroupModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-search"></i> 그룹 탐색
          </button>
        </div>
        <div id="groups-list">
          <p class="text-sm text-gray-400 text-center py-8">소속된 그룹이 없습니다.</p>
        </div>
      </section>

      <!-- ── [개인] 포인트 ── -->
      <section id="section-points" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">포인트</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">현재 잔액</p>
              <p class="text-2xl font-bold text-blue-600 mt-1"><span id="points-balance">-</span> P</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400 mb-2">1P = 1원</p>
              <button onclick="openChargeModal()"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <i class="fas fa-plus mr-1"></i>충전
              </button>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">포인트 이력</h4>
          <div id="points-history">
            <p class="text-sm text-gray-400 text-center py-4">이력이 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [개인] 구독 ── -->
      <section id="section-subscription" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">구독</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <i class="fas fa-crown text-blue-600 text-xl"></i>
            </div>
            <div>
              <p class="font-semibold text-gray-800">현재 플랜: <span id="sub-plan-name" class="text-blue-600">Free</span></p>
              <p class="text-sm text-gray-500 mt-0.5" id="sub-status-text">무료 플랜 이용 중</p>
            </div>
          </div>
        </div>
        <div class="grid md:grid-cols-3 gap-4" id="plan-cards">
          <!-- JS로 렌더링 -->
        </div>
        <p class="text-xs text-gray-400 mt-4 text-center">
          플랜 업그레이드는 앱(iOS/Android)에서 가능합니다.
        </p>
      </section>

      <!-- ── [그룹관리] 그룹 대시보드 ── -->
      <section id="section-group-dashboard" class="page-section">
        <div class="mb-5">
          <h3 class="text-lg font-bold text-gray-800">그룹 대시보드</h3>
          <p class="text-sm text-gray-500 mt-1" id="group-desc-text"></p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-blue-600" id="gstat-members">-</p>
            <p class="text-sm text-gray-500 mt-1">전체 멤버</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-yellow-500" id="gstat-pending">-</p>
            <p class="text-sm text-gray-500 mt-1">가입 대기</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-green-600" id="gstat-events">-</p>
            <p class="text-sm text-gray-500 mt-1">행사</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-purple-600" id="gstat-points">-</p>
            <p class="text-sm text-gray-500 mt-1">그룹 포인트 (P)</p>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">최근 가입 신청</h4>
          <div id="group-pending-list">
            <p class="text-sm text-gray-400 text-center py-4">가입 대기 중인 멤버가 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [그룹관리] 멤버 관리 ── -->
      <section id="section-group-members" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">멤버 관리</h3>
          <div class="flex gap-2">
            <button onclick="showSection('group-invites')"
              class="flex items-center gap-2 px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm">
              <i class="fas fa-link"></i> 초대링크
            </button>
          </div>
        </div>
        <!-- 탭: 승인대기 / 전체멤버 -->
        <div class="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
          <button onclick="switchMemberTab('pending')" id="mtab-pending"
            class="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-800 shadow-sm">대기 <span id="pending-count" class="text-red-500"></span></button>
          <button onclick="switchMemberTab('active')" id="mtab-active"
            class="px-4 py-1.5 rounded-md text-sm font-medium text-gray-500">전체 멤버</button>
        </div>
        <div id="members-list">
          <p class="text-sm text-gray-400 text-center py-8">멤버가 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 행사 관리 ── -->
      <section id="section-group-events" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">행사 관리</h3>
          <button onclick="openCreateEventModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 행사 생성
          </button>
        </div>
        <div id="events-list">
          <p class="text-sm text-gray-400 text-center py-8">행사가 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 그룹 포인트 ── -->
      <section id="section-group-points" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">그룹 포인트</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">그룹 잔액</p>
              <p class="text-2xl font-bold text-purple-600 mt-1"><span id="group-points-balance">-</span> P</p>
            </div>
            <div class="flex flex-col gap-2 items-end">
              <button onclick="openGroupChargeModal()"
                class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                <i class="fas fa-plus mr-1"></i>그룹 충전
              </button>
              <button onclick="openTransferModal()"
                class="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50">
                <i class="fas fa-exchange-alt mr-1"></i>개인→그룹 이전
              </button>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">그룹 포인트 이력</h4>
          <div id="group-points-history">
            <p class="text-sm text-gray-400 text-center py-4">이력이 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [그룹관리] 레슨 관리 ── -->
      <section id="section-group-lessons" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">레슨 관리</h3>
          <button onclick="openCreateLessonModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 일정 추가
          </button>
        </div>
        <div id="lessons-list">
          <p class="text-sm text-gray-400 text-center py-8">레슨 일정이 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 초대링크 ── -->
      <section id="section-group-invites" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">초대링크 관리</h3>
          <button onclick="openCreateInviteModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 링크 생성
          </button>
        </div>
        <div id="invites-list">
          <p class="text-sm text-gray-400 text-center py-8">초대링크가 없습니다.</p>
        </div>
      </section>

      <!-- ── 알림 ── -->
      <section id="section-notifications" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">알림</h3>
        <div id="notifications-list">
          <p class="text-sm text-gray-400 text-center py-8">알림이 없습니다.</p>
        </div>
      </section>

    </main>
  </div>
</div>

<!-- ── 모달: 프로필 수정 ── -->
<div id="modal-profile" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">내 프로필</h3>
      <button onclick="closeModal('modal-profile')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>

    <!-- 아바타 업로드 -->
    <div class="flex flex-col items-center mb-5">
      <div class="relative group cursor-pointer" onclick="document.getElementById('avatar-file-input').click()">
        <div id="profile-avatar-wrap" class="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
          <i id="profile-avatar-icon" class="fas fa-user text-white text-3xl"></i>
          <img id="profile-avatar-img" src="" class="hidden w-24 h-24 object-cover"
            onerror="this.classList.add('hidden');document.getElementById('profile-avatar-icon').classList.remove('hidden')">
        </div>
        <div class="absolute inset-0 rounded-full bg-black/40 hidden group-hover:flex items-center justify-center">
          <i class="fas fa-camera text-white text-xl"></i>
        </div>
      </div>
      <input id="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange="onAvatarFileChange(event)">
      <p id="avatar-upload-status" class="text-xs text-gray-400 mt-2">클릭하여 사진 변경 (JPG·PNG·WEBP, 최대 5MB)</p>
    </div>

    <!-- 이름 수정 -->
    <form id="profile-name-form" class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이름</label>
        <input id="profile-name-input" type="text" class="modal-input" placeholder="이름을 입력하세요" required>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input id="profile-email-display" type="text" class="modal-input bg-gray-50 text-gray-400" readonly>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">플랜</label>
        <input id="profile-plan-display" type="text" class="modal-input bg-gray-50 text-gray-400" readonly>
      </div>
      <div id="profile-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        저장
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 명함 미리보기 ── -->
<div id="modal-card-preview" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">내 명함</h3>
      <button onclick="closeModal('modal-card-preview')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div id="card-preview-body"></div>
  </div>
</div>

<!-- ── 모달: 명함 수정 ── -->
<div id="modal-edit-card" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style="max-height:92vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
      <h3 class="text-lg font-bold">명함 수정</h3>
      <button onclick="closeModal('modal-edit-card')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 탭 -->
    <div class="flex border-b mx-5 flex-shrink-0">
      <button id="edit-tab-basic" onclick="switchEditTab('basic')"
        class="flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">기본 정보</button>
      <button id="edit-tab-resume" onclick="switchEditTab('resume')"
        class="flex-1 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent">이력 &amp; SNS</button>
    </div>
    <form id="edit-card-form" class="overflow-y-auto flex-1 px-5 py-4">
      <input id="edit-card-id" type="hidden">
      <!-- ── 탭1: 기본 정보 ── -->
      <div id="edit-pane-basic" class="space-y-3">
        <!-- 사진 -->
        <div class="flex flex-col items-center gap-2 pb-1">
          <div class="relative group cursor-pointer" onclick="document.getElementById('edit-card-avatar-input').click()">
            <img id="edit-card-avatar-preview"
                 src="https://ui-avatars.com/api/?name=?&background=6366f1&color=fff&size=96"
                 class="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shadow"
                 onerror="this.src='https://ui-avatars.com/api/?name=?&background=6366f1&color=fff&size=96'">
            <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fas fa-camera text-white text-lg"></i>
            </div>
          </div>
          <span class="text-xs text-gray-400">사진 변경</span>
          <input id="edit-card-avatar-input" type="file" accept="image/*" class="hidden" onchange="onEditCardAvatarChange(event)">
        </div>
        <input id="edit-card-name"    type="text"  placeholder="이름 *"   class="modal-input" required>
        <input id="edit-card-title"   type="text"  placeholder="직함"     class="modal-input">
        <input id="edit-card-company" type="text"  placeholder="회사/단체" class="modal-input">
        <input id="edit-card-email"   type="email" placeholder="이메일"    class="modal-input">
        <input id="edit-card-phone"   type="text"  placeholder="전화번호"  class="modal-input">
        <input id="edit-card-website" type="url"   placeholder="웹사이트 (https://...)" class="modal-input">
        <textarea id="edit-card-bio" placeholder="소개" rows="2" class="modal-input resize-none"></textarea>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="edit-card-public" class="rounded">
            <span class="text-sm text-gray-700">공개 명함 (QR 공유 가능)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="edit-card-primary" class="rounded">
            <span class="text-sm text-gray-700">대표 명함으로 설정</span>
          </label>
        </div>
      </div>
      <!-- ── 탭2: 이력 & SNS ── -->
      <div id="edit-pane-resume" class="hidden space-y-5">
        <!-- 경력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-briefcase text-orange-500 mr-1"></i>경력</p>
            <button type="button" onclick="addResumeItem('edit','career')"
              class="text-xs px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition">+ 추가</button>
          </div>
          <div id="edit-career-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 삼성전자 · 소프트웨어 개발자 · 2020~2023</p>
        </div>
        <!-- 학력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-graduation-cap text-purple-500 mr-1"></i>학력</p>
            <button type="button" onclick="addResumeItem('edit','education')"
              class="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition">+ 추가</button>
          </div>
          <div id="edit-education-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 서울대학교 · 컴퓨터공학과 · 2016 졸업</p>
        </div>
        <!-- 스킬 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-tags text-blue-500 mr-1"></i>스킬 / 키워드</p>
            <button type="button" onclick="addResumeItem('edit','skill')"
              class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">+ 추가</button>
          </div>
          <div id="edit-skill-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: Python, React, 영어 (비즈니스)</p>
        </div>
        <!-- SNS -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-share-alt text-green-500 mr-1"></i>소셜 링크</p>
            <button type="button" onclick="addSnsItem('edit')"
              class="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition">+ 추가</button>
          </div>
          <div id="edit-sns-list" class="space-y-2"></div>
        </div>
      </div>
      <!-- 에러 & 제출 -->
      <div id="edit-card-error" class="hidden text-sm text-red-600 mt-3"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 mt-4">
        저장
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 명함 생성 ── -->
<div id="modal-create-card" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style="max-height:92vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
      <h3 class="text-lg font-bold">명함 추가</h3>
      <button onclick="closeModal('modal-create-card')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 탭 -->
    <div class="flex border-b mx-5 flex-shrink-0">
      <button id="create-tab-basic" onclick="switchCreateTab('basic')"
        class="flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">기본 정보</button>
      <button id="create-tab-resume" onclick="switchCreateTab('resume')"
        class="flex-1 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent">이력 &amp; SNS</button>
    </div>
    <form id="create-card-form" class="overflow-y-auto flex-1 px-5 py-4">
      <!-- ── 탭1: 기본 정보 ── -->
      <div id="create-pane-basic" class="space-y-3">
        <!-- 사진 -->
        <div class="flex flex-col items-center gap-2 pb-1">
          <div class="relative group cursor-pointer" onclick="document.getElementById('create-card-avatar-input').click()">
            <img id="create-card-avatar-preview"
                 src="https://ui-avatars.com/api/?name=+&background=6366f1&color=fff&size=96"
                 class="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shadow">
            <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fas fa-camera text-white text-lg"></i>
            </div>
          </div>
          <span class="text-xs text-gray-400">사진 추가 (선택)</span>
          <input id="create-card-avatar-input" type="file" accept="image/*" class="hidden" onchange="onCreateCardAvatarChange(event)">
        </div>
        <input id="card-name"    type="text"  placeholder="이름 *"     class="modal-input" required>
        <input id="card-title"   type="text"  placeholder="직함"        class="modal-input">
        <input id="card-company" type="text"  placeholder="회사/단체"    class="modal-input">
        <input id="card-email"   type="email" placeholder="이메일"       class="modal-input">
        <input id="card-phone"   type="text"  placeholder="전화번호"     class="modal-input">
        <input id="card-website" type="url"   placeholder="웹사이트 (https://...)" class="modal-input">
        <textarea id="card-bio"  placeholder="소개 (자유롭게 작성)" rows="2" class="modal-input resize-none"></textarea>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="card-public" class="rounded" checked>
          <span class="text-sm text-gray-700">공개 명함 (QR 공유 가능)</span>
        </label>
      </div>
      <!-- ── 탭2: 이력 & SNS ── -->
      <div id="create-pane-resume" class="hidden space-y-5">
        <!-- 경력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-briefcase text-orange-500 mr-1"></i>경력</p>
            <button type="button" onclick="addResumeItem('create','career')"
              class="text-xs px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition">+ 추가</button>
          </div>
          <div id="create-career-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 삼성전자 · 소프트웨어 개발자 · 2020~2023</p>
        </div>
        <!-- 학력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-graduation-cap text-purple-500 mr-1"></i>학력</p>
            <button type="button" onclick="addResumeItem('create','education')"
              class="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition">+ 추가</button>
          </div>
          <div id="create-education-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 서울대학교 · 컴퓨터공학과 · 2016 졸업</p>
        </div>
        <!-- 스킬 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-tags text-blue-500 mr-1"></i>스킬 / 키워드</p>
            <button type="button" onclick="addResumeItem('create','skill')"
              class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">+ 추가</button>
          </div>
          <div id="create-skill-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: Python, React, 영어 (비즈니스)</p>
        </div>
        <!-- SNS -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-share-alt text-green-500 mr-1"></i>소셜 링크</p>
            <button type="button" onclick="addSnsItem('create')"
              class="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition">+ 추가</button>
          </div>
          <div id="create-sns-list" class="space-y-2"></div>
        </div>
      </div>
      <!-- 에러 & 제출 -->
      <div id="card-form-error" class="hidden text-sm text-red-600 mt-3"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 mt-4">
        명함 생성
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 그룹 탐색 ── -->
<div id="modal-group-explore" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height:90vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between p-5 border-b flex-shrink-0">
      <h3 class="text-lg font-bold">그룹 탐색</h3>
      <button onclick="closeModal('modal-group-explore')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 검색바 -->
    <div class="px-5 pt-4 pb-3 flex-shrink-0">
      <div class="relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
        <input id="explore-search-input" type="text" placeholder="그룹 이름 또는 소개 검색..."
          class="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          oninput="onExploreSearchInput(this.value)">
      </div>
    </div>
    <!-- 그룹 목록 -->
    <div id="explore-groups-list" class="overflow-y-auto flex-1 px-5 pb-5 space-y-3">
      <div class="text-center py-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...</div>
    </div>
    <!-- 더보기 -->
    <div id="explore-load-more-wrap" class="hidden px-5 pb-5 flex-shrink-0">
      <button onclick="loadMoreExploreGroups()"
        class="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
        더 보기
      </button>
    </div>
  </div>
</div>

<!-- ── 모달: 그룹 상세 ── -->
<div id="modal-group-detail" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style="max-height:90vh">
    <div class="flex items-center justify-between p-5 border-b flex-shrink-0">
      <h3 class="text-lg font-bold">그룹 정보</h3>
      <button onclick="closeModal('modal-group-detail')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div id="group-detail-body" class="overflow-y-auto flex-1 p-5">
      <div class="text-center py-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...</div>
    </div>
  </div>
</div>

<!-- ── 모달: 초대링크 생성 ── -->
<div id="modal-create-invite" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">초대링크 생성</h3>
      <button onclick="closeModal('modal-create-invite')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <form id="create-invite-form" class="space-y-3">
      <input id="invite-label"    type="text"   placeholder="링크 이름 (예: 5월 신입 모집)" class="modal-input">
      <input id="invite-max-uses" type="number" placeholder="최대 사용 횟수 (빈칸=무제한)"  class="modal-input" min="1">
      <input id="invite-expires"  type="date"   placeholder="만료일"                       class="modal-input">
      <div id="invite-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        링크 생성
      </button>
    </form>
    <!-- 생성 결과 -->
    <div id="invite-result" class="hidden mt-4 p-3 bg-blue-50 rounded-lg">
      <p class="text-xs text-gray-500 mb-1">초대 링크</p>
      <div class="flex gap-2">
        <input id="invite-url" type="text" readonly class="flex-1 text-sm bg-white border rounded px-2 py-1 text-blue-700">
        <button onclick="copyInviteUrl()" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">복사</button>
      </div>
    </div>
  </div>
</div>

<!-- ── 모달: 행사 생성 ── -->
<div id="modal-create-event" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">행사 생성</h3>
      <button onclick="closeModal('modal-create-event')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div class="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
      <i class="fas fa-coins mr-1"></i> 행사 생성 시 그룹 포인트 <strong id="event-price-display">3,000P</strong>가 차감됩니다.
    </div>
    <form id="create-event-form" class="space-y-3">
      <input id="event-title"       type="text"     placeholder="행사명 *"     class="modal-input" required>
      <textarea id="event-desc"     placeholder="행사 설명" rows="2"           class="modal-input resize-none"></textarea>
      <input id="event-location"    type="text"     placeholder="장소"         class="modal-input">
      <div class="grid grid-cols-2 gap-2">
        <input id="event-starts"    type="datetime-local" class="modal-input">
        <input id="event-ends"      type="datetime-local" class="modal-input">
      </div>
      <input id="event-max"         type="number"   placeholder="최대 참가 인원" class="modal-input" min="1">
      <div id="event-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        행사 생성 (포인트 차감)
      </button>
    </form>
  </div>
</div>

<style>
  .modal-input {
    display: block; width: 100%;
    padding: 0.65rem 0.9rem;
    border: 1px solid #d1d5db; border-radius: 0.5rem;
    font-size: 0.9rem; outline: none; transition: border 0.15s;
  }
  .modal-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
</style>

<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/app.js?v=248d5c8"></script>
</body>
</html>`
}
