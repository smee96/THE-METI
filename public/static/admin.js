// ============================================================
// METI Admin Web SPA
// ============================================================

const API = '/api/v1';
let authToken = localStorage.getItem('meti_admin_token');
let currentUser = JSON.parse(localStorage.getItem('meti_admin_user') || 'null');
let currentSection = 'dashboard';

// Axios 기본 설정
axios.defaults.baseURL = API;
axios.interceptors.request.use(config => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      logout();
    }
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

  // URL hash 기반 라우팅
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
}

function renderApp() {
  document.getElementById('app').innerHTML = `
    <div class="flex min-h-screen">
      <!-- 사이드바 -->
      <aside class="w-64 bg-slate-900 flex flex-col fixed h-full z-10">
        <div class="p-6 border-b border-slate-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <i class="fas fa-id-card text-white"></i>
            </div>
            <div>
              <h1 class="text-white font-bold text-lg">METI</h1>
              <p class="text-slate-400 text-xs">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
          <p class="text-slate-500 text-xs uppercase font-semibold px-4 py-2 mt-2">메인</p>
          ${navItem('dashboard', 'tachometer-alt', '대시보드')}
          ${navItem('users', 'users', '유저 관리')}
          ${navItem('groups', 'building', '그룹 관리')}
          ${navItem('events', 'calendar-alt', '행사 관리')}
          <p class="text-slate-500 text-xs uppercase font-semibold px-4 py-2 mt-4">운영</p>
          ${navItem('reports', 'flag', '신고 관리')}
          ${navItem('nfc-cards', 'credit-card', 'NFC 카드')}
          ${navItem('partners', 'handshake', '파트너 서비스')}
          ${navItem('rewards', 'gift', '리워드 내역')}
        </nav>

        <div class="p-4 border-t border-slate-700">
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-slate-300 text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm font-medium truncate">${currentUser?.name || 'Admin'}</p>
              <p class="text-slate-400 text-xs truncate">${currentUser?.email || ''}</p>
            </div>
            <button onclick="logout()" class="text-slate-400 hover:text-white" title="로그아웃">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- 메인 콘텐츠 -->
      <main class="flex-1 ml-64 min-h-screen">
        <!-- 상단 헤더 -->
        <header class="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <div class="flex items-center justify-between">
            <h2 id="page-title" class="text-xl font-semibold text-gray-800">대시보드</h2>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500">${new Date().toLocaleDateString('ko-KR')}</span>
              <span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Super Admin</span>
            </div>
          </div>
        </header>

        <!-- 페이지 콘텐츠 -->
        <div id="page-content" class="p-8">
          <div class="flex items-center justify-center h-64">
            <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
          </div>
        </div>
      </main>
    </div>
  `;
}

function navItem(id, icon, label) {
  return `<a onclick="navigateTo('${id}')" href="#${id}" id="nav-${id}"
    class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
    <i class="fas fa-${icon} w-5 text-center"></i>
    <span>${label}</span>
  </a>`;
}

// ── 네비게이션 ───────────────────────────────────────────
function navigateTo(section) {
  // 이전 활성 메뉴 해제
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('bg-blue-700', 'text-white'));
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
  setContent('<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></div>');
  try {
    const { data } = await axios.get('/admin/dashboard');
    const d = data.data;
    setContent(`
      <div class="space-y-6">
        <!-- 통계 카드 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          ${statCard('총 유저', d.users?.total || 0, 'users', 'blue', `오늘 ${d.users?.today || 0}명 가입`)}
          ${statCard('활성 그룹', d.groups?.active || 0, 'building', 'green', `승인 대기 ${d.groups?.pending || 0}개`)}
          ${statCard('예정 행사', d.events?.upcoming || 0, 'calendar-alt', 'purple', `전체 ${d.events?.total || 0}개`)}
          ${statCard('미처리 신고', d.reports?.pending || 0, 'flag', 'red', `전체 ${d.reports?.total || 0}건`)}
        </div>

        <!-- 플랜 분포 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border">
            <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-chart-pie text-blue-500 mr-2"></i>플랜 분포</h3>
            <div class="space-y-3">
              ${planBar('Free', d.users?.free_plan || 0, d.users?.total || 1, 'gray')}
              ${planBar('Pro', d.users?.pro_plan || 0, d.users?.total || 1, 'blue')}
              ${planBar('Business', d.users?.business_plan || 0, d.users?.total || 1, 'purple')}
            </div>
          </div>

          <div class="bg-white rounded-2xl p-6 shadow-sm border col-span-2">
            <h3 class="font-semibold text-gray-800 mb-4"><i class="fas fa-clock text-green-500 mr-2"></i>빠른 실행</h3>
            <div class="grid grid-cols-2 gap-3">
              <button onclick="navigateTo('groups')" class="p-4 bg-orange-50 hover:bg-orange-100 rounded-xl text-left transition">
                <i class="fas fa-building text-orange-500 text-xl mb-2 block"></i>
                <p class="font-semibold text-gray-800">그룹 승인 대기</p>
                <p class="text-2xl font-bold text-orange-600">${d.groups?.pending || 0}</p>
              </button>
              <button onclick="navigateTo('reports')" class="p-4 bg-red-50 hover:bg-red-100 rounded-xl text-left transition">
                <i class="fas fa-flag text-red-500 text-xl mb-2 block"></i>
                <p class="font-semibold text-gray-800">신고 처리 대기</p>
                <p class="text-2xl font-bold text-red-600">${d.reports?.pending || 0}</p>
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
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' };
  return `<div class="bg-white rounded-2xl p-6 shadow-sm border">
    <div class="flex items-center justify-between mb-4">
      <div class="w-12 h-12 ${colors[color]} rounded-xl flex items-center justify-center">
        <i class="fas fa-${icon} text-xl"></i>
      </div>
    </div>
    <p class="text-3xl font-bold text-gray-900">${value.toLocaleString()}</p>
    <p class="text-gray-500 mt-1">${label}</p>
    <p class="text-xs text-gray-400 mt-2">${sub}</p>
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
    <div class="h-2 bg-gray-100 rounded-full">
      <div class="h-2 ${colors[color]} rounded-full" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ── 유저 관리 ────────────────────────────────────────────
async function loadUsers(page = 1, search = '') {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(`/admin/users?page=${page}&limit=20&q=${search}`);
    const { data: users, pagination } = data;

    setContent(`
      <div class="space-y-4">
        <div class="flex gap-4">
          <input type="text" id="user-search" placeholder="이름 또는 이메일 검색..."
            value="${search}"
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <button onclick="loadUsers(1, document.getElementById('user-search').value)"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">검색</button>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유저</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">계정 유형</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">플랜</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">가입일</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${users.map(u => `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-500">#${u.id}</td>
                  <td class="px-6 py-4">
                    <p class="font-medium text-gray-900">${u.name}</p>
                    <p class="text-sm text-gray-500">${u.email}</p>
                  </td>
                  <td class="px-6 py-4">${accountTypeBadge(u.account_type)}</td>
                  <td class="px-6 py-4">${planBadge(u.plan)}</td>
                  <td class="px-6 py-4">${u.is_active ? '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">활성</span>' : '<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">비활성</span>'}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">${formatDate(u.created_at)}</td>
                  <td class="px-6 py-4">
                    <button onclick="toggleUserActive(${u.id}, ${u.is_active})"
                      class="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 ${u.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}">
                      ${u.is_active ? '비활성화' : '활성화'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
      <div class="space-y-4">
        <div class="flex gap-2">
          ${['pending', 'active', 'suspended'].map(s => `
            <button onclick="loadGroups(1,'${s}')"
              class="px-4 py-2 rounded-lg text-sm font-medium transition ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
              ${s === 'pending' ? '승인 대기' : s === 'active' ? '활성' : '정지'}
            </button>
          `).join('')}
        </div>

        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹명</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">관리자</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">공개</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${groups.length === 0 ? `<tr><td colspan="6" class="px-6 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr>` : ''}
              ${groups.map(g => `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <p class="font-medium text-gray-900">${g.name}</p>
                    <p class="text-sm text-gray-500 truncate max-w-xs">${g.description || '-'}</p>
                  </td>
                  <td class="px-6 py-4">
                    <p class="text-sm text-gray-900">${g.admin_name || '-'}</p>
                    <p class="text-xs text-gray-500">${g.admin_email || ''}</p>
                  </td>
                  <td class="px-6 py-4">${categoryBadge(g.category)}</td>
                  <td class="px-6 py-4">${g.visibility === 'public' ? '<span class="text-green-600 text-sm">공개</span>' : '<span class="text-gray-500 text-sm">비공개</span>'}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">${formatDate(g.created_at)}</td>
                  <td class="px-6 py-4 flex gap-2">
                    ${status === 'pending' ? `
                      <button onclick="approveGroup(${g.id}, 'approve')"
                        class="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">승인</button>
                      <button onclick="approveGroup(${g.id}, 'reject')"
                        class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">거절</button>
                    ` : ''}
                    ${status === 'active' ? `
                      <button onclick="approveGroup(${g.id}, 'suspend')"
                        class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">정지</button>
                    ` : ''}
                    ${status === 'suspended' ? `
                      <button onclick="approveGroup(${g.id}, 'activate')"
                        class="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">활성화</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
      <div class="space-y-4">
        <div class="flex gap-2">
          ${['pending', 'reviewed', 'resolved', 'dismissed'].map(s => `
            <button onclick="loadReports(1,'${s}')"
              class="px-4 py-2 rounded-lg text-sm font-medium transition ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
              ${s === 'pending' ? '대기' : s === 'reviewed' ? '검토 중' : s === 'resolved' ? '처리완료' : '기각'}
            </button>
          `).join('')}
        </div>
        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신고자</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">대상</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">사유</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">날짜</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${reports.length === 0 ? `<tr><td colspan="6" class="px-6 py-12 text-center text-gray-400">신고 내역이 없습니다.</td></tr>` : ''}
              ${reports.map(r => `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-500">#${r.id}</td>
                  <td class="px-6 py-4">
                    <p class="text-sm font-medium">${r.reporter_name}</p>
                    <p class="text-xs text-gray-500">${r.reporter_email}</p>
                  </td>
                  <td class="px-6 py-4"><span class="text-xs px-2 py-1 bg-gray-100 rounded">${r.target_type} #${r.target_id}</span></td>
                  <td class="px-6 py-4 text-sm text-gray-700">${r.reason}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">${formatDate(r.created_at)}</td>
                  <td class="px-6 py-4 flex gap-2">
                    ${status === 'pending' ? `
                      <button onclick="resolveReport(${r.id}, 'resolved')" class="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">처리완료</button>
                      <button onclick="resolveReport(${r.id}, 'dismissed')" class="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">기각</button>
                    ` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
      <div class="space-y-4">
        <div class="flex justify-end">
          <button onclick="showAddPartnerForm()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <i class="fas fa-plus mr-2"></i>파트너 등록
          </button>
        </div>
        <div id="partner-form" class="hidden bg-white rounded-2xl shadow-sm border p-6">
          <h3 class="font-semibold mb-4">새 파트너 서비스 등록</h3>
          <div class="grid grid-cols-2 gap-4">
            <input type="text" id="p-name" placeholder="서비스 이름" class="px-4 py-2 border rounded-lg">
            <input type="text" id="p-desc" placeholder="서비스 설명" class="px-4 py-2 border rounded-lg">
          </div>
          <div class="mt-4 flex gap-3">
            <button onclick="addPartner()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">등록</button>
            <button onclick="document.getElementById('partner-form').classList.add('hidden')" class="px-6 py-2 border rounded-lg hover:bg-gray-50">취소</button>
          </div>
          <div id="new-apikey" class="hidden mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-sm font-semibold text-yellow-800 mb-1">⚠️ API 키 (최초 1회만 표시)</p>
            <code id="apikey-val" class="text-sm font-mono break-all"></code>
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">서비스명</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">설명</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">등록일</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${partners.length === 0 ? `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400">등록된 파트너가 없습니다.</td></tr>` : ''}
              ${partners.map(p => `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-500">#${p.id}</td>
                  <td class="px-6 py-4 font-medium">${p.name}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">${p.description || '-'}</td>
                  <td class="px-6 py-4">${p.status === 'active' ? '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">활성</span>' : '<span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">비활성</span>'}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">${formatDate(p.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(errorBox('파트너 목록을 불러오지 못했습니다.'));
  }
}

// ── 이벤트 / NFC / 리워드 (심플) ─────────────────────────
async function loadEvents(page = 1) { await loadSimpleTable('/admin/../events?limit=20&page=' + page, ['제목', '그룹', '날짜', '상태'], ['title', 'group_name', 'starts_at', 'status'], '이벤트', page); }
async function loadNfcCards(page = 1) { await loadSimpleTable('/admin/nfc-cards?limit=20&page=' + page, ['ID', '유저', '그룹', '상태', '신청일'], ['id', 'user_name', 'group_name', 'status', 'applied_at'], 'NFC 카드', page); }
async function loadRewards(page = 1) { await loadSimpleTable('/admin/rewards?limit=20&page=' + page, ['ID', '유저', '유형', '포인트', '날짜'], ['id', 'name', 'type', 'points', 'created_at'], '리워드', page); }

async function loadSimpleTable(endpoint, headers, fields, title, page) {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get(endpoint);
    const rows = data.data || [];
    const pagination = data.pagination;

    setContent(`
      <div class="space-y-4">
        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>${headers.map(h => `<th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${rows.length === 0 ? `<tr><td colspan="${headers.length}" class="px-6 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr>` : ''}
              ${rows.map(r => `
                <tr class="hover:bg-gray-50">
                  ${fields.map(f => `<td class="px-6 py-4 text-sm text-gray-700">${r[f] ?? '-'}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${pagination ? renderPagination(pagination, 'loadEvents') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox(`${title} 목록을 불러오지 못했습니다.`));
  }
}

// ── API 액션 함수들 ─────────────────────────────────────
async function toggleUserActive(userId, currentStatus) {
  if (!confirm(`이 유저를 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/users/${userId}`, { is_active: currentStatus ? 0 : 1 });
    showToast('변경되었습니다.', 'success');
    loadUsers();
  } catch (err) {
    showToast('오류가 발생했습니다.', 'error');
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
  return '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></div>';
}

function errorBox(msg) {
  return `<div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>${msg}</div>`;
}

function renderPagination(p, loadFn) {
  if (!p || p.total_pages <= 1) return '';
  const btns = [];
  for (let i = 1; i <= p.total_pages; i++) {
    btns.push(`<button onclick="${loadFn}(${i})"
      class="w-10 h-10 rounded-lg text-sm font-medium transition ${i === p.page ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50 text-gray-600'}">${i}</button>`);
  }
  return `<div class="flex justify-center gap-1">${btns.join('')}</div>`;
}

function planBadge(plan) {
  const map = { free: 'bg-gray-100 text-gray-600', pro: 'bg-blue-100 text-blue-700', business: 'bg-purple-100 text-purple-700' };
  return `<span class="px-2 py-1 ${map[plan] || map.free} text-xs font-semibold rounded-full capitalize">${plan}</span>`;
}

function accountTypeBadge(type) {
  const map = { personal: 'bg-gray-100 text-gray-600', headhunter: 'bg-orange-100 text-orange-700' };
  const labels = { personal: '일반', headhunter: '헤드헌터' };
  return `<span class="px-2 py-1 ${map[type] || map.personal} text-xs rounded-full">${labels[type] || type}</span>`;
}

function categoryBadge(cat) {
  const map = { association: '협회', company: '기업', club: '동호회', other: '기타' };
  return `<span class="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">${map[cat] || cat}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 px-6 py-3 rounded-xl text-white font-medium shadow-lg z-50 transition-all ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation-circle'} mr-2"></i>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function logout() {
  localStorage.removeItem('meti_admin_token');
  localStorage.removeItem('meti_admin_user');
  window.location.href = '/admin';
}
