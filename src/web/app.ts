// ── App Web UI HTML 템플릿 (사용자 / 그룹관리자) ──────

export function appLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>METI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f2f5fb;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    /* ── Card ── */
    .card {
      width: 100%; max-width: 420px;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(26,63,170,0.06), 0 16px 48px rgba(26,63,170,0.1);
    }

    /* Blue header */
    .card-header {
      background: #0c2d85;
      padding: 32px 36px 30px;
      position: relative;
      overflow: hidden;
    }
    .card-header::after {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 180px; height: 180px;
      background: rgba(255,255,255,0.05);
      border-radius: 50%;
    }
    .card-header::before {
      content: '';
      position: absolute;
      bottom: -40px; left: 30%;
      width: 120px; height: 120px;
      background: rgba(255,255,255,0.04);
      border-radius: 50%;
    }
    .logo {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 22px; position: relative; z-index: 1;
    }
    .logo-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 16px;
    }
    .logo-name {
      font-size: 20px; font-weight: 900; color: white; letter-spacing: -0.5px;
    }
    .header-title {
      font-size: 28px; font-weight: 900; color: white;
      line-height: 1.2; letter-spacing: -0.8px;
      position: relative; z-index: 1;
    }
    .header-sub {
      font-size: 14px; color: rgba(255,255,255,0.6);
      margin-top: 6px; position: relative; z-index: 1;
    }

    /* White body */
    .card-body {
      background: #ffffff;
      padding: 32px 36px 36px;
    }

    .section-title {
      font-size: 18px; font-weight: 700; color: #0d1b3e;
      margin-bottom: 20px;
    }

    .form-group { margin-bottom: 14px; }
    .form-label {
      display: block; font-size: 13px; font-weight: 600;
      color: #374151; margin-bottom: 6px;
    }
    .form-input {
      width: 100%; padding: 13px 15px;
      background: #f7f9fc; border: 1.5px solid #e4eaf5;
      border-radius: 11px; color: #0d1b3e;
      font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .form-input::placeholder { color: #adb5cc; }
    .form-input:focus {
      border-color: #0c2d85;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(26,63,170,0.1);
    }

    .pw-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 6px;
    }
    .forgot-link {
      font-size: 12px; color: #0c2d85; text-decoration: none; font-weight: 500;
    }
    .forgot-link:hover { text-decoration: underline; }

    .btn-primary {
      width: 100%; padding: 15px; margin-top: 8px;
      background: #0c2d85; color: white;
      border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
      letter-spacing: 0.1px;
    }
    .btn-primary:hover { background: #0a2470; }
    .btn-primary:active { transform: scale(0.99); }

    .error-box {
      background: #fef2f2; border: 1px solid #fecaca;
      color: #b91c1c; padding: 11px 14px;
      border-radius: 10px; font-size: 13px; margin-bottom: 16px;
    }

    hr.divider { border: none; border-top: 1px solid #f1f5f9; margin: 24px 0; }

    .bottom-link {
      text-align: center; font-size: 14px; color: #6b7280;
    }
    .bottom-link a { color: #0c2d85; font-weight: 600; text-decoration: none; }
    .bottom-link a:hover { text-decoration: underline; }

    .page-footer {
      margin-top: 20px; font-size: 12px; color: #b0b8cc; text-align: center;
    }

    @media (max-width: 480px) {
      .card-header { padding: 28px 24px 24px; }
      .card-body { padding: 28px 24px 32px; }
      .header-title { font-size: 24px; }
    }
  </style>
</head>
<body>

  <div class="card">
    <div class="card-header">
      <div class="logo">
        <div class="logo-icon"><i class="fas fa-id-card"></i></div>
        <span class="logo-name">METI</span>
      </div>
      <div class="header-title">차세대<br>디지털 명함</div>
      <div class="header-sub">NFC · QR · SNS를 하나로</div>
    </div>

    <div class="card-body">
      <div class="section-title">로그인</div>

      <div id="error-msg" class="error-box" style="display:none"></div>

      <form id="login-form">
        <div class="form-group">
          <label class="form-label" for="email">이메일</label>
          <input type="email" id="email" placeholder="example@email.com" class="form-input" autocomplete="email">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <div class="pw-row">
            <label class="form-label" for="password" style="margin:0">비밀번호</label>
            <a href="/app/forgot-password" class="forgot-link">비밀번호를 잊으셨나요?</a>
          </div>
          <input type="password" id="password" placeholder="비밀번호 입력" class="form-input" autocomplete="current-password">
        </div>
        <button type="submit" class="btn-primary">
          <span id="btn-text">로그인</span>
          <span id="btn-loading" style="display:none"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>로그인 중...</span>
        </button>
      </form>

      <hr class="divider">
      <div class="bottom-link">계정이 없으신가요? <a href="/app/register">회원가입</a></div>
    </div>
  </div>

  <div class="page-footer">© 2026 주식회사 모빈</div>

  <script>
    (function() {
      const token = localStorage.getItem('meti_token');
      const user  = JSON.parse(localStorage.getItem('meti_user') || 'null');
      if (token && user) {
        window.location.href = user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
      }
    })();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btnText    = document.getElementById('btn-text');
      const btnLoading = document.getElementById('btn-loading');
      const errorMsg   = document.getElementById('error-msg');

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      errorMsg.style.display = 'none';

      try {
        const res  = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('meti_token',         data.data.access_token);
          localStorage.setItem('meti_refresh_token',  data.data.refresh_token);
          localStorage.setItem('meti_user',           JSON.stringify(data.data.user));
          const role = data.data.user.role;
          window.location.href = role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
        } else {
          errorMsg.textContent = data.error || '로그인에 실패했습니다.';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = '서버 연결에 실패했습니다.';
        errorMsg.style.display = 'block';
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
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
  <title>METI — 회원가입</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f2f5fb;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 16px;
    }

    .card {
      width: 100%; max-width: 420px;
      border-radius: 24px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(26,63,170,0.06), 0 16px 48px rgba(26,63,170,0.1);
    }

    .card-header {
      background: #0c2d85;
      padding: 24px 36px 22px;
      position: relative; overflow: hidden;
    }
    .card-header::after {
      content: ''; position: absolute;
      top: -50px; right: -50px;
      width: 150px; height: 150px;
      background: rgba(255,255,255,0.05); border-radius: 50%;
    }
    .logo {
      display: flex; align-items: center; gap: 10px;
      position: relative; z-index: 1;
    }
    .logo-icon {
      width: 34px; height: 34px; border-radius: 9px;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 15px;
    }
    .logo-name { font-size: 19px; font-weight: 900; color: white; letter-spacing: -0.5px; }
    .logo-sep { color: rgba(255,255,255,0.35); margin: 0 4px; }
    .logo-page { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); }

    .card-body { background: #ffffff; padding: 28px 36px 36px; }

    .section-title {
      font-size: 18px; font-weight: 700; color: #0d1b3e; margin-bottom: 18px;
    }

    .form-group { margin-bottom: 13px; }
    .form-label {
      display: block; font-size: 13px; font-weight: 600;
      color: #374151; margin-bottom: 5px;
    }
    .form-input {
      width: 100%; padding: 12px 15px;
      background: #f7f9fc; border: 1.5px solid #e4eaf5;
      border-radius: 11px; color: #0d1b3e;
      font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .form-input::placeholder { color: #adb5cc; }
    .form-input:focus {
      border-color: #0c2d85; background: #ffffff;
      box-shadow: 0 0 0 3px rgba(26,63,170,0.1);
    }

    .terms-box {
      background: #f7f9fc; border: 1.5px solid #e4eaf5;
      border-radius: 12px; padding: 14px 16px; margin: 16px 0;
    }
    .agree-all-row {
      display: flex; align-items: center; gap: 9px;
      padding-bottom: 11px; margin-bottom: 11px;
      border-bottom: 1px solid #e4eaf5;
    }
    .agree-all-row label { font-size: 14px; font-weight: 700; color: #0d1b3e; cursor: pointer; }
    .agree-item-row { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 7px; }
    .agree-item-row:last-child { margin-bottom: 0; }
    .agree-item-row label { font-size: 13px; color: #6b7280; cursor: pointer; line-height: 1.4; }
    .agree-item-row label .req { color: #dc2626; font-weight: 700; margin-right: 3px; }
    .agree-item-row label a { color: #0c2d85; text-decoration: none; }
    .agree-item-row label a:hover { text-decoration: underline; }
    input[type="checkbox"] {
      width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px;
      accent-color: #0c2d85; cursor: pointer;
    }

    .btn-primary {
      width: 100%; padding: 15px;
      background: #0c2d85; color: white;
      border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
    }
    .btn-primary:hover { background: #0a2470; }
    .btn-primary:active { transform: scale(0.99); }

    .error-box {
      background: #fef2f2; border: 1px solid #fecaca;
      color: #b91c1c; padding: 11px 14px;
      border-radius: 10px; font-size: 13px; margin-bottom: 14px;
    }
    .success-box {
      background: #f0fdf4; border: 1px solid #bbf7d0;
      color: #166534; padding: 11px 14px;
      border-radius: 10px; font-size: 13px; margin-bottom: 14px;
    }

    hr.divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
    .bottom-link { text-align: center; font-size: 14px; color: #6b7280; }
    .bottom-link a { color: #0c2d85; font-weight: 600; text-decoration: none; }
    .bottom-link a:hover { text-decoration: underline; }
    .page-footer { margin-top: 20px; font-size: 12px; color: #b0b8cc; text-align: center; }

    @media (max-width: 480px) {
      .card-header { padding: 20px 24px 18px; }
      .card-body { padding: 24px 24px 32px; }
    }
  </style>
</head>
<body>

  <div class="card">
    <div class="card-header">
      <div class="logo">
        <div class="logo-icon"><i class="fas fa-id-card"></i></div>
        <span class="logo-name">METI</span>
        <span class="logo-sep">/</span>
        <span class="logo-page">회원가입</span>
      </div>
    </div>

    <div class="card-body">
      <div class="section-title">계정 만들기</div>

      <div id="error-msg" class="error-box" style="display:none"></div>
      <div id="success-msg" class="success-box" style="display:none"></div>

      <form id="register-form">
        <div class="form-group">
          <label class="form-label" for="name">이름</label>
          <input type="text" id="name" placeholder="홍길동" class="form-input" autocomplete="name">
        </div>
        <div class="form-group">
          <label class="form-label" for="email">이메일</label>
          <input type="email" id="email" placeholder="example@email.com" class="form-input" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label" for="password">비밀번호</label>
          <input type="password" id="password" placeholder="8자 이상" class="form-input" autocomplete="new-password">
        </div>

        <div class="terms-box">
          <div class="agree-all-row">
            <input type="checkbox" id="agree-all" onchange="toggleAgreeAll(this)">
            <label for="agree-all">전체 동의</label>
          </div>
          <div class="agree-item-row">
            <input type="checkbox" id="agree-terms" class="agree-item" onchange="syncAgreeAll()">
            <label for="agree-terms"><span class="req">[필수]</span><a href="/terms" target="_blank">이용약관</a> 동의</label>
          </div>
          <div class="agree-item-row">
            <input type="checkbox" id="agree-privacy" class="agree-item" onchange="syncAgreeAll()">
            <label for="agree-privacy"><span class="req">[필수]</span><a href="/privacy" target="_blank">개인정보처리방침</a> 동의</label>
          </div>
        </div>

        <button type="submit" class="btn-primary">
          <span id="btn-text">가입하기</span>
          <span id="btn-loading" style="display:none"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>처리 중...</span>
        </button>
      </form>

      <hr class="divider">
      <div class="bottom-link">이미 계정이 있으신가요? <a href="/">로그인</a></div>
    </div>
  </div>

  <div class="page-footer">© 2026 주식회사 모빈</div>

  <script>
    function toggleAgreeAll(el) {
      document.querySelectorAll('.agree-item').forEach(cb => cb.checked = el.checked);
    }
    function syncAgreeAll() {
      const items = document.querySelectorAll('.agree-item');
      document.getElementById('agree-all').checked = [...items].every(cb => cb.checked);
    }

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnText    = document.getElementById('btn-text');
      const btnLoading = document.getElementById('btn-loading');
      const errorMsg   = document.getElementById('error-msg');
      const successMsg = document.getElementById('success-msg');

      if (!document.getElementById('agree-terms').checked || !document.getElementById('agree-privacy').checked) {
        errorMsg.textContent = '이용약관 및 개인정보처리방침에 동의해 주세요.';
        errorMsg.style.display = 'block';
        return;
      }

      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      try {
        const res  = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         document.getElementById('name').value.trim(),
            email:        document.getElementById('email').value.trim(),
            password:     document.getElementById('password').value,
            account_type: 'personal'
          })
        });
        const data = await res.json();

        if (data.success) {
          successMsg.textContent = '가입이 완료되었습니다. 로그인 페이지로 이동합니다.';
          successMsg.style.display = 'block';
          document.getElementById('register-form').reset();
          setTimeout(() => { window.location.href = '/'; }, 1500);
        } else {
          errorMsg.textContent = data.error || '가입에 실패했습니다.';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = '서버 연결에 실패했습니다.';
        errorMsg.style.display = 'block';
      } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>THE METI — 스마트 디지털 명함 플랫폼</title>
  <meta name="description" content="NFC·QR 한 번으로 내 모든 정보를 전달하는 스마트 디지털 명함 플랫폼. 개인·팀·기업 모두를 위한 명함 솔루션.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --blue:       #0c2d85;
      --blue-dark:  #091f5e;
      --blue-light: #e8eeff;
      --text:       #0d1b3e;
      --text-mid:   #475569;
      --text-light: #94a3b8;
      --border:     #e2e8f0;
      --bg:         #f8faff;
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: var(--text); background: #fff; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; }

    /* ── LAYOUT ── */
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 80px 0; }
    .section-sm { padding: 56px 0; }
    .section-label {
      display: inline-block; font-size: 12px; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
      color: var(--blue); background: var(--blue-light);
      padding: 5px 14px; border-radius: 20px; margin-bottom: 16px;
    }
    .section-title { font-size: clamp(26px, 4vw, 38px); font-weight: 900; letter-spacing: -0.8px; line-height: 1.2; color: var(--text); }
    .section-sub { font-size: 16px; color: var(--text-mid); margin-top: 12px; line-height: 1.7; }

    /* ── NAV ── */
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
    }
    .nav-inner {
      max-width: 1100px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      height: 60px;
    }
    .nav-logo {
      display: flex; align-items: center; gap: 9px;
      font-size: 18px; font-weight: 900; color: var(--text); letter-spacing: -0.5px;
    }
    .nav-logo-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--blue); display: flex; align-items: center; justify-content: center;
      color: white; font-size: 14px;
    }
    .nav-links { display: flex; align-items: center; gap: 28px; }
    .nav-links a { font-size: 14px; font-weight: 500; color: var(--text-mid); transition: color 0.15s; }
    .nav-links a:hover { color: var(--blue); }
    .nav-cta { display: flex; align-items: center; gap: 10px; }
    .btn-ghost {
      padding: 8px 18px; border-radius: 9px; font-size: 14px; font-weight: 600;
      color: var(--blue); border: 1.5px solid var(--blue);
      background: transparent; cursor: pointer; font-family: inherit;
      transition: background 0.15s;
    }
    .btn-ghost:hover { background: var(--blue-light); }
    .btn-solid {
      padding: 8px 18px; border-radius: 9px; font-size: 14px; font-weight: 600;
      color: white; background: var(--blue); border: none;
      cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .btn-solid:hover { background: var(--blue-dark); }
    .nav-menu-btn { display: none; background: none; border: none; font-size: 20px; color: var(--text); cursor: pointer; }

    /* ── HERO ── */
    .hero {
      background: linear-gradient(160deg, var(--blue-dark) 0%, var(--blue) 55%, #1a4fc4 100%);
      color: white; padding: 100px 0 80px; text-align: center;
      position: relative; overflow: hidden;
    }
    .hero::before {
      content: ''; position: absolute; inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 500;
      color: rgba(255,255,255,0.85); margin-bottom: 28px;
    }
    .hero-badge i { font-size: 10px; color: #7dd3fc; }
    .hero h1 {
      font-size: clamp(32px, 6vw, 58px); font-weight: 900;
      line-height: 1.12; letter-spacing: -1.5px; margin-bottom: 20px;
      position: relative; z-index: 1;
    }
    .hero h1 em { font-style: normal; color: #7dd3fc; }
    .hero p {
      font-size: clamp(15px, 2vw, 18px); color: rgba(255,255,255,0.7);
      max-width: 520px; margin: 0 auto 36px; position: relative; z-index: 1;
    }
    .hero-btns {
      display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
      position: relative; z-index: 1;
    }
    .btn-hero-primary {
      padding: 15px 32px; background: white; color: var(--blue);
      border: none; border-radius: 12px; font-size: 15px; font-weight: 800;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    }
    .btn-hero-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
    .btn-hero-outline {
      padding: 15px 32px; background: rgba(255,255,255,0.1);
      color: white; border: 2px solid rgba(255,255,255,0.35);
      border-radius: 12px; font-size: 15px; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .btn-hero-outline:hover { background: rgba(255,255,255,0.18); }
    .hero-stat {
      margin-top: 52px; display: flex; gap: 40px; justify-content: center;
      flex-wrap: wrap; position: relative; z-index: 1;
    }
    .hero-stat-item { text-align: center; }
    .hero-stat-item strong { display: block; font-size: 24px; font-weight: 900; color: white; }
    .hero-stat-item span { font-size: 13px; color: rgba(255,255,255,0.55); }

    /* ── FEATURE GRID ── */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px; margin-top: 48px;
    }
    .feature-card {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 18px; padding: 28px;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .feature-card:hover { box-shadow: 0 8px 32px rgba(12,45,133,0.1); transform: translateY(-2px); }
    .feature-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: var(--blue-light); color: var(--blue);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; margin-bottom: 18px;
    }
    .feature-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
    .feature-card p  { font-size: 14px; color: var(--text-mid); line-height: 1.65; }

    /* ── USE CASES ── */
    #usecases { background: var(--bg); }
    .cases-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 20px; margin-top: 48px;
    }
    .case-card {
      background: white; border-radius: 18px; overflow: hidden;
      border: 1px solid var(--border);
    }
    .case-header {
      background: var(--blue); color: white;
      padding: 24px; display: flex; align-items: center; gap: 14px;
    }
    .case-header-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      flex-shrink: 0;
    }
    .case-header h3 { font-size: 15px; font-weight: 700; }
    .case-header p  { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 2px; }
    .case-body { padding: 22px; }
    .case-body ul { list-style: none; }
    .case-body li {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 14px; color: var(--text-mid); margin-bottom: 10px;
    }
    .case-body li:last-child { margin-bottom: 0; }
    .case-body li::before {
      content: '✓'; color: var(--blue); font-weight: 700; flex-shrink: 0; margin-top: 1px;
    }

    /* ── HOW IT WORKS ── */
    .steps { display: flex; gap: 0; margin-top: 48px; }
    .step {
      flex: 1; text-align: center; padding: 0 20px;
      position: relative;
    }
    .step:not(:last-child)::after {
      content: ''; position: absolute;
      top: 28px; right: -12px;
      width: 24px; height: 2px;
      background: var(--border);
    }
    .step-num {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--blue); color: white;
      font-size: 20px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }
    .step h3 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
    .step p  { font-size: 13px; color: var(--text-mid); }

    /* ── PRICING ── */
    #pricing { background: white; }
    .pricing-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 20px; margin-top: 48px; align-items: start;
    }
    .plan-card {
      border-radius: 20px; padding: 32px;
      border: 1.5px solid var(--border);
      background: white;
    }
    .plan-card.featured {
      background: var(--blue); color: white;
      border-color: var(--blue);
      transform: scale(1.03);
      box-shadow: 0 16px 48px rgba(12,45,133,0.25);
    }
    .plan-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 20px; margin-bottom: 16px;
      background: rgba(255,255,255,0.18); color: white;
    }
    .plan-name { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .plan-desc { font-size: 13px; color: var(--text-mid); margin-bottom: 20px; }
    .plan-card.featured .plan-desc { color: rgba(255,255,255,0.7); }
    .plan-price {
      font-size: 36px; font-weight: 900; letter-spacing: -1px; margin-bottom: 24px;
    }
    .plan-price small { font-size: 14px; font-weight: 500; color: var(--text-mid); }
    .plan-card.featured .plan-price small { color: rgba(255,255,255,0.6); }
    .plan-features { list-style: none; margin-bottom: 28px; }
    .plan-features li {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 14px; color: var(--text-mid); margin-bottom: 10px;
    }
    .plan-card.featured .plan-features li { color: rgba(255,255,255,0.85); }
    .plan-features li::before {
      content: '✓'; color: var(--blue); font-weight: 700; flex-shrink: 0;
    }
    .plan-card.featured .plan-features li::before { color: #7dd3fc; }
    .btn-plan {
      display: block; width: 100%; text-align: center;
      padding: 13px; border-radius: 11px; font-size: 14px; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .btn-plan-outline {
      border: 1.5px solid var(--blue); color: var(--blue); background: transparent;
    }
    .btn-plan-outline:hover { background: var(--blue-light); }
    .btn-plan-white {
      background: white; color: var(--blue); border: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .btn-plan-white:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .pricing-note { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-light); }

    /* ── FINAL CTA ── */
    #final-cta {
      background: linear-gradient(135deg, var(--blue-dark), var(--blue));
      color: white; text-align: center; padding: 80px 24px;
    }
    #final-cta h2 { font-size: clamp(26px, 4vw, 38px); font-weight: 900; letter-spacing: -0.8px; margin-bottom: 12px; }
    #final-cta p  { font-size: 16px; color: rgba(255,255,255,0.65); margin-bottom: 36px; }
    .cta-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

    /* ── FOOTER ── */
    footer {
      background: var(--text); color: rgba(255,255,255,0.5);
      padding: 48px 24px 32px;
    }
    .footer-inner {
      max-width: 1100px; margin: 0 auto;
      display: flex; flex-wrap: wrap; gap: 40px; justify-content: space-between;
    }
    .footer-brand .logo-name { color: white; font-size: 18px; font-weight: 900; }
    .footer-brand p { font-size: 13px; margin-top: 8px; }
    .footer-links h4 { color: white; font-size: 13px; font-weight: 700; margin-bottom: 12px; }
    .footer-links a { display: block; font-size: 13px; margin-bottom: 8px; color: rgba(255,255,255,0.5); }
    .footer-links a:hover { color: rgba(255,255,255,0.85); }
    .footer-bottom {
      max-width: 1100px; margin: 32px auto 0;
      padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between;
      font-size: 12px;
    }

    /* ── LOGIN MODAL ── */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 200;
      align-items: center; justify-content: center; padding: 24px;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: white; border-radius: 20px; overflow: hidden;
      width: 100%; max-width: 400px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.2);
      animation: modal-in 0.2s ease;
    }
    @keyframes modal-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .modal-header {
      background: var(--blue); padding: 24px 28px 22px;
      display: flex; align-items: center; justify-content: space-between;
      position: relative; overflow: hidden;
    }
    .modal-header::after {
      content: ''; position: absolute; top: -40px; right: -40px;
      width: 130px; height: 130px; border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }
    .modal-logo { display: flex; align-items: center; gap: 9px; }
    .modal-logo-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 14px;
    }
    .modal-logo-name { font-size: 18px; font-weight: 900; color: white; }
    .modal-close {
      background: rgba(255,255,255,0.15); border: none; color: white;
      width: 30px; height: 30px; border-radius: 7px;
      font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      position: relative; z-index: 1;
    }
    .modal-body { padding: 28px; }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; color: var(--text); }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; }
    .form-input {
      width: 100%; padding: 12px 14px;
      background: #f7f9fc; border: 1.5px solid #e4eaf5; border-radius: 10px;
      color: var(--text); font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .form-input::placeholder { color: #adb5cc; }
    .form-input:focus { border-color: var(--blue); background: white; box-shadow: 0 0 0 3px rgba(12,45,133,0.1); }
    .pw-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .forgot-link { font-size: 12px; color: var(--blue); }
    .forgot-link:hover { text-decoration: underline; }
    .btn-modal-submit {
      width: 100%; padding: 14px; margin-top: 8px;
      background: var(--blue); color: white;
      border: none; border-radius: 11px;
      font-size: 15px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-modal-submit:hover { background: var(--blue-dark); }
    .modal-error {
      background: #fef2f2; border: 1px solid #fecaca;
      color: #b91c1c; padding: 10px 13px; border-radius: 9px;
      font-size: 13px; margin-bottom: 14px;
    }
    hr.modal-divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
    .modal-register { text-align: center; font-size: 14px; color: #6b7280; }
    .modal-register a { color: var(--blue); font-weight: 600; }

    /* ── MOBILE ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .nav-menu-btn { display: block; }
      .features-grid { grid-template-columns: 1fr; }
      .cases-grid    { grid-template-columns: 1fr; }
      .pricing-grid  { grid-template-columns: 1fr; }
      .plan-card.featured { transform: none; }
      .steps { flex-direction: column; gap: 24px; }
      .step:not(:last-child)::after { display: none; }
      .hero { padding: 72px 0 60px; }
    }
    @media (min-width: 769px) and (max-width: 960px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
      .cases-grid    { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

<!-- ── 로그인 모달 ── -->
<div id="login-modal" class="modal-overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-logo">
        <div class="modal-logo-icon"><i class="fas fa-id-card"></i></div>
        <span class="modal-logo-name">THE METI</span>
      </div>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="modal-title">로그인</div>
      <div id="modal-error" class="modal-error" style="display:none"></div>
      <form id="modal-login-form">
        <div class="form-group">
          <label class="form-label" for="m-email">이메일</label>
          <input type="email" id="m-email" placeholder="example@email.com" class="form-input" autocomplete="email">
        </div>
        <div class="form-group">
          <div class="pw-row">
            <label class="form-label" for="m-password" style="margin:0">비밀번호</label>
            <a href="/app/forgot-password" class="forgot-link">비밀번호 찾기</a>
          </div>
          <input type="password" id="m-password" placeholder="비밀번호 입력" class="form-input" autocomplete="current-password">
        </div>
        <button type="submit" class="btn-modal-submit">
          <span id="m-btn-text">로그인</span>
          <span id="m-btn-loading" style="display:none"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>로그인 중...</span>
        </button>
      </form>
      <hr class="modal-divider">
      <div class="modal-register">계정이 없으신가요? <a href="/app/register">무료 회원가입</a></div>
    </div>
  </div>
</div>

<!-- ── 상단 내비게이션 ── -->
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon"><i class="fas fa-id-card"></i></div>
      THE METI
    </a>
    <div class="nav-links">
      <a href="#features">기능</a>
      <a href="#usecases">활용 사례</a>
      <a href="#howitworks">사용 방법</a>
      <a href="#pricing">요금제</a>
    </div>
    <div class="nav-cta">
      <button class="btn-ghost" onclick="openModal()">로그인</button>
      <a href="/app/register"><button class="btn-solid">무료로 시작하기</button></a>
    </div>
    <button class="nav-menu-btn" onclick="openModal()"><i class="fas fa-bars"></i></button>
  </div>
</nav>

<!-- ── 히어로 ── -->
<section class="hero">
  <div class="container">
    <div class="hero-badge"><i class="fas fa-circle"></i> NFC · QR · SNS 통합 명함 플랫폼</div>
    <h1>한 번의 탭으로<br><em>모든 것을 연결</em>하세요</h1>
    <p>종이 명함은 이제 그만. NFC 카드 하나로 이름·연락처·SNS·이력을<br>즉시 전달하는 스마트 디지털 명함 플랫폼입니다.</p>
    <div class="hero-btns">
      <button class="btn-hero-primary" onclick="location.href='/app/register'">
        <i class="fas fa-arrow-right" style="margin-right:8px"></i>지금 무료로 시작하기
      </button>
      <button class="btn-hero-outline" onclick="openModal()">
        <i class="fas fa-sign-in-alt" style="margin-right:8px"></i>로그인
      </button>
    </div>
    <div class="hero-stat">
      <div class="hero-stat-item">
        <strong>NFC + QR</strong>
        <span>2가지 공유 방식</span>
      </div>
      <div class="hero-stat-item">
        <strong>개인 · 팀 · 기업</strong>
        <span>모든 규모에 맞는 플랜</span>
      </div>
      <div class="hero-stat-item">
        <strong>iOS · Android</strong>
        <span>모바일 앱 지원</span>
      </div>
    </div>
  </div>
</section>

<!-- ── 주요 기능 ── -->
<section class="section" id="features">
  <div class="container">
    <div style="text-align:center">
      <span class="section-label">주요 기능</span>
      <h2 class="section-title">명함 그 이상을 담다</h2>
      <p class="section-sub">단순한 연락처 공유를 넘어, 나를 표현하는 모든 정보를 하나의 명함에.</p>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-id-card"></i></div>
        <h3>스마트 디지털 명함</h3>
        <p>이름, 직함, 회사, 연락처, 소개글을 담은 프로페셔널 명함을 무료로 만드세요. 사진 업로드로 한층 더 세련된 첫인상을 남길 수 있습니다.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-wifi"></i></div>
        <h3>NFC · QR 즉시 공유</h3>
        <p>NFC 카드에 탭 하거나 QR 코드를 스캔하면 바로 명함이 전달됩니다. 앱 설치 없이도 웹 브라우저로 확인 가능합니다.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-briefcase"></i></div>
        <h3>이력 & 포트폴리오</h3>
        <p>경력, 학력, 스킬·키워드를 명함에 추가하세요. 이력서가 필요 없는 올인원 프로필 카드로 활용할 수 있습니다.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-share-alt"></i></div>
        <h3>소셜 링크 통합</h3>
        <p>LinkedIn, Instagram, GitHub, YouTube 등 다양한 SNS 계정을 명함 하나에 연결하세요. 링크 하나로 모든 채널을 공유합니다.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-users"></i></div>
        <h3>그룹 & 팀 관리</h3>
        <p>팀, 협회, 동호회 단위로 명함을 통합 관리합니다. 멤버 초대, 가입 승인, 그룹 포인트 운영을 웹에서 바로 처리하세요.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-calendar-alt"></i></div>
        <h3>행사 & 레슨 운영</h3>
        <p>그룹 내 이벤트를 생성하고 참가자를 관리하세요. 레슨·수업 일정 등록과 포인트 기반 결제까지 플랫폼 하나에서 해결됩니다.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── 활용 사례 ── -->
<section class="section" id="usecases">
  <div class="container">
    <div style="text-align:center">
      <span class="section-label">활용 사례</span>
      <h2 class="section-title">누구에게나 필요한 명함</h2>
      <p class="section-sub">개인부터 기업까지, 다양한 상황에서 THE METI를 활용해보세요.</p>
    </div>
    <div class="cases-grid">
      <div class="case-card">
        <div class="case-header">
          <div class="case-header-icon"><i class="fas fa-user-tie"></i></div>
          <div>
            <h3>비즈니스 프로페셔널</h3>
            <p>영업, 컨설턴트, 임원</p>
          </div>
        </div>
        <div class="case-body">
          <ul>
            <li>미팅마다 종이 명함 없이 NFC 탭 한 번으로 교환</li>
            <li>연락처 변경 시 실시간 업데이트 — 인쇄 비용 0원</li>
            <li>LinkedIn·SNS 프로필을 명함과 함께 즉시 공유</li>
            <li>여러 개의 명함을 상황에 맞게 전환 가능</li>
          </ul>
        </div>
      </div>
      <div class="case-card">
        <div class="case-header">
          <div class="case-header-icon"><i class="fas fa-building"></i></div>
          <div>
            <h3>팀 · 기업</h3>
            <p>스타트업, 중소기업, 대기업</p>
          </div>
        </div>
        <div class="case-body">
          <ul>
            <li>신규 입사자 명함을 관리자가 즉시 생성 · 배포</li>
            <li>퇴직자 명함은 즉시 비활성화로 보안 유지</li>
            <li>그룹 대시보드에서 전체 멤버 명함 통합 관리</li>
            <li>행사·세미나에서 참가자 명함 교환을 디지털로</li>
          </ul>
        </div>
      </div>
      <div class="case-card">
        <div class="case-header">
          <div class="case-header-icon"><i class="fas fa-laptop-code"></i></div>
          <div>
            <h3>프리랜서 · 크리에이터</h3>
            <p>디자이너, 개발자, 강사, 아티스트</p>
          </div>
        </div>
        <div class="case-body">
          <ul>
            <li>포트폴리오 + 연락처 + SNS를 하나의 링크로</li>
            <li>경력·학력·스킬을 이력서처럼 상세하게 표현</li>
            <li>레슨·수업 일정을 플랫폼에서 직접 관리</li>
            <li>QR 코드를 명함·팸플릿·프레젠테이션에 삽입</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── 사용 방법 ── -->
<section class="section" id="howitworks">
  <div class="container">
    <div style="text-align:center">
      <span class="section-label">사용 방법</span>
      <h2 class="section-title">3분이면 충분합니다</h2>
      <p class="section-sub">복잡한 설정 없이 바로 시작할 수 있습니다.</p>
    </div>
    <div class="steps" style="margin-top:48px">
      <div class="step">
        <div class="step-num">1</div>
        <h3>가입</h3>
        <p>이메일로 30초 만에 무료 계정을 만드세요.</p>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <h3>명함 제작</h3>
        <p>이름, 직함, 연락처, 사진, SNS를 입력하면 명함 완성.</p>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <h3>공유</h3>
        <p>QR 코드 또는 링크로 즉시 공유. NFC 카드 신청도 가능.</p>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <h3>관리</h3>
        <p>대시보드에서 명함 업데이트, 그룹 운영, 행사 관리.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── 요금제 ── -->
<section class="section" id="pricing">
  <div class="container">
    <div style="text-align:center">
      <span class="section-label">요금제</span>
      <h2 class="section-title">필요에 맞는 플랜을</h2>
      <p class="section-sub">무료로 시작하고, 필요할 때 업그레이드하세요.</p>
    </div>
    <div class="pricing-grid">
      <div class="plan-card">
        <div class="plan-name">Free</div>
        <div class="plan-desc">개인 명함을 시작하기에 충분</div>
        <div class="plan-price">무료 <small>/ 영구</small></div>
        <ul class="plan-features">
          <li>디지털 명함 1개</li>
          <li>QR 코드 공유</li>
          <li>기본 연락처 · SNS 링크</li>
          <li>공개 명함 페이지</li>
        </ul>
        <button class="btn-plan btn-plan-outline" onclick="location.href='/app/register'">무료로 시작</button>
      </div>
      <div class="plan-card featured">
        <span class="plan-badge">추천</span>
        <div class="plan-name">Pro</div>
        <div class="plan-desc">개인 사용자를 위한 프리미엄</div>
        <div class="plan-price">앱에서 확인 <small>/ 월</small></div>
        <ul class="plan-features">
          <li>디지털 명함 무제한</li>
          <li>NFC 카드 연동</li>
          <li>경력 · 학력 · 스킬 상세 프로필</li>
          <li>그룹 참여</li>
          <li>포인트 적립</li>
        </ul>
        <button class="btn-plan btn-plan-white" onclick="location.href='/app/register'">시작하기</button>
      </div>
      <div class="plan-card">
        <div class="plan-name">Business</div>
        <div class="plan-desc">팀 · 기업을 위한 그룹 솔루션</div>
        <div class="plan-price">앱에서 확인 <small>/ 월</small></div>
        <ul class="plan-features">
          <li>그룹 개설 · 멤버 관리</li>
          <li>행사 · 이벤트 운영</li>
          <li>레슨 · 일정 관리</li>
          <li>그룹 포인트 시스템</li>
          <li>초대 링크 · 승인 관리</li>
        </ul>
        <button class="btn-plan btn-plan-outline" onclick="location.href='/app/register'">그룹 신청</button>
      </div>
    </div>
    <p class="pricing-note"><i class="fas fa-info-circle" style="margin-right:4px"></i>Pro / Business 플랜 업그레이드는 iOS · Android 앱에서 가능합니다.</p>
  </div>
</section>

<!-- ── 최종 CTA ── -->
<section id="final-cta">
  <h2>지금 바로 시작하세요</h2>
  <p>무료로 가입하고 스마트 디지털 명함을 만들어보세요.</p>
  <div class="cta-btns">
    <button class="btn-hero-primary" onclick="location.href='/app/register'">
      <i class="fas fa-arrow-right" style="margin-right:8px"></i>무료 회원가입
    </button>
    <button class="btn-hero-outline" onclick="openModal()">이미 계정이 있어요</button>
  </div>
</section>

<!-- ── 푸터 ── -->
<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="nav-logo" style="color:white;font-size:18px;font-weight:900;display:flex;align-items:center;gap:9px;margin-bottom:10px">
        <div class="nav-logo-icon"><i class="fas fa-id-card"></i></div>THE METI
      </div>
      <p>스마트 디지털 명함 플랫폼</p>
      <p style="margin-top:6px">주식회사 모빈</p>
    </div>
    <div class="footer-links">
      <h4>서비스</h4>
      <a href="#features">주요 기능</a>
      <a href="#usecases">활용 사례</a>
      <a href="#pricing">요금제</a>
    </div>
    <div class="footer-links">
      <h4>계정</h4>
      <a href="#" onclick="openModal();return false">로그인</a>
      <a href="/app/register">회원가입</a>
    </div>
    <div class="footer-links">
      <h4>법적 정보</h4>
      <a href="/terms" target="_blank">이용약관</a>
      <a href="/privacy" target="_blank">개인정보처리방침</a>
    </div>
    <div class="footer-links">
      <h4>문의</h4>
      <a href="mailto:privacy@mobin-inc.com">privacy@mobin-inc.com</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 주식회사 모빈. All rights reserved.</span>
    <span>THE METI는 주식회사 모빈의 서비스입니다.</span>
  </div>
</footer>

<script>
  // 이미 로그인된 경우 대시보드로
  (function() {
    const token = localStorage.getItem('meti_token');
    const user  = JSON.parse(localStorage.getItem('meti_user') || 'null');
    if (token && user) {
      window.location.href = user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
    }
  })();

  function openModal() {
    document.getElementById('login-modal').classList.add('open');
    setTimeout(() => document.getElementById('m-email').focus(), 150);
  }
  function closeModal() {
    document.getElementById('login-modal').classList.remove('open');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('modal-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('m-email').value.trim();
    const password = document.getElementById('m-password').value;
    const btnText    = document.getElementById('m-btn-text');
    const btnLoading = document.getElementById('m-btn-loading');
    const errorEl    = document.getElementById('modal-error');

    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    errorEl.style.display = 'none';

    try {
      const res  = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('meti_token',         data.data.access_token);
        localStorage.setItem('meti_refresh_token',  data.data.refresh_token);
        localStorage.setItem('meti_user',           JSON.stringify(data.data.user));
        const role = data.data.user.role;
        window.location.href = role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
      } else {
        errorEl.textContent = data.error || '로그인에 실패했습니다.';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = '서버 연결에 실패했습니다.';
      errorEl.style.display = 'block';
    } finally {
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  });
</script>
</body>
</html>`
}

export function appShellHtml(pageTitle: string = 'METI'): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontSize: { 'xs':'11px','sm':'12px','base':'13px','lg':'14px','xl':'15px','2xl':'16px','3xl':'18px' } } } }</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <style>
    html, body { font-size: 13px; }
    /* 사이드바 */
    #sidebar { transition: transform 0.25s ease; }
    @media (max-width: 768px) {
      #sidebar { transform: translateX(-100%); position: fixed; z-index: 50; height: 100vh; }
      #sidebar.open { transform: translateX(0); }
      #sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; }
      #sidebar-overlay.open { display: block; }
    }
    .nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 1rem; border-radius: 0.5rem;
      color: #94a3b8; cursor: pointer; transition: all 0.15s;
      font-size: 13px;
    }
    .nav-item:hover { background: #1e293b; color: #f1f5f9; }
    .nav-item.active { background: #2563eb; color: #fff; }
    .nav-item i { width: 1.1rem; text-align: center; }

    /* 컨텍스트 배지 */
    .ctx-badge {
      font-size: 0.75rem; padding: 0.1rem 0.5rem;
      border-radius: 9999px; font-weight: 600;
    }
    /* 페이지 섹션 */
    .page-section { display: none; }
    .page-section.active { display: block; }

    /* 카드 */
    .stat-card { background: #fff; border-radius: 1rem; padding: 1.25rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .item-card  { background: #fff; border-radius: 0.75rem; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 0.75rem; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- 모바일 오버레이 -->
<div id="sidebar-overlay" onclick="closeSidebar()"></div>

<!-- 레이아웃 -->
<div class="flex min-h-screen">

  <!-- ── 사이드바 ── -->
  <aside id="sidebar" class="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">

    <!-- 로고 -->
    <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
      <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
        <i class="fas fa-id-card text-white text-sm"></i>
      </div>
      <span class="font-bold text-lg text-white">METI</span>
    </div>

    <!-- 컨텍스트 선택 (개인 ↔ 그룹) -->
    <div class="px-4 py-3 border-b border-slate-700">
      <button id="ctx-btn" onclick="toggleContextMenu()"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
        <div class="flex items-center gap-2 min-w-0">
          <i id="ctx-icon" class="fas fa-user text-blue-400 text-xs flex-shrink-0"></i>
          <span id="ctx-name" class="text-sm font-medium text-white truncate">내 계정</span>
        </div>
        <i class="fas fa-chevron-down text-slate-400 text-xs flex-shrink-0 ml-1"></i>
      </button>
      <!-- 드롭다운 -->
      <div id="ctx-menu" class="hidden mt-1 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
        <div id="ctx-menu-items"></div>
      </div>
    </div>

    <!-- 네비게이션 -->
    <nav class="flex-1 px-3 py-3 overflow-y-auto space-y-1" id="nav-menu">
      <!-- JS로 렌더링 -->
    </nav>

    <!-- 하단 사용자 정보 -->
    <div class="px-4 py-4 border-t border-slate-700">
      <div class="flex items-center gap-3">
        <!-- 아바타: 클릭 → 프로필 모달 -->
        <button onclick="openProfileModal()" title="프로필 수정"
          class="relative w-9 h-9 rounded-full flex-shrink-0 group">
          <div id="sidebar-avatar-wrap" class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
            <i id="sidebar-avatar-icon" class="fas fa-user text-white text-sm"></i>
            <img id="sidebar-avatar-img" src="" class="hidden w-9 h-9 object-cover" onerror="this.classList.add('hidden');document.getElementById('sidebar-avatar-icon').classList.remove('hidden')">
          </div>
          <div class="absolute inset-0 rounded-full bg-black/40 hidden group-hover:flex items-center justify-center">
            <i class="fas fa-camera text-white text-xs"></i>
          </div>
        </button>
        <div class="flex-1 min-w-0 cursor-pointer" onclick="openProfileModal()">
          <p id="sidebar-username" class="text-sm font-medium text-white truncate">-</p>
          <p id="sidebar-plan"     class="text-xs text-slate-400 truncate">Free</p>
        </div>
        <button onclick="logout()" title="로그아웃"
          class="text-slate-400 hover:text-white transition">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </aside>

  <!-- ── 메인 콘텐츠 ── -->
  <div class="flex-1 flex flex-col min-w-0">

    <!-- 헤더 -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      <button onclick="openSidebar()" class="md:hidden text-gray-500 hover:text-gray-800">
        <i class="fas fa-bars text-xl"></i>
      </button>
      <h2 id="page-title" class="font-semibold text-gray-800 text-lg flex-1">대시보드</h2>
      <span id="header-ctx-badge" class="ctx-badge bg-blue-100 text-blue-700 hidden"></span>
      <button onclick="showSection('notifications')" class="relative text-gray-500 hover:text-gray-800">
        <i class="fas fa-bell text-xl"></i>
        <span id="notif-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">0</span>
      </button>
    </header>

    <!-- 페이지 콘텐츠 -->
    <main class="flex-1 p-4 md:p-6 overflow-auto">

      <!-- ── [개인] 대시보드 ── -->
      <section id="section-dashboard" class="page-section active">
        <div class="mb-6">
          <h3 class="text-lg font-bold text-gray-800">안녕하세요, <span id="greeting-name">-</span>님 👋</h3>
          <p class="text-gray-500 mt-1">오늘도 좋은 하루 되세요.</p>
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
        <div id="profile-avatar-wrap" class="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
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
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
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
        class="flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">기본 정보</button>
      <button id="edit-tab-resume" onclick="switchEditTab('resume')"
        class="flex-1 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent">이력 &amp; SNS</button>
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
      <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 mt-4">
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
    display: block; width: 100%;
    padding: 0.65rem 0.9rem;
    border: 1px solid #d1d5db; border-radius: 0.5rem;
    font-size: 0.9rem; outline: none; transition: border 0.15s;
  }
  .modal-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
</style>

<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/app.js?v=248d5c8"></script>
</body>
</html>`
}
