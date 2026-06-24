-- ============================================================
-- Migration 0021: 파트너 포인트 일원화 + 정산 데이터 적재
-- 결정사항(2026-06-24):
--  · 파트너 리워드 적립을 reward_balances → point_wallets 로 단일화
--  · 정산 모델 = 유저가 파트너(해피트리)에서 소진한 금액의 15% 수수료(레브셰어)
-- ============================================================

-- ── 1. partner_services: 파트너별 정산 수수료율 ──────────────
-- 기본 0.15 (= 15%). 파트너별 계약에 따라 어드민이 조정.
ALTER TABLE partner_services ADD COLUMN commission_rate REAL NOT NULL DEFAULT 0.15;

-- ── 2. partner_reward_events: 정산용 금액 컬럼 ───────────────
-- 기존엔 points_awarded(유저 적립)만 있어 B2B 정산액 산출 불가 → 금액/통화/정산액 추가
ALTER TABLE partner_reward_events ADD COLUMN gross_amount      INTEGER;          -- 유저 소진 원금(해당 통화 최소단위)
ALTER TABLE partner_reward_events ADD COLUMN currency          TEXT;             -- ISO 4217 (KRW, USD ...)
ALTER TABLE partner_reward_events ADD COLUMN commission_rate   REAL;             -- 적용 수수료율 스냅샷
ALTER TABLE partner_reward_events ADD COLUMN settlement_amount INTEGER NOT NULL DEFAULT 0;  -- METI 수취분 = floor(gross * rate)
ALTER TABLE partner_reward_events ADD COLUMN billing_period    TEXT;             -- YYYY-MM
ALTER TABLE partner_reward_events ADD COLUMN settlement_status TEXT NOT NULL DEFAULT 'pending';  -- pending|invoiced|paid

CREATE INDEX IF NOT EXISTS idx_pre_billing ON partner_reward_events(partner_id, billing_period);

-- ── 3. partner_settlements: 월·파트너·통화 단위 정산 집계 ────
-- 월 B2B 인보이스 산출용 누적 합계.
CREATE TABLE IF NOT EXISTS partner_settlements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id       INTEGER NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
  billing_period   TEXT    NOT NULL,                 -- YYYY-MM
  currency         TEXT    NOT NULL,                 -- ISO 4217
  gross_total      INTEGER NOT NULL DEFAULT 0,       -- 유저 소진 합계
  settlement_total INTEGER NOT NULL DEFAULT 0,       -- METI 수취 합계
  event_count      INTEGER NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'pending',  -- pending|invoiced|paid
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, billing_period, currency)
);

CREATE INDEX IF NOT EXISTS idx_partner_settlements_period ON partner_settlements(billing_period);

-- ── 4. reward_balances → point_wallets 일원화 (1회 이관) ─────
-- 기존 파트너 리워드 잔액을 유저 포인트 지갑으로 합산 이관.
INSERT INTO point_wallets (owner_type, owner_id, balance, total_charged)
  SELECT 'user', user_id, points, points FROM reward_balances WHERE points > 0
ON CONFLICT(owner_type, owner_id)
  DO UPDATE SET balance       = balance + excluded.balance,
                total_charged = total_charged + excluded.total_charged,
                updated_at    = CURRENT_TIMESTAMP;

-- 이관 후 잔액 0으로 비움 (중복 적립 방지 / 테이블 폐기 예정 표시)
UPDATE reward_balances SET points = 0;
