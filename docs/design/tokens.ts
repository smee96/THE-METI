// METI Design Tokens — TypeScript  v1.0.0
// 메인 컬러: 진한 잉크 네이비 / 악센트: 골드. RN·웹 공용.

export const palette = {
  navy:      '#0B1E40',
  navyDeep:  '#06122A',
  navyGlow:  '#1C3D72',
  gold:      '#C9A86A',   // 앱 기본 악센트
  goldDeep:  '#9A7333',
  goldAdmin: '#C2974E',   // 밝은 배경(어드민)용
  goldSoft:  'rgba(201,168,106,0.14)',
} as const;

// 악센트 대체 옵션 — 동일 채도·명도, hue만 변경 (기본 gold)
export const accents = {
  gold:   { solid: '#C9A86A',                 soft: 'rgba(201,168,106,0.14)' },
  mint:   { solid: 'oklch(0.74 0.095 168)',   soft: 'oklch(0.74 0.095 168 / 0.14)' },
  coral:  { solid: 'oklch(0.72 0.12 33)',     soft: 'oklch(0.72 0.12 33 / 0.13)' },
  violet: { solid: 'oklch(0.66 0.13 290)',    soft: 'oklch(0.66 0.13 290 / 0.13)' },
} as const;

// 디지털 명함 마감재 (radial: base→deep, glow=상단 광택)
export const cardFinish = {
  navy:     { base: '#0B1E40', deep: '#06122A', glow: '#1C3D72' },
  midnight: { base: '#14161C', deep: '#070809', glow: '#2A2E38' },
  teal:     { base: '#06303A', deep: '#021C23', glow: '#0C5163' },
} as const;

export const light = {
  bg: '#F4F5F8', surface: '#FFFFFF', surface2: '#F7F8FA',
  ink: '#0E1726', sub: '#5B6577', mute: '#8B95A6',
  line: 'rgba(14,23,38,0.08)', line2: 'rgba(14,23,38,0.05)',
} as const;

export const dark = {
  bg: '#0C0F16', surface: '#161A23', surface2: '#1E232E',
  ink: '#F2F4F8', sub: '#A7B0C0', mute: '#727C8C',
  line: 'rgba(255,255,255,0.09)', line2: 'rgba(255,255,255,0.06)',
} as const;

export const status = {
  success: { fg: '#1B9C73', soft: 'rgba(27,156,115,0.12)' },
  danger:  { fg: '#D8513C', soft: 'rgba(216,81,60,0.12)' },
  warn:    { fg: '#C98A1E', soft: 'rgba(201,138,30,0.13)' },
  info:    { fg: '#3470C4', soft: 'rgba(52,112,196,0.12)' },
} as const;

export const typography = {
  fontFamily: 'Pretendard, -apple-system, system-ui, sans-serif',
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  scale: {
    display: { size: 30, weight: 700, tracking: -0.02 },
    title:   { size: 26, weight: 800, tracking: -0.02 },
    heading: { size: 19, weight: 700, tracking: -0.01 },
    body:    { size: 15, weight: 500 },
    label:   { size: 13, weight: 600 },
    caption: { size: 12, weight: 600 },
  },
} as const;

export const radius  = { sm: 8, md: 14, lg: 18, card: 22, pill: 9999 } as const;
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

export const elevation = {
  card:   '0 1px 2px rgba(14,23,38,0.04), 0 8px 24px rgba(14,23,38,0.04)',
  raised: '0 2px 4px rgba(6,18,42,0.25), 0 18px 40px -12px rgba(6,18,42,0.55)',
} as const;

export const meti = { palette, accents, cardFinish, light, dark, status, typography, radius, spacing, elevation };
export default meti;
