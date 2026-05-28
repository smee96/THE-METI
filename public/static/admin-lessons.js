// ── admin-lessons.js ─────────────────────────────────────────
// 레슨 관리 / 레슨 상세 모달 / 레슨 생성 모달
// 공유 유틸: setContent, loadingSpinner, errorBox, renderPagination,
//            showToast, escHtml, formatDate (admin.js 코어)
// ──────────────────────────────────────────────────────────────

let _lessonsStatus = 'all';
function loadLessonsPage(page) { loadLessons(page, _lessonsStatus); }

async function loadLessons(page = 1, status = 'all') {
  _lessonsStatus = status;
  setContent(loadingSpinner());
  try {
    const params = new URLSearchParams({ limit: '20', page });
    if (status && status !== 'all') params.set('status', status);
    const { data } = await axios.get(`/admin/lessons?${params}`);
    const rows = data.data || [];
    const pagination = data.pagination;

    const statusTabs = [
      { key: 'all', label: '전체' },
      { key: 'upcoming',  label: '예정' },
      { key: 'ongoing',   label: '진행중' },
      { key: 'ended',     label: '종료' },
      { key: 'cancelled', label: '취소' },
    ];

    setContent(`
      <div class="space-y-3">
        <!-- 헤더 + 생성 버튼 -->
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-800">레슨 관리</h2>
          <button onclick="openCreateLessonModal()"
            class="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
            <i class="fas fa-plus"></i> 레슨 생성
          </button>
        </div>

        <!-- 상태 필터 탭 -->
        <div class="flex gap-1 overflow-x-auto pb-1">
          ${statusTabs.map(t => `
            <button onclick="loadLessons(1,'${t.key}')"
              class="px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition
                ${status === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'}">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- 데스크탑 테이블 -->
        <div class="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="px-4 py-3 border-b flex items-center justify-between">
            <span class="text-sm font-semibold text-gray-700">
              ${statusTabs.find(t => t.key === status)?.label ?? '전체'} 레슨
            </span>
            <span class="text-sm text-gray-500">총 ${pagination?.total ?? rows.length}개</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">레슨명</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">그룹</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">강사</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">일시</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">수강/정원</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${rows.length === 0
                  ? `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-400 text-sm">레슨이 없습니다.</td></tr>`
                  : rows.map(r => `
                  <tr class="hover:bg-gray-50 cursor-pointer" onclick="showLessonDetail(${r.id})">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 max-w-[180px] truncate">${escHtml(r.title ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${escHtml(r.group_name ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${escHtml(r.instructor_name ?? '-')}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.scheduled_at ? formatDate(r.scheduled_at) : '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${r.registered_count ?? 0} / ${r.capacity ?? '∞'}</td>
                    <td class="px-4 py-3">${lessonStatusBadge(r.status)}</td>
                    <td class="px-4 py-3" onclick="event.stopPropagation()">
                      ${r.status !== 'cancelled'
                        ? `<button onclick="cancelLesson(${r.id},'${status}')"
                            class="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition">취소</button>`
                        : `<span class="text-xs text-gray-400">취소됨</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 모바일 카드 뷰 -->
        <div class="md:hidden space-y-2">
          ${rows.length === 0
            ? `<div class="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">레슨이 없습니다.</div>`
            : rows.map(r => `
            <div class="bg-white rounded-xl shadow-sm border p-4 cursor-pointer" onclick="showLessonDetail(${r.id})">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-900 truncate">${escHtml(r.title ?? '-')}</p>
                  <p class="text-xs text-gray-500 mt-0.5">${escHtml(r.group_name ?? '-')} · ${escHtml(r.instructor_name ?? '-')}</p>
                </div>
                ${lessonStatusBadge(r.status)}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span><i class="fas fa-calendar mr-1"></i>${r.scheduled_at ? formatDate(r.scheduled_at) : '-'}</span>
                <span><i class="fas fa-users mr-1"></i>${r.registered_count ?? 0}/${r.capacity ?? '∞'}</span>
              </div>
              ${r.status !== 'cancelled'
                ? `<button onclick="event.stopPropagation(); cancelLesson(${r.id},'${status}')"
                    class="mt-2 w-full py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition">취소</button>`
                : ''}
            </div>
          `).join('')}
        </div>

        ${pagination ? renderPagination(pagination, 'loadLessonsPage') : ''}
      </div>
    `);
  } catch (err) {
    setContent(errorBox('레슨 목록을 불러오지 못했습니다.'));
  }
}

// 레슨 상세 모달 (기본정보 / 수정 / 수강자)
async function showLessonDetail(lessonId) {
  const modal = document.createElement('div');
  modal.id = 'lesson-detail-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-4 p-5">${loadingSpinner()}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  try {
    const { data } = await axios.get(`/admin/lessons/${lessonId}`);
    const ls = data.data;
    const regs = ls.registrations || [];

    modal.querySelector('.bg-white').innerHTML = `
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-chalkboard-teacher text-indigo-500"></i>
        <span class="text-lg font-bold text-gray-800">레슨 상세</span>
        <span class="ml-auto">${lessonStatusBadge(ls.status)}</span>
      </div>

      <!-- 탭 헤더 -->
      <div class="flex border-b mb-4">
        <button id="ltab-info" onclick="switchLessonTab('info')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-indigo-500 text-indigo-600">기본정보</button>
        <button id="ltab-edit" onclick="switchLessonTab('edit')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">수정</button>
        <button id="ltab-students" onclick="switchLessonTab('students')"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          수강자 <span class="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">${regs.length}</span>
        </button>
      </div>

      <!-- 탭 1: 기본정보 -->
      <div id="lpanel-info" class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">레슨명</p>
            <p class="font-medium text-gray-900">${escHtml(ls.title)}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">그룹</p>
            <p class="font-medium text-gray-900">${escHtml(ls.group_name ?? '-')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">강사</p>
            <p class="font-medium text-gray-900">${escHtml(ls.instructor_name ?? '-')}</p>
            <p class="text-xs text-gray-500">${escHtml(ls.instructor_email ?? '')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">일시</p>
            <p class="font-medium text-gray-900">${ls.scheduled_at ? formatDate(ls.scheduled_at) : '-'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">진행시간</p>
            <p class="font-medium text-gray-900">${ls.duration_minutes ?? 60}분</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">수강/정원</p>
            <p class="font-medium text-gray-900">${ls.registered_count ?? 0} / ${ls.capacity ?? '∞'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">장소</p>
            <p class="font-medium text-gray-900">${escHtml(ls.location ?? '-')}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 mb-1">포인트 비용</p>
            <p class="font-medium text-gray-900">${(ls.point_cost ?? 0).toLocaleString()}P</p>
          </div>
        </div>
        ${ls.description ? `<div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">${escHtml(ls.description)}</div>` : ''}
        ${ls.status !== 'cancelled'
          ? `<button onclick="cancelLesson(${ls.id},'${_lessonsStatus}', true)"
              class="w-full py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition font-medium">
              <i class="fas fa-ban mr-1"></i>레슨 취소
            </button>`
          : ''}
      </div>

      <!-- 탭 2: 수정 -->
      <div id="lpanel-edit" class="hidden space-y-3">
        <div class="space-y-3 text-sm">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">레슨명</label>
            <input id="ledit-title" type="text" value="${escHtml(ls.title)}"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">일시</label>
              <input id="ledit-scheduled-at" type="datetime-local"
                value="${ls.scheduled_at ? ls.scheduled_at.replace(' ', 'T').substring(0,16) : ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">진행시간(분)</label>
              <input id="ledit-duration" type="number" min="10" value="${ls.duration_minutes ?? 60}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">장소</label>
              <input id="ledit-location" type="text" value="${escHtml(ls.location ?? '')}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">정원 (비워두면 무제한)</label>
              <input id="ledit-capacity" type="number" min="1" value="${ls.capacity ?? ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">상태</label>
            <select id="ledit-status"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
              ${['upcoming','ongoing','ended','cancelled'].map(s =>
                `<option value="${s}" ${ls.status === s ? 'selected' : ''}>${
                  {upcoming:'예정',ongoing:'진행중',ended:'종료',cancelled:'취소'}[s]
                }</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">설명</label>
            <textarea id="ledit-description" rows="3"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">${escHtml(ls.description ?? '')}</textarea>
          </div>
        </div>
        <button onclick="submitEditLesson(${ls.id})"
          class="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
          <i class="fas fa-save mr-1"></i>저장
        </button>
      </div>

      <!-- 탭 3: 수강자 -->
      <div id="lpanel-students" class="hidden">
        ${regs.length === 0
          ? `<div class="py-8 text-center text-gray-400 text-sm">수강자가 없습니다.</div>`
          : `<div class="space-y-2 max-h-64 overflow-y-auto">
              ${regs.map(r => `
                <div class="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p class="text-sm font-medium text-gray-900">${escHtml(r.name ?? '-')}</p>
                    <p class="text-xs text-gray-500">${escHtml(r.email ?? '-')}</p>
                  </div>
                  <span class="px-2 py-0.5 text-xs rounded-full ${r.status === 'confirmed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'}">
                    ${r.status === 'confirmed' ? '확정' : '취소'}
                  </span>
                </div>
              `).join('')}
            </div>`}
      </div>
    `;
  } catch (err) {
    modal.querySelector('.bg-white').innerHTML = `<div class="text-center text-red-500 py-8 p-5">레슨 정보를 불러오지 못했습니다.</div>`;
  }
}

function switchLessonTab(tab) {
  ['info', 'edit', 'students'].forEach(t => {
    const btn   = document.getElementById(`ltab-${t}`);
    const panel = document.getElementById(`lpanel-${t}`);
    if (!btn || !panel) return;
    const active = t === tab;
    btn.className   = `px-4 py-2 text-sm font-medium border-b-2 transition ${
      active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;
    panel.classList.toggle('hidden', !active);
  });
}

async function submitEditLesson(lessonId) {
  const title       = document.getElementById('ledit-title')?.value?.trim();
  const description = document.getElementById('ledit-description')?.value?.trim();
  const location    = document.getElementById('ledit-location')?.value?.trim();
  const scheduledAt = document.getElementById('ledit-scheduled-at')?.value;
  const duration    = document.getElementById('ledit-duration')?.value;
  const capacity    = document.getElementById('ledit-capacity')?.value;
  const status      = document.getElementById('ledit-status')?.value;

  if (!title) { showToast('레슨명을 입력하세요.', 'error'); return; }

  const payload = { title, status };
  if (description !== undefined) payload.description = description || null;
  if (location)    payload.location    = location;
  if (scheduledAt) payload.scheduled_at = scheduledAt.replace('T', ' ') + ':00';
  if (duration)    payload.duration_minutes = Number(duration);
  payload.capacity = capacity ? Number(capacity) : null;

  try {
    await axios.patch(`/admin/lessons/${lessonId}`, payload);
    showToast('레슨이 수정되었습니다.', 'success');
    document.getElementById('lesson-detail-modal')?.remove();
    loadLessons(1, _lessonsStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '수정에 실패했습니다.', 'error');
  }
}

async function cancelLesson(lessonId, currentStatus = 'all', fromModal = false) {
  if (!confirm('이 레슨을 취소하시겠습니까? 수강자에게 영향이 있을 수 있습니다.')) return;
  try {
    await axios.patch(`/admin/lessons/${lessonId}`, { status: 'cancelled' });
    showToast('레슨이 취소되었습니다.', 'success');
    if (fromModal) document.getElementById('lesson-detail-modal')?.remove();
    loadLessons(1, currentStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '취소에 실패했습니다.', 'error');
  }
}

// 레슨 생성 모달
function openCreateLessonModal() {
  document.getElementById('lesson-create-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'lesson-create-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mt-8 mb-4 p-5">
    <div class="flex items-center gap-2 mb-4">
      <i class="fas fa-plus-circle text-indigo-500"></i>
      <span class="text-lg font-bold text-gray-800">레슨 생성</span>
    </div>
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">그룹 ID <span class="text-red-500">*</span></label>
          <input id="lcreate-group-id" type="number" min="1" placeholder="예: 1"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">강사 유저 ID <span class="text-red-500">*</span></label>
          <input id="lcreate-instructor-id" type="number" min="1" placeholder="예: 9002"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">레슨명 <span class="text-red-500">*</span></label>
        <input id="lcreate-title" type="text" placeholder="예: 골프 스윙 기초"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">일시 <span class="text-red-500">*</span></label>
          <input id="lcreate-scheduled-at" type="datetime-local"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">진행시간(분)</label>
          <input id="lcreate-duration" type="number" min="10" value="60"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">장소</label>
          <input id="lcreate-location" type="text" placeholder="선택사항"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">정원</label>
          <input id="lcreate-capacity" type="number" min="1" placeholder="비워두면 무제한"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">설명</label>
        <textarea id="lcreate-description" rows="2" placeholder="선택사항"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm"></textarea>
      </div>
    </div>
    <div class="mt-4 flex gap-2">
      <button onclick="document.getElementById('lesson-create-modal')?.remove()"
        class="flex-1 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition">취소</button>
      <button onclick="submitCreateLesson()"
        class="flex-1 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
        생성
      </button>
    </div>
  </div>`;
}

async function submitCreateLesson() {
  const groupId      = Number(document.getElementById('lcreate-group-id')?.value);
  const instructorId = Number(document.getElementById('lcreate-instructor-id')?.value);
  const title        = document.getElementById('lcreate-title')?.value?.trim();
  const scheduledAt  = document.getElementById('lcreate-scheduled-at')?.value;
  const duration     = Number(document.getElementById('lcreate-duration')?.value) || 60;
  const location     = document.getElementById('lcreate-location')?.value?.trim();
  const capacity     = document.getElementById('lcreate-capacity')?.value;
  const description  = document.getElementById('lcreate-description')?.value?.trim();

  if (!groupId)      { showToast('그룹 ID를 입력하세요.', 'error'); return; }
  if (!instructorId) { showToast('강사 유저 ID를 입력하세요.', 'error'); return; }
  if (!title)        { showToast('레슨명을 입력하세요.', 'error'); return; }
  if (!scheduledAt)  { showToast('일시를 선택하세요.', 'error'); return; }

  const payload = {
    group_id: groupId,
    instructor_id: instructorId,
    title,
    scheduled_at: scheduledAt.replace('T', ' ') + ':00',
    duration_minutes: duration,
    point_cost: 0,
  };
  if (location)    payload.location    = location;
  if (capacity)    payload.capacity    = Number(capacity);
  if (description) payload.description = description;

  try {
    await axios.post('/admin/lessons', payload);
    showToast('레슨이 생성되었습니다.', 'success');
    document.getElementById('lesson-create-modal')?.remove();
    loadLessons(1, _lessonsStatus);
  } catch (err) {
    showToast(err?.response?.data?.message || '생성에 실패했습니다.', 'error');
  }
}

function lessonStatusBadge(status) {
  const map = {
    upcoming  : 'bg-blue-100 text-blue-700',
    ongoing   : 'bg-green-100 text-green-700',
    ended     : 'bg-gray-100 text-gray-500',
    cancelled : 'bg-red-100 text-red-500'
  };
  const labels = { upcoming: '예정', ongoing: '진행중', ended: '종료', cancelled: '취소' };
  return `<span class="px-2 py-0.5 ${map[status] || 'bg-gray-100 text-gray-500'} text-xs rounded-full font-medium">${labels[status] || status || '-'}</span>`;
}
