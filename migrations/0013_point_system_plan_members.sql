-- ============================================================
-- METI DB Migration 0013: 포인트 시스템 + 플랜 멤버수 제한
-- ============================================================

-- ── 1. plans 테이블 컬럼 추가 ────────────────────────────────
ALTER TABLE plans ADD COLUMN monthly_points    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN point_expire_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE plans ADD COLUMN max_group_members INTEGER;  -- NULL = 무제한
ALTER TABLE plans ADD COLUMN updated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 플랜별 기본값 설정
-- free: 그룹 생성/관리 가능, 최대 멤버 2명
-- pro: 최대 멤버 10명
-- business: 무제한
UPDATE plans SET monthly_points = 0,      point_expire_days = 90, max_group_members = 2    WHERE code = 'free';
UPDATE plans SET monthly_points = 10000,  point_expire_days = 90, max_group_members = 10   WHERE code = 'pro';
UPDATE plans SET monthly_points = 500000, point_expire_days = 90, max_group_members = NULL  WHERE code = 'business';

-- ── 2. subscriptions 테이블 컬럼 추가 ────────────────────────
ALTER TABLE subscriptions ADD COLUMN pg_provider          TEXT;   -- 'apple_iap'|'google_iap'
ALTER TABLE subscriptions ADD COLUMN pg_subscription_id   TEXT;
ALTER TABLE subscriptions ADD COLUMN current_period_start DATETIME;
ALTER TABLE subscriptions ADD COLUMN current_period_end   DATETIME;
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0;

-- ── 3. payments 테이블 컬럼 추가 ─────────────────────────────
ALTER TABLE payments ADD COLUMN order_no      TEXT;
ALTER TABLE payments ADD COLUMN wallet_id     INTEGER;
ALTER TABLE payments ADD COLUMN payment_type  TEXT DEFAULT 'subscription';
ALTER TABLE payments ADD COLUMN points_to_add INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN pg_provider   TEXT;
ALTER TABLE payments ADD COLUMN pg_raw        TEXT;
ALTER TABLE payments ADD COLUMN plan          TEXT;

-- ── 4. point_wallets 신규 테이블 ─────────────────────────────
CREATE TABLE IF NOT EXISTS point_wallets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type    TEXT    NOT NULL CHECK(owner_type IN ('user','group')),
  owner_id      INTEGER NOT NULL,
  balance       INTEGER NOT NULL DEFAULT 0,
  total_charged INTEGER NOT NULL DEFAULT 0,
  total_used    INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id)
);

-- ── 5. point_transactions 신규 테이블 ────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id     INTEGER NOT NULL REFERENCES point_wallets(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,
  -- charge_subscription | charge_purchase | charge_admin | charge_transfer_in
  -- use_card_extra | use_event_create | use_nfc_card | use_partner | use_transfer_out
  -- expire
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  ref_type      TEXT,
  ref_id        INTEGER,
  description   TEXT,
  expires_at    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. point_prices 신규 테이블 ──────────────────────────────
CREATE TABLE IF NOT EXISTS point_prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feature     TEXT    NOT NULL UNIQUE,
  price       INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO point_prices (feature, price, description) VALUES
  ('card_extra',   1000,  '명함 추가 생성 (한도 초과 1개당)'),
  ('group_create',    0,  '그룹 생성 (무료)'),
  ('event_create', 3000,  '행사 개설'),
  ('nfc_basic',   15000,  'NFC 실물카드 발급 - 기본형'),
  ('nfc_premium', 30000,  'NFC 실물카드 발급 - 프리미엄');

-- ── 7. 인덱스 ─────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_wallets_owner  ON point_wallets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_wallet   ON point_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type     ON point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_ref      ON point_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_no           ON payments(order_no);
