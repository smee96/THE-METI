// ── admin-plans.js ───────────────────────────────────────────
// 플랜 설정 / 고급 설정 / 충전 상품 관리
// 공유 유틸: setContent, loadingSpinner, showToast, formatDate (admin.js 코어)
// ──────────────────────────────────────────────────────────────

let _planTab = 'plans'; // plans | configs | charge-products

async function loadPlanConfigs(tab = _planTab) {
  _planTab = tab;
  setContent(loadingSpinner())
  try {
    const [plansRes, configsRes, chargeRes] = await Promise.all([
      axios.get('/admin/plan-configs'),
      axios.get('/admin/plan-configs/keys'),
      axios.get('/admin/point-charge-products')
    ])
    const plans   = plansRes.data.data   || []
    const configs = configsRes.data.data || []
    const charges = chargeRes.data.data  || []
    const planLabels = { free: 'Free', pro: 'Pro', business: 'Business' }
    const planColors = { free: 'gray', pro: 'blue', business: 'purple' }

    const configLabels = {
      extra_card_price:       '추가 명함 단가 (원)',
      point_expiry_days:      '포인트 만료일 (일)',
      min_point_charge:       '최소 포인트 충전액 (원)',
      chat_retention_free:    '채팅 보관 — Free (일)',
      chat_retention_pro:     '채팅 보관 — Pro (일)',
      chat_retention_business:'채팅 보관 — Business (일, 0=무제한)',
    }

    setContent(`
      <div class="space-y-4">
        <!-- 탭 -->
        <div class="border-b border-gray-200">
          <div class="flex gap-1">
            <button onclick="loadPlanConfigs('plans')"
              class="px-4 py-2.5 text-sm font-semibold border-b-2 transition
                     ${_planTab==='plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
              <i class="fas fa-layer-group mr-1"></i>플랜 제한
            </button>
            <button onclick="loadPlanConfigs('configs')"
              class="px-4 py-2.5 text-sm font-semibold border-b-2 transition
                     ${_planTab==='configs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
              <i class="fas fa-cog mr-1"></i>고급 설정
            </button>
            <button onclick="loadPlanConfigs('charge-products')"
              class="px-4 py-2.5 text-sm font-semibold border-b-2 transition
                     ${_planTab==='charge-products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
              <i class="fas fa-coins mr-1"></i>충전 상품
            </button>
          </div>
        </div>

        <!-- 플랜 제한 탭 -->
        <div class="${_planTab==='plans' ? '' : 'hidden'}">
          <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
            <i class="fas fa-info-circle mr-1"></i>
            멤버 수 / 명함 수 <strong>비워두기 = 무제한</strong>. 변경 즉시 신규 가입/승인에 적용됩니다.
          </div>
          <div class="grid gap-4">
            ${plans.map(p => {
              const color = planColors[p.code] || 'gray'
              const badgeClass = { gray: 'bg-gray-100 text-gray-700', blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700' }[color]
              return `
              <div class="bg-white rounded-xl shadow-sm border p-5">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-full text-sm font-bold ${badgeClass}">${planLabels[p.code] || p.code}</span>
                    <span class="text-sm text-gray-500">${p.name}</span>
                  </div>
                  <span class="text-sm text-gray-400">code: ${p.code}</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-semibold text-gray-600 mb-1">그룹 최대 멤버 수</label>
                    <div class="flex gap-2">
                      <input type="number" id="plan-members-${p.code}" value="${p.max_group_members ?? ''}" placeholder="무제한"
                        min="1" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <button onclick="updatePlanConfig('${p.code}', 'max_group_members')"
                        class="flex-shrink-0 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">저장</button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">현재: ${p.max_group_members !== null ? p.max_group_members + '명' : '무제한'}</p>
                  </div>
                  <div>
                    <label class="block text-sm font-semibold text-gray-600 mb-1">명함 한도</label>
                    <div class="flex gap-2">
                      <input type="number" id="plan-cards-${p.code}" value="${p.max_cards ?? ''}" placeholder="무제한"
                        min="1" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <button onclick="updatePlanConfig('${p.code}', 'max_cards')"
                        class="flex-shrink-0 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">저장</button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">현재: ${p.max_cards !== null ? p.max_cards + '개' : '무제한'}</p>
                  </div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- 고급 설정 탭 -->
        <div class="${_planTab==='configs' ? '' : 'hidden'}">
          <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700 mb-4">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            서비스 전체에 영향을 주는 설정입니다. 신중하게 변경해주세요.
          </div>
          <div class="grid gap-3">
            ${configs.map(cfg => `
              <div class="bg-white rounded-xl shadow-sm border p-4">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <p class="text-sm font-semibold text-gray-800">${configLabels[cfg.config_key] || cfg.config_key}</p>
                    <p class="text-xs text-gray-400">${cfg.description || ''}</p>
                  </div>
                  <span class="text-xs text-gray-400">최종수정: ${formatDate(cfg.updated_at)}</span>
                </div>
                <div class="flex gap-2">
                  <input type="text" id="cfg-${cfg.config_key}" value="${cfg.config_val}"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <button onclick="updateConfigKey('${cfg.config_key}')"
                    class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">저장</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 충전 상품 탭 -->
        <div class="${_planTab==='charge-products' ? '' : 'hidden'}">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm text-gray-500">포인트 충전 상품 ${charges.length}개</p>
            <button onclick="showCreateChargeProductModal()"
              class="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition flex items-center gap-1">
              <i class="fas fa-plus text-xs"></i> 상품 추가
            </button>
          </div>
          <div class="grid gap-3">
            ${charges.map(c => `
              <div class="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <p class="font-semibold text-gray-900">${c.title}</p>
                    ${c.is_custom ? '<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">직접입력</span>' : ''}
                    ${!c.is_active ? '<span class="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">비활성</span>' : ''}
                  </div>
                  <p class="text-sm text-gray-500">
                    결제금액: <strong>${c.amount_krw.toLocaleString()}원</strong>
                    → 지급: <strong class="text-blue-600">${c.points.toLocaleString()}P</strong>
                    ${c.min_amount ? `| 최소: ${c.min_amount.toLocaleString()}원` : ''}
                  </p>
                </div>
                <div class="flex gap-1.5 flex-shrink-0">
                  <button onclick="toggleChargeProduct(${c.id}, ${c.is_active})"
                    class="px-2.5 py-1.5 text-xs rounded-lg border transition
                           ${c.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}">
                    ${c.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button onclick="deleteChargeProduct(${c.id})"
                    class="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                    삭제
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `)
  } catch (e) {
    setContent(`<div class="text-center text-red-500 py-10">플랜 설정을 불러오지 못했습니다.</div>`)
  }
}

async function updatePlanConfig(planCode, field) {
  const input = document.getElementById(`plan-${field === 'max_group_members' ? 'members' : 'cards'}-${planCode}`)
  const rawVal = input?.value.trim()
  const value = rawVal === '' ? null : parseInt(rawVal)
  if (rawVal !== '' && (isNaN(value) || value < 1)) {
    showToast('올바른 숫자를 입력하거나 비워두세요 (무제한).', 'error'); return
  }
  try {
    await axios.patch(`/admin/plan-configs/${planCode}`, { [field]: value })
    showToast(`${planCode} 플랜 설정이 저장되었습니다.`, 'success')
    loadPlanConfigs('plans')
  } catch (e) {
    showToast(e.response?.data?.error || '저장 실패', 'error')
  }
}

async function updateConfigKey(configKey) {
  const input = document.getElementById(`cfg-${configKey}`)
  const val = input?.value.trim()
  if (val === '') { showToast('값을 입력해주세요.', 'error'); return }
  try {
    await axios.patch(`/admin/plan-configs/keys/${configKey}`, { config_val: val })
    showToast('설정이 저장되었습니다.', 'success')
    loadPlanConfigs('configs')
  } catch (e) {
    showToast(e.response?.data?.error || '저장 실패', 'error')
  }
}

async function toggleChargeProduct(id, currentActive) {
  try {
    await axios.patch(`/admin/point-charge-products/${id}`, { is_active: currentActive ? 0 : 1 })
    showToast(currentActive ? '비활성화되었습니다.' : '활성화되었습니다.', 'success')
    loadPlanConfigs('charge-products')
  } catch (e) {
    showToast('상태 변경에 실패했습니다.', 'error')
  }
}

async function deleteChargeProduct(id) {
  if (!confirm('이 충전 상품을 삭제하시겠습니까?')) return
  try {
    await axios.delete(`/admin/point-charge-products/${id}`)
    showToast('삭제되었습니다.', 'success')
    loadPlanConfigs('charge-products')
  } catch (e) {
    showToast(e.response?.data?.error || '삭제 실패', 'error')
  }
}

function showCreateChargeProductModal() {
  const modal = document.createElement('div')
  modal.id = 'create-charge-modal'
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900">충전 상품 추가</h3>
        <button onclick="document.getElementById('create-charge-modal').remove()"
          class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">상품명 <span class="text-red-500">*</span></label>
          <input id="charge-title" type="text" placeholder="예: 포인트 50,000P"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">결제금액 (원) <span class="text-red-500">*</span></label>
            <input id="charge-amount" type="number" placeholder="50000"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">지급 포인트 <span class="text-red-500">*</span></label>
            <input id="charge-points" type="number" placeholder="50000"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">정렬 순서</label>
          <input id="charge-sort" type="number" placeholder="0" value="0"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div id="charge-create-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
        <div class="flex gap-2 pt-1">
          <button onclick="document.getElementById('create-charge-modal').remove()"
            class="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
          <button onclick="submitCreateChargeProduct()"
            class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">추가</button>
        </div>
      </div>
    </div>`
  document.body.appendChild(modal)
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}

async function submitCreateChargeProduct() {
  const title  = document.getElementById('charge-title')?.value.trim()
  const amount = parseInt(document.getElementById('charge-amount')?.value)
  const points = parseInt(document.getElementById('charge-points')?.value)
  const sort   = parseInt(document.getElementById('charge-sort')?.value || '0')
  const errEl  = document.getElementById('charge-create-error')

  if (!title)           { errEl.textContent = '상품명을 입력해주세요.';    errEl.classList.remove('hidden'); return }
  if (isNaN(amount))    { errEl.textContent = '결제금액을 입력해주세요.';  errEl.classList.remove('hidden'); return }
  if (isNaN(points))    { errEl.textContent = '지급 포인트를 입력해주세요.'; errEl.classList.remove('hidden'); return }
  errEl.classList.add('hidden')

  try {
    await axios.post('/admin/point-charge-products', { title, amount_krw: amount, points, sort_order: sort })
    showToast('충전 상품이 추가되었습니다.', 'success')
    document.getElementById('create-charge-modal')?.remove()
    loadPlanConfigs('charge-products')
  } catch (e) {
    errEl.textContent = e.response?.data?.error || '추가에 실패했습니다.'
    errEl.classList.remove('hidden')
  }
}
