// 개인정보처리방침 · 이용약관 HTML
// 보호자 항목은 미성년 가입 차단 정책 확정 시 제거 예정

const COMPANY = '주식회사 메티'
const SERVICE = 'ELID'
const CONTACT_EMAIL = 'privacy@mobin-inc.com'
const EFFECTIVE_DATE = '2026년 6월 7일'

const baseStyle = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    h2 { font-size: 1.1rem; font-weight: 700; margin-top: 2rem; margin-bottom: .5rem; color: #1e293b; }
    h3 { font-size: .95rem; font-weight: 600; margin-top: 1.2rem; margin-bottom: .3rem; color: #334155; }
    p, li { font-size: .9rem; line-height: 1.8; color: #475569; }
    ul, ol { padding-left: 1.2rem; margin-bottom: .8rem; }
    li { margin-bottom: .2rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; margin: .8rem 0; }
    th { background: #f1f5f9; color: #334155; font-weight: 600; padding: .5rem .75rem; text-align: left; border: 1px solid #e2e8f0; }
    td { padding: .45rem .75rem; border: 1px solid #e2e8f0; color: #475569; vertical-align: top; }
    .badge { display:inline-block; padding:.15rem .5rem; border-radius:9999px; font-size:.75rem; font-weight:600; background:#eff6ff; color:#2563eb; }
  </style>
`

// ────────────────────────────────────────────────────────────
// 개인정보처리방침
// ────────────────────────────────────────────────────────────
export function privacyPolicyHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  ${baseStyle}
  <title>개인정보처리방침 — ${SERVICE}</title>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-2xl mx-auto px-5 py-10">

    <!-- 헤더 -->
    <div class="mb-8">
      <p class="text-xs font-bold tracking-widest text-blue-600 mb-1">${SERVICE}</p>
      <h1 class="text-2xl font-bold text-slate-800">개인정보처리방침</h1>
      <p class="text-sm text-slate-400 mt-1">시행일: ${EFFECTIVE_DATE}</p>
    </div>

    <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm text-blue-700 leading-relaxed">
      ${COMPANY}(이하 "회사")는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고,
      이와 관련한 고충을 신속하게 처리하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
    </div>

    <!-- 1. 처리 목적 -->
    <h2>제1조 개인정보의 처리 목적</h2>
    <p>회사는 다음의 목적을 위해 개인정보를 처리합니다. 처리한 개인정보는 아래 목적 이외의 용도로 사용하지 않으며, 목적이 변경될 경우 사전에 별도 동의를 받습니다.</p>
    <ul>
      <li>회원 가입·관리 및 본인 확인</li>
      <li>디지털 명함 생성·교환 및 인맥 관리 서비스 제공</li>
      <li>그룹·행사·레슨 서비스 운영</li>
      <li>채팅·커뮤니티 서비스 제공</li>
      <li>구독 플랜 결제 및 포인트 시스템 운영</li>
      <li>고객 문의 처리 및 공지사항 전달</li>
      <li>서비스 개선 및 통계 분석</li>
      <li>광고·마케팅 활용 (별도 동의 시)</li>
    </ul>

    <!-- 2. 처리 항목 -->
    <h2>제2조 처리하는 개인정보 항목</h2>

    <h3>① 회원 가입 시 (필수)</h3>
    <table>
      <tr><th>항목</th><th>비고</th></tr>
      <tr><td>이름</td><td>서비스 내 표시 이름</td></tr>
      <tr><td>이메일 주소</td><td>로그인 ID, 이메일 인증에 사용</td></tr>
      <tr><td>비밀번호</td><td>bcrypt 단방향 암호화 저장</td></tr>
      <tr><td>전화번호</td><td>계정 인증·연락 수단</td></tr>
    </table>

    <h3>② 명함 등록 시 (선택)</h3>
    <table>
      <tr><th>항목</th><th>비고</th></tr>
      <tr><td>직함, 회사명, 부서</td><td>명함에 표시되는 회사 정보</td></tr>
      <tr><td>경력·학력·스킬·키워드 태그</td><td>이력 정보</td></tr>
      <tr><td>SNS 링크</td><td>LinkedIn, Instagram 등</td></tr>
      <tr><td>웹사이트 URL</td><td></td></tr>
      <tr><td>소개(Bio)</td><td></td></tr>
      <tr><td>프로필 사진·명함 사진</td><td>Cloudflare R2 저장</td></tr>
    </table>

    <h3>③ 서비스 이용 중 자동 수집</h3>
    <table>
      <tr><th>항목</th><th>비고</th></tr>
      <tr><td>채팅 메시지·첨부파일</td><td>플랜별 보관 기간 적용 (제4조 참조)</td></tr>
      <tr><td>접속 IP, 기기 정보, 이용 기록</td><td>서비스 보안·통계 목적</td></tr>
    </table>

    <h3>④ 결제 시</h3>
    <table>
      <tr><th>항목</th><th>비고</th></tr>
      <tr><td>구독 플랜 정보, 결제 수단 식별자</td><td>Apple IAP / Google Play 처리, 카드번호 등 민감 결제 정보는 회사가 직접 보유하지 않음</td></tr>
    </table>

    <h3>⑤ 보호자 등록 시 (선택)</h3>
    <table>
      <tr><th>항목</th><th>비고</th></tr>
      <tr><td>보호자 이름, 연락처</td><td>미성년 회원의 레슨 등록·관리 목적</td></tr>
    </table>

    <!-- 3. 보유 기간 -->
    <h2>제3조 개인정보의 처리 및 보유 기간</h2>
    <p>회사는 법령에 따른 보유 기간 또는 이용자로부터 동의받은 기간 동안 개인정보를 보유·처리합니다. 탈퇴 시 지체 없이 파기하되, 아래 법령 의무 보유 항목은 예외입니다.</p>
    <table>
      <tr><th>항목</th><th>보유 기간</th><th>근거</th></tr>
      <tr><td>회원 계정 정보</td><td>탈퇴 후 즉시 파기 (단, 분쟁 우려 시 30일)</td><td>회사 내부 정책</td></tr>
      <tr><td>채팅 메시지 (free 플랜)</td><td>1일</td><td>서비스 정책</td></tr>
      <tr><td>채팅 메시지 (pro 플랜)</td><td>90일</td><td>서비스 정책</td></tr>
      <tr><td>채팅 메시지 (business 플랜)</td><td>무제한</td><td>서비스 정책</td></tr>
      <tr><td>결제·전자상거래 기록</td><td>5년</td><td>전자상거래법</td></tr>
      <tr><td>소비자 불만·분쟁 기록</td><td>3년</td><td>전자상거래법</td></tr>
      <tr><td>접속 로그</td><td>3개월</td><td>통신비밀보호법</td></tr>
    </table>

    <!-- 4. 제3자 제공 -->
    <h2>제4조 개인정보의 제3자 제공</h2>
    <p>회사는 원칙적으로 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다. 다만, 이용자가 별도로 동의한 경우 또는 법령에 따른 경우에 한해 아래와 같이 제공할 수 있습니다.</p>
    <table>
      <tr><th>제공받는 자</th><th>제공 목적</th><th>제공 항목</th><th>보유 기간</th></tr>
      <tr><td>광고 파트너사</td><td>맞춤형 광고 제공</td><td>기기 식별자, 이용 행태 (비식별화)</td><td>동의 철회 시 즉시 파기</td></tr>
      <tr><td>파트너 서비스</td><td>연동 서비스 이용</td><td>이름, 이메일 (이용자 선택 시)</td><td>제공 목적 달성 시 파기</td></tr>
    </table>
    <p>이용자는 제3자 제공 동의를 거부할 수 있으며, 거부 시 일부 기능이 제한될 수 있습니다.</p>

    <!-- 5. 처리 위탁 -->
    <h2>제5조 개인정보 처리 위탁</h2>
    <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.</p>
    <table>
      <tr><th>수탁사</th><th>위탁 업무</th></tr>
      <tr><td>Cloudflare, Inc.</td><td>서버 운영, 파일(사진·문서) 저장 (R2), CDN</td></tr>
      <tr><td>Apple Inc.</td><td>iOS 앱 내 결제 처리 (IAP)</td></tr>
      <tr><td>Google LLC</td><td>Android 앱 내 결제 처리 (Play Billing)</td></tr>
    </table>

    <!-- 6. 이용자 권리 -->
    <h2>제6조 이용자의 권리와 행사 방법</h2>
    <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
    <ul>
      <li>개인정보 열람 요청</li>
      <li>오류 정정·삭제 요청</li>
      <li>처리 정지 요청</li>
      <li>제3자 제공 동의 철회</li>
    </ul>
    <p>권리 행사는 앱 내 설정 메뉴 또는 <a href="mailto:${CONTACT_EMAIL}" class="text-blue-600 underline">${CONTACT_EMAIL}</a>로 이메일 요청 시 10일 이내 처리합니다.</p>

    <!-- 7. 안전성 확보 조치 -->
    <h2>제7조 개인정보의 안전성 확보 조치</h2>
    <ul>
      <li>비밀번호 bcrypt 단방향 암호화 저장</li>
      <li>HTTPS/TLS 전송 암호화</li>
      <li>접근 권한 최소화 및 관리자 계정 별도 관리</li>
      <li>접속 기록 보관 및 위·변조 방지</li>
    </ul>

    <!-- 8. 자동 수집 -->
    <h2>제8조 쿠키 및 자동 수집 장치</h2>
    <p>서비스는 로그인 상태 유지를 위해 JWT 기반 인증 토큰을 사용합니다. 광고·분석 목적의 쿠키가 사용될 경우 별도 안내 후 동의를 받습니다.</p>

    <!-- 9. 아동 -->
    <h2>제9조 만 14세 미만 아동의 개인정보</h2>
    <p>서비스는 원칙적으로 만 14세 미만 아동의 가입을 제한합니다. 레슨·행사 참여를 위해 보호자가 대신 가입하는 경우, 보호자의 이름과 연락처를 수집합니다.</p>

    <!-- 10. 책임자 -->
    <h2>제10조 개인정보 보호책임자</h2>
    <table>
      <tr><th>구분</th><th>내용</th></tr>
      <tr><td>회사명</td><td>${COMPANY}</td></tr>
      <tr><td>이메일</td><td><a href="mailto:${CONTACT_EMAIL}" class="text-blue-600">${CONTACT_EMAIL}</a></td></tr>
    </table>
    <p>개인정보 관련 불만·침해 신고는 아래 기관에도 접수할 수 있습니다.</p>
    <ul>
      <li>개인정보 침해 신고센터: <a href="https://privacy.kisa.or.kr" class="text-blue-600" target="_blank">privacy.kisa.or.kr</a> / 국번없이 118</li>
      <li>개인정보 분쟁조정위원회: <a href="https://www.kopico.go.kr" class="text-blue-600" target="_blank">www.kopico.go.kr</a> / 1833-6972</li>
    </ul>

    <!-- 11. 변경 -->
    <h2>제11조 개인정보처리방침 변경</h2>
    <p>이 방침은 ${EFFECTIVE_DATE}부터 적용됩니다. 변경 시 앱 내 공지 또는 이메일로 7일 전 사전 고지합니다.</p>

    <div class="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 text-center">
      © ${COMPANY} · 시행일 ${EFFECTIVE_DATE}
    </div>
  </div>
</body>
</html>`
}

// ────────────────────────────────────────────────────────────
// 이용약관
// ────────────────────────────────────────────────────────────
export function termsOfServiceHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  ${baseStyle}
  <title>이용약관 — ${SERVICE}</title>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-2xl mx-auto px-5 py-10">

    <!-- 헤더 -->
    <div class="mb-8">
      <p class="text-xs font-bold tracking-widest text-blue-600 mb-1">${SERVICE}</p>
      <h1 class="text-2xl font-bold text-slate-800">이용약관</h1>
      <p class="text-sm text-slate-400 mt-1">시행일: ${EFFECTIVE_DATE}</p>
    </div>

    <!-- 제1조 -->
    <h2>제1조 목적</h2>
    <p>이 약관은 ${COMPANY}(이하 "회사")가 제공하는 ${SERVICE} 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 등을 규정함을 목적으로 합니다.</p>

    <!-- 제2조 -->
    <h2>제2조 용어 정의</h2>
    <ul>
      <li><strong>"서비스"</strong>란 ${SERVICE} 앱 및 웹(https://the-meti.pages.dev)을 통해 제공되는 디지털 명함 교환, 그룹·행사·레슨 관리, 채팅, 포인트 등 일체의 서비스를 말합니다.</li>
      <li><strong>"이용자"</strong>란 이 약관에 동의하고 서비스를 이용하는 회원을 말합니다.</li>
      <li><strong>"명함"</strong>이란 이용자가 서비스 내에서 생성하는 디지털 명함 정보를 말합니다.</li>
      <li><strong>"그룹"</strong>이란 이용자들이 공통 목적으로 구성하는 서비스 내 모임 단위를 말합니다.</li>
      <li><strong>"포인트"</strong>란 서비스 내 유료 기능 이용에 사용되는 가상 화폐를 말합니다.</li>
    </ul>

    <!-- 제3조 -->
    <h2>제3조 약관의 게시 및 변경</h2>
    <ol>
      <li>회사는 이 약관을 서비스 내 설정 메뉴 및 https://the-meti.pages.dev/terms 에 게시합니다.</li>
      <li>회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행일 7일 전부터 공지합니다. 중요 사항 변경 시에는 30일 전 공지합니다.</li>
      <li>이용자가 변경 약관 시행일 이후에도 서비스를 계속 이용하면 변경 약관에 동의한 것으로 간주합니다.</li>
    </ol>

    <!-- 제4조 -->
    <h2>제4조 서비스의 제공 및 변경</h2>
    <ol>
      <li>회사는 연중무휴 24시간 서비스를 제공합니다. 단, 시스템 점검·장애·천재지변 등으로 일시 중단될 수 있습니다.</li>
      <li>회사는 서비스의 내용·기능을 변경하거나 종료할 수 있으며, 중요 변경 시 사전에 공지합니다.</li>
    </ol>

    <!-- 제5조 -->
    <h2>제5조 회원 가입 및 자격</h2>
    <ol>
      <li>서비스는 원칙적으로 만 14세 이상만 가입할 수 있습니다.</li>
      <li>이용자는 정확한 정보를 입력하여 가입해야 하며, 허위 정보 입력 시 서비스 이용이 제한될 수 있습니다.</li>
      <li>이메일 인증을 완료해야 정상적으로 서비스를 이용할 수 있습니다.</li>
      <li>1인 1계정 원칙을 적용합니다. 다수 계정으로 서비스를 악용하는 경우 모든 계정을 제재할 수 있습니다.</li>
    </ol>

    <!-- 제6조 -->
    <h2>제6조 계정 관리 및 보안</h2>
    <ol>
      <li>계정 정보 관리 책임은 이용자에게 있습니다. 타인에게 계정을 양도하거나 공유해서는 안 됩니다.</li>
      <li>계정 도용·보안 침해가 의심되는 경우 즉시 비밀번호를 변경하고 회사에 신고해야 합니다.</li>
      <li>이용자 부주의로 인한 계정 피해에 대해 회사는 책임을 지지 않습니다.</li>
    </ol>

    <!-- 제7조 -->
    <h2>제7조 플랜 및 결제</h2>
    <ol>
      <li>서비스는 free·pro·business 플랜을 제공합니다. 유료 플랜은 Apple IAP 또는 Google Play Billing을 통해 결제합니다.</li>
      <li>구독 요금은 각 앱스토어 정책에 따라 자동 갱신되며, 갱신 24시간 전까지 취소하지 않으면 자동 결제됩니다.</li>
      <li>환불은 각 앱스토어(Apple App Store / Google Play)의 환불 정책을 따릅니다.</li>
      <li>포인트는 현금으로 환전되지 않으며, 서비스 내에서만 사용할 수 있습니다.</li>
      <li>유료 플랜 해지 시 현재 구독 기간이 만료될 때까지 해당 플랜의 혜택이 유지됩니다.</li>
    </ol>

    <!-- 제8조 -->
    <h2>제8조 게시물 및 콘텐츠</h2>
    <ol>
      <li>이용자가 서비스 내에 등록한 명함 정보, 사진, 채팅 메시지 등의 저작권은 해당 이용자에게 있습니다.</li>
      <li>이용자는 회사에게 서비스 운영·홍보에 필요한 범위 내에서 콘텐츠를 무상으로 사용할 수 있는 라이선스를 부여합니다.</li>
      <li>회사는 법령 위반, 타인 권리 침해, 서비스 방해 등에 해당하는 게시물을 사전 통보 없이 삭제할 수 있습니다.</li>
    </ol>

    <!-- 제9조 -->
    <h2>제9조 금지 행위</h2>
    <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
    <ul>
      <li>타인의 정보를 도용하거나 허위 명함을 생성하는 행위</li>
      <li>스팸, 광고성 메시지를 무단 발송하는 행위</li>
      <li>서비스를 해킹·크롤링하거나 비정상적인 방법으로 접근하는 행위</li>
      <li>타인의 명예를 훼손하거나 개인정보를 침해하는 행위</li>
      <li>포인트·결제 시스템을 부정하게 이용하는 행위</li>
      <li>관련 법령을 위반하는 일체의 행위</li>
    </ul>

    <!-- 제10조 -->
    <h2>제10조 서비스 이용 제한</h2>
    <ol>
      <li>회사는 이용자가 제9조를 위반하거나 서비스 운영을 방해하는 경우 경고·일시 정지·영구 정지 조치를 취할 수 있습니다.</li>
      <li>제재 조치에 이의가 있는 경우 ${CONTACT_EMAIL}로 이의 신청할 수 있습니다.</li>
    </ol>

    <!-- 제11조 -->
    <h2>제11조 회원 탈퇴</h2>
    <ol>
      <li>이용자는 언제든지 앱 설정 메뉴에서 탈퇴할 수 있습니다.</li>
      <li>탈퇴 시 계정 정보 및 명함은 즉시 삭제됩니다. 단, 법령에 따른 보존 의무 정보는 해당 기간 동안 보관됩니다.</li>
      <li>그룹 관리자가 탈퇴하는 경우, 그룹의 다른 멤버에게 관리자 권한이 이전되거나 그룹이 해산될 수 있습니다.</li>
    </ol>

    <!-- 제12조 -->
    <h2>제12조 면책 조항</h2>
    <ol>
      <li>회사는 천재지변, 전쟁, 해킹 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
      <li>회사는 이용자가 서비스를 통해 교환·공유한 정보의 정확성·신뢰성에 대해 보증하지 않습니다.</li>
      <li>회사는 이용자 간의 분쟁에 개입하지 않으며, 이로 인한 손해에 대해 책임을 지지 않습니다.</li>
    </ol>

    <!-- 제13조 -->
    <h2>제13조 준거법 및 관할 법원</h2>
    <p>이 약관은 대한민국 법률에 따라 해석되며, 서비스 이용으로 인한 분쟁은 서울중앙지방법원을 전속 관할 법원으로 합니다.</p>

    <div class="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 text-center">
      © ${COMPANY} · 시행일 ${EFFECTIVE_DATE}
    </div>
  </div>
</body>
</html>`
}
