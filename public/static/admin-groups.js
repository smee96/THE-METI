/**
 * admin-groups.js — 그룹 상세 관리 UI (페이지 방식)
 * loadGroupDetailPage(groupId) 호출 → setContent()로 전체 페이지 렌더
 *
 * 탭 구성:
 *  [멤버]   — 멤버 목록 / 역할 변경 / 강제 탈퇴 / 가입 대기 승인
 *  [포인트] — 그룹 포인트 잔액 / 지급·차감 / 내역
 *  [그룹 정보] — 그룹 기본 정보 (읽기 전용)
 */

// ── 상태 전역 ─────────────────────────────────────────────
let _grpId           = null;
let _grpMemberStatus = 'active';
let _grpMemberPage   = 1;
let _grpPtPage       = 1;
let _grpCurrentTab   = 'members';

// ── 그룹 상세 페이지 진입점 ───────────────────────────────
async function loadGroupDetailPage(groupId) {
  _grpId           = groupId;
  _grpMemberStatus = 'active';
  _grpMemberPage   = 1;
  _grpPtPage       = 1;
  _grpCurrentTab   = 'members';

  // 페이지 뼈대 렌더 (탭 + 컨텐츠 영역)
  setContent(`
    <div class="space-y-4">
      <!-- 뒤로가기 -->
      <button onclick="navigateTo('groups')"
        class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition">
        <i class="fas fa-arrow-left"></i> 그룹 목록으로
      </button>

      <!-- 그룹명 헤더 -->
      <div class="flex items-center gap-3">
        <div id="grp-header-icon" class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <i class="fas fa-users text-indigo-600"></i>
        </div>
        <div>
          <h2 id="grp-page-title" class="text-xl font-bold text-gray-900">그룹 상세</h2>
          <p id="grp-page-sub" class="text-sm text-gray-400"></p>
        </div>
      </div>

      <!-- 탭 바 -->
      <div class="border-b border-gray-200">
        <nav class="flex gap-0">
          ${[['members','멤버'],['points','포인트'],['info','그룹 정보']].map(([t,l]) => `
            <button id="grptab-btn-${t}" onclick="switchGroupTab('${t}')"
              class="px-5 py-3 text-sm font-medium border-b-2 transition ${t === 'members'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}">
              ${l}
            </button>
          `).join('')}
        </nav>
      </div>

      <!-- 탭 콘텐츠 -->
      <div id="grptab-members" class="min-h-64">
        ${loadingSpinner()}
      </div>
      <div id="grptab-points"  class="min-h-64 hidden"></div>
      <div id="grptab-info"    class="min-h-64 hidden"></div>
    </div>
  `);

  // 그룹 기본 정보 + 멤버 탭 동시 로드
  const [detailData] = await Promise.all([
    _loadGroupDetail(groupId),
    _loadGroupMembers(groupId, 'active', 1),
  ]);

  if (detailData) {
    const el = document.getElementById('grp-page-title');
    if (el) el.textContent = detailData.name || '그룹 상세';
    const sub = document.getElementById('grp-page-sub');
    if (sub) sub.textContent = detailData.description || '';
  }
}

// ── 탭 전환 ───────────────────────────────────────────────
function switchGroupTab(tab) {
  _grpCurrentTab = tab;

  ['members', 'points', 'info'].forEach(t => {
    document.getElementById(`grptab-${t}`)?.classList.toggle('hidden', t !== tab);
    const btn = document.getElementById(`grptab-btn-${t}`);
    if (btn) {
      btn.className = btn.className
        .replace(/border-blue-600 text-blue-600|border-transparent text-gray-500 hover:text-gray-700/g, '')
        .trim();
      btn.className += t === tab
        ? ' border-blue-600 text-blue-600'
        : ' border-transparent text-gray-500 hover:text-gray-700';
    }
  });

  if (tab === 'points' && _grpId) {
    const el = document.getElementById('grptab-points');
    if (el && el.innerHTML.trim() === '') _loadGroupPoints(_grpId, 1);
  }
  if (tab === 'info' && _grpId) {
    const el = document.getElementById('grptab-info');
    if (el && el.innerHTML.trim() === '') _renderGroupInfo(_grpId);
  }
}

// ── 그룹 기본 정보 fetch ─────────────────────────────────
async function _loadGroupDetail(groupId) {
  try {
    const { data } = await axios.get(`/admin/groups/${groupId}/detail`);
    return data.data;
  } catch { return null; }
}

// ── 정보 탭 렌더 ─────────────────────────────────────────
async function _renderGroupInfo(groupId) {
  const el = document.getElementById('grptab-info');
  if (!el) return;
  el.innerHTML = loadingSpinner();

  try {
    const { data } = await axios.get(`/admin/groups/${groupId}/detail`);
    const g = data.data;

    const row = (label, val) =>
      `<div class="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
         <span class="text-sm text-gray-500 w-28 flex-shrink-0">${label}</span>
         <span class="text-sm text-gray-900 text-right">${val ?? '-'}</span>
       </div>`;

    const visLabel  = { public: '공개', group_only: '비공개', private: '비공개' };
    const statusCls = {
      active:    'bg-green-100 text-green-700',
      pending:   'bg-yellow-100 text-yellow-700',
      suspended: 'bg-red-100 text-red-600',
      rejected:  'bg-gray-100 text-gray-500',
    };

    el.innerHTML = `
      <div class="max-w-xl space-y-4">
        <div class="bg-white rounded-2xl border p-4 space-y-0">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 mb-1 border-b">기본 정보</p>
          ${row('그룹명',   escHtml(g.name))}
          ${row('설명',     escHtml(g.description))}
          ${row('목적',     escHtml(g.purpose))}
          ${row('카테고리', escHtml(g.category))}
          ${row('공개 설정', visLabel[g.visibility] ?? g.visibility)}
          ${row('상태', `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${statusCls[g.status] ?? 'bg-gray-100 text-gray-500'}">${g.status}</span>`)}
          ${row('최대 멤버', g.max_members ? g.max_members + '명' : '무제한')}
          ${row('미성년자',  g.has_minor ? '포함' : '성인 전용')}
          ${row('추천 그룹', g.is_featured ? '✅ 추천' : '-')}
        </div>
        <div class="bg-white rounded-2xl border p-4 space-y-0">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 mb-1 border-b">그룹 관리자</p>
          ${row('이름',   escHtml(g.admin_name))}
          ${row('이메일', escHtml(g.admin_email))}
        </div>
        <div class="bg-white rounded-2xl border p-4 space-y-0">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 mb-1 border-b">현황</p>
          ${row('전체 멤버', (g.member_count?.total ?? 0) + '명')}
          ${row('활성 멤버', (g.member_count?.active ?? 0) + '명')}
          ${row('가입 대기', (g.member_count?.pending ?? 0) + '명')}
          ${row('그룹 포인트', (g.point_balance ?? 0).toLocaleString() + ' P')}
        </div>
        <div class="bg-white rounded-2xl border p-4 space-y-0">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 mb-1 border-b">날짜</p>
          ${row('생성일',  formatDateTime(g.created_at))}
          ${row('승인일',  g.approved_at ? formatDateTime(g.approved_at) : '-')}
          ${row('수정일',  formatDateTime(g.updated_at))}
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = errorBox('그룹 정보를 불러오지 못했습니다.');
  }
}

// ── 멤버 탭 ───────────────────────────────────────────────
async function _loadGroupMembers(groupId, status = 'active', page = 1) {
  _grpMemberStatus = status;
  _grpMemberPage   = page;

  const el = document.getElementById('grptab-members');
  if (!el) return;
  el.innerHTML = loadingSpinner();

  try {
    const { data } = await axios.get(
      `/admin/groups/${groupId}/members?status=${status}&page=${page}&limit=30`
    );
    const members    = data.data        || [];
    const pagination = data.pagination;

    const statusTabs = [
      { key: 'active',  label: '활성' },
      { key: 'pending', label: '가입 대기' },
      { key: 'kicked',  label: '강제탈퇴' },
      { key: 'left',    label: '자진탈퇴' },
    ];

    const tabsHtml = statusTabs.map(t => {
      const active = status === t.key;
      const cls = active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
      return `<button onclick="_loadGroupMembers(${groupId},'${t.key}',1)"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition border ${cls}">${t.label}</button>`;
    }).join('');

    const roleLabel = { admin: '관리자', sub_admin: '부관리자', instructor: '강사', member: '멤버' };
    const roleCls   = {
      admin:      'bg-purple-100 text-purple-700',
      sub_admin:  'bg-blue-100 text-blue-700',
      instructor: 'bg-indigo-100 text-indigo-700',
      member:     'bg-gray-100 text-gray-600',
    };

    // 역할 변경 셀렉트 (active 상태만)
    const roleSel = (m) => status === 'active' ? `
      <select onchange="changeGroupMemberRole(${groupId}, ${m.id}, this.value)"
        class="text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
        ${['admin','sub_admin','instructor','member'].map(r =>
          `<option value="${r}" ${m.role === r ? 'selected' : ''}>${roleLabel[r]}</option>`
        ).join('')}
      </select>
    ` : `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${roleCls[m.role] ?? 'bg-gray-100 text-gray-600'}">${roleLabel[m.role] ?? m.role}</span>`;

    // 액션 버튼
    const actionBtns = (m) => {
      if (status === 'active' && m.role !== 'admin') {
        return `<button onclick="kickGroupMember(${groupId}, ${m.id}, '${escHtml(m.user_name)}')"
          class="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 font-medium">강퇴</button>`;
      }
      if (status === 'pending') {
        return `
          <button onclick="approveGroupMember(${groupId}, ${m.id}, 'approve')"
            class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">승인</button>
          <button onclick="approveGroupMember(${groupId}, ${m.id}, 'reject')"
            class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-medium">거절</button>
        `;
      }
      return '<span class="text-xs text-gray-300">-</span>';
    };

    // 데스크탑 테이블 행
    const rowsHtml = members.length === 0
      ? `<tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">멤버가 없습니다.</td></tr>`
      : members.map(m => `
        <tr class="hover:bg-gray-50 transition">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-gray-900">${escHtml(m.user_name)}</p>
            <p class="text-xs text-gray-400">${escHtml(m.user_email)}</p>
          </td>
          <td class="px-4 py-3">${roleSel(m)}</td>
          <td class="px-4 py-3 text-xs text-gray-400">
            ${m.joined_at ? formatDate(m.joined_at) : formatDate(m.created_at)}
          </td>
          <td class="px-4 py-3">
            <span class="text-xs px-1.5 py-0.5 rounded ${m.user_status === 'active'
              ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}">
              ${m.user_status === 'active' ? '정상' : '정지'}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="flex gap-1">${actionBtns(m)}</div>
          </td>
        </tr>
      `).join('');

    // 모바일 카드
    const cardsHtml = members.length === 0
      ? `<p class="text-center text-gray-400 text-sm py-10">멤버가 없습니다.</p>`
      : members.map(m => `
        <div class="bg-white border rounded-xl p-3 shadow-sm space-y-2">
          <div class="flex items-start justify-between">
            <div>
              <p class="font-medium text-sm text-gray-900">${escHtml(m.user_name)}</p>
              <p class="text-xs text-gray-400">${escHtml(m.user_email)}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${roleCls[m.role] ?? 'bg-gray-100 text-gray-600'}">
              ${roleLabel[m.role] ?? m.role}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-400">${m.joined_at ? formatDate(m.joined_at) : formatDate(m.created_at)}</span>
            <div class="flex gap-1 flex-wrap">
              ${status === 'active' ? roleSel(m) : ''}
              ${actionBtns(m)}
            </div>
          </div>
        </div>
      `).join('');

    const pgHtml = _grpPagination(pagination,
      (p) => `_loadGroupMembers(${groupId},'${status}',${p})`);

    el.innerHTML = `
      <div class="space-y-4">
        <!-- 상태 필터 탭 -->
        <div class="flex gap-1.5 flex-wrap">${tabsHtml}</div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-2xl border overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">멤버</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">역할</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">가입일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">계정</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">${rowsHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- 모바일 카드 -->
        <div class="md:hidden space-y-2">${cardsHtml}</div>

        ${pgHtml}
      </div>
    `;
  } catch (err) {
    el.innerHTML = errorBox('멤버 목록을 불러오지 못했습니다.');
  }
}

// ── 멤버 역할 변경 ────────────────────────────────────────
async function changeGroupMemberRole(groupId, memberId, role) {
  const roleLabel = { admin: '관리자', sub_admin: '부관리자', instructor: '강사', member: '일반 멤버' };
  if (!confirm(`역할을 "${roleLabel[role]}"(으)로 변경하시겠습니까?${role === 'admin'
    ? '\n\n⚠️ 기존 관리자는 부관리자로 강등됩니다.' : ''}`)) {
    _loadGroupMembers(groupId, _grpMemberStatus, _grpMemberPage);
    return;
  }
  try {
    const { data } = await axios.patch(
      `/admin/groups/${groupId}/members/${memberId}/role`, { role }
    );
    showToast(data.message || '역할이 변경되었습니다.', 'success');
    _loadGroupMembers(groupId, _grpMemberStatus, _grpMemberPage);
  } catch (err) {
    showToast(err.response?.data?.message || '역할 변경에 실패했습니다.', 'error');
    _loadGroupMembers(groupId, _grpMemberStatus, _grpMemberPage);
  }
}

// ── 멤버 강제 탈퇴 ────────────────────────────────────────
async function kickGroupMember(groupId, memberId, name) {
  if (!confirm(`"${name}" 멤버를 강제 탈퇴시키겠습니까?`)) return;
  try {
    const { data } = await axios.delete(`/admin/groups/${groupId}/members/${memberId}`);
    showToast(data.message || '강제 탈퇴 처리되었습니다.', 'success');
    _loadGroupMembers(groupId, _grpMemberStatus, _grpMemberPage);
  } catch (err) {
    showToast(err.response?.data?.message || '강제 탈퇴에 실패했습니다.', 'error');
  }
}

// ── 가입 대기 승인/거절 ───────────────────────────────────
async function approveGroupMember(groupId, memberId, action) {
  const label = action === 'approve' ? '승인' : '거절';
  if (!confirm(`가입 신청을 ${label}하시겠습니까?`)) return;
  try {
    const { data } = await axios.patch(
      `/admin/groups/${groupId}/members/${memberId}/approve`, { action }
    );
    showToast(data.message || `${label}되었습니다.`, 'success');
    _loadGroupMembers(groupId, _grpMemberStatus, _grpMemberPage);
  } catch (err) {
    showToast(err.response?.data?.message || '처리에 실패했습니다.', 'error');
  }
}

// ── 포인트 탭 ─────────────────────────────────────────────
async function _loadGroupPoints(groupId, page = 1) {
  _grpPtPage = page;
  const el = document.getElementById('grptab-points');
  if (!el) return;
  el.innerHTML = loadingSpinner();

  try {
    const { data } = await axios.get(`/admin/groups/${groupId}/point-history?page=${page}&limit=20`);
    const { balance, transactions, pagination } = data.data;

    const txType = {
      admin_grant:    { label: '어드민 지급', cls: 'text-blue-600' },
      admin_deduct:   { label: '어드민 차감', cls: 'text-red-500'  },
      lesson_create:  { label: '레슨 개설',   cls: 'text-orange-500' },
      event_create:   { label: '행사 개설',   cls: 'text-orange-500' },
      entry_fee_recv: { label: '참가비 수령', cls: 'text-green-600' },
      transfer_in:    { label: '이전 수신',   cls: 'text-green-600' },
      transfer_out:   { label: '이전 송신',   cls: 'text-red-500'  },
    };

    const rowsHtml = transactions.length === 0
      ? `<p class="text-center text-gray-400 text-sm py-8">포인트 거래 내역이 없습니다.</p>`
      : transactions.map(t => {
          const { label, cls } = txType[t.type] || { label: t.type, cls: 'text-gray-600' };
          const sign = t.amount > 0 ? '+' : '';
          return `
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">${escHtml(t.description || label)}</p>
                <p class="text-xs text-gray-400">${label} · ${formatDateTime(t.created_at)}${t.actor_name ? ' · ' + escHtml(t.actor_name) : ''}</p>
              </div>
              <div class="text-right flex-shrink-0 ml-4">
                <p class="text-sm font-bold ${cls}">${sign}${t.amount.toLocaleString()} P</p>
                <p class="text-xs text-gray-400">잔액 ${t.balance_after.toLocaleString()} P</p>
              </div>
            </div>
          `;
        }).join('');

    const pgHtml = _grpPagination(pagination, (p) => `_loadGroupPoints(${groupId},${p})`);

    el.innerHTML = `
      <div class="space-y-4 max-w-xl">
        <!-- 잔액 + 지급/차감 폼 -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-semibold text-gray-700">그룹 포인트 잔액</p>
            <p class="text-2xl font-bold text-blue-600">${balance.toLocaleString()} P</p>
          </div>
          <div class="space-y-2">
            <div class="flex gap-2">
              <input id="grp-pt-amount-${groupId}" type="number" placeholder="양수: 지급 / 음수: 차감"
                class="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none bg-white">
              <input id="grp-pt-desc-${groupId}" type="text" placeholder="사유 (필수)"
                class="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none bg-white">
            </div>
            <button onclick="submitGroupPoints(${groupId})"
              class="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium transition">
              포인트 처리
            </button>
          </div>
        </div>

        <!-- 내역 -->
        <div>
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">거래 내역</h4>
          <div class="bg-white rounded-2xl border px-4">
            ${rowsHtml}
          </div>
          ${pgHtml}
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = errorBox('포인트 내역을 불러오지 못했습니다.');
  }
}

// ── 포인트 지급/차감 제출 ─────────────────────────────────
async function submitGroupPoints(groupId) {
  const amountEl = document.getElementById(`grp-pt-amount-${groupId}`);
  const descEl   = document.getElementById(`grp-pt-desc-${groupId}`);
  const amount   = parseInt(amountEl?.value ?? '0', 10);
  const desc     = descEl?.value?.trim();

  if (!amount || isNaN(amount)) { showToast('금액을 입력하세요.', 'error'); return; }
  if (!desc)                    { showToast('사유를 입력하세요.', 'error'); return; }

  const action = amount > 0 ? '지급' : '차감';
  if (!confirm(`그룹 포인트 ${Math.abs(amount).toLocaleString()}P ${action}하시겠습니까?\n사유: ${desc}`)) return;

  try {
    const { data } = await axios.post(`/admin/groups/${groupId}/points`, { amount, description: desc });
    showToast(data.message || '처리되었습니다.', 'success');
    if (amountEl) amountEl.value = '';
    if (descEl)   descEl.value   = '';
    _loadGroupPoints(groupId, 1);
  } catch (err) {
    showToast(err.response?.data?.message || '처리에 실패했습니다.', 'error');
  }
}

// ── 페이지네이션 헬퍼 ─────────────────────────────────────
function _grpPagination(pg, callbackExpr) {
  if (!pg || pg.totalPages <= 1) return '';
  const { page, totalPages } = pg;

  const btnCls = (disabled) =>
    `px-3 py-1 text-sm rounded border ${disabled
      ? 'text-gray-300 border-gray-200 cursor-not-allowed'
      : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);

  // callbackExpr은 함수 (p) => string 형태로 넘어옴
  const expr = typeof callbackExpr === 'function' ? callbackExpr : (p) => callbackExpr.replace(/\$\{p\}/g, p).replace('${p}', p);

  if (start > 1) {
    pages.push(`<button onclick="${expr(1)}" class="${btnCls(false)}">1</button>`);
    if (start > 2) pages.push(`<span class="px-1 text-gray-400">…</span>`);
  }
  for (let p = start; p <= end; p++) {
    const active = p === page;
    pages.push(`<button onclick="${expr(p)}"
      class="${active ? 'px-3 py-1 text-sm rounded bg-blue-600 text-white' : btnCls(false)}">${p}</button>`);
  }
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span class="px-1 text-gray-400">…</span>`);
    pages.push(`<button onclick="${expr(totalPages)}" class="${btnCls(false)}">${totalPages}</button>`);
  }

  return `<div class="flex justify-center gap-1 mt-4">${pages.join('')}</div>`;
}
