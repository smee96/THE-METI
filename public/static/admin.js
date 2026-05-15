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
          ${navItem('dashboard', 'tachometer-alt', '대시보드')}
          ${navItem('users', 'users', '유저 관리')}
          ${navItem('groups', 'building', '그룹 관리')}
          ${navItem('cards', 'id-card', '명함 관리')}
          ${navItem('events', 'calendar-alt', '행사 관리')}
          ${navItem('lessons', 'chalkboard-teacher', '레슨 관리')}
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-2 pb-0.5">운영</p>
          ${navItem('reports', 'flag', '신고 관리')}
          ${navItem('nfc-cards', 'credit-card', 'NFC 카드')}
          ${navItem('partners', 'handshake', '파트너')}
          ${navItem('rewards', 'gift', '리워드')}
          <p class="text-slate-500 text-sm uppercase font-semibold px-2 pt-2 pb-0.5">설정</p>
          ${navItem('plan-configs', 'sliders-h', '플랜 설정')}
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
    partners: '파트너 서비스', rewards: '리워드 내역'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[section] || section;

  const pages = {
    dashboard: loadDashboard, users: loadUsers, groups: loadGroups, cards: loadCards,
    events: loadEvents, lessons: loadLessons, reports: loadReports, 'nfc-cards': loadNfcCards,
    partners: loadPartners, rewards: loadRewards, 'plan-configs': loadPlanConfigs
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
                <p class="font-semibold text-gray-800 text-sm">그룹 승인 대기</p>
                <p class="text-xl font-bold text-orange-600">${d.groups?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('reports')"
                class="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-left transition">
                <i class="fas fa-flag text-red-500 text-lg mb-1 block"></i>
                <p class="font-semibold text-gray-800 text-sm">신고 처리 대기</p>
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
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">ID</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">유형</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">플랜</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">가입일</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${users.length === 0 ? `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-400 text-sm">유저가 없습니다.</td></tr>` : ''}
                ${users.map(u => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-400">#${u.id}</td>
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${u.name}</p>
                      <p class="text-sm text-gray-400">${u.email}</p>
                    </td>
                    <td class="px-4 py-3">${accountTypeBadge(u.account_type)}</td>
                    <td class="px-4 py-3">${planBadge(u.plan)}</td>
                    <td class="px-4 py-3">
                      ${u.is_active
                        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
                        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-400">${formatDate(u.created_at)}</td>
                    <td class="px-4 py-3">
                      <div class="flex gap-1">
                        <button onclick="showUserDetail(${u.id})"
                          class="text-sm px-2 py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50">
                          상세
                        </button>
                        <button onclick="toggleUserActive(${u.id}, ${u.is_active})"
                          class="text-sm px-2 py-1 border rounded hover:bg-gray-50
                                 ${u.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                          ${u.is_active ? '비활성' : '활성화'}
                        </button>
                        <button onclick="changeUserPlan(${u.id}, '${u.plan}')"
                          class="text-sm px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50">
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
                  <p class="text-sm text-gray-400">${u.email}</p>
                </div>
                <div class="flex gap-1">
                  ${planBadge(u.plan)}
                  ${u.is_active
                    ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
                    : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">비활성</span>'}
                </div>
              </div>
              <div class="flex items-center justify-between text-sm text-gray-400">
                <span>${accountTypeBadge(u.account_type)} · ${formatDate(u.created_at)}</span>
                <div class="flex gap-1">
                  <button onclick="showUserDetail(${u.id})"
                    class="px-2 py-1 border border-gray-200 text-gray-600 rounded text-sm">
                    상세
                  </button>
                  <button onclick="toggleUserActive(${u.id}, ${u.is_active})"
                    class="px-2 py-1 border rounded text-sm
                           ${u.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                    ${u.is_active ? '비활성' : '활성화'}
                  </button>
                  <button onclick="changeUserPlan(${u.id}, '${u.plan}')"
                    class="px-2 py-1 border border-blue-200 text-blue-600 rounded text-sm">
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
async function loadGroups(page = 1, status = 'all') {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/groups?page=${page}&limit=20${status !== 'all' ? '&status=' + status : ''}`);
    const { data: groups, pagination } = data;

    setContent(`
      <div class="space-y-3">
        <!-- 상단 액션 바 -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex gap-2 flex-wrap">
            ${['all', 'pending', 'active', 'suspended'].map(s => `
              <button onclick="loadGroups(1,'${s}')"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition
                       ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
                ${s === 'all' ? '전체' : s === 'pending' ? '⏳ 승인대기' : s === 'active' ? '✅ 활성' : '🚫 정지'}
              </button>
            `).join('')}
          </div>
          <button onclick="showCreateGroupModal()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <i class="fas fa-plus"></i> 그룹 직접 생성
          </button>
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">그룹명</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">관리자</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">카테고리</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">공개</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">신청일</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${groups.length === 0 ? `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">데이터가 없습니다.</td></tr>` : ''}
              ${groups.map(g => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-gray-900">${g.name}</p>
                    <p class="text-sm text-gray-400 truncate max-w-xs">${g.description || '-'}</p>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm text-gray-900">${g.admin_name || '-'}</p>
                    <p class="text-sm text-gray-400">${g.admin_email || ''}</p>
                  </td>
                  <td class="px-4 py-3">${categoryBadge(g.category)}</td>
                  <td class="px-4 py-3">
                    <span class="text-sm ${g.visibility === 'public' ? 'text-green-600' : 'text-gray-400'}">
                      ${g.visibility === 'public' ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-400">${formatDate(g.created_at)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      ${(status === 'pending' || (status === 'all' && g.status === 'pending')) ? `
                        <button onclick="approveGroup(${g.id},'approve')"
                          class="text-sm px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">승인</button>
                        <button onclick="approveGroup(${g.id},'reject')"
                          class="text-sm px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">거절</button>
                      ` : ''}
                      ${(status === 'active' || (status === 'all' && g.status === 'active')) ? `
                        <button onclick="approveGroup(${g.id},'suspend')"
                          class="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">정지</button>
                      ` : ''}
                      ${(status === 'suspended' || (status === 'all' && g.status === 'suspended')) ? `
                        <button onclick="approveGroup(${g.id},'activate')"
                          class="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">활성화</button>
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
                  <p class="text-sm text-gray-400 truncate">${g.description || '-'}</p>
                </div>
                ${categoryBadge(g.category)}
              </div>
              <div class="flex items-center justify-between">
                <div class="text-sm text-gray-400">
                  <span>${g.admin_name || '-'}</span> · <span>${formatDate(g.created_at)}</span>
                </div>
                <div class="flex gap-1">
                  ${(status === 'pending' || (status === 'all' && g.status === 'pending')) ? `
                    <button onclick="approveGroup(${g.id},'approve')"
                      class="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">승인</button>
                    <button onclick="approveGroup(${g.id},'reject')"
                      class="text-sm px-2 py-1 bg-red-100 text-red-700 rounded">거절</button>
                  ` : ''}
                  ${(status === 'active' || (status === 'all' && g.status === 'active')) ? `
                    <button onclick="approveGroup(${g.id},'suspend')"
                      class="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded">정지</button>
                  ` : ''}
                  ${(status === 'suspended' || (status === 'all' && g.status === 'suspended')) ? `
                    <button onclick="approveGroup(${g.id},'activate')"
                      class="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">활성화</button>
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

// ── 명함 관리 탭 ─────────────────────────────────────────
async function loadCards(page = 1, search = '', activeFilter = '') {
  setContent(loadingSpinner());
  try {
    let url = `/admin/cards?page=${page}&limit=20`;
    if (search)       url += `&q=${encodeURIComponent(search)}`;
    if (activeFilter !== '') url += `&active=${activeFilter}`;
    const { data } = await axios.get(url);
    const { data: cards, pagination } = data;

    setContent(`
      <div class="space-y-3">
        <!-- 필터 바 -->
        <div class="flex flex-wrap gap-2">
          <input type="text" id="card-search" placeholder="유저명·이메일·명함명 검색..."
            value="${search}"
            onkeydown="if(event.key==='Enter') loadCards(1,this.value,document.getElementById('card-active-filter').value)"
            class="flex-1 min-w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <select id="card-active-filter"
            onchange="loadCards(1,document.getElementById('card-search').value,this.value)"
            class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="" ${activeFilter===''?'selected':''}>전체</option>
            <option value="1" ${activeFilter==='1'?'selected':''}>활성</option>
            <option value="0" ${activeFilter==='0'?'selected':''}>비활성</option>
          </select>
          <button onclick="loadCards(1,document.getElementById('card-search').value,document.getElementById('card-active-filter').value)"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <i class="fas fa-search mr-1"></i>검색
          </button>
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">명함</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">소유자</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">기본</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">생성일</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${cards.length === 0 ? `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">명함이 없습니다.</td></tr>` : ''}
                ${cards.map(card => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${card.title || '(제목 없음)'}</p>
                      <p class="text-sm text-gray-400">${card.job_title || ''} ${card.company ? '· ' + card.company : ''}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="text-sm text-gray-900">${card.user_name}</p>
                      <p class="text-sm text-gray-400">${card.user_email}</p>
                    </td>
                    <td class="px-4 py-3">
                      ${card.is_default
                        ? '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-sm rounded-full">기본</span>'
                        : '<span class="text-gray-300 text-sm">-</span>'}
                    </td>
                    <td class="px-4 py-3">
                      ${card.is_active
                        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
                        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-400">${formatDate(card.created_at)}</td>
                    <td class="px-4 py-3">
                      <button onclick="toggleCardActive(${card.id}, ${card.is_active}, '${search}', '${activeFilter}')"
                        class="text-sm px-2 py-1 border rounded hover:bg-gray-50
                               ${card.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                        ${card.is_active ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 모바일 카드 -->
        <div class="md:hidden space-y-2">
          ${cards.length === 0 ? `<div class="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">명함이 없습니다.</div>` : ''}
          ${cards.map(card => `
            <div class="bg-white rounded-xl p-4 shadow-sm border">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 text-sm">${card.title || '(제목 없음)'}</p>
                  <p class="text-sm text-gray-400">${card.user_name} · ${card.user_email}</p>
                </div>
                <div class="flex gap-1 flex-shrink-0 ml-2">
                  ${card.is_active
                    ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
                    : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">비활성</span>'}
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400">${formatDate(card.created_at)}</span>
                <button onclick="toggleCardActive(${card.id}, ${card.is_active}, '${search}', '${activeFilter}')"
                  class="text-sm px-2 py-1 border rounded
                         ${card.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                  ${card.is_active ? '비활성화' : '활성화'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        ${renderPagination(pagination, 'loadCards')}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('명함 목록을 불러오지 못했습니다.'));
  }
}

async function toggleCardActive(cardId, currentActive, search = '', activeFilter = '') {
  const action = currentActive ? '비활성화' : '활성화';
  if (!confirm(`이 명함을 ${action}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/cards/${cardId}`, { is_active: currentActive ? 0 : 1 });
    showToast(`명함이 ${action}되었습니다.`, 'success');
    loadCards(1, search, activeFilter);
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
  }
}

// ── 유저 상세 모달 ────────────────────────────────────────
async function showUserDetail(userId) {
  // 모달 먼저 열기 (로딩 상태)
  const modal = document.createElement('div');
  modal.id = 'user-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">유저 상세 정보</h3>
        <button onclick="document.getElementById('user-detail-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div id="user-detail-body" class="p-5">
        <div class="flex items-center justify-center py-10">
          <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/users/${userId}/detail`);
    const { user, cards, groups, point_balance } = data.data;

    document.getElementById('user-detail-body').innerHTML = `
      <!-- 유저 기본 정보 -->
      <div class="flex items-start gap-4 mb-5">
        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i class="fas fa-user text-blue-600 text-lg"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-lg font-bold text-gray-900">${user.name}</h4>
            ${planBadge(user.plan)}
            ${user.is_active
              ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
              : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">비활성</span>'}
          </div>
          <p class="text-sm text-gray-500 mt-0.5">${user.email}</p>
          <p class="text-sm text-gray-400">가입일: ${formatDate(user.created_at)} · ID: #${user.id}</p>
        </div>
        <div class="flex-shrink-0 text-right">
          <p class="text-2xl font-bold text-blue-600">${point_balance.toLocaleString()}<span class="text-sm font-normal text-gray-400 ml-1">P</span></p>
          <p class="text-sm text-gray-400">보유 포인트</p>
        </div>
      </div>

      <!-- 탭 -->
      <div class="border-b mb-4">
        <div class="flex gap-1">
          <button onclick="switchDetailTab('cards')" id="tab-cards"
            class="detail-tab px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            <i class="fas fa-id-card mr-1"></i>명함 (${cards.length})
          </button>
          <button onclick="switchDetailTab('groups')" id="tab-groups"
            class="detail-tab px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
            <i class="fas fa-building mr-1"></i>그룹 (${groups.length})
          </button>
          <button onclick="switchDetailTab('points', ${userId})" id="tab-points"
            class="detail-tab px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
            <i class="fas fa-coins mr-1"></i>포인트
          </button>
        </div>
      </div>

      <!-- 명함 탭 -->
      <div id="detail-cards" class="detail-pane">
        ${cards.length === 0
          ? '<p class="text-sm text-gray-400 py-4 text-center">등록된 명함이 없습니다.</p>'
          : `<div class="space-y-2">
              ${cards.map(card => `
                <div class="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                  <div>
                    <p class="text-sm font-medium text-gray-900">${card.title || '(제목 없음)'}
                      ${card.is_default ? '<span class="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">기본</span>' : ''}
                    </p>
                    <p class="text-sm text-gray-400">${card.job_title || ''} ${card.company ? '· ' + card.company : ''}</p>
                  </div>
                  <span class="text-sm ${card.is_active ? 'text-green-600' : 'text-red-500'}">${card.is_active ? '활성' : '비활성'}</span>
                </div>
              `).join('')}
             </div>`
        }
      </div>

      <!-- 그룹 탭 -->
      <div id="detail-groups" class="detail-pane hidden">
        ${groups.length === 0
          ? '<p class="text-sm text-gray-400 py-4 text-center">소속 그룹이 없습니다.</p>'
          : `<div class="space-y-2">
              ${groups.map(g => `
                <div class="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                  <div>
                    <p class="text-sm font-medium text-gray-900">${g.name}</p>
                    <p class="text-sm text-gray-400">가입: ${formatDate(g.joined_at)}</p>
                  </div>
                  <div class="flex gap-2 items-center">
                    <span class="text-sm px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">${g.role}</span>
                    <span class="text-sm ${g.status === 'active' ? 'text-green-600' : 'text-gray-400'}">${g.status}</span>
                  </div>
                </div>
              `).join('')}
             </div>`
        }
      </div>

      <!-- 포인트 탭 -->
      <div id="detail-points" class="detail-pane hidden">
        <!-- 지급/차감 폼 -->
        <div class="mb-4 p-3 bg-gray-50 border rounded-xl space-y-2">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">포인트 지급 / 차감</span>
            <span class="text-sm font-bold text-blue-600">${point_balance.toLocaleString()} P</span>
          </div>
          <div class="flex gap-2">
            <input type="number" id="pt-amount-${userId}" placeholder="양수 지급 · 음수 차감"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
            <input type="text" id="pt-desc-${userId}" placeholder="사유 입력"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
            <button onclick="submitUserPoints(${userId})"
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
              처리
            </button>
          </div>
          <div id="pt-error-${userId}" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"></div>
        </div>
        <!-- 내역 목록 (동적 로드) -->
        <div id="pt-history-${userId}">
          <div class="flex items-center justify-center py-6">
            <i class="fas fa-spinner fa-spin text-blue-400 text-xl"></i>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('user-detail-body').innerHTML = `
      <div class="text-center py-10 text-red-500 text-sm">
        <i class="fas fa-exclamation-circle mr-2"></i>유저 정보를 불러오지 못했습니다.
      </div>`;
  }
}

function switchDetailTab(tab, userId) {
  // 모든 탭 비활성화
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.classList.remove('border-blue-600', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.detail-pane').forEach(pane => pane.classList.add('hidden'));
  // 선택한 탭 활성화
  const activeTab = document.getElementById(`tab-${tab}`);
  if (activeTab) {
    activeTab.classList.add('border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }
  const activePane = document.getElementById(`detail-${tab}`);
  if (activePane) activePane.classList.remove('hidden');
  // 포인트 탭: 내역 자동 로드
  if (tab === 'points' && userId) {
    loadPointHistory(userId, 1);
  }
}

async function submitUserPoints(userId) {
  const amountEl = document.getElementById(`pt-amount-${userId}`);
  const descEl   = document.getElementById(`pt-desc-${userId}`);
  const errEl    = document.getElementById(`pt-error-${userId}`);

  const amount = parseInt(amountEl?.value ?? '');
  const description = descEl?.value.trim() ?? '';

  if (isNaN(amount) || amount === 0) {
    errEl.textContent = '0이 아닌 정수를 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (!description) {
    errEl.textContent = '사유를 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  try {
    const { data } = await axios.post(`/admin/users/${userId}/points`, { amount, description });
    showToast(data.message || `포인트 처리 완료`, 'success');
    // 입력 초기화 + 잔액 갱신 + 내역 갱신
    amountEl.value = '';
    descEl.value   = '';
    // 잔액 표시 갱신
    const newBal = data.data?.new_balance;
    if (newBal !== undefined) {
      const balEls = document.querySelectorAll('#user-detail-modal .point-balance-display');
      balEls.forEach(el => { el.textContent = newBal.toLocaleString() + ' P'; });
    }
    loadPointHistory(userId, 1);
    showToast(data.message || '포인트 처리 완료', 'success');
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || '포인트 처리에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

// 포인트 내역 로드
async function loadPointHistory(userId, page = 1) {
  const container = document.getElementById(`pt-history-${userId}`);
  if (!container) return;

  container.innerHTML = `<div class="flex items-center justify-center py-6">
    <i class="fas fa-spinner fa-spin text-blue-400 text-xl"></i>
  </div>`;

  try {
    const { data } = await axios.get(`/admin/users/${userId}/point-history?page=${page}&limit=20`);
    const { transactions = [], balance, pagination } = data.data;

    const typeLabel = {
      charge_subscription : { label: '구독 충전',   color: 'text-blue-600' },
      charge_purchase     : { label: '구매 충전',   color: 'text-blue-600' },
      charge_admin        : { label: '관리자 지급', color: 'text-green-600' },
      charge_transfer_in  : { label: '이체 입금',   color: 'text-green-600' },
      use_card_extra      : { label: '명함 추가',   color: 'text-orange-500' },
      use_event_create    : { label: '행사 개설',   color: 'text-orange-500' },
      use_nfc_card        : { label: 'NFC 카드',    color: 'text-orange-500' },
      use_partner         : { label: '파트너 이용', color: 'text-orange-500' },
      use_transfer_out    : { label: '이체 출금',   color: 'text-orange-500' },
      use_admin           : { label: '관리자 차감', color: 'text-red-500' },
      expire              : { label: '포인트 만료', color: 'text-gray-400' },
    };

    if (transactions.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-400 py-6 text-center">포인트 거래 내역이 없습니다.</p>`;
      return;
    }

    const rows = transactions.map(tx => {
      const sign   = tx.amount > 0 ? '+' : '';
      const tInfo  = typeLabel[tx.type] || { label: tx.type, color: 'text-gray-500' };
      const amtCls = tx.amount > 0 ? 'text-blue-600' : 'text-red-500';
      return `
        <div class="flex items-center justify-between py-2.5 border-b last:border-0">
          <div class="flex-1 min-w-0 mr-3">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-medium px-1.5 py-0.5 bg-gray-100 rounded ${tInfo.color}">${tInfo.label}</span>
              <span class="text-xs text-gray-500 truncate">${escHtml(tx.description ?? '')}</span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">${formatDateTime(tx.created_at)}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-bold ${amtCls}">${sign}${tx.amount.toLocaleString()} P</p>
            <p class="text-xs text-gray-400">${tx.balance_after.toLocaleString()} P</p>
          </div>
        </div>`;
    }).join('');

    const totalPages = pagination?.total_pages ?? 1;
    const paginationHtml = totalPages > 1 ? `
      <div class="flex items-center justify-between pt-3 mt-1 border-t">
        <span class="text-xs text-gray-500">총 ${pagination.total}건</span>
        <div class="flex gap-1">
          ${page > 1 ? `<button onclick="loadPointHistory(${userId},${page-1})"
            class="px-2 py-1 text-xs border rounded hover:bg-gray-50">이전</button>` : ''}
          <span class="px-2 py-1 text-xs text-gray-600">${page} / ${totalPages}</span>
          ${page < totalPages ? `<button onclick="loadPointHistory(${userId},${page+1})"
            class="px-2 py-1 text-xs border rounded hover:bg-gray-50">다음</button>` : ''}
        </div>
      </div>` : `<p class="text-xs text-gray-400 pt-2 text-right">총 ${pagination?.total ?? transactions.length}건</p>`;

    container.innerHTML = `
      <div class="max-h-64 overflow-y-auto">${rows}</div>
      ${paginationHtml}
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 py-4 text-center">내역을 불러오지 못했습니다.</p>`;
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
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition
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
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">신고자</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">대상</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">사유</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">날짜</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${reports.length === 0 ? `<tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">신고 내역이 없습니다.</td></tr>` : ''}
                ${reports.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${r.reporter_name}</p>
                      <p class="text-sm text-gray-400">${r.reporter_email}</p>
                    </td>
                    <td class="px-4 py-3">
                      <span class="text-sm px-2 py-0.5 bg-gray-100 rounded">${r.target_type} #${r.target_id}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">${r.reason}</td>
                    <td class="px-4 py-3 text-sm text-gray-400">${formatDate(r.created_at)}</td>
                    <td class="px-4 py-3">
                      <div class="flex gap-1">
                        ${status === 'pending' ? `
                          <button onclick="resolveReport(${r.id},'resolved')"
                            class="text-sm px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">처리완료</button>
                          <button onclick="resolveReport(${r.id},'dismissed')"
                            class="text-sm px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">기각</button>
                        ` : `<span class="text-sm text-gray-400">-</span>`}
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
            <p class="text-sm font-semibold text-yellow-800 mb-1">⚠️ API 키 (최초 1회만 표시)</p>
            <code id="apikey-val" class="text-sm font-mono break-all text-yellow-900"></code>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">서비스명</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">설명</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">등록일</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${partners.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">등록된 파트너가 없습니다.</td></tr>` : ''}
                ${partners.map(p => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${p.name}</td>
                    <td class="px-4 py-3 text-sm text-gray-400">${p.description || '-'}</td>
                    <td class="px-4 py-3">
                      ${p.status === 'active'
                        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full">활성</span>'
                        : '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">비활성</span>'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-400">${formatDate(p.created_at)}</td>
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
let _eventsStatus = 'all';
function loadEventsPage(page) { loadEvents(page, _eventsStatus); }

async function loadEvents(page = 1, status = 'all') {
  _eventsStatus = status;
  setContent(loadingSpinner());
  try {
    const statusParam = status === 'all' ? '' : status;
    const { data } = await axios.get(`/admin/events?limit=20&page=${page}&status=${statusParam}`);
    const rows = data.data || [];
    const pagination = data.pagination;

    const tabs = ['all','upcoming','ongoing','ended','cancelled'];
    const tabLabels = { all:'전체', upcoming:'예정', ongoing:'진행중', ended:'종료', cancelled:'취소' };

    setContent(`
      <div class="space-y-3">
        <!-- 상단: 탭 필터 + 생성 버튼 -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="flex gap-1.5 flex-wrap">
            ${tabs.map(t => `
              <button onclick="loadEvents(1,'${t}')"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition
                       ${status === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
                ${tabLabels[t]}
              </button>
            `).join('')}
          </div>
          <button onclick="showCreateEventModal()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <i class="fas fa-plus"></i> 행사 생성
          </button>
        </div>

        <!-- 테이블 (데스크탑) -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">행사명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">시작일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">참가자</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">행사가 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50 cursor-pointer" onclick="showEventDetail(${r.id})">
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${r.title ?? '-'}</p>
                      <p class="text-xs text-gray-400">${r.location ?? ''}</p>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.group_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.starts_at ? formatDate(r.starts_at) : '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.participant_count ?? 0}${r.capacity ? ' / ' + r.capacity : ''}명</td>
                    <td class="px-4 py-3">${eventStatusBadge(r.status)}</td>
                    <td class="px-4 py-3" onclick="event.stopPropagation()">
                      <div class="flex gap-1">
                        <button onclick="showEventDetail(${r.id})"
                          class="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">상세</button>
                        ${r.status !== 'cancelled' && r.status !== 'ended' ? `
                          <button onclick="cancelEvent(${r.id}, '${status}')"
                            class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">취소</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 카드 목록 (모바일) -->
        <div class="md:hidden space-y-2">
          ${rows.length === 0 ? `<div class="text-center text-gray-400 text-sm py-10">행사가 없습니다.</div>` : ''}
          ${rows.map(r => `
            <div class="bg-white rounded-xl border p-4 space-y-2" onclick="showEventDetail(${r.id})">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold text-gray-900">${r.title ?? '-'}</p>
                  <p class="text-xs text-gray-500">${r.group_name ?? '-'}</p>
                </div>
                ${eventStatusBadge(r.status)}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span><i class="fas fa-calendar mr-1"></i>${r.starts_at ? formatDate(r.starts_at) : '-'}</span>
                <span><i class="fas fa-users mr-1"></i>${r.participant_count ?? 0}명</span>
              </div>
              ${r.status !== 'cancelled' && r.status !== 'ended' ? `
                <div onclick="event.stopPropagation()" class="flex gap-1 pt-1">
                  <button onclick="cancelEvent(${r.id}, '${status}')"
                    class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200">취소</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${pagination ? renderPagination(pagination, `loadEventsPage`) : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('행사 목록을 불러오지 못했습니다.'));
  }
}

// ── 행사 상세 모달 ─────────────────────────────────────────
async function showEventDetail(eventId) {
  const modal = document.createElement('div');
  modal.id = 'event-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4">${loadingSpinner()}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/events/${eventId}`);
    const e = data.data;
    const participants = e.participants || [];

    modal.querySelector('.bg-white').innerHTML = `
      <!-- 헤더 -->
      <div class="flex items-start justify-between px-5 py-4 border-b gap-3">
        <div>
          <h3 class="font-bold text-gray-900 text-base">${e.title}</h3>
          <p class="text-sm text-gray-500 mt-0.5">${e.group_name ?? '-'}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${eventStatusBadge(e.status)}
          <button onclick="document.getElementById('event-detail-modal').remove()" class="text-gray-400 hover:text-gray-600 ml-1">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 탭 -->
      <div class="flex border-b px-5">
        ${['info','edit','participants'].map((t,i) => `
          <button onclick="switchEventTab('${t}')"
            id="evt-tab-${t}"
            class="px-4 py-3 text-sm font-medium border-b-2 transition -mb-px
                   ${i===0 ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}">
            ${{info:'기본 정보', edit:'수정', participants:'참가자 ('+participants.length+')'}[t]}
          </button>
        `).join('')}
      </div>

      <!-- 기본 정보 탭 -->
      <div id="evt-panel-info" class="p-5 space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">시작일시</p>
            <p class="font-medium text-gray-800">${e.starts_at ? formatDate(e.starts_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">종료일시</p>
            <p class="font-medium text-gray-800">${e.ends_at ? formatDate(e.ends_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">장소</p>
            <p class="font-medium text-gray-800">${e.location ?? '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">참가자</p>
            <p class="font-medium text-gray-800">${e.participant_count ?? 0} / ${e.capacity ?? '무제한'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">공개 여부</p>
            <p class="font-medium text-gray-800">${e.visibility === 'public' ? '공개' : '그룹 전용'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">참가비</p>
            <p class="font-medium text-gray-800">${e.entry_fee ? e.entry_fee.toLocaleString() + 'P' : '무료'}</p>
          </div>
        </div>
        ${e.description ? `
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">설명</p>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">${e.description}</p>
          </div>
        ` : ''}
        ${e.status !== 'cancelled' && e.status !== 'ended' ? `
          <div class="pt-2 border-t">
            <button onclick="cancelEvent(${e.id})"
              class="w-full py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-xl hover:bg-red-50 transition">
              <i class="fas fa-ban mr-1.5"></i>행사 취소
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 수정 탭 -->
      <div id="evt-panel-edit" class="p-5 space-y-3 hidden">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사명 <span class="text-red-500">*</span></label>
          <input id="ee-title" type="text" value="${e.title ?? ''}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">설명</label>
          <textarea id="ee-desc" rows="3"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none">${e.description ?? ''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">장소</label>
          <input id="ee-location" type="text" value="${e.location ?? ''}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">시작일</label>
            <input id="ee-starts" type="datetime-local" value="${e.starts_at ? e.starts_at.slice(0,16) : ''}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">종료일</label>
            <input id="ee-ends" type="datetime-local" value="${e.ends_at ? e.ends_at.slice(0,16) : ''}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">상태</label>
            <select id="ee-status"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              ${['upcoming','ongoing','ended','cancelled'].map(s =>
                `<option value="${s}" ${e.status===s?'selected':''}>${{upcoming:'예정',ongoing:'진행중',ended:'종료',cancelled:'취소'}[s]}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="ee-visibility"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" ${e.visibility==='public'?'selected':''}>공개</option>
              <option value="group_only" ${e.visibility==='group_only'?'selected':''}>그룹 전용</option>
            </select>
          </div>
        </div>
        <div id="ee-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
        <button onclick="submitEditEvent(${e.id})"
          class="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          저장하기
        </button>
      </div>

      <!-- 참가자 탭 -->
      <div id="evt-panel-participants" class="p-5 hidden">
        ${participants.length === 0
          ? `<div class="text-center text-gray-400 text-sm py-8">참가자가 없습니다.</div>`
          : `<div class="space-y-2 max-h-80 overflow-y-auto">
              ${participants.map((p, idx) => `
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                  <span class="text-xs text-gray-400 w-5 text-right">${idx+1}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${p.name ?? '-'}</p>
                    <p class="text-xs text-gray-400 truncate">${p.email ?? '-'}</p>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full ${p.status==='confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                    ${p.status==='confirmed' ? '확정' : p.status ?? '-'}
                  </span>
                </div>
              `).join('')}
            </div>`
        }
      </div>
    `;
  } catch (err) {
    modal.querySelector('.bg-white').innerHTML = `
      <div class="p-8 text-center text-red-500">행사 정보를 불러오지 못했습니다.</div>`;
  }
}

function switchEventTab(tab) {
  ['info','edit','participants'].forEach(t => {
    document.getElementById(`evt-panel-${t}`)?.classList.toggle('hidden', t !== tab);
    const btn = document.getElementById(`evt-tab-${t}`);
    if (btn) {
      btn.classList.toggle('border-blue-600', t === tab);
      btn.classList.toggle('text-blue-600',   t === tab);
      btn.classList.toggle('border-transparent', t !== tab);
      btn.classList.toggle('text-gray-500',   t !== tab);
    }
  });
}

async function submitEditEvent(eventId) {
  const title    = document.getElementById('ee-title')?.value.trim();
  const desc     = document.getElementById('ee-desc')?.value.trim();
  const location = document.getElementById('ee-location')?.value.trim();
  const starts   = document.getElementById('ee-starts')?.value;
  const ends     = document.getElementById('ee-ends')?.value;
  const status   = document.getElementById('ee-status')?.value;
  const vis      = document.getElementById('ee-visibility')?.value;
  const errEl    = document.getElementById('ee-error');

  if (!title || title.length < 2) {
    errEl.textContent = '행사명을 2자 이상 입력해주세요.';
    errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = { title, status, visibility: vis };
  if (desc)     payload.description = desc;
  if (location) payload.location    = location;
  if (starts)   payload.starts_at   = new Date(starts).toISOString();
  if (ends)     payload.ends_at     = new Date(ends).toISOString();

  try {
    await axios.patch(`/admin/events/${eventId}`, payload);
    document.getElementById('event-detail-modal')?.remove();
    showToast('행사가 수정되었습니다.', 'success');
    loadEvents();
  } catch (err) {
    errEl.textContent = err.response?.data?.error || '수정에 실패했습니다.';
    errEl.classList.remove('hidden');
  }
}

async function cancelEvent(eventId, currentStatus = 'all') {
  if (!confirm('이 행사를 취소하시겠습니까? 취소 후에는 되돌릴 수 없습니다.')) return;
  try {
    await axios.patch(`/admin/events/${eventId}`, { status: 'cancelled' });
    document.getElementById('event-detail-modal')?.remove();
    showToast('행사가 취소되었습니다.', 'success');
    loadEvents(1, currentStatus);
  } catch (err) {
    showToast(err.response?.data?.error || '취소에 실패했습니다.', 'error');
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
          <label class="block text-sm font-semibold text-gray-600 mb-1">그룹명 <span class="text-red-500">*</span></label>
          <input type="text" id="cg-name" placeholder="그룹명 입력 (2~100자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">설명</label>
          <textarea id="cg-desc" rows="3" placeholder="그룹 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">카테고리</label>
            <select id="cg-category" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="association">협회</option>
              <option value="company">기업</option>
              <option value="club">동호회</option>
              <option value="other" selected>기타</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="cg-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">최대 멤버 수</label>
          <input type="number" id="cg-maxmembers" placeholder="제한 없음 (비워두면 무제한)" min="1"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div id="cg-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
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
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">행사 생성</h3>
        <button onclick="document.getElementById('create-event-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">그룹 선택 <span class="text-red-500">*</span></label>
          <select id="ce-group" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${groupOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사명 <span class="text-red-500">*</span></label>
          <input type="text" id="ce-title" placeholder="행사명 입력 (2~200자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사 설명</label>
          <textarea id="ce-desc" rows="3" placeholder="행사 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">장소</label>
          <input type="text" id="ce-location" placeholder="행사 장소 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">시작일시 <span class="text-red-500">*</span></label>
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
          <label class="block text-sm font-semibold text-gray-600 mb-1">종료일시</label>
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
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="ce-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="group_only">그룹 전용</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">참가 방식</label>
            <select id="ce-regtype" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="free" selected>자유 참가</option>
              <option value="pre_required">사전 신청</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">입장 방식</label>
            <select id="ce-entry" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="qr" selected>QR</option>
              <option value="nfc_qr">NFC+QR</option>
              <option value="manual">수동</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">최대 참가자</label>
            <input type="number" id="ce-maxpart" placeholder="무제한" min="1"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div id="ce-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
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
    loadEvents(1, _eventsStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '행사 생성에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

// ── 플랜 설정 ──────────────────────────────────────────
async function loadPlanConfigs() {
  setContent(loadingSpinner())
  try {
    const { data } = await axios.get('/api/v1/admin/plan-configs')
    const plans = data.data || []
    const planLabels = { free: 'Free', pro: 'Pro', business: 'Business' }
    const planColors = { free: 'gray', pro: 'blue', business: 'purple' }

    setContent(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900">플랜 설정</h2>
          <p class="text-sm text-gray-400">그룹 최대 멤버 수 등 플랜별 제한을 설정합니다.</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <i class="fas fa-info-circle mr-1"></i>
          멤버 수 <strong>NULL = 무제한</strong>. 변경 즉시 신규 가입/승인에 적용됩니다.
        </div>
        <div class="grid gap-4">
          ${plans.map(p => {
            const color = planColors[p.code] || 'gray'
            const colorClass = { gray: 'border-gray-300 bg-gray-50', blue: 'border-blue-300 bg-blue-50', purple: 'border-purple-300 bg-purple-50' }[color]
            const badgeClass = { gray: 'bg-gray-100 text-gray-700', blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700' }[color]
            return `
            <div class="bg-white rounded-xl shadow-sm border p-5">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-full text-sm font-bold ${badgeClass}">${planLabels[p.code] || p.code}</span>
                  <span class="text-sm text-gray-500">${p.name}</span>
                </div>
                <span class="text-sm text-gray-400">code: ${p.code}</span>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-semibold text-gray-600 mb-1">그룹 최대 멤버 수</label>
                  <div class="flex gap-2">
                    <input type="number" id="plan-members-${p.code}" value="${p.max_group_members ?? ''}" placeholder="무제한 (비워두기)"
                      min="1" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button onclick="updatePlanConfig('${p.code}', 'max_group_members')"
                      class="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
                      저장
                    </button>
                  </div>
                  <p class="text-sm text-gray-400 mt-1">현재: ${p.max_group_members !== null ? p.max_group_members + '명' : '무제한'}</p>
                </div>
                <div>
                  <label class="block text-sm font-semibold text-gray-600 mb-1">명함 한도</label>
                  <div class="flex gap-2">
                    <input type="number" id="plan-cards-${p.code}" value="${p.max_cards ?? ''}" placeholder="무제한 (비워두기)"
                      min="1" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button onclick="updatePlanConfig('${p.code}', 'max_cards')"
                      class="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
                      저장
                    </button>
                  </div>
                  <p class="text-sm text-gray-400 mt-1">현재: ${p.max_cards !== null ? p.max_cards + '개' : '무제한'}</p>
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `)
  } catch (e) {
    setContent(`<div class="text-center text-red-500 py-10">플랜 설정을 불러오지 못했습니다.</div>`)
  }
}

async function updatePlanConfig(planCode, field) {
  const input = document.getElementById(`plan-${field === 'max_group_members' ? 'members' : 'cards'}-${planCode}`)
  const rawVal = input?.value.trim()
  const value = rawVal === '' ? null : parseInt(rawVal)

  if (rawVal !== '' && (isNaN(value) || value < 1)) {
    showToast('올바른 숫자를 입력하거나 비워두세요 (무제한).', 'error'); return
  }

  try {
    await axios.patch(`/api/v1/admin/plan-configs/${planCode}`, { [field]: value })
    showToast(`${planCode} 플랜 설정이 저장되었습니다.`, 'success')
    loadPlanConfigs()
  } catch (e) {
    showToast(e.response?.data?.error || '저장 실패', 'error')
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
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">신청일</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">NFC 카드 신청이 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-900">${r.user_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.group_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.status ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.applied_at ? formatDate(r.applied_at) : '-'}</td>
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
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">유저</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">파트너</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">포인트</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-500 uppercase">날짜</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">리워드 내역이 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-900">${r.name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.partner_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-blue-600">+${r.points ?? 0}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.created_at ? formatDate(r.created_at) : '-'}</td>
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

// ── 레슨 관리 ─────────────────────────────────────────────
let _lessonsStatus = 'all';
function loadLessonsPage(page) { loadLessons(page, _lessonsStatus); }

async function loadLessons(page = 1, status = 'all') {
  _lessonsStatus = status;
  setContent(loadingSpinner());
  try {
    const params = new URLSearchParams({ limit: '20', page });
    if (status && status !== 'all') params.set('status', status);
    const { data } = await axios.get(`/admin/lessons?${params}`);
    const rows = data.data || [];
    const pagination = data.pagination;

    const statusTabs = [
      { key: 'all', label: '전체' },
      { key: 'upcoming',  label: '예정' },
      { key: 'ongoing',   label: '진행중' },
      { key: 'ended',     label: '종료' },
      { key: 'cancelled', label: '취소' },
    ];

    setContent(`
      <div class="space-y-3">
        <!-- 헤더 + 생성 버튼 -->
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-800">레슨 관리</h2>
          <button onclick="openCreateLessonModal()"
            class="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
            <i class="fas fa-plus"></i> 레슨 생성
          </button>
        </div>

        <!-- 상태 필터 탭 -->
        <div class="flex gap-1 overflow-x-auto pb-1">
          ${statusTabs.map(t => `
            <button onclick="loadLessons(1,'${t.key}')"
              class="px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition
                ${status === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'}">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="px-4 py-3 border-b flex items-center justify-between">
            <span class="text-sm font-semibold text-gray-700">
              ${statusTabs.find(t => t.key === status)?.label ?? '전체'} 레슨
            </span>
            <span class="text-sm text-gray-500">총 ${pagination?.total ?? rows.length}개</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">레슨명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">강사</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">일시</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">수강/정원</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0
                  ? `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-400 text-sm">레슨이 없습니다.</td></tr>`
                  : rows.map(r => `
                  <tr class="hover:bg-gray-50 cursor-pointer" onclick="showLessonDetail(${r.id})">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 max-w-[180px] truncate">${escHtml(r.title ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${escHtml(r.group_name ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${escHtml(r.instructor_name ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.scheduled_at ? formatDate(r.scheduled_at) : '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.registered_count ?? 0} / ${r.capacity ?? '∞'}</td>
                    <td class="px-4 py-3">${lessonStatusBadge(r.status)}</td>
                    <td class="px-4 py-3" onclick="event.stopPropagation()">
                      ${r.status !== 'cancelled'
                        ? `<button onclick="cancelLesson(${r.id},'${status}')"
                            class="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition">취소</button>`
                        : `<span class="text-xs text-gray-400">취소됨</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 모바일 카드 뷰 -->
        <div class="md:hidden space-y-2">
          ${rows.length === 0
            ? `<div class="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">레슨이 없습니다.</div>`
            : rows.map(r => `
            <div class="bg-white rounded-xl shadow-sm border p-4 cursor-pointer" onclick="showLessonDetail(${r.id})">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-900 truncate">${escHtml(r.title ?? '-')}</p>
                  <p class="text-xs text-gray-500 mt-0.5">${escHtml(r.group_name ?? '-')} · ${escHtml(r.instructor_name ?? '-')}</p>
                </div>
                ${lessonStatusBadge(r.status)}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span><i class="fas fa-calendar mr-1"></i>${r.scheduled_at ? formatDate(r.scheduled_at) : '-'}</span>
                <span><i class="fas fa-users mr-1"></i>${r.registered_count ?? 0}/${r.capacity ?? '∞'}</span>
              </div>
              ${r.status !== 'cancelled'
                ? `<button onclick="event.stopPropagation(); cancelLesson(${r.id},'${status}')"
                    class="mt-2 w-full py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition">취소</button>`
                : ''}
            </div>
          `).join('')}
        </div>

        ${pagination ? renderPagination(pagination, 'loadLessonsPage') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('레슨 목록을 불러오지 못했습니다.'));
  }
}

// 레슨 상세 모달 (기본정보 / 수정 / 수강자)
async function showLessonDetail(lessonId) {
  const modal = document.createElement('div');
  modal.id = 'lesson-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4 p-5">${loadingSpinner()}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/lessons/${lessonId}`);
    const ls = data.data;
    const regs = ls.registrations || [];

    modal.querySelector('.bg-white').innerHTML = `
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-chalkboard-teacher text-indigo-500"></i>
        <span class="text-lg font-bold text-gray-800">레슨 상세</span>
        <span class="ml-auto">${lessonStatusBadge(ls.status)}</span>
      </div>

      <!-- 탭 헤더 -->
      <div class="flex border-b mb-4">
        <button id="ltab-info" onclick="switchLessonTab('info')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-indigo-500 text-indigo-600">기본정보</button>
        <button id="ltab-edit" onclick="switchLessonTab('edit')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">수정</button>
        <button id="ltab-students" onclick="switchLessonTab('students')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          수강자 <span class="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">${regs.length}</span>
        </button>
      </div>

      <!-- 탭 1: 기본정보 -->
      <div id="lpanel-info" class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">레슨명</p>
            <p class="font-medium text-gray-900">${escHtml(ls.title)}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">그룹</p>
            <p class="font-medium text-gray-900">${escHtml(ls.group_name ?? '-')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">강사</p>
            <p class="font-medium text-gray-900">${escHtml(ls.instructor_name ?? '-')}</p>
            <p class="text-xs text-gray-500">${escHtml(ls.instructor_email ?? '')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">일시</p>
            <p class="font-medium text-gray-900">${ls.scheduled_at ? formatDate(ls.scheduled_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">진행시간</p>
            <p class="font-medium text-gray-900">${ls.duration_minutes ?? 60}분</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">수강/정원</p>
            <p class="font-medium text-gray-900">${ls.registered_count ?? 0} / ${ls.capacity ?? '∞'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">장소</p>
            <p class="font-medium text-gray-900">${escHtml(ls.location ?? '-')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">포인트 비용</p>
            <p class="font-medium text-gray-900">${(ls.point_cost ?? 0).toLocaleString()}P</p>
          </div>
        </div>
        ${ls.description ? `<div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">${escHtml(ls.description)}</div>` : ''}
        ${ls.status !== 'cancelled'
          ? `<button onclick="cancelLesson(${ls.id},'${_lessonsStatus}', true)"
              class="w-full py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition font-medium">
              <i class="fas fa-ban mr-1"></i>레슨 취소
            </button>`
          : ''}
      </div>

      <!-- 탭 2: 수정 -->
      <div id="lpanel-edit" class="hidden space-y-3">
        <div class="space-y-3 text-sm">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">레슨명</label>
            <input id="ledit-title" type="text" value="${escHtml(ls.title)}"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">일시</label>
              <input id="ledit-scheduled-at" type="datetime-local"
                value="${ls.scheduled_at ? ls.scheduled_at.replace(' ', 'T').substring(0,16) : ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">진행시간(분)</label>
              <input id="ledit-duration" type="number" min="10" value="${ls.duration_minutes ?? 60}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">장소</label>
              <input id="ledit-location" type="text" value="${escHtml(ls.location ?? '')}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">정원 (비워두면 무제한)</label>
              <input id="ledit-capacity" type="number" min="1" value="${ls.capacity ?? ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">상태</label>
            <select id="ledit-status"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
              ${['upcoming','ongoing','ended','cancelled'].map(s =>
                `<option value="${s}" ${ls.status === s ? 'selected' : ''}>${
                  {upcoming:'예정',ongoing:'진행중',ended:'종료',cancelled:'취소'}[s]
                }</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">설명</label>
            <textarea id="ledit-description" rows="3"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">${escHtml(ls.description ?? '')}</textarea>
          </div>
        </div>
        <button onclick="submitEditLesson(${ls.id})"
          class="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
          <i class="fas fa-save mr-1"></i>저장
        </button>
      </div>

      <!-- 탭 3: 수강자 -->
      <div id="lpanel-students" class="hidden">
        ${regs.length === 0
          ? `<div class="py-8 text-center text-gray-400 text-sm">수강자가 없습니다.</div>`
          : `<div class="space-y-2 max-h-64 overflow-y-auto">
              ${regs.map(r => `
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p class="text-sm font-medium text-gray-900">${escHtml(r.name ?? '-')}</p>
                    <p class="text-xs text-gray-500">${escHtml(r.email ?? '-')}</p>
                  </div>
                  <span class="px-2 py-0.5 text-xs rounded-full ${r.status === 'confirmed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'}">
                    ${r.status === 'confirmed' ? '확정' : '취소'}
                  </span>
                </div>
              `).join('')}
            </div>`}
      </div>
    `;
  } catch (err) {
    modal.querySelector('.bg-white').innerHTML = `<div class="text-center text-red-500 py-8 p-5">레슨 정보를 불러오지 못했습니다.</div>`;
  }
}

function switchLessonTab(tab) {
  ['info', 'edit', 'students'].forEach(t => {
    const btn   = document.getElementById(`ltab-${t}`);
    const panel = document.getElementById(`lpanel-${t}`);
    if (!btn || !panel) return;
    const active = t === tab;
    btn.className   = `px-4 py-2 text-sm font-medium border-b-2 transition ${
      active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;
    panel.classList.toggle('hidden', !active);
  });
}

async function submitEditLesson(lessonId) {
  const title       = document.getElementById('ledit-title')?.value?.trim();
  const description = document.getElementById('ledit-description')?.value?.trim();
  const location    = document.getElementById('ledit-location')?.value?.trim();
  const scheduledAt = document.getElementById('ledit-scheduled-at')?.value;
  const duration    = document.getElementById('ledit-duration')?.value;
  const capacity    = document.getElementById('ledit-capacity')?.value;
  const status      = document.getElementById('ledit-status')?.value;

  if (!title) { showToast('레슨명을 입력하세요.', 'error'); return; }

  const payload = { title, status };
  if (description !== undefined) payload.description = description || null;
  if (location)    payload.location    = location;
  if (scheduledAt) payload.scheduled_at = scheduledAt.replace('T', ' ') + ':00';
  if (duration)    payload.duration_minutes = Number(duration);
  payload.capacity = capacity ? Number(capacity) : null;

  try {
    await axios.patch(`/admin/lessons/${lessonId}`, payload);
    showToast('레슨이 수정되었습니다.', 'success');
    document.getElementById('lesson-detail-modal')?.remove();
    loadLessons(1, _lessonsStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '수정에 실패했습니다.', 'error');
  }
}

async function cancelLesson(lessonId, currentStatus = 'all', fromModal = false) {
  if (!confirm('이 레슨을 취소하시겠습니까? 수강자에게 영향이 있을 수 있습니다.')) return;
  try {
    await axios.patch(`/admin/lessons/${lessonId}`, { status: 'cancelled' });
    showToast('레슨이 취소되었습니다.', 'success');
    if (fromModal) document.getElementById('lesson-detail-modal')?.remove();
    loadLessons(1, currentStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '취소에 실패했습니다.', 'error');
  }
}

// 레슨 생성 모달
function openCreateLessonModal() {
  document.getElementById('lesson-create-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'lesson-create-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4 p-5">
    <div class="flex items-center gap-2 mb-4">
      <i class="fas fa-plus-circle text-indigo-500"></i>
      <span class="text-lg font-bold text-gray-800">레슨 생성</span>
    </div>
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">그룹 ID <span class="text-red-500">*</span></label>
          <input id="lcreate-group-id" type="number" min="1" placeholder="예: 1"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">강사 유저 ID <span class="text-red-500">*</span></label>
          <input id="lcreate-instructor-id" type="number" min="1" placeholder="예: 9002"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">레슨명 <span class="text-red-500">*</span></label>
        <input id="lcreate-title" type="text" placeholder="예: 골프 스윙 기초"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">일시 <span class="text-red-500">*</span></label>
          <input id="lcreate-scheduled-at" type="datetime-local"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">진행시간(분)</label>
          <input id="lcreate-duration" type="number" min="10" value="60"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">장소</label>
          <input id="lcreate-location" type="text" placeholder="선택사항"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">정원</label>
          <input id="lcreate-capacity" type="number" min="1" placeholder="비워두면 무제한"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">설명</label>
        <textarea id="lcreate-description" rows="2" placeholder="선택사항"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm"></textarea>
      </div>
    </div>
    <div class="mt-4 flex gap-2">
      <button onclick="document.getElementById('lesson-create-modal')?.remove()"
        class="flex-1 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition">취소</button>
      <button onclick="submitCreateLesson()"
        class="flex-1 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
        생성
      </button>
    </div>
  </div>`;
}

async function submitCreateLesson() {
  const groupId      = Number(document.getElementById('lcreate-group-id')?.value);
  const instructorId = Number(document.getElementById('lcreate-instructor-id')?.value);
  const title        = document.getElementById('lcreate-title')?.value?.trim();
  const scheduledAt  = document.getElementById('lcreate-scheduled-at')?.value;
  const duration     = Number(document.getElementById('lcreate-duration')?.value) || 60;
  const location     = document.getElementById('lcreate-location')?.value?.trim();
  const capacity     = document.getElementById('lcreate-capacity')?.value;
  const description  = document.getElementById('lcreate-description')?.value?.trim();

  if (!groupId)      { showToast('그룹 ID를 입력하세요.', 'error'); return; }
  if (!instructorId) { showToast('강사 유저 ID를 입력하세요.', 'error'); return; }
  if (!title)        { showToast('레슨명을 입력하세요.', 'error'); return; }
  if (!scheduledAt)  { showToast('일시를 선택하세요.', 'error'); return; }

  const payload = {
    group_id: groupId,
    instructor_id: instructorId,
    title,
    scheduled_at: scheduledAt.replace('T', ' ') + ':00',
    duration_minutes: duration,
    point_cost: 0,
  };
  if (location)    payload.location    = location;
  if (capacity)    payload.capacity    = Number(capacity);
  if (description) payload.description = description;

  try {
    await axios.post('/admin/lessons', payload);
    showToast('레슨이 생성되었습니다.', 'success');
    document.getElementById('lesson-create-modal')?.remove();
    loadLessons(1, _lessonsStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '생성에 실패했습니다.', 'error');
  }
}

function lessonStatusBadge(status) {
  const map = {
    upcoming  : 'bg-blue-100 text-blue-700',
    ongoing   : 'bg-green-100 text-green-700',
    ended     : 'bg-gray-100 text-gray-500',
    cancelled : 'bg-red-100 text-red-500'
  };
  const labels = { upcoming: '예정', ongoing: '진행중', ended: '종료', cancelled: '취소' };
  return `<span class="px-2 py-0.5 ${map[status] || 'bg-gray-100 text-gray-500'} text-xs rounded-full font-medium">${labels[status] || status || '-'}</span>`;
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
