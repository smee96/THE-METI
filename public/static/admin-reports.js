/**
 * admin-reports.js — 신고 관리 UI
 * admin.js의 navigateTo 'reports' 섹션에서 loadReports() 호출
 *
 * 상태 흐름: pending → reviewed → resolved | dismissed
 * 신고 대상: user | card | group | message
 */

// ── 상태 전역 ─────────────────────────────────────────────
let _reportsStatus     = 'pending';
let _reportsPage       = 1;
let _reportsTargetType = '';

function loadReportsPage(page) { loadReports(page, _reportsStatus); }

// ── 메인 목록 로드 ────────────────────────────────────────
async function loadReports(page = 1, status = 'pending') {
  _reportsStatus = status;
  _reportsPage   = page;
  setContent(loadingSpinner());

  try {
    const params = new URLSearchParams({ page, limit: 20, status });
    if (_reportsTargetType) params.set('target_type', _reportsTargetType);

    const { data } = await axios.get(`/admin/reports?${params}`);
    const rows       = data.data        || [];
    const pagination = data.pagination;

    // 상태 탭
    const statusTabs = [
      { key: 'pending',   label: '대기',     color: 'yellow' },
      { key: 'reviewed',  label: '검토중',   color: 'blue'   },
      { key: 'resolved',  label: '처리완료', color: 'green'  },
      { key: 'dismissed', label: '기각',     color: 'gray'   },
      { key: 'all',       label: '전체',     color: 'gray'   },
    ];

    const tabsHtml = statusTabs.map(t => {
      const active = status === t.key;
      const cls = active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
      return `<button onclick="loadReports(1,'${t.key}')"
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition border ${cls}">${t.label}</button>`;
    }).join('');

    // 대상 유형 필터
    const typeFilters = [
      { key: '', label: '전체 대상' }, { key: 'user', label: '유저' },
      { key: 'card', label: '명함' }, { key: 'group', label: '그룹' },
      { key: 'message', label: '메시지' },
    ];

    const typeHtml = typeFilters.map(t => {
      const active = _reportsTargetType === t.key;
      const cls = active
        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50';
      return `<button onclick="_reportsTargetType='${t.key}';loadReports(1,'${status}')"
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition border ${cls}">${t.label}</button>`;
    }).join('');

    // 행
    const rowsHtml = rows.length === 0
      ? `<tr><td colspan="6" class="px-4 py-12 text-center text-gray-400 text-sm">신고 내역이 없습니다.</td></tr>`
      : rows.map(r => `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="showReportDetail(${r.id})">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-gray-900">${escHtml(r.reporter_name)}</p>
            <p class="text-xs text-gray-400">${escHtml(r.reporter_email)}</p>
          </td>
          <td class="px-4 py-3">
            ${reportTargetBadge(r.target_type)}
            <span class="text-xs text-gray-400 ml-1">#${r.target_id}</span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">${escHtml(r.reason)}</td>
          <td class="px-4 py-3">${reportStatusBadge(r.status)}</td>
          <td class="px-4 py-3 text-sm text-gray-400">${formatDate(r.created_at)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap" onclick="event.stopPropagation()">
              ${reportQuickActions(r)}
            </div>
          </td>
        </tr>
      `).join('');

    // 모바일 카드
    const mobileHtml = rows.length === 0
      ? `<p class="text-center text-gray-400 text-sm py-10">신고 내역이 없습니다.</p>`
      : rows.map(r => `
        <div class="bg-white rounded-xl border shadow-sm p-4 cursor-pointer" onclick="showReportDetail(${r.id})">
          <div class="flex items-start justify-between mb-2">
            <div>
              <p class="font-medium text-sm text-gray-900">${escHtml(r.reporter_name)}</p>
              <p class="text-xs text-gray-400">${escHtml(r.reporter_email)}</p>
            </div>
            ${reportStatusBadge(r.status)}
          </div>
          <div class="flex items-center gap-2 mb-2">
            ${reportTargetBadge(r.target_type)}
            <span class="text-xs text-gray-400">#${r.target_id}</span>
          </div>
          <p class="text-sm text-gray-700 line-clamp-2 mb-2">${escHtml(r.reason)}</p>
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-400">${formatDate(r.created_at)}</span>
            <div class="flex gap-1" onclick="event.stopPropagation()">
              ${reportQuickActions(r)}
            </div>
          </div>
        </div>
      `).join('');

    setContent(`
      <div class="space-y-3">

        <!-- 상태 탭 -->
        <div class="flex gap-2 flex-wrap">${tabsHtml}</div>

        <!-- 대상 유형 필터 -->
        <div class="flex gap-1.5 flex-wrap items-center">
          <span class="text-xs text-gray-400 mr-1">대상:</span>
          ${typeHtml}
        </div>

        <!-- 테이블 (데스크탑) -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신고자</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">대상</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신고 사유</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신고일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">${rowsHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- 카드 목록 (모바일) -->
        <div class="md:hidden space-y-2">${mobileHtml}</div>

        ${renderPagination(pagination, 'loadReportsPage')}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('신고 목록을 불러오지 못했습니다.'));
  }
}

// ── 상세 모달 ─────────────────────────────────────────────
async function showReportDetail(id) {
  document.getElementById('report-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'report-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
        <h3 class="font-bold text-gray-900">신고 상세</h3>
        <button onclick="document.getElementById('report-modal').remove()"
          class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div class="p-5">
        <div class="flex items-center justify-center py-6">
          <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const { data } = await axios.get(`/admin/reports/${id}`);
    const r = data.data;
    const body = modal.querySelector('.p-5');

    body.innerHTML = `
      <!-- 헤더 상태 -->
      <div class="flex items-center gap-2 mb-4">
        ${reportStatusBadge(r.status)}
        ${reportTargetBadge(r.target_type)}
        <span class="text-sm text-gray-400">#${r.id}</span>
      </div>

      <!-- 신고자 정보 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">신고자</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">이름</span><span class="font-medium">${escHtml(r.reporter_name)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">이메일</span><span>${escHtml(r.reporter_email)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">신고일</span><span>${formatDateTime(r.created_at)}</span></div>
        </div>
      </section>

      <!-- 신고 내용 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">신고 내용</h4>
        <div class="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <div>
            <p class="text-xs text-red-500 font-medium mb-0.5">신고 사유</p>
            <p class="text-sm text-gray-800 font-medium">${escHtml(r.reason)}</p>
          </div>
          ${r.description ? `
          <div>
            <p class="text-xs text-red-500 font-medium mb-0.5">상세 설명</p>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">${escHtml(r.description)}</p>
          </div>` : ''}
        </div>
      </section>

      <!-- 신고 대상 정보 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          신고 대상 ${reportTargetBadge(r.target_type)} #${r.target_id}
        </h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm">
          ${reportTargetInfo(r.target_type, r.target_info)}
        </div>
      </section>

      <!-- 처리 이력 -->
      ${r.reviewed_at ? `
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">처리 이력</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">처리자</span><span class="font-medium">${escHtml(r.reviewer_name ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">처리일</span><span>${formatDateTime(r.reviewed_at)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">결과</span>${reportStatusBadge(r.status)}</div>
        </div>
      </section>` : ''}

      <!-- 액션 -->
      <section id="report-action-area-${r.id}">
        ${reportDetailActions(r)}
      </section>
    `;
  } catch (err) {
    modal.querySelector('.p-5').innerHTML = errorBox('상세 정보를 불러오지 못했습니다.');
  }
}

// ── 상세 액션 패널 ────────────────────────────────────────
function reportDetailActions(r) {
  if (r.status === 'pending') {
    return `
      <div class="border rounded-xl p-3 space-y-2 bg-blue-50 border-blue-200">
        <p class="text-xs font-semibold text-blue-700 uppercase">신고 처리</p>
        <div class="flex gap-2">
          <button onclick="resolveReport(${r.id},'reviewed',true)"
            class="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            <i class="fas fa-eye mr-1"></i>검토중
          </button>
          <button onclick="resolveReport(${r.id},'resolved',true)"
            class="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
            <i class="fas fa-check mr-1"></i>처리완료
          </button>
          <button onclick="resolveReport(${r.id},'dismissed',true)"
            class="flex-1 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium">
            <i class="fas fa-times mr-1"></i>기각
          </button>
        </div>
      </div>
    `;
  }

  if (r.status === 'reviewed') {
    return `
      <div class="border rounded-xl p-3 space-y-2 bg-yellow-50 border-yellow-200">
        <p class="text-xs font-semibold text-yellow-700 uppercase">최종 처리</p>
        <div class="flex gap-2">
          <button onclick="resolveReport(${r.id},'resolved',true)"
            class="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
            <i class="fas fa-check mr-1"></i>처리완료
          </button>
          <button onclick="resolveReport(${r.id},'dismissed',true)"
            class="flex-1 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium">
            <i class="fas fa-times mr-1"></i>기각
          </button>
        </div>
      </div>
    `;
  }

  return `<p class="text-center text-sm text-gray-400 py-2">처리 완료된 신고입니다.</p>`;
}

// ── 상태 변경 실행 ────────────────────────────────────────
async function resolveReport(id, status, fromModal = false) {
  const labels = { reviewed: '검토 중', resolved: '처리완료', dismissed: '기각' };
  if (!confirm(`"${labels[status]}"으로 처리하시겠습니까?`)) return;

  try {
    const { data } = await axios.patch(`/admin/reports/${id}`, { status });
    showToast(data.message || '처리되었습니다.', 'success');
    if (fromModal) document.getElementById('report-modal')?.remove();
    loadReports(_reportsPage, _reportsStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '오류가 발생했습니다.';
    showToast(msg, 'error');
  }
}

// ── 목록 빠른 액션 ────────────────────────────────────────
function reportQuickActions(r) {
  if (r.status === 'pending') {
    return `
      <button onclick="resolveReport(${r.id},'reviewed')"
        class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium">검토</button>
      <button onclick="resolveReport(${r.id},'resolved')"
        class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium">완료</button>
      <button onclick="resolveReport(${r.id},'dismissed')"
        class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">기각</button>
    `;
  }
  if (r.status === 'reviewed') {
    return `
      <button onclick="resolveReport(${r.id},'resolved')"
        class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium">완료</button>
      <button onclick="resolveReport(${r.id},'dismissed')"
        class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">기각</button>
    `;
  }
  return `<span class="text-xs text-gray-400">-</span>`;
}

// ── 대상 정보 렌더링 ──────────────────────────────────────
function reportTargetInfo(type, info) {
  if (!info) {
    return `<p class="text-gray-400 text-sm">대상 정보를 불러올 수 없습니다. (삭제되었거나 접근 불가)</p>`;
  }

  if (type === 'user') {
    return `
      <div class="space-y-1">
        <div class="flex justify-between"><span class="text-gray-500">이름</span><span class="font-medium">${escHtml(info.name)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">이메일</span><span>${escHtml(info.email)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">계정상태</span>
          <span class="${info.status === 'active' ? 'text-green-600' : 'text-red-500'}">${info.status === 'active' ? '활성' : '정지'}</span>
        </div>
      </div>
    `;
  }

  if (type === 'card') {
    return `
      <div class="space-y-1">
        <div class="flex justify-between"><span class="text-gray-500">명함명</span><span class="font-medium">${escHtml(info.title)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">소유자</span><span>${escHtml(info.owner_name)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">이메일</span><span>${escHtml(info.owner_email)}</span></div>
      </div>
    `;
  }

  if (type === 'group') {
    return `
      <div class="space-y-1">
        <div class="flex justify-between"><span class="text-gray-500">그룹명</span><span class="font-medium">${escHtml(info.name)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">상태</span><span>${escHtml(info.status)}</span></div>
      </div>
    `;
  }

  if (type === 'message') {
    return `
      <div class="space-y-1">
        <div class="flex justify-between"><span class="text-gray-500">발신자</span><span class="font-medium">${escHtml(info.sender_name)}</span></div>
        <div>
          <p class="text-gray-500 mb-0.5">메시지 내용</p>
          <p class="text-gray-800 bg-white border rounded p-2 text-sm">${escHtml(info.content)}</p>
        </div>
      </div>
    `;
  }

  return `<p class="text-gray-400">알 수 없는 대상 유형</p>`;
}

// ── 헬퍼 ──────────────────────────────────────────────────
function reportStatusBadge(status) {
  const map = {
    pending:   ['bg-yellow-100 text-yellow-700', '대기'],
    reviewed:  ['bg-blue-100 text-blue-700',     '검토중'],
    resolved:  ['bg-green-100 text-green-700',   '처리완료'],
    dismissed: ['bg-gray-100 text-gray-500',     '기각'],
  };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-500', status];
  return `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${cls}">${label}</span>`;
}

function reportTargetBadge(type) {
  const map = {
    user:    ['bg-purple-100 text-purple-700', '유저'],
    card:    ['bg-blue-100 text-blue-700',     '명함'],
    group:   ['bg-indigo-100 text-indigo-700', '그룹'],
    message: ['bg-orange-100 text-orange-700', '메시지'],
  };
  const [cls, label] = map[type] || ['bg-gray-100 text-gray-600', type];
  return `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${cls}">${label}</span>`;
}
