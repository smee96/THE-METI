// ════════════════════════════════════════════════════════════
// admin-orders.js — 주문/결제 관리
// ════════════════════════════════════════════════════════════

let _ordersStatus = 'all';
let _ordersMethod = 'all';
function loadOrdersPage(page) { loadOrders(page); }

async function loadOrders(page = 1, status = _ordersStatus, method = _ordersMethod) {
  _ordersStatus = status;
  _ordersMethod = method;
  setContent(loadingSpinner());

  try {
    const params = new URLSearchParams({ page, limit: 20 });
    if (status !== 'all') params.set('status', status);
    if (method !== 'all') params.set('method', method);
    const search = document.getElementById('orders-search-val')?.value?.trim();
    if (search) params.set('q', search);

    const [{ data }, { data: statsData }] = await Promise.all([
      axios.get(`/admin/orders?${params}`),
      axios.get('/admin/orders/stats')
    ]);

    const p    = data.data;
    const rows = p.items || [];
    const meta = p.meta  || {};
    const stats = statsData.data || {};

    setContent(`
      <!-- 통계 요약 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        ${orderStatCard('이달 총 매출',   (stats.by_status?.find(s=>s.status==='paid')?.amount||0).toLocaleString() + '원', 'won-sign',      'teal')}
        ${orderStatCard('전체 주문',       (stats.by_status?.reduce((a,b)=>a+(b.count||0),0)||0) + '건',                   'shopping-cart',  'blue')}
        ${orderStatCard('결제 완료',       (stats.by_status?.find(s=>s.status==='paid')?.count||0) + '건',                 'check-circle',   'green')}
        ${orderStatCard('미결제/취소',     ((stats.by_status?.find(s=>s.status==='pending')?.count||0)+(stats.by_status?.find(s=>s.status==='cancelled')?.count||0)) + '건', 'exclamation-circle', 'red')}
      </div>

      <!-- 필터/검색 -->
      <div class="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div class="flex flex-wrap gap-2 items-center">
          <div class="flex gap-1 flex-wrap">
            ${['all','pending','paid','cancelled','refunded'].map(s =>
              `<button onclick="loadOrders(1,'${s}','${_ordersMethod}')"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition
                       ${_ordersStatus===s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}">
                ${{all:'전체',pending:'미결제',paid:'결제완료',cancelled:'취소',refunded:'환불'}[s]}
               </button>`).join('')}
          </div>
          <div class="flex gap-1 flex-wrap ml-2 border-l pl-2">
            ${['all','web','inapp_apple','inapp_google'].map(m =>
              `<button onclick="loadOrders(1,'${_ordersStatus}','${m}')"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition
                       ${_ordersMethod===m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}">
                ${{all:'전체',web:'웹결제',inapp_apple:'Apple',inapp_google:'Google'}[m]}
               </button>`).join('')}
          </div>
          <div class="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <input id="orders-search-val" type="text" placeholder="유저명/이메일 검색"
              class="flex-1 sm:w-44 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') loadOrders(1)">
            <button onclick="loadOrders(1)"
              class="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 테이블 -->
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">주문번호</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유저</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">금액</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">결제수단</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">주문일시</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${rows.length === 0
                ? `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-400 text-sm">주문 내역이 없습니다.</td></tr>`
                : rows.map(o => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3 text-sm font-mono text-gray-600">#${o.id}</td>
                    <td class="px-4 py-3">
                      <div class="text-sm font-medium text-gray-900">${o.user_name}</div>
                      <div class="text-xs text-gray-400">${o.user_email}</div>
                    </td>
                    <td class="px-4 py-3 text-sm font-bold text-gray-900">${(o.total_amount||0).toLocaleString()}원</td>
                    <td class="px-4 py-3">${paymentMethodBadge(o.payment_method)}</td>
                    <td class="px-4 py-3">${orderStatusBadge(o.status)}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">${formatDate(o.created_at)}</td>
                    <td class="px-4 py-3">
                      <button onclick="showOrderDetail(${o.id})"
                        class="text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition">
                        상세
                      </button>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 모바일 카드 -->
        <div class="md:hidden divide-y divide-gray-100">
          ${rows.length === 0
            ? `<div class="p-6 text-center text-gray-400 text-sm">주문 내역이 없습니다.</div>`
            : rows.map(o => `
              <div class="p-4 hover:bg-gray-50 cursor-pointer" onclick="showOrderDetail(${o.id})">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-mono text-gray-500">#${o.id}</span>
                  ${orderStatusBadge(o.status)}
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-gray-900">${o.user_name}</p>
                    <p class="text-xs text-gray-400">${formatDate(o.created_at)}</p>
                  </div>
                  <p class="text-base font-bold text-gray-900">${(o.total_amount||0).toLocaleString()}원</p>
                </div>
              </div>
            `).join('')}
        </div>

        ${rows.length > 0 ? renderPagination(meta, loadOrdersPage) : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('주문 목록을 불러오지 못했습니다.'));
  }
}

// ── 주문 상세 모달 ───────────────────────────────────────────
async function showOrderDetail(orderId) {
  const modal = document.createElement('div');
  modal.id = 'order-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">주문 상세 #${orderId}</h3>
        <button onclick="document.getElementById('order-detail-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div id="order-detail-body" class="p-5">
        <div class="flex items-center justify-center py-10">
          <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/orders/${orderId}`);
    const { order, items, payment } = data.data;

    document.getElementById('order-detail-body').innerHTML = `
      <!-- 유저 정보 -->
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i class="fas fa-user text-blue-600"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-900">${order.user_name}</p>
          <p class="text-sm text-gray-400">${order.user_email}</p>
        </div>
        ${planBadge(order.user_plan)}
      </div>

      <!-- 주문 정보 -->
      <div class="space-y-2 text-sm mb-4">
        <div class="flex justify-between py-1.5 border-b border-gray-100">
          <span class="text-gray-500">주문번호</span>
          <span class="font-mono font-medium">#${order.id}</span>
        </div>
        <div class="flex justify-between py-1.5 border-b border-gray-100">
          <span class="text-gray-500">상태</span>
          <span>${orderStatusBadge(order.status)}</span>
        </div>
        <div class="flex justify-between py-1.5 border-b border-gray-100">
          <span class="text-gray-500">결제수단</span>
          <span>${paymentMethodBadge(payment?.method)}</span>
        </div>
        <div class="flex justify-between py-1.5 border-b border-gray-100">
          <span class="text-gray-500">결제일시</span>
          <span>${payment?.paid_at ? formatDate(payment.paid_at) : '-'}</span>
        </div>
        <div class="flex justify-between py-1.5">
          <span class="text-gray-500">주문일시</span>
          <span>${formatDate(order.created_at)}</span>
        </div>
      </div>

      <!-- 상품 목록 -->
      ${items && items.length > 0 ? `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase mb-2">주문 상품</p>
          <div class="space-y-2">
            ${items.map(item => `
              <div class="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-900">${item.product_name || '(상품명 없음)'}</p>
                  <p class="text-xs text-gray-400">수량: ${item.quantity}</p>
                </div>
                <p class="text-sm font-bold">${(item.price * item.quantity).toLocaleString()}원</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 총액 -->
      <div class="flex justify-between items-center p-3 bg-blue-50 rounded-xl mb-4">
        <span class="font-semibold text-gray-700">총 결제 금액</span>
        <span class="text-lg font-bold text-blue-600">${(order.total_amount||0).toLocaleString()}원</span>
      </div>

      <!-- 상태 변경 -->
      ${order.status !== 'paid' ? `
        <div class="border-t pt-4">
          <p class="text-xs font-semibold text-gray-500 uppercase mb-2">상태 변경</p>
          <div class="flex gap-2 flex-wrap">
            ${order.status === 'pending' ? `
              <button onclick="changeOrderStatus(${order.id}, 'paid')"
                class="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                <i class="fas fa-check mr-1"></i>결제 완료 처리
              </button>
              <button onclick="changeOrderStatus(${order.id}, 'cancelled')"
                class="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition">
                <i class="fas fa-times mr-1"></i>취소 처리
              </button>
            ` : ''}
            ${order.status === 'paid' ? `
              <button onclick="changeOrderStatus(${order.id}, 'refunded')"
                class="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition">
                <i class="fas fa-undo mr-1"></i>환불 처리
              </button>
            ` : ''}
          </div>
        </div>
      ` : '<p class="text-center text-sm text-green-600 font-medium"><i class="fas fa-check-circle mr-1"></i>결제 완료된 주문입니다.</p>'}
    `;
  } catch (err) {
    document.getElementById('order-detail-body').innerHTML = `
      <div class="text-center py-10 text-red-500 text-sm">주문 정보를 불러오지 못했습니다.</div>`;
  }
}

async function changeOrderStatus(orderId, status) {
  const labels = { paid: '결제 완료', cancelled: '취소', refunded: '환불' };
  if (!confirm(`이 주문을 '${labels[status]}'로 변경하시겠습니까?`)) return;
  try {
    await axios.patch(`/admin/orders/${orderId}`, { status });
    showToast(`주문이 '${labels[status]}'로 변경되었습니다.`, 'success');
    document.getElementById('order-detail-modal')?.remove();
    loadOrders();
  } catch (err) {
    showToast(err.response?.data?.error || '상태 변경에 실패했습니다.', 'error');
  }
}

// ── 배지 / 헬퍼 ─────────────────────────────────────────────
function orderStatusBadge(status) {
  const map = {
    pending:   'bg-yellow-100 text-yellow-700',
    paid:      'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-600',
    refunded:  'bg-orange-100 text-orange-700'
  };
  const label = { pending:'미결제', paid:'결제완료', cancelled:'취소', refunded:'환불' };
  const cls = map[status] || 'bg-gray-100 text-gray-500';
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${cls}">${label[status] || status}</span>`;
}

function paymentMethodBadge(method) {
  const map = {
    web:          { label: '웹결제',    cls: 'bg-blue-100 text-blue-700' },
    inapp_apple:  { label: 'Apple',     cls: 'bg-gray-900 text-white' },
    inapp_google: { label: 'Google Pay', cls: 'bg-green-100 text-green-700' }
  };
  const m = map[method] || { label: method || '-', cls: 'bg-gray-100 text-gray-500' };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}">${m.label}</span>`;
}

function orderStatCard(label, value, icon, color) {
  const colors = {
    teal:  'bg-teal-50 text-teal-600',
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red:   'bg-red-50 text-red-600'
  };
  return `
    <div class="bg-white rounded-xl p-4 shadow-sm border">
      <div class="w-8 h-8 ${colors[color]} rounded-lg flex items-center justify-center mb-2">
        <i class="fas fa-${icon} text-sm"></i>
      </div>
      <p class="text-lg font-bold text-gray-900">${value}</p>
      <p class="text-xs text-gray-500 mt-0.5">${label}</p>
    </div>`;
}
