/** @type {import('tailwindcss').Config} */
// 정적 빌드용 설정 — 기존 런타임 Play CDN(cdn.tailwindcss.com)을 대체.
// 콘텐츠(셸 HTML 문자열 + SPA가 문자열로 생성하는 마크업)를 스캔해 사용된 유틸만 생성한다.
export default {
  content: [
    './src/**/*.{ts,tsx}',   // 셸 HTML(app/admin/legal/payment) + 명함 공개 페이지 등
    './public/static/*.js',  // SPA가 런타임에 생성하는 마크업(문자열)
  ],
  // 문자열 보간으로 만들어져 스캐너가 못 잡는 동적 클래스 (app.js: text-${p.color}-600)
  safelist: [
    'text-gray-600', 'text-blue-600', 'text-purple-600',
  ],
  theme: { extend: {} },
  plugins: [],
}
