# METI 디자인 시스템

> 디지털 명함 네트워킹 플랫폼 **METI** 의 브랜드 & UI 가이드.
> 메인 컬러는 **진한 잉크 네이비**, 악센트는 **골드(샴페인)**.
> 토큰 파일: [`tokens.json`](./tokens.json) · [`tokens.css`](./tokens.css) · [`tokens.ts`](./tokens.ts)

---

## 1. 브랜드 컨셉

**"프리미엄 명함, 디지털로 다시 태어나다."**
종이 명함의 격(格)을 디지털로 옮긴다. 네이비를 '명함의 바탕재(stock)'로, 골드를 '금박(foil)'으로 사용해
고급 인쇄 명함의 물성을 화면에서 재현한다. 과한 그라데이션·이모지·네온은 지양하고, 절제된 대비와 여백으로 신뢰감을 만든다.

---

## 2. 컬러

### 메인 — 잉크 네이비
| 토큰 | HEX | 용도 |
|---|---|---|
| `navy` | `#0B1E40` | **메인 컬러.** 명함 본체, 사이드바, 1차 버튼, 강조 텍스트 |
| `navyDeep` | `#06122A` | 명함 그라데이션 하단, 깊은 그림자 |
| `navyGlow` | `#1C3D72` | 명함 상단 광택 하이라이트 |

### 악센트 — 골드
| 토큰 | HEX | 용도 |
|---|---|---|
| `gold` | `#C9A86A` | **앱 기본 악센트.** 금박 디테일, 활성 상태, 포인트 |
| `goldAdmin` | `#C2974E` | 밝은 배경(웹 어드민)에서 가독성 보정한 골드 |
| `goldDeep` | `#9A7333` | 골드 그라데이션/텍스트 대비 |

> **악센트 교체 옵션** — 동일 채도·명도로 hue만 바꾼 4종 제공: `gold`(기본) · `mint` · `coral` · `violet`.
> 앱 내 Tweaks 패널에서 전환 가능. **기본값은 navy + gold 고정.**

### 시맨틱 (Light / Dark)
| 역할 | Light | Dark |
|---|---|---|
| 배경 `bg` | `#F4F5F8` | `#0C0F16` |
| 표면 `surface` | `#FFFFFF` | `#161A23` |
| 본문 `ink` | `#0E1726` | `#F2F4F8` |
| 보조 `sub` | `#5B6577` | `#A7B0C0` |
| 흐림 `mute` | `#8B95A6` | `#727C8C` |
| 구분선 `line` | `rgba(14,23,38,.08)` | `rgba(255,255,255,.09)` |

### 상태
`success #1B9C73` · `danger #D8513C` · `warn #C98A1E` · `info #3470C4`
(각 12~13% 투명도 `soft` 배경과 함께 뱃지로 사용)

---

## 3. 디지털 명함 (핵심 오브젝트)

```css
background: radial-gradient(130% 130% at 78% -10%,
  #1C3D72 0%, #0B1E40 42%, #06122A 100%);   /* glow → base → deep */
border-radius: 22px;
box-shadow: 0 2px 4px rgba(6,18,42,.25), 0 18px 40px -12px rgba(6,18,42,.55);
```
- 골드 1px 헤어라인 테두리(투명도 40%)로 금박 가장자리 표현
- `repeating-linear-gradient` 미세 사선(기요셰) 텍스처로 보안 인쇄 느낌
- 워드마크 **MET + 골드 I**, NFC 글리프, 이름(28~30px Bold), 직함, 회사(골드)
- 종횡비 1.62:1 (실제 명함 비율). 탭하면 앞면 ↔ QR면 전환

---

## 4. 타이포그래피

- **서체:** Pretendard (한글 가독성 우선) — [CDN](https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css)
- **워드마크:** `METI` 대문자, 자간 0.18~0.22em, 마지막 `I`만 골드

| 단계 | 크기 | 굵기 |
|---|---|---|
| display | 30 | 700 |
| title | 26 | 800 |
| heading | 19 | 700 |
| body | 15 | 500 |
| label | 13 | 600 |
| caption | 12 | 600 |

숫자는 `font-variant-numeric: tabular-nums` (대시보드 지표 정렬).

---

## 5. 컴포넌트 규칙

- **라운드:** 카드 18~22 · 입력/버튼 11~15 · 칩/뱃지 7~10 · pill 9999
- **그림자:** 가볍게. Light 모드만 부드러운 2단 섀도, Dark 모드는 1px 보더로 분리
- **버튼:** 1차 = navy 배경/흰 글씨, 2차 = surface + 1px line, 악센트는 골드를 텍스트·아이콘에
- **간격:** 4의 배수 스케일 (4·8·12·16·20·24·32)
- **레이아웃:** flex/grid + `gap`. 인라인 마진 나열 지양

---

## 6. 적용 표면

| 표면 | 설명 |
|---|---|
| **iOS / Android 앱** | 홈 · 명함첩 · NFC/QR 교환 · 커뮤니티 · 내 명함. Light 기본, Dark 지원 |
| **웹 어드민** | 네이비 사이드바 + 골드 악센트. 대시보드/유저/그룹/신고/NFC/파트너/리워드 |
| **공개 명함 페이지** | 앱 미설치자용 `/card/:id` |

---

## 7. 빠른 사용 예

```ts
import meti from './tokens';
const c = meti.light;                 // 또는 meti.dark
<View style={{ background: c.surface, borderRadius: meti.radius.card }}>
  <Text style={{ color: meti.palette.navy }}>…</Text>
</View>
```
```css
@import './tokens.css';
.btn-primary { background: var(--meti-navy); color: #fff; border-radius: var(--meti-r-md); }
.foil { color: var(--meti-gold); }
```

---

_v1.0.0 · 2026-06-14 — 시각 레퍼런스는 [`reference.html`](./reference.html) 참고._
