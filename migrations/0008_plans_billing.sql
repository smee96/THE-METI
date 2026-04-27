-- ============================================================
-- METI DB Migration 0008: Plans & Billing (요금제/결제)
-- ============================================================

-- 요금제 정의 (시스템 관리)
CREATE TABLE IF NOT EXISTS plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT UNIQUE NOT NULL,  -- free | pro | business
  name         TEXT NOT NULL,
  target       TEXT NOT NULL DEFAULT 'user',  -- user | group
  price_monthly INTEGER NOT NULL DEFAULT 0,   -- 월 가격 (원)
  price_yearly  INTEGER NOT NULL DEFAULT 0,   -- 연 가격 (원)
  max_cards     INTEGER,   -- NULL = 무제한
  max_groups    INTEGER,
  features      TEXT,      -- JSON: 기능 플래그 목록
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 구독 내역
CREATE TABLE IF NOT EXISTS subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id     INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  plan_id      INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  period       TEXT NOT NULL DEFAULT 'monthly',  -- monthly | yearly
  status       TEXT NOT NULL DEFAULT 'active',   -- active | cancelled | expired | paused
  starts_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME,
  cancelled_at DATETIME,
  payment_ref  TEXT,   -- PG사 결제 참조번호
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 결제 내역
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount          INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'KRW',
  payment_method  TEXT,           -- card | vbank | etc
  payment_gateway TEXT,           -- 추후 PG사 결정
  gateway_ref     TEXT,           -- PG사 거래 ID
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed | refunded
  paid_at         DATETIME,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 기본 요금제 데이터 삽입
INSERT OR IGNORE INTO plans (code, name, target, price_monthly, price_yearly, max_cards, max_groups, features) VALUES
  ('free',     'Free',     'user',  0,      0,       3,    1,    '{"chat":true,"basic_group":true,"basic_recruiting":true}'),
  ('pro',      'Pro',      'user',  9900,   99000,   10,   5,    '{"chat":true,"advanced_group":true,"advanced_recruiting":true,"headhunter":false}'),
  ('business', 'Business', 'user',  29900,  299000,  NULL, NULL, '{"chat":true,"advanced_group":true,"advanced_recruiting":true,"headhunter":true,"crm":true}'),
  ('group_free', 'Group Free', 'group', 0,  0,       NULL, NULL, '{"basic_notice":true,"basic_member_mgmt":true}'),
  ('group_pro',  'Group Pro',  'group', 19900, 199000, NULL, NULL, '{"advanced_notice":true,"advanced_member_mgmt":true,"analytics":true,"crm":true}');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_group_id ON subscriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
