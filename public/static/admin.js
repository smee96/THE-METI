// METI Admin Web SPA — v3.0 (METI Design System)
// ============================================================

const API = '/api/v1';
let authToken   = localStorage.getItem('meti_token');
let currentUser = JSON.parse(localStorage.getItem('meti_user') || 'null');
let currentSection = 'dashboard';
let sidebarOpen    = false;

// Axios 기본 설정
axios.defaults.baseURL = API;
axios.interceptors.request.use(config => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});
axios.interceptors.response.use(
  res => res,
  err => { if (err.response?.status === 401) logout(); return Promise.reject(err); }
);

// ── 초기화 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!authToken || !currentUser) {
    localStorage.removeItem('meti_token');
    localStorage.removeItem('meti_refresh_token');
    localStorage.removeItem('meti_user');
    window.location.href = '/';
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
      class="fixed inset-0 z-20 hidden lg:hidden"
      style="background:rgba(6,18,42,0.55)"></div>

    <div class="flex min-h-screen">
      <!-- 사이드바 -->
      <aside id="sidebar"
        class="w-52 flex flex-col fixed z-30 top-0 bottom-0 -translate-x-full lg:translate-x-0 transition-transform duration-300"
        style="background:#0B1E40">

        <!-- 워드마크 -->
        <div class="px-4 py-4 flex items-center justify-between flex-shrink-0"
          style="border-bottom:1px solid rgba(255,255,255,0.08)">
          <div>
            <span style="font-size:18px;font-weight:800;letter-spacing:0.18em;color:#fff;">
              MET<span style="color:#C2974E">I</span>
            </span>
            <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.28);letter-spacing:0.12em;display:block;margin-top:2px;text-transform:uppercase;">Admin</span>
          </div>
          <button onclick="closeSidebar()" class="lg:hidden"
            style="color:rgba(255,255,255,0.38);font-size:16px;background:none;border:none;cursor:pointer;padding:4px;">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- 네비게이션 -->
        <nav class="flex-1 px-2 py-2 overflow-y-auto" style="scrollbar-width:none;-ms-overflow-style:none;">
          <style>#sidebar nav::-webkit-scrollbar{display:none}</style>
          ${navSection('메인')}
          ${navItem('dashboard',    'tachometer-alt',     '대시보드')}
          ${navItem('users',        'users',              '유저 관리')}
          ${navItem('groups',       'building',           '그룹 관리')}
          ${navItem('cards',        'id-card',            '명함 관리')}
          ${navItem('events',       'calendar-alt',       '행사 관리')}
          ${navItem('lessons',      'chalkboard-teacher', '레슨 관리')}
          ${navSection('결제 / 파트너')}
          ${navItem('orders',       'shopping-cart',      '주문/결제')}
          ${navItem('partners',     'handshake',          '파트너 관리')}
          ${navSection('운영')}
          ${navItem('reports',      'flag',               '신고 관리')}
          ${navItem('nfc-cards',    'credit-card',        'NFC 카드')}
          ${navSection('설정')}
          ${navItem('plan-configs', 'sliders-h',          '플랜 설정')}
        </nav>

        <!-- 사용자 정보 -->
        <div class="px-3 py-3 flex items-center gap-2.5 flex-shrink-0"
          style="border-top:1px solid rgba(255,255,255,0.08)">
          <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style="background:rgba(255,255,255,0.10)">
            <i class="fas fa-user" style="font-size:11px;color:rgba(255,255,255,0.55)"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="truncate" style="color:#fff;font-size:13px;font-weight:600;">${currentUser?.name || 'Admin'}</p>
          </div>
          <button onclick="logout()" title="로그아웃"
            style="color:rgba(255,255,255,0.38);background:none;border:none;cursor:pointer;padding:4px;transition:color 0.15s;"
            onmouseover="this.style.color='#D8513C'" onmouseout="this.style.color='rgba(255,255,255,0.38)'">
            <i class="fas fa-sign-out-alt" style="font-size:15px"></i>
          </button>
        </div>
      </aside>

      <!-- 메인 콘텐츠 -->
      <main class="flex-1 lg:ml-52 min-h-screen flex flex-col" style="background:var(--bg)">
        <!-- 상단 헤더 -->
        <header class="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
          style="background:#fff;border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line)">
          <div class="flex items-center gap-3">
            <button onclick="openSidebar()" class="lg:hidden"
              style="color:var(--sub);font-size:18px;background:none;border:none;cursor:pointer;padding:4px;">
              <i class="fas fa-bars"></i>
            </button>
            <h2 id="page-title" style="font-size:17px;font-weight:700;color:var(--ink)">대시보드</h2>
          </div>
          <div class="flex items-center gap-3">
            <span class="hidden sm:block" style="font-size:13px;color:var(--mute);">
              ${new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'})}
            </span>
            <span class="meti-badge" style="background:var(--gold-soft);color:var(--gold-admin);">Super Admin</span>
          </div>
        </header>

        <!-- 페이지 콘텐츠 -->
        <div id="page-content" class="flex-1 p-5 md:p-6">
          ${loadingSpinner()}
        </div>
      </main>
    </div>
  `;
}

function navSection(label) {
  return `<p style="font-size:10.5px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.24);padding:14px 12px 4px;">${label}</p>`;
}

function navItem(id, icon, label) {
  return `<button onclick="navigateTo('${id}');closeSidebar();" id="nav-${id}" class="sidebar-link">
    <i class="fas fa-${icon}"></i><span>${label}</span>
  </button>`;
}

// ── 사이드바 토글 (모바일) ─────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  sidebarOpen = true;
}
function closeSidebar() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');
  sidebarOpen = false;
}

// ── 네비게이션 ───────────────────────────────────────────
function navigateTo(section) {
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${section}`);
  if (navEl) navEl.classList.add('active');
  currentSection = section;
  if (window.location.hash.replace('#', '') !== section) {
    history.replaceState(null, '', `#${section}`);
  }
  const titles = {
    dashboard: '대시보드', users: '유저 관리', groups: '그룹 관리', cards: '명함 관리',
    events: '행사 관리', lessons: '레슨 관리', reports: '신고 관리',
    'nfc-cards': 'NFC 카드 관리', 'plan-configs': '플랜 설정', 'group-detail': '그룹 상세',
    orders: '주문/결제 관리', partners: '파트너 관리'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[section] || section;

  const pages = {
    dashboard: loadDashboard, users: loadUsers, groups: loadGroups, cards: loadCards,
    events: loadEvents, lessons: loadLessons, reports: loadReports,
    'nfc-cards': loadNfcCards, 'plan-configs': loadPlanConfigs,
    orders: loadOrders, partners: loadPartners
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
      <div class="space-y-5">
        <!-- 통계 카드 6개 -->
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          ${statCard('총 유저',      d.users?.total || 0,        'users',           'info',    `오늘 +${d.users?.today || 0}명`)}
          ${statCard('활성 그룹',    d.groups?.active || 0,      'building',        'success', `대기 ${d.groups?.pending || 0}개`)}
          ${statCard('예정 행사',    d.events?.upcoming || 0,    'calendar-alt',    'navy',    `전체 ${d.events?.total || 0}개`)}
          ${statCard('미처리 신고',  d.reports?.pending || 0,    'flag',            'danger',  `전체 ${d.reports?.total || 0}건`)}
          ${statCard('NFC 처리대기', d.nfc?.pending || 0,        'credit-card',     'warn',    `승인완료 ${d.nfc?.approved || 0}건`)}
          ${statCard('이달 매출',    revenue + '원',             'won-sign',        'gold',    `주문 ${d.orders?.total_orders || 0}건`)}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 플랜 분포 -->
          <div class="meti-card p-5">
            <h3 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-chart-pie" style="color:var(--navy);font-size:13px;"></i>플랜 분포
            </h3>
            <div class="space-y-3">
              ${planBar('Free',     d.users?.free_plan     || 0, d.users?.total || 1, 'mute')}
              ${planBar('Pro',      d.users?.pro_plan      || 0, d.users?.total || 1, 'info')}
              ${planBar('Business', d.users?.business_plan || 0, d.users?.total || 1, 'navy')}
            </div>
          </div>

          <!-- 빠른 실행 -->
          <div class="meti-card p-5">
            <h3 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-bolt" style="color:var(--gold-admin);font-size:13px;"></i>빠른 실행
            </h3>
            <div class="grid grid-cols-2 gap-2">
              ${quickBtn('groups',    'building',     '그룹 승인 대기',  d.groups?.pending || 0,       'warn')}
              ${quickBtn('reports',   'flag',         '신고 처리 대기',  d.reports?.pending || 0,      'danger')}
              ${quickBtn('nfc-cards', 'credit-card',  'NFC 처리 대기',   d.nfc?.pending || 0,          'info')}
              ${quickBtn('orders',    'shopping-cart','미처리 주문',      d.orders?.pending_orders || 0,'success')}
            </div>
          </div>

          <!-- 최근 가입 유저 -->
          <div class="meti-card p-5">
            <h3 style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-user-plus" style="color:var(--success);font-size:13px;"></i>최근 가입 유저
            </h3>
            <div class="space-y-2">
              ${(d.recent_users || []).map(u => `
                <div class="flex items-center gap-2.5 cursor-pointer rounded-xl p-2 transition"
                  style="margin:-4px" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''"
                  onclick="showUserDetail(${u.id})">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style="background:var(--info-soft)">
                    <i class="fas fa-user" style="font-size:11px;color:var(--info)"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p style="font-size:13px;font-weight:600;color:var(--ink)" class="truncate">${escHtml(u.name)}</p>
                    <p style="font-size:12px;color:var(--mute)" class="truncate">${escHtml(u.email)}</p>
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

// ── 통계 카드 ─────────────────────────────────────────────
function statCard(label, value, icon, color, sub) {
  const palette = {
    info:    { bg:'var(--info-soft)',    fg:'var(--info)'       },
    success: { bg:'var(--success-soft)', fg:'var(--success)'    },
    danger:  { bg:'var(--danger-soft)',  fg:'var(--danger)'     },
    warn:    { bg:'var(--warn-soft)',     fg:'var(--warn)'       },
    navy:    { bg:'rgba(11,30,64,0.09)', fg:'var(--navy)'       },
    gold:    { bg:'var(--gold-soft)',    fg:'var(--gold-admin)' },
  };
  const { bg, fg } = palette[color] || palette.info;
  const numVal = typeof value === 'number' ? value.toLocaleString() : value;
  return `<div class="meti-card p-4">
    <div class="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style="background:${bg}">
      <i class="fas fa-${icon}" style="font-size:14px;color:${fg}"></i>
    </div>
    <p style="font-size:24px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;">${numVal}</p>
    <p style="font-size:13px;color:var(--sub);margin-top:3px;font-weight:500;">${label}</p>
    <p style="font-size:12px;color:var(--mute);margin-top:4px;">${sub}</p>
  </div>`;
}

// ── 플랜 분포 바 ──────────────────────────────────────────
function planBar(label, count, total, color) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = { mute:'var(--mute)', info:'var(--info)', navy:'var(--navy)', gold:'var(--gold-admin)' };
  const bc = barColor[color] || 'var(--navy)';
  return `<div>
    <div class="flex justify-between mb-1.5" style="font-size:13px;">
      <span style="color:var(--sub);font-weight:500">${label}</span>
      <span style="font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;">
        ${count.toLocaleString()} <span style="color:var(--mute);font-weight:500">(${pct}%)</span>
      </span>
    </div>
    <div style="height:4px;background:var(--line);border-radius:99px;">
      <div style="height:4px;background:${bc};border-radius:99px;width:${pct}%;transition:width 0.4s"></div>
    </div>
  </div>`;
}

// ── 빠른 실행 버튼 ─────────────────────────────────────────
function quickBtn(section, icon, label, count, color) {
  const palette = {
    warn:    { bg:'var(--warn-soft)',    fg:'var(--warn)'    },
    danger:  { bg:'var(--danger-soft)', fg:'var(--danger)'  },
    info:    { bg:'var(--info-soft)',   fg:'var(--info)'    },
    success: { bg:'var(--success-soft)',fg:'var(--success)' },
  };
  const { bg, fg } = palette[color] || palette.info;
  return `<button onclick="navigateTo('${section}')"
    class="p-3 rounded-xl text-left transition w-full"
    style="background:${bg};border:none;cursor:pointer;font-family:var(--font);"
    onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter=''">
    <i class="fas fa-${icon} block mb-1.5" style="font-size:14px;color:${fg}"></i>
    <p style="font-size:12px;font-weight:600;color:var(--ink)">${label}</p>
    <p style="font-size:18px;font-weight:700;color:${fg};font-variant-numeric:tabular-nums">${count}</p>
  </button>`;
}

// ── 분리된 모듈 (별도 파일) ────────────────────────────────
// admin-users.js    : loadUsers, loadGroups, loadCards, showUserDetail
// admin-events.js   : loadEvents, showEventDetail, showCreateGroupModal, showCreateEventModal
// admin-plans.js    : loadPlanConfigs, updatePlanConfig
// admin-lessons.js  : loadLessons, showLessonDetail, openCreateLessonModal

// ── API 액션 함수 (admin-users.js 에서 호출) ───────────────
async function toggleUserActive(userId, currentStatus) {
  if (!confirm(`이 유저를 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/users/${userId}`, { is_active: currentStatus ? 0 : 1 });
    showToast('변경되었습니다.');
    loadUsers(1, document.getElementById('user-search')?.value || '');
  } catch { showToast('오류가 발생했습니다.', 'error'); }
}

async function changeUserPlan(userId, currentPlan) {
  const plans  = ['free', 'pro', 'business'];
  const labels = { free:'Free (명함 3개)', pro:'Pro (명함 10개)', business:'Business (무제한)' };
  const options = plans.map((p, i) => `${i + 1}. ${labels[p]}`).join('\n');
  const input = prompt(`현재 플랜: ${labels[currentPlan] || currentPlan}\n\n변경할 플랜:\n${options}\n\n(free / pro / business)`);
  if (!input) return;
  const plan = input.trim().toLowerCase();
  if (!plans.includes(plan)) { showToast('올바른 플랜을 입력하세요.', 'error'); return; }
  if (plan === currentPlan)  { showToast('동일한 플랜입니다.', 'error'); return; }
  try {
    await axios.patch(`/admin/users/${userId}`, { plan });
    showToast(`플랜이 ${labels[plan]}으로 변경되었습니다.`);
    loadUsers(1, document.getElementById('user-search')?.value || '');
  } catch { showToast('플랜 변경에 실패했습니다.', 'error'); }
}

async function approveGroup(groupId, action) {
  const messages = { approve:'승인', reject:'거절', suspend:'정지', activate:'활성화' };
  if (!confirm(`이 그룹을 ${messages[action]}하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/groups/${groupId}`, { action });
    showToast(`그룹이 ${messages[action]}되었습니다.`);
    loadGroups();
  } catch { showToast('오류가 발생했습니다.', 'error'); }
}

// ── 유틸리티 ─────────────────────────────────────────────
function setContent(html) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = html;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadingSpinner() {
  return `<div class="flex items-center justify-center h-48">
    <i class="fas fa-spinner fa-spin" style="font-size:22px;color:var(--navy)"></i>
  </div>`;
}

function errorBox(msg) {
  return `<div style="background:var(--danger-soft);border:1px solid rgba(216,81,60,.2);border-radius:var(--r-lg);padding:24px;text-align:center;color:var(--danger);font-size:13px;">
    <i class="fas fa-exclamation-circle" style="margin-right:8px;font-size:15px;"></i>${msg}
  </div>`;
}

function renderPagination(p, loadFn) {
  if (!p || p.total_pages <= 1) return '';
  const btns   = [];
  const current = p.page;
  const total  = p.total_pages;
  let start = Math.max(1, current - 2);
  let end   = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  const baseStyle = `style="width:32px;height:32px;border-radius:8px;font-size:13px;cursor:pointer;font-family:var(--font);"`;
  const activeStyle = `style="width:32px;height:32px;border-radius:8px;font-size:13px;cursor:pointer;background:var(--navy);color:#fff;border:none;font-weight:700;font-family:var(--font);"`;
  const defStyle  = `style="width:32px;height:32px;border-radius:8px;font-size:13px;cursor:pointer;background:#fff;border:1px solid var(--line);color:var(--sub);font-family:var(--font);" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='#fff'"`;
  const ellipsis  = `<span style="width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;color:var(--mute);font-size:12px;">…</span>`;

  if (start > 1) btns.push(`<button onclick="${loadFn}(1)" ${defStyle}>1</button>`);
  if (start > 2) btns.push(ellipsis);
  for (let i = start; i <= end; i++) {
    btns.push(`<button onclick="${loadFn}(${i})" ${i === current ? activeStyle : defStyle}>${i}</button>`);
  }
  if (end < total - 1) btns.push(ellipsis);
  if (end < total) btns.push(`<button onclick="${loadFn}(${total})" ${defStyle}>${total}</button>`);

  return `<div style="display:flex;justify-content:center;gap:4px;padding-top:14px;">${btns.join('')}</div>`;
}

// ── 뱃지 유틸 ────────────────────────────────────────────
function planBadge(plan) {
  const s = {
    free:     'background:var(--line);color:var(--sub)',
    pro:      'background:var(--info-soft);color:var(--info)',
    business: 'background:var(--gold-soft);color:var(--gold-admin)',
  };
  return `<span class="meti-badge" style="${s[plan] || s.free}">${plan}</span>`;
}

function accountTypeBadge(type) {
  return `<span class="meti-badge" style="background:var(--line);color:var(--sub)">${type === 'personal' ? '일반' : type}</span>`;
}

function categoryBadge(cat) {
  const map = { association:'협회', company:'기업', club:'동호회', other:'기타' };
  return `<span class="meti-badge" style="background:var(--info-soft);color:var(--info)">${map[cat] || cat || '-'}</span>`;
}

function eventStatusBadge(status) {
  const s = {
    upcoming: 'background:var(--info-soft);color:var(--info)',
    ongoing:  'background:var(--success-soft);color:var(--success)',
    ended:    'background:var(--line);color:var(--mute)',
  };
  const labels = { upcoming:'예정', ongoing:'진행중', ended:'종료' };
  return `<span class="meti-badge" style="${s[status] || s.ended}">${labels[status] || status || '-'}</span>`;
}

// ── 날짜 포맷 ─────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'});
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
}

// ── 토스트 알림 ───────────────────────────────────────────
function showToast(msg, type = 'success') {
  const bg = type === 'success' ? '#1B9C73' : '#D8513C';
  const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:24px;right:20px;left:20px;padding:13px 18px;border-radius:12px;
    color:#fff;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.18);
    z-index:9999;transition:opacity 0.25s,transform 0.25s;background:${bg};text-align:center;
    font-family:var(--font);`;
  toast.className = 'sm:left-auto sm:right-6 sm:w-auto';
  toast.innerHTML = `<i class="fas fa-${icon}" style="margin-right:8px;"></i>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

function logout() {
  localStorage.removeItem('meti_token');
  localStorage.removeItem('meti_user');
  window.location.href = '/';
}
