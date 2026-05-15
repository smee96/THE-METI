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

function loadNfcCardsPage(page) { loadNfcCards(page, _nfcStatus); }

// ── 메인 목록 로드 ────────────────────────────────────────
async function loadNfcCards(page = 1, status = 'all') {
  _nfcStatus = status;
  _nfcPage   = page;
  setContent(loadingSpinner());

  try {
    const statusParam = status === 'all' ? '' : `&status=${status}`;
    const { data } = await axios.get(`/admin/nfc-cards?limit=20&page=${page}${statusParam}`);
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

        <!-- 탭 필터 -->
        <div class="flex gap-2 flex-wrap">${tabsHtml}</div>

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
