-- ============================================================
-- Migration 0016: 포인트 만료 정책 + 일회성 결제 토큰
-- METI Service v1.5 (2026-05-08)
-- ============================================================

-- ── 1. point_transactions: point_type 컬럼 추가 ──────────
-- 기존 expires_at 는 이미 존재. point_type 만 추가.
-- 'subscription': 구독 지급 포인트 → 다음 갱신일 만료
-- 'charged'     : 직접 충전 포인트 → 충전 후 90일 만료
-- 'reward'      : 이벤트/보상 포인트 → 적립 후 90일 만료
-- 'transfer'    : 이전/환불 포인트 → 90일 만료
ALTER TABLE point_transactions ADD COLUMN point_type TEXT NOT NULL DEFAULT 'reward'
  CHECK(point_type IN ('subscription','charged','reward','transfer'));

-- ── 2. payment_tokens: 일회성 결제 토큰 테이블 ───────────
-- 앱 WebView → 결제 페이지 인증에 사용
-- 5분 유효, 1회 사용 즉시 무효화
CREATE TABLE IF NOT EXISTS payment_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,         -- 랜덤 UUID 기반 토큰
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  is_used    INTEGER NOT NULL DEFAULT 0,      -- 0: 미사용, 1: 사용됨
  expires_at DATETIME NOT NULL,               -- 발급 후 5분
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_tokens_token      ON payment_tokens(token);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_user_id    ON payment_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_expires_at ON payment_tokens(expires_at);

-- ── 3. payments: pg 컬럼 값 범위 확장 메모 ────────────────
-- 기존 pg TEXT 컬럼에 'toss' | 'stripe' | NULL(inapp) 사용
-- (ALTER 불필요, TEXT 컬럼이므로 값 추가 가능)

-- ── 4. point_wallets: 포인트 만료 처리용 인덱스 추가 ──────
-- 만료 배치 처리 시 expires_at 기준 빠른 조회를 위해
CREATE INDEX IF NOT EXISTS idx_point_tx_expires_at ON point_transactions(expires_at);
CREATE INDEX IF NOT EXISTS idx_point_tx_point_type ON point_transactions(point_type);
