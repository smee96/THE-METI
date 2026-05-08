-- ============================================================
-- Migration 0017: 플랜별 명함 수량 제한 + 추가 명함 단가
-- METI Service v1.5 (2026-05-08)
-- ============================================================

-- ── 1. plans 테이블: free_card_limit 컬럼 추가 ────────────
-- 기존 max_cards 는 "최대 명함 수(무제한=NULL)" 의미였으나,
-- v1.5 에서는 "플랜별 기본 무료 제공 명함 수"로 재정의.
-- 혼선을 피하기 위해 free_card_limit 컬럼을 별도 추가.
ALTER TABLE plans ADD COLUMN free_card_limit INTEGER NOT NULL DEFAULT 1;

-- 플랜별 기본 명함 수 설정
UPDATE plans SET free_card_limit = 1  WHERE code = 'free';
UPDATE plans SET free_card_limit = 3  WHERE code = 'pro';
UPDATE plans SET free_card_limit = 10 WHERE code = 'business';

-- ── 2. plan_configs: 추가 명함 단가 설정 ─────────────────
-- plan_configs 테이블이 없으면 신규 생성
CREATE TABLE IF NOT EXISTS plan_configs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key  TEXT    NOT NULL UNIQUE,
  config_val  TEXT    NOT NULL,
  description TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 추가 명함 단가: 기본 5,000원 (어드민 패널에서 변경 가능)
INSERT OR IGNORE INTO plan_configs (config_key, config_val, description) VALUES
  ('extra_card_price',     '5000',  '기본 제공 외 추가 명함 1개당 가격 (원)'),
  ('point_expiry_days',    '90',    '충전/보상 포인트 만료일 (일)'),
  ('min_point_charge',     '10000', '포인트 직접 충전 최소 금액 (원)');

-- ── 3. point_prices: 명함 추가 비용 업데이트 ─────────────
-- 기존 0013 에서 card_extra = 1000P 로 설정되어 있으나,
-- v1.5 에서 명함 추가는 "포인트 차감"이 아닌 "웹 결제(5,000원)" 방식으로 변경.
-- 기존 레코드를 비활성화하고 웹 결제 상품으로 대체.
UPDATE point_prices SET is_active = 0 WHERE feature = 'card_extra';

-- ── 4. 포인트 충전 상품 등록 (products 테이블) ────────────
-- group_id = 0 또는 NULL 은 시스템 상품을 의미하므로,
-- 시스템 포인트 충전 상품은 별도 system_products 방식 대신
-- group_id = NULL 허용을 위해 REFERENCES 를 nullable 로 처리.
-- (products.group_id 가 NOT NULL 이므로, 포인트 충전은 별도 테이블 사용)

CREATE TABLE IF NOT EXISTS point_charge_products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  amount_krw   INTEGER NOT NULL,   -- 결제 금액 (원)
  points       INTEGER NOT NULL,   -- 지급 포인트
  is_custom    INTEGER NOT NULL DEFAULT 0,  -- 1: 직접입력 상품
  min_amount   INTEGER,            -- 직접입력 최소 금액 (is_custom=1 일 때)
  is_active    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO point_charge_products (title, amount_krw, points, is_custom, sort_order) VALUES
  ('포인트 10,000P',  10000,  10000,  0, 1),
  ('포인트 100,000P', 100000, 100000, 0, 2),
  ('포인트 500,000P', 500000, 500000, 0, 3),
  ('직접 입력',       0,      0,      1, 4);  -- 직접입력: min 10,000원

-- ── 5. 인덱스 ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_configs_key ON plan_configs(config_key);
