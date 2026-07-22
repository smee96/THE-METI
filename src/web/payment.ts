// ════════════════════════════════════════════════════════════
// 결제 리다이렉트 페이지 (토스 successUrl / failUrl)
//
// 토스 결제창 완료 후 이 페이지로 돌아와 서버 confirm API를 호출해
// 승인·포인트 지급을 마친다. (성공 판정은 confirm 응답이 기준)
// ════════════════════════════════════════════════════════════

function pageShell(body: string, script: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ELID 포인트 충전</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="stylesheet" href="/static/tailwind.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-6">
      <p class="text-sm text-gray-500 font-semibold tracking-widest">EL<span style="color:#C9A86A">I</span>D</p>
    </div>
    <div class="bg-white rounded-2xl shadow-xl p-8 text-center">${body}</div>
  </div>
  <script>${script}</script>
</body>
</html>`
}

// 성공 리다이렉트: 서버 confirm 호출 → 지급 결과 표시
export function paymentChargeSuccessHtml(): string {
  return pageShell(`
      <div id="state-loading">
        <i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
        <p class="mt-4 text-gray-600 text-sm">결제 승인 중입니다...</p>
      </div>
      <div id="state-done" class="hidden">
        <div class="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <i class="fas fa-check text-2xl text-green-500"></i>
        </div>
        <h1 class="mt-4 text-lg font-bold text-gray-800">충전 완료</h1>
        <p id="done-msg" class="mt-2 text-sm text-gray-500"></p>
        <a id="back-link" href="/app/points"
          class="mt-6 inline-block w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          포인트로 돌아가기
        </a>
      </div>
      <div id="state-error" class="hidden">
        <div class="w-14 h-14 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <i class="fas fa-times text-2xl text-red-500"></i>
        </div>
        <h1 class="mt-4 text-lg font-bold text-gray-800">승인 실패</h1>
        <p id="error-msg" class="mt-2 text-sm text-gray-500"></p>
        <a href="/app/points"
          class="mt-6 inline-block w-full py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
          포인트로 돌아가기
        </a>
      </div>`,
    `
    (async () => {
      const q = new URLSearchParams(location.search);
      const show = (id) => {
        for (const s of ['state-loading','state-done','state-error'])
          document.getElementById(s).classList.toggle('hidden', s !== id);
      };
      const failWith = (msg) => {
        document.getElementById('error-msg').textContent = msg;
        show('state-error');
      };

      const token = localStorage.getItem('meti_token');
      if (!token) { location.href = '/login'; return; }
      if (!q.get('paymentKey') || !q.get('orderId') || !q.get('amount')) {
        failWith('결제 정보가 올바르지 않습니다.'); return;
      }

      try {
        const res = await fetch('/api/v1/points/charge/orders/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            order_uid:   q.get('orderId'),
            payment_key: q.get('paymentKey'),
            amount:      Number(q.get('amount')),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) { failWith(data.error || '결제 승인에 실패했습니다.'); return; }

        const d = data.data;
        document.getElementById('done-msg').textContent =
          d.duplicate ? '이미 지급 완료된 충전입니다.'
                      : Number(d.points).toLocaleString() + 'P가 지급되었습니다.';
        if (d.owner_type === 'group') {
          document.getElementById('back-link').href = '/app/groups';
          document.getElementById('back-link').textContent = '그룹으로 돌아가기';
        }
        show('state-done');
      } catch (e) {
        failWith('네트워크 오류가 발생했습니다. 포인트 화면에서 잔액을 확인해주세요.');
      }
    })();`)
}

// 실패 리다이렉트: 토스가 넘겨준 code/message 표시
export function paymentChargeFailHtml(): string {
  return pageShell(`
      <div class="w-14 h-14 mx-auto bg-red-100 rounded-full flex items-center justify-center">
        <i class="fas fa-times text-2xl text-red-500"></i>
      </div>
      <h1 class="mt-4 text-lg font-bold text-gray-800">결제 실패</h1>
      <p id="fail-msg" class="mt-2 text-sm text-gray-500">결제가 완료되지 않았습니다.</p>
      <a href="/app/points"
        class="mt-6 inline-block w-full py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
        포인트로 돌아가기
      </a>`,
    `
    const q = new URLSearchParams(location.search);
    if (q.get('message')) document.getElementById('fail-msg').textContent = q.get('message');`)
}
