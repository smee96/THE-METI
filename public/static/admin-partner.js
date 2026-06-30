// ════════════════════════════════════════════════════════════
// admin-partner.js — 파트너 관리
// ════════════════════════════════════════════════════════════

async function loadPartners() {
  setContent(loadingSpinner());
  try {
    const { data } = await axios.get('/admin/partners');
    const partners = data.data || [];

    setContent(`
      <div class="space-y-4">
        <!-- 헤더 -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">등록된 파트너 서비스 ${partners.length}개</p>
            <p class="text-xs text-gray-400 mt-0.5">해피트리, 미니게임 등 WebView 방식으로 엘리드 앱 내에서 동작합니다.</p>
          </div>
          <button onclick="showCreatePartnerModal()"
            class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition flex items-center gap-2">
            <i class="fas fa-plus"></i> 파트너 등록
          </button>
        </div>

        <!-- 파트너 목록 -->
        ${partners.length === 0
          ? `<div class="bg-white rounded-xl p-12 text-center shadow-sm border">
               <i class="fas fa-handshake text-gray-300 text-4xl mb-3"></i>
               <p class="text-gray-400">등록된 파트너가 없습니다.</p>
               <button onclick="showCreatePartnerModal()"
                 class="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition">
                 첫 번째 파트너 등록하기
               </button>
             </div>`
          : `<div class="grid gap-4">
               ${partners.map(p => `
                 <div class="bg-white rounded-xl shadow-sm border p-5">
                   <div class="flex items-start justify-between mb-3">
                     <div class="flex items-center gap-3">
                       <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                         <i class="fas fa-puzzle-piece text-indigo-600"></i>
                       </div>
                       <div>
                         <div class="flex items-center gap-2">
                           <h3 class="font-bold text-gray-900">${p.name}</h3>
                           ${partnerStatusBadge(p.status)}
                         </div>
                         <p class="text-sm text-gray-400">${p.description || '설명 없음'}</p>
                       </div>
                     </div>
                     <div class="flex gap-2">
                       <button onclick="showPartnerDetail(${p.id})"
                         class="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition">
                         상세/관리
                       </button>
                     </div>
                   </div>

                   <!-- WebView URL -->
                   ${p.webview_url ? `
                     <div class="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg mb-3">
                       <i class="fas fa-mobile-alt text-blue-400 text-xs"></i>
                       <span class="text-xs text-blue-700 font-medium">WebView URL:</span>
                       <span class="text-xs text-blue-600 truncate flex-1">${p.webview_url}</span>
                     </div>
                   ` : `
                     <div class="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg mb-3">
                       <i class="fas fa-exclamation-triangle text-yellow-400 text-xs"></i>
                       <span class="text-xs text-yellow-700">WebView URL이 등록되지 않았습니다.</span>
                     </div>
                   `}

                   <!-- 통계 -->
                   <div class="grid grid-cols-3 gap-3 text-center">
                     <div class="p-2 bg-gray-50 rounded-lg">
                       <p class="text-base font-bold text-gray-900">${p.mapped_users || 0}</p>
                       <p class="text-xs text-gray-500">연동 유저</p>
                     </div>
                     <div class="p-2 bg-gray-50 rounded-lg">
                       <p class="text-base font-bold text-gray-900">${p.total_rewards || 0}</p>
                       <p class="text-xs text-gray-500">리워드 건수</p>
                     </div>
                     <div class="p-2 bg-gray-50 rounded-lg">
                       <p class="text-base font-bold text-gray-900">${(p.total_points || 0).toLocaleString()}</p>
                       <p class="text-xs text-gray-500">총 지급 포인트</p>
                     </div>
                   </div>
                 </div>
               `).join('')}
             </div>`
        }
      </div>
    `);
  } catch (err) {
    setContent(errorBox('파트너 목록을 불러오지 못했습니다.'));
  }
}

// ── 파트너 등록 모달 ─────────────────────────────────────────
function showCreatePartnerModal() {
  const modal = document.createElement('div');
  modal.id = 'create-partner-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">파트너 서비스 등록</h3>
        <button onclick="document.getElementById('create-partner-modal').remove()"
          class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="p-5 space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
          <i class="fas fa-info-circle mr-1"></i>
          파트너를 등록하면 API 키가 자동 발급됩니다. API 키는 등록 직후 한 번만 표시됩니다.
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">파트너명 <span class="text-red-500">*</span></label>
          <input id="partner-name" type="text" placeholder="예: 해피트리"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">설명</label>
          <input id="partner-desc" type="text" placeholder="서비스 설명 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">WebView URL</label>
          <input id="partner-webview" type="url" placeholder="https://partner-game.com/meti"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
          <p class="text-xs text-gray-400 mt-1">엘리드 앱에서 WebView로 열릴 파트너 서비스 URL</p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Webhook URL</label>
          <input id="partner-webhook" type="url" placeholder="https://partner-server.com/webhook (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>

        <div id="partner-create-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>

        <div class="flex gap-2 pt-2">
          <button onclick="document.getElementById('create-partner-modal').remove()"
            class="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
            취소
          </button>
          <button onclick="submitCreatePartner()"
            class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
            등록하기
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function submitCreatePartner() {
  const name    = document.getElementById('partner-name')?.value.trim();
  const desc    = document.getElementById('partner-desc')?.value.trim();
  const webview = document.getElementById('partner-webview')?.value.trim();
  const webhook = document.getElementById('partner-webhook')?.value.trim();
  const errEl   = document.getElementById('partner-create-error');

  if (!name) { errEl.textContent = '파트너명을 입력해주세요.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');

  try {
    const body = { name };
    if (desc)    body.description = desc;
    if (webview) body.webview_url = webview;
    if (webhook) body.webhook_url = webhook;

    const { data } = await axios.post('/admin/partners', body);
    const { id, api_key } = data.data;

    document.getElementById('create-partner-modal').remove();

    // API 키 표시 모달
    showApiKeyModal(name, api_key);
    loadPartners();
  } catch (err) {
    errEl.textContent = err.response?.data?.error || '등록에 실패했습니다.';
    errEl.classList.remove('hidden');
  }
}

function showApiKeyModal(partnerName, apiKey) {
  const modal = document.createElement('div');
  modal.id = 'apikey-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
      <div class="text-center mb-4">
        <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-key text-green-600 text-2xl"></i>
        </div>
        <h3 class="font-bold text-gray-900 text-lg">'${partnerName}' 등록 완료</h3>
        <p class="text-sm text-red-600 font-medium mt-1">⚠️ API 키는 지금 이 화면에서만 확인 가능합니다.</p>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 mb-4">
        <p class="text-xs text-gray-400 mb-1 font-mono">X-Partner-API-Key</p>
        <div class="flex items-center gap-2">
          <code id="api-key-val" class="text-green-400 font-mono text-xs break-all flex-1">${apiKey}</code>
          <button onclick="copyApiKey()" class="text-gray-400 hover:text-white transition flex-shrink-0">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      <p class="text-xs text-gray-500 text-center mb-4">
        이 키를 파트너 서버의 환경변수에 안전하게 저장하세요.<br>
        재발급은 파트너 상세 페이지에서 가능합니다.
      </p>
      <button onclick="document.getElementById('apikey-modal').remove()"
        class="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition">
        확인 (저장 완료)
      </button>
    </div>`;
  document.body.appendChild(modal);
}

function copyApiKey() {
  const key = document.getElementById('api-key-val')?.textContent;
  if (key) {
    navigator.clipboard.writeText(key).then(() => showToast('API 키가 복사되었습니다.', 'success'));
  }
}

// ── 파트너 상세 모달 ─────────────────────────────────────────
async function showPartnerDetail(partnerId) {
  const modal = document.createElement('div');
  modal.id = 'partner-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">파트너 상세</h3>
        <button onclick="document.getElementById('partner-detail-modal').remove()"
          class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
      </div>
      <div id="partner-detail-body" class="p-5">
        <div class="flex items-center justify-center py-10">
          <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const [detailRes, eventsRes] = await Promise.all([
      axios.get(`/admin/partners/${partnerId}`),
      axios.get(`/admin/partners/${partnerId}/reward-events?limit=10`)
    ]);
    const { partner } = detailRes.data.data;
    const events = eventsRes.data.data?.items || [];

    document.getElementById('partner-detail-body').innerHTML = `
      <!-- 기본 정보 편집 -->
      <div class="space-y-3 mb-5">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">파트너명</label>
            <input id="edit-partner-name" type="text" value="${partner.name}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">상태</label>
            <select id="edit-partner-status"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="active"    ${partner.status==='active'    ? 'selected':''}>활성</option>
              <option value="inactive"  ${partner.status==='inactive'  ? 'selected':''}>비활성</option>
              <option value="suspended" ${partner.status==='suspended' ? 'selected':''}>정지</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">설명</label>
          <input id="edit-partner-desc" type="text" value="${partner.description || ''}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">WebView URL</label>
          <input id="edit-partner-webview" type="url" value="${partner.webview_url || ''}"
            placeholder="https://partner.com/game"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Webhook URL</label>
          <input id="edit-partner-webhook" type="url" value="${partner.webhook_url || ''}"
            placeholder="https://partner.com/webhook"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div class="flex gap-2">
          <button onclick="submitEditPartner(${partnerId})"
            class="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
            정보 저장
          </button>
          <button onclick="regeneratePartnerKey(${partnerId})"
            class="px-4 py-2 border border-orange-300 text-orange-600 text-sm rounded-xl hover:bg-orange-50 transition">
            <i class="fas fa-key mr-1"></i>API 키 재발급
          </button>
        </div>
      </div>

      <!-- 통계 -->
      <div class="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl mb-5">
        <div class="text-center">
          <p class="text-xl font-bold text-gray-900">${partner.mapped_users || 0}</p>
          <p class="text-xs text-gray-500">연동 유저</p>
        </div>
        <div class="text-center border-x border-gray-200">
          <p class="text-xl font-bold text-gray-900">${(partner.total_points || 0).toLocaleString()}</p>
          <p class="text-xs text-gray-500">총 지급 포인트</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500">등록일</p>
          <p class="text-xs font-medium text-gray-700">${formatDate(partner.created_at)}</p>
        </div>
      </div>

      <!-- 최근 리워드 이벤트 -->
      <div>
        <p class="text-xs font-semibold text-gray-500 uppercase mb-2">최근 리워드 지급 내역</p>
        ${events.length === 0
          ? '<p class="text-sm text-gray-400 text-center py-4">지급 내역이 없습니다.</p>'
          : `<div class="space-y-2 max-h-60 overflow-y-auto">
               ${events.map(e => `
                 <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                   <div>
                     <p class="font-medium text-gray-800">${e.user_name || '(알 수 없음)'}</p>
                     <p class="text-xs text-gray-400">${e.event_type} · ${formatDate(e.created_at)}</p>
                   </div>
                   <span class="font-bold text-blue-600">+${e.points_awarded?.toLocaleString()}P</span>
                 </div>
               `).join('')}
             </div>`
        }
      </div>
    `;
  } catch (err) {
    document.getElementById('partner-detail-body').innerHTML =
      '<div class="text-center py-10 text-red-500 text-sm">파트너 정보를 불러오지 못했습니다.</div>';
  }
}

async function submitEditPartner(partnerId) {
  const body = {
    name:        document.getElementById('edit-partner-name')?.value.trim(),
    description: document.getElementById('edit-partner-desc')?.value.trim(),
    webview_url: document.getElementById('edit-partner-webview')?.value.trim() || null,
    webhook_url: document.getElementById('edit-partner-webhook')?.value.trim() || null,
    status:      document.getElementById('edit-partner-status')?.value,
  };
  if (!body.name) { showToast('파트너명을 입력해주세요.', 'error'); return; }
  try {
    await axios.patch(`/admin/partners/${partnerId}`, body);
    showToast('파트너 정보가 저장되었습니다.', 'success');
    document.getElementById('partner-detail-modal')?.remove();
    loadPartners();
  } catch (err) {
    showToast(err.response?.data?.error || '저장에 실패했습니다.', 'error');
  }
}

async function regeneratePartnerKey(partnerId) {
  if (!confirm('API 키를 재발급하면 기존 키는 즉시 사용 불가가 됩니다. 계속하시겠습니까?')) return;
  try {
    const { data } = await axios.post(`/admin/partners/${partnerId}/regenerate-key`);
    document.getElementById('partner-detail-modal')?.remove();
    showApiKeyModal('파트너', data.data.api_key);
  } catch (err) {
    showToast(err.response?.data?.error || 'API 키 재발급에 실패했습니다.', 'error');
  }
}

// ── 배지 헬퍼 ─────────────────────────────────────────────────
function partnerStatusBadge(status) {
  const map = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-600'
  };
  const label = { active:'활성', inactive:'비활성', suspended:'정지' };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[status]||'bg-gray-100 text-gray-500'}">${label[status]||status}</span>`;
}
