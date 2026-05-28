// v2
// ============================================================
// METI Admin Web SPA - v2.0 (모바일 반응형)
// ============================================================

const API = '/api/v1';
let authToken = localStorage.getItem('meti_admin_token');
let currentUser = JSON.parse(localStorage.getItem('meti_admin_user') || 'null');
let currentSection = 'dashboard';
let sidebarOpen = false;

// Axios 기본 설정
axios.defaults.baseURL = API;
axios.interceptors.request.use(config => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  }
);

// ── 초기화 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!authToken || !currentUser) {
    window.location.href = '/admin';
    return;
  }
  initApp();
});

function initApp() {
  document.getElementById('loading').classList.add('hidden');
  renderApp();
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
}

// ── 앱 렌더링 ─────────────────────────────────────────────
function renderApp() {
  document.getElementById('app').innerHTML = `
    <!-- 모바일 오버레이 -->
    <div id="sidebar-overlay" onclick="closeSidebar()"
      class="fixed inset-0 bg-black bg-opacity-50 z-20 hidden lg:hidden"></div>

    <div class="flex min-h-screen">
      <!-- 사이드바 -->
      <aside id="sidebar"
        class="w-52 bg-slate-900 flex flex-col fixed z-30 top-0 bottom-0
               -translate-x-full lg:translate-x-0 transition-transform duration-300">

        <!-- 로고 -->
        <div class="px-3 py-2.5 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
              <i class="fas fa-id-card text-white" style="font-size:14px"></i>
            </div>
            <div>
              <h1 class="text-white font-bold leading-none" style="font-size:15px">METI Admin</h1>
            </div>
          </div>
          <button onclick="closeSidebar()" class="lg:hidden text-slate-400 hover:text-white p-1">
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>

        <!-- 네비게이션 -->
        <nav class="flex-1 px-2 py-1 overflow-y-auto" style="scrollbar-width:none;-ms-overflow-style:none;">
          <style>#sidebar nav::-webkit-scrollbar{display:none}</style>
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-1 pb-0.5">메인</p>
          ${navItem('dashboard',    'tachometer-alt',      '대시보드')}
          ${navItem('users',        'users',               '유저 관리')}
          ${navItem('groups',       'building',            '그룹 관리')}
          ${navItem('cards',        'id-card',             '명함 관리')}
          ${navItem('events',       'calendar-alt',        '행사 관리')}
          ${navItem('lessons',      'chalkboard-teacher',  '레슨 관리')}
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-2 pb-0.5">결제/파트너</p>
          ${navItem('orders',       'shopping-cart',       '주문/결제')}
          ${navItem('partners',     'handshake',           '파트너 관리')}
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-2 pb-0.5">운영</p>
          ${navItem('reports',      'flag',                '신고 관리')}
          ${navItem('nfc-cards',    'credit-card',         'NFC 카드')}
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-2 pb-0.5">설정</p>
          ${navItem('plan-configs', 'sliders-h',           '플랜 설정')}
        </nav>

        <!-- 사용자 정보 -->
        <div class="px-2 py-2 border-t border-slate-700 flex-shrink-0">
          <div class="flex items-center gap-2 px-2 py-1.5">
            <div class="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user text-slate-300" style="font-size:13px"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate" style="font-size:14px">${currentUser?.name || 'Admin'}</p>
            </div>
            <button onclick="logout()" class="text-slate-400 hover:text-red-400 flex-shrink-0 transition-colors" title="로그아웃">
              <i class="fas fa-sign-out-alt" style="font-size:15px"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- 메인 콘텐츠 -->
      <main class="flex-1 lg:ml-52 min-h-screen flex flex-col">
        <!-- 상단 헤더 -->
        <header class="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- 모바일 햄버거 -->
              <button onclick="openSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900 p-1">
                <i class="fas fa-bars text-lg"></i>
              </button>
              <h2 id="page-title" class="text-base font-semibold text-gray-800">대시보드</h2>
            </div>
            <div class="flex items-center gap-2">
              <span class="hidden sm:block text-sm text-gray-500">${new Date().toLocaleDateString('ko-KR')}</span>
              <span class="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">Super Admin</span>
            </div>
          </div>
        </header>

        <!-- 페이지 콘텐츠 -->
        <div id="page-content" class="flex-1 p-4 md:p-6">
          <div class="flex items-center justify-center h-64">
            <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
          </div>
        </div>
      </main>
    </div>
  `;
}

function navItem(id, icon, label) {
  return `<button onclick="navigateTo('${id}'); closeSidebar();" id="nav-${id}"
    class="sidebar-link w-full text-left">
    <i class="fas fa-${icon}"></i> ${label}
  </button>`;
}

// ── 사이드바 토글 (모바일) ─────────────────────────────
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
  sidebarOpen = true;
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
  sidebarOpen = false;
}

// ── 네비게이션 ───────────────────────────────────────────
function navigateTo(section) {
  document.querySelectorAll('.sidebar-link').forEach(el =>
    el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${section}`);
  if (navEl) navEl.classList.add('active');

  currentSection = section;

  const titles = {
    dashboard: '대시보드', users: '유저 관리', groups: '그룹 관리', cards: '명함 관리',
    events: '행사 관리', lessons: '레슨 관리', reports: '신고 관리', 'nfc-cards': 'NFC 카드 관리',
    'plan-configs': '플랜 설정', 'group-detail': '그룹 상세',
    orders: '주문/결제 관리', partners: '파트너 관리'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[section] || section;

  const pages = {
    dashboard: loadDashboard, users: loadUsers, groups: loadGroups, cards: loadCards,
    events: loadEvents, lessons: loadLessons,
    reports: loadReports,
    'nfc-cards': loadNfcCards,
    'plan-configs': loadPlanConfigs,
    orders: loadOrders,       // admin-orders.js
    partners: loadPartners    // admin-partner.js
    // 'group-detail': admin-groups.js의 loadGroupDetailPage()가 소비
  };
  if (pages[section]) pages[section]();
}

// ── 대시보드 ─────────────────────────────────────────────
async function loadDashboard() {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get('/admin/dashboard');
    const d = data.data;
    const revenue = (d.orders?.revenue_this_month || 0).toLocaleString();
    setContent(`
      <div class="space-y-4">
        <!-- 통계 카드 6개 -->
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          ${statCard('총 유저',      d.users?.total || 0,          'users',         'blue',   `오늘 +${d.users?.today || 0}명`)}
          ${statCard('활성 그룹',    d.groups?.active || 0,        'building',      'green',  `대기 ${d.groups?.pending || 0}개`)}
          ${statCard('예정 행사',    d.events?.upcoming || 0,      'calendar-alt',  'purple', `전체 ${d.events?.total || 0}개`)}
          ${statCard('미처리 신고',  d.reports?.pending || 0,      'flag',          'red',    `전체 ${d.reports?.total || 0}건`)}
          ${statCard('NFC 처리대기', d.nfc?.pending || 0,          'credit-card',   'indigo', `승인완료 ${d.nfc?.approved || 0}건`)}
          ${statCard('이달 매출',    revenue + '원',               'won-sign',      'teal',   `주문 ${d.orders?.total_orders || 0}건`)}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 플랜 분포 -->
          <div class="bg-white rounded-xl p-4 shadow-sm border">
            <h3 class="font-semibold text-gray-800 text-sm mb-3">
              <i class="fas fa-chart-pie text-blue-500 mr-1.5"></i>플랜 분포
            </h3>
            <div class="space-y-2.5">
              ${planBar('Free',     d.users?.free_plan     || 0, d.users?.total || 1, 'gray')}
              ${planBar('Pro',      d.users?.pro_plan      || 0, d.users?.total || 1, 'blue')}
              ${planBar('Business', d.users?.business_plan || 0, d.users?.total || 1, 'purple')}
            </div>
          </div>

          <!-- 빠른 실행 -->
          <div class="bg-white rounded-xl p-4 shadow-sm border">
            <h3 class="font-semibold text-gray-800 text-sm mb-3">
              <i class="fas fa-bolt text-yellow-500 mr-1.5"></i>빠른 실행
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="navigateTo('groups')"
                class="p-2.5 bg-orange-50 hover:bg-orange-100 rounded-xl text-left transition">
                <i class="fas fa-building text-orange-500 text-base mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">그룹 승인 대기</p>
                <p class="text-lg font-bold text-orange-600">${d.groups?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('reports')"
                class="p-2.5 bg-red-50 hover:bg-red-100 rounded-xl text-left transition">
                <i class="fas fa-flag text-red-500 text-base mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">신고 처리 대기</p>
                <p class="text-lg font-bold text-red-600">${d.reports?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('nfc-cards')"
                class="p-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-left transition">
                <i class="fas fa-credit-card text-indigo-500 text-base mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">NFC 처리 대기</p>
                <p class="text-lg font-bold text-indigo-600">${d.nfc?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('orders')"
                class="p-2.5 bg-teal-50 hover:bg-teal-100 rounded-xl text-left transition">
                <i class="fas fa-shopping-cart text-teal-500 text-base mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">미처리 주문</p>
                <p class="text-lg font-bold text-teal-600">${d.orders?.pending_orders || 0}</p>
              </button>
            </div>
          </div>

          <!-- 최근 가입 유저 -->
          <div class="bg-white rounded-xl p-4 shadow-sm border">
            <h3 class="font-semibold text-gray-800 text-sm mb-3">
              <i class="fas fa-user-plus text-green-500 mr-1.5"></i>최근 가입 유저
            </h3>
            <div class="space-y-2">
              ${(d.recent_users || []).map(u => `
                <div class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                     onclick="showUserDetail(${u.id})">
                  <div class="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-user text-blue-500 text-xs"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">${u.name}</p>
                    <p class="text-xs text-gray-400 truncate">${u.email}</p>
                  </div>
                  ${planBadge(u.plan)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(errorBox('대시보드 데이터를 불러오지 못했습니다.'));
  }
}

function statCard(label, value, icon, color, sub) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red:    'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    teal:   'bg-teal-50 text-teal-600'
  };
  return `<div class="bg-white rounded-xl p-4 shadow-sm border">
    <div class="flex items-center justify-between mb-2">
      <div class="w-9 h-9 ${colors[color]} rounded-lg flex items-center justify-center">
        <i class="fas fa-${icon} text-base"></i>
      </div>
    </div>
    <p class="text-2xl font-bold text-gray-900">${typeof value === 'number' ? value.toLocaleString() : value}</p>
    <p class="text-gray-500 text-sm mt-0.5">${label}</p>
    <p class="text-sm text-gray-400 mt-1">${sub}</p>
  </div>`;
}

function planBar(label, count, total, color) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors = { gray: 'bg-gray-400', blue: 'bg-blue-500', purple: 'bg-purple-500' };
  return `<div>
    <div class="flex justify-between text-sm mb-1">
      <span class="text-gray-600">${label}</span>
      <span class="font-semibold">${count} (${pct}%)</span>
    </div>
    <div class="h-1.5 bg-gray-100 rounded-full">
      <div class="h-1.5 ${colors[color]} rounded-full transition-all" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ── 분리된 모듈 (별도 파일로 이동됨) ──────────────────────
// admin-users.js    : loadUsers, loadGroups, loadCards, showUserDetail 등
// admin-events.js   : loadEvents, showEventDetail, showCreateGroupModal, showCreateEventModal 등
// admin-plans.js    : loadPlanConfigs, updatePlanConfig, updateConfigKey 등
// admin-lessons.js  : loadLessons, showLessonDetail, openCreateLessonModal 등
// ──────────────────────────────────────────────────────────

// ── API 액션 함수들은 아래에 유지 (admin-users.js에서 호출) ─
// ── API 액션 함수들 ─────────────────────────────────────
async function toggleUserActive(userId, currentStatus) {
  if (!confirm(`이 유저를 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/users/${userId}`, { is_active: currentStatus ? 0 : 1 });
    showToast('변경되었습니다.', 'success');
    loadUsers(1, document.getElementById('user-search')?.value || '');
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

async function changeUserPlan(userId, currentPlan) {
  const plans = ['free', 'pro', 'business'];
  const labels = { free: 'Free (명함 3개)', pro: 'Pro (명함 10개)', business: 'Business (무제한)' };
  const options = plans.map((p, i) => `${i + 1}. ${labels[p]}`).join('\n');
  const input = prompt(`현재 플랜: ${labels[currentPlan] || currentPlan}\n\n변경할 플랜 입력:\n${options}\n\n(free / pro / business)`);
  if (!input) return;
  const plan = input.trim().toLowerCase();
  if (!plans.includes(plan)) { showToast('올바른 플랜을 입력하세요.', 'error'); return; }
  if (plan === currentPlan) { showToast('동일한 플랜입니다.', 'error'); return; }
  try {
    await axios.patch(`/admin/users/${userId}`, { plan });
    showToast(`플랜이 ${labels[plan]}으로 변경되었습니다.`, 'success');
    loadUsers(1, document.getElementById('user-search')?.value || '');
  } catch (err) {
    showToast('플랜 변경에 실패했습니다.', 'error');
  }
}

async function approveGroup(groupId, action) {
  const messages = { approve: '승인', reject: '거절', suspend: '정지', activate: '활성화' };
  if (!confirm(`이 그룹을 ${messages[action]}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/groups/${groupId}`, { action });
    showToast(`그룹이 ${messages[action]}되었습니다.`, 'success');
    loadGroups();
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// resolveReport / addPartner → admin-reports.js 로 이동

// ── 유틸리티 ─────────────────────────────────────────────
function setContent(html) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = html;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadingSpinner() {
  return '<div class="flex items-center justify-center h-48"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></div>';
}

function errorBox(msg) {
  return `<div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600 text-sm">
    <i class="fas fa-exclamation-circle mr-2"></i>${msg}
  </div>`;
}

function renderPagination(p, loadFn) {
  if (!p || p.total_pages <= 1) return '';
  const btns = [];
  const current = p.page;
  const total = p.total_pages;
  // 최대 5개 페이지 버튼
  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  if (start > 1) btns.push(`<button onclick="${loadFn}(1)" class="w-8 h-8 rounded text-sm border hover:bg-gray-50">1</button>`);
  if (start > 2) btns.push(`<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>`);
  for (let i = start; i <= end; i++) {
    btns.push(`<button onclick="${loadFn}(${i})"
      class="w-8 h-8 rounded text-sm font-medium transition
             ${i === current ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50 text-gray-600'}">${i}</button>`);
  }
  if (end < total - 1) btns.push(`<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>`);
  if (end < total) btns.push(`<button onclick="${loadFn}(${total})" class="w-8 h-8 rounded text-sm border hover:bg-gray-50">${total}</button>`);

  return `<div class="flex justify-center gap-1 pt-2">${btns.join('')}</div>`;
}

function planBadge(plan) {
  const map = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    business: 'bg-purple-100 text-purple-700'
  };
  return `<span class="px-2 py-0.5 ${map[plan] || map.free} text-sm font-semibold rounded-full capitalize">${plan}</span>`;
}

function accountTypeBadge(type) {
  const map = { personal: 'bg-gray-100 text-gray-600' };
  const labels = { personal: '일반' };
  return `<span class="px-2 py-0.5 ${map[type] || map.personal} text-sm rounded-full">${labels[type] || type}</span>`;
}

function categoryBadge(cat) {
  const map = { association: '협회', company: '기업', club: '동호회', other: '기타' };
  return `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-sm rounded-full">${map[cat] || cat || '-'}</span>`;
}

function eventStatusBadge(status) {
  const map = {
    upcoming: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500'
  };
  const labels = { upcoming: '예정', ongoing: '진행중', ended: '종료' };
  return `<span class="px-2 py-0.5 ${map[status] || 'bg-gray-100 text-gray-500'} text-sm rounded-full">${labels[status] || status || '-'}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-auto
    px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 transition-all text-center
    ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation-circle'} mr-2"></i>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function logout() {
  localStorage.removeItem('meti_admin_token');
  localStorage.removeItem('meti_admin_user');
  window.location.href = '/admin';
}
