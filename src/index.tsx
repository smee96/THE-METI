import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './types'

// Routes
import authRoutes    from './routes/auth'
import cardsRoutes   from './routes/cards'
import groupsRoutes  from './routes/groups'
import eventsRoutes  from './routes/events'
import chatRoutes    from './routes/chat'
import partnerRoutes from './routes/partner'
import adminRoutes    from './routes/admin'
import lessonsRoutes         from './routes/lessons'
import lessonSchedulesRoutes from './routes/lesson-schedules'
import productsRoutes        from './routes/products'
import pointsRoutes   from './routes/points'
import usersRoutes    from './routes/users'
import notificationsRoutes from './routes/notifications'
import staticRouter   from './static-serve'

// Web UI HTML 템플릿
import { adminLoginHtml, adminAppHtml }                from './web/admin'
import { appLandingHtml, appLoginHtml, appRegisterHtml, appShellHtml } from './web/app'
import { privacyPolicyHtml, termsOfServiceHtml }       from './web/legal'
import { paymentChargeSuccessHtml, paymentChargeFailHtml } from './web/payment'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ════════════════════════════════════════════════════════════
// ── 명함 공개 페이지 HTML (함수 먼저 선언)
// ════════════════════════════════════════════════════════════
function cardPublicHtml(cardId: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ELID 디지털 명함</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/static/brand/favicon-180.png">
  <link rel="stylesheet" href="/static/tailwind.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <meta property="og:title" content="ELID 디지털 명함">
  <meta property="og:description" content="QR 코드로 명함을 교환하세요">
  <meta property="og:image" content="https://the-meti.pages.dev/static/brand/og-cover.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="ELID — 연결을 더 가볍게, 비즈니스를 더 스마트하게">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://the-meti.pages.dev/static/brand/og-cover.jpg">
  <style>
    .section-title { font-size:.7rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:.5rem; }
    .tag-chip { display:inline-block; padding:.2rem .6rem; border-radius:9999px; font-size:.72rem; font-weight:500; background:#eff6ff; color:#2563eb; margin:.15rem; }
    .tag-chip.skill     { background:#f0fdf4; color:#16a34a; }
    .tag-chip.education { background:#faf5ff; color:#9333ea; }
    .tag-chip.career    { background:#fff7ed; color:#ea580c; }
    .sns-icon { width:2rem; height:2rem; border-radius:.5rem; display:flex; align-items:center; justify-content:center; font-size:.85rem; }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-100 to-blue-50 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- ELID 워터마크 -->
    <div class="text-center mb-4">
      <p class="text-xs text-gray-400 font-semibold tracking-widest">EL<span style="color:#C9A86A">I</span>D</p>
    </div>

    <!-- 로딩 -->
    <div id="card-loading" class="bg-white rounded-3xl shadow-xl p-8 text-center">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mb-3"></i>
      <p class="text-gray-400 text-sm">명함 불러오는 중...</p>
    </div>

    <!-- 명함 본체 -->
    <div id="card-content" class="hidden space-y-3">

      <!-- ① 명함 페이스 (선택한 디자인 레이아웃으로 JS 렌더 — 카탈로그 기반) -->
      <div id="card-face" style="position:relative;width:100%;aspect-ratio:1.62/1;min-height:212px;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(14,23,38,.18);font-family:-apple-system,'Pretendard',system-ui,sans-serif;"></div>

      <!-- ② 연락처 -->
      <div id="contact-section" class="hidden bg-white rounded-2xl shadow p-4 space-y-2.5">
        <p class="section-title">연락처</p>
        <div id="card-email"   class="hidden flex items-center gap-3">
          <span class="sns-icon bg-red-50 text-red-500"><i class="fas fa-envelope text-sm"></i></span>
          <a id="email-val" class="text-sm text-gray-700 hover:text-blue-600"></a>
        </div>
        <div id="card-phone"   class="hidden flex items-center gap-3">
          <span class="sns-icon bg-green-50 text-green-600"><i class="fas fa-phone text-sm"></i></span>
          <a id="phone-val" class="text-sm text-gray-700 hover:text-blue-600"></a>
        </div>
        <div id="card-website" class="hidden flex items-center gap-3">
          <span class="sns-icon bg-blue-50 text-blue-500"><i class="fas fa-globe text-sm"></i></span>
          <a id="website-val" class="text-sm text-blue-600 hover:underline truncate"></a>
        </div>
      </div>

      <!-- ③ 소개 -->
      <div id="bio-section" class="hidden bg-white rounded-2xl shadow p-4">
        <p class="section-title">소개</p>
        <p id="card-bio" class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"></p>
      </div>

      <!-- ④ SNS 링크 -->
      <div id="sns-section" class="hidden bg-white rounded-2xl shadow p-4">
        <p class="section-title">소셜 링크</p>
        <div id="sns-list" class="flex flex-wrap gap-2 mt-1"></div>
      </div>

      <!-- ⑤ 경력 -->
      <div id="career-section" class="hidden bg-white rounded-2xl shadow p-4">
        <p class="section-title"><i class="fas fa-briefcase mr-1"></i>경력</p>
        <div id="career-list" class="space-y-2 mt-1"></div>
      </div>

      <!-- ⑥ 학력 -->
      <div id="education-section" class="hidden bg-white rounded-2xl shadow p-4">
        <p class="section-title"><i class="fas fa-graduation-cap mr-1"></i>학력</p>
        <div id="education-list" class="space-y-2 mt-1"></div>
      </div>

      <!-- ⑦ 스킬 / 기타 태그 -->
      <div id="skill-section" class="hidden bg-white rounded-2xl shadow p-4">
        <p class="section-title"><i class="fas fa-tags mr-1"></i>스킬 &amp; 키워드</p>
        <div id="skill-list" class="mt-1"></div>
      </div>

      <!-- ⑧ CTA -->
      <a href="https://the-meti.pages.dev" target="_blank"
        class="block w-full py-3.5 bg-blue-600 text-white text-center rounded-2xl font-semibold hover:bg-blue-700 transition shadow">
        <i class="fas fa-id-card mr-2"></i>ELID로 명함 교환하기
      </a>
    </div>

    <!-- 에러 -->
    <div id="card-error" class="hidden bg-white rounded-3xl shadow-xl p-8 text-center">
      <i class="fas fa-exclamation-circle text-red-400 text-3xl mb-3"></i>
      <p class="text-gray-500">명함을 찾을 수 없습니다.</p>
    </div>
  </div>

  <script>
    const SNS_META = {
      linkedin:  { icon:'fab fa-linkedin',  bg:'bg-blue-700',   color:'text-white',  label:'LinkedIn' },
      instagram: { icon:'fab fa-instagram', bg:'bg-pink-500',   color:'text-white',  label:'Instagram' },
      twitter:   { icon:'fab fa-twitter',   bg:'bg-sky-500',    color:'text-white',  label:'Twitter/X' },
      facebook:  { icon:'fab fa-facebook',  bg:'bg-blue-600',   color:'text-white',  label:'Facebook' },
      github:    { icon:'fab fa-github',    bg:'bg-gray-800',   color:'text-white',  label:'GitHub' },
      youtube:   { icon:'fab fa-youtube',   bg:'bg-red-600',    color:'text-white',  label:'YouTube' },
      tiktok:    { icon:'fab fa-tiktok',    bg:'bg-gray-900',   color:'text-white',  label:'TikTok' },
      blog:      { icon:'fas fa-rss',       bg:'bg-orange-500', color:'text-white',  label:'블로그' },
    };

    function esc(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── 명함 디자인 카탈로그 기반 렌더 (7 레이아웃) ──
    // 카탈로그: /static/card-designs/catalog.json — 앱과 동일 소스 (핸드오프 2026-07-22)
    // 레이아웃: solid / classic / split / serif / band / mono / edge
    var CATALOG = null, BYID = {}, ALIAS = {};
    function resolveDesign(tid) {
      var id = tid || '';
      if (!BYID[id] && ALIAS[id]) id = ALIAS[id];        // 구 template_id 전체 → 신규 자동매핑
      if (BYID[id]) return BYID[id];
      // 합성 레거시 id(예: ocean_coral__center) → 팔레트 부분만 별칭/매칭 (앱 회신 2026-07-22 §2, 앱과 동일 폴백)
      var pal = String(tid || '').split('__')[0];
      if (ALIAS[pal] && BYID[ALIAS[pal]]) return BYID[ALIAS[pal]];
      if (BYID[pal]) return BYID[pal];
      var def = (CATALOG && CATALOG.default) || 'deepblue__classic';
      return BYID[def] || null;
    }
    function isLight(hex) {
      var h = String(hex||'').replace('#','');
      if (h.length < 6) return false;
      var r=parseInt(h.substr(0,2),16), g=parseInt(h.substr(2,2),16), b=parseInt(h.substr(4,2),16);
      return (0.2126*r + 0.7152*g + 0.0722*b) > 140;
    }
    function cr(lbl, val, lc, vc) {   // 연락처 라벨행 (classic/edge)
      if (!val) return '';
      return '<div style="display:flex;gap:9px;font-size:11px;margin-top:4px;line-height:1.5;">'
        + '<span style="color:'+lc+';width:11px;flex-shrink:0;font-weight:700;">'+lbl+'</span>'
        + '<span style="color:'+vc+';word-break:break-all;">'+val+'</span></div>';
    }
    function lines(items) {
      return items.filter(function(x){return !!x;}).map(function(x){return '<div>'+x+'</div>';}).join('');
    }
    function cardFace(card, d) {
      var name = esc(card.name||''), title = esc(card.title||''), company = esc(card.company||'ELID');
      var email = esc(card.email||''), phone = esc(card.phone||''), web = esc(card.website||'');
      var mono = ((card.company||card.name||'M').trim().charAt(0) || 'M').toUpperCase();
      var bg1=d.bg_primary, onP=d.on_primary, subP=d.sub_primary;
      var bg2=d.bg_secondary, onS=d.on_secondary, subS=d.sub_secondary, acc=d.accent||onP;
      var lead = email || phone || web;

      if (d.layout === 'split') {
        var roleC = isLight(bg2) ? acc : subS;
        return '<div style="position:absolute;inset:0;display:flex;">'
          + '<div style="width:42%;background:'+bg1+';color:'+onP+';padding:8% 7%;display:flex;flex-direction:column;justify-content:space-between;">'
          +   '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;line-height:1.35;">'+company+'</div>'
          +   '<div style="width:24px;height:3px;border-radius:2px;background:'+(isLight(bg1)?acc:onP)+';"></div></div>'
          + '<div style="flex:1;background:'+bg2+';color:'+onS+';padding:8% 7%;display:flex;flex-direction:column;justify-content:center;">'
          +   '<div style="font-size:22px;font-weight:800;line-height:1.1;">'+name+'</div>'
          +   (title?'<div style="font-size:12px;font-weight:600;color:'+roleC+';margin-top:3px;">'+title+'</div>':'')
          +   '<div style="margin-top:14px;color:'+subS+';font-size:11px;line-height:1.6;">'+lines([phone,email,web])+'</div>'
          + '</div></div>';
      }
      if (d.layout === 'band') {
        return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;">'
          + '<div style="height:56%;background:'+bg1+';color:'+onP+';padding:7% 8% 5%;display:flex;flex-direction:column;justify-content:space-between;">'
          +   '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
          +     '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.35;max-width:62%;">'+company+'</span>'
          +     '<span style="font-size:10px;letter-spacing:.18em;color:'+subP+';">STUDIO</span></div>'
          +   '<div style="font-size:23px;font-weight:800;">'+name+'</div></div>'
          + '<div style="flex:1;background:'+bg2+';color:'+onS+';padding:0 8%;display:flex;align-items:center;justify-content:space-between;gap:10px;">'
          +   '<span style="font-size:12px;color:'+subS+';">'+title+'</span>'
          +   '<div style="text-align:right;font-size:11px;color:'+subS+';line-height:1.6;">'+lines([phone,email])+'</div>'
          + '</div></div>';
      }
      if (d.layout === 'serif') {
        return '<div style="position:absolute;inset:0;background:'+bg1+';color:'+onP+';padding:9% 8%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:Georgia,serif;">'
          + '<div style="font-size:19px;font-weight:700;letter-spacing:.02em;">'+company+'</div>'
          + '<div style="width:26px;height:1px;background:'+subP+';margin:9px 0;"></div>'
          + '<div style="font-size:27px;font-weight:700;line-height:1.1;">'+name+'</div>'
          + (title?'<div style="font-size:12px;color:'+subP+';margin-top:6px;">'+title+'</div>':'')
          + (lead?'<div style="font-size:11px;color:'+subP+';margin-top:13px;">'+[phone,email].filter(function(x){return !!x;}).join('  ·  ')+'</div>':'')
          + '</div>';
      }
      if (d.layout === 'mono') {
        var rule = (acc && acc !== onP) ? acc : subP;
        return '<div style="position:absolute;inset:0;background:'+bg1+';color:'+onP+';">'
          + '<div style="position:absolute;top:8%;left:8%;right:8%;display:flex;justify-content:space-between;align-items:flex-start;">'
          +   '<div><div style="font-size:17px;font-weight:800;letter-spacing:.02em;">'+company+'</div>'
          +   '<div style="font-size:9px;letter-spacing:.2em;color:'+subP+';margin-top:3px;text-transform:uppercase;">Digital Business Card</div></div>'
          +   '<div style="width:2px;height:32px;background:'+rule+';"></div></div>'
          + '<div style="position:absolute;left:8%;bottom:8%;font-size:23px;font-weight:800;">'+name
          +   (title?'<div style="font-size:12px;font-weight:500;color:'+subP+';margin-top:2px;">'+title+'</div>':'')+'</div>'
          + '<div style="position:absolute;right:8%;bottom:8%;text-align:right;font-size:11px;color:'+subP+';line-height:1.6;">'+lines([phone,email])+'</div>'
          + '</div>';
      }
      if (d.layout === 'classic') {
        return '<div style="position:absolute;inset:0;background:'+bg1+';color:'+onP+';padding:8%;display:flex;flex-direction:column;justify-content:space-between;">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
          +   '<div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.3;border-bottom:1px solid '+subP+';padding-bottom:7px;">'+company+'</div>'
          +   '<span style="font-size:9px;letter-spacing:.18em;color:'+subP+';white-space:nowrap;">DIGITAL CARD</span></div>'
          + '<div><div style="font-size:24px;font-weight:800;">'+name+'</div>'
          +   (title?'<div style="font-size:12px;color:'+subP+';margin-top:3px;">'+title+'</div>':'')
          +   '<div style="margin-top:12px;">'+cr('T',phone,subP,onP)+cr('E',email,subP,onP)+cr('W',web,subP,onP)+'</div></div></div>';
      }
      if (d.layout === 'edge') {
        return '<div style="position:absolute;inset:0;background:'+bg1+';color:'+onP+';padding:8%;display:flex;flex-direction:column;justify-content:space-between;">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
          +   '<div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">'+company+'</div>'
          +   '<div style="width:30px;height:30px;border:1.5px solid '+acc+';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:'+acc+';">'+mono+'</div></div>'
          + '<div><div style="font-size:24px;font-weight:800;">'+name+'</div>'
          +   (title?'<div style="font-size:12px;color:'+subP+';margin-top:2px;">'+title+'</div>':'')
          +   '<div style="margin-top:12px;">'+cr('T',phone,subP,onP)+cr('E',email,subP,onP)+'</div></div></div>';
      }
      // solid (기본)
      return '<div style="position:absolute;inset:0;background:'+bg1+';color:'+onP+';padding:9% 8%;display:flex;flex-direction:column;justify-content:space-between;">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
        +   '<div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.35;max-width:62%;">'+company+'</div>'
        +   '<div style="width:32px;height:32px;border:1.5px solid '+onP+';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;opacity:.92;">'+mono+'</div></div>'
        + '<div><div style="font-size:26px;font-weight:800;letter-spacing:-.01em;">'+name+'</div>'
        +   (title?'<div style="font-size:13px;color:'+subP+';margin-top:2px;">'+title+'</div>':'')
        +   (lead?'<div style="display:flex;align-items:center;gap:7px;font-size:12px;color:'+subP+';margin-top:10px;"><span style="width:5px;height:5px;border-radius:50%;background:'+onP+';display:inline-block;flex-shrink:0;"></span>'+lead+'</div>':'')
        + '</div></div>';
    }

    Promise.all([
      fetch('/static/card-designs/catalog.json').then(r => r.json()).catch(() => null),
      fetch('/api/v1/cards/public/${cardId}').then(r => r.json())
    ])
      .then(([cat, data]) => {
        document.getElementById('card-loading').classList.add('hidden');
        if (!data.success) { document.getElementById('card-error').classList.remove('hidden'); return; }
        const card = data.data;

        document.getElementById('card-content').classList.remove('hidden');
        document.title = (card.name || 'ELID') + ' - 디지털 명함';

        // ① 명함 페이스 — 선택한 디자인 레이아웃으로 렌더 (구 template_id는 legacy_alias로 자동매핑)
        if (cat) { CATALOG = cat; (cat.designs||[]).forEach(function(d){ BYID[d.template_id] = d; }); ALIAS = cat.legacy_alias || {}; }
        const design = resolveDesign(card.template_id);
        document.getElementById('card-face').innerHTML = design ? cardFace(card, design) : '';

        // ② 연락처
        let hasContact = false;
        if (card.email)   { document.getElementById('card-email').classList.remove('hidden');
                            const a = document.getElementById('email-val'); a.textContent = card.email; a.href = 'mailto:' + card.email; hasContact = true; }
        if (card.phone)   { document.getElementById('card-phone').classList.remove('hidden');
                            const a = document.getElementById('phone-val'); a.textContent = card.phone; a.href = 'tel:' + card.phone; hasContact = true; }
        if (card.website) { document.getElementById('card-website').classList.remove('hidden');
                            const a = document.getElementById('website-val'); a.textContent = card.website; a.href = card.website; a.target='_blank'; hasContact = true; }
        if (hasContact) document.getElementById('contact-section').classList.remove('hidden');

        // ③ 소개
        if (card.bio) {
          document.getElementById('bio-section').classList.remove('hidden');
          document.getElementById('card-bio').textContent = card.bio;
        }

        // ④ SNS 링크
        const sns = card.sns_links || [];
        if (sns.length > 0) {
          document.getElementById('sns-section').classList.remove('hidden');
          const snsList = document.getElementById('sns-list');
          snsList.innerHTML = sns.map(s => {
            const m = SNS_META[s.platform] || { icon:'fas fa-link', bg:'bg-gray-200', color:'text-gray-700', label: s.platform };
            return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" '
              + 'class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-100 hover:shadow transition text-sm font-medium text-gray-700">'
              + '<span class="w-6 h-6 rounded-lg ' + m.bg + ' ' + m.color + ' flex items-center justify-center text-xs"><i class="' + m.icon + '"></i></span>'
              + esc(m.label) + '</a>';
          }).join('');
        }

        // ⑤⑥⑦ 태그 분류 처리
        const tags = card.tags || [];
        const careers    = tags.filter(t => t.tag_type === 'career');
        const educations = tags.filter(t => t.tag_type === 'education');
        const skills     = tags.filter(t => t.tag_type === 'skill' || t.tag_type === 'keyword');
        const others     = tags.filter(t => !['career','education','skill','keyword'].includes(t.tag_type));

        // 경력/학력 공통 행 (tag_period 분리 저장분은 기간을 오른쪽에 표시)
        const resumeRow = (t, dotColor) =>
          '<div class="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">'
          + '<i class="fas fa-circle ' + dotColor + ' text-[5px] mt-2 flex-shrink-0"></i>'
          + '<p class="text-sm text-gray-700 flex-1">' + esc(t.tag_value) + '</p>'
          + (t.tag_period ? '<span class="text-xs text-gray-400 flex-shrink-0 mt-0.5">' + esc(t.tag_period) + '</span>' : '')
          + '</div>';

        // 경력
        if (careers.length > 0) {
          document.getElementById('career-section').classList.remove('hidden');
          document.getElementById('career-list').innerHTML =
            careers.map(t => resumeRow(t, 'text-orange-400')).join('');
        }

        // 학력
        if (educations.length > 0) {
          document.getElementById('education-section').classList.remove('hidden');
          document.getElementById('education-list').innerHTML =
            educations.map(t => resumeRow(t, 'text-purple-400')).join('');
        }

        // 스킬 + 기타
        const allSkills = [...skills, ...others];
        if (allSkills.length > 0) {
          document.getElementById('skill-section').classList.remove('hidden');
          document.getElementById('skill-list').innerHTML = allSkills.map(t =>
            '<span class="tag-chip ' + esc(t.tag_type) + '">' + esc(t.tag_value) + '</span>'
          ).join('');
        }
      })
      .catch(() => {
        document.getElementById('card-loading').classList.add('hidden');
        document.getElementById('card-error').classList.remove('hidden');
      });
  </script>
</body>
</html>`
}

// ── 글로벌 미들웨어 ───────────────────────────────────────
app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'https://meti.io',
    'https://admin.meti.io',
    'https://my.meti.io',
    'https://the-meti.pages.dev',
    'https://www.the-meti.pages.dev',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Partner-API-Key'],
  exposeHeaders: ['X-Total-Count'],
  maxAge: 86400,
  credentials: true,
}))

// ── 정적 파일 (인라인 번들링) ───────────────────────────────
app.route('/static', staticRouter)

// ── API 라우트 (v1) ───────────────────────────────────────
app.route('/api/v1/auth',    authRoutes)
app.route('/api/v1/cards',   cardsRoutes)
app.route('/api/v1/groups',  groupsRoutes)
app.route('/api/v1/events',   eventsRoutes)
app.route('/api/v1/chat',     chatRoutes)
app.route('/api/v1/partner',  partnerRoutes)
app.route('/api/v1/admin',    adminRoutes)
app.route('/api/v1/lessons',   lessonsRoutes)
app.route('/api/v1/lessons',   lessonSchedulesRoutes)  // schedules / students 하위 경로
app.route('/api/v1/points',   pointsRoutes)
app.route('/api/v1/users',    usersRoutes)          // 디바이스 토큰(FCM)
app.route('/api/v1/notifications', notificationsRoutes)
app.route('/api/v1',          productsRoutes)  // /groups/:id/products, /orders, /payments

// ── 헬스체크 ──────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'ELID Backend', version: '1.0.0' })
)

// ════════════════════════════════════════════════════════════
// ── Admin Web UI  (/admin)
// ════════════════════════════════════════════════════════════
app.get('/admin',        (c) => c.redirect('/admin/login'))
app.get('/admin/login',  (c) => c.html(adminLoginHtml()))
app.get('/admin/*',      (c) => c.html(adminAppHtml()))

// ════════════════════════════════════════════════════════════
// ── App Web UI  (/app)
//    사용자 + 그룹관리자 웹
//
//  /app/login          로그인 (공통 진입점)
//  /app/register       회원가입
//  /app/dashboard      개인 대시보드
//  /app/cards          내 명함 관리
//  /app/groups         내 그룹 목록 (소속 전체)
//  /app/points         개인 포인트
//  /app/subscription   구독 현황
//  /app/group/:id/*    그룹 관리 (group_admin 전용)
//    └─ /app/group/:id/dashboard
//    └─ /app/group/:id/members
//    └─ /app/group/:id/events
//    └─ /app/group/:id/points
//    └─ /app/group/:id/lessons
//    └─ /app/group/:id/invites
// ════════════════════════════════════════════════════════════

// 랜딩 페이지 (메인) + 로그인
app.get('/',             (c) => c.html(appLandingHtml()))
app.get('/login',        (c) => c.html(appLoginHtml()))
app.get('/app/login',    (c) => c.redirect('/login'))
app.get('/app/register', (c) => c.html(appRegisterHtml()))
app.get('/app',          (c) => c.redirect('/'))

// 나머지 /app/* 전체 → SPA shell (JS가 라우팅 처리)
app.get('/app/*', (c) => c.html(appShellHtml('ELID')))

// ── 포인트 충전 결제 리다이렉트 (토스 successUrl/failUrl) ──
app.get('/payment/charge/success', (c) => c.html(paymentChargeSuccessHtml()))
app.get('/payment/charge/fail',    (c) => c.html(paymentChargeFailHtml()))

// ════════════════════════════════════════════════════════════
// ── 명함 공개 페이지 (앱 미설치자용)
// ════════════════════════════════════════════════════════════
app.get('/card/:id', (c) => {
  const cardId = c.req.param('id')
  return c.html(cardPublicHtml(cardId))
})

// QR 토큰 스캔(앱 미설치자의 일반 카메라) → 공개 카드 뷰(HTML).
// 앱은 qr_url(`/cards/qr/{token}` — /api/v1 접두어 없음)을 origin에 붙여 QR을 만들기 때문에,
// 브라우저가 이 웹 경로로 진입한다. in-app 교환용 JSON API는 /api/v1/cards/qr/:token 로 그대로 유지.
// 유효(미만료) 토큰 → 200(카드 렌더), 무효/만료 → 404. (브라우저 뷰이므로 used_at 소비하지 않음)
app.get('/cards/qr/:token', async (c) => {
  const token = c.req.param('token')
  const rec = await c.env.DB.prepare(
    `SELECT card_id FROM qr_tokens WHERE token = ? AND expires_at > datetime('now')`
  ).bind(token).first<{ card_id: number }>()
  if (!rec) {
    return c.html('<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ELID</title></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:64px 24px;color:#64748b"><p style="font-size:13px;letter-spacing:.2em;color:#94a3b8">EL<span style="color:#C9A86A">I</span>D</p><h1 style="font-size:17px;margin-top:20px;color:#334155">유효하지 않거나 만료된 QR 코드입니다.</h1></body></html>', 404)
  }
  return c.html(cardPublicHtml(String(rec.card_id)))
})

// ════════════════════════════════════════════════════════════
// ── 법적 문서 (개인정보처리방침 / 이용약관) ─────────────────
app.get('/privacy', (c) => c.html(privacyPolicyHtml()))
app.get('/terms',   (c) => c.html(termsOfServiceHtml()))

// ── 그룹 초대 페이지 (앱 미설치자용)
// ════════════════════════════════════════════════════════════
function invitePageHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ELID 그룹 초대</title>
  <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/static/brand/favicon-16.png">
  <link rel="apple-touch-icon" href="/static/brand/favicon-180.png">
  <link rel="stylesheet" href="/static/tailwind.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <meta property="og:title" content="ELID 그룹 초대">
  <meta property="og:description" content="ELID 그룹에 초대되었습니다.">
  <meta property="og:image" content="https://the-meti.pages.dev/static/brand/og-cover.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="ELID — 연결을 더 가볍게, 비즈니스를 더 스마트하게">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://the-meti.pages.dev/static/brand/og-cover.jpg">
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
  <div id="container" class="w-full max-w-sm">
    <!-- ELID 로고 -->
    <div class="text-center mb-6">
      <p class="text-sm text-gray-500 font-semibold tracking-widest">EL<span style="color:#C9A86A">I</span>D</p>
    </div>

    <!-- 로딩 -->
    <div id="invite-loading" class="bg-white rounded-3xl shadow-2xl p-8 text-center">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mb-3"></i>
      <p class="text-gray-500">초대 정보 확인 중...</p>
    </div>

    <!-- 초대 정보 -->
    <div id="invite-content" class="hidden bg-white rounded-3xl shadow-2xl overflow-hidden">
      <!-- 헤더 -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
        <div class="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-users text-white text-2xl"></i>
        </div>
        <p class="text-blue-200 text-sm mb-1">그룹 초대</p>
        <h1 id="invite-group-name" class="text-xl font-bold"></h1>
        <p id="invite-label" class="text-blue-200 text-sm mt-1 hidden"></p>
      </div>

      <!-- 초대 정보 -->
      <div class="p-6 space-y-3">
        <div id="invite-uses" class="hidden flex items-center gap-3 text-gray-600 text-sm">
          <i class="fas fa-users text-blue-500 w-5 text-center"></i>
          <span id="uses-val"></span>
        </div>
        <div id="invite-expires" class="hidden flex items-center gap-3 text-gray-600 text-sm">
          <i class="fas fa-clock text-blue-500 w-5 text-center"></i>
          <span id="expires-val"></span>
        </div>
        <div class="flex items-center gap-3 text-gray-600 text-sm">
          <i class="fas fa-info-circle text-blue-500 w-5 text-center"></i>
          <span>앱에서 참여하거나 아래 버튼을 눌러 가입하세요.</span>
        </div>
      </div>

      <!-- 버튼 영역 -->
      <div class="px-6 pb-6 space-y-3" id="invite-actions">
        <!-- JS로 동적 렌더 -->
      </div>
    </div>

    <!-- 에러 -->
    <div id="invite-error" class="hidden bg-white rounded-3xl shadow-2xl p-8 text-center">
      <i class="fas fa-exclamation-circle text-red-400 text-3xl mb-3"></i>
      <p id="invite-error-msg" class="text-gray-600">유효하지 않은 초대 링크입니다.</p>
      <a href="https://meti.io" class="mt-4 inline-block text-blue-600 text-sm hover:underline">ELID 홈으로 이동</a>
    </div>
  </div>

  <script>
    const TOKEN = '${token}';
    const APP_SCHEME = 'meti://invite/' + TOKEN;  // 딥링크

    async function init() {
      try {
        const res = await fetch('/api/v1/groups/invite/' + TOKEN);
        const data = await res.json();

        document.getElementById('invite-loading').classList.add('hidden');

        if (!data.success) {
          document.getElementById('invite-error-msg').textContent = data.message || '유효하지 않은 초대 링크입니다.';
          document.getElementById('invite-error').classList.remove('hidden');
          return;
        }

        const inv = data.data;

        // 그룹명 / 라벨
        document.getElementById('invite-group-name').textContent = inv.group_name || '그룹';
        if (inv.label) {
          const el = document.getElementById('invite-label');
          el.textContent = inv.label;
          el.classList.remove('hidden');
        }

        // 사용 횟수
        if (inv.max_uses) {
          const el = document.getElementById('invite-uses');
          document.getElementById('uses-val').textContent = '남은 초대 횟수: ' + (inv.max_uses - (inv.used_count || 0)) + ' / ' + inv.max_uses;
          el.classList.remove('hidden');
        }

        // 만료일
        if (inv.expires_at) {
          const el = document.getElementById('invite-expires');
          const d = new Date(inv.expires_at);
          document.getElementById('expires-val').textContent = '만료일: ' + d.toLocaleDateString('ko-KR');
          el.classList.remove('hidden');
        }

        // 버튼
        document.getElementById('invite-actions').innerHTML = \`
          <a href="\${APP_SCHEME}"
            class="block w-full py-3 bg-blue-600 text-white text-center rounded-xl font-semibold hover:bg-blue-700 transition">
            <i class="fas fa-mobile-alt mr-2"></i>앱에서 참여하기
          </a>
          <a href="/app/login?redirect=invite&token=\${TOKEN}"
            class="block w-full py-3 border border-blue-600 text-blue-600 text-center rounded-xl font-semibold hover:bg-blue-50 transition text-sm">
            <i class="fas fa-sign-in-alt mr-2"></i>로그인 후 웹에서 참여
          </a>
          <p class="text-center text-sm text-gray-400">앱이 없으신가요?
            <a href="https://meti.io" class="text-blue-600 hover:underline">ELID 다운로드</a>
          </p>
        \`;

        document.getElementById('invite-content').classList.remove('hidden');
        document.title = (inv.group_name || '그룹') + ' - ELID 그룹 초대';

      } catch (e) {
        document.getElementById('invite-loading').classList.add('hidden');
        document.getElementById('invite-error').classList.remove('hidden');
      }
    }

    init();
  </script>
</body>
</html>`
}

app.get('/invite/:token', (c) => {
  const token = c.req.param('token')
  return c.html(invitePageHtml(token))
})

// ── 미매칭 폴백(전역 404) ─────────────────────────────────
// ⚠️ 반드시 명시적 catch-all 라우트로 처리한다(단순 app.notFound 의존 금지).
// 원인: @hono/vite-cloudflare-pages 래퍼가 `worker.notFound(app.notFoundHandler)`로 설정하는데
// Hono 4.12에서 notFoundHandler는 private 필드라 `app.notFoundHandler`가 undefined → worker의
// notFound가 undefined가 된다. 그 결과 "미매칭 + 매칭 미들웨어 1개(logger)"인 요청은 Hono의
// 단일 미들웨어 fast-path에서 `undefined.call()`을 호출해 500이 났다(모든 미지 URL이 500).
// 명시적 catch-all은 항상 매칭되어 fast-path(length===1)를 피하므로 정상 404를 반환한다.
app.all('*', (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '요청한 엔드포인트를 찾을 수 없습니다.' }, 404)
  }
  return c.html('<h1>Not Found</h1>', 404)
})

// 방어용(도달하지 않지만 유지) — 상단 catch-all이 실제 404를 담당
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '요청한 엔드포인트를 찾을 수 없습니다.' }, 404)
  }
  return c.html('<h1>Not Found</h1>', 404)
})

// ── 글로벌 에러 핸들러 ────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: '서버 오류가 발생했습니다.' }, 500)
  }
  return c.html('<h1>Internal Server Error</h1>', 500)
})


export default app
