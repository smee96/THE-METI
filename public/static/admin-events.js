// ── admin-events.js ─────────────────────────────────────────
// 행사 관리 / 행사 상세 모달 / 그룹 생성 모달 / 행사 생성 모달
// 공유 유틸: setContent, loadingSpinner, errorBox, renderPagination,
//            showToast, escHtml, formatDate, eventStatusBadge (admin.js 코어)
// ──────────────────────────────────────────────────────────────

// ── 행사 관리 ────────────────────────────────────────────
let _eventsStatus = 'all';
function loadEventsPage(page) { loadEvents(page, _eventsStatus); }

async function loadEvents(page = 1, status = 'all') {
  _eventsStatus = status;
  setContent(loadingSpinner());
  try {
    const statusParam = status === 'all' ? '' : status;
    const { data } = await axios.get(`/admin/events?limit=20&page=${page}&status=${statusParam}`);
    const rows = data.data || [];
    const pagination = data.pagination;

    const tabs = ['all','upcoming','ongoing','ended','cancelled'];
    const tabLabels = { all:'전체', upcoming:'예정', ongoing:'진행중', ended:'종료', cancelled:'취소' };

    setContent(`
      <div class="space-y-3">
        <!-- 상단: 탭 필터 + 생성 버튼 -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="flex gap-1.5 flex-wrap">
            ${tabs.map(t => `
              <button onclick="loadEvents(1,'${t}')"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition
                       ${status === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}">
                ${tabLabels[t]}
              </button>
            `).join('')}
          </div>
          <button onclick="showCreateEventModal()"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <i class="fas fa-plus"></i> 행사 생성
          </button>
        </div>

        <!-- 테이블 (데스크탑) -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">행사명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">시작일</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">참가자</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0 ? `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">행사가 없습니다.</td></tr>` : ''}
                ${rows.map(r => `
                  <tr class="hover:bg-gray-50 cursor-pointer" onclick="showEventDetail(${r.id})">
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">${r.title ?? '-'}</p>
                      <p class="text-xs text-gray-400">${r.location ?? ''}</p>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.group_name ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.starts_at ? formatDate(r.starts_at) : '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.participant_count ?? 0}${r.capacity ? ' / ' + r.capacity : ''}명</td>
                    <td class="px-4 py-3">${eventStatusBadge(r.status)}</td>
                    <td class="px-4 py-3" onclick="event.stopPropagation()">
                      <div class="flex gap-1">
                        <button onclick="showEventDetail(${r.id})"
                          class="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">상세</button>
                        ${r.status !== 'cancelled' && r.status !== 'ended' ? `
                          <button onclick="cancelEvent(${r.id}, '${status}')"
                            class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">취소</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 카드 목록 (모바일) -->
        <div class="md:hidden space-y-2">
          ${rows.length === 0 ? `<div class="text-center text-gray-400 text-sm py-10">행사가 없습니다.</div>` : ''}
          ${rows.map(r => `
            <div class="bg-white rounded-xl border p-4 space-y-2" onclick="showEventDetail(${r.id})">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold text-gray-900">${r.title ?? '-'}</p>
                  <p class="text-xs text-gray-500">${r.group_name ?? '-'}</p>
                </div>
                ${eventStatusBadge(r.status)}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span><i class="fas fa-calendar mr-1"></i>${r.starts_at ? formatDate(r.starts_at) : '-'}</span>
                <span><i class="fas fa-users mr-1"></i>${r.participant_count ?? 0}명</span>
              </div>
              ${r.status !== 'cancelled' && r.status !== 'ended' ? `
                <div onclick="event.stopPropagation()" class="flex gap-1 pt-1">
                  <button onclick="cancelEvent(${r.id}, '${status}')"
                    class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200">취소</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${pagination ? renderPagination(pagination, `loadEventsPage`) : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('행사 목록을 불러오지 못했습니다.'));
  }
}

// ── 행사 상세 모달 ─────────────────────────────────────────
async function showEventDetail(eventId) {
  const modal = document.createElement('div');
  modal.id = 'event-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4">${loadingSpinner()}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/events/${eventId}`);
    const e = data.data;
    const participants = e.participants || [];

    modal.querySelector('.bg-white').innerHTML = `
      <!-- 헤더 -->
      <div class="flex items-start justify-between px-5 py-4 border-b gap-3">
        <div>
          <h3 class="font-bold text-gray-900 text-base">${e.title}</h3>
          <p class="text-sm text-gray-500 mt-0.5">${e.group_name ?? '-'}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${eventStatusBadge(e.status)}
          <button onclick="document.getElementById('event-detail-modal').remove()" class="text-gray-400 hover:text-gray-600 ml-1">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 탭 -->
      <div class="flex border-b px-5">
        ${['info','edit','participants'].map((t,i) => `
          <button onclick="switchEventTab('${t}')"
            id="evt-tab-${t}"
            class="px-4 py-3 text-sm font-medium border-b-2 transition -mb-px
                   ${i===0 ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}">
            ${{info:'기본 정보', edit:'수정', participants:'참가자 ('+participants.length+')'}[t]}
          </button>
        `).join('')}
      </div>

      <!-- 기본 정보 탭 -->
      <div id="evt-panel-info" class="p-5 space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">시작일시</p>
            <p class="font-medium text-gray-800">${e.starts_at ? formatDate(e.starts_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">종료일시</p>
            <p class="font-medium text-gray-800">${e.ends_at ? formatDate(e.ends_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">장소</p>
            <p class="font-medium text-gray-800">${e.location ?? '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">참가자</p>
            <p class="font-medium text-gray-800">${e.participant_count ?? 0} / ${e.capacity ?? '무제한'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">공개 여부</p>
            <p class="font-medium text-gray-800">${e.visibility === 'public' ? '공개' : '그룹 전용'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">참가비</p>
            <p class="font-medium text-gray-800">${e.entry_fee ? e.entry_fee.toLocaleString() + 'P' : '무료'}</p>
          </div>
        </div>
        ${e.description ? `
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-400 mb-1">설명</p>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">${e.description}</p>
          </div>
        ` : ''}
        ${e.status !== 'cancelled' && e.status !== 'ended' ? `
          <div class="pt-2 border-t">
            <button onclick="cancelEvent(${e.id})"
              class="w-full py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-xl hover:bg-red-50 transition">
              <i class="fas fa-ban mr-1.5"></i>행사 취소
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 수정 탭 -->
      <div id="evt-panel-edit" class="p-5 space-y-3 hidden">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사명 <span class="text-red-500">*</span></label>
          <input id="ee-title" type="text" value="${e.title ?? ''}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">설명</label>
          <textarea id="ee-desc" rows="3"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none">${e.description ?? ''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">장소</label>
          <input id="ee-location" type="text" value="${e.location ?? ''}"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">시작일</label>
            <input id="ee-starts" type="datetime-local" value="${e.starts_at ? e.starts_at.slice(0,16) : ''}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">종료일</label>
            <input id="ee-ends" type="datetime-local" value="${e.ends_at ? e.ends_at.slice(0,16) : ''}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">상태</label>
            <select id="ee-status"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              ${['upcoming','ongoing','ended','cancelled'].map(s =>
                `<option value="${s}" ${e.status===s?'selected':''}>${{upcoming:'예정',ongoing:'진행중',ended:'종료',cancelled:'취소'}[s]}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="ee-visibility"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" ${e.visibility==='public'?'selected':''}>공개</option>
              <option value="group_only" ${e.visibility==='group_only'?'selected':''}>그룹 전용</option>
            </select>
          </div>
        </div>
        <div id="ee-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
        <button onclick="submitEditEvent(${e.id})"
          class="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          저장하기
        </button>
      </div>

      <!-- 참가자 탭 -->
      <div id="evt-panel-participants" class="p-5 hidden">
        ${participants.length === 0
          ? `<div class="text-center text-gray-400 text-sm py-8">참가자가 없습니다.</div>`
          : `<div class="space-y-2 max-h-80 overflow-y-auto">
              ${participants.map((p, idx) => `
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                  <span class="text-xs text-gray-400 w-5 text-right">${idx+1}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${p.name ?? '-'}</p>
                    <p class="text-xs text-gray-400 truncate">${p.email ?? '-'}</p>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full ${p.status==='confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                    ${p.status==='confirmed' ? '확정' : p.status ?? '-'}
                  </span>
                </div>
              `).join('')}
            </div>`
        }
      </div>
    `;
  } catch (err) {
    modal.querySelector('.bg-white').innerHTML = `
      <div class="p-8 text-center text-red-500">행사 정보를 불러오지 못했습니다.</div>`;
  }
}

function switchEventTab(tab) {
  ['info','edit','participants'].forEach(t => {
    document.getElementById(`evt-panel-${t}`)?.classList.toggle('hidden', t !== tab);
    const btn = document.getElementById(`evt-tab-${t}`);
    if (btn) {
      btn.classList.toggle('border-blue-600', t === tab);
      btn.classList.toggle('text-blue-600',   t === tab);
      btn.classList.toggle('border-transparent', t !== tab);
      btn.classList.toggle('text-gray-500',   t !== tab);
    }
  });
}

async function submitEditEvent(eventId) {
  const title    = document.getElementById('ee-title')?.value.trim();
  const desc     = document.getElementById('ee-desc')?.value.trim();
  const location = document.getElementById('ee-location')?.value.trim();
  const starts   = document.getElementById('ee-starts')?.value;
  const ends     = document.getElementById('ee-ends')?.value;
  const status   = document.getElementById('ee-status')?.value;
  const vis      = document.getElementById('ee-visibility')?.value;
  const errEl    = document.getElementById('ee-error');

  if (!title || title.length < 2) {
    errEl.textContent = '행사명을 2자 이상 입력해주세요.';
    errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = { title, status, visibility: vis };
  if (desc)     payload.description = desc;
  if (location) payload.location    = location;
  if (starts)   payload.starts_at   = new Date(starts).toISOString();
  if (ends)     payload.ends_at     = new Date(ends).toISOString();

  try {
    await axios.patch(`/admin/events/${eventId}`, payload);
    document.getElementById('event-detail-modal')?.remove();
    showToast('행사가 수정되었습니다.', 'success');
    loadEvents();
  } catch (err) {
    errEl.textContent = err.response?.data?.error || '수정에 실패했습니다.';
    errEl.classList.remove('hidden');
  }
}

async function cancelEvent(eventId, currentStatus = 'all') {
  if (!confirm('이 행사를 취소하시겠습니까? 취소 후에는 되돌릴 수 없습니다.')) return;
  try {
    await axios.patch(`/admin/events/${eventId}`, { status: 'cancelled' });
    document.getElementById('event-detail-modal')?.remove();
    showToast('행사가 취소되었습니다.', 'success');
    loadEvents(1, currentStatus);
  } catch (err) {
    showToast(err.response?.data?.error || '취소에 실패했습니다.', 'error');
  }
}

// ── 그룹 생성 모달 ──────────────────────────────────
function showCreateGroupModal() {
  const modal = document.createElement('div');
  modal.id = 'create-group-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">그룹 직접 생성</h3>
        <button onclick="document.getElementById('create-group-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">그룹명 <span class="text-red-500">*</span></label>
          <input type="text" id="cg-name" placeholder="그룹명 입력 (2~100자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">설명</label>
          <textarea id="cg-desc" rows="3" placeholder="그룹 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">카테고리</label>
            <select id="cg-category" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="association">협회</option>
              <option value="company">기업</option>
              <option value="club">동호회</option>
              <option value="other" selected>기타</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="cg-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">최대 멤버 수</label>
          <input type="number" id="cg-maxmembers" placeholder="제한 없음 (비워두면 무제한)" min="1"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div id="cg-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
      </div>
      <div class="px-5 pb-5 flex gap-2">
        <button onclick="submitCreateGroup()"
          class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          생성하기
        </button>
        <button onclick="document.getElementById('create-group-modal').remove()"
          class="px-4 py-2.5 border text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('cg-name')?.focus(), 100);
}

async function submitCreateGroup() {
  const name = document.getElementById('cg-name')?.value.trim();
  const desc = document.getElementById('cg-desc')?.value.trim();
  const category = document.getElementById('cg-category')?.value;
  const visibility = document.getElementById('cg-visibility')?.value;
  const maxVal = document.getElementById('cg-maxmembers')?.value;
  const errEl = document.getElementById('cg-error');

  if (!name || name.length < 2) {
    errEl.textContent = '그룹명을 2자 이상 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = { name, category, visibility };
  if (desc) payload.description = desc;
  if (maxVal) payload.max_members = parseInt(maxVal);

  try {
    await axios.post('/admin/groups', payload);
    document.getElementById('create-group-modal')?.remove();
    showToast('그룹이 생성되었습니다.', 'success');
    loadGroups(1, 'active');
  } catch (err) {
    const msg = err.response?.data?.message || '그룹 생성에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

// ── 행사 생성 모달 ──────────────────────────────────
async function showCreateEventModal() {
  let groupOptions = '<option value="">그룹 불러오는 중...</option>';
  try {
    const { data } = await axios.get('/admin/groups?status=active&limit=100');
    const groups = data.data || [];
    if (groups.length === 0) {
      groupOptions = '<option value="">활성 그룹 없음</option>';
    } else {
      groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
  } catch (e) {
    groupOptions = '<option value="">그룹 로드 실패</option>';
  }

  const modal = document.createElement('div');
  modal.id = 'create-event-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h3 class="font-bold text-gray-900">행사 생성</h3>
        <button onclick="document.getElementById('create-event-modal').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">그룹 선택 <span class="text-red-500">*</span></label>
          <select id="ce-group" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${groupOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사명 <span class="text-red-500">*</span></label>
          <input type="text" id="ce-title" placeholder="행사명 입력 (2~200자)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">행사 설명</label>
          <textarea id="ce-desc" rows="3" placeholder="행사 소개 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">장소</label>
          <input type="text" id="ce-location" placeholder="행사 장소 (선택)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">시작일시 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" id="ce-starts-date"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onclick="this.showPicker && this.showPicker()">
            <select id="ce-starts-hour"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">시간 선택</option>
              ${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">종료일시</label>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" id="ce-ends-date"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onclick="this.showPicker && this.showPicker()">
            <select id="ce-ends-hour"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">시간 선택</option>
              ${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">공개 여부</label>
            <select id="ce-visibility" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="public" selected>공개</option>
              <option value="group_only">그룹 전용</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">참가 방식</label>
            <select id="ce-regtype" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="free" selected>자유 참가</option>
              <option value="pre_required">사전 신청</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">입장 방식</label>
            <select id="ce-entry" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="qr" selected>QR</option>
              <option value="nfc_qr">NFC+QR</option>
              <option value="manual">수동</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-600 mb-1">최대 참가자</label>
            <input type="number" id="ce-maxpart" placeholder="무제한" min="1"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div id="ce-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
      </div>
      <div class="px-5 pb-5 flex gap-2">
        <button onclick="submitCreateEvent()"
          class="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
          행사 생성
        </button>
        <button onclick="document.getElementById('create-event-modal').remove()"
          class="px-4 py-2.5 border text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitCreateEvent() {
  const groupId = document.getElementById('ce-group')?.value;
  const title = document.getElementById('ce-title')?.value.trim();
  const desc = document.getElementById('ce-desc')?.value.trim();
  const location = document.getElementById('ce-location')?.value.trim();
  const startsDate = document.getElementById('ce-starts-date')?.value;
  const startsHour = document.getElementById('ce-starts-hour')?.value;
  const endsDate = document.getElementById('ce-ends-date')?.value;
  const endsHour = document.getElementById('ce-ends-hour')?.value;
  const startsRaw = (startsDate && startsHour) ? `${startsDate}T${startsHour}:00` : '';
  const endsRaw   = (endsDate && endsHour)     ? `${endsDate}T${endsHour}:00`     : '';
  const visibility = document.getElementById('ce-visibility')?.value;
  const regtype = document.getElementById('ce-regtype')?.value;
  const entry = document.getElementById('ce-entry')?.value;
  const maxVal = document.getElementById('ce-maxpart')?.value;
  const errEl = document.getElementById('ce-error');

  if (!groupId) {
    errEl.textContent = '그룹을 선택해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (!title || title.length < 2) {
    errEl.textContent = '행사명을 2자 이상 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  if (!startsRaw) {
    errEl.textContent = '시작일시를 입력해주세요.'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const payload = {
    group_id: parseInt(groupId),
    title,
    starts_at: new Date(startsRaw).toISOString(),
    visibility,
    registration_type: regtype,
    entry_method: entry
  };
  if (desc) payload.description = desc;
  if (location) payload.location = location;
  if (endsRaw) payload.ends_at = new Date(endsRaw).toISOString();
  if (maxVal) payload.max_participants = parseInt(maxVal);

  try {
    await axios.post('/admin/events', payload);
    document.getElementById('create-event-modal')?.remove();
    showToast('행사가 생성되었습니다.', 'success');
    loadEvents(1, _eventsStatus);
  } catch (err) {
    const msg = err.response?.data?.message || '행사 생성에 실패했습니다.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}
