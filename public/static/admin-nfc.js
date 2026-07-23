/**
 * admin-nfc.js — NFC 실물카드 관리 UI
 * admin.js의 navigateTo 'nfc-cards' 섹션에서 loadNfcCards() 호출
 *
 * 상태 흐름: pending → approved → issued(shipped) | deactivated
 *            rejected: pending 으로 복귀
 */

// ── 상태 전역 ─────────────────────────────────────────────
let _nfcStatus = 'all';
let _nfcPage   = 1;
let _nfcDate   = '';   // 신청일 일별 필터(YYYY-MM-DD, KST). 빈 값 = 전체 기간

// 일괄 배송 처리용 로컬 상태 (id → { carrier, tracking_no })
let _nfcBulkRows = [];

function loadNfcCardsPage(page) { loadNfcCards(page, _nfcStatus, _nfcDate); }

// ── 일별 요약 패널 (어느 날에 주문이 몰렸는지 · 클릭하면 해당 일 필터) ──
async function _toggleNfcDaily() {
  const panel = document.getElementById('nfc-daily-panel');
  if (!panel) return;
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="bg-white rounded-xl border shadow-sm p-3 text-sm text-gray-400">불러오는 중...</div>';
  try {
    const { data } = await axios.get('/admin/nfc-cards/daily?days=30');
    const days = data.data || [];
    if (days.length === 0) {
      panel.innerHTML = '<div class="bg-white rounded-xl border shadow-sm p-3 text-sm text-gray-400">최근 30일 신청 내역이 없습니다.</div>';
      return;
    }
    panel.innerHTML = `
      <div class="bg-white rounded-xl border shadow-sm p-3">
        <p class="text-xs font-semibold text-gray-500 uppercase mb-2">최근 30일 일별 신청 · 클릭하면 해당 일만 필터</p>
        <div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
          ${days.map(d => `
            <button onclick="loadNfcCards(1, _nfcStatus, '${d.day}')"
              class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 text-sm border ${_nfcDate === d.day ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}">
              <span class="font-medium text-gray-700">${d.day}</span>
              <span class="flex items-center gap-1.5 text-xs">
                <span class="text-gray-500">총 ${d.total}</span>
                ${d.pending ? `<span class="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">대기 ${d.pending}</span>` : ''}
                ${d.approved ? `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">승인 ${d.approved}</span>` : ''}
                ${d.issued ? `<span class="px-1.5 py-0.5 rounded bg-green-100 text-green-700">발급 ${d.issued}</span>` : ''}
              </span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    panel.innerHTML = '<div class="bg-white rounded-xl border shadow-sm p-3 text-sm text-red-500">일별 요약을 불러오지 못했습니다.</div>';
  }
}

// ── 배송 현황 요약 로드 ────────────────────────────────────
async function _loadNfcStats() {
  try {
    const { data } = await axios.get('/admin/nfc-cards/stats');
    const s = data.data || {};
    const total = (s.pending||0) + (s.approved||0) + (s.issued||0) + (s.deactivated||0);

    const card = (label, val, cls) =>
      `<div class="bg-white rounded-xl border p-3 text-center shadow-sm">
         <p class="text-2xl font-bold ${cls}">${val}</p>
         <p class="text-xs text-gray-500 mt-0.5">${label}</p>
       </div>`;

    const el = document.getElementById('nfc-stats-bar');
    if (el) {
      el.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          ${card('전체',    total,           'text-gray-800')}
          ${card('대기',    s.pending||0,    'text-yellow-600')}
          ${card('승인',    s.approved||0,   'text-blue-600')}
          ${card('발급',    s.issued||0,     'text-green-600')}
          ${card('비활성',  s.deactivated||0,'text-red-500')}
        </div>
      `;
    }
  } catch { /* 통계 오류는 무시 */ }
}

// ── 메인 목록 로드 ────────────────────────────────────────
async function loadNfcCards(page = 1, status = 'all', date = '') {
  _nfcStatus = status;
  _nfcPage   = page;
  _nfcDate   = date || '';
  setContent(loadingSpinner());

  try {
    const statusParam = status === 'all' ? '' : `&status=${status}`;
    const dateParam   = _nfcDate ? `&date=${_nfcDate}` : '';
    const { data } = await axios.get(`/admin/nfc-cards?limit=20&page=${page}${statusParam}${dateParam}`);
    const rows       = data.data        || [];
    const pagination = data.pagination;

    // 탭 정의
    const tabs = [
      { key: 'all',         label: '전체',   color: 'gray'   },
      { key: 'pending',     label: '대기',   color: 'yellow' },
      { key: 'approved',    label: '승인',   color: 'blue'   },
      { key: 'issued',      label: '발급',   color: 'green'  },
      { key: 'deactivated', label: '비활성', color: 'red'    },
    ];

    const tabsHtml = tabs.map(t => {
      const active = status === t.key;
      const base   = 'px-3 py-1.5 rounded-lg text-sm font-medium transition border';
      const cls    = active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
      return `<button onclick="loadNfcCards(1,'${t.key}')" class="${base} ${cls}">${t.label}</button>`;
    }).join('');

    // 행
    const rowsHtml = rows.length === 0
      ? `<tr><td colspan="7" class="px-4 py-12 text-center text-gray-400 text-sm">신청 내역이 없습니다.</td></tr>`
      : rows.map(r => `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="showNfcDetail(${r.id})">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-gray-900">${escHtml(r.user_name ?? '-')}</p>
            <p class="text-xs text-gray-400">${escHtml(r.user_email ?? '')}</p>
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">${escHtml(r.group_name ?? '-')}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${nfcDesignLabel(r.design_type)}</td>
          <td class="px-4 py-3">${nfcStatusBadge(r.status)}</td>
          <td class="px-4 py-3 text-sm text-gray-500">${r.amount ? r.amount.toLocaleString() + '원' : '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-400">${formatDate(r.applied_at)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap" onclick="event.stopPropagation()">
              ${nfcActionButtons(r)}
            </div>
          </td>
        </tr>
      `).join('');

    setContent(`
      <div class="space-y-3">

        <!-- 배송 현황 통계 카드 -->
        <div id="nfc-stats-bar"></div>

        <!-- 일괄 배송 처리 토글 버튼 -->
        <div class="flex items-center justify-between">
          <div class="flex gap-2 flex-wrap">${tabsHtml}</div>
          ${status === 'issued' ? `
          <button onclick="_toggleBulkShipping()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium transition">
            <i class="fas fa-truck"></i> 일괄 배송 처리
          </button>` : ''}
        </div>

        <!-- 일별 필터 (어드민 일별 주문 처리) -->
        <div class="flex items-center gap-2 flex-wrap text-sm bg-white rounded-xl border shadow-sm px-3 py-2">
          <span class="text-gray-500"><i class="fas fa-calendar-day mr-1"></i>신청일</span>
          <input type="date" id="nfc-date-filter" value="${_nfcDate}"
            onchange="loadNfcCards(1, _nfcStatus, this.value)"
            class="px-2 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300">
          ${_nfcDate
            ? `<button onclick="loadNfcCards(1, _nfcStatus, '')" class="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"><i class="fas fa-times mr-0.5"></i>전체 기간</button>
               <span class="text-blue-600 font-medium">${_nfcDate} 신청 ${pagination?.total ?? rows.length}건</span>`
            : `<span class="text-gray-400 text-xs">특정 날짜의 신청만 모아보기</span>`}
          <button onclick="_toggleNfcDaily()" class="ml-auto px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium">
            <i class="fas fa-list-ol mr-1"></i>일별 요약
          </button>
        </div>
        <div id="nfc-daily-panel" class="hidden"></div>

        <!-- 일괄 배송 처리 패널 (토글) -->
        <div id="bulk-shipping-panel" class="hidden"></div>

        <!-- 테이블 (데스크탑) -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청자</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">디자인</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">금액</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">${rowsHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- 카드 목록 (모바일) -->
        <div class="md:hidden space-y-2">
          ${rows.length === 0
            ? `<p class="text-center text-gray-400 text-sm py-10">신청 내역이 없습니다.</p>`
            : rows.map(r => `
              <div class="bg-white rounded-xl border shadow-sm p-4 cursor-pointer" onclick="showNfcDetail(${r.id})">
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <p class="font-medium text-sm text-gray-900">${escHtml(r.user_name ?? '-')}</p>
                    <p class="text-xs text-gray-400">${escHtml(r.user_email ?? '')}</p>
                  </div>
                  ${nfcStatusBadge(r.status)}
                </div>
                <div class="text-xs text-gray-500 space-y-0.5">
                  <p>디자인: ${nfcDesignLabel(r.design_type)} · 금액: ${r.amount ? r.amount.toLocaleString() + '원' : '-'}</p>
                  <p>신청일: ${formatDate(r.applied_at)}</p>
                </div>
                <div class="mt-3 flex gap-1 flex-wrap" onclick="event.stopPropagation()">
                  ${nfcActionButtons(r)}
                </div>
              </div>
            `).join('')}
        </div>

        ${renderPagination(pagination, 'loadNfcCardsPage')}
      </div>
    `);

    // 통계 카드 비동기 로드
    _loadNfcStats();

  } catch (err) {
    setContent(errorBox('NFC 카드 목록을 불러오지 못했습니다.'));
  }
}

// ── 상세 모달 ─────────────────────────────────────────────
async function showNfcDetail(id) {
  // 기존 모달 제거
  document.getElementById('nfc-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'nfc-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
        <h3 class="font-bold text-gray-900">NFC 카드 상세</h3>
        <button onclick="document.getElementById('nfc-modal').remove()"
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
    const { data } = await axios.get(`/admin/nfc-cards/${id}`);
    const r = data.data;
    const body = modal.querySelector('.p-5');

    body.innerHTML = `
      <!-- 신청자 정보 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">신청자 정보</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">이름</span><span class="font-medium">${escHtml(r.user_name ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">이메일</span><span>${escHtml(r.user_email ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">연락처</span><span>${escHtml(r.user_phone ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">그룹</span><span>${escHtml(r.group_name ?? '-')}</span></div>
        </div>
      </section>

      <!-- 주문 정보 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">주문 정보</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">상태</span><span>${nfcStatusBadge(r.status)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">디자인</span><span class="font-medium">${nfcDesignLabel(r.design_type)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">금액</span><span class="font-semibold">${r.amount ? r.amount.toLocaleString() + '원' : '-'}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">결제상태</span><span>${nfcPaymentBadge(r.payment_status)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">주문유형</span><span>${r.order_type === 'group' ? '그룹' : '개인'}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">신청일</span><span>${formatDateTime(r.applied_at)}</span></div>
          ${r.issued_at  ? `<div class="flex justify-between"><span class="text-gray-500">발급일</span><span>${formatDateTime(r.issued_at)}</span></div>` : ''}
          ${r.shipped_at ? `<div class="flex justify-between"><span class="text-gray-500">발송일</span><span>${formatDateTime(r.shipped_at)}</span></div>` : ''}
        </div>
      </section>

      <!-- 배송 정보 -->
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">배송 정보</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">수령인</span><span>${escHtml(r.shipping_name ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">연락처</span><span>${escHtml(r.shipping_phone ?? '-')}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">주소</span>
            <span class="text-right">${r.shipping_address ? `(${escHtml(r.shipping_zipcode ?? '')}) ${escHtml(r.shipping_address)} ${escHtml(r.shipping_detail ?? '')}` : '-'}</span>
          </div>
          ${r.shipping_memo ? `<div class="flex justify-between"><span class="text-gray-500">배송메모</span><span>${escHtml(r.shipping_memo)}</span></div>` : ''}
        </div>
      </section>

      <!-- 발급 정보 -->
      ${r.serial_no || r.nfc_uid ? `
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">발급 정보</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          ${r.serial_no ? `<div class="flex justify-between"><span class="text-gray-500">일련번호</span><span class="font-mono">${escHtml(r.serial_no)}</span></div>` : ''}
          ${r.nfc_uid   ? `<div class="flex justify-between"><span class="text-gray-500">NFC UID</span><span class="font-mono">${escHtml(r.nfc_uid)}</span></div>` : ''}
        </div>
      </section>` : ''}

      <!-- 운송장 정보 -->
      ${r.tracking_no ? `
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">운송장 정보</h4>
        <div class="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">택배사</span><span>${nfcCarrierLabel(r.carrier)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">운송장번호</span><span class="font-mono font-semibold">${escHtml(r.tracking_no)}</span></div>
        </div>
      </section>` : ''}

      <!-- 어드민 메모 -->
      ${r.admin_memo ? `
      <section class="mb-4">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">어드민 메모</h4>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">${escHtml(r.admin_memo)}</div>
      </section>` : ''}

      <!-- 액션 영역 -->
      <section id="nfc-action-area-${r.id}" class="space-y-2">
        ${nfcDetailActions(r)}
      </section>
    `;
  } catch (err) {
    modal.querySelector('.p-5').innerHTML = errorBox('상세 정보를 불러오지 못했습니다.');
  }
}

// ── 상세 모달 액션 패널 ──────────────────────────────────
function nfcDetailActions(r) {
  if (r.status === 'pending') {
    return `
      <div class="border rounded-xl p-3 space-y-2 bg-blue-50 border-blue-200">
        <p class="text-xs font-semibold text-blue-700 uppercase">승인 처리</p>
        <textarea id="nfc-memo-${r.id}" rows="2" placeholder="어드민 메모 (선택)"
          class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none resize-none"></textarea>
        <div class="flex gap-2">
          <button onclick="nfcAction(${r.id},'approve')"
            class="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            <i class="fas fa-check mr-1"></i>승인
          </button>
          <button onclick="nfcAction(${r.id},'reject')"
            class="flex-1 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 font-medium">
            <i class="fas fa-times mr-1"></i>반려
          </button>
        </div>
      </div>
    `;
  }

  if (r.status === 'approved') {
    return `
      <div class="border rounded-xl p-3 space-y-2 bg-green-50 border-green-200">
        <p class="text-xs font-semibold text-green-700 uppercase">발급·발송 처리</p>
        <div class="grid grid-cols-2 gap-2">
          <input id="nfc-serial-${r.id}"  type="text" placeholder="일련번호 (선택)"
            class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-300 outline-none">
          <input id="nfc-uid-${r.id}"     type="text" placeholder="NFC UID (선택)"
            class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-300 outline-none">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <select id="nfc-carrier-${r.id}" class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-300 outline-none">
            <option value="">택배사 선택</option>
            <option value="cjlogistics">CJ대한통운</option>
            <option value="hanjin">한진택배</option>
            <option value="lotte">롯데택배</option>
            <option value="epost">우체국</option>
            <option value="etc">기타</option>
          </select>
          <input id="nfc-tracking-${r.id}" type="text" placeholder="운송장번호"
            class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-300 outline-none">
        </div>
        <textarea id="nfc-memo-${r.id}" rows="2" placeholder="어드민 메모 (선택)"
          class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-300 outline-none resize-none"></textarea>
        <button onclick="nfcAction(${r.id},'issue')"
          class="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
          <i class="fas fa-shipping-fast mr-1"></i>발급·발송 처리
        </button>
      </div>
    `;
  }

  if (r.status === 'issued') {
    return `
      <div class="space-y-2">
        <!-- 운송장 업데이트 -->
        ${!r.tracking_no ? `
        <div class="border rounded-xl p-3 space-y-2 bg-gray-50">
          <p class="text-xs font-semibold text-gray-600 uppercase">운송장 등록</p>
          <div class="grid grid-cols-2 gap-2">
            <select id="nfc-carrier-${r.id}" class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none">
              <option value="">택배사 선택</option>
              <option value="cjlogistics">CJ대한통운</option>
              <option value="hanjin">한진택배</option>
              <option value="lotte">롯데택배</option>
              <option value="epost">우체국</option>
              <option value="etc">기타</option>
            </select>
            <input id="nfc-tracking-${r.id}" type="text" placeholder="운송장번호"
              class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none">
          </div>
          <textarea id="nfc-memo-${r.id}" rows="1" placeholder="메모 (선택)"
            class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-300 outline-none resize-none"></textarea>
          <button onclick="nfcUpdateTracking(${r.id})"
            class="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            운송장 등록
          </button>
        </div>` : ''}
        <!-- 비활성화 -->
        <button onclick="nfcAction(${r.id},'deactivate')"
          class="w-full py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 font-medium">
          <i class="fas fa-ban mr-1"></i>비활성화 (분실/파손)
        </button>
      </div>
    `;
  }

  if (r.status === 'deactivated') {
    return `
      <button onclick="nfcAction(${r.id},'reactivate')"
        class="w-full py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium">
        <i class="fas fa-redo mr-1"></i>재활성화
      </button>
    `;
  }

  return '';
}

// ── 상태 변경 실행 ────────────────────────────────────────
async function nfcAction(id, action) {
  const payload = { action };

  const memoEl    = document.getElementById(`nfc-memo-${id}`);
  const serialEl  = document.getElementById(`nfc-serial-${id}`);
  const uidEl     = document.getElementById(`nfc-uid-${id}`);
  const carrierEl = document.getElementById(`nfc-carrier-${id}`);
  const trackEl   = document.getElementById(`nfc-tracking-${id}`);

  if (memoEl?.value)    payload.admin_memo  = memoEl.value.trim();
  if (serialEl?.value)  payload.serial_no   = serialEl.value.trim();
  if (uidEl?.value)     payload.nfc_uid     = uidEl.value.trim();
  if (carrierEl?.value) payload.carrier     = carrierEl.value;
  if (trackEl?.value)   payload.tracking_no = trackEl.value.trim();

  const labels = {
    approve:    '승인', reject: '반려', issue: '발급 처리',
    deactivate: '비활성화', reactivate: '재활성화',
  };
  if (!confirm(`${labels[action] || action} 처리하시겠습니까?`)) return;

  try {
    const { data } = await axios.patch(`/admin/nfc-cards/${id}`, payload);
    showToast(data.message || '처리되었습니다.', 'success');
    document.getElementById('nfc-modal')?.remove();
    loadNfcCards(_nfcPage, _nfcStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '오류가 발생했습니다.';
    showToast(msg, 'error');
  }
}

// ── 운송장 단독 업데이트 ──────────────────────────────────
async function nfcUpdateTracking(id) {
  const carrier    = document.getElementById(`nfc-carrier-${id}`)?.value;
  const trackingNo = document.getElementById(`nfc-tracking-${id}`)?.value?.trim();
  const memo       = document.getElementById(`nfc-memo-${id}`)?.value?.trim();

  if (!carrier || !trackingNo) {
    showToast('택배사와 운송장 번호를 모두 입력하세요.', 'error');
    return;
  }

  try {
    const { data } = await axios.patch(`/admin/nfc-cards/${id}/tracking`, {
      tracking_no: trackingNo, carrier, admin_memo: memo || undefined,
    });
    showToast(data.message || '운송장이 등록되었습니다.', 'success');
    document.getElementById('nfc-modal')?.remove();
    loadNfcCards(_nfcPage, _nfcStatus);
  } catch (err) {
    showToast('운송장 등록에 실패했습니다.', 'error');
  }
}

// ── 목록 액션 버튼 ────────────────────────────────────────
function nfcActionButtons(r) {
  const btn = (action, label, cls) =>
    `<button onclick="nfcQuickAction(${r.id},'${action}')"
      class="text-xs px-2 py-1 rounded font-medium ${cls}">${label}</button>`;

  if (r.status === 'pending') {
    return btn('approve', '승인', 'bg-blue-100 text-blue-700 hover:bg-blue-200') +
           btn('reject',  '반려', 'bg-red-100 text-red-600 hover:bg-red-200');
  }
  if (r.status === 'approved') {
    return `<button onclick="showNfcDetail(${r.id})"
      class="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700 hover:bg-green-200">발급처리</button>`;
  }
  if (r.status === 'issued') {
    return btn('deactivate', '비활성', 'bg-gray-100 text-gray-600 hover:bg-gray-200');
  }
  if (r.status === 'deactivated') {
    return btn('reactivate', '재활성', 'bg-gray-100 text-gray-500 hover:bg-gray-200');
  }
  return '';
}

// ── 목록에서 빠른 승인/반려 ──────────────────────────────
async function nfcQuickAction(id, action) {
  const labels = { approve: '승인', reject: '반려', deactivate: '비활성화', reactivate: '재활성화' };
  if (!confirm(`${labels[action] || action} 처리하시겠습니까?`)) return;
  try {
    const { data } = await axios.patch(`/admin/nfc-cards/${id}`, { action });
    showToast(data.message || '처리되었습니다.', 'success');
    loadNfcCards(_nfcPage, _nfcStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '오류가 발생했습니다.';
    showToast(msg, 'error');
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────
function nfcStatusBadge(status) {
  const map = {
    pending:     ['bg-yellow-100 text-yellow-700', '대기'],
    approved:    ['bg-blue-100 text-blue-700',     '승인'],
    issued:      ['bg-green-100 text-green-700',   '발급'],
    deactivated: ['bg-red-100 text-red-600',       '비활성'],
  };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-600', status];
  return `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${cls}">${label}</span>`;
}

function nfcPaymentBadge(status) {
  const map = {
    unpaid:   ['bg-orange-100 text-orange-700', '미결제'],
    paid:     ['bg-green-100 text-green-700',   '결제완료'],
    refunded: ['bg-gray-100 text-gray-600',     '환불'],
  };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-600', status ?? '-'];
  return `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${cls}">${label}</span>`;
}

function nfcDesignLabel(type) {
  const map = { basic: '기본형', premium: '프리미엄', custom: '커스텀' };
  return map[type] || type || '-';
}

function nfcCarrierLabel(carrier) {
  const map = {
    cjlogistics: 'CJ대한통운', hanjin: '한진택배',
    lotte: '롯데택배', epost: '우체국', etc: '기타',
  };
  return map[carrier] || carrier || '-';
}

// ── 일괄 배송 처리 패널 토글 ──────────────────────────────
async function _toggleBulkShipping() {
  const panel = document.getElementById('bulk-shipping-panel');
  if (!panel) return;

  // 패널이 열려있으면 닫기
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');
  panel.innerHTML = `<div class="flex justify-center py-4">${loadingSpinner()}</div>`;

  try {
    // 발급(issued) 상태 중 운송장 미등록 건 조회 (최대 100건)
    const { data } = await axios.get('/admin/nfc-cards?status=issued&limit=100&page=1');
    const cards = (data.data || []).filter(r => !r.tracking_no);

    if (cards.length === 0) {
      panel.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-700">
          <i class="fas fa-check-circle mr-1"></i>
          운송장 미등록 건이 없습니다. 모든 발급 건에 운송장이 등록되어 있습니다.
        </div>`;
      return;
    }

    // 전역 상태에 저장
    _nfcBulkRows = cards.map(r => ({ id: r.id, carrier: '', tracking_no: '' }));

    const carrierOpts = `
      <option value="">택배사 선택</option>
      <option value="cjlogistics">CJ대한통운</option>
      <option value="hanjin">한진택배</option>
      <option value="lotte">롯데택배</option>
      <option value="epost">우체국</option>
      <option value="etc">기타</option>
    `;

    // 전체 일괄 적용 섹션
    const bulkApplySection = `
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
        <p class="text-xs font-semibold text-blue-700 uppercase mb-2">
          <i class="fas fa-magic mr-1"></i>전체 일괄 적용
        </p>
        <div class="flex gap-2 flex-wrap">
          <select id="bulk-all-carrier" class="px-3 py-2 text-sm border rounded-lg outline-none bg-white">
            ${carrierOpts}
          </select>
          <button onclick="_applyBulkCarrierToAll()"
            class="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            택배사 일괄 적용
          </button>
        </div>
      </div>
    `;

    const rowsHtml = cards.map((r, idx) => `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2">
          <p class="text-sm font-medium text-gray-900">${escHtml(r.user_name ?? '-')}</p>
          <p class="text-xs text-gray-400">${escHtml(r.group_name ?? '')}</p>
        </td>
        <td class="px-3 py-2 text-xs text-gray-500">${nfcDesignLabel(r.design_type)}</td>
        <td class="px-3 py-2 text-xs text-gray-400">${formatDate(r.applied_at)}</td>
        <td class="px-3 py-2">
          <select id="bulk-carrier-${r.id}" onchange="_nfcBulkRows[${idx}].carrier=this.value"
            class="w-full px-2 py-1.5 text-xs border rounded-lg outline-none">
            ${carrierOpts}
          </select>
        </td>
        <td class="px-3 py-2">
          <input id="bulk-tracking-${r.id}" type="text" placeholder="운송장번호"
            oninput="_nfcBulkRows[${idx}].tracking_no=this.value"
            class="w-full px-2 py-1.5 text-xs border rounded-lg outline-none">
        </td>
      </tr>
    `).join('');

    panel.innerHTML = `
      <div class="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div>
            <p class="text-sm font-semibold text-gray-800">
              <i class="fas fa-truck mr-1.5 text-green-600"></i>일괄 배송 처리
            </p>
            <p class="text-xs text-gray-500 mt-0.5">운송장 미등록 ${cards.length}건 · 입력 후 [일괄 등록] 클릭</p>
          </div>
          <button onclick="_toggleBulkShipping()"
            class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-4 space-y-3">
          ${bulkApplySection}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">신청자</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">디자인</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">신청일</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-36">택배사</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-40">운송장번호</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">${rowsHtml}</tbody>
            </table>
          </div>
          <div class="flex justify-end gap-2">
            <button onclick="_toggleBulkShipping()"
              class="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">취소</button>
            <button onclick="_submitBulkShipping()"
              class="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition">
              <i class="fas fa-paper-plane mr-1"></i>일괄 등록
            </button>
          </div>
        </div>
      </div>
    `;
  } catch {
    panel.innerHTML = errorBox('발급 목록을 불러오지 못했습니다.');
  }
}

// ── 택배사 전체 일괄 적용 ─────────────────────────────────
function _applyBulkCarrierToAll() {
  const carrier = document.getElementById('bulk-all-carrier')?.value;
  if (!carrier) { showToast('택배사를 먼저 선택하세요.', 'error'); return; }
  _nfcBulkRows.forEach((row, idx) => {
    row.carrier = carrier;
    const sel = document.getElementById(`bulk-carrier-${row.id}`);
    if (sel) sel.value = carrier;
  });
  showToast('택배사가 일괄 적용되었습니다.', 'success');
}

// ── 일괄 배송 등록 제출 ───────────────────────────────────
async function _submitBulkShipping() {
  // DOM에서 최신값 수집
  const items = _nfcBulkRows.map(row => ({
    id:          row.id,
    carrier:     document.getElementById(`bulk-carrier-${row.id}`)?.value || '',
    tracking_no: (document.getElementById(`bulk-tracking-${row.id}`)?.value || '').trim(),
  })).filter(item => item.carrier && item.tracking_no);

  if (items.length === 0) {
    showToast('등록할 운송장 정보가 없습니다. 택배사와 운송장번호를 입력하세요.', 'error');
    return;
  }

  if (!confirm(`${items.length}건의 운송장을 일괄 등록하시겠습니까?`)) return;

  try {
    const { data } = await axios.post('/admin/nfc-cards/bulk-tracking', { items });
    showToast(data.message || `${items.length}건 운송장 등록 완료`, 'success');
    // 패널 닫고 목록 새로고침
    const panel = document.getElementById('bulk-shipping-panel');
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    loadNfcCards(_nfcPage, _nfcStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '일괄 등록에 실패했습니다.';
    showToast(msg, 'error');
  }
}
