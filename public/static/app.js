// ============================================================
// METI App Web SPA - v1.0
// 사용자 + 그룹관리자 통합 웹
// ============================================================

const API = '/api/v1';
let authToken    = localStorage.getItem('meti_token');
let currentUser  = JSON.parse(localStorage.getItem('meti_user') || 'null');

// 현재 컨텍스트: { type: 'user' } or { type: 'group', id, name, role }
let currentCtx   = { type: 'user' };
let myGroups     = [];   // 내가 속한 그룹 목록 (group_members)
let currentSection = 'dashboard';

// ── Axios 설정 ───────────────────────────────────────────
axios.defaults.baseURL = API;
axios.interceptors.request.use(cfg => {
  if (authToken) cfg.headers.Authorization = `Bearer ${authToken}`;
  return cfg;
});
axios.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      // 토큰 갱신 시도
      const refreshed = await tryRefreshToken();
      if (!refreshed) logout();
    }
    return Promise.reject(err);
  }
);

// ── 초기화 ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!authToken || !currentUser) {
    window.location.href = '/app/login';
    return;
  }
  initApp();
});

async function initApp() {
  // 사용자 정보 최신화
  try {
    const res = await axios.get('/auth/me');
    if (res.data.success) {
      currentUser = res.data.data;
      localStorage.setItem('meti_user', JSON.stringify(currentUser));
    }
  } catch (e) { /* 네트워크 오류 시 캐시 사용 */ }

  // 사이드바 사용자 정보
  document.getElementById('sidebar-username').textContent = currentUser.name || '-';
  document.getElementById('sidebar-plan').textContent     = planLabel(currentUser.plan);
  document.getElementById('greeting-name').textContent    = currentUser.name || '-';

  // 내 그룹 로드 후 컨텍스트 메뉴 구성
  await loadMyGroups();
  buildContextMenu();
  buildNavMenu();

  // URL 기반 초기 섹션 결정
  const path    = window.location.pathname; // e.g. /app/groups, /app/group/12/members
  const section = pathToSection(path);
  showSection(section);
}

// ── URL → 섹션 매핑 ──────────────────────────────────────
function pathToSection(path) {
  if (path === '/app/dashboard' || path === '/app')  return 'dashboard';
  if (path === '/app/cards')                          return 'cards';
  if (path === '/app/groups')                         return 'groups';
  if (path === '/app/points')                         return 'points';
  if (path === '/app/subscription')                   return 'subscription';

  // /app/group/:id/*
  const grpMatch = path.match(/^\/app\/group\/(\d+)\/([\w-]+)/);
  if (grpMatch) {
    const gid      = parseInt(grpMatch[1]);
    const sub      = grpMatch[2];
    const grp      = myGroups.find(g => g.id === gid);
    if (grp && (grp.my_role === 'admin' || grp.my_role === 'sub_admin')) {
      switchContextToGroup(gid, false); // 렌더링 없이 컨텍스트만 전환
      return 'group-' + sub;
    }
  }
  return 'dashboard';
}

// ── 내 그룹 로드 ─────────────────────────────────────────
async function loadMyGroups() {
  try {
    // 현재 API: GET /groups 는 공개 그룹 목록
    // 내 가입 그룹은 멤버십 조회로 가져옴
    // → 임시로 각 그룹을 순회하는 대신, 멤버 목록에서 역조회
    // TODO: GET /api/v1/groups/mine 엔드포인트 추가 시 교체
    const res = await axios.get('/groups?limit=100');
    if (res.data.success) {
      // 전체 공개 그룹 중 내가 active 멤버인 것만 필터
      // (API 개선 전 임시 처리 — 실제론 /groups/mine 필요)
      myGroups = (res.data.data?.groups || []).map(g => ({
        ...g,
        my_role:   g.my_role   || null,
        my_status: g.my_status || null,
      })).filter(g => g.my_status === 'active');
    }
  } catch (e) {
    myGroups = [];
  }
}

// ── 컨텍스트 메뉴 빌드 ───────────────────────────────────
function buildContextMenu() {
  const container = document.getElementById('ctx-menu-items');
  if (!container) return;

  let html = `
    <button onclick="switchContextToUser()" class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700 transition text-slate-200">
      <i class="fas fa-user text-blue-400 w-4 text-center"></i>
      <span>개인 계정</span>
      ${currentCtx.type === 'user' ? '<i class="fas fa-check text-blue-400 ml-auto"></i>' : ''}
    </button>`;

  const adminGroups = myGroups.filter(g => g.my_role === 'admin' || g.my_role === 'sub_admin');
  if (adminGroups.length > 0) {
    html += `<div class="border-t border-slate-700 my-1"></div>
      <p class="px-3 py-1 text-xs text-slate-500 font-semibold uppercase">그룹 관리</p>`;
    adminGroups.forEach(g => {
      const active = currentCtx.type === 'group' && currentCtx.id === g.id;
      html += `
        <button onclick="switchContextToGroup(${g.id})"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700 transition text-slate-200">
          <i class="fas fa-users text-purple-400 w-4 text-center"></i>
          <span class="truncate flex-1 text-left">${escHtml(g.name)}</span>
          ${active ? '<i class="fas fa-check text-blue-400 flex-shrink-0"></i>' : ''}
        </button>`;
    });
  }

  container.innerHTML = html;
}

function toggleContextMenu() {
  const menu = document.getElementById('ctx-menu');
  menu.classList.toggle('hidden');
}

// ── 컨텍스트 전환: 개인 ──────────────────────────────────
function switchContextToUser() {
  currentCtx = { type: 'user' };
  document.getElementById('ctx-icon').className = 'fas fa-user text-blue-400 text-xs flex-shrink-0';
  document.getElementById('ctx-name').textContent = '개인 계정';
  document.getElementById('header-ctx-badge').classList.add('hidden');
  document.getElementById('ctx-menu').classList.add('hidden');
  buildNavMenu();
  showSection('dashboard');
  buildContextMenu();
  history.pushState(null, '', '/app/dashboard');
}

// ── 컨텍스트 전환: 그룹 ──────────────────────────────────
function switchContextToGroup(groupId, navigate = true) {
  const grp = myGroups.find(g => g.id === groupId);
  if (!grp) return;

  currentCtx = { type: 'group', id: grp.id, name: grp.name, role: grp.my_role };
  document.getElementById('ctx-icon').className = 'fas fa-users text-purple-400 text-xs flex-shrink-0';
  document.getElementById('ctx-name').textContent = grp.name;

  const badge = document.getElementById('header-ctx-badge');
  badge.textContent = grp.my_role === 'admin' ? '관리자' : '부관리자';
  badge.classList.remove('hidden');

  document.getElementById('ctx-menu').classList.add('hidden');
  buildNavMenu();
  buildContextMenu();

  if (navigate) {
    showSection('group-dashboard');
    history.pushState(null, '', `/app/group/${groupId}/dashboard`);
    loadGroupDashboard(groupId);
  }
}

// ── 네비게이션 메뉴 빌드 ─────────────────────────────────
function buildNavMenu() {
  const nav = document.getElementById('nav-menu');
  if (!nav) return;

  if (currentCtx.type === 'user') {
    nav.innerHTML = `
      ${navItem('dashboard',    'tachometer-alt', '대시보드')}
      ${navItem('cards',        'id-card',        '내 명함')}
      ${navItem('groups',       'users',          '내 그룹')}
      <div class="border-t border-slate-700 my-2"></div>
      ${navItem('points',       'coins',          '포인트')}
      ${navItem('subscription', 'crown',          '구독')}
      <div class="border-t border-slate-700 my-2"></div>
      ${navItem('notifications','bell',           '알림')}`;
  } else {
    const gid = currentCtx.id;
    nav.innerHTML = `
      ${navItem('group-dashboard', 'tachometer-alt', '그룹 대시보드',  `/app/group/${gid}/dashboard`)}
      ${navItem('group-members',   'users',          '멤버 관리',       `/app/group/${gid}/members`)}
      ${navItem('group-events',    'calendar-alt',   '행사 관리',       `/app/group/${gid}/events`)}
      ${navItem('group-points',    'coins',          '그룹 포인트',     `/app/group/${gid}/points`)}
      ${navItem('group-lessons',   'chalkboard-teacher','레슨 관리',    `/app/group/${gid}/lessons`)}
      ${navItem('group-invites',   'link',           '초대링크',        `/app/group/${gid}/invites`)}
      <div class="border-t border-slate-700 my-2"></div>
      ${navItem('dashboard',       'arrow-left',     '개인 계정으로')}`;
  }

  // 현재 섹션 활성화
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === currentSection);
  });
}

function navItem(section, icon, label, href) {
  return `<button class="nav-item w-full text-left" data-section="${section}"
    onclick="navClick('${section}', '${href || ''}')">
    <i class="fas fa-${icon}"></i> ${label}
  </button>`;
}

function navClick(section, href) {
  // "개인 계정으로" 클릭 시 컨텍스트 전환
  if (section === 'dashboard' && currentCtx.type === 'group') {
    switchContextToUser();
    return;
  }
  if (href) history.pushState(null, '', href);
  showSection(section);
  closeSidebar();
}

// ── 섹션 전환 ────────────────────────────────────────────
function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('section-' + name);
  if (target) target.classList.add('active');

  // 헤더 타이틀
  const titles = {
    'dashboard':         '대시보드',
    'cards':             '내 명함',
    'groups':            '내 그룹',
    'points':            '포인트',
    'subscription':      '구독',
    'notifications':     '알림',
    'group-dashboard':   '그룹 대시보드',
    'group-members':     '멤버 관리',
    'group-events':      '행사 관리',
    'group-points':      '그룹 포인트',
    'group-lessons':     '레슨 관리',
    'group-invites':     '초대링크',
  };
  document.getElementById('page-title').textContent = titles[name] || 'METI';

  // 활성 nav 표시
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name);
  });

  // 데이터 로드
  loadSectionData(name);
}

// ── 섹션별 데이터 로드 ───────────────────────────────────
function loadSectionData(name) {
  switch (name) {
    case 'dashboard':       loadDashboard();                         break;
    case 'cards':           loadCards();                             break;
    case 'groups':          loadGroups();                            break;
    case 'points':          loadPoints();                            break;
    case 'subscription':    loadSubscription();                      break;
    case 'group-dashboard': loadGroupDashboard(currentCtx.id);      break;
    case 'group-members':   loadGroupMembers(currentCtx.id);        break;
    case 'group-events':    loadGroupEvents(currentCtx.id);         break;
    case 'group-points':    loadGroupPoints(currentCtx.id);         break;
    case 'group-lessons':   loadGroupLessons(currentCtx.id);        break;
    case 'group-invites':   loadGroupInvites(currentCtx.id);        break;
  }
}

// ════════════════════════════════════════════════════════
// ── [개인] 대시보드
// ════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const [cardsRes, groupsRes] = await Promise.allSettled([
      axios.get('/cards'),
      axios.get('/groups?limit=5'),
    ]);

    // 명함 통계
    if (cardsRes.status === 'fulfilled' && cardsRes.value.data.success) {
      const cards = cardsRes.value.data.data?.cards || [];
      document.getElementById('stat-cards').textContent = cards.length;

      const recentEl = document.getElementById('recent-cards');
      if (cards.length > 0) {
        recentEl.innerHTML = cards.slice(0, 3).map(c => `
          <div class="item-card flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-id-card text-blue-600 text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800 text-sm truncate">${escHtml(c.name)}</p>
              <p class="text-xs text-gray-500 truncate">${escHtml(c.title || c.company || '')}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full ${c.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
              ${c.is_public ? '공개' : '비공개'}
            </span>
          </div>`).join('');
      } else {
        recentEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">명함이 없습니다.</p>';
      }
    }

    // 그룹 통계
    document.getElementById('stat-groups').textContent = myGroups.length;
    const recentGrpEl = document.getElementById('recent-groups');
    if (myGroups.length > 0) {
      recentGrpEl.innerHTML = myGroups.slice(0, 3).map(g => `
        <div class="item-card flex items-center gap-3 cursor-pointer" onclick="navToGroup(${g.id})">
          <div class="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-users text-purple-600 text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 text-sm truncate">${escHtml(g.name)}</p>
            <p class="text-xs text-gray-500">멤버 ${g.member_count || '-'}명</p>
          </div>
          ${(g.my_role === 'admin' || g.my_role === 'sub_admin')
            ? '<span class="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">관리자</span>'
            : ''}
        </div>`).join('');
    } else {
      recentGrpEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">소속된 그룹이 없습니다.</p>';
    }

    // 포인트 (point_wallets API 추가 전 임시)
    document.getElementById('stat-points').textContent = '-';
    document.getElementById('stat-plan').textContent   = planLabel(currentUser.plan);

  } catch (e) {
    console.error('loadDashboard error', e);
  }
}

// ════════════════════════════════════════════════════════
// ── [개인] 내 명함
// ════════════════════════════════════════════════════════
async function loadCards() {
  const el = document.getElementById('cards-list');
  el.innerHTML = loadingHtml();
  try {
    const res = await axios.get('/cards');
    if (!res.data.success) { el.innerHTML = emptyHtml('명함이 없습니다.'); return; }
    const cards = res.data.data?.cards || [];
    if (cards.length === 0) { el.innerHTML = emptyHtml('명함이 없습니다. 첫 명함을 만들어보세요!'); return; }

    el.innerHTML = cards.map(c => `
      <div class="item-card flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <i class="fas fa-id-card text-white"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-gray-800 truncate">${escHtml(c.name)}</p>
            <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${c.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
              ${c.is_public ? '공개' : '비공개'}
            </span>
          </div>
          <p class="text-sm text-gray-500 truncate">${escHtml([c.title, c.company].filter(Boolean).join(' · '))}</p>
          <p class="text-xs text-gray-400 mt-0.5">${escHtml(c.email || '')}</p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button onclick="copyCardLink('${c.id}')" title="링크 복사"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition">
            <i class="fas fa-link text-xs"></i>
          </button>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = errorHtml('명함을 불러오지 못했습니다.');
  }
}

async function copyCardLink(cardId) {
  const url = `${window.location.origin}/card/${cardId}`;
  await navigator.clipboard.writeText(url).catch(() => {});
  alert('링크가 복사되었습니다: ' + url);
}

// ── 명함 생성 ─────────────────────────────────────────────
function openCreateCardModal() {
  document.getElementById('modal-create-card').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-card-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('card-form-error');
    errEl.classList.add('hidden');
    try {
      const res = await axios.post('/cards', {
        name:      document.getElementById('card-name').value.trim(),
        title:     document.getElementById('card-title').value.trim(),
        company:   document.getElementById('card-company').value.trim(),
        email:     document.getElementById('card-email').value.trim(),
        phone:     document.getElementById('card-phone').value.trim(),
        bio:       document.getElementById('card-bio').value.trim(),
        is_public: document.getElementById('card-public').checked ? 1 : 0,
      });
      if (res.data.success) {
        closeModal('modal-create-card');
        form.reset();
        loadCards();
      } else {
        errEl.textContent = res.data.error || '명함 생성에 실패했습니다.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  });
});

// ════════════════════════════════════════════════════════
// ── [개인] 내 그룹 목록
// ════════════════════════════════════════════════════════
async function loadGroups() {
  const el = document.getElementById('groups-list');
  el.innerHTML = loadingHtml();
  try {
    await loadMyGroups();
    if (myGroups.length === 0) {
      el.innerHTML = `
        <div class="text-center py-12">
          <i class="fas fa-users text-gray-300 text-4xl mb-3"></i>
          <p class="text-gray-500 mb-4">아직 소속된 그룹이 없습니다.</p>
          <button onclick="openJoinGroupModal()"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            그룹 탐색하기
          </button>
        </div>`;
      return;
    }

    el.innerHTML = myGroups.map(g => `
      <div class="item-card">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-users text-white"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold text-gray-800">${escHtml(g.name)}</p>
              <span class="text-xs px-2 py-0.5 rounded-full ${roleColor(g.my_role)}">${roleLabel(g.my_role)}</span>
            </div>
            <p class="text-sm text-gray-500 truncate mt-0.5">${escHtml(g.description || g.purpose || '')}</p>
            <p class="text-xs text-gray-400 mt-0.5">멤버 ${g.member_count || '-'}명</p>
          </div>
          <div class="flex flex-col gap-2 flex-shrink-0">
            <!-- 관리자인 경우 그룹 관리 버튼 -->
            ${(g.my_role === 'admin' || g.my_role === 'sub_admin') ? `
              <button onclick="switchContextToGroup(${g.id})"
                class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition whitespace-nowrap">
                <i class="fas fa-cog mr-1"></i>그룹 관리
              </button>` : ''}
            <button onclick="openGroupDetailModal(${g.id})"
              class="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition whitespace-nowrap">
              <i class="fas fa-info-circle mr-1"></i>상세보기
            </button>
          </div>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = errorHtml('그룹 목록을 불러오지 못했습니다.');
  }
}

function navToGroup(groupId) {
  const grp = myGroups.find(g => g.id === groupId);
  if (!grp) return;
  if (grp.my_role === 'admin' || grp.my_role === 'sub_admin') {
    switchContextToGroup(groupId);
  } else {
    openGroupDetailModal(groupId);
  }
}

function openJoinGroupModal() {
  alert('그룹 탐색 기능은 준비 중입니다.');
}

function openGroupDetailModal(groupId) {
  alert('그룹 상세보기 (ID: ' + groupId + ') — 준비 중');
}

// ════════════════════════════════════════════════════════
// ── [개인] 포인트
// ════════════════════════════════════════════════════════
async function loadPoints() {
  // Phase 1 완료 후 /api/v1/points/me 연동 예정
  document.getElementById('points-balance').textContent = '-';
  document.getElementById('points-history').innerHTML =
    '<p class="text-sm text-gray-400 text-center py-6">포인트 시스템 준비 중입니다.</p>';
}

function openChargeModal() {
  alert('포인트 충전은 결제 시스템 연동 후 이용 가능합니다.');
}

// ════════════════════════════════════════════════════════
// ── [개인] 구독
// ════════════════════════════════════════════════════════
async function loadSubscription() {
  const planName = planLabel(currentUser.plan);
  document.getElementById('sub-plan-name').textContent  = planName;
  document.getElementById('sub-status-text').textContent =
    currentUser.plan === 'free' ? '무료 플랜 이용 중' : `${planName} 플랜 구독 중`;

  document.getElementById('plan-cards').innerHTML = [
    { code: 'free',     name: 'Free',     price: '무료',    points: '0 P',       cards: '3개',   color: 'gray' },
    { code: 'pro',      name: 'Pro',      price: '미정',    points: '10,000 P',  cards: '10개',  color: 'blue' },
    { code: 'business', name: 'Business', price: '미정',    points: '500,000 P', cards: '무제한', color: 'purple' },
  ].map(p => `
    <div class="stat-card border-2 ${currentUser.plan === p.code ? 'border-blue-500' : 'border-transparent'}">
      <div class="flex items-center justify-between mb-3">
        <span class="font-bold text-${p.color}-600">${p.name}</span>
        ${currentUser.plan === p.code ? '<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">현재</span>' : ''}
      </div>
      <p class="text-2xl font-bold text-gray-800 mb-1">${p.price}</p>
      <p class="text-xs text-gray-500">월 / 구독</p>
      <ul class="mt-3 space-y-1 text-sm text-gray-600">
        <li><i class="fas fa-check text-green-500 mr-1"></i>명함 ${p.cards}</li>
        <li><i class="fas fa-check text-green-500 mr-1"></i>구독 포인트 ${p.points}</li>
        ${p.code !== 'free' ? '<li><i class="fas fa-check text-green-500 mr-1"></i>그룹 생성·운영</li>' : ''}
        ${p.code === 'business' ? '<li><i class="fas fa-check text-green-500 mr-1"></i>그룹 관리자 기능</li>' : ''}
      </ul>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════
// ── [그룹관리] 그룹 대시보드
// ════════════════════════════════════════════════════════
async function loadGroupDashboard(groupId) {
  if (!groupId) return;
  try {
    const res = await axios.get(`/groups/${groupId}`);
    if (!res.data.success) return;
    const g = res.data.data;

    document.getElementById('group-desc-text').textContent = g.description || g.purpose || '';

    // 멤버 수
    const memRes = await axios.get(`/groups/${groupId}/members?status=active&limit=1`);
    document.getElementById('gstat-members').textContent = memRes.data.data?.total || '-';

    const pendRes = await axios.get(`/groups/${groupId}/members?status=pending&limit=5`);
    document.getElementById('gstat-pending').textContent = pendRes.data.data?.total || 0;

    // 그룹 포인트 (Phase 1 후 연동)
    document.getElementById('gstat-points').textContent = '-';
    document.getElementById('gstat-events').textContent  = '-';

    // 대기 멤버 목록
    const pending = pendRes.data.data?.members || [];
    const pendEl  = document.getElementById('group-pending-list');
    if (pending.length > 0) {
      pendEl.innerHTML = pending.map(m => `
        <div class="flex items-center gap-3 py-2 border-b last:border-0">
          <div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-user text-yellow-600 text-xs"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800">${escHtml(m.name || m.email || '-')}</p>
            <p class="text-xs text-gray-400">${formatDate(m.created_at)}</p>
          </div>
          <div class="flex gap-1">
            <button onclick="approveMember(${groupId}, ${m.user_id})"
              class="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">승인</button>
            <button onclick="rejectMember(${groupId}, ${m.user_id})"
              class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">거절</button>
          </div>
        </div>`).join('');
    } else {
      pendEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">가입 대기 중인 멤버가 없습니다.</p>';
    }
  } catch (e) {
    console.error('loadGroupDashboard error', e);
  }
}

// ════════════════════════════════════════════════════════
// ── [그룹관리] 멤버 관리
// ════════════════════════════════════════════════════════
let memberTabStatus = 'pending';

function switchMemberTab(status) {
  memberTabStatus = status;
  document.getElementById('mtab-pending').className =
    status === 'pending'
      ? 'px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-800 shadow-sm'
      : 'px-4 py-1.5 rounded-md text-sm font-medium text-gray-500';
  document.getElementById('mtab-active').className =
    status === 'active'
      ? 'px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-800 shadow-sm'
      : 'px-4 py-1.5 rounded-md text-sm font-medium text-gray-500';
  loadGroupMembers(currentCtx.id);
}

async function loadGroupMembers(groupId) {
  if (!groupId) return;
  const el = document.getElementById('members-list');
  el.innerHTML = loadingHtml();
  try {
    const res = await axios.get(`/groups/${groupId}/members?status=${memberTabStatus}&limit=50`);
    const members = res.data.data?.members || [];

    // 대기 카운트 표시
    if (memberTabStatus === 'pending') {
      document.getElementById('pending-count').textContent =
        members.length > 0 ? `(${members.length})` : '';
    }

    if (members.length === 0) {
      el.innerHTML = emptyHtml(memberTabStatus === 'pending' ? '대기 중인 멤버가 없습니다.' : '멤버가 없습니다.'); return;
    }

    el.innerHTML = members.map(m => `
      <div class="item-card flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <i class="fas fa-user text-gray-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-medium text-gray-800 text-sm">${escHtml(m.name || m.email || '-')}</p>
            ${m.role === 'admin' ? '<span class="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">관리자</span>' : ''}
          </div>
          <p class="text-xs text-gray-400">${escHtml(m.email || '')} · ${formatDate(m.joined_at || m.created_at)}</p>
        </div>
        ${memberTabStatus === 'pending' ? `
          <div class="flex gap-1">
            <button onclick="approveMember(${groupId}, ${m.user_id})"
              class="px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">승인</button>
            <button onclick="rejectMember(${groupId}, ${m.user_id})"
              class="px-2 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600">거절</button>
          </div>` : `
          <button onclick="kickMember(${groupId}, ${m.user_id}, '${escHtml(m.name || '')}')"
            class="text-gray-300 hover:text-red-500 transition px-1" title="내보내기">
            <i class="fas fa-user-times"></i>
          </button>`}
      </div>`).join('');
  } catch (e) {
    el.innerHTML = errorHtml('멤버 목록을 불러오지 못했습니다.');
  }
}

async function approveMember(groupId, userId) {
  try {
    await axios.patch(`/groups/${groupId}/members/${userId}`, { action: 'approve' });
    loadGroupMembers(groupId);
    loadGroupDashboard(groupId);
  } catch (e) { alert('승인 처리 중 오류가 발생했습니다.'); }
}

async function rejectMember(groupId, userId) {
  if (!confirm('가입 신청을 거절하시겠습니까?')) return;
  try {
    await axios.patch(`/groups/${groupId}/members/${userId}`, { action: 'reject' });
    loadGroupMembers(groupId);
    loadGroupDashboard(groupId);
  } catch (e) { alert('거절 처리 중 오류가 발생했습니다.'); }
}

async function kickMember(groupId, userId, name) {
  if (!confirm(`'${name}' 멤버를 내보내시겠습니까?`)) return;
  try {
    await axios.patch(`/groups/${groupId}/members/${userId}`, { action: 'kick' });
    loadGroupMembers(groupId);
  } catch (e) { alert('내보내기 처리 중 오류가 발생했습니다.'); }
}

// ════════════════════════════════════════════════════════
// ── [그룹관리] 행사 관리
// ════════════════════════════════════════════════════════
async function loadGroupEvents(groupId) {
  if (!groupId) return;
  const el = document.getElementById('events-list');
  el.innerHTML = loadingHtml();
  try {
    const res = await axios.get(`/api/v1/events/groups/${groupId}/events?limit=20`);
    const events = res.data.data || [];
    if (events.length === 0) { el.innerHTML = emptyHtml('행사가 없습니다.'); return; }
    el.innerHTML = events.map(ev => `
      <div class="item-card">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-calendar-alt text-green-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-800">${escHtml(ev.title)}</p>
            <p class="text-sm text-gray-500 mt-0.5">${escHtml(ev.location || '')}</p>
            <p class="text-xs text-gray-400 mt-1">${formatDate(ev.starts_at)} ~ ${formatDate(ev.ends_at)}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full ${statusColor(ev.status)}">${ev.status}</span>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = errorHtml('행사 목록을 불러오지 못했습니다.'); }
}

function openCreateEventModal() {
  document.getElementById('modal-create-event').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-event-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('event-form-error');
    errEl.classList.add('hidden');
    try {
      const res = await axios.post(`/api/v1/events/groups/${currentCtx.id}/events`, {
        group_id:    currentCtx.id,
        title:       document.getElementById('event-title').value.trim(),
        description: document.getElementById('event-desc').value.trim(),
        location:    document.getElementById('event-location').value.trim(),
        starts_at:   document.getElementById('event-starts').value,
        ends_at:     document.getElementById('event-ends').value,
        max_participants: parseInt(document.getElementById('event-max').value) || null,
      });
      if (res.data.success) {
        closeModal('modal-create-event');
        form.reset();
        loadGroupEvents(currentCtx.id);
      } else {
        errEl.textContent = res.data.error || '행사 생성에 실패했습니다.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  });
});

// ════════════════════════════════════════════════════════
// ── [그룹관리] 그룹 포인트
// ════════════════════════════════════════════════════════
async function loadGroupPoints(groupId) {
  if (!groupId) return;
  document.getElementById('group-points-balance').textContent = '-';
  document.getElementById('group-points-history').innerHTML =
    '<p class="text-sm text-gray-400 text-center py-6">포인트 시스템 준비 중입니다.</p>';
}

function openGroupChargeModal() { alert('그룹 포인트 충전은 결제 시스템 연동 후 이용 가능합니다.'); }
function openTransferModal()    { alert('개인→그룹 포인트 이전은 포인트 시스템 연동 후 이용 가능합니다.'); }

// ════════════════════════════════════════════════════════
// ── [그룹관리] 레슨 관리
// ════════════════════════════════════════════════════════
async function loadGroupLessons(groupId) {
  if (!groupId) return;
  const el = document.getElementById('lessons-list');
  el.innerHTML = loadingHtml();
  try {
    const res = await axios.get(`/api/v1/lessons/groups/${groupId}/lessons?limit=20`);
    const lessons = res.data.data || [];
    if (lessons.length === 0) { el.innerHTML = emptyHtml('레슨 일정이 없습니다.'); return; }
    el.innerHTML = lessons.map(l => `
      <div class="item-card flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <i class="fas fa-chalkboard-teacher text-blue-600 text-sm"></i>
        </div>
        <div class="flex-1">
          <p class="font-medium text-gray-800 text-sm">${escHtml(l.title || l.name || '-')}</p>
          <p class="text-xs text-gray-400">${formatDate(l.scheduled_at || l.date)}</p>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = errorHtml('레슨 목록을 불러오지 못했습니다.'); }
}

function openLessonCreateModal() {
  const groupId = currentCtx?.id;
  if (!groupId) return;
  // 강사 목록 먼저 로드
  axios.get(`/api/v1/groups/${groupId}/members?role=instructor&limit=50`).then(res => {
    const instructors = (res.data.data || []).filter(m =>
      ['admin','sub_admin','instructor'].includes(m.role)
    );
    const optHtml = instructors.length === 0
      ? '<option value="">강사 없음 (먼저 강사 역할 지정 필요)</option>'
      : instructors.map(m => `<option value="${m.user_id}">${escHtml(m.name)}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'modal-lesson-create';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-screen overflow-y-auto">
        <div class="px-5 py-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-900">레슨 일정 추가</h3>
          <button onclick="document.getElementById('modal-lesson-create').remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="lesson-create-form" class="px-5 py-4 space-y-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">강사 <span class="text-red-500">*</span></label>
            <select id="lc-instructor" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              ${optHtml}
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">레슨명 <span class="text-red-500">*</span></label>
            <input type="text" id="lc-title" placeholder="레슨명 입력" maxlength="200"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">일시 <span class="text-red-500">*</span></label>
            <input type="datetime-local" id="lc-scheduled"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-sm font-semibold text-gray-600 mb-1">시간(분)</label>
              <input type="number" id="lc-duration" value="60" min="10" max="480"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div class="flex-1">
              <label class="block text-sm font-semibold text-gray-600 mb-1">정원</label>
              <input type="number" id="lc-capacity" placeholder="무제한" min="1"
                class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">장소</label>
            <input type="text" id="lc-location" placeholder="장소 (선택)" maxlength="200"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <p id="lc-error" class="hidden text-red-500 text-sm"></p>
          <button type="submit"
            class="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
            레슨 추가 (500P 차감)
          </button>
        </form>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('lesson-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('lc-error');
      errEl.classList.add('hidden');
      const instructorId = parseInt(document.getElementById('lc-instructor').value);
      const title = document.getElementById('lc-title').value.trim();
      const scheduled = document.getElementById('lc-scheduled').value;
      if (!title) { errEl.textContent='레슨명을 입력해주세요.'; errEl.classList.remove('hidden'); return; }
      if (!scheduled) { errEl.textContent='일시를 선택해주세요.'; errEl.classList.remove('hidden'); return; }
      if (!instructorId) { errEl.textContent='강사를 선택해주세요.'; errEl.classList.remove('hidden'); return; }
      try {
        await axios.post(`/api/v1/lessons/groups/${groupId}/lessons`, {
          instructor_id   : instructorId,
          title,
          scheduled_at    : scheduled,
          duration_minutes: parseInt(document.getElementById('lc-duration').value) || 60,
          capacity        : parseInt(document.getElementById('lc-capacity').value) || undefined,
          location        : document.getElementById('lc-location').value.trim() || undefined,
        });
        modal.remove();
        loadGroupLessons(groupId);
      } catch (err) {
        errEl.textContent = err.response?.data?.error || '레슨 추가에 실패했습니다.';
        errEl.classList.remove('hidden');
      }
    });
  }).catch(() => {
    alert('멤버 목록을 불러오지 못했습니다.');
  });
}

// ════════════════════════════════════════════════════════
// ── [그룹관리] 초대링크
// ════════════════════════════════════════════════════════
async function loadGroupInvites(groupId) {
  if (!groupId) return;
  const el = document.getElementById('invites-list');
  el.innerHTML = loadingHtml();
  try {
    const res = await axios.get(`/groups/${groupId}/invite-links`);
    const links = res.data.data?.links || [];
    if (links.length === 0) { el.innerHTML = emptyHtml('초대링크가 없습니다.'); return; }
    el.innerHTML = links.map(lk => `
      <div class="item-card">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium text-gray-800 text-sm">${escHtml(lk.label || '초대링크')}</p>
              <span class="text-xs px-2 py-0.5 rounded-full ${lk.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                ${lk.is_active ? '활성' : '비활성'}
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-1 break-all">${escHtml(lk.url || '')}</p>
            <p class="text-xs text-gray-400 mt-0.5">사용 ${lk.used_count}회 / ${lk.max_uses ? lk.max_uses + '회' : '무제한'}</p>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <button onclick="copyLink('${escHtml(lk.url || '')}')"
              class="px-2 py-1 border border-gray-200 rounded text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300">
              복사
            </button>
            ${lk.is_active ? `
            <button onclick="deactivateInviteLink(${groupId}, ${lk.id})"
              class="px-2 py-1 border border-red-200 rounded text-xs text-red-400 hover:bg-red-50">
              비활성
            </button>` : ''}
          </div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = errorHtml('초대링크를 불러오지 못했습니다.'); }
}

function openCreateInviteModal() {
  document.getElementById('modal-create-invite').classList.remove('hidden');
  document.getElementById('invite-result').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-invite-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('invite-form-error');
    errEl.classList.add('hidden');
    try {
      const res = await axios.post(`/groups/${currentCtx.id}/invite-links`, {
        label:     document.getElementById('invite-label').value.trim() || null,
        max_uses:  parseInt(document.getElementById('invite-max-uses').value) || null,
        expires_at:document.getElementById('invite-expires').value || null,
      });
      if (res.data.success) {
        document.getElementById('invite-url').value = res.data.data.url || '';
        document.getElementById('invite-result').classList.remove('hidden');
        loadGroupInvites(currentCtx.id);
      } else {
        errEl.textContent = res.data.error || '링크 생성에 실패했습니다.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  });
});

async function deactivateInviteLink(groupId, linkId) {
  if (!confirm('이 초대링크를 비활성화하시겠습니까?')) return;
  try {
    await axios.patch(`/groups/${groupId}/invite-links/${linkId}/deactivate`);
    loadGroupInvites(groupId);
  } catch (e) { alert('비활성화 처리 중 오류가 발생했습니다.'); }
}

function copyInviteUrl() { copyLink(document.getElementById('invite-url').value); }

async function copyLink(url) {
  await navigator.clipboard.writeText(url).catch(() => {});
  alert('링크가 복사되었습니다!');
}

// ════════════════════════════════════════════════════════
// ── 공통 유틸
// ════════════════════════════════════════════════════════
async function tryRefreshToken() {
  const rt = localStorage.getItem('meti_refresh_token');
  if (!rt) return false;
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    const data = await res.json();
    if (data.success) {
      authToken = data.data.access_token;
      localStorage.setItem('meti_token', authToken);
      localStorage.setItem('meti_refresh_token', data.data.refresh_token);
      return true;
    }
    return false;
  } catch { return false; }
}

function logout() {
  axios.post('/auth/logout', { refresh_token: localStorage.getItem('meti_refresh_token') }).catch(() => {});
  localStorage.removeItem('meti_token');
  localStorage.removeItem('meti_refresh_token');
  localStorage.removeItem('meti_user');
  window.location.href = '/app/login';
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openSidebar()  {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function planLabel(plan) {
  return { free: 'Free', pro: 'Pro', business: 'Business' }[plan] || plan || 'Free';
}
function roleLabel(role) {
  return { admin: '관리자', sub_admin: '부관리자', member: '멤버' }[role] || role || '멤버';
}
function roleColor(role) {
  return role === 'admin' ? 'bg-purple-100 text-purple-700'
       : role === 'sub_admin' ? 'bg-blue-100 text-blue-700'
       : 'bg-gray-100 text-gray-600';
}
function statusColor(status) {
  return status === 'active' ? 'bg-green-100 text-green-700'
       : status === 'pending' ? 'bg-yellow-100 text-yellow-700'
       : 'bg-gray-100 text-gray-500';
}
function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function loadingHtml() {
  return '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></div>';
}
function emptyHtml(msg) {
  return `<div class="text-center py-10 text-gray-400 text-sm">${msg}</div>`;
}
function errorHtml(msg) {
  return `<div class="text-center py-10 text-red-400 text-sm"><i class="fas fa-exclamation-circle mr-1"></i>${msg}</div>`;
}
