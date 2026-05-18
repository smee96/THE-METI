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

  // 프로필 사진
  if (currentUser.avatar_url) {
    const img  = document.getElementById('sidebar-avatar-img');
    const icon = document.getElementById('sidebar-avatar-icon');
    img.src = currentUser.avatar_url;
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  }

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
      myGroups = (Array.isArray(res.data.data) ? res.data.data : (res.data.data?.groups || [])).map(g => ({
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
      const cards = Array.isArray(cardsRes.value.data.data) ? cardsRes.value.data.data : (cardsRes.value.data.data?.cards || []);
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
    const cards = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.cards || []);
    if (cards.length === 0) { el.innerHTML = emptyHtml('명함이 없습니다. 첫 명함을 만들어보세요!'); return; }

    el.innerHTML = cards.map(c => `
      <div class="item-card flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition" onclick="openCardPreview(${c.id})">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          ${c.avatar_url
            ? `<img src="${escHtml(c.avatar_url)}" class="w-12 h-12 rounded-xl object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <i class="fas fa-id-card text-white ${c.avatar_url ? 'hidden' : ''}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-gray-800 truncate">${escHtml(c.name)}</p>
            ${c.is_primary ? '<span class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full flex-shrink-0">대표</span>' : ''}
            <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${c.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
              ${c.is_public ? '공개' : '비공개'}
            </span>
          </div>
          <p class="text-sm text-gray-500 truncate">${escHtml([c.title, c.company].filter(Boolean).join(' · '))}</p>
          <p class="text-xs text-gray-400 mt-0.5">${escHtml(c.email || '')}</p>
        </div>
        <div class="flex gap-1.5 flex-shrink-0" onclick="event.stopPropagation()">
          <button onclick="openEditCardModal(${c.id})" title="수정"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition">
            <i class="fas fa-edit text-xs"></i>
          </button>
          <button onclick="copyCardLink('${c.id}')" title="링크 복사"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-green-600 hover:border-green-300 transition">
            <i class="fas fa-link text-xs"></i>
          </button>
          <button onclick="deleteCard(${c.id})" title="삭제"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-300 transition">
            <i class="fas fa-trash text-xs"></i>
          </button>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = errorHtml('명함을 불러오지 못했습니다.');
  }
}

// ════════════════════════════════════════════════════════
// ── 프로필 모달
// ════════════════════════════════════════════════════════
function openProfileModal() {
  const modal = document.getElementById('modal-profile');
  modal.classList.remove('hidden');

  // 현재 유저 정보 채우기
  document.getElementById('profile-name-input').value    = currentUser.name  || '';
  document.getElementById('profile-email-display').value = currentUser.email || '';
  document.getElementById('profile-plan-display').value  = planLabel(currentUser.plan);
  document.getElementById('profile-form-error').classList.add('hidden');
  document.getElementById('avatar-upload-status').textContent = '클릭하여 사진 변경 (JPG·PNG·WEBP, 최대 5MB)';

  // 아바타 미리보기 초기화
  const img  = document.getElementById('profile-avatar-img');
  const icon = document.getElementById('profile-avatar-icon');
  if (currentUser.avatar_url) {
    img.src = currentUser.avatar_url;
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    icon.classList.remove('hidden');
  }

  // 이름 수정 폼 이벤트 (중복 등록 방지)
  const form = document.getElementById('profile-name-form');
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('profile-form-error');
    errEl.classList.add('hidden');
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) return;
    try {
      const res = await axios.patch('/auth/me', { name });
      if (res.data.success) {
        currentUser = { ...currentUser, ...res.data.data };
        localStorage.setItem('meti_user', JSON.stringify(currentUser));
        document.getElementById('sidebar-username').textContent = currentUser.name;
        document.getElementById('greeting-name').textContent    = currentUser.name;
        closeModal('modal-profile');
        showToast('프로필이 저장되었습니다!');
      } else {
        errEl.textContent = res.data.error || '저장에 실패했습니다.';
        errEl.classList.remove('hidden');
      }
    } catch(e) {
      errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  });
}

// 파일 선택 → 즉시 업로드
async function onAvatarFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const statusEl = document.getElementById('avatar-upload-status');
  const img      = document.getElementById('profile-avatar-img');
  const icon     = document.getElementById('profile-avatar-icon');

  // 클라이언트 사이드 미리보기
  const reader = new FileReader();
  reader.onload = (e) => {
    img.src = e.target.result;
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  statusEl.textContent = '업로드 중...';
  statusEl.className   = 'text-xs text-blue-500 mt-2';

  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axios.post('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      const avatarUrl = res.data.data.avatar_url;
      currentUser = { ...currentUser, avatar_url: avatarUrl };
      localStorage.setItem('meti_user', JSON.stringify(currentUser));

      // 사이드바 아바타도 즉시 반영
      const sideImg  = document.getElementById('sidebar-avatar-img');
      const sideIcon = document.getElementById('sidebar-avatar-icon');
      sideImg.src = avatarUrl;
      sideImg.classList.remove('hidden');
      sideIcon.classList.add('hidden');

      statusEl.textContent = '✓ 업로드 완료!';
      statusEl.className   = 'text-xs text-green-600 mt-2';
    } else {
      statusEl.textContent = res.data.error || '업로드 실패';
      statusEl.className   = 'text-xs text-red-500 mt-2';
    }
  } catch(e) {
    statusEl.textContent = e.response?.data?.error || '업로드 중 오류가 발생했습니다.';
    statusEl.className   = 'text-xs text-red-500 mt-2';
  }
  // input 초기화 (같은 파일 재선택 허용)
  event.target.value = '';
}

// ── 명함 미리보기 모달 ────────────────────────────────────
async function openCardPreview(cardId) {
  const modal = document.getElementById('modal-card-preview');
  const body  = document.getElementById('card-preview-body');
  modal.classList.remove('hidden');
  body.innerHTML = loadingHtml();
  try {
    const res = await axios.get(`/cards/${cardId}`);
    if (!res.data.success) { body.innerHTML = errorHtml('명함을 불러오지 못했습니다.'); return; }
    const c = res.data.data;
    const pubUrl = `${window.location.origin}/card/${c.id}`;
    body.innerHTML = `
      <!-- 숨김 파일 input (아바타 업로드용) -->
      <input id="preview-avatar-input" type="file" accept="image/*" class="hidden"
             onchange="onPreviewCardAvatarChange(event, ${c.id})">
      <!-- 카드 헤더 -->
      <div class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center mb-4">
        <div class="relative w-20 h-20 rounded-full mx-auto mb-3 group cursor-pointer"
             onclick="document.getElementById('preview-avatar-input').click()"
             title="사진 변경">
          <div id="preview-avatar-wrap" class="w-20 h-20 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            ${c.avatar_url
              ? `<img id="preview-avatar-img" src="${escHtml(c.avatar_url)}" class="w-20 h-20 object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user text-white text-3xl\\'></i>'">`
              : '<i class="fas fa-user text-white text-3xl"></i>'}
          </div>
          <!-- 호버/터치 오버레이 -->
          <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
            <i class="fas fa-camera text-white text-lg"></i>
          </div>
        </div>
        <p id="preview-avatar-status" class="text-xs text-blue-200 -mt-1 mb-2 min-h-[1rem]"></p>
        <h2 class="text-xl font-bold">${escHtml(c.name)}</h2>
        ${c.title   ? `<p class="text-blue-200 text-sm mt-0.5">${escHtml(c.title)}</p>` : ''}
        ${c.company ? `<p class="text-blue-100 text-sm">${escHtml(c.company)}</p>` : ''}
        <div class="flex items-center justify-center gap-2 mt-2">
          ${c.is_primary ? '<span class="text-xs px-2 py-0.5 bg-white/20 rounded-full">대표 명함</span>' : ''}
          <span class="text-xs px-2 py-0.5 ${c.is_public ? 'bg-green-400/30' : 'bg-white/10'} rounded-full">
            ${c.is_public ? '🌐 공개' : '🔒 비공개'}
          </span>
        </div>
      </div>
      <!-- 연락처 정보 -->
      <div class="space-y-2 mb-4">
        ${c.email   ? `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><i class="fas fa-envelope text-blue-500 w-4 text-center"></i><span class="text-sm text-gray-700">${escHtml(c.email)}</span></div>` : ''}
        ${c.phone   ? `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><i class="fas fa-phone text-blue-500 w-4 text-center"></i><span class="text-sm text-gray-700">${escHtml(c.phone)}</span></div>` : ''}
        ${c.website ? `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><i class="fas fa-globe text-blue-500 w-4 text-center"></i><a href="${escHtml(c.website)}" target="_blank" class="text-sm text-blue-600 underline truncate">${escHtml(c.website)}</a></div>` : ''}
        ${c.bio     ? `<div class="p-3 bg-gray-50 rounded-xl"><p class="text-sm text-gray-600">${escHtml(c.bio)}</p></div>` : ''}
      </div>
      <!-- 공유 링크 -->
      ${c.is_public ? `
      <div class="p-3 bg-blue-50 rounded-xl">
        <p class="text-xs text-gray-500 mb-1.5">공개 링크</p>
        <div class="flex gap-2">
          <input type="text" value="${pubUrl}" readonly
            class="flex-1 text-xs bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 min-w-0">
          <button onclick="copyCardLink(${c.id})"
            class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 whitespace-nowrap">
            <i class="fas fa-copy mr-1"></i>복사
          </button>
        </div>
      </div>` : ''}
      <!-- 액션 버튼 -->
      <div class="flex gap-2 mt-4">
        <button onclick="openEditCardModal(${c.id}); closeModal('modal-card-preview')"
          class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
          <i class="fas fa-edit mr-1"></i>수정
        </button>
        <button onclick="deleteCard(${c.id}); closeModal('modal-card-preview')"
          class="px-4 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
  } catch (e) {
    body.innerHTML = errorHtml('명함을 불러오지 못했습니다.');
  }
}

// 명함 미리보기 모달 — 아바타 터치 → 즉시 업로드
async function onPreviewCardAvatarChange(event, cardId) {
  const file = event.target.files?.[0];
  if (!file) return;

  const wrap   = document.getElementById('preview-avatar-wrap');
  const status = document.getElementById('preview-avatar-status');

  // 로컬 미리보기 즉시 표시
  const reader = new FileReader();
  reader.onload = (e) => {
    if (wrap) {
      wrap.innerHTML = `<img id="preview-avatar-img" src="${e.target.result}" class="w-20 h-20 object-cover rounded-full">`;
    }
  };
  reader.readAsDataURL(file);

  if (status) { status.textContent = '업로드 중...'; }

  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axios.post(`/cards/${cardId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      if (status) { status.textContent = '✓ 저장됨'; }
      showToast('명함 사진이 업데이트되었습니다!');
      loadCards(); // 배경 목록 새로고침
    } else {
      if (status) { status.textContent = res.data.error || '업로드 실패'; }
      showToast(res.data.error || '업로드에 실패했습니다.', 'error');
    }
  } catch(e) {
    if (status) { status.textContent = '오류 발생'; }
    showToast(e.response?.data?.error || '업로드 중 오류가 발생했습니다.', 'error');
  }
  event.target.value = '';
}

// ── 명함 수정 모달 ────────────────────────────────────────
async function openEditCardModal(cardId) {
  const modal = document.getElementById('modal-edit-card');
  modal.classList.remove('hidden');
  // 현재 데이터 로드
  try {
    const res = await axios.get(`/cards/${cardId}`);
    if (!res.data.success) return;
    const c = res.data.data;
    document.getElementById('edit-card-id').value        = c.id;
    document.getElementById('edit-card-name').value      = c.name    || '';
    document.getElementById('edit-card-title').value     = c.title   || '';
    document.getElementById('edit-card-company').value   = c.company || '';
    document.getElementById('edit-card-email').value     = c.email   || '';
    document.getElementById('edit-card-phone').value     = c.phone   || '';
    document.getElementById('edit-card-website').value   = c.website || '';
    document.getElementById('edit-card-bio').value       = c.bio     || '';
    document.getElementById('edit-card-public').checked  = !!c.is_public;
    document.getElementById('edit-card-primary').checked = !!c.is_primary;
    document.getElementById('edit-card-error').classList.add('hidden');
    // 아바타 미리보기 설정
    const preview = document.getElementById('edit-card-avatar-preview');
    if (preview) {
      preview.src = c.avatar_url
        ? c.avatar_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || '?')}&background=6366f1&color=fff&size=96`;
    }
    // 파일 input 초기화
    const fi = document.getElementById('edit-card-avatar-input');
    if (fi) fi.value = '';
  } catch(e) {
    alert('명함 정보를 불러오지 못했습니다.');
    closeModal('modal-edit-card');
  }
}

async function submitEditCard(e) {
  e.preventDefault();
  const errEl  = document.getElementById('edit-card-error');
  const cardId = document.getElementById('edit-card-id').value;
  errEl.classList.add('hidden');
  try {
    const res = await axios.patch(`/cards/${cardId}`, {
      name:       document.getElementById('edit-card-name').value.trim()    || null,
      title:      document.getElementById('edit-card-title').value.trim()   || null,
      company:    document.getElementById('edit-card-company').value.trim() || null,
      email:      document.getElementById('edit-card-email').value.trim()   || null,
      phone:      document.getElementById('edit-card-phone').value.trim()   || null,
      website:    document.getElementById('edit-card-website').value.trim() || null,
      bio:        document.getElementById('edit-card-bio').value.trim()     || null,
      is_public:  document.getElementById('edit-card-public').checked  ? 1 : 0,
      is_primary: document.getElementById('edit-card-primary').checked ? 1 : 0,
    });
    if (res.data.success) {
      closeModal('modal-edit-card');
      loadCards();
    } else {
      errEl.textContent = res.data.error || '수정에 실패했습니다.';
      errEl.classList.remove('hidden');
    }
  } catch(e) {
    errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
    errEl.classList.remove('hidden');
  }
}

// ── 명함 삭제 ─────────────────────────────────────────────
async function deleteCard(cardId) {
  if (!confirm('이 명함을 삭제하시겠습니까?')) return;
  try {
    const res = await axios.delete(`/cards/${cardId}`);
    if (res.data.success) {
      loadCards();
    } else {
      alert(res.data.error || '삭제에 실패했습니다.');
    }
  } catch(e) {
    alert(e.response?.data?.error || '오류가 발생했습니다.');
  }
}

async function copyCardLink(cardId) {
  const url = `${window.location.origin}/card/${cardId}`;
  await navigator.clipboard.writeText(url).catch(() => {});
  // 토스트 알림
  showToast('링크가 복사되었습니다!');
}

// ── 토스트 알림 ───────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  const colorClass = type === 'error' ? 'bg-red-600'
                   : type === 'info'  ? 'bg-blue-600'
                   : 'bg-gray-800';
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${colorClass}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── 명함 생성 ─────────────────────────────────────────────
function openCreateCardModal() {
  document.getElementById('modal-create-card').classList.remove('hidden');
  // 아바타 미리보기 초기화
  const preview = document.getElementById('create-card-avatar-preview');
  if (preview) {
    preview.src = 'https://ui-avatars.com/api/?name=+&background=6366f1&color=fff&size=96';
    preview.dataset.pendingFile = '';
  }
  // 파일 input 초기화
  const fileInput = document.getElementById('create-card-avatar-input');
  if (fileInput) fileInput.value = '';
}

// 명함 생성 모달 — 아바타 파일 선택 (로컬 미리보기만, 업로드는 생성 후)
function onCreateCardAvatarChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = document.getElementById('create-card-avatar-preview');
  const reader  = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.dataset.pendingFile = 'true'; // 파일이 대기 중임을 표시
  };
  reader.readAsDataURL(file);
}

// 명함 수정 모달 — 아바타 파일 선택 → 즉시 업로드
async function onEditCardAvatarChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const cardId  = document.getElementById('edit-card-id').value;
  const preview = document.getElementById('edit-card-avatar-preview');

  // 로컬 미리보기 먼저 표시
  const reader = new FileReader();
  reader.onload = (e) => { preview.src = e.target.result; };
  reader.readAsDataURL(file);

  // 즉시 서버에 업로드
  showToast('사진 업로드 중...', 'info');
  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axios.post(`/cards/${cardId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      showToast('명함 사진이 업데이트되었습니다!');
      loadCards(); // 목록 새로고침
    } else {
      showToast(res.data.error || '업로드에 실패했습니다.', 'error');
    }
  } catch(e) {
    showToast(e.response?.data?.error || '업로드 중 오류가 발생했습니다.', 'error');
  }
  event.target.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  // 명함 생성 폼
  const form = document.getElementById('create-card-form');
  if (form) {
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
          const newCardId = res.data.data?.id;
          // 대기 중인 아바타 파일이 있으면 업로드
          const avatarInput   = document.getElementById('create-card-avatar-input');
          const avatarPreview = document.getElementById('create-card-avatar-preview');
          if (newCardId && avatarInput?.files?.length > 0 && avatarPreview?.dataset?.pendingFile) {
            try {
              const fd = new FormData();
              fd.append('avatar', avatarInput.files[0]);
              await axios.post(`/cards/${newCardId}/avatar`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch (_) { /* 사진 실패해도 명함은 생성됨 */ }
          }
          closeModal('modal-create-card');
          form.reset();
          // 아바타 미리보기도 초기화
          if (avatarPreview) {
            avatarPreview.src = 'https://ui-avatars.com/api/?name=+&background=6366f1&color=fff&size=96';
            avatarPreview.dataset.pendingFile = '';
          }
          if (avatarInput) avatarInput.value = '';
          loadCards();
          showToast('명함이 생성되었습니다!');
        } else {
          errEl.textContent = res.data.error || '명함 생성에 실패했습니다.';
          errEl.classList.remove('hidden');
        }
      } catch (e) {
        errEl.textContent = e.response?.data?.error || '오류가 발생했습니다.';
        errEl.classList.remove('hidden');
      }
    });
  }

  // 명함 수정 폼
  const editForm = document.getElementById('edit-card-form');
  if (editForm) {
    editForm.addEventListener('submit', submitEditCard);
  }
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

// ════════════════════════════════════════════════════════
// ── 그룹 탐색
// ════════════════════════════════════════════════════════
let _explorePage      = 1;
let _exploreTotal     = 0;
let _exploreQuery     = '';
let _exploreSearchTimer = null;

async function openJoinGroupModal() {
  document.getElementById('modal-group-explore').classList.remove('hidden');
  _explorePage  = 1;
  _exploreTotal = 0;
  _exploreQuery = '';
  const input = document.getElementById('explore-search-input');
  if (input) input.value = '';
  await loadExploreGroups(true);
}

function onExploreSearchInput(val) {
  clearTimeout(_exploreSearchTimer);
  _exploreSearchTimer = setTimeout(async () => {
    _exploreQuery = val.trim();
    _explorePage  = 1;
    _exploreTotal = 0;
    await loadExploreGroups(true);
  }, 400);
}

async function loadExploreGroups(reset = false) {
  const listEl   = document.getElementById('explore-groups-list');
  const moreWrap = document.getElementById('explore-load-more-wrap');
  if (reset) listEl.innerHTML = loadingHtml();

  try {
    const params = new URLSearchParams({ page: _explorePage, limit: 10 });
    if (_exploreQuery) params.set('q', _exploreQuery);
    const res = await axios.get(`/groups?${params}`);
    if (!res.data.success) { listEl.innerHTML = emptyHtml('그룹을 불러오지 못했습니다.'); return; }

    const groups = Array.isArray(res.data.data) ? res.data.data : [];
    _exploreTotal = res.data.pagination?.total ?? groups.length;

    if (reset) listEl.innerHTML = '';

    if (groups.length === 0 && reset) {
      listEl.innerHTML = emptyHtml(_exploreQuery ? `"${_exploreQuery}" 검색 결과가 없습니다.` : '공개 그룹이 없습니다.');
      moreWrap.classList.add('hidden');
      return;
    }

    // 내가 이미 속한 그룹 id 목록
    const myGroupIds = new Set(myGroups.map(g => g.id));

    groups.forEach(g => {
      const isMember  = myGroupIds.has(g.id);
      const isFeatured = g.is_featured;
      const card = document.createElement('div');
      card.className = 'border border-gray-100 rounded-2xl p-4 hover:shadow-md transition cursor-pointer';
      card.onclick = () => openGroupDetailModal(g.id);
      card.innerHTML = `
        <div class="flex items-start gap-3">
          <!-- 로고 -->
          <div class="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden
               ${g.logo_url ? '' : 'bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center'}">
            ${g.logo_url
              ? `<img src="${escHtml(g.logo_url)}" class="w-12 h-12 object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-users text-white\\'></i>'">`
              : '<i class="fas fa-users text-white"></i>'}
          </div>
          <!-- 정보 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-gray-800 truncate">${escHtml(g.name)}</span>
              ${isFeatured ? '<span class="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex-shrink-0">⭐ 추천</span>' : ''}
              ${isMember   ? '<span class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full flex-shrink-0">가입됨</span>' : ''}
            </div>
            <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">${escHtml(g.description || g.purpose || '')}</p>
            <div class="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span><i class="fas fa-users mr-1"></i>${g.member_count ?? 0}명</span>
              <span><i class="fas fa-user-tie mr-1"></i>${escHtml(g.admin_name || '-')}</span>
            </div>
          </div>
          <!-- 가입 버튼 -->
          <div class="flex-shrink-0" onclick="event.stopPropagation()">
            ${isMember
              ? `<span class="text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg">가입됨</span>`
              : `<button onclick="joinGroup(${g.id}, this)"
                   class="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
                   가입 신청
                 </button>`}
          </div>
        </div>`;
      listEl.appendChild(card);
    });

    // 더보기 버튼 표시 여부
    const loaded = (_explorePage - 1) * 10 + groups.length;
    if (loaded < _exploreTotal) {
      _explorePage++;
      moreWrap.classList.remove('hidden');
    } else {
      moreWrap.classList.add('hidden');
      if (!reset && groups.length > 0) {
        const endMsg = document.createElement('p');
        endMsg.className = 'text-center text-xs text-gray-400 pt-2';
        endMsg.textContent = `전체 ${_exploreTotal}개 그룹을 모두 불러왔습니다.`;
        listEl.appendChild(endMsg);
      }
    }
  } catch(e) {
    if (reset) listEl.innerHTML = errorHtml('그룹을 불러오지 못했습니다.');
  }
}

async function loadMoreExploreGroups() {
  await loadExploreGroups(false);
}

// ── 그룹 가입 신청 ─────────────────────────────────────
async function joinGroup(groupId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '신청 중...'; }
  try {
    const res = await axios.post(`/groups/${groupId}/join`, {});
    if (res.data.success) {
      showToast('가입 신청이 완료되었습니다! 관리자 승인을 기다려주세요.', 'info');
      if (btn) {
        btn.textContent = '신청 완료';
        btn.className = 'text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg cursor-default';
      }
      await loadMyGroups(); // 내 그룹 목록 갱신
    } else {
      showToast(res.data.error || '가입 신청에 실패했습니다.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '가입 신청'; }
    }
  } catch(e) {
    const msg = e.response?.data?.error || '오류가 발생했습니다.';
    showToast(msg, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '가입 신청'; }
  }
}

// ── 그룹 상세보기 모달 ─────────────────────────────────
async function openGroupDetailModal(groupId) {
  const modal = document.getElementById('modal-group-detail');
  const body  = document.getElementById('group-detail-body');
  modal.classList.remove('hidden');
  body.innerHTML = loadingHtml();

  try {
    const res = await axios.get(`/groups/${groupId}`);
    if (!res.data.success) { body.innerHTML = errorHtml('그룹을 불러오지 못했습니다.'); return; }
    const g = res.data.data;

    const myGroupIds  = new Set(myGroups.map(gr => gr.id));
    const isMember    = myGroupIds.has(g.id);
    const myEntry     = myGroups.find(gr => gr.id === g.id);
    const isAdmin     = myEntry && (myEntry.my_role === 'admin' || myEntry.my_role === 'sub_admin');

    body.innerHTML = `
      <!-- 로고 + 이름 -->
      <div class="flex flex-col items-center text-center mb-5">
        <div class="w-20 h-20 rounded-2xl mb-3 overflow-hidden flex-shrink-0
             ${g.logo_url ? '' : 'bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center'}">
          ${g.logo_url
            ? `<img src="${escHtml(g.logo_url)}" class="w-20 h-20 object-cover">`
            : '<i class="fas fa-users text-white text-3xl"></i>'}
        </div>
        <div class="flex items-center gap-2 flex-wrap justify-center">
          <h4 class="text-xl font-bold text-gray-800">${escHtml(g.name)}</h4>
          ${g.is_featured ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">⭐ 추천</span>' : ''}
        </div>
        ${g.description ? `<p class="text-sm text-gray-500 mt-1.5">${escHtml(g.description)}</p>` : ''}
      </div>

      <!-- 통계 배지 -->
      <div class="grid grid-cols-3 gap-2 mb-5">
        <div class="bg-blue-50 rounded-xl p-3 text-center">
          <p class="text-lg font-bold text-blue-600">${g.member_count ?? 0}</p>
          <p class="text-xs text-gray-500">멤버</p>
        </div>
        <div class="bg-purple-50 rounded-xl p-3 text-center">
          <p class="text-sm font-semibold text-purple-600 truncate">${escHtml(g.admin_name || '-')}</p>
          <p class="text-xs text-gray-500">관리자</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-3 text-center">
          <p class="text-sm font-semibold text-gray-600">${g.visibility === 'public' ? '공개' : '비공개'}</p>
          <p class="text-xs text-gray-500">공개여부</p>
        </div>
      </div>

      <!-- 용도 -->
      ${g.purpose ? `
      <div class="bg-gray-50 rounded-xl p-4 mb-4">
        <p class="text-xs font-semibold text-gray-500 mb-1">그룹 소개</p>
        <p class="text-sm text-gray-700">${escHtml(g.purpose)}</p>
      </div>` : ''}

      <!-- 정원 안내 -->
      ${g.max_members ? `
      <div class="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <i class="fas fa-door-open text-gray-400"></i>
        최대 정원: <span class="font-semibold text-gray-700">${g.max_members}명</span>
        ${(g.member_count ?? 0) >= g.max_members
          ? '<span class="ml-auto text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">정원 마감</span>'
          : `<span class="ml-auto text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">잔여 ${g.max_members - (g.member_count ?? 0)}석</span>`}
      </div>` : ''}

      <!-- 가입 상태별 액션 -->
      <div id="group-detail-action">
        ${isAdmin
          ? `<button onclick="switchContextToGroup(${g.id}); closeModal('modal-group-detail'); closeModal('modal-group-explore')"
               class="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition">
               <i class="fas fa-cog mr-2"></i>그룹 관리
             </button>`
          : isMember
            ? `<div class="space-y-2">
                 <div class="w-full py-3 bg-gray-100 text-gray-500 rounded-xl text-center text-sm">
                   <i class="fas fa-check-circle mr-2 text-green-500"></i>이미 가입된 그룹입니다
                 </div>
                 <button onclick="leaveGroupConfirm(${g.id})"
                   class="w-full py-2.5 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition">
                   그룹 탈퇴
                 </button>
               </div>`
            : g.status !== 'active'
              ? `<div class="w-full py-3 bg-gray-100 text-gray-400 rounded-xl text-center text-sm">
                   현재 가입이 불가능한 그룹입니다
                 </div>`
              : `<button id="detail-join-btn" onclick="joinGroupFromDetail(${g.id})"
                   class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
                   <i class="fas fa-user-plus mr-2"></i>가입 신청
                 </button>`}
      </div>`;
  } catch(e) {
    body.innerHTML = errorHtml('그룹 정보를 불러오지 못했습니다.');
  }
}

async function joinGroupFromDetail(groupId) {
  const btn = document.getElementById('detail-join-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>신청 중...'; }
  try {
    const res = await axios.post(`/groups/${groupId}/join`, {});
    if (res.data.success) {
      showToast('가입 신청이 완료되었습니다! 관리자 승인을 기다려주세요.', 'info');
      const actionEl = document.getElementById('group-detail-action');
      if (actionEl) {
        actionEl.innerHTML = `
          <div class="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-center text-sm font-medium">
            <i class="fas fa-clock mr-2"></i>가입 신청 완료 — 관리자 승인 대기 중
          </div>`;
      }
      await loadMyGroups();
      // 탐색 목록에서도 해당 카드 버튼 업데이트
      const exploreBtns = document.querySelectorAll(`#explore-groups-list [onclick*="joinGroup(${groupId}"]`);
      exploreBtns.forEach(b => {
        b.textContent = '신청 완료';
        b.className = 'text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg cursor-default';
        b.disabled = true;
      });
    } else {
      showToast(res.data.error || '가입 신청에 실패했습니다.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus mr-2"></i>가입 신청'; }
    }
  } catch(e) {
    showToast(e.response?.data?.error || '오류가 발생했습니다.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus mr-2"></i>가입 신청'; }
  }
}

async function leaveGroupConfirm(groupId) {
  if (!confirm('정말 이 그룹을 탈퇴하시겠습니까?')) return;
  try {
    const res = await axios.delete(`/groups/${groupId}/leave`);
    if (res.data.success) {
      showToast('그룹에서 탈퇴했습니다.', 'success');
      closeModal('modal-group-detail');
      await loadMyGroups();
      loadGroups();
    } else {
      showToast(res.data.error || '탈퇴에 실패했습니다.', 'error');
    }
  } catch(e) {
    showToast(e.response?.data?.error || '오류가 발생했습니다.', 'error');
  }
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
