// ── admin-users.js ──────────────────────────────────────────
// 유저 관리 / 그룹 목록 / 명함 관리 / 유저 상세 모달
// 공유 유틸: setContent, loadingSpinner, errorBox, renderPagination,
//            showToast, escHtml, formatDate, formatDateTime,
//            planBadge, accountTypeBadge, categoryBadge
//            toggleUserActive, changeUserPlan, approveGroup (admin.js 코어)
// ──────────────────────────────────────────────────────────────

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
                    <div class="flex gap-1 flex-wrap">
                      <button onclick="loadGroupDetailPage(${g.id})"
                        class="text-sm px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">상세</button>
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
                <div class="flex gap-1 flex-wrap">
                  <button onclick="loadGroupDetailPage(${g.id})"
                    class="text-sm px-2 py-1 bg-indigo-100 text-indigo-700 rounded">상세</button>
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
                      <p class="text-sm text-gray-400">${card.company || ''}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="text-sm text-gray-900">${card.user_name}</p>
                      <p class="text-sm text-gray-400">${card.user_email}</p>
                    </td>
                    <td class="px-4 py-3">
                      ${card.is_primary
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
                      ${card.is_primary ? '<span class="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">기본</span>' : ''}
                    </p>
                    <p class="text-sm text-gray-400">${card.company || ''}</p>
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
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.classList.remove('border-blue-600', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.detail-pane').forEach(pane => pane.classList.add('hidden'));
  const activeTab = document.getElementById(`tab-${tab}`);
  if (activeTab) {
    activeTab.classList.add('border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }
  const activePane = document.getElementById(`detail-${tab}`);
  if (activePane) activePane.classList.remove('hidden');
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
    amountEl.value = '';
    descEl.value   = '';
    const newBal = data.data?.new_balance;
    if (newBal !== undefined) {
      const balEls = document.querySelectorAll('#user-detail-modal .point-balance-display');
      balEls.forEach(el => { el.textContent = newBal.toLocaleString() + ' P'; });
    }
    loadPointHistory(userId, 1);
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || '포인트 처리에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

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
