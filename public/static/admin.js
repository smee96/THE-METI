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
              <i class="fas fa-id-card text-white" style="font-size:10px"></i>
            </div>
            <div>
              <h1 class="text-white font-bold leading-none" style="font-size:13px">METI Admin</h1>
            </div>
          </div>
          <button onclick="closeSidebar()" class="lg:hidden text-slate-400 hover:text-white p-1">
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>

        <!-- 네비게이션 -->
        <nav class="flex-1 px-2 py-1 overflow-y-auto" style="scrollbar-width:none;-ms-overflow-style:none;">
          <style>#sidebar nav::-webkit-scrollbar{display:none}</style>
          <p class="text-slate-500 text-xs uppercase font-semibold px-2 pt-1 pb-0.5">메인</p>
          ${navItem('dashboard', 'tachometer-alt', '대시보드')}
          ${navItem('users', 'users', '유저 관리')}
          ${navItem('groups', 'building', '그룹 관리')}
          ${navItem('events', 'calendar-alt', '행사 관리')}
          <p class="text-slate-500 text-xs uppercase font-semibold px-2 pt-2 pb-0.5">운영</p>
          ${navItem('reports', 'flag', '신고 관리')}
          ${navItem('nfc-cards', 'credit-card', 'NFC 카드')}
          ${navItem('partners', 'handshake', '파트너')}
          ${navItem('rewards', 'gift', '리워드')}
        </nav>

        <!-- 사용자 정보 -->
        <div class="px-2 py-2 border-t border-slate-700 flex-shrink-0">
          <div class="flex items-center gap-2 px-2 py-1.5">
            <div class="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user text-slate-300" style="font-size:9px"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate" style="font-size:11px">${currentUser?.name || 'Admin'}</p>
            </div>
            <button onclick="logout()" class="text-slate-400 hover:text-red-400 flex-shrink-0 transition-colors" title="로그아웃">
              <i class="fas fa-sign-out-alt" style="font-size:11px"></i>
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
              <span class="hidden sm:block text-xs text-gray-500">${new Date().toLocaleDateString('ko-KR')}</span>
              <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Super Admin</span>
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
  return `<a onclick="navigateTo('${id}'); closeSidebar();" href="#${id}" id="nav-${id}"
    class="sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-300
           hover:bg-slate-700 cursor-pointer transition-colors font-medium mb-0.5"
    style="font-size:11.5px">
    <i class="fas fa-${icon} text-center flex-shrink-0" style="width:14px;font-size:11px"></i>
    <span>${label}</span>
  </a>`;
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
    el.classList.remove('bg-blue-700', 'text-white'));
  const navEl = document.getElementById(`nav-${section}`);
  if (navEl) navEl.classList.add('bg-blue-700', 'text-white');

  currentSection = section;

  const titles = {
    dashboard: '대시보드', users: '유저 관리', groups: '그룹 관리',
    events: '행사 관리', reports: '신고 관리', 'nfc-cards': 'NFC 카드 관리',
    partners: '파트너 서비스', rewards: '리워드 내역'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[section] || section;

  const pages = {
    dashboard: loadDashboard, users: loadUsers, groups: loadGroups,
    events: loadEvents, reports: loadReports, 'nfc-cards': loadNfcCards,
    partners: loadPartners, rewards: loadRewards
  };
  if (pages[section]) pages[section]();
}

// ── 대시보드 ─────────────────────────────────────────────
async function loadDashboard() {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get('/admin/dashboard');
    const d = data.data;
    setContent(`
      <div class="space-y-4">
        <!-- 통계 카드 4개 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          ${statCard('총 유저', d.users?.total || 0, 'users', 'blue', `오늘 +${d.users?.today || 0}명`)}
          ${statCard('활성 그룹', d.groups?.active || 0, 'building', 'green', `대기 ${d.groups?.pending || 0}개`)}
          ${statCard('예정 행사', d.events?.upcoming || 0, 'calendar-alt', 'purple', `전체 ${d.events?.total || 0}개`)}
          ${statCard('미처리 신고', d.reports?.pending || 0, 'flag', 'red', `전체 ${d.reports?.total || 0}건`)}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 플랜 분포 -->
          <div class="bg-white rounded-xl p-4 shadow-sm border">
            <h3 class="font-semibold text-gray-800 text-sm mb-3">
              <i class="fas fa-chart-pie text-blue-500 mr-1.5"></i>플랜 분포
            </h3>
            <div class="space-y-2.5">
              ${planBar('Free', d.users?.free_plan || 0, d.users?.total || 1, 'gray')}
              ${planBar('Pro', d.users?.pro_plan || 0, d.users?.total || 1, 'blue')}
              ${planBar('Business', d.users?.business_plan || 0, d.users?.total || 1, 'purple')}
            </div>
          </div>

          <!-- 빠른 실행 -->
          <div class="bg-white rounded-xl p-4 shadow-sm border md:col-span-2">
            <h3 class="font-semibold text-gray-800 text-sm mb-3">
              <i class="fas fa-bolt text-yellow-500 mr-1.5"></i>빠른 실행
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <button onclick="navigateTo('groups')"
                class="p-3 bg-orange-50 hover:bg-orange-100 rounded-xl text-left transition">
                <i class="fas fa-building text-orange-500 text-lg mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">그룹 승인 대기</p>
                <p class="text-xl font-bold text-orange-600">${d.groups?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('reports')"
                class="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-left transition">
                <i class="fas fa-flag text-red-500 text-lg mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-xs">신고 처리 대기</p>
                <p class="text-xl font-bold text-red-600">${d.reports?.pending || 0}</p>
              </button>
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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
  };
  return `<div class="bg-white rounded-xl p-4 shadow-sm border">
    <div class="flex items-center justify-between mb-2">
      <div class="w-9 h-9 ${colors[color]} rounded-lg flex items-center justify-center">
        <i class="fas fa-${icon} text-base"></i>
      </div>
    </div>
    <p class="text-2xl font-bold text-gray-900">${value.toLocaleString()}</p>
    <p class="text-gray-500 text-xs mt-0.5">${label}</p>
    <p class="text-xs text-gray-400 mt-1">${sub}</p>
  </div>`;
}

function planBar(label, count, total, color) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors = { gray: 'bg-gray-400', blue: 'bg-blue-500', purple: 'bg-purple-500' };
  return `<div>
    <div class="flex justify-between text-xs mb-1">
      <span class="text-gray-600">${label}</span>
      <span class="font-semibold">${count} (${pct}%)</span>
    </div>
    <div class="h-1.5 bg-gray-100 rounded-full">
      <div class="h-1.5 ${colors[color]} rounded-full transition-all" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ── 유저 관리 ────────────────────────────────────────────
async function loadUsers(page = 1, search = '') {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/users?page=${page}&limit=20&q=${encodeURIComponent(search)}`);
    const { data: users, pagination } = data;

    setContent(`
      <div class="space-y-3">
        <!-- 검색 -->
        <div class="flex gap-2">
          <input type="text" id="user-search" placeholder="이름 또는 이메일 검색..."
            value="${search}"
            onkeydown="if(event.key==='Enter') loadUsers(1, this.value)"
            class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <button onclick="loadUsers(1, document.getElementById('user-search').value)"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap">
            <i class="fas fa-search mr-1"></i>검색
          </button>
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유형</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">플랜</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">가입일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${users.length === 0 ? `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-400 text-sm">유저가 없습니다.</td></tr>` : ''}
                ${users.map(u => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-xs text-gray-400">#${u.id}</td>
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${u.name}</p>
                      <p class="text-xs text-gray-400">${u.email}</p>
                    </td>
                    <td class="px-4 py-3">${accountTypeBadge(u.account_type)}</td>
                    <td class="px-4 py-3">${planBadge(u.plan)}</td>
                    <td class="px-4 py-3">
                      ${u.is_active
                        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">활성</span>'
                        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-400">${formatDate(u.created_at)}</td>
                    <td class="px-4 py-3">
                      <div class="flex gap-1">
                        <button onclick="toggleUserActive(${u.id}, ${u.is_active})"
                          class="text-xs px-2 py-1 border rounded hover:bg-gray-50
                                 ${u.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                          ${u.is_active ? '비활성화' : '활성화'}
                        </button>
                        <button onclick="changeUserPlan(${u.id}, '${u.plan}')"
                          class="text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50">
                          플랜
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 모바일 카드 리스트 -->
        <div class="md:hidden space-y-2">
          ${users.length === 0 ? `<div class="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">유저가 없습니다.</div>` : ''}
          ${users.map(u => `
            <div class="bg-white rounded-xl p-4 shadow-sm border">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <p class="font-medium text-gray-900 text-sm">${u.name}</p>
                  <p class="text-xs text-gray-400">${u.email}</p>
                </div>
                <div class="flex gap-1">
                  ${planBadge(u.plan)}
                  ${u.is_active
                    ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">활성</span>'
                    : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">비활성</span>'}
                </div>
              </div>
              <div class="flex items-center justify-between text-xs text-gray-400">
                <span>${accountTypeBadge(u.account_type)} · ${formatDate(u.created_at)}</span>
                <div class="flex gap-1">
                  <button onclick="toggleUserActive(${u.id}, ${u.is_active})"
                    class="px-2 py-1 border rounded text-xs
                           ${u.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                    ${u.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button onclick="changeUserPlan(${u.id}, '${u.plan}')"
                    class="px-2 py-1 border border-blue-200 text-blue-600 rounded text-xs">
                    플랜변경
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        ${renderPagination(pagination, 'loadUsers')}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('유저 목록을 불러오지 못했습니다.'));
  }
}

// ── 그룹 관리 ────────────────────────────────────────────
async function loadGroups(page = 1, status = 'pending') {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/groups?page=${page}&limit=20&status=${status}`);
    const { data: groups, pagination } = data;

    setContent(`
      <div class="space-y-3">
        <!-- 상단 액션 바 -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex gap-2 flex-wrap">
            ${['pending', 'active', 'suspended'].map(s => `
              <button onclick="loadGroups(1,'${s}')"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition
                       ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
                ${s === 'pending' ? '⏳ 승인대기' : s === 'active' ? '✅ 활성' : '🚫 정지'}
              </button>
            `).join('')}
          </div>
          <button onclick="showCreateGroupModal()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
            <i class="fas fa-plus"></i> 그룹 직접 생성
          </button>
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹명</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">관리자</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">공개</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${groups.length === 0 ? `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">데이터가 없습니다.</td></tr>` : ''}
              ${groups.map(g => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-gray-900">${g.name}</p>
                    <p class="text-xs text-gray-400 truncate max-w-xs">${g.description || '-'}</p>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-xs text-gray-900">${g.admin_name || '-'}</p>
                    <p class="text-xs text-gray-400">${g.admin_email || ''}</p>
                  </td>
                  <td class="px-4 py-3">${categoryBadge(g.category)}</td>
                  <td class="px-4 py-3">
                    <span class="text-xs ${g.visibility === 'public' ? 'text-green-600' : 'text-gray-400'}">
                      ${g.visibility === 'public' ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-400">${formatDate(g.created_at)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      ${status === 'pending' ? `
                        <button onclick="approveGroup(${g.id},'approve')"
                          class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">승인</button>
                        <button onclick="approveGroup(${g.id},'reject')"
                          class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">거절</button>
                      ` : ''}
                      ${status === 'active' ? `
                        <button onclick="approveGroup(${g.id},'suspend')"
                          class="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">정지</button>
                      ` : ''}
                      ${status === 'suspended' ? `
                        <button onclick="approveGroup(${g.id},'activate')"
                          class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">활성화</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 모바일 카드 -->
        <div class="md:hidden space-y-2">
          ${groups.length === 0 ? `<div class="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">데이터가 없습니다.</div>` : ''}
          ${groups.map(g => `
            <div class="bg-white rounded-xl p-4 shadow-sm border">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 text-sm">${g.name}</p>
                  <p class="text-xs text-gray-400 truncate">${g.description || '-'}</p>
                </div>
                ${categoryBadge(g.category)}
              </div>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-400">
                  <span>${g.admin_name || '-'}</span> · <span>${formatDate(g.created_at)}</span>
                </div>
                <div class="flex gap-1">
                  ${status === 'pending' ? `
                    <button onclick="approveGroup(${g.id},'approve')"
                      class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">승인</button>
                    <button onclick="approveGroup(${g.id},'reject')"
                      class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">거절</button>
                  ` : ''}
                  ${status === 'active' ? `
                    <button onclick="approveGroup(${g.id},'suspend')"
                      class="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">정지</button>
                  ` : ''}
                  ${status === 'suspended' ? `
                    <button onclick="approveGroup(${g.id},'activate')"
                      class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">활성화</button>
                  ` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        ${renderPagination(pagination, 'loadGroups')}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('그룹 목록을 불러오지 못했습니다.'));
  }
}

// ── 신고 관리 ────────────────────────────────────────────
async function loadReports(page = 1, status = 'pending') {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/reports?page=${page}&limit=20&status=${status}`);
    const { data: reports, pagination } = data;

    setContent(`
      <div class="space-y-3">
        <div class="flex gap-2 flex-wrap">
          ${['pending', 'reviewed', 'resolved', 'dismissed'].map(s => `
            <button onclick="loadReports(1,'${s}')"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition
                     ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
              ${s === 'pending' ? '대기' : s === 'reviewed' ? '검토중' : s === 'resolved' ? '처리완료' : '기각'}
            </button>
          `).join('')}
        </div>
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신고자</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">대상</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">사유</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">날짜</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${reports.length === 0 ? `<tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">신고 내역이 없습니다.</td></tr>` : ''}
                ${reports.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3">
                      <p class="text-xs font-medium text-gray-900">${r.reporter_name}</p>
                      <p class="text-xs text-gray-400">${r.reporter_email}</p>
                    </td>
                    <td class="px-4 py-3">
                      <span class="text-xs px-2 py-0.5 bg-gray-100 rounded">${r.target_type} #${r.target_id}</span>
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-700">${r.reason}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${formatDate(r.created_at)}</td>
                    <td class="px-4 py-3">
                      <div class="flex gap-1">
                        ${status === 'pending' ? `
                          <button onclick="resolveReport(${r.id},'resolved')"
                            class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">처리완료</button>
                          <button onclick="resolveReport(${r.id},'dismissed')"
                            class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">기각</button>
                        ` : `<span class="text-xs text-gray-400">-</span>`}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${renderPagination(pagination, 'loadReports')}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('신고 목록을 불러오지 못했습니다.'));
  }
}

// ── 파트너 관리 ──────────────────────────────────────────
async function loadPartners() {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get('/admin/partners');
    const partners = data.data;

    setContent(`
      <div class="space-y-3">
        <div class="flex justify-end">
          <button onclick="showAddPartnerForm()"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <i class="fas fa-plus mr-1.5"></i>파트너 등록
          </button>
        </div>
        <div id="partner-form" class="hidden bg-white rounded-xl shadow-sm border p-4">
          <h3 class="font-semibold text-sm mb-3">새 파트너 서비스 등록</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" id="p-name" placeholder="서비스 이름"
              class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <input type="text" id="p-desc" placeholder="서비스 설명"
              class="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="mt-3 flex gap-2">
            <button onclick="addPartner()"
              class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">등록</button>
            <button onclick="document.getElementById('partner-form').classList.add('hidden')"
              class="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50">취소</button>
          </div>
          <div id="new-apikey" class="hidden mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-xs font-semibold text-yellow-800 mb-1">⚠️ API 키 (최초 1회만 표시)</p>
            <code id="apikey-val" class="text-xs font-mono break-all text-yellow-900"></code>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">서비스명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">설명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">등록일</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${partners.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">등록된 파트너가 없습니다.</td></tr>` : ''}
                ${partners.map(p => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${p.name}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${p.description || '-'}</td>
                    <td class="px-4 py-3">
                      ${p.status === 'active'
                        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">활성</span>'
                        : '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-400">${formatDate(p.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(errorBox('파트너 목록을 불러오지 못했습니다.'));
  }
}

// ── 행사 / NFC / 리워드 (심플 테이블) ────────────────────
async function loadEvents(page = 1) {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/events?limit=20&page=${page}&status=`);
    const rows = data.data || [];
    const pagination = data.pagination;
    setContent(`
      <div class="space-y-3">
        <div class="flex justify-end">
          <button onclick="showCreateEventModal()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
            <i class="fas fa-plus"></i> 행사 생성
          </button>
        </div>
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">일정</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">행사가 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${r.title ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.group_name ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.starts_at ? formatDate(r.starts_at) : '-'}</td>
                    <td class="px-4 py-3">${eventStatusBadge(r.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${pagination ? renderPagination(pagination, 'loadEvents') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('행사 목록을 불러오지 못했습니다.'));
  }
}

// ── 그룹 생성 모달 ──────────────────────────────────
function showCreateGroupModal() {
  const modal = document.createElement('div');
  modal.id = 'create-group-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">그룹 직접 생성</h3>
        <button onclick="document.getElementById('create-group-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">그룹명 <span class="text-red-500">*</span></label>
          <input type="text" id="cg-name" placeholder="그룹명 입력 (2~100자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">설명</label>
          <textarea id="cg-desc" rows="3" placeholder="그룹 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">카테고리</label>
            <select id="cg-category" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="association">협회</option>
              <option value="company">기업</option>
              <option value="club">동호회</option>
              <option value="other" selected>기타</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="cg-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">최대 멤버 수</label>
          <input type="number" id="cg-maxmembers" placeholder="제한 없음 (비워두면 무제한)" min="1"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div id="cg-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
      </div>
      <div class="px-5 pb-5 flex gap-2">
        <button onclick="submitCreateGroup()"
          class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          생성하기
        </button>
        <button onclick="document.getElementById('create-group-modal').remove()"
          class="px-4 py-2.5 border text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('cg-name')?.focus(), 100);
}

async function submitCreateGroup() {
  const name = document.getElementById('cg-name')?.value.trim();
  const desc = document.getElementById('cg-desc')?.value.trim();
  const category = document.getElementById('cg-category')?.value;
  const visibility = document.getElementById('cg-visibility')?.value;
  const maxVal = document.getElementById('cg-maxmembers')?.value;
  const errEl = document.getElementById('cg-error');

  if (!name || name.length < 2) {
    errEl.textContent = '그룹명을 2자 이상 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = { name, category, visibility };
  if (desc) payload.description = desc;
  if (maxVal) payload.max_members = parseInt(maxVal);

  try {
    await axios.post('/admin/groups', payload);
    document.getElementById('create-group-modal')?.remove();
    showToast('그룹이 생성되었습니다.', 'success');
    loadGroups(1, 'active');
  } catch (err) {
    const msg = err.response?.data?.message || '그룹 생성에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

// ── 행사 생성 모달 ──────────────────────────────────
async function showCreateEventModal() {
  // 활성 그룹 목록 가져오기 (그룹 선택 드롭다운용)
  let groupOptions = '<option value="">그룹 불러오는 중...</option>';
  try {
    const { data } = await axios.get('/admin/groups?status=active&limit=100');
    const groups = data.data || [];
    if (groups.length === 0) {
      groupOptions = '<option value="">활성 그룹 없음</option>';
    } else {
      groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
  } catch (e) {
    groupOptions = '<option value="">그룹 로드 실패</option>';
  }

  const modal = document.createElement('div');
  modal.id = 'create-event-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">행사 생성</h3>
        <button onclick="document.getElementById('create-event-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">그룹 선택 <span class="text-red-500">*</span></label>
          <select id="ce-group" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${groupOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">행사명 <span class="text-red-500">*</span></label>
          <input type="text" id="ce-title" placeholder="행사명 입력 (2~200자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">행사 설명</label>
          <textarea id="ce-desc" rows="3" placeholder="행사 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">장소</label>
          <input type="text" id="ce-location" placeholder="행사 장소 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">시작일시 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" id="ce-starts-date"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onclick="this.showPicker && this.showPicker()">
            <select id="ce-starts-hour"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">시간 선택</option>
              ${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">종료일시</label>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" id="ce-ends-date"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onclick="this.showPicker && this.showPicker()">
            <select id="ce-ends-hour"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">시간 선택</option>
              ${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="ce-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="group_only">그룹 전용</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">참가 방식</label>
            <select id="ce-regtype" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="free" selected>자유 참가</option>
              <option value="pre_required">사전 신청</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">입장 방식</label>
            <select id="ce-entry" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="qr" selected>QR</option>
              <option value="nfc_qr">NFC+QR</option>
              <option value="manual">수동</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">최대 참가자</label>
            <input type="number" id="ce-maxpart" placeholder="무제한" min="1"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div id="ce-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
      </div>
      <div class="px-5 pb-5 flex gap-2">
        <button onclick="submitCreateEvent()"
          class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          행사 생성
        </button>
        <button onclick="document.getElementById('create-event-modal').remove()"
          class="px-4 py-2.5 border text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitCreateEvent() {
  const groupId = document.getElementById('ce-group')?.value;
  const title = document.getElementById('ce-title')?.value.trim();
  const desc = document.getElementById('ce-desc')?.value.trim();
  const location = document.getElementById('ce-location')?.value.trim();
  const startsDate = document.getElementById('ce-starts-date')?.value;
  const startsHour = document.getElementById('ce-starts-hour')?.value;
  const endsDate = document.getElementById('ce-ends-date')?.value;
  const endsHour = document.getElementById('ce-ends-hour')?.value;
  const startsRaw = (startsDate && startsHour) ? `${startsDate}T${startsHour}:00` : '';
  const endsRaw   = (endsDate && endsHour)     ? `${endsDate}T${endsHour}:00`     : '';
  const visibility = document.getElementById('ce-visibility')?.value;
  const regtype = document.getElementById('ce-regtype')?.value;
  const entry = document.getElementById('ce-entry')?.value;
  const maxVal = document.getElementById('ce-maxpart')?.value;
  const errEl = document.getElementById('ce-error');

  if (!groupId) {
    errEl.textContent = '그룹을 선택해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (!title || title.length < 2) {
    errEl.textContent = '행사명을 2자 이상 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (!startsRaw) {
    errEl.textContent = '시작일시를 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = {
    group_id: parseInt(groupId),
    title,
    starts_at: new Date(startsRaw).toISOString(),
    visibility,
    registration_type: regtype,
    entry_method: entry
  };
  if (desc) payload.description = desc;
  if (location) payload.location = location;
  if (endsRaw) payload.ends_at = new Date(endsRaw).toISOString();
  if (maxVal) payload.max_participants = parseInt(maxVal);

  try {
    await axios.post('/admin/events', payload);
    document.getElementById('create-event-modal')?.remove();
    showToast('행사가 생성되었습니다.', 'success');
    loadEvents();
  } catch (err) {
    const msg = err.response?.data?.message || '행사 생성에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

async function loadNfcCards(page = 1) {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/nfc-cards?limit=20&page=${page}`);
    const rows = data.data || [];
    const pagination = data.pagination;
    setContent(`
      <div class="space-y-3">
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">NFC 카드 신청이 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-900">${r.user_name ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.group_name ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.status ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.applied_at ? formatDate(r.applied_at) : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${pagination ? renderPagination(pagination, 'loadNfcCards') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('NFC 카드 목록을 불러오지 못했습니다.'));
  }
}

async function loadRewards(page = 1) {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/rewards?limit=20&page=${page}`);
    const rows = data.data || [];
    const pagination = data.pagination;
    setContent(`
      <div class="space-y-3">
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">파트너</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">포인트</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">날짜</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">리워드 내역이 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-900">${r.name ?? '-'}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.partner_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-blue-600">+${r.points ?? 0}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${r.created_at ? formatDate(r.created_at) : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ${pagination ? renderPagination(pagination, 'loadRewards') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('리워드 내역을 불러오지 못했습니다.'));
  }
}

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

async function resolveReport(reportId, status) {
  try {
    await axios.patch(`/admin/reports/${reportId}`, { status });
    showToast('신고가 처리되었습니다.', 'success');
    loadReports();
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

function showAddPartnerForm() {
  document.getElementById('partner-form').classList.remove('hidden');
}

async function addPartner() {
  const name = document.getElementById('p-name').value.trim();
  const desc = document.getElementById('p-desc').value.trim();
  if (!name) { showToast('서비스 이름을 입력하세요.', 'error'); return; }
  try {
    const { data } = await axios.post('/admin/partners', { name, description: desc });
    document.getElementById('new-apikey').classList.remove('hidden');
    document.getElementById('apikey-val').textContent = data.data.api_key;
    showToast('파트너 서비스가 등록되었습니다.', 'success');
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// ── 유틸리티 ─────────────────────────────────────────────
function setContent(html) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = html;
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

  if (start > 1) btns.push(`<button onclick="${loadFn}(1)" class="w-8 h-8 rounded text-xs border hover:bg-gray-50">1</button>`);
  if (start > 2) btns.push(`<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>`);
  for (let i = start; i <= end; i++) {
    btns.push(`<button onclick="${loadFn}(${i})"
      class="w-8 h-8 rounded text-xs font-medium transition
             ${i === current ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50 text-gray-600'}">${i}</button>`);
  }
  if (end < total - 1) btns.push(`<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>`);
  if (end < total) btns.push(`<button onclick="${loadFn}(${total})" class="w-8 h-8 rounded text-xs border hover:bg-gray-50">${total}</button>`);

  return `<div class="flex justify-center gap-1 pt-2">${btns.join('')}</div>`;
}

function planBadge(plan) {
  const map = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    business: 'bg-purple-100 text-purple-700'
  };
  return `<span class="px-2 py-0.5 ${map[plan] || map.free} text-xs font-semibold rounded-full capitalize">${plan}</span>`;
}

function accountTypeBadge(type) {
  const map = { personal: 'bg-gray-100 text-gray-600', headhunter: 'bg-orange-100 text-orange-700' };
  const labels = { personal: '일반', headhunter: '헤드헌터' };
  return `<span class="px-2 py-0.5 ${map[type] || map.personal} text-xs rounded-full">${labels[type] || type}</span>`;
}

function categoryBadge(cat) {
  const map = { association: '협회', company: '기업', club: '동호회', other: '기타' };
  return `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">${map[cat] || cat || '-'}</span>`;
}

function eventStatusBadge(status) {
  const map = {
    upcoming: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500'
  };
  const labels = { upcoming: '예정', ongoing: '진행중', ended: '종료' };
  return `<span class="px-2 py-0.5 ${map[status] || 'bg-gray-100 text-gray-500'} text-xs rounded-full">${labels[status] || status || '-'}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit'
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
