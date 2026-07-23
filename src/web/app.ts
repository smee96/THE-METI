// ── App Web UI HTML 템플릿 (사용자 / 그룹관리자) ──────

export function appLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>로그인 — ELID</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/static/brand/favicon-180.png">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
  <style>
    :root {
      --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
      --gold:#C9A86A; --gold-deep:#9A7333; --gold-soft:rgba(201,168,106,.13);
      --bg:#F4F5F8; --surface:#fff; --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
      --line:rgba(14,23,38,.08);
      --danger:#D8513C; --danger-soft:rgba(216,81,60,.10);
      --r-md:14px; --r-lg:18px; --r-card:22px;
      --font:Pretendard,-apple-system,system-ui,sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{min-height:100%;}
    body{
      font-family:var(--font);
      background:radial-gradient(110% 90% at 88% -20%,var(--navy-glow) 0%,var(--navy) 48%,var(--navy-deep) 100%);
      min-height:100vh;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:24px 16px;
    }
    /* grain overlay */
    body::before{
      content:'';position:fixed;inset:0;pointer-events:none;
      background:radial-gradient(circle at 1px 1px,rgba(255,255,255,.055) 1px,transparent 0);
      background-size:28px 28px;
      -webkit-mask-image:radial-gradient(120% 80% at 75% 30%,#000 30%,transparent 75%);
      mask-image:radial-gradient(120% 80% at 75% 30%,#000 30%,transparent 75%);
    }
    /* back link */
    .back{
      position:fixed;top:20px;left:24px;
      display:flex;align-items:center;gap:7px;
      font-size:13px;font-weight:600;color:rgba(255,255,255,.52);
      text-decoration:none;transition:color .15s;z-index:10;
    }
    .back:hover{color:rgba(255,255,255,.88);}
    .back svg{flex-shrink:0;}
    /* wrap */
    .wrap{width:100%;max-width:400px;position:relative;z-index:1;}
    /* wordmark */
    .wordmark{
      display:flex;align-items:center;gap:11px;
      justify-content:center;margin-bottom:28px;
    }
    .nfcmark{
      width:36px;height:36px;border-radius:11px;
      border:1.5px solid var(--gold);
      display:flex;align-items:center;justify-content:center;
    }
    .wm-text{font-size:20px;font-weight:800;letter-spacing:.2em;color:#fff;}
    .wm-text .i{color:var(--gold);}
    /* card */
    .card{
      background:var(--surface);
      border-radius:var(--r-card);
      padding:36px;
      box-shadow:0 2px 4px rgba(6,18,42,.28),0 20px 48px -12px rgba(6,18,42,.58);
    }
    .card-title{font-size:20px;font-weight:800;color:var(--ink);margin-bottom:6px;letter-spacing:-.02em;}
    .card-sub{font-size:14px;color:var(--mute);margin-bottom:26px;}
    /* form */
    .field{margin-bottom:16px;}
    label{display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:6px;letter-spacing:.04em;}
    .label-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
    .forgot{font-size:12px;font-weight:600;color:var(--gold-deep);text-decoration:none;}
    .forgot:hover{text-decoration:underline;}
    input[type=email],input[type=password]{
      width:100%;padding:13px 15px;
      background:var(--bg);border:1.5px solid var(--line);
      border-radius:var(--r-md);
      font-family:var(--font);font-size:15px;color:var(--ink);
      outline:none;transition:border-color .15s,box-shadow .15s,background .15s;
    }
    input::placeholder{color:var(--mute);}
    input:focus{border-color:var(--navy);background:#fff;box-shadow:0 0 0 3px rgba(11,30,64,.09);}
    /* error */
    #err{
      display:none;
      background:var(--danger-soft);border:1px solid rgba(216,81,60,.22);
      color:#B5402E;border-radius:10px;
      padding:10px 14px;font-size:13px;margin-bottom:16px;
    }
    /* btn */
    .btn{
      width:100%;padding:15px;margin-top:4px;
      background:var(--navy);color:#fff;border:none;
      border-radius:var(--r-md);
      font-family:var(--font);font-size:15px;font-weight:700;
      cursor:pointer;transition:filter .15s,transform .08s;
    }
    .btn:hover{filter:brightness(1.14);}
    .btn:active{transform:scale(0.99);}
    .btn:disabled{opacity:.55;cursor:not-allowed;}
    /* divider */
    .div{border:none;border-top:1px solid var(--line);margin:24px 0;}
    /* bottom */
    .bottom{text-align:center;font-size:14px;color:var(--mute);}
    .bottom a{color:var(--navy);font-weight:700;text-decoration:none;}
    .bottom a:hover{text-decoration:underline;}
    /* footer */
    .foot{margin-top:22px;font-size:12px;color:rgba(255,255,255,.28);text-align:center;position:relative;z-index:1;}

    @media(max-width:480px){.card{padding:28px 24px;}}
  </style>
</head>
<body>

  <a href="/" class="back">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    홈으로
  </a>

  <div class="wrap">
    <div class="wordmark">
      <span class="nfcmark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 8.5c-1 1.6-1 5.4 0 7M8.7 6.6c-1.8 2.5-1.8 8.3 0 10.8M18.5 8.5c1 1.6 1 5.4 0 7M15.3 6.6c1.8 2.5 1.8 8.3 0 10.8M12 9.5a2.5 2.5 0 0 0 0 5" stroke="#C9A86A" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="wm-text">EL<span class="i">I</span>D</span>
    </div>

    <div class="card">
      <div class="card-title">로그인</div>
      <div class="card-sub">계속하려면 계정에 로그인하세요</div>

      <div id="err"></div>

      <form id="frm">
        <div class="field">
          <label for="email">이메일</label>
          <input type="email" id="email" placeholder="example@email.com" autocomplete="email">
        </div>
        <div class="field" style="margin-bottom:8px">
          <div class="label-row">
            <label for="pw" style="margin:0">비밀번호</label>
            <a href="/app/forgot-password" class="forgot">비밀번호 찾기</a>
          </div>
          <input type="password" id="pw" placeholder="비밀번호 입력" autocomplete="current-password">
        </div>
        <button type="submit" class="btn" id="btn">로그인</button>
      </form>

      <hr class="div">
      <div class="bottom">계정이 없으신가요? <a href="/app/register">회원가입</a></div>
    </div>
  </div>

  <div class="foot">© 2026 METI</div>

  <script>
    (function() {
      const token = localStorage.getItem('meti_token');
      const user  = JSON.parse(localStorage.getItem('meti_user') || 'null');
      if (token && user) {
        window.location.href = user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
      }
    })();

    document.getElementById('frm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const pw    = document.getElementById('pw').value;
      const btn   = document.getElementById('btn');
      const err   = document.getElementById('err');

      btn.textContent = '로그인 중…'; btn.disabled = true;
      err.style.display = 'none';

      try {
        const res  = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ email, password: pw })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('meti_token',        data.data.access_token);
          localStorage.setItem('meti_refresh_token', data.data.refresh_token);
          localStorage.setItem('meti_user',          JSON.stringify(data.data.user));
          window.location.href = data.data.user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
        } else {
          err.textContent = data.error || '로그인에 실패했습니다.';
          err.style.display = 'block';
        }
      } catch {
        err.textContent = '서버 연결에 실패했습니다.';
        err.style.display = 'block';
      } finally {
        btn.textContent = '로그인'; btn.disabled = false;
      }
    });
  </script>
</body>
</html>`
}

export function appRegisterHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>회원가입 — ELID</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/static/brand/favicon-180.png">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
  <style>
    :root {
      --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
      --gold:#C9A86A; --gold-deep:#9A7333;
      --bg:#F4F5F8; --surface:#fff; --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
      --line:rgba(14,23,38,.08);
      --danger:#D8513C; --danger-soft:rgba(216,81,60,.10);
      --success:#1B9C73; --success-soft:rgba(27,156,115,.11);
      --r-md:14px; --r-lg:18px; --r-card:22px;
      --font:Pretendard,-apple-system,system-ui,sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{min-height:100%;}
    body{
      font-family:var(--font);
      background:radial-gradient(110% 90% at 88% -20%,var(--navy-glow) 0%,var(--navy) 48%,var(--navy-deep) 100%);
      min-height:100vh;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:24px 16px;
    }
    body::before{
      content:'';position:fixed;inset:0;pointer-events:none;
      background:radial-gradient(circle at 1px 1px,rgba(255,255,255,.055) 1px,transparent 0);
      background-size:28px 28px;
      -webkit-mask-image:radial-gradient(120% 80% at 75% 30%,#000 30%,transparent 75%);
      mask-image:radial-gradient(120% 80% at 75% 30%,#000 30%,transparent 75%);
    }
    .back{position:fixed;top:20px;left:24px;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:rgba(255,255,255,.52);text-decoration:none;transition:color .15s;z-index:10;}
    .back:hover{color:rgba(255,255,255,.88);}
    .wrap{width:100%;max-width:420px;position:relative;z-index:1;}
    .wordmark{display:flex;align-items:center;gap:11px;justify-content:center;margin-bottom:24px;}
    .nfcmark{width:36px;height:36px;border-radius:11px;border:1.5px solid var(--gold);display:flex;align-items:center;justify-content:center;}
    .wm-text{font-size:20px;font-weight:800;letter-spacing:.2em;color:#fff;}
    .wm-text .i{color:var(--gold);}
    .card{background:var(--surface);border-radius:var(--r-card);padding:32px 36px;box-shadow:0 2px 4px rgba(6,18,42,.28),0 20px 48px -12px rgba(6,18,42,.58);}
    .card-title{font-size:20px;font-weight:800;color:var(--ink);margin-bottom:5px;letter-spacing:-.02em;}
    .card-sub{font-size:14px;color:var(--mute);margin-bottom:22px;}
    .field{margin-bottom:14px;}
    label{display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:6px;letter-spacing:.04em;}
    input[type=text],input[type=email],input[type=password]{
      width:100%;padding:12px 15px;
      background:var(--bg);border:1.5px solid var(--line);
      border-radius:var(--r-md);
      font-family:var(--font);font-size:15px;color:var(--ink);
      outline:none;transition:border-color .15s,box-shadow .15s,background .15s;
    }
    input::placeholder{color:var(--mute);}
    input[type=text]:focus,input[type=email]:focus,input[type=password]:focus{border-color:var(--navy);background:#fff;box-shadow:0 0 0 3px rgba(11,30,64,.09);}
    .terms{background:var(--bg);border:1.5px solid var(--line);border-radius:14px;padding:14px 16px;margin:16px 0;}
    .all-row{display:flex;align-items:center;gap:9px;padding-bottom:11px;margin-bottom:11px;border-bottom:1px solid var(--line);}
    .all-row label{font-size:14px;font-weight:700;color:var(--ink);cursor:pointer;}
    .item-row{display:flex;align-items:flex-start;gap:9px;margin-bottom:7px;}
    .item-row:last-child{margin-bottom:0;}
    .item-row label{font-size:13px;color:var(--sub);cursor:pointer;line-height:1.4;}
    .item-row label .req{color:var(--danger);font-weight:700;margin-right:3px;}
    .item-row label a{color:var(--gold-deep);text-decoration:none;font-weight:600;}
    .item-row label a:hover{text-decoration:underline;}
    input[type=checkbox]{width:16px;height:16px;flex-shrink:0;margin-top:2px;accent-color:var(--navy);cursor:pointer;}
    #err{display:none;background:var(--danger-soft);border:1px solid rgba(216,81,60,.22);color:#B5402E;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px;}
    #ok{display:none;background:var(--success-soft);border:1px solid rgba(27,156,115,.22);color:#157A59;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px;}
    .btn{width:100%;padding:15px;background:var(--navy);color:#fff;border:none;border-radius:var(--r-md);font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;transition:filter .15s,transform .08s;}
    .btn:hover{filter:brightness(1.14);}
    .btn:active{transform:scale(0.99);}
    .btn:disabled{opacity:.55;cursor:not-allowed;}
    .div{border:none;border-top:1px solid var(--line);margin:22px 0;}
    .bottom{text-align:center;font-size:14px;color:var(--mute);}
    .bottom a{color:var(--navy);font-weight:700;text-decoration:none;}
    .bottom a:hover{text-decoration:underline;}
    .foot{margin-top:22px;font-size:12px;color:rgba(255,255,255,.28);text-align:center;position:relative;z-index:1;}
    @media(max-width:480px){.card{padding:28px 24px;}}
  </style>
</head>
<body>

  <a href="/login" class="back">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    로그인으로
  </a>

  <div class="wrap">
    <div class="wordmark">
      <span class="nfcmark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 8.5c-1 1.6-1 5.4 0 7M8.7 6.6c-1.8 2.5-1.8 8.3 0 10.8M18.5 8.5c1 1.6 1 5.4 0 7M15.3 6.6c1.8 2.5 1.8 8.3 0 10.8M12 9.5a2.5 2.5 0 0 0 0 5" stroke="#C9A86A" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="wm-text">EL<span class="i">I</span>D</span>
    </div>

    <div class="card">
      <div class="card-title">계정 만들기</div>
      <div class="card-sub">무료로 시작하고, 언제든 업그레이드하세요</div>

      <div id="err"></div>
      <div id="ok"></div>

      <form id="frm">
        <div class="field">
          <label for="name">이름</label>
          <input type="text" id="name" placeholder="홍길동" autocomplete="name">
        </div>
        <div class="field">
          <label for="email">이메일</label>
          <input type="email" id="email" placeholder="example@email.com" autocomplete="email">
        </div>
        <div class="field">
          <label for="pw">비밀번호</label>
          <input type="password" id="pw" placeholder="8자 이상" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="birth">생년월일</label>
          <input type="date" id="birth" autocomplete="bday">
        </div>

        <div class="terms">
          <div class="all-row">
            <input type="checkbox" id="agree-all" onchange="toggleAll(this)">
            <label for="agree-all">전체 동의</label>
          </div>
          <div class="item-row">
            <input type="checkbox" id="agree-terms" class="item" onchange="syncAll()">
            <label for="agree-terms"><span class="req">[필수]</span><a href="/terms" target="_blank">이용약관</a> 동의</label>
          </div>
          <div class="item-row">
            <input type="checkbox" id="agree-privacy" class="item" onchange="syncAll()">
            <label for="agree-privacy"><span class="req">[필수]</span><a href="/privacy" target="_blank">개인정보처리방침</a> 동의</label>
          </div>
        </div>

        <button type="submit" class="btn" id="btn">가입하기</button>
      </form>

      <hr class="div">
      <div class="bottom">이미 계정이 있으신가요? <a href="/login">로그인</a></div>
    </div>
  </div>

  <div class="foot">© 2026 METI</div>

  <script>
    function toggleAll(el) {
      document.querySelectorAll('.item').forEach(cb => cb.checked = el.checked);
    }
    function syncAll() {
      const items = document.querySelectorAll('.item');
      document.getElementById('agree-all').checked = [...items].every(cb => cb.checked);
    }

    document.getElementById('frm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const err = document.getElementById('err');
      const ok  = document.getElementById('ok');

      if (!document.getElementById('agree-terms').checked || !document.getElementById('agree-privacy').checked) {
        err.textContent = '이용약관 및 개인정보처리방침에 동의해 주세요.';
        err.style.display = 'block'; return;
      }

      const birth = document.getElementById('birth').value;
      if (!birth) {
        err.textContent = '생년월일을 입력해 주세요.';
        err.style.display = 'block'; return;
      }
      // 만 19세 미만 가입 차단 (서버에서도 재검증)
      const b = new Date(birth), now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      const m = now.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
      if (age < 19) {
        err.textContent = '만 19세 미만은 가입할 수 없습니다.';
        err.style.display = 'block'; return;
      }

      btn.textContent = '처리 중…'; btn.disabled = true;
      err.style.display = 'none'; ok.style.display = 'none';

      try {
        const res  = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            name:         document.getElementById('name').value.trim(),
            email:        document.getElementById('email').value.trim(),
            password:     document.getElementById('pw').value,
            birth_date:   birth,
            account_type: 'personal'
          })
        });
        const data = await res.json();
        if (data.success) {
          ok.textContent = '가입 완료! 로그인 페이지로 이동합니다.';
          ok.style.display = 'block';
          document.getElementById('frm').reset();
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        } else {
          err.textContent = data.error || '가입에 실패했습니다.';
          err.style.display = 'block';
        }
      } catch {
        err.textContent = '서버 연결에 실패했습니다.';
        err.style.display = 'block';
      } finally {
        btn.textContent = '가입하기'; btn.disabled = false;
      }
    });
  </script>
</body>
</html>`
}


export function appLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ELID — 명함을 넘어, 관계로</title>
<meta property="og:title" content="ELID — 명함을 넘어, 관계로" />
<meta property="og:description" content="디지털 명함 기반 종합 네트워킹 플랫폼" />
<meta property="og:image" content="https://the-meti.pages.dev/static/brand/elid-appicon-navy-512.png" />
<link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png" />
<link rel="apple-touch-icon" href="/static/brand/favicon-180.png" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
<style>
  :root{
    --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
    --gold:#C9A86A; --gold-deep:#9A7333; --gold-soft:rgba(201,168,106,.13);
    --mint:oklch(0.74 0.095 168); --coral:oklch(0.72 0.12 33); --violet:oklch(0.66 0.13 290);
    --bg:#F4F5F8; --surface:#FFFFFF; --surface2:#F7F8FA; --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
    --line:rgba(14,23,38,0.09); --font:Pretendard,-apple-system,system-ui,sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{overflow-x:hidden;}
  html{scroll-behavior:smooth;}
  body{margin:0;font-family:var(--font);background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;word-break:keep-all;line-break:strict;}
  a{color:inherit;text-decoration:none;}
  .word{font-weight:800;letter-spacing:0.2em;display:inline-flex;}
  .word .i{color:var(--gold);}
  .wrap{max-width:1160px;margin:0 auto;padding:0 32px;}
  .nfcmark{border-radius:11px;border:1.5px solid var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  section{position:relative;}
  h2.sec{font-size:34px;font-weight:800;letter-spacing:-0.025em;margin:0;text-wrap:balance;}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.05em;color:var(--gold-deep);
    background:var(--gold-soft);padding:7px 14px;border-radius:100px;white-space:nowrap;text-transform:uppercase;}
  .lead{font-size:17px;line-height:1.65;color:var(--sub);}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;font-family:var(--font);font-weight:700;border-radius:13px;white-space:nowrap;transition:filter .15s,transform .05s,background .15s;}
  .btn-nav{background:var(--navy);color:#fff;height:44px;padding:0 20px;font-size:14.5px;}
  .btn-nav:hover{filter:brightness(1.14);}
  .btn-ghost{background:transparent;color:var(--ink);height:44px;padding:0 16px;font-size:14.5px;}
  .btn-lg{height:54px;padding:0 26px;font-size:16px;}
  .btn-gold{background:var(--gold);color:#3a2c10;}
  .btn-gold:hover{filter:brightness(1.06);}
  .btn-light{background:#fff;color:var(--navy);}
  .btn-outline-d{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.22);}
  .btn-outline-d:hover{background:rgba(255,255,255,.14);}

  /* ── Nav ── */
  .nav{position:sticky;top:0;z-index:50;background:rgba(244,245,248,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line);}
  .nav .inner{display:flex;align-items:center;gap:28px;height:68px;}
  .nav .links{display:flex;gap:26px;margin-left:14px;flex-shrink:0;}
  .nav .links a{font-size:15px;font-weight:600;color:var(--sub);white-space:nowrap;}
  .nav .links a:hover{color:var(--ink);}
  .nav .sp{flex:1;}
  .nav .auth{display:flex;align-items:center;gap:8px;flex-shrink:0;}

  /* ── Hero ── */
  .hero{overflow:hidden;color:#fff;background:radial-gradient(110% 90% at 88% -20%,var(--navy-glow) 0%,var(--navy) 48%,var(--navy-deep) 100%);}
  .hero .inner{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center;padding-top:84px;padding-bottom:92px;position:relative;z-index:2;}
  .blob{position:absolute;border-radius:50%;filter:blur(76px);pointer-events:none;z-index:1;}
  .b-gold{width:420px;height:420px;background:rgba(201,168,106,.30);top:-120px;right:-60px;}
  .b-mint{width:300px;height:300px;background:color-mix(in oklch,var(--mint),transparent 66%);bottom:-80px;left:6%;}
  .b-violet{width:260px;height:260px;background:color-mix(in oklch,var(--violet),transparent 72%);top:30%;right:30%;}
  .grain{position:absolute;inset:0;opacity:.5;pointer-events:none;z-index:1;background:radial-gradient(circle at 1px 1px,rgba(255,255,255,.09) 1px,transparent 0);background-size:28px 28px;
    -webkit-mask-image:radial-gradient(120% 80% at 75% 30%,#000 35%,transparent 78%);mask-image:radial-gradient(120% 80% at 75% 30%,#000 35%,transparent 78%);}
  h1.hh{font-size:52px;line-height:1.1;font-weight:800;letter-spacing:-0.03em;margin:22px 0 0;text-wrap:balance;}
  h1.hh .ac{color:var(--gold);}
  .hero .sub{font-size:18px;line-height:1.6;color:rgba(255,255,255,.68);margin:22px 0 0;max-width:480px;}
  .hero .cta{display:flex;gap:12px;margin-top:34px;flex-wrap:wrap;}
  .hero .meta{display:flex;gap:26px;margin-top:34px;flex-wrap:wrap;}
  .hero .meta>div{flex-shrink:0;}
  .hero .meta .n{font-size:26px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;}
  .hero .meta .l{font-size:13px;color:rgba(255,255,255,.55);font-weight:600;margin-top:2px;white-space:nowrap;}

  /* hero photo */
  .hero-photo{position:relative;animation:flt 7s ease-in-out infinite;}
  .hero-photo img{width:100%;height:auto;display:block;border-radius:24px;
    border:1px solid rgba(201,168,106,.32);
    box-shadow:0 2px 6px rgba(6,18,42,.3),0 40px 80px -24px rgba(6,18,42,.85);}
  @keyframes flt{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
  @media (prefers-reduced-motion:reduce){.hero-photo{animation:none;}}

  /* ── Features ── */
  .pad-sec{padding:92px 0;}
  .center{text-align:center;max-width:680px;margin:0 auto;}
  .feat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:48px;}
  .fcard{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:26px 22px;box-shadow:0 1px 2px rgba(14,23,38,.03),0 14px 30px -22px rgba(14,23,38,.25);}
  .fic{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;}
  .fcard h3{font-size:18px;font-weight:700;margin:0 0 8px;letter-spacing:-.01em;}
  .fcard p{font-size:14.5px;line-height:1.6;color:var(--sub);margin:0;}

  /* ── 충전 ── */
  .recharge{background:var(--surface);}
  .recharge .inner{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;padding-top:92px;padding-bottom:92px;}
  .uselist{display:flex;flex-direction:column;gap:14px;margin-top:28px;}
  .use{display:flex;align-items:flex-start;gap:14px;}
  .use .d{width:34px;height:34px;border-radius:10px;background:var(--gold-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .use b{font-size:15.5px;font-weight:700;}
  .use p{margin:3px 0 0;font-size:14px;color:var(--sub);line-height:1.5;}
  .charge-card{background:linear-gradient(180deg,#fff,#FBFBFD);border:1px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 2px 6px rgba(14,23,38,.05),0 30px 60px -28px rgba(14,23,38,.35);}
  .charge-card .top{display:flex;align-items:center;justify-content:space-between;}
  .balance{font-size:13px;color:var(--mute);font-weight:600;}
  .balance b{display:block;font-size:26px;color:var(--ink);font-weight:800;letter-spacing:-.02em;margin-top:3px;font-variant-numeric:tabular-nums;}
  .amts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0 18px;}
  .amt{position:relative;border:1.5px solid var(--line);border-radius:14px;padding:14px 16px;cursor:pointer;transition:border-color .15s,background .15s;background:#fff;}
  .amt.on{border-color:var(--navy);background:#fff;box-shadow:0 0 0 3px rgba(11,30,64,.08);}
  .amt .v{font-size:18px;font-weight:800;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}
  .amt .b{font-size:12px;font-weight:700;color:var(--gold-deep);margin-top:3px;}
  .amt .best{position:absolute;top:-9px;right:10px;font-size:10.5px;font-weight:800;color:#3a2c10;background:var(--gold);padding:2px 8px;border-radius:100px;}
  .pay{display:flex;align-items:center;justify-content:space-between;padding:16px 4px;border-top:1px solid var(--line);}
  .pay .t{font-size:14px;color:var(--sub);font-weight:600;}
  .pay .tot{font-size:22px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}
  .pay .tot small{font-size:13px;color:var(--gold-deep);font-weight:700;margin-left:6px;}

  /* ── Pricing ── */
  .price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px;}
  .plan{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:30px 28px;display:flex;flex-direction:column;}
  .plan.hot{background:linear-gradient(180deg,#0B1E40,#06122A);color:#fff;border:none;position:relative;box-shadow:0 30px 60px -26px rgba(6,18,42,.6);}
  .plan .pn{font-size:15px;font-weight:800;letter-spacing:.02em;}
  .plan.hot .pn{color:var(--gold);}
  .plan .pp{font-size:38px;font-weight:800;letter-spacing:-.03em;margin:14px 0 2px;font-variant-numeric:tabular-nums;}
  .plan .pp small{font-size:15px;font-weight:600;color:var(--mute);}
  .plan.hot .pp small{color:rgba(255,255,255,.55);}
  .plan .pd{font-size:14px;color:var(--sub);margin:0 0 22px;}
  .plan.hot .pd{color:rgba(255,255,255,.6);}
  .plan ul{list-style:none;padding:0;margin:0 0 26px;display:flex;flex-direction:column;gap:12px;flex:1;}
  .plan li{display:flex;align-items:flex-start;gap:10px;font-size:14.5px;color:var(--ink);}
  .plan.hot li{color:rgba(255,255,255,.85);}
  .plan .tag{position:absolute;top:20px;right:24px;font-size:11.5px;font-weight:800;color:#3a2c10;background:var(--gold);padding:4px 10px;border-radius:100px;}

  /* ── CTA + footer ── */
  .ctaband{margin:0 0 0;overflow:hidden;color:#fff;background:radial-gradient(120% 160% at 80% -40%,var(--navy-glow),var(--navy) 50%,var(--navy-deep));}
  .ctaband .inner{text-align:center;padding-top:80px;padding-bottom:80px;position:relative;z-index:2;}
  footer{background:#06122A;color:rgba(255,255,255,.6);}
  footer .inner{display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap;padding:48px 0 40px;}
  footer .cols{display:flex;gap:64px;flex-wrap:wrap;}
  footer h4{font-size:13px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:0 0 14px;}
  footer a{display:block;font-size:14px;margin-bottom:10px;color:rgba(255,255,255,.62);}
  footer a:hover{color:#fff;}
  .copy{border-top:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.4);padding:20px 0;}

  @media (max-width:920px){
    .nav .links{display:none;}
    .hero .inner{grid-template-columns:1fr;padding-top:56px;padding-bottom:64px;}
    .hero-photo{max-width:480px;margin:14px auto 0;}
    h1.hh{font-size:38px;}
    .feat-grid{grid-template-columns:1fr 1fr;}
    .recharge .inner{grid-template-columns:1fr;gap:36px;padding-top:64px;padding-bottom:64px;}
    .price-grid{grid-template-columns:1fr;}
    .pad-sec{padding:64px 0;}
  }
  @media (max-width:560px){
    .nav .btn-nav{display:none;}
    .wrap{padding:0 20px;}
    .feat-grid{grid-template-columns:1fr;}
    .hero .meta{gap:18px;}
    h1.hh{font-size:32px;}
    h2.sec{font-size:26px;}
    .hero .sub{font-size:16px;}
    .ctaband .inner{padding-top:60px;padding-bottom:60px;}
    footer .cols{gap:32px;}
    .plan{padding:24px 20px;}
  }
</style>
</head>
<body>

<!-- NAV -->
<div class="nav">
  <div class="wrap inner">
    <a href="/" style="display:flex;align-items:center;gap:11px;">
      <span class="nfcmark" style="width:36px;height:36px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5.5 8.5c-1 1.6-1 5.4 0 7M8.7 6.6c-1.8 2.5-1.8 8.3 0 10.8M18.5 8.5c1 1.6 1 5.4 0 7M15.3 6.6c1.8 2.5 1.8 8.3 0 10.8M12 9.5a2.5 2.5 0 0 0 0 5" stroke="#C9A86A" stroke-width="1.6" stroke-linecap="round"/></svg>
      </span>
      <span class="word" style="font-size:19px;color:var(--navy);">EL<span class="i">I</span>D</span>
    </a>
    <nav class="links">
      <a href="#features">기능</a>
      <a href="#charge">충전</a>
      <a href="#pricing">요금제</a>
      <a href="#faq">도움말</a>
    </nav>
    <div class="sp"></div>
    <div class="auth">
      <a class="btn btn-ghost" href="/login">로그인</a>
      <a class="btn btn-nav" href="/login">무료로 시작하기</a>
    </div>
  </div>
</div>

<!-- HERO -->
<section class="hero" id="top">
  <div class="blob b-gold"></div><div class="blob b-mint"></div><div class="blob b-violet"></div>
  <div class="grain"></div>
  <div class="wrap inner">
    <div>
      <span class="eyebrow" style="color:var(--gold);background:rgba(201,168,106,.12);border:1px solid rgba(201,168,106,.3);"><span style="width:6px;height:6px;border-radius:6px;background:var(--gold);"></span> 디지털 명함 네트워킹 플랫폼</span>
      <h1 class="hh">명함을 넘어,<br /><span class="ac">관계</span>로 이어지다.</h1>
      <p class="sub">NFC 한 번으로 주고받고, 그룹·행사·채팅·리워드까지 한곳에서. 포인트를 충전해 더 빠르게 연결되세요.</p>
      <div class="cta">
        <a class="btn btn-lg btn-gold" href="/login">무료로 시작하기</a>
        <a class="btn btn-lg btn-outline-d" href="#charge">충전 알아보기 →</a>
      </div>
      <div class="meta">
        <div><div class="n">24,580+</div><div class="l">활성 회원</div></div>
        <div><div class="n">182만</div><div class="l">교환된 명함</div></div>
        <div><div class="n">18</div><div class="l">연동 파트너</div></div>
      </div>
    </div>
    <div class="hero-photo">
      <img src="/static/brand/hero-people.jpg" width="820" height="990"
           alt="ELID로 연결되는 비즈니스 미팅" loading="eager" decoding="async" />
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="pad-sec" id="features">
  <div class="wrap">
    <div class="center">
      <span class="eyebrow">기능</span>
      <h2 class="sec" style="margin-top:18px;">비즈니스 인맥, 한 앱에서 완성</h2>
      <p class="lead" style="margin-top:14px;">교환부터 관리, 커뮤니티와 리워드까지 — 흩어진 명함 관리를 하나의 우아한 흐름으로.</p>
    </div>
    <div class="feat-grid">
      <div class="fcard">
        <div class="fic" style="background:var(--gold-soft);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5.5 8.5c-1 1.6-1 5.4 0 7M8.7 6.6c-1.8 2.5-1.8 8.3 0 10.8M18.5 8.5c1 1.6 1 5.4 0 7M15.3 6.6c1.8 2.5 1.8 8.3 0 10.8M12 9.5a2.5 2.5 0 0 0 0 5" stroke="#9A7333" stroke-width="1.7" stroke-linecap="round"/></svg></div>
        <h3>NFC·QR 즉시 교환</h3>
        <p>기기를 맞대거나 QR을 스캔해 명함을 안전하게 주고받습니다. 앱이 없어도 링크로 공유.</p>
      </div>
      <div class="fcard">
        <div class="fic" style="background:color-mix(in oklch,var(--mint),transparent 86%);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5zM13.5 9h3.5M13.5 12h3.5M10.5 10a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0zM6.5 16.2c.5-1.6 4.5-1.6 5 0" stroke="oklch(0.5 0.09 168)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3>스마트 명함첩</h3>
        <p>받은 명함을 태그·그룹·만난 행사별로 자동 정리. 검색과 즐겨찾기로 빠르게 다시 연결.</p>
      </div>
      <div class="fcard">
        <div class="fic" style="background:color-mix(in oklch,var(--violet),transparent 86%);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.6-3.2 4-4.5 5.5-4.5S13.9 15.8 14.5 19M16 11.2a2.6 2.6 0 0 0 0-5.2M17.5 14.6c2 .5 3.4 1.9 3.8 4.4" stroke="oklch(0.5 0.13 290)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3>그룹 · 행사</h3>
        <p>관심사 기반 그룹을 운영하고, 행사를 열어 QR로 입장 처리. 커뮤니티가 곧 인맥이 됩니다.</p>
      </div>
      <div class="fcard">
        <div class="fic" style="background:color-mix(in oklch,var(--coral),transparent 86%);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11h16v8.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5zM3 8h18v3H3zM12 8V21" stroke="oklch(0.5 0.12 33)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3>리워드 · 충전</h3>
        <p>파트너 연동으로 포인트를 적립하고, 웹에서 충전해 실물 NFC 카드·프리미엄 기능에 사용.</p>
      </div>
    </div>
  </div>
</section>

<!-- 충전 -->
<section class="recharge" id="charge">
  <div class="wrap inner">
    <div>
      <span class="eyebrow">충전 · 크레딧</span>
      <h2 class="sec" style="margin-top:18px;">필요한 만큼,<br />웹에서 바로 충전</h2>
      <p class="lead" style="margin-top:16px;max-width:440px;">충전한 크레딧으로 리워드 사용, 실물 명함 발급, 리크루팅·프리미엄 기능까지. 결제는 안전하게, 사용은 자유롭게.</p>
      <div class="uselist">
        <div class="use"><span class="d"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 11h16v8.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5zM3 8h18v3H3z" stroke="#9A7333" stroke-width="1.7" stroke-linejoin="round"/></svg></span><div><b>리워드 포인트</b><p>파트너 서비스에서 적립·사용하는 포인트 충전</p></div></div>
        <div class="use"><span class="d"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5zM3 10.5h18" stroke="#9A7333" stroke-width="1.7" stroke-linejoin="round"/></svg></span><div><b>실물 NFC 카드 발급</b><p>메탈·우드 등 프리미엄 실물 명함 제작 결제</p></div></div>
        <div class="use"><span class="d"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3z" stroke="#9A7333" stroke-width="1.7" stroke-linejoin="round"/></svg></span><div><b>프리미엄 · 리크루팅</b><p>Pro 기능, 채용공고·헤드헌터 크레딧에 사용</p></div></div>
      </div>
    </div>

    <div class="charge-card">
      <div class="top">
        <div class="balance">보유 크레딧 <b>₩32,500</b></div>
        <span class="nfcmark" style="width:40px;height:40px;border-color:var(--gold-soft);background:var(--gold-soft);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H18a1.5 1.5 0 0 1 1.5 1.5V9H5.5M4 8.5v9A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-8M16 13.5h.01" stroke="#9A7333" stroke-width="1.7" stroke-linejoin="round"/></svg></span>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--sub);margin-top:20px;">충전 금액 선택</div>
      <div class="amts" id="amts">
        <div class="amt" data-amt="10000" data-bonus="0"><div class="v">₩10,000</div><div class="b">기본</div></div>
        <div class="amt" data-amt="30000" data-bonus="1500"><div class="v">₩30,000</div><div class="b">+1,500P 보너스</div></div>
        <div class="amt on" data-amt="50000" data-bonus="3500"><span class="best">BEST</span><div class="v">₩50,000</div><div class="b">+3,500P 보너스</div></div>
        <div class="amt" data-amt="100000" data-bonus="10000"><div class="v">₩100,000</div><div class="b">+10,000P 보너스</div></div>
      </div>
      <div class="pay">
        <span class="t">결제 금액 · 신용/체크카드</span>
        <span class="tot" id="tot">₩50,000 <small id="bon">+3,500P</small></span>
      </div>
      <button class="btn btn-lg btn-nav" style="width:100%;margin-top:8px;" onclick="window.location.href='/login'">충전하기</button>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="pad-sec" id="pricing" style="background:var(--bg);">
  <div class="wrap">
    <div class="center">
      <span class="eyebrow">요금제</span>
      <h2 class="sec" style="margin-top:18px;">팀 규모에 맞게 시작하세요</h2>
      <p class="lead" style="margin-top:14px;">개인은 무료로, 팀과 기업은 더 강력하게. 충전 크레딧은 모든 플랜에서 사용 가능합니다.</p>
    </div>
    <div class="price-grid">
      <div class="plan">
        <div class="pn" style="color:var(--sub);">FREE</div>
        <div class="pp">₩0<small> /월</small></div>
        <p class="pd">개인 네트워킹의 시작</p>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 디지털 명함 1개</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> NFC·QR 교환 무제한</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 명함첩 · 그룹 참여</li>
        </ul>
        <a class="btn btn-lg btn-light" style="border:1px solid var(--line);" href="/login">무료로 시작</a>
      </div>
      <div class="plan hot">
        <span class="tag">인기</span>
        <div class="pn">PRO</div>
        <div class="pp">₩9,900<small> /월</small></div>
        <p class="pd">전문가를 위한 모든 것</p>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#C9A86A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 명함 무제한 + 맞춤 마감</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#C9A86A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 그룹 개설 · 행사 주최</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#C9A86A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 리워드 적립 2배 · 충전 보너스</li>
        </ul>
        <a class="btn btn-lg btn-gold" href="/login">Pro 시작하기</a>
      </div>
      <div class="plan">
        <div class="pn" style="color:var(--sub);">BUSINESS</div>
        <div class="pp">맞춤<small> 견적</small></div>
        <p class="pd">조직을 위한 통합 관리</p>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 팀 명함 · 브랜드 통일</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 어드민 콘솔 · 통계</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#1B9C73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 파트너 API · 전담 지원</li>
        </ul>
        <a class="btn btn-lg btn-light" style="border:1px solid var(--line);" href="mailto:hello@meti.io">문의하기</a>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="ctaband">
  <div class="blob b-gold" style="opacity:.5;"></div>
  <div class="wrap inner">
    <span class="eyebrow" style="color:var(--gold);background:rgba(201,168,106,.12);border:1px solid rgba(201,168,106,.3);">지금 시작하기</span>
    <h2 class="sec" style="color:#fff;margin-top:18px;font-size:40px;">첫 명함 교환까지, 1분이면 충분합니다</h2>
    <p class="lead" style="color:rgba(255,255,255,.66);margin:16px auto 0;max-width:520px;">이메일만으로 가입하고, 나만의 프리미엄 디지털 명함을 만들어보세요.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:30px;flex-wrap:wrap;">
      <a class="btn btn-lg btn-gold" href="/login">무료로 시작하기</a>
      <a class="btn btn-lg btn-outline-d" href="#features">기능 둘러보기</a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer id="faq">
  <div class="wrap">
    <div class="inner">
      <div style="max-width:260px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span class="nfcmark" style="width:32px;height:32px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5.5 8.5c-1 1.6-1 5.4 0 7M8.7 6.6c-1.8 2.5-1.8 8.3 0 10.8M18.5 8.5c1 1.6 1 5.4 0 7M15.3 6.6c1.8 2.5 1.8 8.3 0 10.8M12 9.5a2.5 2.5 0 0 0 0 5" stroke="#C9A86A" stroke-width="1.6" stroke-linecap="round"/></svg></span>
          <span class="word" style="font-size:18px;color:#fff;">EL<span class="i">I</span>D</span>
          <span style="font-size:11px;color:rgba(255,255,255,.42);font-weight:600;letter-spacing:.04em;">by METI</span>
        </div>
        <p style="font-size:13.5px;line-height:1.6;color:rgba(255,255,255,.5);margin:0;">디지털 명함 기반 종합 네트워킹 플랫폼. 명함을 넘어, 관계로.</p>
      </div>
      <div class="cols">
        <div><h4>제품</h4><a href="#features">기능</a><a href="#charge">충전</a><a href="#pricing">요금제</a><a href="/login">로그인</a></div>
        <div><h4>회사</h4><a href="#">소개</a><a href="#">파트너</a><a href="#">채용</a></div>
        <div><h4>지원</h4><a href="#">도움말</a><a href="mailto:hello@meti.io">문의하기</a><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a></div>
      </div>
    </div>
    <div class="copy">ELID by METI · © 2026 METI. All rights reserved.</div>
  </div>
</footer>

<script>
  (function(){
    var amts = document.getElementById('amts');
    var tot  = document.getElementById('tot');
    var bon  = document.getElementById('bon');
    var fmt  = function(n){ return '₩' + n.toLocaleString(); };
    amts.addEventListener('click', function(e){
      var el = e.target.closest('.amt');
      if(!el) return;
      amts.querySelectorAll('.amt').forEach(function(a){ a.classList.remove('on'); });
      el.classList.add('on');
      var amt = +el.dataset.amt, b = +el.dataset.bonus;
      tot.firstChild.textContent = fmt(amt) + ' ';
      bon.textContent = b ? '+' + b.toLocaleString() + 'P' : '';
    });
  })();
</script>
</body>
</html>`
}

export function appShellHtml(pageTitle: string = 'ELID'): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/static/brand/favicon-180.png">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/static/tailwind.css">
  <!-- 앱 셸 전용 타입 스케일 (기존 Play CDN tailwind.config와 동일 px값 유지 — 레이아웃 오버플로 방지) -->
  <style>
    .text-xs{font-size:11px}.text-sm{font-size:12px}.text-base{font-size:13px}
    .text-lg{font-size:14px}.text-xl{font-size:15px}.text-2xl{font-size:16px}.text-3xl{font-size:18px}
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    /* ── ELID Design Tokens ─────────────────────────── */
    :root {
      --navy:#0B1E40; --navy-deep:#06122A; --navy-glow:#1C3D72;
      --gold:#C9A86A; --gold-deep:#9A7333; --gold-soft:rgba(201,168,106,0.16);
      --bg:#F4F5F8; --surface:#FFFFFF; --surface-2:#F7F8FA;
      --ink:#0E1726; --sub:#5B6577; --mute:#8B95A6;
      --line:rgba(14,23,38,0.08); --line-2:rgba(14,23,38,0.05);
      --success:#1B9C73; --success-soft:rgba(27,156,115,0.12);
      --danger:#D8513C;  --danger-soft:rgba(216,81,60,0.12);
      --warn:#C98A1E;    --warn-soft:rgba(201,138,30,0.13);
      --info:#3470C4;    --info-soft:rgba(52,112,196,0.12);
      --font:Pretendard,-apple-system,system-ui,sans-serif;
      --r-md:14px; --r-lg:18px; --r-card:22px;
      --shadow-card:0 1px 2px rgba(14,23,38,.04),0 8px 24px rgba(14,23,38,.06);
    }

    /* ── Base ──────────────────────────────────────── */
    html, body { font-size:13px; font-family:var(--font) !important; background:var(--bg) !important; }

    /* ── 사이드바 ───────────────────────────────────── */
    #sidebar { transition:transform 0.25s ease; }
    @media (max-width: 768px) {
      #sidebar { transform:translateX(-100%); position:fixed; z-index:50; height:100vh; }
      #sidebar.open { transform:translateX(0); }
      #sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:40; }
      #sidebar-overlay.open { display:block; }
    }

    /* ── Nav 아이템 ────────────────────────────────── */
    .nav-item {
      display:flex; align-items:center; gap:0.75rem;
      padding:9px 12px; border-radius:10px;
      color:rgba(255,255,255,0.48); cursor:pointer; transition:all 0.15s;
      font-size:13px; font-family:var(--font); font-weight:500;
    }
    .nav-item:hover { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.88); }
    .nav-item.active { background:var(--gold-soft); color:var(--gold); font-weight:700; }
    .nav-item i { width:1.1rem; text-align:center; }

    /* ── 컨텍스트 배지 ─────────────────────────────── */
    .ctx-badge { font-size:0.75rem; padding:0.15rem 0.6rem; border-radius:9999px; font-weight:700; }

    /* ── 섹션 ──────────────────────────────────────── */
    .page-section { display:none; }
    .page-section.active { display:block; }

    /* ── 카드 ──────────────────────────────────────── */
    .stat-card { background:var(--surface); border-radius:var(--r-lg); padding:1.25rem 1.5rem; box-shadow:var(--shadow-card); border:1px solid var(--line-2); }
    .item-card  { background:var(--surface); border-radius:var(--r-md); padding:1rem 1.25rem; box-shadow:0 1px 3px rgba(14,23,38,.05); margin-bottom:0.75rem; border:1px solid var(--line-2); }

    /* ── 콘텐츠 내 파란색 → ELID 네이비 오버라이드 ── */
    .bg-blue-600  { background-color:var(--navy)      !important; }
    .bg-blue-500  { background-color:var(--navy)      !important; }
    .hover\\:bg-blue-700:hover { background-color:var(--navy-deep) !important; }
    .hover\\:bg-blue-600:hover { background-color:var(--navy-deep) !important; }
    .text-blue-600, .text-blue-700 { color:var(--navy) !important; }
    .hover\\:text-blue-600:hover   { color:var(--navy) !important; }
    .border-blue-600 { border-color:var(--navy) !important; }
    .border-blue-500 { border-color:var(--navy) !important; }
    .bg-blue-100     { background-color:rgba(11,30,64,0.07) !important; }
    .bg-blue-50      { background-color:rgba(11,30,64,0.04) !important; }
    .hover\\:bg-blue-50:hover { background-color:rgba(11,30,64,0.05) !important; }
    .border-blue-300 { border-color:rgba(11,30,64,0.22) !important; }
    .hover\\:border-blue-300:hover { border-color:rgba(11,30,64,0.3) !important; }
    .text-blue-400   { color:var(--gold)    !important; }
    .text-blue-500   { color:var(--navy)    !important; }
  </style>
</head>
<body class="min-h-screen" style="background:var(--bg);font-family:var(--font)">

<!-- 모바일 오버레이 -->
<div id="sidebar-overlay" onclick="closeSidebar()"></div>

<!-- 레이아웃 -->
<div class="flex min-h-screen">

  <!-- ── 사이드바 ── -->
  <aside id="sidebar" class="w-64 text-white flex flex-col flex-shrink-0"
    style="background:var(--navy)">

    <!-- 로고 -->
    <div class="flex items-center gap-3 px-5 py-5" style="border-bottom:1px solid rgba(255,255,255,0.08)">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style="background:rgba(255,255,255,0.10)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold)">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      </div>
      <span class="font-bold text-lg tracking-widest" style="letter-spacing:0.18em">EL<span style="color:var(--gold)">I</span>D</span>
    </div>

    <!-- 컨텍스트 선택 (개인 ↔ 그룹) -->
    <div class="px-4 py-3" style="border-bottom:1px solid rgba(255,255,255,0.08)">
      <button id="ctx-btn" onclick="toggleContextMenu()"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition"
        style="background:rgba(255,255,255,0.06)">
        <div class="flex items-center gap-2 min-w-0">
          <i id="ctx-icon" class="fas fa-user text-xs flex-shrink-0" style="color:var(--gold)"></i>
          <span id="ctx-name" class="text-sm font-medium text-white truncate">내 계정</span>
        </div>
        <i class="fas fa-chevron-down text-xs flex-shrink-0 ml-1" style="color:rgba(255,255,255,0.35)"></i>
      </button>
      <!-- 드롭다운 -->
      <div id="ctx-menu" class="hidden mt-1 rounded-lg overflow-hidden"
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08)">
        <div id="ctx-menu-items"></div>
      </div>
    </div>

    <!-- 네비게이션 -->
    <nav class="flex-1 px-3 py-3 overflow-y-auto space-y-1" id="nav-menu">
      <!-- JS로 렌더링 -->
    </nav>

    <!-- 하단 사용자 정보 -->
    <div class="px-4 py-4" style="border-top:1px solid rgba(255,255,255,0.08)">
      <div class="flex items-center gap-3">
        <!-- 아바타: 클릭 → 프로필 모달 -->
        <button onclick="openProfileModal()" title="프로필 수정"
          class="relative w-9 h-9 rounded-full flex-shrink-0 group">
          <div id="sidebar-avatar-wrap" class="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
            style="background:var(--navy-glow)">
            <i id="sidebar-avatar-icon" class="fas fa-user text-white text-sm"></i>
            <img id="sidebar-avatar-img" src="" class="hidden w-9 h-9 object-cover" onerror="this.classList.add('hidden');document.getElementById('sidebar-avatar-icon').classList.remove('hidden')">
          </div>
          <div class="absolute inset-0 rounded-full bg-black/40 hidden group-hover:flex items-center justify-center">
            <i class="fas fa-camera text-white text-xs"></i>
          </div>
        </button>
        <div class="flex-1 min-w-0 cursor-pointer" onclick="openProfileModal()">
          <p id="sidebar-username" class="text-sm font-medium text-white truncate">-</p>
          <p id="sidebar-plan" class="text-xs truncate" style="color:rgba(255,255,255,0.42)">Free</p>
        </div>
        <button onclick="logout()" title="로그아웃"
          class="transition" style="color:rgba(255,255,255,0.38)" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.38)'">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- ── 메인 콘텐츠 ── -->
  <div class="flex-1 flex flex-col min-w-0">

    <!-- 헤더 -->
    <header class="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30"
      style="border-bottom:1px solid var(--line);font-family:var(--font)">
      <button onclick="openSidebar()" class="md:hidden" style="color:var(--sub)">
        <i class="fas fa-bars text-xl"></i>
      </button>
      <h2 id="page-title" class="font-semibold text-lg flex-1" style="color:var(--ink)">대시보드</h2>
      <span id="header-ctx-badge" class="ctx-badge hidden"
        style="background:var(--gold-soft);color:var(--gold-deep)"></span>
      <button onclick="showSection('notifications')" class="relative" style="color:var(--sub)">
        <i class="fas fa-bell text-xl"></i>
        <span id="notif-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">0</span>
      </button>
    </header>

    <!-- 페이지 콘텐츠 -->
    <main class="flex-1 p-4 md:p-6 overflow-auto">

      <!-- ── [개인] 대시보드 ── -->
      <section id="section-dashboard" class="page-section active">
        <div class="mb-6">
          <h3 class="text-lg font-bold" style="color:var(--ink)">안녕하세요, <span id="greeting-name">-</span>님</h3>
          <p class="mt-1" style="color:var(--sub)">오늘도 좋은 하루 되세요.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-blue-600" id="stat-cards">-</p>
            <p class="text-sm text-gray-500 mt-1">내 명함</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-green-600" id="stat-groups">-</p>
            <p class="text-sm text-gray-500 mt-1">소속 그룹</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-purple-600" id="stat-points">-</p>
            <p class="text-sm text-gray-500 mt-1">포인트 (P)</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-orange-500" id="stat-plan">-</p>
            <p class="text-sm text-gray-500 mt-1">현재 플랜</p>
          </div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="stat-card">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700">최근 명함</h4>
              <button onclick="showSection('cards')" class="text-sm text-blue-600 hover:underline">전체보기</button>
            </div>
            <div id="recent-cards">
              <p class="text-sm text-gray-400 text-center py-4">명함이 없습니다.</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700">내 그룹</h4>
              <button onclick="showSection('groups')" class="text-sm text-blue-600 hover:underline">전체보기</button>
            </div>
            <div id="recent-groups">
              <p class="text-sm text-gray-400 text-center py-4">소속된 그룹이 없습니다.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── [개인] 내 명함 ── -->
      <section id="section-cards" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">내 명함</h3>
          <button onclick="openCreateCardModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 명함 추가
          </button>
        </div>
        <div id="cards-list">
          <p class="text-sm text-gray-400 text-center py-8">명함이 없습니다.</p>
        </div>
      </section>

      <!-- ── [개인] 내 그룹 목록 ── -->
      <section id="section-groups" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">내 그룹</h3>
        <div id="groups-list">
          <p class="text-sm text-gray-400 text-center py-8">소속된 그룹이 없습니다.</p>
        </div>
      </section>

      <!-- ── [개인] 포인트 ── -->
      <section id="section-points" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">포인트</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">현재 잔액</p>
              <p class="text-2xl font-bold text-blue-600 mt-1"><span id="points-balance">-</span> P</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400 mb-2">1P = 1원</p>
              <button onclick="openChargeModal()"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <i class="fas fa-plus mr-1"></i>충전
              </button>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">포인트 이력</h4>
          <div id="points-history">
            <p class="text-sm text-gray-400 text-center py-4">이력이 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [개인] 구독 ── -->
      <section id="section-subscription" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">구독</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <i class="fas fa-crown text-blue-600 text-xl"></i>
            </div>
            <div>
              <p class="font-semibold text-gray-800">현재 플랜: <span id="sub-plan-name" class="text-blue-600">Free</span></p>
              <p class="text-sm text-gray-500 mt-0.5" id="sub-status-text">무료 플랜 이용 중</p>
            </div>
          </div>
        </div>
        <div class="grid md:grid-cols-3 gap-4" id="plan-cards">
          <!-- JS로 렌더링 -->
        </div>
        <p class="text-xs text-gray-400 mt-4 text-center">
          플랜 업그레이드는 앱(iOS/Android)에서 가능합니다.
        </p>
      </section>

      <!-- ── [그룹관리] 그룹 대시보드 ── -->
      <section id="section-group-dashboard" class="page-section">
        <div class="mb-5">
          <h3 class="text-lg font-bold text-gray-800">그룹 대시보드</h3>
          <p class="text-sm text-gray-500 mt-1" id="group-desc-text"></p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-blue-600" id="gstat-members">-</p>
            <p class="text-sm text-gray-500 mt-1">전체 멤버</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-yellow-500" id="gstat-pending">-</p>
            <p class="text-sm text-gray-500 mt-1">가입 대기</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-green-600" id="gstat-events">-</p>
            <p class="text-sm text-gray-500 mt-1">행사</p>
          </div>
          <div class="stat-card text-center">
            <p class="text-xl font-bold text-purple-600" id="gstat-points">-</p>
            <p class="text-sm text-gray-500 mt-1">그룹 포인트 (P)</p>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">최근 가입 신청</h4>
          <div id="group-pending-list">
            <p class="text-sm text-gray-400 text-center py-4">가입 대기 중인 멤버가 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [그룹관리] 멤버 관리 ── -->
      <section id="section-group-members" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">멤버 관리</h3>
          <div class="flex gap-2">
            <button onclick="showSection('group-invites')"
              class="flex items-center gap-2 px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm">
              <i class="fas fa-link"></i> 초대링크
            </button>
          </div>
        </div>
        <!-- 탭: 승인대기 / 전체멤버 -->
        <div class="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
          <button onclick="switchMemberTab('pending')" id="mtab-pending"
            class="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-800 shadow-sm">대기 <span id="pending-count" class="text-red-500"></span></button>
          <button onclick="switchMemberTab('active')" id="mtab-active"
            class="px-4 py-1.5 rounded-md text-sm font-medium text-gray-500">전체 멤버</button>
        </div>
        <div id="members-list">
          <p class="text-sm text-gray-400 text-center py-8">멤버가 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 행사 관리 ── -->
      <section id="section-group-events" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">행사 관리</h3>
          <button onclick="openCreateEventModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 행사 생성
          </button>
        </div>
        <div id="events-list">
          <p class="text-sm text-gray-400 text-center py-8">행사가 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 그룹 포인트 ── -->
      <section id="section-group-points" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">그룹 포인트</h3>
        <div class="stat-card mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">그룹 잔액</p>
              <p class="text-2xl font-bold text-purple-600 mt-1"><span id="group-points-balance">-</span> P</p>
            </div>
            <div class="flex flex-col gap-2 items-end">
              <button onclick="openGroupChargeModal()"
                class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                <i class="fas fa-plus mr-1"></i>그룹 충전
              </button>
              <button onclick="openTransferModal()"
                class="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50">
                <i class="fas fa-exchange-alt mr-1"></i>개인→그룹 이전
              </button>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <h4 class="font-semibold text-gray-700 mb-3">그룹 포인트 이력</h4>
          <div id="group-points-history">
            <p class="text-sm text-gray-400 text-center py-4">이력이 없습니다.</p>
          </div>
        </div>
      </section>

      <!-- ── [그룹관리] 레슨 관리 ── -->
      <section id="section-group-lessons" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">레슨 관리</h3>
          <button onclick="openCreateLessonModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 일정 추가
          </button>
        </div>
        <div id="lessons-list">
          <p class="text-sm text-gray-400 text-center py-8">레슨 일정이 없습니다.</p>
        </div>
      </section>

      <!-- ── [그룹관리] 초대링크 ── -->
      <section id="section-group-invites" class="page-section">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-800">초대링크 관리</h3>
          <button onclick="openCreateInviteModal()"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <i class="fas fa-plus"></i> 링크 생성
          </button>
        </div>
        <div id="invites-list">
          <p class="text-sm text-gray-400 text-center py-8">초대링크가 없습니다.</p>
        </div>
      </section>

      <!-- ── 알림 ── -->
      <section id="section-notifications" class="page-section">
        <h3 class="text-lg font-bold text-gray-800 mb-5">알림</h3>
        <div id="notifications-list">
          <p class="text-sm text-gray-400 text-center py-8">알림이 없습니다.</p>
        </div>
      </section>

    </main>
  </div>
</div>

<!-- ── 모달: 프로필 수정 ── -->
<div id="modal-profile" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">내 프로필</h3>
      <button onclick="closeModal('modal-profile')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>

    <!-- 아바타 업로드 -->
    <div class="flex flex-col items-center mb-5">
      <div class="relative group cursor-pointer" onclick="document.getElementById('avatar-file-input').click()">
        <div id="profile-avatar-wrap" class="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden" style="background:var(--navy-glow)">
          <i id="profile-avatar-icon" class="fas fa-user text-white text-3xl"></i>
          <img id="profile-avatar-img" src="" class="hidden w-24 h-24 object-cover"
            onerror="this.classList.add('hidden');document.getElementById('profile-avatar-icon').classList.remove('hidden')">
        </div>
        <div class="absolute inset-0 rounded-full bg-black/40 hidden group-hover:flex items-center justify-center">
          <i class="fas fa-camera text-white text-xl"></i>
        </div>
      </div>
      <input id="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange="onAvatarFileChange(event)">
      <p id="avatar-upload-status" class="text-xs text-gray-400 mt-2">클릭하여 사진 변경 (JPG·PNG·WEBP, 최대 5MB)</p>
    </div>

    <!-- 이름 수정 -->
    <form id="profile-name-form" class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이름</label>
        <input id="profile-name-input" type="text" class="modal-input" placeholder="이름을 입력하세요" required>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input id="profile-email-display" type="text" class="modal-input bg-gray-50 text-gray-400" readonly>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">플랜</label>
        <input id="profile-plan-display" type="text" class="modal-input bg-gray-50 text-gray-400" readonly>
      </div>
      <div id="profile-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 text-white rounded-lg font-medium transition" style="background:var(--navy)" onmouseover="this.style.background='var(--navy-deep)'" onmouseout="this.style.background='var(--navy)'">
        저장
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 명함 미리보기 ── -->
<div id="modal-card-preview" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">내 명함</h3>
      <button onclick="closeModal('modal-card-preview')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div id="card-preview-body"></div>
  </div>
</div>

<!-- ── 모달: 명함 수정 ── -->
<div id="modal-edit-card" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style="max-height:92vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
      <h3 class="text-lg font-bold">명함 수정</h3>
      <button onclick="closeModal('modal-edit-card')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 탭 -->
    <div class="flex border-b mx-5 flex-shrink-0">
      <button id="edit-tab-basic" onclick="switchEditTab('basic')"
        class="flex-1 py-2 text-sm font-medium border-b-2" style="color:var(--navy);border-color:var(--navy)">기본 정보</button>
      <button id="edit-tab-resume" onclick="switchEditTab('resume')"
        class="flex-1 py-2 text-sm font-medium border-b-2 border-transparent" style="color:var(--mute)">이력 &amp; SNS</button>
    </div>
    <form id="edit-card-form" class="overflow-y-auto flex-1 px-5 py-4">
      <input id="edit-card-id" type="hidden">
      <!-- ── 탭1: 기본 정보 ── -->
      <div id="edit-pane-basic" class="space-y-3">
        <!-- 사진 -->
        <div class="flex flex-col items-center gap-2 pb-1">
          <div class="relative group cursor-pointer" onclick="document.getElementById('edit-card-avatar-input').click()">
            <img id="edit-card-avatar-preview"
                 src="https://ui-avatars.com/api/?name=?&background=6366f1&color=fff&size=96"
                 class="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shadow"
                 onerror="this.src='https://ui-avatars.com/api/?name=?&background=6366f1&color=fff&size=96'">
            <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fas fa-camera text-white text-lg"></i>
            </div>
          </div>
          <span class="text-xs text-gray-400">사진 변경</span>
          <input id="edit-card-avatar-input" type="file" accept="image/*" class="hidden" onchange="onEditCardAvatarChange(event)">
        </div>
        <input id="edit-card-name"    type="text"  placeholder="이름 *"   class="modal-input" required>
        <input id="edit-card-title"   type="text"  placeholder="직함"     class="modal-input">
        <input id="edit-card-company" type="text"  placeholder="회사/단체" class="modal-input">
        <input id="edit-card-email"   type="email" placeholder="이메일"    class="modal-input">
        <input id="edit-card-phone"   type="text"  placeholder="전화번호"  class="modal-input">
        <input id="edit-card-website" type="url"   placeholder="웹사이트 (https://...)" class="modal-input">
        <textarea id="edit-card-bio" placeholder="소개" rows="2" class="modal-input resize-none"></textarea>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="edit-card-public" class="rounded">
            <span class="text-sm text-gray-700">공개 명함 (QR 공유 가능)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="edit-card-primary" class="rounded">
            <span class="text-sm text-gray-700">대표 명함으로 설정</span>
          </label>
        </div>
      </div>
      <!-- ── 탭2: 이력 & SNS ── -->
      <div id="edit-pane-resume" class="hidden space-y-5">
        <!-- 경력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-briefcase text-orange-500 mr-1"></i>경력</p>
            <button type="button" onclick="addResumeItem('edit','career')"
              class="text-xs px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition">+ 추가</button>
          </div>
          <div id="edit-career-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 삼성전자 · 소프트웨어 개발자 · 2020~2023</p>
        </div>
        <!-- 학력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-graduation-cap text-purple-500 mr-1"></i>학력</p>
            <button type="button" onclick="addResumeItem('edit','education')"
              class="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition">+ 추가</button>
          </div>
          <div id="edit-education-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 서울대학교 · 컴퓨터공학과 · 2016 졸업</p>
        </div>
        <!-- 스킬 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-tags text-blue-500 mr-1"></i>스킬 / 키워드</p>
            <button type="button" onclick="addResumeItem('edit','skill')"
              class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">+ 추가</button>
          </div>
          <div id="edit-skill-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: Python, React, 영어 (비즈니스)</p>
        </div>
        <!-- SNS -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-share-alt text-green-500 mr-1"></i>소셜 링크</p>
            <button type="button" onclick="addSnsItem('edit')"
              class="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition">+ 추가</button>
          </div>
          <div id="edit-sns-list" class="space-y-2"></div>
        </div>
      </div>
      <!-- 에러 & 제출 -->
      <div id="edit-card-error" class="hidden text-sm text-red-600 mt-3"></div>
      <button type="submit" class="w-full py-3 text-white rounded-lg font-medium mt-4 transition" style="background:var(--navy)" onmouseover="this.style.background='var(--navy-deep)'" onmouseout="this.style.background='var(--navy)'">
        저장
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 명함 생성 ── -->
<div id="modal-create-card" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style="max-height:92vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
      <h3 class="text-lg font-bold">명함 추가</h3>
      <button onclick="closeModal('modal-create-card')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 탭 -->
    <div class="flex border-b mx-5 flex-shrink-0">
      <button id="create-tab-basic" onclick="switchCreateTab('basic')"
        class="flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">기본 정보</button>
      <button id="create-tab-resume" onclick="switchCreateTab('resume')"
        class="flex-1 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent">이력 &amp; SNS</button>
    </div>
    <form id="create-card-form" class="overflow-y-auto flex-1 px-5 py-4">
      <!-- ── 탭1: 기본 정보 ── -->
      <div id="create-pane-basic" class="space-y-3">
        <!-- 사진 -->
        <div class="flex flex-col items-center gap-2 pb-1">
          <div class="relative group cursor-pointer" onclick="document.getElementById('create-card-avatar-input').click()">
            <img id="create-card-avatar-preview"
                 src="https://ui-avatars.com/api/?name=+&background=6366f1&color=fff&size=96"
                 class="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shadow">
            <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fas fa-camera text-white text-lg"></i>
            </div>
          </div>
          <span class="text-xs text-gray-400">사진 추가 (선택)</span>
          <input id="create-card-avatar-input" type="file" accept="image/*" class="hidden" onchange="onCreateCardAvatarChange(event)">
        </div>
        <input id="card-name"    type="text"  placeholder="이름 *"     class="modal-input" required>
        <input id="card-title"   type="text"  placeholder="직함"        class="modal-input">
        <input id="card-company" type="text"  placeholder="회사/단체"    class="modal-input">
        <input id="card-email"   type="email" placeholder="이메일"       class="modal-input">
        <input id="card-phone"   type="text"  placeholder="전화번호"     class="modal-input">
        <input id="card-website" type="url"   placeholder="웹사이트 (https://...)" class="modal-input">
        <textarea id="card-bio"  placeholder="소개 (자유롭게 작성)" rows="2" class="modal-input resize-none"></textarea>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="card-public" class="rounded" checked>
          <span class="text-sm text-gray-700">공개 명함 (QR 공유 가능)</span>
        </label>
        <!-- 디자인 안내 (웹은 기본 디자인, 다양한 디자인은 앱) -->
        <div class="flex items-start gap-2 mt-1 px-3 py-2.5 rounded-xl" style="background:var(--gold-soft)">
          <i class="fas fa-palette text-xs mt-0.5" style="color:var(--gold-deep)"></i>
          <p class="text-xs leading-relaxed" style="color:var(--sub)">
            <b style="color:var(--ink)">다양한 디자인</b>의 명함은 <b style="color:var(--ink)">앱</b>에서 만들 수 있어요.
            웹에서 만든 명함은 기본 디자인으로 생성됩니다.
          </p>
        </div>
      </div>
      <!-- ── 탭2: 이력 & SNS ── -->
      <div id="create-pane-resume" class="hidden space-y-5">
        <!-- 경력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-briefcase text-orange-500 mr-1"></i>경력</p>
            <button type="button" onclick="addResumeItem('create','career')"
              class="text-xs px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition">+ 추가</button>
          </div>
          <div id="create-career-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 삼성전자 · 소프트웨어 개발자 · 2020~2023</p>
        </div>
        <!-- 학력 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-graduation-cap text-purple-500 mr-1"></i>학력</p>
            <button type="button" onclick="addResumeItem('create','education')"
              class="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition">+ 추가</button>
          </div>
          <div id="create-education-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: 서울대학교 · 컴퓨터공학과 · 2016 졸업</p>
        </div>
        <!-- 스킬 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-tags text-blue-500 mr-1"></i>스킬 / 키워드</p>
            <button type="button" onclick="addResumeItem('create','skill')"
              class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">+ 추가</button>
          </div>
          <div id="create-skill-list" class="space-y-2"></div>
          <p class="text-xs text-gray-400 mt-1">예: Python, React, 영어 (비즈니스)</p>
        </div>
        <!-- SNS -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-gray-700"><i class="fas fa-share-alt text-green-500 mr-1"></i>소셜 링크</p>
            <button type="button" onclick="addSnsItem('create')"
              class="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition">+ 추가</button>
          </div>
          <div id="create-sns-list" class="space-y-2"></div>
        </div>
      </div>
      <!-- 에러 & 제출 -->
      <div id="card-form-error" class="hidden text-sm text-red-600 mt-3"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 mt-4">
        명함 생성
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 그룹 개설 신청 ── -->
<div id="modal-create-group" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">그룹 개설 신청</h3>
      <button onclick="closeModal('modal-create-group')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 안내 배너 -->
    <div class="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
      <i class="fas fa-info-circle mr-1"></i>
      누구나 그룹을 개설 신청할 수 있습니다. 관리자 심사 후 승인되면 활성화됩니다.
    </div>
    <form id="create-group-form" class="space-y-3">
      <input id="group-name"    type="text" placeholder="그룹 이름 *" class="modal-input" required minlength="2">
      <textarea id="group-description" placeholder="그룹 소개 (선택)" rows="2" class="modal-input resize-none"></textarea>
      <textarea id="group-purpose"     placeholder="그룹 용도 * (관리자 심사용, 5자 이상)" rows="2" class="modal-input resize-none" required minlength="5"></textarea>
      <div class="flex gap-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="group-visibility" value="public" checked class="accent-blue-600">
          <span class="text-sm text-gray-700">공개</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="group-visibility" value="private" class="accent-blue-600">
          <span class="text-sm text-gray-700">비공개</span>
        </label>
      </div>
      <input id="group-max-members" type="number" placeholder="최대 멤버 수 (선택, 비워두면 무제한)" class="modal-input" min="2">
      <div id="create-group-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        <i class="fas fa-paper-plane mr-2"></i>개설 신청
      </button>
    </form>
  </div>
</div>

<!-- ── 모달: 그룹 탐색 ── -->
<div id="modal-group-explore" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height:90vh">
    <!-- 헤더 -->
    <div class="flex items-center justify-between p-5 border-b flex-shrink-0">
      <h3 class="text-lg font-bold">그룹 탐색</h3>
      <button onclick="closeModal('modal-group-explore')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <!-- 검색바 -->
    <div class="px-5 pt-4 pb-3 flex-shrink-0">
      <div class="relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
        <input id="explore-search-input" type="text" placeholder="그룹 이름 또는 소개 검색..."
          class="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          oninput="onExploreSearchInput(this.value)">
      </div>
    </div>
    <!-- 그룹 목록 -->
    <div id="explore-groups-list" class="overflow-y-auto flex-1 px-5 pb-5 space-y-3">
      <div class="text-center py-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...</div>
    </div>
    <!-- 더보기 -->
    <div id="explore-load-more-wrap" class="hidden px-5 pb-5 flex-shrink-0">
      <button onclick="loadMoreExploreGroups()"
        class="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
        더 보기
      </button>
    </div>
  </div>
</div>

<!-- ── 모달: 그룹 상세 ── -->
<div id="modal-group-detail" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style="max-height:90vh">
    <div class="flex items-center justify-between p-5 border-b flex-shrink-0">
      <h3 class="text-lg font-bold">그룹 정보</h3>
      <button onclick="closeModal('modal-group-detail')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div id="group-detail-body" class="overflow-y-auto flex-1 p-5">
      <div class="text-center py-8 text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...</div>
    </div>
  </div>
</div>

<!-- ── 모달: 초대링크 생성 ── -->
<div id="modal-create-invite" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">초대링크 생성</h3>
      <button onclick="closeModal('modal-create-invite')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <form id="create-invite-form" class="space-y-3">
      <input id="invite-label"    type="text"   placeholder="링크 이름 (예: 5월 신입 모집)" class="modal-input">
      <input id="invite-max-uses" type="number" placeholder="최대 사용 횟수 (빈칸=무제한)"  class="modal-input" min="1">
      <input id="invite-expires"  type="date"   placeholder="만료일"                       class="modal-input">
      <div id="invite-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        링크 생성
      </button>
    </form>
    <!-- 생성 결과 -->
    <div id="invite-result" class="hidden mt-4 p-3 bg-blue-50 rounded-lg">
      <p class="text-xs text-gray-500 mb-1">초대 링크</p>
      <div class="flex gap-2">
        <input id="invite-url" type="text" readonly class="flex-1 text-sm bg-white border rounded px-2 py-1 text-blue-700">
        <button onclick="copyInviteUrl()" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">복사</button>
      </div>
    </div>
  </div>
</div>

<!-- ── 모달: 행사 생성 ── -->
<div id="modal-create-event" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">행사 생성</h3>
      <button onclick="closeModal('modal-create-event')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
    </div>
    <div class="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
      <i class="fas fa-coins mr-1"></i> 행사 생성 시 그룹 포인트 <strong id="event-price-display">3,000P</strong>가 차감됩니다.
    </div>
    <form id="create-event-form" class="space-y-3">
      <input id="event-title"       type="text"     placeholder="행사명 *"     class="modal-input" required>
      <textarea id="event-desc"     placeholder="행사 설명" rows="2"           class="modal-input resize-none"></textarea>
      <input id="event-location"    type="text"     placeholder="장소"         class="modal-input">
      <div class="grid grid-cols-2 gap-2">
        <input id="event-starts"    type="datetime-local" class="modal-input">
        <input id="event-ends"      type="datetime-local" class="modal-input">
      </div>
      <input id="event-max"         type="number"   placeholder="최대 참가 인원" class="modal-input" min="1">
      <div id="event-form-error" class="hidden text-sm text-red-600"></div>
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        행사 생성 (포인트 차감)
      </button>
    </form>
  </div>
</div>

<style>
  .modal-input {
    display:block; width:100%;
    padding:0.65rem 0.9rem;
    border:1.5px solid var(--line); border-radius:var(--r-md);
    font-size:0.9rem; font-family:var(--font); outline:none; transition:border 0.15s;
    background:var(--surface-2,#F7F8FA); color:var(--ink);
  }
  .modal-input:focus { border-color:var(--navy); box-shadow:0 0 0 3px rgba(11,30,64,0.10); background:#fff; }
</style>

<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/app.js?v=20260722a"></script>
</body>
</html>`
}
